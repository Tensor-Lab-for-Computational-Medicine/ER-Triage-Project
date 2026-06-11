import React, { useEffect, useRef, useState } from 'react';
import { recordFocusedExam, recordVitalsReview, requestOptionalObjectiveData } from '../services/api';
import { EXAM_SYSTEMS } from '../services/examEngine';

function ObjectiveReview({
  sessionId,
  active = false,
  onCapture,
  onClock,
  onObjectiveStatusChange
}) {
  const [vitals, setVitals] = useState([]);
  const [examFacts, setExamFacts] = useState([]);
  const [optionalData, setOptionalData] = useState([]);
  const [optionalResults, setOptionalResults] = useState([]);
  const [selectedSystems, setSelectedSystems] = useState([]);
  const [examSearch, setExamSearch] = useState('');
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
    setOptionalData([]);
    setOptionalResults([]);
    setSelectedSystems([]);
    setExamSearch('');
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
        setOptionalData(data.optional_objective_data || []);
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

  const requestOptional = async (dataId) => {
    setError('');
    try {
      const data = await requestOptionalObjectiveData(sessionId, dataId, 'encounter');
      setOptionalResults((current) => [
        ...current.filter((item) => item.id !== data.result.id),
        data.result
      ]);
      onClock?.(data.clock);
      onCapture?.({ optionalObjectiveData: data.requests || [] });
    } catch (err) {
      setError(err.message || 'Optional objective data could not be requested.');
    }
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
  const filteredExamSystems = EXAM_SYSTEMS.filter((system) => {
    const query = examSearch.trim().toLowerCase();
    if (!query) return true;
    return `${system.name} ${system.keywords.join(' ')}`.toLowerCase().includes(query);
  });
  const examFindings = examResult?.findings || [];
  const previewFindings = examFindings.slice(0, 3);
  const selectedSystemNames = examResult?.selected_systems?.length
    ? examResult.selected_systems.map((system) => system.name)
    : selectedSystems
      .map((systemId) => EXAM_SYSTEMS.find((system) => system.id === systemId)?.name)
      .filter(Boolean);

  if (loading) return <div className="loading compact-loading">Loading objective data...</div>;
  if (error && !loaded) return <div className="error-message compact-message">{error}</div>;
  if (!loaded) return <div className="objective-review-placeholder">Open this panel to load source-record vitals and choose focused exams.</div>;

  return (
    <div className="objective-review-panel">
      <section className="objective-vitals-section" aria-label="Source vitals">
        <div className="objective-section-heading">
          <span className="eyebrow">Source vitals</span>
          <h3>Vitals</h3>
        </div>
        <div className="monitor-grid compact-monitor-grid">
          {vitals.map((vital) => (
            <div key={`${vital.name}-${vital.value}`} className="monitor-card neutral">
              <span>{vital.name}</span>
              <strong>{vital.value}</strong>
            </div>
          ))}
        </div>
      </section>

      {optionalData.length > 0 && (
        <section className="optional-objective-panel" aria-label="Optional objective data">
          <div className="section-header compact">
            <div>
              <span className="eyebrow">Optional Objective Data</span>
              <h3>Ask for additional bedside data</h3>
            </div>
          </div>
          <div className="compact-checkbox-grid">
            {optionalData.map((item) => {
              const result = optionalResults.find((existing) => existing.id === item.id);
              const scaffoldLimited = item.source_restriction === 'public_simulation_scaffold';
              return (
                <article key={item.id} className="optional-data-card">
                  <div>
                    <strong>{item.label}</strong>
                    <small>{result ? (result.value || 'No result available') : item.category}</small>
                  </div>
                  {scaffoldLimited && (
                    <p className="optional-data-limitation">
                      Draft simulation scaffold; not source-record truth or clinician-adjudicated evidence.
                    </p>
                  )}
                  <button type="button" className="btn-secondary compact-insert-button" onClick={() => requestOptional(item.id)}>
                    Request
                  </button>
                  {result && (
                    <p>{result.availability === 'available' ? result.note : 'No result available for this case.'}</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="focused-exam-picker" aria-label="Choose focused exams">
        <div className="section-header compact">
          <div>
            <span className="eyebrow">Physical Exam</span>
            <h3>Choose focused exams</h3>
          </div>
          <span className="clinical-badge">{selectedSystems.length} selected</span>
        </div>
        {!examFacts.length && (
          <div className="error-message compact-message" role="alert">
            Focused exam coverage is missing for this case. Regenerate or review the case bundle before learner use.
          </div>
        )}
        <div className="exam-picker-tools">
          <label htmlFor="exam-system-search" className="sr-only">Filter focused exam systems</label>
          <input
            id="exam-system-search"
            className="premium-input compact-filter-input"
            value={examSearch}
            onChange={(event) => setExamSearch(event.target.value)}
            placeholder="Filter exam systems"
          />
          <button
            type="button"
            className="btn-secondary compact-insert-button"
            onClick={() => setSelectedSystems([])}
            disabled={!selectedSystems.length || conducting}
          >
            Clear exams
          </button>
        </div>
        <div className="exam-system-grid" role="group" aria-label="Focused exam systems">
          {filteredExamSystems.map((system) => {
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

      {examFindings.length > 0 && (
        <section className="objective-finding-list" aria-label="Focused exam findings">
          <div className="finding-summary-header">
            <div>
              <span className="eyebrow">Focused exam documented</span>
              <h3>Focused exam documented</h3>
            </div>
            <span className="clinical-badge">{examFindings.length} finding{examFindings.length === 1 ? '' : 's'}</span>
          </div>
          {selectedSystemNames.length > 0 && (
            <div className="selected-exam-summary" aria-label="Selected focused exam systems">
              {selectedSystemNames.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </div>
          )}
          <div className="exam-finding-preview-grid">
            {previewFindings.map((finding) => (
              <article key={finding.system_id} className="exam-finding-card">
                <div className="finding-card-header">
                  <span>{finding.system}</span>
                </div>
                <p>{finding.finding}</p>
              </article>
            ))}
          </div>
          {examFindings.length > previewFindings.length && (
            <details className="exam-findings-details">
              <summary>Show all focused exam findings</summary>
              <div className="exam-finding-detail-list">
                {examFindings.map((finding) => (
                  <article key={finding.system_id} className="exam-finding-card">
                    <div className="finding-card-header">
                      <span>{finding.system}</span>
                    </div>
                    <p>{finding.finding}</p>
                  </article>
                ))}
              </div>
            </details>
          )}
        </section>
      )}
    </div>
  );
}

export default ObjectiveReview;
