import React, { useState, useEffect } from 'react';
import { getFeedback } from '../services/api';

function Feedback({ sessionId, onRestart }) {
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    let isMounted = true;
    
    const fetchFeedback = async () => {
      try {
        console.log('Fetching feedback for session:', sessionId);
        const data = await getFeedback(sessionId);
        console.log('Feedback received:', data);
        if (isMounted) {
          setFeedback(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Feedback error:', err);
        if (isMounted) {
          setError(`Failed to load feedback: ${err.message || err.toString()}`);
          setLoading(false);
        }
      }
    };
    
    fetchFeedback();
    
    return () => {
      isMounted = false;
    };
  }, [sessionId]);
  
  if (loading) {
    return (
      <div className="step-card">
        <div className="loading">Generating feedback report...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="step-card">
        <div className="error-message">{error}</div>
        <button className="btn-primary" onClick={onRestart}>
          Start New Simulation
        </button>
      </div>
    );
  }
  
  const { session_summary, triage_analysis, clinical_feedback } = feedback;
  
  return (
    <div className="step-card feedback-card">
      <div className="step-header">
        <h2>Step 7: Simulation Feedback</h2>
        <div className="step-indicator">Step 7 of 7</div>
      </div>
      
      <div className="feedback-section">
        <h3>Session Summary</h3>
        <div className="feedback-content">
          <div className="info-row">
            <span className="label">Arrival Method:</span>
            <span className="value">{session_summary.arrival_method}</span>
          </div>
          <div className="info-row">
            <span className="label">Chief Complaint:</span>
            <span className="value">{session_summary.chief_complaint}</span>
          </div>
          
          {session_summary.chief_complaint_question && (
            <div className="questions-asked">
              <h4>Questions Asked:</h4>
              <div className="question-item">
                <strong>Chief Complaint:</strong> {session_summary.chief_complaint_question}
              </div>
              {session_summary.medical_history_question && (
                <div className="question-item">
                  <strong>Medical History:</strong> {session_summary.medical_history_question}
                </div>
              )}
            </div>
          )}
          
          <div className="vitals-checked">
            <h4>Vitals Checked:</h4>
            {session_summary.vitals_checked && session_summary.vitals_checked.length > 0 ? (
              <ul>
                {session_summary.vitals_checked.map((vital, index) => (
                  <li key={index}>{vital.name}: {vital.value}</li>
                ))}
              </ul>
            ) : (
              <p>None</p>
            )}
          </div>
          
          <div className="interventions-performed">
            <h4>Interventions Performed:</h4>
            {session_summary.interventions_performed && session_summary.interventions_performed.length > 0 ? (
              <ul>
                {session_summary.interventions_performed.map((intervention, index) => (
                  <li key={index}>{intervention}</li>
                ))}
              </ul>
            ) : (
              <p>None</p>
            )}
          </div>
          
          <div className="info-row">
            <span className="label">Triage Level Assigned:</span>
            <span className="value">ESI Level {session_summary.triage_level_assigned}</span>
          </div>
        </div>
      </div>
      
      <div className="feedback-section">
        <h3>Triage Analysis</h3>
        <div className="feedback-content">
          <div className="triage-comparison">
            <div className="comparison-row">
              <span className="label">Your Decision:</span>
              <span className="value">ESI Level {triage_analysis.user_level}</span>
            </div>
            <div className="comparison-row">
              <span className="label">Expert Decision:</span>
              <span className="value">ESI Level {triage_analysis.expert_level}</span>
            </div>
            <div className={`comparison-result ${triage_analysis.comparison.toLowerCase().replace(' ', '-')}`}>
              <strong>Result:</strong> {triage_analysis.comparison}
            </div>
          </div>
          
          {triage_analysis.outcomes && triage_analysis.outcomes.length > 0 && (
            <div className="patient-outcomes">
              <h4>Patient Outcomes:</h4>
              <ul>
                {triage_analysis.outcomes.map((outcome, index) => (
                  <li key={index}>{outcome}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      
      <div className="feedback-section">
        <h3>Actual Interventions in ED</h3>
        <div className="feedback-content">
          {clinical_feedback && clinical_feedback.length > 0 ? (
            <>
              <p>The following interventions were actually performed:</p>
              <ul>
                {clinical_feedback.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>No interventions were performed in the actual ED visit.</p>
          )}
        </div>
      </div>
      
      <button className="btn-primary restart-button" onClick={onRestart}>
        Start New Simulation
      </button>
    </div>
  );
}

export default Feedback;

