import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  acknowledgeInterviewGaps,
  askPatientQuestion,
  recordInterviewSupport
} from '../services/api';
import {
  getStoredPatientVoiceEnabled,
  preparePatientVoicePlayback,
  setStoredPatientVoiceEnabled,
  speakPatientAnswer,
  stopPatientVoice,
  warmPatientVoice
} from '../services/patientVoiceService';

const MINIMUM_QUESTIONS = 2;
const CONVERSATION_RESTART_DELAY_MS = 650;

function localhostVoiceUrl() {
  if (typeof window === 'undefined') return '';
  const { protocol, hostname, port, pathname, search, hash } = window.location;
  const localHost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (protocol === 'https:' || localHost) return '';
  if (protocol !== 'http:') return '';
  return `http://127.0.0.1${port ? `:${port}` : ''}${pathname}${search}${hash}`;
}

function microphoneBlockedByOrigin() {
  return typeof window !== 'undefined' && window.isSecureContext === false && Boolean(localhostVoiceUrl());
}

function voiceInputErrorMessage(errorCode = '') {
  if (microphoneBlockedByOrigin()) {
    return 'Voice input needs localhost or HTTPS for microphone access.';
  }

  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow microphone access in the browser and try again.';
    case 'audio-capture':
      return 'No microphone was detected. Check the active input device and browser permission.';
    case 'no-speech':
      return 'No speech was detected. Try again closer to the microphone.';
    case 'network':
      return 'Speech recognition could not connect. Try again or type the question.';
    default:
      return 'Voice input could not be captured.';
  }
}

function normalizeProgress(progress) {
  return {
    questions_used: progress?.questions_used || 0,
    minimum_questions: progress?.minimum_questions || MINIMUM_QUESTIONS,
    required_domains: progress?.required_domains || [],
    covered_domains: progress?.covered_domains || [],
    missed_domains: progress?.missed_domains || progress?.required_domains || [],
    optional_domains: progress?.optional_domains || [],
    optional_covered_domains: progress?.optional_covered_domains || [],
    complete: Boolean(progress?.complete),
    can_continue: Boolean(progress?.can_continue),
    continue_requires_acknowledgement: Boolean(progress?.continue_requires_acknowledgement),
    next_best_questions: progress?.next_best_questions || [],
    last_turn_feedback: progress?.last_turn_feedback || null
  };
}

