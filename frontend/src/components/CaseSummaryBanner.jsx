import React from 'react';

function formatClock(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function CaseSummaryBanner({ patientData, caseRecord, activeStep, elapsedSeconds = 0 }) {
  const intake = patientData?.intake || {};
  const concern = intake.reported_concern || patientData?.complaint || 'Concern pending';
  const triageStatus = caseRecord?.triageLevel
    ? `ESI ${caseRecord.triageLevel}`
    : caseRecord?.provisionalTriageLevel
      ? `Initial ESI ${caseRecord.provisionalTriageLevel}`
      : 'ESI pending';

  return (
    <section className="case-summary-banner" aria-label="Case summary">
      <div className="case-summary-primary">
        <span className="eyebrow">Intake report</span>
        <strong>{patientData ? `${patientData.age} year old ${patientData.sex}` : 'Loading case'}</strong>
        <p>{concern}</p>
      </div>
      <div className="case-summary-meta" aria-label="Case status">
        <span>{patientData?.transport || 'Transport pending'}</span>
        {intake.source && <span>{intake.source}</span>}
        <span>{activeStep?.label || 'Pending'}</span>
        <span>{triageStatus}</span>
        <span className="case-summary-clock">{formatClock(elapsedSeconds)}</span>
      </div>
    </section>
  );
}

export default CaseSummaryBanner;
