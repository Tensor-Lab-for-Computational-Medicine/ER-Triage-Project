import React, { useState } from 'react';
import StreamingText from './StreamingText';
import { streamChiefComplaint } from '../services/api';

const PROMPT_BANK = [
  'What brought you to the emergency department today?',
  'Can you tell me what happened from the beginning?',
  'What symptom is worrying you the most right now?'
];

function ChiefComplaint({ sessionId, onNext, onCapture }) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasAsked, setHasAsked] = useState(false);
  const [error, setError] = useState('');

  const handleAskQuestion = () => {
    if (!question.trim()) {
      setError('Enter a chief concern question before continuing.');
      return;
    }

    let fullResponse = '';
    setError('');
    setResponse('');
    setIsStreaming(true);
    setHasAsked(true);

    streamChiefComplaint(
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
            chiefQuestion: question,
            chiefResponse: fullResponse
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
          <span className="eyebrow">Patient voice</span>
          <h3>Chief concern interview</h3>
        </div>
        <span className="clinical-badge">One question</span>
      </div>

      <p className="instruction">
        Ask one opening question that gives the patient room to describe the
        symptom, timeline, and immediate concern.
      </p>

      {!hasAsked && (
        <div className="prompt-bank" aria-label="Suggested chief concern prompts">
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
        <label htmlFor="question">Triage question</label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the patient why they came to the ED."
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
                Continue to vitals
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default ChiefComplaint;
