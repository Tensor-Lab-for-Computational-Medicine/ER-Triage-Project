import React, { useState } from 'react';
import { submitReassessment } from '../services/api';

const REASSESSMENT_TARGETS = [
  {
    id: 'vital_trend',
    label: 'Repeat abnormal vital signs',
    category: 'Objective trend',
    description: 'Heart rate, blood pressure, respiratory rate, oxygen saturation, temperature, or pain after initial actions.'
  },
  {
    id: 'pain_response',
    label: 'Reassess pain and distress',
    category: 'Symptoms',
    description: 'Pain, distress, nausea, or discomfort after initial treatment or waiting.'
  },
  {
    id: 'airway_breathing',
    label: 'Recheck airway and breathing',
    category: 'Airway and breathing',
    description: 'Work of breathing, oxygenation, speech, wheezing, and need for respiratory support.'
  },
  {
    id: 'circulation_bleeding',
    label: 'Recheck perfusion or bleeding risk',
    category: 'Circulation',
    description: 'Blood pressure, perfusion, bleeding, IV access needs, and fluid or transfusion readiness.'
  },
  {
    id: 'neuro_mental_status',
    label: 'Reassess neurologic or mental status',
    category: 'Neurologic safety',
    description: 'Confusion, focal deficits, seizure risk, behavioral safety, or level of consciousness.'
  },
  {
    id: 'infection_fever',
    label: 'Reassess fever or infection trajectory',
    category: 'Infection risk',
    description: 'Fever curve, systemic symptoms, suspected source, sepsis risk, and response to treatment.'
  },
  {
    id: 'distal_neurovascular',
    label: 'Repeat distal neurovascular checks',
    category: 'Extremity injury',
    description: 'Pulses, sensation, motor function, capillary refill, swelling, and compartment-type pain.'
  },
  {
    id: 'disposition_safety',
    label: 'Confirm disposition safety',
    category: 'Flow and handoff',
    description: 'Whether the patient is safe for routine wait, monitored placement, admission, transfer, or discharge planning.'
  }
];

function Reassessment({ sessionId, onNext, onCapture, onClock }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [rationale, setRationale] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const rationaleReady = rationale.trim().length >= 15;

  const handleToggle = (id) => {
    if (submitted) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    const trimmed = rationale.trim();
    if (trimmed.length < 15) {
      setError('Add a brief reassessment rationale before handoff.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await submitReassessment(sessionId, selectedIds, trimmed);
      setSubmitted(true);
      if (onClock && data.clock) onClock(data.clock);
      if (onCapture) {
        onCapture({
          reassessmentPlan: selectedIds,
          reassessmentRationale: trimmed
        });
      }
    } catch (err) {
      setError('Reassessment plan could not be recorded.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="step-card reassessment-card" aria-labelledby="reassessment-heading">
      <div className="section-header">
        <div>
          <span className="eyebrow">Initial Plan <span className="provenance-tag student-tag">Student Decision</span></span>
          <h2 id="reassessment-heading">Reassessment Check</h2>
          <p className="subtitle">
            Identify what must be rechecked before handoff, disposition, or routine waiting.
          </p>
        </div>
        <span className="clinical-badge">{submitted ? 'Recorded' : 'Required'}</span>
      </div>

      <fieldset className="risk-selection-group">
        <legend>Monitoring Targets</legend>
        <div className="checkbox-grid">
          {REASSESSMENT_TARGETS.map((target) => {
            const selected = selectedIds.includes(target.id);
            return (
              <label
                key={target.id}
                className={`risk-checkbox-card ${selected ? 'selected' : ''}`}
                title={target.description}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => handleToggle(target.id)}
                  disabled={submitted || loading}
                />
                <span className="risk-info">
                  <span className="risk-category">{target.category}</span>
                  <span className="risk-label">{target.label}</span>
                  <small>{target.description}</small>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="premium-textarea-container">
        <label htmlFor="reassessment-rationale" className="premium-textarea-label">
          <span>Reassessment Rationale</span>
          <span className="input-badge">Required</span>
        </label>
        <p className="premium-textarea-hint">
          Name the risk you are watching for and how reassessment would change your next action.
        </p>
        <textarea
          id="reassessment-rationale"
          className="premium-textarea"
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
          placeholder="I would recheck..."
          rows="5"
          disabled={submitted || loading}
        />
        <div className="char-count" style={{ marginTop: '8px', textAlign: 'right', fontSize: '0.85rem', color: rationaleReady ? '#16a34a' : '#ef4444' }}>
          {rationale.trim().length} / 15 minimum characters required
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {submitted && <div className="success-message">Reassessment plan recorded.</div>}

      <div className="step-actions">
        {!submitted ? (
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={loading || !rationaleReady}>
            {loading ? 'Recording Reassessment...' : 'Record reassessment'}
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={onNext}>
            Continue to SBAR
          </button>
        )}
      </div>
    </section>
  );
}

export default Reassessment;
