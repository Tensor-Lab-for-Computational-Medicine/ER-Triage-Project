import React, { useState } from 'react';
import { recordDiagnosis } from '../services/api';

function parseDifferential(text) {
  return text
    .split(/\n|;/)
    .map((item) => item.replace(/^[-*\d.]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

function DiagnosisForm({ sessionId, onNext, onCapture, onClock }) {
  const [diagnosis, setDiagnosis] = useState('');
  const [differentialText, setDifferentialText] = useState('');
  const [evidence, setEvidence] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const evidenceReady = evidence.trim().length >= 20;
  const diagnosisReady = diagnosis.trim().length >= 3;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const differential = parseDifferential(differentialText);
    if (!diagnosisReady) {
      setError('Enter a working diagnosis before proceeding.');
      return;
    }
    if (!evidenceReady) {
      setError('Add a brief evidence statement for the working diagnosis.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await recordDiagnosis(sessionId, diagnosis.trim(), differential, evidence.trim());
      setSubmitted(true);
      if (onClock && data.clock) onClock(data.clock);
      if (onCapture) {
        onCapture({
          workingDiagnosis: data.working_diagnosis,
          differential: data.differential,
          diagnosisEvidence: data.evidence
        });
      }
      onNext();
    } catch (err) {
      setError(err.message || 'Failed to record working diagnosis.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="step-card diagnosis-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Clinical Impression <span className="provenance-tag student-tag">Student Decision</span></span>
          <h2 id="diagnosis-heading">Working Diagnosis & Differential</h2>
          <p className="subtitle">
            Commit to the most likely clinical problem and the evidence that would shape the next ED decisions.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="decision-form-stack">
        <div className="premium-textarea-container">
          <label htmlFor="working-diagnosis" className="premium-textarea-label">
            <span>Working Diagnosis</span>
            <span className="input-badge">Required</span>
          </label>
          <input
            id="working-diagnosis"
            className="premium-input"
            value={diagnosis}
            onChange={(event) => setDiagnosis(event.target.value)}
            placeholder="Example: Acute coronary syndrome vs other chest pain cause"
            disabled={submitted || loading}
          />
        </div>

        <div className="premium-textarea-container">
          <label htmlFor="differential-list" className="premium-textarea-label">
            <span>Differential Diagnosis</span>
            <span className="input-badge optional-badge">Optional</span>
          </label>
          <p className="premium-textarea-hint">
            Add one diagnosis per line or separate possibilities with semicolons.
          </p>
          <textarea
            id="differential-list"
            className="premium-textarea"
            value={differentialText}
            onChange={(event) => setDifferentialText(event.target.value)}
            placeholder={'Pulmonary embolism\nPneumonia\nMusculoskeletal pain'}
            rows="4"
            disabled={submitted || loading}
          />
        </div>

        <div className="premium-textarea-container">
          <label htmlFor="diagnosis-evidence" className="premium-textarea-label">
            <span>Diagnosis Evidence</span>
            <span className="input-badge">Required</span>
          </label>
          <p className="premium-textarea-hint">
            Use the patient story, vitals, exam targets, and uncertainty that would change your plan.
          </p>
          <textarea
            id="diagnosis-evidence"
            className="premium-textarea"
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            placeholder="My working diagnosis is supported by..."
            rows="5"
            disabled={submitted || loading}
          />
          <div className="char-count" style={{ marginTop: '8px', textAlign: 'right', fontSize: '0.85rem', color: evidenceReady ? '#16a34a' : '#ef4444' }}>
            {evidence.trim().length} / 20 minimum characters required
          </div>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}

        <div className="step-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || submitted || !diagnosisReady || !evidenceReady}
          >
            {loading ? 'Locking Diagnosis...' : 'Lock diagnosis & continue'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default DiagnosisForm;
