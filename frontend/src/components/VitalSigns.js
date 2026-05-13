import React, { useState, useEffect } from 'react';
import { getAvailableVitals, getVitals } from '../services/api';

function parseFirstNumber(value) {
  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function getVitalTone(vital) {
  const value = parseFirstNumber(vital.value);

  if (value === null) return 'neutral';

  if (vital.name === 'Heart Rate') {
    if (value >= 130 || value < 50) return 'critical';
    if (value >= 110 || value < 60) return 'attention';
  }

  if (vital.name === 'Blood Pressure') {
    if (value < 90 || value >= 180) return 'critical';
    if (value < 100 || value >= 160) return 'attention';
  }

  if (vital.name === 'Respiratory Rate') {
    if (value >= 30 || value < 8) return 'critical';
    if (value >= 22 || value < 12) return 'attention';
  }

  if (vital.name === 'Oxygen Saturation') {
    if (value < 90) return 'critical';
    if (value < 94) return 'attention';
  }

  if (vital.name === 'Temperature') {
    if (value >= 103 || value < 95) return 'critical';
    if (value >= 100.4 || value < 96.8) return 'attention';
  }

  if (vital.name === 'Pain Level') {
    if (value >= 8) return 'critical';
    if (value >= 5) return 'attention';
  }

  return 'stable';
}

function VitalSigns({ sessionId, onNext, onCapture }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchCompleteVitalSet = async () => {
      try {
        const availableVitals = await getAvailableVitals(sessionId);
        const vitalResults = await getVitals(
          sessionId,
          availableVitals.map((vital) => vital.index)
        );

        if (isMounted) {
          setResults(vitalResults);
          if (onCapture) {
            onCapture({ vitals: vitalResults });
          }
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to retrieve the baseline triage vital set.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCompleteVitalSet();

    return () => {
      isMounted = false;
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <section className="step-card">
        <div className="loading">Retrieving baseline triage vitals...</div>
      </section>
    );
  }

  return (
    <section className="step-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Primary survey</span>
          <h3>Baseline vital signs</h3>
        </div>
        <span className="clinical-badge">Complete triage set</span>
      </div>

      <p className="instruction">
        These are baseline triage data. The learning task is not whether to
        measure them; it is whether you notice which values change acuity,
        risk, and resource needs.
      </p>

      {error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <div className="monitor-grid">
            {results.map((vital) => {
              const tone = getVitalTone(vital);
              return (
                <div key={`${vital.name}-${vital.value}`} className={`monitor-card ${tone}`}>
                  <span>{vital.name}</span>
                  <strong>{vital.value}</strong>
                  <small>
                    {tone === 'stable'
                      ? 'No immediate danger-zone signal'
                      : 'Must be named in the ESI rationale'}
                  </small>
                </div>
              );
            })}
          </div>

          <div className="instruction-panel">
            <strong>Clinical pause</strong>
            <p>
              Before assigning ESI, decide whether this patient has danger-zone
              vitals, severe pain or distress, high-risk symptoms, or likely
              multi-resource needs.
            </p>
          </div>
        </>
      )}

      <button className="btn-primary" onClick={onNext} disabled={Boolean(error)}>
        Continue to focused history
      </button>
    </section>
  );
}

export default VitalSigns;
