import React, { useState, useEffect } from 'react';
import { getAvailableVitals, getVitals } from '../services/api';

function VitalSigns({ sessionId, onNext }) {
  const [availableVitals, setAvailableVitals] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchVitals = async () => {
      try {
        const vitals = await getAvailableVitals(sessionId);
        setAvailableVitals(vitals);
        setLoading(false);
      } catch (err) {
        setError('Failed to load vitals');
        setLoading(false);
      }
    };
    
    fetchVitals();
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
  
  const handleSelectAll = () => {
    if (results) return;
    setSelectedIndices(availableVitals.map(v => v.index));
  };
  
  const handleSubmit = async () => {
    if (selectedIndices.length === 0) {
      setError('Please select at least one vital sign');
      return;
    }
    
    try {
      setLoading(true);
      const vitalResults = await getVitals(sessionId, selectedIndices);
      setResults(vitalResults);
      setLoading(false);
    } catch (err) {
      setError('Failed to get vitals');
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="step-card">
        <div className="loading">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="step-card">
      <div className="step-header">
        <h2>Step 3: Vital Signs Measurement</h2>
        <div className="step-indicator">Step 3 of 7</div>
      </div>
      
      {!results && (
        <p className="instruction">
          Select which vital signs you want to measure.
        </p>
      )}
      
      {!results ? (
        <>
          <div className="checkbox-list">
            {availableVitals.map((vital) => (
              <label key={vital.index} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={selectedIndices.includes(vital.index)}
                  onChange={() => handleToggle(vital.index)}
                />
                <span>{vital.name}</span>
              </label>
            ))}
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="button-group">
            <button className="btn-secondary" onClick={handleSelectAll}>
              Select All
            </button>
            <button className="btn-primary" onClick={handleSubmit}>
              Measure Selected Vitals
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="results-section">
            <h3>Vital Signs Results:</h3>
            <div className="vitals-results">
              {results.map((vital, index) => (
                <div key={index} className="vital-result">
                  <span className="vital-name">{vital.name}:</span>
                  <span className="vital-value">{vital.value}</span>
                </div>
              ))}
            </div>
          </div>
          
          <button className="btn-primary" onClick={onNext}>
            Continue
          </button>
        </>
      )}
    </div>
  );
}

export default VitalSigns;

