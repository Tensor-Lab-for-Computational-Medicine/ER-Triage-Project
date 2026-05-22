import React, { useEffect, useRef, useState } from 'react';
import { recordFocusedExam, recordVitalsReview } from '../services/api';
import { EXAM_SYSTEMS } from '../services/examEngine';

function getVitalTone(vital) {
  const value = Number(String(vital.value).match(/-?\d+(\.\d+)?/)?.[0]);
  if (!Number.isFinite(value)) return 'neutral';
  if (vital.name === 'Heart Rate' && (value >= 110 || value < 60)) return 'attention';
  if (vital.name === 'Respiratory Rate' && (value >= 22 || value < 12)) return 'attention';
  if (vital.name === 'Oxygen Saturation' && value < 94) return 'attention';
  if (vital.name === 'Pain Level' && value >= 7) return 'attention';
  if (vital.name === 'Blood Pressure' && (value < 100 || value >= 160)) return 'attention';
  if (vital.name === 'Temperature' && (value >= 100.4 || value < 96.8)) return 'attention';
  return 'stable';
}

function ObjectiveReview({
  sessionId,
  active = false,
  onCapture,
  onClock,
  onObjectiveStatusChange
}) {
  const [vitals, setVitals] = useState([]);
  const [examFacts, setExamFacts] = useState([]);
  const [selectedSystems, setSelectedSystems] = useState([]);
  const [examResult, setExamResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [conducting, setConducting] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const requestedRef = useRef(false);
  const mountedRef = useRef(false);
  const requestTokenRef = useRef(0);

  const publishStatus = (overrides = {}) => {
    onObjectiveStatusChange?.({
      loaded,
      examConducted: Boolean(examResult?.findings?.length),
      selectedSystemIds: selectedSystems,
      ...overrides
    });
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setVitals([]);
    setExamFacts([]);
    setSelectedSystems([]);
    setExamResult(null);
    setLoading(false);
    setConducting(false);
    setError('');
    setLoaded(false);
    requestedRef.current = false;
    requestTokenRef.current += 1;
    onObjectiveStatusChange?.({ loaded: false, examConducted: false, selectedSystemIds: [] });
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active || requestedRef.current) return undefined;
    const token = requestTokenRef.current;
    requestedRef.current = true;
    setLoading(true);
    setError('');
    recordVitalsReview(sessionId)
      .then((data) => {
        if (!mountedRef.current || requestTokenRef.current !== token) return;
        const nextVitals = data.vitals || [];
        const nextExamFacts = data.physical_exam || [];
        setVitals(nextVitals);
        setExamFacts(nextExamFacts);
        setLoaded(true);
        onClock?.(data.clock);
        onCapture?.({ vitals: nextVitals });
        onObjectiveStatusChange?.({ loaded: true, examConducted: false, selectedSystemIds: [] });
      })
      .catch(() => {
        if (mountedRef.current && requestTokenRef.current === token) setError('Objective data could not be loaded.');
      })
      .finally(() => {
        if (mountedRef.current && requestTokenRef.current === token) setLoading(false);
      });
    return undefined;
  }, [active, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSystem = (systemId) => {
    setSelectedSystems((current) => {
      const next = current.includes(systemId)
        ? current.filter((id) => id !== systemId)
        : [...current, systemId];
      publishStatus({ selectedSystemIds: next });
      return next;
    });
  };

  const conductExam = async () => {
    if (!selectedSystems.length) {
      setError('Select at least one focused exam system.');
      return;
    }
    setConducting(true);
    setError('');
    try {
      const result = await recordFocusedExam(sessionId, selectedSystems);
      setExamResult(result);
      onClock?.(result.clock);
      onCapture?.({ vitals: result.vitals || vitals, focusedExam: result });
      onObjectiveStatusChange?.({
        loaded: true,
        examConducted: Boolean(result.findings?.length),
        selectedSystemIds: selectedSystems
      });
    } catch (err) {
      setError(err.message || 'Focused exam could not be conducted.');
    } finally {
      setConducting(false);
    }
  };

  if (loading) return <div className="loading compact-loading">Loading objective data...</div>;
  if (error && !loaded) return <div className="error-message compact-message">{error}</div>;
  if (!loaded) return <div className="objective-review-placeholder">Open this panel to load source-record vitals and choose focused exams.</div>;

  return (
    <div className="objective-review-panel">
      <div className="monitor-grid compact-monitor-grid">
        {vitals.map((vital) => {
          const tone = getVitalTone(vital);
          return (
            <div key={`${vital.name}-${vital.value}`} className={`monitor-card ${tone}`}>
              <span>{vital.name}</span>
              <strong>{vital.value}</strong>
            </div>
          );
        })}
      </div>

      <section className="focused-exam-picker" aria-label="Choose focused exams">
        <div className="section-header compact">
          <div>
            <span className="eyebrow">Physical Exam</span>
            <h3>Choose focused exams</h3>
          </div>
          {examResult?.score !== undefined && (
            <span className="clinical-badge">{examResult.score} / 10</span>
          )}
        </div>
        {!examFacts.length && (
          <div className="error-message compact-message" role="alert">
            Focused exam coverage is missing for this case. Regenerate or review the case bundle before learner use.
          </div>
        )}
        <div className="exam-system-grid" role="group" aria-label="Focused exam systems">
          {EXAM_SYSTEMS.map((system) => {
            const selected = selectedSystems.includes(system.id);
            return (
              <button
                key={system.id}
                type="button"
                className={`exam-system-chip ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                onClick={() => toggleSystem(system.id)}
              >
                {system.name}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="btn-secondary conduct-exam-button"
          onClick={conductExam}
          disabled={!selectedSystems.length || conducting}
        >
          {conducting ? 'Conducting exam...' : 'Conduct selected exam'}
        </button>
        {error && <div className="error-message compact-message">{error}</div>}
      </section>

      {examResult?.findings?.length > 0 && (
        <section className="objective-finding-list" aria-label="Simulated focused exam findings">
          <strong>Simulated focused exam findings</strong>
          {examResult.findings.map((finding) => (
            <article key={finding.system_id} className="exam-finding-card">
              <div className="finding-card-header">
                <span>{finding.system}</span>
                <small>{finding.provenance}</small>
              </div>
              <p>{finding.finding}</p>
            </article>
          ))}
          {examResult.missed_systems?.length > 0 && (
            <p className="compact-guidance">
              Missed systems to consider next: {examResult.missed_systems.map((item) => item.name).join(', ')}.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export default ObjectiveReview;
