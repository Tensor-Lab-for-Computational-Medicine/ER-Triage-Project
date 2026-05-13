import React, { useState, useEffect } from 'react';
import { getInterventions, selectInterventions } from '../services/api';

const GROUP_ORDER = [
  'Airway and breathing',
  'Access and circulation',
  'Medications',
  'Critical procedures',
  'Behavioral health and safety',
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

function Interventions({ sessionId, onNext, onCapture }) {
  const [availableActions, setAvailableActions] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchActions = async () => {
      try {
        const interventions = await getInterventions(sessionId);
        setAvailableActions(interventions);
      } catch (err) {
        setError('Failed to load triage action options.');
      } finally {
        setLoading(false);
      }
    };

    fetchActions();
  }, [sessionId]);

  const handleToggle = (index) => {
    if (results) return;

    setSelectedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((item) => item !== index);
      }
      return [...prev, index];
    });
  };

  const submitActions = async (indices) => {
    try {
      setError('');
      setLoading(true);
      const performedActions = await selectInterventions(sessionId, indices);
      setResults(performedActions);
      if (onCapture) {
        onCapture({ interventions: performedActions });
      }
    } catch (err) {
      setError('Failed to record triage action choices.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !results) {
    return (
      <section className="step-card">
        <div className="loading">Loading initial triage actions...</div>
      </section>
    );
  }

  return (
    <section className="step-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Initial stabilization</span>
          <h3>Initial triage actions</h3>
        </div>
        <span className="clinical-badge">{selectedIndices.length} selected</span>
      </div>

      {!results && (
        <p className="instruction">
          Choose the actions you would initiate or escalate from triage. These
          are framed as learning signals: airway, access, medications,
          procedures, and monitored safety needs.
        </p>
      )}

      {!results ? (
        <>
          <div className="order-groups">
            {groupActions(availableActions).map((group) => (
              <fieldset className="order-group" key={group.title}>
                <legend>{group.title}</legend>
                {group.items.map((action) => (
                  <label
                    key={action.index}
                    className={`order-row action-row ${
                      selectedIndices.includes(action.index) ? 'selected' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIndices.includes(action.index)}
                      onChange={() => handleToggle(action.index)}
                    />
                    <span>
                      <strong>{action.name}</strong>
                      <small>{action.description}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="button-group">
            <button className="btn-secondary" onClick={() => submitActions([])}>
              No immediate triage actions
            </button>
            <button
              className="btn-primary"
              onClick={() => submitActions(selectedIndices)}
              disabled={selectedIndices.length === 0 || loading}
            >
              Record selected actions
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="results-section">
            <span className="eyebrow">Actions recorded</span>
            {results.length > 0 ? (
              <div className="interventions-results">
                {results.map((action) => (
                  <div key={action.value} className="intervention-result">
                    <span>Selected</span>
                    <strong>{action.name}</strong>
                    <small>{action.description}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-interventions">No immediate triage actions recorded.</p>
            )}
          </div>

          <button className="btn-primary" onClick={onNext}>
            Continue to debrief
          </button>
        </>
      )}
    </section>
  );
}

export default Interventions;
