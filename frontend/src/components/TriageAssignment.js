import React, { useState } from 'react';
import { assignTriage } from '../services/api';

const TRIAGE_LEVELS = [
  {
    level: 1,
    label: 'ESI 1',
    name: 'Resuscitation',
    description: 'Immediate life-saving intervention is required.'
  },
  {
    level: 2,
    label: 'ESI 2',
    name: 'Emergent',
    description: 'High-risk situation, severe pain or distress, or concerning mental status.'
  },
  {
    level: 3,
    label: 'ESI 3',
    name: 'Urgent',
    description: 'Stable enough to wait, but likely needs multiple ED resources.'
  },
  {
    level: 4,
    label: 'ESI 4',
    name: 'Less urgent',
    description: 'Stable presentation likely needing one ED resource.'
  },
  {
    level: 5,
    label: 'ESI 5',
    name: 'Non-urgent',
    description: 'Stable presentation expected to need no ED resources.'
  }
];

function TriageAssignment({ sessionId, onNext, onCapture }) {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [rationale, setRationale] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!selectedLevel) {
      setError('Select an ESI level before locking the decision.');
      return;
    }

    if (rationale.trim().length < 20) {
      setError('Write a brief rationale that connects risk, vitals, and expected resources.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await assignTriage(sessionId, selectedLevel, rationale.trim());
      setSubmitted(true);
      if (onCapture) {
        onCapture({
          triageLevel: selectedLevel,
          triageRationale: rationale.trim()
        });
      }
    } catch (err) {
      setError('Failed to assign triage level.');
      setSelectedLevel(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="step-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Acuity decision</span>
          <h3>Assign ESI level</h3>
        </div>
        <span className="clinical-badge">{submitted ? 'Locked' : 'Rationale required'}</span>
      </div>

      <div className="decision-layout">
        <div>
          <p className="instruction">
            Select the level you would communicate to the charge nurse, then
            document why. The rationale is part of the score because ESI is a
            reasoning task, not a guess.
          </p>

          <div className="triage-levels">
            {TRIAGE_LEVELS.map((level) => (
              <button
                key={level.level}
                className={`triage-button ${
                  selectedLevel === level.level ? 'selected' : ''
                } level-${level.level}`}
                onClick={() => setSelectedLevel(level.level)}
                disabled={loading || submitted}
              >
                <span>{level.label}</span>
                <strong>{level.name}</strong>
                <small>{level.description}</small>
              </button>
            ))}
          </div>

          <div className="question-input rationale-input">
            <label htmlFor="esi-rationale">ESI rationale</label>
            <textarea
              id="esi-rationale"
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder="Example: ESI 3 because the patient is stable but likely needs labs, imaging, and medication; no immediate life-saving intervention is needed."
              rows="4"
              disabled={submitted}
            />
          </div>
        </div>

        <aside className="decision-aid">
          <span className="eyebrow">Decision check</span>
          <h4>Name the evidence</h4>
          <ul>
            <li>Immediate life-saving intervention?</li>
            <li>High-risk complaint or severe distress?</li>
            <li>Danger-zone vital signs?</li>
            <li>How many ED resources are likely?</li>
          </ul>
        </aside>
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading">Locking ESI decision...</div>}
      {submitted && (
        <div className="success-message">
          ESI Level {selectedLevel} recorded with rationale.
        </div>
      )}

      <div className="button-group">
        {!submitted ? (
          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            Lock ESI decision
          </button>
        ) : (
          <button className="btn-primary" onClick={onNext}>
            Continue to initial actions
          </button>
        )}
      </div>
    </section>
  );
}

export default TriageAssignment;
