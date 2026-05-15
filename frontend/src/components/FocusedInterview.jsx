import React, { useEffect, useRef, useState } from 'react';
import {
  askPatientQuestion,
  recordInterviewSupport
} from '../services/api';

function FocusedInterview({
  sessionId,
  interviewSupports = [],
  maxQuestions,
  onNext,
  onCapture,
  onClock
}) {
  const [supportUses, setSupportUses] = useState([]);
  const [question, setQuestion] = useState('');
  const [log, setLog] = useState([]);
  const [queuedSupportId, setQueuedSupportId] = useState('');
  const [lastInsertedStem, setLastInsertedStem] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    setSupportUses([]);
    setQuestion('');
    setLog([]);
    setQueuedSupportId('');
    setLastInsertedStem('');
    setVoiceStatus('');
  }, [sessionId]);

  useEffect(() => () => {
    if (recognitionRef.current) recognitionRef.current.abort();
  }, []);

  const supportsEnabled = interviewSupports.length > 0;
  const questionsRemaining = Math.max((maxQuestions || 4) - log.length, 0);
  const canContinue = log.length >= 2;
  const minimumQuestions = 2;
  const budgetSlots = Array.from({ length: maxQuestions || 4 }, (_, index) => index);

  const supportCostLabel = (support) => {
    const used = supportUses.find((item) => item.id === support.id);
    if (used) return 'Used';
    return 'Prompt';
  };

  const openSupport = async (support) => {
    setLoading(true);
    setError('');

    try {
      const data = await recordInterviewSupport(sessionId, support.id);
      const supportRecord = data.support || support;
      const stem = supportRecord.question_stem || support.question_stem || '';

      setSupportUses(data.support_uses || []);
      setQueuedSupportId(support.id);
      if (stem) {
        setQuestion((current) => {
          if (!current.trim() || current === lastInsertedStem) {
            return stem;
          }
          return current;
        });
        setLastInsertedStem(stem);
      }
      if (onClock) onClock(data.clock);
      if (onCapture) {
        onCapture({
          interviewMode: 'assessment',
          interviewSupports: data.support_uses || []
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Interview support could not be opened.');
    } finally {
      setLoading(false);
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice input is not available in this browser.');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
      setVoiceStatus('');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setVoiceStatus('Listening');
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) {
        setQuestion((current) => [current.trim(), transcript].filter(Boolean).join(' '));
      }
    };
    recognition.onerror = () => {
      setVoiceStatus('');
      setError('Voice input could not be captured.');
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceStatus('');
    };
    recognitionRef.current = recognition;
    setError('');
    recognition.start();
  };

  const submitQuestion = async () => {
    const trimmed = question.trim();
    if (!trimmed) {
      setError('Enter a focused triage question.');
      return;
    }
    if (questionsRemaining <= 0) {
      setError('Question budget used.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Getting patient response.');
    setError('');

    try {
      const data = await askPatientQuestion(sessionId, trimmed);
      const nextLog = [...log, data.response];
      setLog(nextLog);
      setQuestion('');
      if (onClock) onClock(data.clock);
      if (onCapture) {
        const chief = nextLog.find((item) => item.category === 'chief_concern');
        const history = [...nextLog].reverse().find((item) =>
          ['medical_history', 'medications', 'prior_episode'].includes(item.category)
        );
        onCapture({
          interviewLog: nextLog,
          chiefQuestion: chief?.question || '',
          chiefResponse: chief?.answer || '',
          historyQuestion: history?.question || '',
          historyResponse: history?.answer || '',
          interviewMode: 'assessment',
          interviewSupports: supportUses
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Patient response could not be recorded.');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  return (
    <section className="step-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Focused assessment</span>
          <h3>Focused triage interview</h3>
        </div>
        <span className="clinical-badge">{questionsRemaining} questions left</span>
      </div>

      <div className="interview-brief">
        <p className="instruction">
          Speak or type one question at a time. The patient answer appears in the transcript, and the report scores whether the interview covered the risk-changing history.
        </p>
        <div className="question-progress-panel" aria-label="Question budget">
          <div>
            <span>Question budget</span>
            <strong>{log.length} / {maxQuestions || 4} used</strong>
          </div>
          <div className="question-budget" aria-hidden="true">
            {budgetSlots.map((slot) => (
              <span key={slot} className={slot < log.length ? 'used' : ''} />
            ))}
          </div>
          <small>
            {canContinue
              ? 'Minimum interview complete'
              : `${Math.max(minimumQuestions - log.length, 0)} more question${minimumQuestions - log.length === 1 ? '' : 's'} needed to continue`}
          </small>
        </div>
      </div>

      {supportsEnabled ? (
        <details className="support-workspace">
          <summary>
            <div>
              <span className="eyebrow">Question prompts</span>
              <h4>Use prompts</h4>
            </div>
            <strong>{supportUses.length} used</strong>
          </summary>

          <p className="support-note">
            Use a prompt when you need a question frame.
          </p>

          <div className="prompt-support-grid" aria-label="Interview supports">
            {interviewSupports.map((item, index) => {
              const used = supportUses.some((support) => support.id === item.id);
              const queued = queuedSupportId === item.id;
              const nextPrompt = !used && supportUses.length === index;
              return (
                <button
                  type="button"
                  className={`support-card ${used ? 'used' : ''} ${queued ? 'active' : ''} ${nextPrompt ? 'next' : ''}`}
                  key={item.id}
                  onClick={() => openSupport(item)}
                  disabled={loading || questionsRemaining === 0}
                  aria-pressed={queued}
                >
                  <strong>{item.label}</strong>
                  <span>{item.cue}</span>
                  <em>{used ? 'Used' : queued ? 'Queued' : supportCostLabel(item)}</em>
                </button>
              );
            })}
          </div>
        </details>
      ) : (
        <div className="mode-note mode-note-panel">
          <strong>Focused interview</strong>
          <span>Use free-text questions. The debrief scores concept coverage after the case.</span>
        </div>
      )}

      {supportUses.length > 0 && (
        <div className="support-summary">
          {supportUses.map((support) => (
            <span key={support.id}>
              {support.label}
            </span>
          ))}
        </div>
      )}

      <div className="question-input">
        <label htmlFor="focused-question">Question to patient</label>
        <div className="conversation-composer">
          <textarea
            id="focused-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask one focused question."
            rows="3"
            disabled={loading || questionsRemaining === 0}
          />
          <button
            type="button"
            className={`voice-button ${voiceStatus ? 'active' : ''}`}
            onClick={startVoiceInput}
            disabled={loading || questionsRemaining === 0}
            aria-pressed={Boolean(voiceStatus)}
          >
            {voiceStatus || 'Voice input'}
          </button>
        </div>
        <small className="field-hint">
          Keep each entry to one question so the debrief can score concept coverage accurately.
        </small>
      </div>

      {error && <div className="error-message">{error}</div>}
      {loadingMessage && <div className="loading compact-loading">{loadingMessage}</div>}

      <div className="button-group">
        <button className="btn-primary" onClick={submitQuestion} disabled={loading || questionsRemaining === 0}>
          {loading ? 'Asking patient...' : 'Ask patient'}
        </button>
        <button className="btn-secondary" onClick={onNext} disabled={!canContinue || loading}>
          Continue to provisional ESI
        </button>
      </div>

      {log.length > 0 && (
        <div className="interview-thread">
          {log.map((item, index) => (
            <div className="interview-entry" key={`${item.category}-${index}`}>
              <div>
                <span>Question {index + 1}</span>
                <strong>{item.question}</strong>
              </div>
              <p>{item.answer}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default FocusedInterview;
