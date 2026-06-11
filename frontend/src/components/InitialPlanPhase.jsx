import React, { useEffect, useMemo, useState } from 'react';
import {
  getEscalationActions,
  getOptionalObjectiveData,
  getReferralOptions,
  requestOptionalObjectiveData,
  selectEscalationActions,
  submitReferral
} from '../services/api';

const PRIORITY_OPTIONS = [
  { id: 'immediate', label: 'Immediate' },
  { id: 'after_stabilization', label: 'After stabilization' },
  { id: 'reassessment_dependent', label: 'Reassessment-dependent' }
];

const CATEGORY_ORDER = [
  'Stabilization',
  'Airway / oxygenation',
  'Circulation / access',
  'Diagnostics',
  'Imaging',
  'Medications',
  'Consults',
  'Disposition',
  'Safety',
  'Other'
];

function groupedActions(actions) {
  const groups = actions.reduce((result, action) => {
    const key = action.category || 'Other';
    result[key] = [...(result[key] || []), action];
    return result;
  }, {});
  return CATEGORY_ORDER
    .filter((category) => groups[category]?.length)
    .map((category) => [category, groups[category]]);
}

function InitialPlanPhase({
  sessionId,
  onNext,
  onCapture,
  onClock
}) {
  const [actions, setActions] = useState([]);
  const [referralOptions, setReferralOptions] = useState([]);
  const [planOptionalData, setPlanOptionalData] = useState([]);
  const [planOptionalResults, setPlanOptionalResults] = useState([]);
  const [selectedActionIds, setSelectedActionIds] = useState([]);
  const [actionMeta, setActionMeta] = useState({});
  const [actionSearch, setActionSearch] = useState('');
  const [managementRationale, setManagementRationale] = useState('');
  const [planDetails, setPlanDetails] = useState({
    diagnostics: '',
    treatments: '',
    medications: '',
    disposition: '',
    priority_notes: '',
    other: ''
  });
  const [consultNeeded, setConsultNeeded] = useState(null);
  const [consultSpecialty, setConsultSpecialty] = useState('');
  const [consultRationale, setConsultRationale] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      getEscalationActions(sessionId),
      getReferralOptions(sessionId),
      getOptionalObjectiveData(sessionId, 'plan')
    ])
      .then(([actionItems, consultItems, optionalItems]) => {
        if (!mounted) return;
        setActions(actionItems || []);
        setReferralOptions(consultItems || []);
        setPlanOptionalData(optionalItems?.optional_objective_data || []);
        setConsultSpecialty(consultItems?.[0] || '');
      })
      .catch(() => {
        if (mounted) setError('Plan options could not be loaded.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [sessionId]);

  const selectedActions = useMemo(
    () => selectedActionIds.map((id) => actions.find((action) => action.id === id)).filter(Boolean),
    [actions, selectedActionIds]
  );

  const toggleAction = (id) => {
    setSelectedActionIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
    setActionMeta((current) => ({
      ...current,
      [id]: {
        priority: current[id]?.priority || 'immediate',
        route: current[id]?.route || '',
        rationale: current[id]?.rationale || '',
        free_text: current[id]?.free_text || ''
      }
    }));
  };

  const updateActionMeta = (id, patch) => {
    setActionMeta((current) => ({
      ...current,
      [id]: {
        priority: current[id]?.priority || 'immediate',
        route: current[id]?.route || '',
        rationale: current[id]?.rationale || '',
        free_text: current[id]?.free_text || '',
        ...patch
      }
    }));
  };

  const validate = () => {
    if (managementRationale.trim().length < 15) return 'Add a brief management rationale.';
    if (planDetails.diagnostics.trim().length < 3) return 'Add diagnostic tests.';
    if (planDetails.treatments.trim().length < 3) return 'Add immediate treatments.';
    if (planDetails.medications.trim().length < 3) return 'Add medication considerations.';
    if (planDetails.disposition.trim().length < 3) return 'Add disposition intent.';
    if (consultNeeded === null) return 'Choose a consult decision.';
    if (consultNeeded && !consultSpecialty) return 'Select a consult service.';
    if (consultRationale.trim().length < 15) return 'Add a consult rationale.';
    return '';
  };

  const planCompletionItems = [
    { label: `${selectedActionIds.length} actions`, complete: true },
    { label: `${managementRationale.trim().length}/15 rationale`, complete: managementRationale.trim().length >= 15 },
    { label: 'Diagnostics', complete: planDetails.diagnostics.trim().length >= 3 },
    { label: 'Treatments', complete: planDetails.treatments.trim().length >= 3 },
    { label: 'Meds', complete: planDetails.medications.trim().length >= 3 },
    { label: 'Disposition', complete: planDetails.disposition.trim().length >= 3 },
    { label: consultNeeded === null ? 'Consult decision' : 'Consult decided', complete: consultNeeded !== null },
    { label: 'Consult rationale', complete: consultRationale.trim().length >= 15 }
  ];
  const planReady = planCompletionItems.every((item) => item.complete);

  const jumpToNextRequired = () => {
    if (managementRationale.trim().length < 15) document.getElementById('management-rationale')?.focus();
    else if (planDetails.diagnostics.trim().length < 3) document.getElementById('plan-diagnostics')?.focus();
    else if (planDetails.treatments.trim().length < 3) document.getElementById('plan-treatments')?.focus();
    else if (planDetails.medications.trim().length < 3) document.getElementById('plan-medications')?.focus();
    else if (planDetails.disposition.trim().length < 3) document.getElementById('plan-disposition')?.focus();
    else if (consultNeeded === null) document.querySelector('.choice-card')?.focus();
    else if (consultRationale.trim().length < 15) document.getElementById('consult-rationale')?.focus();
  };

  const planDataEnabled = (item) => {
    if (!item.unlock_action_ids?.length) return selectedActionIds.length > 0;
    return item.unlock_action_ids.some((actionId) => selectedActionIds.includes(actionId));
  };

  const requestPlanData = async (dataId) => {
    setError('');
    try {
      const data = await requestOptionalObjectiveData(sessionId, dataId, 'plan', { selectedActionIds });
      setPlanOptionalResults((current) => [
        ...current.filter((item) => item.id !== data.result.id),
        data.result
      ]);
      onClock?.(data.clock);
      onCapture?.({ optionalObjectiveData: data.requests || [] });
    } catch (err) {
      setError(err.message || 'Linked plan data could not be requested.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      window.requestAnimationFrame(jumpToNextRequired);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const consult = await submitReferral(sessionId, {
        needed: consultNeeded,
        specialty: consultNeeded ? consultSpecialty : '',
        rationale: consultRationale.trim()
      });
      onClock?.(consult.clock);
      onCapture?.({
        referralNeeded: consult.referral_needed,
        referralSpecialty: consult.referral_specialty,
        referralRationale: consult.rationale,
        consultNeeded: consult.referral_needed,
        consultSpecialty: consult.referral_specialty,
        consultRationale: consult.rationale
      });

      const selectedActionEntries = selectedActionIds.map((actionId) => ({
        action_id: actionId,
        category: actions.find((action) => action.id === actionId)?.category || '',
        priority: actionMeta[actionId]?.priority || 'immediate',
        route: actionMeta[actionId]?.route || '',
        rationale: actionMeta[actionId]?.rationale || '',
        free_text: actionMeta[actionId]?.free_text || ''
      }));

      const management = await selectEscalationActions(
        sessionId,
        selectedActionIds,
        managementRationale.trim(),
        {
          ...planDetails,
          selected_actions: selectedActionEntries
        }
      );
      onClock?.(management.clock);
      onCapture?.({
        interventions: management.actions_performed,
        escalationActions: management.actions_performed,
        selectedActions: management.selected_actions,
        escalationRationale: management.rationale,
        initialPlan: management.initial_plan || planDetails
      });

      onNext();
    } catch (err) {
      setError(err.message || 'Plan could not be recorded.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="step-card">
        <div className="loading">Loading plan options...</div>
      </section>
    );
  }

  const grouped = groupedActions(actions);
  const visibleGrouped = grouped
    .map(([group, items]) => [
      group,
      items.filter((action) => {
        const query = actionSearch.trim().toLowerCase();
        if (!query) return true;
        return `${action.name} ${action.category || ''}`.toLowerCase().includes(query);
      })
    ])
    .filter(([, items]) => items.length);

  return (
    <section className="step-card plan-card" aria-labelledby="plan-heading">
      <div className="section-header">
        <div>
          <span className="eyebrow">Plan / Consults</span>
          <h2 id="plan-heading">Priority Actions and Consults</h2>
        </div>
        <span className="clinical-badge">{selectedActionIds.length} selected</span>
      </div>

      <nav className="workflow-section-nav" aria-label="Plan sections">
        <a href="#plan-actions">Actions</a>
        <a href="#plan-details">Details</a>
        <a href="#plan-data">Data</a>
        <a href="#plan-consults">Consult</a>
      </nav>

      <div className="workflow-readiness-strip" aria-label="Plan completion">
        {planCompletionItems.map((item) => (
          <span key={item.label} className={item.complete ? 'complete' : ''}>{item.label}</span>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="single-screen-form">
        <fieldset className="form-block" id="plan-actions">
          <legend>Action Groups</legend>
          <div className="plan-action-toolbar">
            <label htmlFor="plan-action-search" className="sr-only">Filter plan actions</label>
            <input
              id="plan-action-search"
              className="premium-input compact-filter-input"
              value={actionSearch}
              onChange={(event) => setActionSearch(event.target.value)}
              placeholder="Filter actions"
            />
            <span>{selectedActionIds.length} selected · {selectedActionIds.length || 'No'} estimated resource signal</span>
          </div>
          <div className="action-cluster-grid expanded-action-grid">
            {visibleGrouped.map(([group, items]) => (
              <div className="intervention-compact-cluster" key={group}>
                <strong>{group}</strong>
                {items.map((action) => {
                  const selected = selectedActionIds.includes(action.id);
                  return (
                    <label key={action.id} className={`compact-check-row ${selected ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleAction(action.id)}
                        disabled={submitting}
                      />
                      <span>{action.name}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </fieldset>

        {selectedActions.length > 0 && (
          <fieldset className="form-block">
            <legend>Selected Action Details</legend>
            <div className="selected-action-detail-grid">
              {selectedActions.map((action) => {
                const meta = actionMeta[action.id] || {};
                return (
                  <article className="selected-action-detail" key={action.id}>
                    <div>
                      <strong>{action.name}</strong>
                      <small>{action.category}</small>
                    </div>
                    <label>
                      <span>Priority</span>
                      <select
                        className="premium-input"
                        value={meta.priority || 'immediate'}
                        onChange={(event) => updateActionMeta(action.id, { priority: event.target.value })}
                        disabled={submitting}
                      >
                        {PRIORITY_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    {action.route_options?.length > 0 && (
                      <label>
                        <span>Route</span>
                        <select
                          className="premium-input"
                          value={meta.route || ''}
                          onChange={(event) => updateActionMeta(action.id, { route: event.target.value })}
                          disabled={submitting}
                        >
                          <option value="">Select route</option>
                          {action.route_options.map((route) => (
                            <option key={route} value={route}>{route}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {action.id === 'other_action' && (
                      <label>
                        <span>Other action</span>
                        <input
                          className="premium-input"
                          value={meta.free_text || ''}
                          onChange={(event) => updateActionMeta(action.id, { free_text: event.target.value })}
                          disabled={submitting}
                        />
                      </label>
                    )}
                  </article>
                );
              })}
            </div>
          </fieldset>
        )}

        <fieldset className="form-block" id="plan-details">
          <legend>Plan Details</legend>
          <label htmlFor="management-rationale" className="premium-textarea-label">
            <span>Management Rationale</span>
          </label>
          <textarea
            id="management-rationale"
            className="premium-textarea"
            value={managementRationale}
            onChange={(event) => setManagementRationale(event.target.value)}
            placeholder="Why these first actions, or why routine waiting?"
            rows="3"
            disabled={submitting}
          />
          <div className="initial-plan-grid">
            {[
              ['diagnostics', 'Diagnostic Tests'],
              ['treatments', 'Immediate Treatments'],
              ['medications', 'Medication Considerations'],
              ['disposition', 'Disposition Intent'],
              ['priority_notes', 'Priority Sequence'],
              ['other', 'Other']
            ].map(([key, label]) => (
              <div className="premium-textarea-container compact-plan-field" key={key}>
                <label htmlFor={`plan-${key}`} className="premium-textarea-label">
                  <span>{label}</span>
                </label>
                <textarea
                  id={`plan-${key}`}
                  className="premium-textarea"
                  value={planDetails[key]}
                  onChange={(event) => setPlanDetails((current) => ({ ...current, [key]: event.target.value }))}
                  placeholder="I would..."
                  rows="3"
                  disabled={submitting}
                />
              </div>
            ))}
          </div>
        </fieldset>

        {planOptionalData.length > 0 && (
          <details className="form-block progressive-details" id="plan-data">
            <summary>Linked Plan Data</summary>
            <div className="compact-checkbox-grid progressive-details-content">
              {planOptionalData.map((item) => {
                const result = planOptionalResults.find((existing) => existing.id === item.id);
                const enabled = planDataEnabled(item);
                const scaffoldLimited = item.source_restriction === 'public_simulation_scaffold';
                return (
                  <article key={item.id} className="optional-data-card">
                    <div>
                      <strong>{item.label}</strong>
                      <small>{result ? (result.value || 'No result available') : item.category}</small>
                    </div>
                    {scaffoldLimited && (
                      <p className="optional-data-limitation">
                        Draft simulation scaffold; not source-record truth or clinician-adjudicated evidence.
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn-secondary compact-insert-button"
                      onClick={() => requestPlanData(item.id)}
                      disabled={submitting || !enabled}
                    >
                      Request
                    </button>
                    {result ? (
                      <p>{result.availability === 'available' ? result.note : 'No result available for this case.'}</p>
                    ) : (
                      <p>{enabled ? 'Available after this request.' : 'Select the matching action first.'}</p>
                    )}
                  </article>
                );
              })}
            </div>
          </details>
        )}

        <fieldset className="form-block" id="plan-consults">
          <legend>Consults</legend>
          <div className="choice-row">
            <button
              type="button"
              className={`choice-card ${consultNeeded === true ? 'selected' : ''}`}
              onClick={() => setConsultNeeded(true)}
              disabled={submitting}
              aria-pressed={consultNeeded === true}
              aria-label="Consult now"
            >
              <strong>Consult Now</strong>
              <span>Specialty or escalation communication is part of the plan.</span>
            </button>
            <button
              type="button"
              className={`choice-card ${consultNeeded === false ? 'selected' : ''}`}
              onClick={() => setConsultNeeded(false)}
              disabled={submitting}
              aria-pressed={consultNeeded === false}
              aria-label="No immediate consult"
            >
              <strong>No Immediate Consult</strong>
              <span>Still document what would trigger escalation later.</span>
            </button>
          </div>
          {consultNeeded === true && (
            <>
              <label htmlFor="consult-specialty" className="premium-textarea-label">
                <span>Consult Service</span>
              </label>
              <select
                id="consult-specialty"
                className="premium-input"
                value={consultSpecialty}
                onChange={(event) => setConsultSpecialty(event.target.value)}
                disabled={submitting}
              >
                {referralOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </>
          )}
          <label htmlFor="consult-rationale" className="premium-textarea-label">
            <span>Consult Rationale</span>
          </label>
          <textarea
            id="consult-rationale"
            className="premium-textarea"
            value={consultRationale}
            onChange={(event) => setConsultRationale(event.target.value)}
            placeholder="Why consult now, or why not yet?"
            rows="3"
            disabled={submitting}
          />
        </fieldset>

        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="step-actions">
          <div className="workflow-action-status">
            <span>Status</span>
            <strong>{planReady ? 'Ready to continue' : 'Complete required plan fields'}</strong>
          </div>
          <button type="button" className="btn-secondary workflow-jump-button" onClick={jumpToNextRequired}>
            Next required field
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Recording plan...' : 'Continue to reassessment'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default InitialPlanPhase;
