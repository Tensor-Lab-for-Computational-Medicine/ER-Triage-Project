import React, { useState } from 'react';
import { assignProvisionalTriage, assignTriage } from '../services/api';
import DecisionHint from './DecisionHint';

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

function TriageAssignment({ sessionId, variant = 'final', coachEnabled = false, onNext, onCapture, onClock }) {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [rationale, setRationale] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isProvisional = variant === 'provisional';
  const selectedMeta = TRIAGE_LEVELS.find((level) => level.level === selectedLevel);
  const rationaleLength = rationale.trim().length;
  const rationaleReady = isProvisional || rationaleLength >= 20;

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
          <h3>{isProvisional ? 'Initial ESI decision' : 'Final ESI decision'}</h3>
        </div>
      </div>

      <p className="instruction">
        {isProvisional
          ? 'Make the first acuity call from the intake context and patient conversation.'
          : 'Lock the ESI level after objective review and document the clinical basis.'}
      </p>

      {coachEnabled && (
        <DecisionHint
          sessionId={sessionId}
          stage={isProvisional ? 'provisional' : 'final'}
          learnerContext={rationale}
        />
      )}

      <div className="triage-levels compact">
        {TRIAGE_LEVELS.map((level) => (
          <button
            key={level.level}
            className={`triage-button ${
              selectedLevel === level.level ? 'selected' : ''
            } level-${level.level}`}
            onClick={() => setSelectedLevel(level.level)}
            disabled={loading || submitted}
            aria-pressed={selectedLevel === level.level}
          >
            <span>{level.label}</span>
            <strong>{level.name}</strong>
          </button>
        ))}
      </div>

      <p className="selected-esi-note">
        {selectedMeta
          ? `${selectedMeta.label}: ${selectedMeta.description}`
          : 'Choose the level that matches stability, high-risk features, and expected ED resources.'}
      </p>

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
        <small className={`field-hint ${rationaleReady ? 'ready' : ''}`}>
          {isProvisional
            ? `${rationaleLength} characters recorded`
            : `${rationaleLength} / 20 minimum characters`}
        </small>
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
          <button className="btn-primary" onClick={handleSubmit} disabled={loading || !selectedLevel || !rationaleReady}>
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
