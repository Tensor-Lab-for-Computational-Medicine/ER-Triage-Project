import React, { useEffect, useState } from 'react';
import {
  askPatientQuestion,
  getTutorSettings,
  recordInterviewSupport,
  setInterviewMode
} from '../services/api';

function responseSourceLabel(item) {
  if (item.semantic_score) return `Semantic cache ${Math.round(item.semantic_score * 100)}% - ${item.time_cost_seconds}s elapsed`;
  if (item.cached) return `Cached response - ${item.time_cost_seconds}s elapsed`;
  if (item.used_ai) return `OpenRouter response - ${item.time_cost_seconds}s elapsed`;
  return `Local response - ${item.time_cost_seconds}s elapsed`;
}

function FocusedInterview({
  sessionId,
  interviewModes = [],
  interviewSupports = [],
  maxQuestions,
  onNext,
  onCapture,
  onClock
}) {
  const [selectedMode, setSelectedMode] = useState('assessment');
  const [supportUses, setSupportUses] = useState([]);
  const [question, setQuestion] = useState('');
  const [log, setLog] = useState([]);
  const [queuedSupportId, setQueuedSupportId] = useState('');
  const [lastInsertedStem, setLastInsertedStem] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [modeLoading, setModeLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedMode('assessment');
    setSupportUses([]);
    setQuestion('');
    setLog([]);
    setQueuedSupportId('');
    setLastInsertedStem('');
  }, [sessionId]);

  const modes = interviewModes.length > 0
    ? interviewModes
    : [
        {
          id: 'assessment',
          label: 'Assessment',
          description: 'Free-text questions only.',
          supports_enabled: false
        }
      ];
  const activeMode = modes.find((item) => item.id === selectedMode) || modes[0];
  const supportsEnabled = Boolean(activeMode?.supports_enabled);
  const isGuidedMode = selectedMode === 'beginner';
  const isPracticeMode = selectedMode === 'intermediate';
  const questionsRemaining = Math.max((maxQuestions || 4) - log.length, 0);
  const canContinue = log.length >= 2;
  const minimumQuestions = 2;
  const modeLocked = log.length > 0 || supportUses.length > 0;
  const budgetSlots = Array.from({ length: maxQuestions || 4 }, (_, index) => index);

  const modeBadge = (mode) => {
    if (mode.id === 'assessment') return 'No prompts';
    if (mode.id === 'intermediate') return '+20s per support';
    return 'No support cost';
  };

  const supportCostLabel = (support) => {
    const used = supportUses.find((item) => item.id === support.id);
    if (used?.cost_seconds) return `+${used.cost_seconds}s used`;
    if (isPracticeMode) return '+20s';
    return 'No clock cost';
  };

  const chooseMode = async (mode) => {
    if (mode.id === selectedMode || modeLoading || log.length > 0 || supportUses.length > 0) return;
    setModeLoading(true);
    setError('');

    try {
      const data = await setInterviewMode(sessionId, mode.id);
      setSelectedMode(data.mode.id);
      setSupportUses(data.support_uses || []);
      if (data.mode.id === 'assessment') {
        setQueuedSupportId('');
        setLastInsertedStem('');
      }
      if (onClock) onClock(data.clock);
      if (onCapture) {
        onCapture({
          interviewMode: data.mode.id,
          interviewSupports: data.support_uses || []
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Interview mode could not be changed.');
    } finally {
      setModeLoading(false);
    }
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
          interviewMode: selectedMode,
          interviewSupports: data.support_uses || []
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Interview support could not be opened.');
    } finally {
      setLoading(false);
    }
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
    setLoadingMessage(getTutorSettings().hasKey ? 'Checking semantic cache before OpenRouter.' : 'Using local patient response rules.');
    setError('');
    const statusTimers = [];

    try {
      if (getTutorSettings().hasKey) {
        statusTimers.push(window.setTimeout(() => setLoadingMessage('Preparing local similarity check.'), 900));
        statusTimers.push(window.setTimeout(() => setLoadingMessage('Requesting OpenRouter patient response if no cache matches.'), 3500));
      }
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
          interviewMode: selectedMode,
          interviewSupports: supportUses
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Patient response could not be recorded.');
    } finally {
      statusTimers.forEach((timerId) => window.clearTimeout(timerId));
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
          Ask questions that change acuity, immediate risk, or escalation decisions.
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

      <div className="mode-selector" role="radiogroup" aria-label="Interview mode">
        {modes.map((mode) => (
          <button
            type="button"
            key={mode.id}
            className={selectedMode === mode.id ? 'selected' : ''}
            onClick={() => chooseMode(mode)}
            disabled={modeLoading || loading || modeLocked}
            aria-pressed={selectedMode === mode.id}
          >
            <span className="mode-kicker">{modeBadge(mode)}</span>
            <strong>{mode.label}</strong>
            <span>{mode.description}</span>
          </button>
        ))}
      </div>

      {supportsEnabled ? (
        <div className={`support-workspace ${isGuidedMode ? 'guided' : 'practice'}`}>
          <div className="support-toolbar">
            <div>
              <span className="eyebrow">{isGuidedMode ? 'Guided question plan' : 'Practice prompt bank'}</span>
              <h4>{isGuidedMode ? 'Build a complete triage interview' : 'Use prompts only when needed'}</h4>
              <p>
                {isGuidedMode
                  ? 'Each card keeps an editable question frame visible. Selecting a card places the frame in the question box.'
                  : 'Prompt cards insert editable question frames and add simulated time when first opened.'}
              </p>
            </div>
            <span className="clinical-badge">{isPracticeMode ? '+20s support cost' : 'No support cost'}</span>
          </div>

          <div className={isGuidedMode ? 'guided-support-grid' : 'practice-support-strip'} aria-label="Interview supports">
            {interviewSupports.map((item, index) => {
              const used = supportUses.some((support) => support.id === item.id);
              const queued = queuedSupportId === item.id;
              const nextGuided = isGuidedMode && !used && supportUses.length === index;
              return (
                <button
                  type="button"
                  className={`support-card ${used ? 'used' : ''} ${queued ? 'active' : ''} ${nextGuided ? 'next' : ''}`}
                  key={item.id}
                  onClick={() => openSupport(item)}
                  disabled={loading || questionsRemaining === 0}
                  aria-pressed={queued}
                >
                  <span className="support-card-meta">{supportCostLabel(item)}</span>
                  <strong>{item.label}</strong>
                  <span>{item.cue}</span>
                  {isGuidedMode && <small className="support-stem">{item.question_stem}</small>}
                  <em>{used ? 'Used in this interview' : queued ? 'Queued in question box' : 'Insert editable frame'}</em>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mode-note mode-note-panel">
          <strong>Independent interview</strong>
          <span>Question support is off. The debrief scores concept coverage after the case.</span>
        </div>
      )}

      {supportUses.length > 0 && (
        <div className="support-summary">
          {supportUses.map((support) => (
            <span key={support.id}>
              {support.label}
              {support.cost_seconds ? ` +${support.cost_seconds}s` : ''}
            </span>
          ))}
        </div>
      )}

      <div className="question-input">
        <label htmlFor="focused-question">Question to patient</label>
        <textarea
          id="focused-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask one focused question."
          rows="3"
          disabled={loading || questionsRemaining === 0}
        />
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
              <small>{responseSourceLabel(item)}</small>
              {item.ai_error && <small className="fallback-note">AI fallback: {item.ai_error}</small>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default FocusedInterview;
