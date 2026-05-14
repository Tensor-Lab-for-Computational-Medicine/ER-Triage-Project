import React, { useState } from 'react';
import { assignProvisionalTriage, assignTriage } from '../services/api';

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

function TriageAssignment({ sessionId, variant = 'final', onNext, onCapture, onClock }) {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [rationale, setRationale] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isProvisional = variant === 'provisional';

  const handleSubmit = async () => {
    if (!selectedLevel) {
      setError('Select an ESI level before locking the decision.');
      return;
    }

    if (!isProvisional && rationale.trim().length < 20) {
      setError('Write a brief rationale that connects risk, vitals, and expected resources.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = isProvisional
        ? await assignProvisionalTriage(sessionId, selectedLevel, rationale.trim())
        : await assignTriage(sessionId, selectedLevel, rationale.trim());
      setSubmitted(true);
      if (onClock) onClock(data.clock);
      if (onCapture) {
        onCapture(
          isProvisional
            ? {
                provisionalTriageLevel: selectedLevel,
                provisionalTriageRationale: rationale.trim()
              }
            : {
                triageLevel: selectedLevel,
                triageRationale: rationale.trim()
              }
        );
      }
    } catch (err) {
      setError('Failed to record ESI level.');
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
          <h3>{isProvisional ? 'Assign provisional ESI' : 'Assign final ESI'}</h3>
        </div>
        <span className="clinical-badge">{submitted ? 'Locked' : isProvisional ? 'Early estimate' : 'Rationale needed'}</span>
      </div>

      <div className="decision-layout">
        <div>
          <p className="instruction">
            {isProvisional
              ? 'Make an early acuity call from the first look and interview before the full objective review.'
              : 'Lock the ESI level and document the clinical basis.'}
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
            <label htmlFor="esi-rationale">{isProvisional ? 'Provisional rationale' : 'Final ESI rationale'}</label>
            <textarea
              id="esi-rationale"
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder={isProvisional
                ? 'Write the evidence available so far.'
                : 'Write one or two sentences connecting the evidence to acuity.'}
              rows="4"
              disabled={submitted}
            />
          </div>
        </div>

        <aside className="decision-aid">
          <button
            type="button"
            className="btn-secondary scaffold-toggle full"
            onClick={() => setShowChecklist((value) => !value)}
          >
            {showChecklist ? 'Hide ESI checklist' : 'Open ESI checklist'}
          </button>
          {showChecklist && (
            <div className="scaffold-panel">
              <span className="eyebrow">Decision check</span>
              <h4>Name the evidence</h4>
              <ul>
                <li>Immediate life-saving intervention?</li>
                <li>High-risk complaint or severe distress?</li>
                <li>Danger-zone vital signs?</li>
                <li>Expected ED resources?</li>
              </ul>
            </div>
          )}
        </aside>
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading">Recording ESI decision...</div>}
      {submitted && (
        <div className="success-message">
          ESI Level {selectedLevel} recorded.
        </div>
      )}

      <div className="button-group">
        {!submitted ? (
          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {isProvisional ? 'Record provisional ESI' : 'Lock final ESI'}
          </button>
        ) : (
          <button className="btn-primary" onClick={onNext}>
            {isProvisional ? 'Continue to vital review' : 'Continue to escalation'}
          </button>
        )}
      </div>
    </section>
  );
}

export default TriageAssignment;
