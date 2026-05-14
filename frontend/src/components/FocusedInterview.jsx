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
  const [showSupportPanel, setShowSupportPanel] = useState(false);
  const [activeSupport, setActiveSupport] = useState(null);
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
    setShowSupportPanel(false);
    setActiveSupport(null);
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
  const questionsRemaining = Math.max((maxQuestions || 4) - log.length, 0);
  const canContinue = log.length >= 2;

  const chooseMode = async (mode) => {
    if (mode.id === selectedMode || modeLoading || log.length > 0 || supportUses.length > 0) return;
    setModeLoading(true);
    setError('');

    try {
      const data = await setInterviewMode(sessionId, mode.id);
      setSelectedMode(data.mode.id);
      setSupportUses(data.support_uses || []);
      if (data.mode.id === 'assessment') {
        setShowSupportPanel(false);
        setActiveSupport(null);
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
      setActiveSupport(supportRecord);
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

  const useSupportStem = () => {
    if (!activeSupport?.question_stem) return;
    setQuestion(activeSupport.question_stem);
    setLastInsertedStem(activeSupport.question_stem);
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

      <p className="instruction">
        Ask questions in your own words. Concept coverage is scored after the case.
      </p>

      <div className="mode-selector" role="radiogroup" aria-label="Interview mode">
        {modes.map((mode) => (
          <button
            type="button"
            key={mode.id}
            className={selectedMode === mode.id ? 'selected' : ''}
            onClick={() => chooseMode(mode)}
            disabled={modeLoading || loading || log.length > 0 || supportUses.length > 0}
          >
            <strong>{mode.label}</strong>
            <span>{mode.description}</span>
          </button>
        ))}
      </div>

      {supportsEnabled ? (
        <>
          <button
            type="button"
            className="btn-secondary scaffold-toggle"
            onClick={() => setShowSupportPanel((value) => !value)}
          >
            {showSupportPanel ? 'Hide interview supports' : 'Open interview supports'}
          </button>

          {showSupportPanel && (
            <div className="support-panel" aria-label="Interview supports">
              {interviewSupports.map((item) => {
                const used = supportUses.some((support) => support.id === item.id);
                const active = activeSupport?.id === item.id;
                return (
                  <button
                    type="button"
                    className={`support-card ${used ? 'used' : ''} ${active ? 'active' : ''}`}
                    key={item.id}
                    onClick={() => openSupport(item)}
                    disabled={loading || questionsRemaining === 0}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.cue}</span>
                    {active ? <small>Selected</small> : used && <small>Opened</small>}
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <p className="mode-note">Assessment mode keeps interview supports closed until the debrief.</p>
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

      {activeSupport && (
        <div className="active-support" aria-live="polite">
          <span className="eyebrow">Interview support</span>
          <h4>{activeSupport.label}</h4>
          <p>{activeSupport.intent || activeSupport.cue}</p>
          {activeSupport.question_stem && (
            <div className="question-frame">
              <strong>Editable question frame</strong>
              <p>{activeSupport.question_stem}</p>
              <button type="button" className="btn-secondary" onClick={useSupportStem} disabled={loading}>
                Use this frame
              </button>
            </div>
          )}
        </div>
      )}

      <div className="question-input">
        <label htmlFor="focused-question">Focused triage question</label>
        <textarea
          id="focused-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Type the question you would ask next."
          rows="3"
          disabled={loading || questionsRemaining === 0}
        />
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
