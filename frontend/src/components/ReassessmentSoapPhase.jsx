import React, { useEffect, useState } from 'react';
import {
  getOptionalObjectiveData,
  getReassessmentScenario,
  requestOptionalObjectiveData,
  submitReassessment,
  submitSoap
} from '../services/api';

function ReassessmentSoapPhase({
  sessionId,
  onNext,
  onCapture,
  onClock
}) {
  const [scenario, setScenario] = useState(null);
  const [targets, setTargets] = useState([]);
  const [reassessmentOptionalData, setReassessmentOptionalData] = useState([]);
  const [reassessmentOptionalResults, setReassessmentOptionalResults] = useState([]);
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [reassessmentRationale, setReassessmentRationale] = useState('');
  const [soapNote, setSoapNote] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      getReassessmentScenario(sessionId),
      getOptionalObjectiveData(sessionId, 'reassessment')
    ])
      .then(([data, optionalItems]) => {
        if (!mounted) return;
        setScenario(data.scenario || null);
        setTargets(data.targets || []);
        setReassessmentOptionalData(optionalItems?.optional_objective_data || []);
        setSelectedTargets([]);
        onClock?.(data.clock);
      })
      .catch(() => {
        if (mounted) setError('Reassessment scenario could not be loaded.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTarget = (id) => {
    setSelectedTargets((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const updateSoap = (key, value) => {
    setSoapNote((current) => ({ ...current, [key]: value }));
  };

  const requestReassessmentData = async (dataId) => {
    setError('');
    try {
      const data = await requestOptionalObjectiveData(sessionId, dataId, 'reassessment');
      setReassessmentOptionalResults((current) => [
        ...current.filter((item) => item.id !== data.result.id),
        data.result
      ]);
      onClock?.(data.clock);
      onCapture?.({ optionalObjectiveData: data.requests || [] });
    } catch (err) {
      setError(err.message || 'Linked reassessment data could not be requested.');
    }
  };

  const validate = () => {
    if (!selectedTargets.length) return 'Select at least one reassessment target.';
    if (reassessmentRationale.trim().length < 15) return 'Add a reassessment rationale.';
    if (Object.values(soapNote).some((value) => value.trim().length < 10)) return 'Complete each SOAP section with case-specific content.';
    return '';
  };

  const completionItems = [
    { label: `${selectedTargets.length} targets`, complete: selectedTargets.length > 0 },
    { label: `${reassessmentRationale.trim().length}/15 rationale`, complete: reassessmentRationale.trim().length >= 15 },
    { label: 'Subjective', complete: soapNote.subjective.trim().length >= 10 },
    { label: 'Objective', complete: soapNote.objective.trim().length >= 10 },
    { label: 'Assessment', complete: soapNote.assessment.trim().length >= 10 },
    { label: 'Plan', complete: soapNote.plan.trim().length >= 10 }
  ];
  const readyToDebrief = completionItems.every((item) => item.complete);

  const jumpToNextRequired = () => {
    if (!selectedTargets.length) document.querySelector('[aria-label="Reassessment Targets"] input')?.focus();
    else if (reassessmentRationale.trim().length < 15) document.getElementById('reassessment-rationale')?.focus();
    else if (soapNote.subjective.trim().length < 10) document.getElementById('soap-subjective')?.focus();
    else if (soapNote.objective.trim().length < 10) document.getElementById('soap-objective')?.focus();
    else if (soapNote.assessment.trim().length < 10) document.getElementById('soap-assessment')?.focus();
    else if (soapNote.plan.trim().length < 10) document.getElementById('soap-plan')?.focus();
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
      const reassessment = await submitReassessment(
        sessionId,
        selectedTargets,
        reassessmentRationale.trim()
      );
      onClock?.(reassessment.clock);
      onCapture?.({
        reassessmentScenario: scenario,
        reassessmentPlan: selectedTargets,
        reassessmentRationale: reassessmentRationale.trim()
      });

      const soap = await submitSoap(sessionId, soapNote, '');
      onClock?.(soap.clock);
      onCapture?.({
        soapNote: soap.soap_note,
        handoffNote: '',
        sbarHandoff: ''
      });

      onNext();
    } catch (err) {
      setError(err.message || 'Reassessment and SOAP note could not be recorded.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="step-card">
        <div className="loading">Loading reassessment scenario...</div>
      </section>
    );
  }

  return (
    <section className="step-card plan-card" aria-labelledby="reassessment-heading">
      <div className="section-header">
        <div>
          <span className="eyebrow">Reassessment / SOAP</span>
          <h2 id="reassessment-heading">What-if Reassessment and Note</h2>
        </div>
      </div>

      <nav className="workflow-section-nav" aria-label="Reassessment sections">
        <a href="#reassessment-targets">Reassessment</a>
        <a href="#soap-section">SOAP</a>
      </nav>

      <div className="workflow-readiness-strip" aria-label="Reassessment completion">
        {completionItems.map((item) => (
          <span key={item.label} className={item.complete ? 'complete' : ''}>{item.label}</span>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="single-screen-form">
        {scenario && (
          <section className="scenario-panel" aria-label="What-if reassessment scenario">
            <span className="detail-kicker">{scenario.title}</span>
            <p>{scenario.prompt}</p>
            <small>{scenario.trigger}</small>
          </section>
        )}

        {reassessmentOptionalData.length > 0 && (
          <details className="form-block progressive-details">
            <summary>Linked Reassessment Data</summary>
            <div className="compact-checkbox-grid progressive-details-content">
              {reassessmentOptionalData.map((item) => {
                const result = reassessmentOptionalResults.find((existing) => existing.id === item.id);
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
                      onClick={() => requestReassessmentData(item.id)}
                      disabled={submitting}
                    >
                      Request
                    </button>
                    {result && (
                      <p>{result.availability === 'available' ? result.note : 'No result available for this case.'}</p>
                    )}
                  </article>
                );
              })}
            </div>
          </details>
        )}

        <fieldset className="form-block" id="reassessment-targets" aria-label="Reassessment Targets">
          <legend>Reassessment Targets</legend>
          {scenario?.suggested_targets?.length > 0 && (
            <button
              type="button"
              className="btn-secondary compact-insert-button"
              onClick={() => setSelectedTargets(scenario.suggested_targets)}
              disabled={submitting}
            >
              Select suggested targets
            </button>
          )}
          <div className="compact-checkbox-grid">
            {targets.map((target) => {
              const selected = selectedTargets.includes(target.id);
              return (
                <label key={target.id} className={`compact-check-row ${selected ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleTarget(target.id)}
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

        <fieldset className="form-block" id="soap-section">
          <legend>SOAP Note</legend>
          <div className="soap-entry-grid">
            {[
              ['subjective', 'Subjective'],
              ['objective', 'Objective'],
              ['assessment', 'Assessment'],
              ['plan', 'Plan']
            ].map(([key, label]) => (
              <div className="premium-textarea-container compact-plan-field" key={key}>
                <label htmlFor={`soap-${key}`} className="premium-textarea-label">
                  <span>{label}</span>
                </label>
                <textarea
                  id={`soap-${key}`}
                  className="premium-textarea"
                  value={soapNote[key]}
                  onChange={(event) => updateSoap(key, event.target.value)}
                  placeholder={`${label}...`}
                  rows={key === 'assessment' || key === 'plan' ? 5 : 3}
                  disabled={submitting}
                />
              </div>
            ))}
          </div>
        </fieldset>

        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="step-actions">
          <div className="workflow-action-status">
            <span>Status</span>
            <strong>{readyToDebrief ? 'Ready for debrief' : 'Complete reassessment and SOAP'}</strong>
          </div>
          <button type="button" className="btn-secondary workflow-jump-button" onClick={jumpToNextRequired}>
            Next required field
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Recording note...' : 'Continue to debrief'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default ReassessmentSoapPhase;
