import React, { useState } from 'react';
import { assignTriage } from '../services/api';
import DecisionHint from './DecisionHint';

const TRIAGE_LEVELS = [
  {
    level: 1,
    label: 'ESI 1',
    name: 'Resuscitation',
    description: 'Immediate life-saving intervention required. Airway, breathing, or hemodynamic instability.'
  },
  {
    level: 2,
    label: 'ESI 2',
    name: 'Emergent',
    description: 'High-risk situation, new severe pain or distress (7+/10), lethargy, or danger-zone vitals.'
  },
  {
    level: 3,
    label: 'ESI 3',
    name: 'Urgent',
    description: 'Hemodynamically stable but requires multiple ED resource categories (labs, imaging, IV meds, consults).'
  },
  {
    level: 4,
    label: 'ESI 4',
    name: 'Less Urgent',
    description: 'Stable physical presentation expected to require exactly one ED resource category (e.g. simple x-ray).'
  },
  {
    level: 5,
    label: 'ESI 5',
    name: 'Non-Urgent',
    description: 'Stable routine presentation expected to require zero counted ED resources (e.g. verbal prescription refill).'
  }
];

function TriageAssignment({ sessionId, coachEnabled = false, onNext, onCapture, onClock }) {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [rationale, setRationale] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedMeta = TRIAGE_LEVELS.find((level) => level.level === selectedLevel);
  const rationaleLength = rationale.trim().length;
  const rationaleReady = rationaleLength >= 20;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedLevel) {
      setError('Select a definitive ESI acuity level before locking.');
      return;
    }
    if (!rationaleReady) {
      setError('Provide a mandatory clinical rationale (at least 20 characters) explaining the resource or risk basis.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await assignTriage(sessionId, selectedLevel, rationale.trim());
      setSubmitted(true);
      if (onClock && data.clock) onClock(data.clock);
      if (onCapture) {
        onCapture({
          triageLevel: selectedLevel,
          triageRationale: rationale.trim()
        });
      }
      onNext();
    } catch (err) {
      setError('Failed to record definitive ESI level.');
      setSelectedLevel(null);
      setSubmitting(false);
    }
  };

  return (
    <section className="step-card esi-assignment-card" aria-labelledby="esi-heading">
      <div className="section-header">
        <div>
          <span className="eyebrow">
            Step 3 of 6 <span className="provenance-tag student-tag">Student Decision</span>
          </span>
          <h2 id="esi-heading">Definitive ESI Acuity Assignment</h2>
          <p className="subtitle">
            Assign the Emergency Severity Index level based on gathered history, vitals, and physical exam targets.
          </p>
        </div>
      </div>

      {coachEnabled && (
        <DecisionHint
          sessionId={sessionId}
          stage="final"
          learnerContext={rationale}
        />
      )}

      <form onSubmit={handleSubmit} className="esi-form">
        <div className="triage-levels-grid">
          {TRIAGE_LEVELS.map((level) => {
            const isSelected = selectedLevel === level.level;
            return (
              <button
                type="button"
                key={level.level}
                className={`triage-button-card level-${level.level} ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedLevel(level.level)}
                disabled={loading || submitted}
                aria-pressed={isSelected}
              >
                <div className="triage-level-badge">{level.label}</div>
                <strong className="triage-level-name">{level.name}</strong>
                <p className="triage-level-desc">{level.description}</p>
              </button>
            );
          })}
        </div>

        <div className="selected-level-banner">
          {selectedMeta ? (
            <p className="selected-text">
              Selected <strong>{selectedMeta.label} ({selectedMeta.name})</strong>: {selectedMeta.description}
            </p>
          ) : (
            <p className="prompt-text">
              Select an acuity level above to reveal detailed criteria.
            </p>
          )}
        </div>

        <div className="premium-textarea-container">
          <label htmlFor="esi-rationale" className="premium-textarea-label">
            <span>Clinical Rationale for ESI Selection</span>
            <span className="input-badge">Required</span>
          </label>
          <p className="premium-textarea-hint">
            Connect the patient's specific risk factors, vital signs, or resource predictions to your chosen ESI level.
          </p>
          <textarea
            id="esi-rationale"
            className="premium-textarea"
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            placeholder="Example: ESI 3 is appropriate due to stable vital signs but requiring multiple resource categories (IV analgesia, plain radiographs, and orthopedic consult)..."
            rows="4"
            disabled={submitted || loading}
          />
          <div className="char-count" style={{ marginTop: '8px', textAlign: 'right', fontSize: '0.85rem', color: rationaleReady ? '#16a34a' : '#ef4444' }}>
            {rationaleLength} / 20 minimum characters required
          </div>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}

        <div className="step-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || submitted || !selectedLevel || !rationaleReady}
          >
            {loading ? 'Locking Definitive Acuity...' : 'Lock Definitive ESI & Proceed to Care Priorities'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default TriageAssignment;
