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
      <div className="case-summary-primary" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--ink)' }}>
          {patientData ? `${patientData.age}yo ${patientData.sex}` : 'Loading case'}
        </strong>
        <span style={{ color: 'var(--muted)' }}>•</span>
        <span style={{ color: 'var(--muted)', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {patientData?.transport || 'Arrival pending'}
        </span>
        <span style={{ color: 'var(--muted)' }}>•</span>
        <span style={{ fontSize: '0.95rem', color: 'var(--ink)', fontWeight: '500' }} className={isDirtyData ? 'corrupted-data-text' : ''}>
          {concernDisplay}
        </span>
        {isDirtyData && (
          <span className="provenance-tag warning-tag" style={{ fontSize: '0.75rem', padding: '2px 6px' }}>
            Verify during interview
          </span>
        )}
      </div>
      <div className="case-summary-meta" aria-label="Case status" style={{ display: 'flex', alignItems: 'center' }}>
        <span className="case-summary-clock" style={{ fontSize: '1.05rem', fontFamily: 'monospace', fontWeight: '700', padding: '4px 8px', background: '#f1f5f9', borderRadius: '6px' }}>
          {formatClock(elapsedSeconds)}
        </span>
      </div>
    </section>
  );
}

export default CaseSummaryBanner;
