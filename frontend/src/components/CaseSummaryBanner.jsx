import React from 'react';

function formatClock(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function CaseSummaryBanner({ patientData, caseRecord, activeStep, elapsedSeconds = 0 }) {
  const intake = patientData?.intake || {};
  const rawConcern = intake.reported_concern || patientData?.complaint || 'Concern pending';
  const isDirtyData = rawConcern.includes('#NAME?') || rawConcern.includes('uta');
  const concernDisplay = isDirtyData ? 'Intake slip unreadable or corrupted (#NAME?)' : rawConcern;

  const triageStatus = caseRecord?.triageLevel
    ? `Student ESI: ${caseRecord.triageLevel}`
    : 'ESI pending';

  return (
    <section className="case-summary-banner" aria-label="Case summary">
      <div className="case-summary-primary">
        <span className="eyebrow">
          Intake report <span className="provenance-tag source-tag">Source: MIETIC Record</span>
        </span>
        <strong>{patientData ? `${patientData.age}yo ${patientData.sex}` : 'Loading case'}</strong>
        <p className={isDirtyData ? 'corrupted-data-text' : ''}>
          {concernDisplay}
          {isDirtyData && <span className="provenance-tag warning-tag" style={{ marginLeft: '8px' }}>Dirty data: Use interview to clarify</span>}
        </p>
      </div>
      <div className="case-summary-meta" aria-label="Case status">
        <span>Arrival: {patientData?.transport || 'Pending'}</span>
        {intake.source && <span>{intake.source}</span>}
        <span className="step-badge">{activeStep?.label || 'Pending'}</span>
        <span className="triage-badge">{triageStatus}</span>
        <span className="case-summary-clock">{formatClock(elapsedSeconds)}</span>
      </div>
    </section>
  );
}

export default CaseSummaryBanner;
