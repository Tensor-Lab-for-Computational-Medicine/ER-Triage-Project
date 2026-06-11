import React, { useEffect, useState } from 'react';
import {
  assignTriage,
  recordDiagnosis
} from '../services/api';

const TRIAGE_LEVELS = [
  { level: 1, label: 'ESI 1', name: 'Resuscitation', hint: 'Immediate lifesaving intervention' },
  { level: 2, label: 'ESI 2', name: 'Emergent', hint: 'High risk or danger-zone instability' },
  { level: 3, label: 'ESI 3', name: 'Urgent', hint: 'Multiple resources, stable enough to wait' },
  { level: 4, label: 'ESI 4', name: 'Less urgent', hint: 'One expected ED resource' },
  { level: 5, label: 'ESI 5', name: 'Non-urgent', hint: 'No ED resources expected' }
];

function parseDifferential(text) {
  return text
    .split(/\n|;/)
    .map((item) => item.replace(/^[-*\d.]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

function ClinicalImpressionPhase({
  sessionId,
  onNext,
  onCapture,
  onClock
}) {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [triageRationale, setTriageRationale] = useState('');
  const [workingDiagnosis, setWorkingDiagnosis] = useState('');
  const [differentialText, setDifferentialText] = useState('');
  const [diagnosisEvidence, setDiagnosisEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedLevel(null);
    setTriageRationale('');
    setWorkingDiagnosis('');
    setDifferentialText('');
    setDiagnosisEvidence('');
    setError('');
  }, [sessionId]);

  const validate = () => {
    const differential = parseDifferential(differentialText);
    if (!selectedLevel) return 'Select an ESI level.';
    if (triageRationale.trim().length < 20) return 'Add a brief ESI rationale.';
    if (workingDiagnosis.trim().length < 3) return 'Enter a working diagnosis.';
    if (!differential.length) return 'Enter at least one differential diagnosis.';
    if (diagnosisEvidence.trim().length < 20) return 'Add diagnosis evidence.';
    return '';
  };

  const completionItems = [
    { label: selectedLevel ? `ESI ${selectedLevel}` : 'Select ESI', complete: Boolean(selectedLevel) },
    { label: `${triageRationale.trim().length}/20 rationale`, complete: triageRationale.trim().length >= 20 },
    { label: workingDiagnosis.trim() ? 'Working diagnosis' : 'Diagnosis needed', complete: workingDiagnosis.trim().length >= 3 },
    { label: `${parseDifferential(differentialText).length} differential`, complete: parseDifferential(differentialText).length > 0 },
    { label: `${diagnosisEvidence.trim().length}/20 evidence`, complete: diagnosisEvidence.trim().length >= 20 }
  ];

  const jumpToNextRequired = () => {
    if (!selectedLevel) {
      document.querySelector('.triage-button-card')?.focus();
      return;
    }
    if (triageRationale.trim().length < 20) document.getElementById('esi-rationale')?.focus();
    else if (workingDiagnosis.trim().length < 3) document.getElementById('working-diagnosis')?.focus();
    else if (!parseDifferential(differentialText).length) document.getElementById('differential-list')?.focus();
    else if (diagnosisEvidence.trim().length < 20) document.getElementById('diagnosis-evidence')?.focus();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      window.requestAnimationFrame(jumpToNextRequired);
      return;
    }

    const differential = parseDifferential(differentialText);
    setSubmitting(true);
    setError('');

    try {
      const triage = await assignTriage(sessionId, selectedLevel, triageRationale.trim());
      onClock?.(triage.clock);
      onCapture?.({
        triageLevel: selectedLevel,
        triageRationale: triageRationale.trim()
      });

      const diagnosis = await recordDiagnosis(
        sessionId,
        workingDiagnosis.trim(),
        differential,
        diagnosisEvidence.trim()
      );
      onClock?.(diagnosis.clock);
      onCapture?.({
        workingDiagnosis: diagnosis.working_diagnosis,
        differential: diagnosis.differential,
        diagnosisEvidence: diagnosis.evidence
      });

      onNext();
    } catch (err) {
      setError(err.message || 'Clinical impression could not be recorded.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="step-card impression-card" aria-labelledby="impression-heading">
      <div className="section-header">
        <div>
          <span className="eyebrow">Impression</span>
          <h2 id="impression-heading">Acuity and Diagnosis</h2>
        </div>
      </div>

      <div className="workflow-readiness-strip" aria-label="Impression completion">
        {completionItems.map((item) => (
          <span key={item.label} className={item.complete ? 'complete' : ''}>{item.label}</span>
        ))}
      </div>

      <form id="impression-form" onSubmit={handleSubmit} className="single-screen-form">
        <fieldset className="form-block">
          <legend>ESI Acuity</legend>
          <div className="triage-levels-grid compact-triage-grid">
            {TRIAGE_LEVELS.map((level) => (
              <button
                type="button"
                key={level.level}
                className={`triage-button-card level-${level.level} ${selectedLevel === level.level ? 'selected' : ''}`}
                onClick={() => setSelectedLevel(level.level)}
                disabled={submitting}
                aria-pressed={selectedLevel === level.level}
              >
                <div className="triage-level-badge">{level.label}</div>
                <strong className="triage-level-name">{level.name}</strong>
                <small className="triage-level-desc">{level.hint}</small>
              </button>
            ))}
          </div>
          <label htmlFor="esi-rationale" className="premium-textarea-label">
            <span>ESI Rationale</span>
          </label>
          <textarea
            id="esi-rationale"
            className="premium-textarea"
            value={triageRationale}
            onChange={(event) => setTriageRationale(event.target.value)}
            placeholder="Why this acuity level?"
            rows="3"
            disabled={submitting}
          />
        </fieldset>

        <fieldset className="form-block">
          <legend>Working Diagnosis</legend>
          <label htmlFor="working-diagnosis" className="premium-textarea-label">
            <span>Working Diagnosis</span>
          </label>
          <input
            id="working-diagnosis"
            className="premium-input"
            value={workingDiagnosis}
            onChange={(event) => setWorkingDiagnosis(event.target.value)}
            placeholder="Most likely problem"
            disabled={submitting}
          />
          <label htmlFor="differential-list" className="premium-textarea-label">
            <span>Differential</span>
          </label>
          <textarea
            id="differential-list"
            className="premium-textarea"
            value={differentialText}
            onChange={(event) => setDifferentialText(event.target.value)}
            placeholder="One possibility per line"
            rows="3"
            disabled={submitting}
          />
          <label htmlFor="diagnosis-evidence" className="premium-textarea-label">
            <span>Diagnosis Evidence</span>
          </label>
          <textarea
            id="diagnosis-evidence"
            className="premium-textarea"
            value={diagnosisEvidence}
            onChange={(event) => setDiagnosisEvidence(event.target.value)}
            placeholder="What supports or argues against your impression?"
            rows="3"
            disabled={submitting}
          />
        </fieldset>

        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="step-actions">
          <div className="workflow-action-status">
            <span>Status</span>
            <strong>{completionItems.every((item) => item.complete) ? 'Ready to continue' : 'Complete required impression fields'}</strong>
          </div>
          <button type="button" className="btn-secondary workflow-jump-button" onClick={jumpToNextRequired}>
            Next required field
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Recording impression...' : 'Continue to plan'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default ClinicalImpressionPhase;
