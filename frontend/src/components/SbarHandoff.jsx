import React, { useState } from 'react';
import { submitSbar } from '../services/api';

function SbarHandoff({ sessionId, coachEnabled = false, onNext, onCapture, onClock }) {
  const [handoff, setHandoff] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handoffLength = handoff.trim().length;
  const handoffReady = handoffLength >= 20;

  const insertStructure = () => {
    setHandoff((current) => {
      const trimmed = current.trim();
      if (!trimmed) return 'S: \nB: \nA: \nR: ';
      return ['S:', 'B:', 'A:', 'R:'].reduce((text, label) => {
        if (text.includes(label)) return text;
        return `${text}\n${label} `;
      }, trimmed);
    });
  };

  const handleSubmit = async () => {
    const trimmed = handoff.trim();
    if (trimmed.length < 20) {
      setError('Write a concise SBAR handoff before debrief.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await submitSbar(sessionId, trimmed);
      setSubmitted(true);
      if (onClock) onClock(data.clock);
      if (onCapture) onCapture({ sbarHandoff: trimmed });
    } catch (err) {
      setError(err.response?.data?.error || 'SBAR handoff could not be recorded.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="step-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">
            Step 5 of 6 <span className="provenance-tag student-tag">Student Decision</span>
          </span>
          <h2 id="sbar-heading">SBAR Handoff</h2>
        </div>
        <span className="clinical-badge">{submitted ? 'Recorded' : 'Required'}</span>
      </div>

      <p className="instruction">
        Call report to the receiving team with the current situation, relevant background, clinical assessment, and recommended next action.
      </p>



      <div className="premium-textarea-container">
        <label htmlFor="sbar-handoff" className="premium-textarea-label">
          <span>Handoff Summary (SBAR Format)</span>
          <span className="input-badge">Required</span>
        </label>
        <p className="premium-textarea-hint">
          S: Current problem. B: Relevant history. A: Acuity/risk. R: Placement, monitoring, or next clinician action.
        </p>
        <textarea
          id="sbar-handoff"
          className="premium-textarea"
          value={handoff}
          onChange={(event) => setHandoff(event.target.value)}
          placeholder="S: ...&#10;B: ...&#10;A: ...&#10;R: ..."
          rows="7"
          disabled={submitted || loading}
        />
        <div className="char-count" style={{ marginTop: '8px', textAlign: 'right', fontSize: '0.85rem', color: handoffReady ? '#16a34a' : '#ef4444' }}>
          {handoffLength} / 20 minimum characters required
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {submitted && <div className="success-message">SBAR handoff recorded.</div>}

      <div className="button-group">
        {!submitted && (
          <button className="btn-secondary" type="button" onClick={insertStructure}>
            Insert SBAR labels
          </button>
        )}
        {!submitted ? (
          <button className="btn-primary" onClick={handleSubmit} disabled={loading || !handoffReady}>
            Record SBAR
          </button>
        ) : (
          <button className="btn-primary" onClick={onNext}>
            Continue to debrief
          </button>
        )}
      </div>
    </section>
  );
}

export default SbarHandoff;
