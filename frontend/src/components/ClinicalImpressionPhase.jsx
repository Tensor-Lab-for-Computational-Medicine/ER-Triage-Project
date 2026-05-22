import React, { useEffect, useState } from 'react';
import {
  assignTriage,
  getReferralOptions,
  recordDiagnosis,
  submitReferral
} from '../services/api';

const TRIAGE_LEVELS = [
  { level: 1, label: 'ESI 1', name: 'Resuscitation' },
  { level: 2, label: 'ESI 2', name: 'Emergent' },
  { level: 3, label: 'ESI 3', name: 'Urgent' },
  { level: 4, label: 'ESI 4', name: 'Less urgent' },
  { level: 5, label: 'ESI 5', name: 'Non-urgent' }
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
  const [referralOptions, setReferralOptions] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [triageRationale, setTriageRationale] = useState('');
  const [workingDiagnosis, setWorkingDiagnosis] = useState('');
  const [differentialText, setDifferentialText] = useState('');
  const [diagnosisEvidence, setDiagnosisEvidence] = useState('');
  const [referralNeeded, setReferralNeeded] = useState(null);
  const [referralSpecialty, setReferralSpecialty] = useState('');
  const [referralRationale, setReferralRationale] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getReferralOptions(sessionId)
      .then((items) => {
        if (!mounted) return;
        setReferralOptions(items || []);
        setReferralSpecialty(items?.[0] || '');
      })
      .catch(() => {
        if (mounted) setReferralOptions([]);
      });
    return () => { mounted = false; };
  }, [sessionId]);

  const validate = () => {
    const differential = parseDifferential(differentialText);
    if (!selectedLevel) return 'Select an ESI level.';
    if (triageRationale.trim().length < 20) return 'Add a brief ESI rationale.';
    if (workingDiagnosis.trim().length < 3) return 'Enter a working diagnosis.';
    if (!differential.length) return 'Enter at least one differential diagnosis.';
    if (diagnosisEvidence.trim().length < 20) return 'Add diagnosis evidence.';
    if (referralNeeded === null) return 'Choose a referral decision.';
    if (referralNeeded && !referralSpecialty) return 'Select a referral service.';
    if (referralRationale.trim().length < 15) return 'Add a referral rationale.';
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
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

      const referral = await submitReferral(sessionId, {
        needed: referralNeeded,
        specialty: referralNeeded ? referralSpecialty : '',
        rationale: referralRationale.trim()
      });
      onClock?.(referral.clock);
      onCapture?.({
        referralNeeded: referral.referral_needed,
        referralSpecialty: referral.referral_specialty,
        referralRationale: referral.rationale
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
          <h2 id="impression-heading">Acuity, Diagnosis, Referral</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="single-screen-form">
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

        <fieldset className="form-block">
          <legend>Referral Judgment</legend>
          <div className="choice-row">
            <button
              type="button"
              className={`choice-card ${referralNeeded === true ? 'selected' : ''}`}
              onClick={() => setReferralNeeded(true)}
              disabled={submitting}
              aria-pressed={referralNeeded === true}
              aria-label="Specialty Input Needed"
            >
              <strong>Specialty Input Needed</strong>
            </button>
            <button
              type="button"
              className={`choice-card ${referralNeeded === false ? 'selected' : ''}`}
              onClick={() => setReferralNeeded(false)}
              disabled={submitting}
              aria-pressed={referralNeeded === false}
              aria-label="No Immediate Referral"
            >
              <strong>No Immediate Referral</strong>
            </button>
          </div>
          {referralNeeded === true && (
            <>
              <label htmlFor="referral-specialty" className="premium-textarea-label">
                <span>Referral Service</span>
              </label>
              <select
                id="referral-specialty"
                className="premium-input"
                value={referralSpecialty}
                onChange={(event) => setReferralSpecialty(event.target.value)}
                disabled={submitting}
              >
                {referralOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </>
          )}
          <label htmlFor="referral-rationale" className="premium-textarea-label">
            <span>Referral Rationale</span>
          </label>
          <textarea
            id="referral-rationale"
            className="premium-textarea"
            value={referralRationale}
            onChange={(event) => setReferralRationale(event.target.value)}
            placeholder="Why escalate now, or what would trigger escalation later?"
            rows="3"
            disabled={submitting}
          />
        </fieldset>

        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="step-actions">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Recording impression...' : 'Continue to plan'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default ClinicalImpressionPhase;
