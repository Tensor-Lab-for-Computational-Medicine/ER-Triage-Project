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
  const vitalChips = (caseRecord?.vitals || []).slice(0, 4);

  const triageStatus = caseRecord?.triageLevel
    ? `Student ESI: ${caseRecord.triageLevel}`
    : 'ESI pending';

  return (
    <section className="case-summary-banner" aria-label="Case summary">
      <div className="case-summary-primary">
        <div className="case-summary-line">
          <strong>{patientData ? `${patientData.age}yo ${patientData.sex}` : 'Loading case'}</strong>
          <span>{patientData?.transport || 'Arrival pending'}</span>
          <span className={isDirtyData ? 'corrupted-data-text' : ''}>{concernDisplay}</span>
        </div>
        <div className="case-summary-chips" aria-label="Compact case context">
          <span>{activeStep?.label || 'Encounter'}</span>
          <span>{triageStatus}</span>
          {vitalChips.map((vital) => (
            <span key={`${vital.name}-${vital.value}`}>{vital.name}: {vital.value}</span>
          ))}
        </div>
        {isDirtyData && (
          <span className="provenance-tag warning-tag case-summary-warning">
            Verify during interview
          </span>
        )}
      </div>
      <div className="case-summary-meta" aria-label="Case status">
        <span className="case-summary-clock">{formatClock(elapsedSeconds)}</span>
      </div>
    </section>
  );
}

export default CaseSummaryBanner;
