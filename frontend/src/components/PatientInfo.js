import React from 'react';

function PatientInfo({ patientData, onNext }) {
  return (
    <div className="step-card">
      <div className="step-header">
        <h2>Step 1: Patient Identification</h2>
        <div className="step-indicator">Step 1 of 7</div>
      </div>
      
      <div className="patient-info">
        <div className="info-row">
          <span className="label">Age:</span>
          <span className="value">{patientData.age} years</span>
        </div>
        <div className="info-row">
          <span className="label">Sex:</span>
          <span className="value">{patientData.sex}</span>
        </div>
        <div className="info-row">
          <span className="label">Arrival Transport:</span>
          <span className="value">{patientData.transport}</span>
        </div>
      </div>
      
      <button className="btn-primary" onClick={onNext}>
        Continue
      </button>
    </div>
  );
}

export default PatientInfo;

