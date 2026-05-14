import React from 'react';
import { submitFirstLook } from '../services/api';

function PatientInfo({ sessionId, patientData, firstLook, onNext, onCapture, onClock }) {
  const [selectedDecision, setSelectedDecision] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const identityRows = [
    { label: 'Age', value: `${patientData.age} years` },
    { label: 'Sex', value: patientData.sex },
    { label: 'Arrival mode', value: patientData.transport },
    { label: 'Chief concern', value: patientData.complaint, wide: true }
  ];

  const handleSubmit = async () => {
    if (!selectedDecision) {
      setError('Select the initial triage disposition.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const data = await submitFirstLook(sessionId, selectedDecision);
      if (onClock) onClock(data.clock);
      if (onCapture) onCapture({ firstLookDecision: selectedDecision });
      onNext();
    } catch (err) {
      setError('First-look decision could not be recorded.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="step-card arrival-step">
      <div className="section-header">
        <div>
          <span className="eyebrow">Triage intake</span>
          <h3>Arrival brief</h3>
        </div>
        <span className="clinical-badge">New patient</span>
      </div>

      <div className="arrival-grid">
        {identityRows.map((item) => (
          <div className={`metric-card ${item.wide ? 'wide' : ''}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="instruction-panel">
        <strong>First look</strong>
        <p>
          Review the arrival brief and choose the initial triage disposition before the interview.
        </p>
      </div>

      <div className="cue-grid" aria-label="First-look cues">
        {firstLook?.cues?.map((cue) => (
          <div className="cue-card" key={`${cue.label}-${cue.value}`}>
            <span>{cue.label}</span>
            <strong>{cue.value}</strong>
          </div>
        ))}
      </div>

      <div className="choice-stack" role="radiogroup" aria-label="Initial triage disposition">
        {firstLook?.options?.map((option) => (
          <button
            type="button"
            key={option.id}
            className={`choice-button ${selectedDecision === option.id ? 'selected' : ''}`}
            onClick={() => setSelectedDecision(option.id)}
            disabled={submitting}
            aria-pressed={selectedDecision === option.id}
          >
            <strong>{option.label}</strong>
            <small>{option.description}</small>
          </button>
        ))}
      </div>

      {selectedDecision && (
        <div className="decision-preview" aria-live="polite">
          <span>Initial disposition</span>
          <strong>{firstLook?.options?.find((item) => item.id === selectedDecision)?.label}</strong>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <button className="btn-primary" onClick={handleSubmit} disabled={submitting || !selectedDecision}>
        Start focused interview
      </button>
    </section>
  );
}

export default PatientInfo;