function FocusedInterview({
  sessionId,
  interviewSupports = [],
  initialProgress = null,
  patientSex = '',
  coachEnabled = false,
  objectiveReview = null,
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
  const [patientVoiceEnabled, setPatientVoiceEnabled] = useState(() => getStoredPatientVoiceEnabled());
  const [patientVoiceStatus, setPatientVoiceStatus] = useState('');
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [conversationActive, setConversationActive] = useState(false);
  const [conversationStatus, setConversationStatus] = useState('');
  const [interviewProgress, setInterviewProgress] = useState(() => normalizeProgress(initialProgress));
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [objectiveStatus, setObjectiveStatus] = useState({ loaded: false, examConducted: false, selectedSystemIds: [] });
  const [error, setError] = useState('');
  const [voiceHelpUrl, setVoiceHelpUrl] = useState('');
  const [voiceToolsRoot, setVoiceToolsRoot] = useState(null);
  const recognitionRef = useRef(null);
  const recognitionModeRef = useRef('');
  const suppressRecognitionEndRef = useRef(false);
  const conversationActiveRef = useRef(false);
  const conversationWaitingRef = useRef(false);
  const conversationRestartRef = useRef(null);
  const pendingConversationQuestionRef = useRef('');
  const loadingRef = useRef(false);
  const logRef = useRef([]);
  const patientVoiceEnabledRef = useRef(patientVoiceEnabled);

  useEffect(() => {
    logRef.current = log;
  }, [log]);

  useEffect(() => {
    patientVoiceEnabledRef.current = patientVoiceEnabled;
  }, [patientVoiceEnabled]);

  useEffect(() => {
    setSupportUses([]);
    setQuestion('');
    setLog([]);
    setQueuedSupportId('');
    setLastInsertedStem('');
    setVoiceStatus('');
    setPatientVoiceStatus('');
    setSpeakingIndex(null);
    setConversationActive(false);
    setConversationStatus('');
    setObjectiveOpen(false);
    setObjectiveStatus({ loaded: false, examConducted: false, selectedSystemIds: [] });
    conversationActiveRef.current = false;
    conversationWaitingRef.current = false;
    pendingConversationQuestionRef.current = '';
    loadingRef.current = false;
    logRef.current = [];
    patientVoiceEnabledRef.current = getStoredPatientVoiceEnabled();
    if (patientVoiceEnabledRef.current) setPatientVoiceStatus('Loading patient voice');
    if (conversationRestartRef.current) {
      window.clearTimeout(conversationRestartRef.current);
      conversationRestartRef.current = null;
    }
    setInterviewProgress(normalizeProgress(initialProgress));
    setVoiceHelpUrl('');
    stopPatientVoice();
  }, [sessionId, initialProgress]);

  useEffect(() => () => {
    if (conversationRestartRef.current) window.clearTimeout(conversationRestartRef.current);
    suppressRecognitionEndRef.current = true;
    if (recognitionRef.current) recognitionRef.current.abort();
    stopPatientVoice();
  }, []);

  useEffect(() => {
    if (!patientVoiceEnabled) return undefined;
    let cancelled = false;
    setPatientVoiceStatus((current) => current || 'Loading patient voice');
    void warmPatientVoice({
      onStatus: (status) => {
        if (!cancelled) setPatientVoiceStatus(status);
      }
    })
      .then(() => {
        if (!cancelled) setPatientVoiceStatus('Patient voice ready');
      })
      .catch(() => {
        if (!cancelled) setPatientVoiceStatus('Voice unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [patientVoiceEnabled]);

  useEffect(() => {
    const updateVoiceToolsRoot = () => {
      setVoiceToolsRoot(document.getElementById('encounter-voice-tools-root'));
    };
    updateVoiceToolsRoot();
    const frameId = window.requestAnimationFrame(updateVoiceToolsRoot);
    return () => window.cancelAnimationFrame(frameId);
  }, [sessionId]);

  const supportsEnabled = interviewSupports.length > 0;
  const canContinue = Boolean(interviewProgress.can_continue);
  const canContinueWithGaps = Boolean(interviewProgress.continue_requires_acknowledgement);
  const progressComplete = Boolean(interviewProgress.complete);
  const coveredDomains = interviewProgress.covered_domains || [];
  const stillNeededDomains = interviewProgress.missed_domains || [];
  const optionalDomains = interviewProgress.optional_domains || [];
  const optionalCoveredDomains = interviewProgress.optional_covered_domains || [];
  const objectiveReady = !objectiveReview || (objectiveStatus.loaded && objectiveStatus.examConducted);
  const continueDisabled = loading || !canContinue || !objectiveReady;
  const continueWithGapsDisabled = loading || !objectiveReady;

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

  const stopActiveRecognition = () => {
    suppressRecognitionEndRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    recognitionModeRef.current = '';
    setVoiceStatus('');
  };

  const scheduleConversationRestart = (status = 'Ready') => {
    if (conversationRestartRef.current) {
      window.clearTimeout(conversationRestartRef.current);
      conversationRestartRef.current = null;
    }
    if (!conversationActiveRef.current) return;
    setConversationStatus(status);
    conversationRestartRef.current = window.setTimeout(() => {
      conversationRestartRef.current = null;
      if (!conversationActiveRef.current || loadingRef.current || recognitionRef.current) return;
      startSpeechRecognition({ conversational: true });
    }, CONVERSATION_RESTART_DELAY_MS);
  };

  const startSpeechRecognition = ({ conversational = false } = {}) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const localUrl = localhostVoiceUrl();
    if (microphoneBlockedByOrigin()) {
      setVoiceHelpUrl(localUrl);
      setError(voiceInputErrorMessage());
      if (conversational) {
        setConversationActive(false);
        conversationActiveRef.current = false;
        setConversationStatus('');
      }
      return;
    }

    if (!SpeechRecognition) {
      setVoiceHelpUrl(localUrl);
      setError('Voice input is available in Chrome or Edge with microphone access.');
      if (conversational) {
        setConversationActive(false);
        conversationActiveRef.current = false;
        setConversationStatus('');
      }
      return;
    }

    if (recognitionRef.current) {
      if (conversational) return;
      recognitionRef.current.abort();
      recognitionRef.current = null;
      recognitionModeRef.current = '';
      setVoiceStatus('');
      setVoiceHelpUrl('');
      return;
    }

    suppressRecognitionEndRef.current = false;
    recognitionModeRef.current = conversational ? 'conversation' : 'manual';
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = conversational;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setVoiceStatus('Listening');
      if (conversational) setConversationStatus('Listening');
      setVoiceHelpUrl('');
      setError('');
    };
    recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const transcript = results
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      const finalParts = results
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();

      if (conversational) {
        if (transcript) setQuestion(transcript);
        if (finalParts) {
          pendingConversationQuestionRef.current = finalParts;
          conversationWaitingRef.current = true;
          suppressRecognitionEndRef.current = true;
          setConversationStatus('Heard question');
          setVoiceStatus('');
          try {
            recognition.stop();
          } catch {
            // The browser may have already stopped recognition.
          }
        }
      } else if (transcript) {
        setQuestion((current) => [current.trim(), transcript].filter(Boolean).join(' '));
      }
    };
    recognition.onnomatch = () => {
      setVoiceStatus('');
      if (conversational && conversationActiveRef.current) {
        scheduleConversationRestart('Listening');
      } else {
        setError('No speech was recognized. Try again closer to the microphone.');
      }
    };
    recognition.onerror = (event) => {
      setVoiceStatus('');
      setVoiceHelpUrl(localhostVoiceUrl());
      if (conversational && event?.error === 'no-speech' && conversationActiveRef.current) {
        scheduleConversationRestart('Listening');
      } else {
        setError(voiceInputErrorMessage(event?.error));
        if (conversational) {
          setConversationActive(false);
          conversationActiveRef.current = false;
          setConversationStatus('');
        }
      }
    };
    recognition.onend = () => {
      const mode = recognitionModeRef.current;
      const pendingQuestion = pendingConversationQuestionRef.current;
      const shouldRestart = (
        mode === 'conversation' &&
        conversationActiveRef.current &&
        !suppressRecognitionEndRef.current &&
        !conversationWaitingRef.current &&
        !pendingQuestion
      );
      recognitionRef.current = null;
      recognitionModeRef.current = '';
      setVoiceStatus('');
      suppressRecognitionEndRef.current = false;
      if (mode === 'conversation' && pendingQuestion && conversationActiveRef.current) {
        pendingConversationQuestionRef.current = '';
        void submitQuestion(pendingQuestion, { resumeConversation: true, awaitPatientVoice: true });
        return;
      }
      if (shouldRestart) scheduleConversationRestart('Listening');
    };
    recognitionRef.current = recognition;
    setError('');
    setVoiceHelpUrl('');
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      recognitionModeRef.current = '';
      setVoiceStatus('');
      setVoiceHelpUrl(localhostVoiceUrl());
      setError(voiceInputErrorMessage());
      if (conversational) {
        setConversationActive(false);
        conversationActiveRef.current = false;
        setConversationStatus('');
      }
    }
  };

  const startVoiceInput = () => startSpeechRecognition({ conversational: false });

  const startConversation = () => {
    if (conversationActiveRef.current) {
      conversationActiveRef.current = false;
      setConversationActive(false);
      setConversationStatus('');
      conversationWaitingRef.current = false;
      pendingConversationQuestionRef.current = '';
      if (conversationRestartRef.current) {
        window.clearTimeout(conversationRestartRef.current);
        conversationRestartRef.current = null;
      }
      stopActiveRecognition();
      return;
    }

    setError('');
    setVoiceHelpUrl('');
    setQuestion('');
    setConversationActive(true);
    conversationActiveRef.current = true;
    conversationWaitingRef.current = false;
    pendingConversationQuestionRef.current = '';
    setConversationStatus('Ready');
    if (!patientVoiceEnabled) {
      patientVoiceEnabledRef.current = true;
      setPatientVoiceEnabled(true);
      setStoredPatientVoiceEnabled(true);
      setPatientVoiceStatus('Loading patient voice');
      void warmPatientVoice({ onStatus: setPatientVoiceStatus })
        .then(() => setPatientVoiceStatus('Patient voice ready'))
        .catch(() => setPatientVoiceStatus('Voice unavailable'));
    }
    void preparePatientVoicePlayback().catch(() => {});
    startSpeechRecognition({ conversational: true });
  };

  const setPatientVoice = (enabled) => {
    patientVoiceEnabledRef.current = enabled;
    setPatientVoiceEnabled(enabled);
    setStoredPatientVoiceEnabled(enabled);
    if (!enabled) {
      stopPatientVoice();
      setPatientVoiceStatus('');
      setSpeakingIndex(null);
    } else {
      setPatientVoiceStatus('Loading patient voice');
      void warmPatientVoice({ onStatus: setPatientVoiceStatus })
        .then(() => setPatientVoiceStatus('Patient voice ready'))
        .catch(() => setPatientVoiceStatus('Voice unavailable'));
    }
  };

  const playPatientAnswer = async (answer, index) => {
    const text = String(answer || '').trim();
    if (!text) return;
    setSpeakingIndex(index);
    setError('');
    void preparePatientVoicePlayback().catch(() => {});
    if (conversationActiveRef.current) setConversationStatus('Patient answering');
    try {
      await speakPatientAnswer(text, {
        sex: patientSex,
        onStatus: (status) => {
          setPatientVoiceStatus(status);
          if (!conversationActiveRef.current) return;
          if (status === 'Speaking') setConversationStatus('Speaking');
          else if (/loading|preparing/i.test(status)) setConversationStatus('Patient answering');
        }
      });
      setPatientVoiceStatus('Patient voice ready');
    } catch {
      setPatientVoiceStatus('Voice unavailable');
    } finally {
      setSpeakingIndex(null);
    }
  };

  const submitQuestion = async (overrideQuestion = '', options = {}) => {
    const trimmed = String(overrideQuestion || question).trim();
    if (!trimmed) {
      setError('Enter a focused triage question.');
      return;
    }

    setLoading(true);
    loadingRef.current = true;
    setLoadingMessage('Getting patient response.');
    setError('');
    setVoiceHelpUrl('');
    if (options.resumeConversation) setConversationStatus('Patient answering');
    if (patientVoiceEnabledRef.current || options.awaitPatientVoice) {
      void warmPatientVoice({ onStatus: setPatientVoiceStatus })
        .then(() => setPatientVoiceStatus('Patient voice ready'))
        .catch(() => setPatientVoiceStatus('Voice unavailable'));
      void preparePatientVoicePlayback().catch(() => {});
    }

    try {
      const data = await askPatientQuestion(sessionId, trimmed);
      const nextLog = [...logRef.current, data.response];
      logRef.current = nextLog;
      setLog(nextLog);
      setInterviewProgress(normalizeProgress(data.interview_progress || interviewProgress));
      setQuestion('');
      if (options.resumeConversation) setConversationStatus('Patient answering');
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
      if (patientVoiceEnabledRef.current || options.awaitPatientVoice) {
        const speech = playPatientAnswer(data.response?.answer, nextLog.length - 1);
        if (options.awaitPatientVoice) await speech;
        else void speech;
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Patient response could not be recorded.');
      if (options.resumeConversation) {
        setConversationActive(false);
        conversationActiveRef.current = false;
        setConversationStatus('');
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
      setLoadingMessage('');
      if (options.resumeConversation) {
        conversationWaitingRef.current = false;
        scheduleConversationRestart('Ready');
      }
    }
  };

  const continueWithGaps = async () => {
    if (!objectiveReady) {
      setError('Review objective data and conduct at least one focused exam before continuing.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await acknowledgeInterviewGaps(sessionId);
      setInterviewProgress(normalizeProgress(data.interview_progress || interviewProgress));
      if (onClock) onClock(data.clock);
      if (onCapture) {
        onCapture({
          interviewLog: logRef.current,
          interviewMode: 'assessment',
          interviewSupports: supportUses,
          interviewGapsAcknowledged: true
        });
      }
      onNext();
    } catch (err) {
      setError(err.message || 'Interview gaps could not be acknowledged.');
    } finally {
      setLoading(false);
    }
  };

  const voiceTools = (
    <div className="composer-options-row voice-tools-control">
      <label className="voice-tools-checkbox">
        <input
          type="checkbox"
          checked={patientVoiceEnabled}
          disabled={conversationActive}
          onChange={(event) => setPatientVoice(event.target.checked)}
        />
        <span>Enable patient voice audio (TTS)</span>
      </label>
      <button
        type="button"
        className={`continuous-voice-btn ${conversationActive ? 'active' : ''}`}
        onClick={startConversation}
        disabled={loading}
        aria-label={conversationActive ? 'Stop continuous voice mode' : 'Start continuous voice mode'}
      >
        <span className="continuous-voice-dot" aria-hidden="true" />
        {conversationActive ? 'Continuous Voice Active' : 'Start Continuous Voice Mode'}
      </button>
      {(patientVoiceStatus || conversationStatus) && (
        <small className="voice-tools-status">{conversationStatus || patientVoiceStatus}</small>
      )}
    </div>
  );

  return (
    <>
    {voiceToolsRoot && createPortal(voiceTools, voiceToolsRoot)}
    <section className="step-card">
      <div className="section-header">
        <div>
          <h2>Focused Triage Interview</h2>
          <p className="subtitle">Gather case history. Engage in a natural dialogue or use prompts below.</p>
        </div>
        <span className="clinical-badge">{log.length} questions asked</span>
      </div>

      <details className="interview-support-drawer learner-help-drawer">
        <summary>Help</summary>
        {supportsEnabled && interviewSupports.length > 0 && (
          <div className="suggestions-pills help-suggestions">
            {interviewSupports.map((item) => {
              const used = supportUses.some((support) => support.id === item.id);
              const queued = queuedSupportId === item.id;
              return (
                <button
                  type="button"
                  className={`suggestion-pill ${used ? 'used' : ''} ${queued ? 'active' : ''}`}
                  key={item.id}
                  onClick={() => openSupport(item)}
                  disabled={loading}
                  title={item.cue}
                >
                  {item.label} {used && '✓'}
                </button>
              );
            })}
          </div>
        )}
        <div className="interview-progress-bar-container help-progress" style={{ margin: '10px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '700', color: 'var(--muted)', marginBottom: '6px' }}>
            <span>Interview goals</span>
            <span>{coveredDomains.length} / {coveredDomains.length + stillNeededDomains.length} covered</span>
          </div>
          <div className="progress-track" style={{ height: '6px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              className="progress-fill"
              style={{
                height: '100%',
                background: 'var(--teal)',
                width: `${((coveredDomains.length) / Math.max(coveredDomains.length + stillNeededDomains.length, 1)) * 100}%`,
                transition: 'width 0.4s ease'
              }}
            />
          </div>
          {!progressComplete && (
            <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
              {canContinueWithGaps
                ? 'Required domains remain open; you may proceed by acknowledging gaps.'
                : `Ask at least ${Math.max(MINIMUM_QUESTIONS - log.length, 0)} more question${MINIMUM_QUESTIONS - log.length === 1 ? '' : 's'} to enable gap progression.`}
            </p>
          )}
        </div>
      </details>

      {/* Chat Thread Rendered Above the Composer */}
      {log.length > 0 && (
        <div className="interview-thread">
          {log.map((item, index) => (
            <div className="interview-entry" key={`${item.category}-${index}`}>
              <div className="speaker-turn learner-turn">
                <span>You</span>
                <strong>{item.question}</strong>
              </div>
              <div className="speaker-turn patient-turn">
                <span>Patient</span>
                <div className="patient-answer-row">
                  <p>{item.answer}</p>
                  <button
                    type="button"
                    className={`listen-button ${speakingIndex === index ? 'active' : ''}`}
                    onClick={() => playPatientAnswer(item.answer, index)}
                    aria-label={`Replay patient answer ${index + 1}`}
                  >
                    {speakingIndex === index ? (
                      <span aria-hidden="true" title="Speaking">🔊</span>
                    ) : (
                      <span aria-hidden="true" title="Listen">▶</span>
                    )}
                  </button>
                </div>
              </div>
              <span className="question-index">Question {index + 1}</span>
            </div>
          ))}
        </div>
      )}

      {/* Composer Input Area */}
      <div className="question-input" style={{ marginBottom: '10px' }}>
        <label htmlFor="focused-question" style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--muted)' }}>Question to patient</label>
        <div className="conversation-composer" style={{ marginTop: '4px' }}>
          <textarea
            id="focused-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a focused question..."
            rows="2"
            disabled={loading}
          />
          <button
            type="button"
            className={`voice-button ${voiceStatus ? 'active' : ''}`}
            onClick={startVoiceInput}
            disabled={loading || conversationActive}
            aria-label={voiceStatus ? 'Stop dictation' : 'Start dictation'}
            aria-pressed={Boolean(voiceStatus)}
            title={voiceStatus || 'Dictate'}
          >
            <span aria-hidden="true">🎤</span>
          </button>
        </div>
      </div>

      {objectiveReview && (
        <details
          className="encounter-objective-drawer"
          open={objectiveOpen}
          onToggle={(event) => setObjectiveOpen(event.currentTarget.open)}
        >
          <summary>Review objective data</summary>
          {React.isValidElement(objectiveReview)
            ? React.cloneElement(objectiveReview, { active: objectiveOpen, onObjectiveStatusChange: setObjectiveStatus })
            : objectiveReview}
        </details>
      )}

      {!objectiveReady && (canContinue || canContinueWithGaps) && (
        <div className="compact-guidance objective-required-note">
          Review objective data and conduct at least one focused exam to continue.
        </div>
      )}

      {error && (
        <div className="error-message" style={{ marginBottom: '16px' }}>
          {error}
          {voiceHelpUrl && (
            <a className="voice-help-link" href={voiceHelpUrl}>
              Open local voice URL
            </a>
          )}
        </div>
      )}
      {loadingMessage && <div className="loading compact-loading" style={{ marginBottom: '16px' }}>{loadingMessage}</div>}

      {/* Navigation / Action Buttons */}
      <div className="button-group" style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', marginTop: '8px' }}>
        <button className="btn-primary" onClick={() => submitQuestion()} disabled={loading || conversationActive}>
          {loading ? 'Asking patient...' : 'Ask patient'}
        </button>
        <button className="btn-secondary" onClick={onNext} disabled={continueDisabled}>
          Continue to impression
        </button>
        {canContinueWithGaps && (
          <button className="btn-secondary" onClick={continueWithGaps} disabled={continueWithGapsDisabled}>
            Continue with gaps
          </button>
        )}
      </div>
    </section>
    </>
  );
}

export default FocusedInterview;
