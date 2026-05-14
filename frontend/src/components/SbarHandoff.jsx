import React, { useState } from 'react';
import { submitSbar } from '../services/api';

function SbarHandoff({ sessionId, onNext, onCapture, onClock }) {
  const [handoff, setHandoff] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const insertStructure = () => {
    setHandoff('S: \nB: \nA: \nR: ');
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
          <span className="eyebrow">Communication</span>
          <h3>SBAR handoff</h3>
        </div>
        <span className="clinical-badge">{submitted ? 'Recorded' : 'Required'}</span>
      </div>

      <p className="instruction">
        Give the receiving team a concise situation, background, assessment, and recommendation.
      </p>

      <div className="question-input">
        <label htmlFor="sbar-handoff">Handoff</label>
        <textarea
          id="sbar-handoff"
          value={handoff}
          onChange={(event) => setHandoff(event.target.value)}
          placeholder="S: ...&#10;B: ...&#10;A: ...&#10;R: ..."
          rows="7"
          disabled={submitted || loading}
        />
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
          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
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
