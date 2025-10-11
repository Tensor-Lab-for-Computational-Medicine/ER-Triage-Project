import React, { useState } from 'react';
import StreamingText from './StreamingText';
import { streamMedicalHistory } from '../services/api';

function MedicalHistory({ sessionId, onNext }) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasAsked, setHasAsked] = useState(false);
  const [error, setError] = useState('');
  
  const handleAskQuestion = () => {
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }
    
    setError('');
    setResponse('');
    setIsStreaming(true);
    setHasAsked(true);
    
    streamMedicalHistory(
      sessionId,
      question,
      (chunk) => {
        setResponse(prev => prev + chunk);
      },
      () => {
        setIsStreaming(false);
      },
      (err) => {
        setError(err);
        setIsStreaming(false);
      }
    );
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };
  
  return (
    <div className="step-card">
      <div className="step-header">
        <h2>Step 4: Medical History</h2>
        <div className="step-indicator">Step 4 of 7</div>
      </div>
      
      <p className="instruction">
        Ask the patient one question about their medical history.
      </p>
      
      <div className="question-input">
        <label htmlFor="history-question">Your Question:</label>
        <textarea
          id="history-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="e.g., Do you have any chronic medical conditions?"
          rows="3"
          disabled={hasAsked}
        />
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {!hasAsked ? (
        <button className="btn-primary" onClick={handleAskQuestion}>
          Ask Patient
        </button>
      ) : (
        <>
          <StreamingText text={response} isStreaming={isStreaming} />
          {!isStreaming && (
            <button className="btn-primary" onClick={onNext}>
              Continue
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default MedicalHistory;

