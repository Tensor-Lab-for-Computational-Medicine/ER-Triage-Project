import React, { useEffect, useRef, useState } from 'react';
import {
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
    required_domains: progress?.required_domains || [],
    covered_domains: progress?.covered_domains || [],
    missed_domains: progress?.missed_domains || progress?.required_domains || [],
    optional_domains: progress?.optional_domains || [],
    optional_covered_domains: progress?.optional_covered_domains || []
  };
}

function FocusedInterview({
  sessionId,
  interviewSupports = [],
  initialProgress = null,
  patientSex = '',
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
  const [interviewProgress, setInterviewProgress] = useState(() => normalizeProgress(initialProgress));
  const [error, setError] = useState('');
  const [voiceHelpUrl, setVoiceHelpUrl] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    setSupportUses([]);
    setQuestion('');
    setLog([]);
    setQueuedSupportId('');
    setLastInsertedStem('');
    setVoiceStatus('');
    setPatientVoiceStatus('');
    setSpeakingIndex(null);
    setInterviewProgress(normalizeProgress(initialProgress));
    setVoiceHelpUrl('');
    stopPatientVoice();
  }, [sessionId, initialProgress]);

  useEffect(() => () => {
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

  const supportsEnabled = interviewSupports.length > 0;
  const canContinue = log.length >= MINIMUM_QUESTIONS;
  const coveredDomains = interviewProgress.covered_domains || [];
  const stillNeededDomains = interviewProgress.missed_domains || [];
  const optionalDomains = interviewProgress.optional_domains || [];
  const optionalCoveredDomains = interviewProgress.optional_covered_domains || [];

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
    const localUrl = localhostVoiceUrl();
    if (microphoneBlockedByOrigin()) {
      setVoiceHelpUrl(localUrl);
      setError(voiceInputErrorMessage());
      return;
    }

    if (!SpeechRecognition) {
      setVoiceHelpUrl(localUrl);
      setError('Voice input is available in Chrome or Edge with microphone access.');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
      setVoiceStatus('');
      setVoiceHelpUrl('');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setVoiceStatus('Listening');
      setVoiceHelpUrl('');
      setError('');
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) {
        setQuestion((current) => [current.trim(), transcript].filter(Boolean).join(' '));
      }
    };
    recognition.onnomatch = () => {
      setVoiceStatus('');
      setError('No speech was recognized. Try again closer to the microphone.');
    };
    recognition.onerror = (event) => {
      setVoiceStatus('');
      setVoiceHelpUrl(localhostVoiceUrl());
      setError(voiceInputErrorMessage(event?.error));
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceStatus('');
    };
    recognitionRef.current = recognition;
    setError('');
    setVoiceHelpUrl('');
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setVoiceStatus('');
      setVoiceHelpUrl(localhostVoiceUrl());
      setError(voiceInputErrorMessage());
    }
  };

  const setPatientVoice = (enabled) => {
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
    try {
      await speakPatientAnswer(text, {
        sex: patientSex,
        onStatus: setPatientVoiceStatus
      });
      setPatientVoiceStatus('Patient voice ready');
    } catch {
      setPatientVoiceStatus('Voice unavailable');
    } finally {
      setSpeakingIndex(null);
    }
  };

  const submitQuestion = async () => {
    const trimmed = question.trim();
    if (!trimmed) {
      setError('Enter a focused triage question.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Getting patient response.');
    setError('');
    setVoiceHelpUrl('');
    if (patientVoiceEnabled) {
      void preparePatientVoicePlayback().catch(() => {});
    }

    try {
      const data = await askPatientQuestion(sessionId, trimmed);
      const nextLog = [...log, data.response];
      setLog(nextLog);
      setInterviewProgress(normalizeProgress(data.interview_progress || interviewProgress));
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
      if (patientVoiceEnabled) {
        void playPatientAnswer(data.response?.answer, nextLog.length - 1);
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
        <span className="clinical-badge">{log.length} questions asked</span>
      </div>

      <div className="interview-brief">
        <p className="instruction">
          Speak or type one question at a time. The patient answer appears in the transcript, and the report scores whether the interview covered the risk-changing history.
        </p>
        <div className="question-progress-panel interview-progress-panel" aria-label="Interview coverage">
          <div>
            <span>Interview coverage</span>
            <strong>{coveredDomains.length} / {Math.max((coveredDomains.length + stillNeededDomains.length), 1)} required</strong>
          </div>
          <div className="coverage-block">
            <span>Covered</span>
            <div className="coverage-chip-row">
              {coveredDomains.length
                ? coveredDomains.map((domain) => <em className="coverage-chip covered" key={domain}>{domain}</em>)
                : <em className="coverage-chip muted">None yet</em>}
            </div>
          </div>
          <div className="coverage-block">
            <span>Still needed</span>
            <div className="coverage-chip-row">
              {stillNeededDomains.length
                ? stillNeededDomains.map((domain) => <em className="coverage-chip needed" key={domain}>{domain}</em>)
                : <em className="coverage-chip covered">Core domains covered</em>}
            </div>
          </div>
          <div className="coverage-block optional">
            <span>Optional</span>
            <div className="coverage-chip-row">
              {[...optionalCoveredDomains, ...optionalDomains].slice(0, 4).map((domain) => (
                <em
                  className={`coverage-chip ${optionalCoveredDomains.includes(domain) ? 'covered' : 'optional'}`}
                  key={domain}
                >
                  {domain}
                </em>
              ))}
            </div>
          </div>
          <small>
            {canContinue
              ? 'Minimum interview complete'
              : `${Math.max(MINIMUM_QUESTIONS - log.length, 0)} more question${MINIMUM_QUESTIONS - log.length === 1 ? '' : 's'} needed to continue`}
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
                  disabled={loading}
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

      <div className="patient-voice-control">
        <label>
          <input
            type="checkbox"
            checked={patientVoiceEnabled}
            onChange={(event) => setPatientVoice(event.target.checked)}
          />
          <span>Patient voice</span>
        </label>
        <small>{patientVoiceStatus || 'Reads patient answers aloud when enabled.'}</small>
      </div>

      <div className="question-input">
        <label htmlFor="focused-question">Question to patient</label>
        <div className="conversation-composer">
          <textarea
            id="focused-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask one focused question."
            rows="3"
            disabled={loading}
          />
          <button
            type="button"
            className={`voice-button ${voiceStatus ? 'active' : ''}`}
            onClick={startVoiceInput}
            disabled={loading}
            aria-pressed={Boolean(voiceStatus)}
          >
            {voiceStatus || 'Voice input'}
          </button>
        </div>
        <small className="field-hint">
          Keep each entry to one question so the debrief can score concept coverage accurately.
        </small>
      </div>

      {error && (
        <div className="error-message">
          {error}
          {voiceHelpUrl && (
            <a className="voice-help-link" href={voiceHelpUrl}>
              Open local voice URL
            </a>
          )}
        </div>
      )}
      {loadingMessage && <div className="loading compact-loading">{loadingMessage}</div>}

      <div className="button-group">
        <button className="btn-primary" onClick={submitQuestion} disabled={loading}>
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
              <div className="patient-answer-row">
                <p>{item.answer}</p>
                <button
                  type="button"
                  className={`listen-button ${speakingIndex === index ? 'active' : ''}`}
                  onClick={() => playPatientAnswer(item.answer, index)}
                  aria-label={`Replay patient answer ${index + 1}`}
                >
                  {speakingIndex === index ? 'Speaking' : 'Listen'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default FocusedInterview;
