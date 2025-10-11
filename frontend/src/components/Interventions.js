import React, { useState, useEffect } from 'react';
import { getInterventions, selectInterventions } from '../services/api';

function Interventions({ sessionId, onNext }) {
  const [availableInterventions, setAvailableInterventions] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchInterventions = async () => {
      try {
        const interventions = await getInterventions(sessionId);
        setAvailableInterventions(interventions);
        setLoading(false);
      } catch (err) {
        setError('Failed to load interventions');
        setLoading(false);
      }
    };
    
    fetchInterventions();
  }, [sessionId]);
  
  const handleToggle = (index) => {
    if (results) return; // Can't change after submitting
    
    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };
  
  const handleSubmit = async () => {
    try {
      setLoading(true);
      const performedInterventions = await selectInterventions(sessionId, selectedIndices);
      setResults(performedInterventions);
      setLoading(false);
    } catch (err) {
      setError('Failed to perform interventions');
      setLoading(false);
    }
  };
  
  const handleSkip = async () => {
    try {
      setLoading(true);
      const performedInterventions = await selectInterventions(sessionId, []);
      setResults(performedInterventions);
      setLoading(false);
    } catch (err) {
      setError('Failed to skip interventions');
      setLoading(false);
    }
  };
  
  if (loading && !results) {
    return (
      <div className="step-card">
        <div className="loading">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="step-card">
      <div className="step-header">
        <h2>Step 6: Intervention Ordering</h2>
        <div className="step-indicator">Step 6 of 7</div>
      </div>
      
      {!results && (
        <p className="instruction">
          Select which interventions you want to perform. You can select multiple at once.
        </p>
      )}
      
      {!results ? (
        <>
          <div className="checkbox-list interventions-list">
            {availableInterventions.map((intervention) => (
              <label key={intervention.index} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={selectedIndices.includes(intervention.index)}
                  onChange={() => handleToggle(intervention.index)}
                />
                <span>{intervention.name}</span>
              </label>
            ))}
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="button-group">
            <button className="btn-secondary" onClick={handleSkip}>
              Skip Interventions
            </button>
            <button 
              className="btn-primary" 
              onClick={handleSubmit}
              disabled={selectedIndices.length === 0}
            >
              Perform Selected Interventions
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="results-section">
            {results.length > 0 ? (
              <>
                <h3>Interventions Performed:</h3>
                <div className="interventions-results">
                  {results.map((intervention, index) => (
                    <div key={index} className="intervention-result">
                      ✓ {intervention.name}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="no-interventions">No interventions performed.</div>
            )}
          </div>
          
          <button className="btn-primary" onClick={onNext}>
            Continue to Feedback
          </button>
        </>
      )}
    </div>
  );
}

export default Interventions;

