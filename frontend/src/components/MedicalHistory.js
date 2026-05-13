import React, { useState } from 'react';
import StreamingText from './StreamingText';
import { streamMedicalHistory } from '../services/api';

const PROMPT_BANK = [
  'What medical problems do you live with?',
  'Do you take any daily medicines or blood thinners?',
  'Have you had anything like this before?'
];

function MedicalHistory({ sessionId, onNext, onCapture }) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasAsked, setHasAsked] = useState(false);
  const [error, setError] = useState('');

  const handleAskQuestion = () => {
    if (!question.trim()) {
      setError('Enter a focused history question before continuing.');
      return;
    }

    let fullResponse = '';
    setError('');
    setResponse('');
    setIsStreaming(true);
    setHasAsked(true);

    streamMedicalHistory(
      sessionId,
      question,
      (chunk) => {
        fullResponse += chunk;
        setResponse(fullResponse);
      },
      () => {
        setIsStreaming(false);
        if (onCapture) {
          onCapture({
            historyQuestion: question,
            historyResponse: fullResponse
          });
        }
      },
      (err) => {
        setError(err);
        setIsStreaming(false);
      }
    );
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleAskQuestion();
    }
  };

  return (
    <section className="step-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Risk context</span>
          <h3>Focused history</h3>
        </div>
        <span className="clinical-badge">One question</span>
      </div>

      <p className="instruction">
        Choose the highest-yield question for risk stratification. Medication
        risk, prior disease, and recurrence can change the ESI call quickly.
      </p>

      {!hasAsked && (
        <div className="prompt-bank" aria-label="Suggested history prompts">
          {PROMPT_BANK.map((prompt) => (
            <button
              type="button"
              className="prompt-chip"
              key={prompt}
              onClick={() => setQuestion(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="question-input">
        <label htmlFor="history-question">Focused history question</label>
        <textarea
          id="history-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about a risk factor, medication, or prior condition."
          rows="4"
          disabled={hasAsked}
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      {!hasAsked ? (
        <button className="btn-primary" onClick={handleAskQuestion}>
          Ask patient
        </button>
      ) : (
        <>
          <StreamingText text={response} isStreaming={isStreaming} />
          {!isStreaming && (
            <div className="button-group">
              <button className="btn-primary" onClick={onNext}>
                Continue to ESI decision
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default MedicalHistory;
