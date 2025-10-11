import React, { useState } from 'react';
import { assignTriage } from '../services/api';

function TriageAssignment({ sessionId, onNext }) {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const triageLevels = [
    { level: 1, name: 'ESI Level 1 - Resuscitation', description: 'Immediate, life-threatening' },
    { level: 2, name: 'ESI Level 2 - Emergent', description: 'High risk, severe pain/distress' },
    { level: 3, name: 'ESI Level 3 - Urgent', description: 'Moderate risk, stable vitals' },
    { level: 4, name: 'ESI Level 4 - Less Urgent', description: 'Minor injuries, stable' },
    { level: 5, name: 'ESI Level 5 - Non-Urgent', description: 'Minor conditions' }
  ];
  
  const handleSelect = async (level) => {
    setSelectedLevel(level);
    setLoading(true);
    setError('');
    
    try {
      await assignTriage(sessionId, level);
      setLoading(false);
      // Auto-advance after short delay
      setTimeout(() => onNext(), 500);
    } catch (err) {
      setError('Failed to assign triage level');
      setLoading(false);
      setSelectedLevel(null);
    }
  };
  
  return (
    <div className="step-card">
      <div className="step-header">
        <h2>Step 5: Triage Assignment</h2>
        <div className="step-indicator">Step 5 of 7</div>
      </div>
      
      <p className="instruction">
        Select the appropriate ESI triage level based on your assessment.
      </p>
      
      <div className="triage-levels">
        {triageLevels.map((level) => (
          <button
            key={level.level}
            className={`triage-button ${selectedLevel === level.level ? 'selected' : ''} level-${level.level}`}
            onClick={() => handleSelect(level.level)}
            disabled={loading || selectedLevel !== null}
          >
            <div className="triage-name">{level.name}</div>
            <div className="triage-description">{level.description}</div>
          </button>
        ))}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {loading && <div className="loading">Assigning triage level...</div>}
      
      {selectedLevel && !loading && (
        <div className="success-message">
          Triage Level {selectedLevel} assigned successfully!
        </div>
      )}
    </div>
  );
}

export default TriageAssignment;

