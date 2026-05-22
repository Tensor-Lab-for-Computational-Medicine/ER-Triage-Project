import React, { useEffect, useState } from 'react';
import { getReferralOptions, submitReferral } from '../services/api';

function ReferralDecision({ sessionId, onNext, onCapture, onClock }) {
  const [options, setOptions] = useState([]);
  const [needed, setNeeded] = useState(null);
  const [specialty, setSpecialty] = useState('');
  const [rationale, setRationale] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getReferralOptions(sessionId)
      .then((items) => {
        if (mounted) {
          setOptions(items || []);
          setSpecialty(items?.[0] || '');
        }
      })
      .catch(() => {
        if (mounted) setError('Failed to load referral options.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [sessionId]);

  const rationaleReady = rationale.trim().length >= 15;
  const canSubmit = needed !== null && rationaleReady && (!needed || specialty);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      setError('Record whether specialty input is needed and add a brief rationale.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const data = await submitReferral(sessionId, {
        needed,
        specialty: needed ? specialty : '',
        rationale: rationale.trim()
      });
      setSubmitted(true);
      if (onClock && data.clock) onClock(data.clock);
      if (onCapture) {
        onCapture({
          referralNeeded: data.referral_needed,
          referralSpecialty: data.referral_specialty,
          referralRationale: data.rationale
        });
      }
      onNext();
    } catch (err) {
      setError(err.message || 'Failed to record referral decision.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="step-card">
        <div className="loading">Loading referral options...</div>
      </section>
    );
  }

  return (
    <section className="step-card referral-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Clinical Impression <span className="provenance-tag student-tag">Student Decision</span></span>
          <h2 id="referral-heading">Specialty Referral Judgment</h2>
          <p className="subtitle">
            Decide whether specialty input changes immediate stabilization, diagnostic workup, procedure planning, or disposition.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="decision-form-stack">
        <div className="choice-row">
          <button
            type="button"
            className={`choice-card ${needed === true ? 'selected' : ''}`}
            onClick={() => setNeeded(true)}
            disabled={submitted || submitting}
            aria-pressed={needed === true}
            aria-label="Specialty Input Needed"
          >
            <strong>Specialty Input Needed</strong>
            <span>Escalate now because a service may change ED decisions.</span>
          </button>
          <button
            type="button"
            className={`choice-card ${needed === false ? 'selected' : ''}`}
            onClick={() => setNeeded(false)}
            disabled={submitted || submitting}
            aria-pressed={needed === false}
            aria-label="No Immediate Referral"
          >
            <strong>No Immediate Referral</strong>
            <span>Continue ED evaluation and reassess before escalation.</span>
          </button>
        </div>

        {needed === true && (
          <div className="premium-textarea-container">
            <label htmlFor="referral-specialty" className="premium-textarea-label">
              <span>Referral Service</span>
              <span className="input-badge">Required</span>
            </label>
            <select
              id="referral-specialty"
              className="premium-input"
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
              disabled={submitted || submitting}
            >
              {options.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        )}

        <div className="premium-textarea-container">
          <label htmlFor="referral-rationale" className="premium-textarea-label">
            <span>Referral Rationale</span>
            <span className="input-badge">Required</span>
          </label>
          <p className="premium-textarea-hint">
            Explain why specialty help is needed now, or what would make you escalate later.
          </p>
          <textarea
            id="referral-rationale"
            className="premium-textarea"
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            placeholder="I would..."
            rows="5"
            disabled={submitted || submitting}
          />
          <div className="char-count" style={{ marginTop: '8px', textAlign: 'right', fontSize: '0.85rem', color: rationaleReady ? '#16a34a' : '#ef4444' }}>
            {rationale.trim().length} / 15 minimum characters required
          </div>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}

        <div className="step-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || submitted || !canSubmit}
          >
            {submitting ? 'Locking Referral Decision...' : 'Lock referral & continue'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default ReferralDecision;
