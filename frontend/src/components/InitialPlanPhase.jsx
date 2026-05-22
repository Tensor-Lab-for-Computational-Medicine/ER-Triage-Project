import React, { useEffect, useState } from 'react';
import {
  getEscalationActions,
  selectEscalationActions,
  submitReassessment,
  submitSbar
} from '../services/api';

const REASSESSMENT_TARGETS = [
  { id: 'vital_trend', label: 'Repeat abnormal vital signs' },
  { id: 'pain_response', label: 'Reassess pain and distress' },
  { id: 'airway_breathing', label: 'Recheck airway and breathing' },
  { id: 'circulation_bleeding', label: 'Recheck perfusion or bleeding risk' },
  { id: 'neuro_mental_status', label: 'Reassess neurologic or mental status' },
  { id: 'infection_fever', label: 'Reassess fever or infection trajectory' },
  { id: 'distal_neurovascular', label: 'Repeat distal neurovascular checks' },
  { id: 'disposition_safety', label: 'Confirm disposition safety' }
];

function clusterName(action) {
  const category = action.category || '';
  const name = String(action.name || '').toLowerCase();
  if (category === 'Airway and breathing' || category === 'Access and circulation' || category === 'Critical procedures' || category === 'Safety') return 'Stabilize';
  if (category === 'Medications' || name.includes('analgesia') || name.includes('medication')) return 'Treat';
  if (category === 'Escalation' || name.includes('notify') || name.includes('team') || name.includes('consult')) return 'Escalate';
  if (category === 'Placement' || name.includes('monitoring') || name.includes('draw') || name.includes('test') || name.includes('ecg')) return 'Assess';
  return 'Disposition';
}

function groupedActions(actions) {
  return actions.reduce((groups, action) => {
    const key = clusterName(action);
    return {
      ...groups,
      [key]: [...(groups[key] || []), action]
    };
  }, {});
}

function InitialPlanPhase({
  sessionId,
  onNext,
  onCapture,
  onClock
}) {
  const [actions, setActions] = useState([]);
  const [selectedActionIds, setSelectedActionIds] = useState([]);
  const [managementRationale, setManagementRationale] = useState('');
  const [planDetails, setPlanDetails] = useState({
    diagnostics: '',
    treatments: '',
    medications: '',
    disposition: ''
  });
  const [reassessmentTargets, setReassessmentTargets] = useState([]);
  const [reassessmentRationale, setReassessmentRationale] = useState('');
  const [handoff, setHandoff] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getEscalationActions(sessionId)
      .then((items) => {
        if (mounted) setActions(items || []);
      })
      .catch(() => {
        if (mounted) setError('Initial action options could not be loaded.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [sessionId]);

  const toggleAction = (id) => {
    setSelectedActionIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleReassessment = (id) => {
    setReassessmentTargets((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const insertSbarLabels = () => {
    setHandoff((current) => current.trim() || 'S: \nB: \nA: \nR: ');
  };

  const validate = () => {
    if (managementRationale.trim().length < 15) return 'Add a brief management rationale.';
    if (planDetails.diagnostics.trim().length < 3) return 'Add diagnostic tests.';
    if (planDetails.treatments.trim().length < 3) return 'Add immediate treatments.';
    if (planDetails.medications.trim().length < 3) return 'Add medication considerations.';
    if (planDetails.disposition.trim().length < 3) return 'Add disposition intent.';
    if (!reassessmentTargets.length) return 'Select at least one reassessment target.';
    if (reassessmentRationale.trim().length < 15) return 'Add a reassessment rationale.';
    if (handoff.trim().length < 20) return 'Write a concise SBAR handoff.';
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const management = await selectEscalationActions(
        sessionId,
        selectedActionIds,
        managementRationale.trim(),
        planDetails
      );
      onClock?.(management.clock);
      onCapture?.({
        interventions: management.actions_performed,
        escalationActions: management.actions_performed,
        escalationRationale: management.rationale,
        initialPlan: management.initial_plan || planDetails
      });

      const reassessment = await submitReassessment(
        sessionId,
        reassessmentTargets,
        reassessmentRationale.trim()
      );
      onClock?.(reassessment.clock);
      onCapture?.({
        reassessmentPlan: reassessmentTargets,
        reassessmentRationale: reassessmentRationale.trim()
      });

      const sbar = await submitSbar(sessionId, handoff.trim());
      onClock?.(sbar.clock);
      onCapture?.({ sbarHandoff: handoff.trim() });
      onNext();
    } catch (err) {
      setError(err.message || 'Initial plan could not be recorded.');
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

  return (
    <section className="step-card plan-card" aria-labelledby="plan-heading">
      <div className="section-header">
        <div>
          <span className="eyebrow">Plan</span>
          <h2 id="plan-heading">Actions, Reassessment, SBAR</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="single-screen-form">
        <fieldset className="form-block">
          <legend>Immediate Actions</legend>
          <div className="action-cluster-grid">
            {Object.entries(grouped).map(([group, items]) => (
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
        </fieldset>

        <fieldset className="form-block">
          <legend>Plan Details</legend>
          <div className="initial-plan-grid">
            {[
              ['diagnostics', 'Diagnostic Tests'],
              ['treatments', 'Immediate Treatments'],
              ['medications', 'Medication Considerations'],
              ['disposition', 'Disposition Intent']
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

        <fieldset className="form-block">
          <legend>Reassessment</legend>
          <div className="compact-checkbox-grid">
            {REASSESSMENT_TARGETS.map((target) => {
              const selected = reassessmentTargets.includes(target.id);
              return (
                <label key={target.id} className={`compact-check-row ${selected ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleReassessment(target.id)}
                    disabled={submitting}
                  />
                  <span>{target.label}</span>
                </label>
              );
            })}
          </div>
          <label htmlFor="reassessment-rationale" className="premium-textarea-label">
            <span>Reassessment Rationale</span>
          </label>
          <textarea
            id="reassessment-rationale"
            className="premium-textarea"
            value={reassessmentRationale}
            onChange={(event) => setReassessmentRationale(event.target.value)}
            placeholder="What would you recheck, and what would change your plan?"
            rows="3"
            disabled={submitting}
          />
        </fieldset>

        <fieldset className="form-block">
          <legend>SBAR Handoff</legend>
          <button className="btn-secondary compact-insert-button" type="button" onClick={insertSbarLabels} disabled={submitting}>
            Insert SBAR labels
          </button>
          <label htmlFor="sbar-handoff" className="premium-textarea-label">
            <span>Handoff Summary</span>
          </label>
          <textarea
            id="sbar-handoff"
            className="premium-textarea"
            value={handoff}
            onChange={(event) => setHandoff(event.target.value)}
            placeholder="S: ...&#10;B: ...&#10;A: ...&#10;R: ..."
            rows="5"
            disabled={submitting}
          />
        </fieldset>

        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="step-actions">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Recording plan...' : 'Continue to debrief'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default InitialPlanPhase;
