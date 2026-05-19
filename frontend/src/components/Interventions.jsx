import React, { useState, useEffect } from 'react';
import { getEscalationActions, selectEscalationActions } from '../services/api';

const CLUSTERS = [
  { id: 'Stabilize', title: 'Stabilize', subtitle: 'Immediate life threats, airway, breathing, circulation, and safety protocols' },
  { id: 'Assess', title: 'Assess', subtitle: 'Diagnostic workup, cardiac monitoring, and clinical placement' },
  { id: 'Treat', title: 'Treat', subtitle: 'Protocol-driven medications, analgesia, and symptom relief' },
  { id: 'Escalate', title: 'Escalate', subtitle: 'Direct clinician notification, specialized teams, and urgent escalation' },
  { id: 'Prepare disposition', title: 'Prepare disposition', subtitle: 'Routine rooming, isolation protocols, and queue management' }
];

function mapActionToCluster(action) {
  const cat = action.category || '';
  const name = String(action.name).toLowerCase();
  if (cat === 'Airway and breathing' || cat === 'Access and circulation' || cat === 'Critical procedures' || cat === 'Safety') {
    return 'Stabilize';
  }
  if (cat === 'Medications' || name.includes('analgesia') || name.includes('medication')) {
    return 'Treat';
  }
  if (cat === 'Escalation' || name.includes('notify') || name.includes('team') || name.includes('consult')) {
    return 'Escalate';
  }
  if (cat === 'Placement' || name.includes('monitoring') || name.includes('draw') || name.includes('test') || name.includes('ecg')) {
    return 'Assess';
  }
  return 'Prepare disposition';
}

function groupActionsByIntent(actions) {
  const grouped = actions.reduce((acc, action) => {
    const clusterId = mapActionToCluster(action);
    if (!acc[clusterId]) acc[clusterId] = [];
    acc[clusterId].push(action);
    return acc;
  }, {});

  return CLUSTERS.map((cluster) => ({
    ...cluster,
    items: grouped[cluster.id] || []
  })).filter((cluster) => cluster.items.length > 0);
}

function Interventions({ sessionId, coachEnabled = false, onNext, onCapture, onClock }) {
  const [availableActions, setAvailableActions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchActions = async () => {
      try {
        const actions = await getEscalationActions(sessionId);
        if (isMounted) setAvailableActions(actions);
      } catch (err) {
        if (isMounted) setError('Failed to load care priority options.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchActions();
    return () => { isMounted = false; };
  }, [sessionId]);

  const handleToggle = (id) => {
    if (results) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const clearSelection = () => {
    if (!results) setSelectedIds([]);
  };

  const submitActions = async (ids) => {
    try {
      setError('');
      setSubmitting(true);
      const defaultRationale = 'Selected standard clinical interventions based on presentation.';
      const data = await selectEscalationActions(sessionId, ids, defaultRationale);
      const performedActions = data.actions_performed;
      setResults(performedActions);
      if (onClock && data.clock) onClock(data.clock);
      if (onCapture) {
        onCapture({
          interventions: performedActions,
          escalationActions: performedActions,
          escalationRationale: defaultRationale
        });
      }
    } catch (err) {
      setError('Failed to record care priorities.');
      setSubmitting(false);
    }
  };

  if (loading && !results) {
    return (
      <section className="step-card">
        <div className="loading">Retrieving care priority options...</div>
      </section>
    );
  }

  if (error && !availableActions.length) {
    return (
      <section className="step-card">
        <div className="error-message">{error}</div>
      </section>
    );
  }

  const groupedAvailable = groupActionsByIntent(availableActions);

  return (
    <section className="step-card interventions-card" aria-labelledby="interventions-heading">
      <div className="section-header">
        <div>
          <span className="eyebrow">
            Step 4 of 6 <span className="provenance-tag student-tag">Student Decision</span>
          </span>
          <h2 id="interventions-heading">Care Priorities & Orders</h2>
          <p className="subtitle">
            Initiate immediate life-stabilizing interventions, order diagnostics, or place the patient in monitored care.
          </p>
        </div>
      </div>



      {!results ? (
        <>
          <div className="interventions-selection-header">
            <h3>Available Triage Actions</h3>
            <button
              type="button"
              className="btn-link"
              onClick={clearSelection}
              disabled={selectedIds.length === 0}
            >
              Clear Selection
            </button>
          </div>

          <div className="interventions-categories-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '16px 0' }}>
            {groupedAvailable.map((cluster) => (
              <div key={cluster.id} className="intervention-compact-cluster" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <strong style={{ display: 'block', marginBottom: '4px', color: '#0f172a', fontSize: '0.95rem' }}>{cluster.title}</strong>
                <span style={{ display: 'block', marginBottom: '12px', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.2 }}>{cluster.subtitle}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cluster.items.map((action) => {
                    const isSelected = selectedIds.includes(action.id);
                    return (
                      <label
                        key={action.id}
                        title={action.description}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', padding: '6px', background: isSelected ? '#e0f2fe' : '#fff', borderRadius: '4px', border: isSelected ? '1px solid #bae6fd' : '1px solid #e2e8f0', transition: 'all 0.1s' }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggle(action.id)}
                          disabled={submitting}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.88rem', color: isSelected ? '#0369a1' : '#334155', fontWeight: isSelected ? '600' : '400', lineHeight: 1.3 }}>
                          {action.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && <div className="error-message" role="alert">{error}</div>}

          <div className="step-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => submitActions([])}
              disabled={submitting || selectedIds.length > 0}
            >
              Routine Waiting (Zero Immediate Actions)
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => submitActions(selectedIds)}
              disabled={submitting || selectedIds.length === 0}
            >
              {submitting ? 'Locking Care Priorities...' : 'Lock Care Priorities & Proceed to SBAR Handoff'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="results-section">
            <span className="eyebrow">Care Priorities Locked</span>
            {results.length > 0 ? (
              <div className="interventions-results-grid">
                {results.map((action) => (
                  <div key={action.id} className="locked-action-card">
                    <span className="cluster-tag">{mapActionToCluster(action)}</span>
                    <strong>{action.name}</strong>
                    <small>{action.description}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-interventions">Routine waiting with zero immediate interventions recorded.</p>
            )}
          </div>

          <div className="step-actions">
            <button type="button" className="btn-primary" onClick={onNext}>
              Proceed to SBAR Handoff
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default Interventions;
