import React, { useState, useEffect } from 'react';
import { getEscalationActions, selectEscalationActions } from '../services/api';

const GROUP_ORDER = [
  'Escalation',
  'Placement',
  'Airway and breathing',
  'Access and circulation',
  'Medications',
  'Critical procedures',
  'Safety',
  'Other actions'
];

function groupActions(actions) {
  const grouped = actions.reduce((acc, action) => {
    const key = action.category || 'Other actions';
    if (!acc[key]) acc[key] = [];
    acc[key].push(action);
    return acc;
  }, {});

  return GROUP_ORDER.filter((group) => grouped[group]?.length).map((group) => ({
    title: group,
    items: grouped[group]
  }));
}

function Interventions({ sessionId, onNext, onCapture, onClock }) {
  const [availableActions, setAvailableActions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [rationale, setRationale] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchActions = async () => {
      try {
        const actions = await getEscalationActions(sessionId);
        setAvailableActions(actions);
      } catch (err) {
        setError('Failed to load escalation options.');
      } finally {
        setLoading(false);
      }
    };

    fetchActions();
  }, [sessionId]);

  const handleToggle = (id) => {
    if (results) return;

    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const clearSelection = () => {
    if (!results) setSelectedIds([]);
  };

  const submitActions = async (ids) => {
    const trimmedRationale = rationale.trim();
    if (trimmedRationale.length < 20) {
      setError('Write a brief escalation rationale before recording the plan.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      const data = await selectEscalationActions(sessionId, ids, trimmedRationale);
      const performedActions = data.actions_performed;
      setResults(performedActions);
      if (onClock) onClock(data.clock);
      if (onCapture) {
        onCapture({
          interventions: performedActions,
          escalationActions: performedActions,
          escalationRationale: trimmedRationale
        });
      }
    } catch (err) {
      setError('Failed to record escalation choices.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !results) {
    return (
      <section className="step-card">
        <div className="loading">Loading escalation actions...</div>
      </section>
    );
  }

  return (
    <section className="step-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Escalation and placement</span>
          <h3>Triage actions</h3>
        </div>
        <span className="clinical-badge">{selectedIds.length} actions</span>
      </div>

      {!results && (
        <p className="instruction">
          Choose the actions a triage learner should request or escalate before the patient enters the routine queue.
        </p>
      )}

      {!results ? (
        <>
          <div className="evidence-legend">
            <span>Evidence basis</span>
            <strong>ESI/vitals</strong>
            <strong>MIETIC record</strong>
            <strong>case text</strong>
          </div>

          {selectedIds.length > 0 && (
            <div className="action-selection-summary" aria-live="polite">
              <div>
                <span>Selected actions</span>
                <strong>{selectedIds.length}</strong>
              </div>
              <div className="selected-action-list">
                {availableActions
                  .filter((action) => selectedIds.includes(action.id))
                  .map((action) => (
                    <span className="selected-action-chip" key={action.id}>{action.name}</span>
                  ))}
              </div>
              <button type="button" className="btn-secondary clear-selection" onClick={clearSelection}>
                Clear selection
              </button>
            </div>
          )}

          <div className="order-groups">
            {groupActions(availableActions).map((group) => (
              <fieldset className="order-group" key={group.title}>
                <legend>{group.title}</legend>
                {group.items.map((action) => (
                  <label
                    key={action.id}
                    className={`order-row action-row ${
                      selectedIds.includes(action.id) ? 'selected' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(action.id)}
                      onChange={() => handleToggle(action.id)}
                    />
                    <span>
                      <strong>{action.name}</strong>
                      <small>{action.description}</small>
                      {action.evidence_type && <small>Evidence basis: {action.evidence_type}</small>}
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>

          <div className="question-input rationale-input">
            <label htmlFor="escalation-rationale">Escalation rationale</label>
            <textarea
              id="escalation-rationale"
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder="State why these actions are needed, or why routine waiting is appropriate."
              rows="4"
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="button-group">
            <button className="btn-secondary" onClick={() => submitActions([])} disabled={loading || selectedIds.length > 0}>
              No immediate escalation
            </button>
            <button
              className="btn-primary"
              onClick={() => submitActions(selectedIds)}
              disabled={selectedIds.length === 0 || loading}
            >
              Record actions
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="results-section">
            <span className="eyebrow">Escalation recorded</span>
            {results.length > 0 ? (
              <div className="interventions-results">
                {results.map((action) => (
                  <div key={action.id} className="intervention-result">
                    <span>Triage action</span>
                    <strong>{action.name}</strong>
                    <small>{action.description}</small>
                    {action.evidence_type && <small>Evidence basis: {action.evidence_type}</small>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-interventions">No immediate escalation recorded.</p>
            )}
            <div className="question-item">
              <span>Rationale</span>
              <strong>{rationale}</strong>
            </div>
          </div>

          <button className="btn-primary" onClick={onNext}>
            Continue to SBAR handoff
          </button>
        </>
      )}
    </section>
  );
}

export default Interventions;
