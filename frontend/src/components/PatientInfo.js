import React from 'react';

function PatientInfo({ patientData, onNext }) {
  const identityRows = [
    { label: 'Age', value: `${patientData.age} years` },
    { label: 'Sex', value: patientData.sex },
    { label: 'Arrival mode', value: patientData.transport }
  ];

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
          <div className="metric-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="instruction-panel">
        <strong>Training focus</strong>
        <p>
          Begin as you would at the triage desk: identify the patient, note the
          mode of arrival, and prepare to separate immediate threats from stable
          presentations.
        </p>
      </div>

      <button className="btn-primary" onClick={onNext}>
        Start triage interview
      </button>
    </section>
  );
}

export default PatientInfo;
