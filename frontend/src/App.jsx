import React, { useState, useEffect, useRef } from 'react';
import './styles/App.css';
import {
  clearTutorSettings,
  getCoachPreference,
  getTutorSettings,
  prewarmSemanticCache,
  saveCoachPreference,
  saveTutorSettings,
  startSimulation
} from './services/api';
import FocusedInterview from './components/FocusedInterview';
import VitalSigns from './components/VitalSigns';
import TriageAssignment from './components/TriageAssignment';
import Interventions from './components/Interventions';
import SbarHandoff from './components/SbarHandoff';
import Feedback from './components/Feedback';
import CaseSummaryBanner from './components/CaseSummaryBanner';
import DecisionHint from './components/DecisionHint';

const WORKFLOW_STEPS = [
  {
    id: 'gather',
    label: 'Gather',
    title: 'Patient conversation',
    detail: 'Gather the history that changes risk, acuity, or next actions.'
  },
  {
    id: 'examine',
    label: 'Examine',
    title: 'Examine & vitals review',
    detail: 'Interpret objective vitals and focused physical exam findings.'
  },
  {
    id: 'decide',
    label: 'Decide',
    title: 'Definitive ESI assignment',
    detail: 'Lock the Emergency Severity Index level with required clinical rationale.'
  },
  {
    id: 'act',
    label: 'Act',
    title: 'Care priorities & orders',
    detail: 'Group placement, monitoring, and treatment actions by clinical intent.'
  },
  {
    id: 'handoff',
    label: 'Handoff',
    title: 'SBAR handoff',
    detail: 'Communicate the case in a concise, structured ED handoff.'
  },
  {
    id: 'learn',
    label: 'Learn',
    title: 'Expert debrief & report',
    detail: 'Review clinical judgment, decision drivers, and next practice steps.'
  }
];

function getStageName(stepIndex) {
  switch (stepIndex) {
    case 0: return 'interview';
    case 1: return 'provisional';
    case 2: return 'final';
    case 3: return 'escalation';
    case 4: return 'sbar';
    default: return null;
  }
}

const INITIAL_CASE_RECORD = {
  chiefQuestion: '',
  chiefResponse: '',
  interviewLog: [],
  interviewMode: 'assessment',
  interviewSupports: [],
  vitals: [],
  historyQuestion: '',
  historyResponse: '',
  triageLevel: null,
  triageRationale: '',
  interventions: [],
  escalationActions: [],
  escalationRationale: '',
  sbarHandoff: ''
};

function realElapsedSeconds(clock = {}, _tick = 0) {
  if (clock.started_at_ms && !clock.completed_at_ms) {
    return Math.max(clock.elapsed_seconds || 0, Math.floor((Date.now() - clock.started_at_ms) / 1000));
  }
  return clock.elapsed_seconds || 0;
}

function ReasoningSpine({ currentStep }) {
  return (
    <nav className="reasoning-spine" aria-label="Clinical reasoning spine">
      <div className="spine-container">
        {WORKFLOW_STEPS.map((item, index) => {
          const isComplete = index < currentStep;
          const isActive = index === currentStep;
          const icon = isComplete ? '✓' : isActive ? '●' : '○';
          return (
            <div key={item.id} className={`spine-item ${isComplete ? 'complete' : ''} ${isActive ? 'active' : ''}`}>
              <span className="spine-icon" aria-hidden="true">{icon}</span>
              <span className="spine-label">{item.label}</span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function LoadingScreen() {
  return (
    <div className="app app-centered">
      <div className="status-panel">
        <span className="eyebrow">ED Triage Trainer</span>
        <h1>Preparing a case</h1>
        <div className="loading-bar">
          <span />
        </div>
        <p>Loading the next case and simulation state.</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error, onRetry }) {
  return (
    <div className="app app-centered">
      <div className="status-panel error-panel">
        <span className="eyebrow">Connection check</span>
        <h1>Case could not start</h1>
        <p>{error}</p>
        <button className="btn-primary" onClick={onRetry}>
          Retry case load
        </button>
      </div>
    </div>
  );
}

const PROVIDER_INFO = {
  openrouter: {
    name: 'OpenRouter',
    color: '#7c3aed',
    badge: 'OR',
    hint: 'Starts with sk-or-...',
    placeholder: 'sk-or-v1-...',
    freeUrl: 'https://openrouter.ai/keys',
    freeLabel: 'Get a free key at openrouter.ai',
    freeNote: 'Free tier available — no credit card required'
  },
  openai: {
    name: 'OpenAI',
    color: '#16a34a',
    badge: 'OAI',
    hint: 'Starts with sk-...',
    placeholder: 'sk-...',
    freeUrl: 'https://platform.openai.com/api-keys',
    freeLabel: 'Get a key at platform.openai.com',
    freeNote: 'Pay-as-you-go, starts at ~$5'
  },
  anthropic: {
    name: 'Anthropic / Claude',
    color: '#d97706',
    badge: 'CL',
    hint: 'Starts with sk-ant-...',
    placeholder: 'sk-ant-...',
    freeUrl: 'https://console.anthropic.com/keys',
    freeLabel: 'Get a key at console.anthropic.com',
    freeNote: 'Free trial credits available'
  }
};

function AiSettingsMenu({ settings, onSettingsChange }) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const menuRef = useRef(null);

  const detectedProvider = apiKey.trim()
    ? (apiKey.startsWith('sk-ant-') ? 'anthropic' : apiKey.startsWith('sk-') && !apiKey.startsWith('sk-or-') ? 'openai' : 'openrouter')
    : (settings.hasKey ? (settings.key?.startsWith('sk-ant-') ? 'anthropic' : settings.key?.startsWith('sk-') && !settings.key?.startsWith('sk-or-') ? 'openai' : 'openrouter') : null);

  const providerInfo = detectedProvider ? PROVIDER_INFO[detectedProvider] : null;

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  // Auto-load dev default key on first open if no key saved
  useEffect(() => {
    if (open && !settings.hasKey && import.meta.env.VITE_DEFAULT_API_KEY) {
      const devKey = import.meta.env.VITE_DEFAULT_API_KEY;
      try {
        const next = saveTutorSettings({ key: devKey, model: getTutorSettings().model });
        onSettingsChange(next);
        setMessage('Dev key auto-loaded.');
      } catch {}
    }
  }, [open]);

  const saveSettings = () => {
    setMessage('');
    setError('');
    try {
      const activeSettings = getTutorSettings();
      const next = saveTutorSettings({
        key: apiKey.trim() || activeSettings.key,
        model: activeSettings.model
      });
      setApiKey('');
      onSettingsChange(next);
      setMessage(`AI enabled via ${providerInfo?.name || 'AI provider'}.`);
      setOpen(false);
    } catch (err) {
      setError(err.message || 'AI settings could not be saved.');
    }
  };

  const clearSettings = () => {
    const next = clearTutorSettings();
    setApiKey('');
    setMessage('AI key cleared.');
    setError('');
    onSettingsChange(next);
    setOpen(false);
  };

  return (
    <div className="ai-menu" ref={menuRef}>
      <button
        type="button"
        className="ai-menu-trigger"
        aria-label="AI settings"
        onClick={() => setOpen((value) => !value)}
      >
        {settings.hasKey && providerInfo && (
          <span
            style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', background: providerInfo.color, color: '#fff', marginRight: '4px' }}
          >
            {providerInfo.badge}
          </span>
        )}
        <span>{settings.hasKey ? 'AI on' : 'Local'}</span>
        <strong>Settings</strong>
      </button>

      {open && (
        <div className="ai-menu-panel" style={{ width: '340px' }}>
          <div className="section-header compact">
            <div>
              <span className="eyebrow">Optional AI Enhancement</span>
              <h3 style={{ margin: '2px 0 0' }}>AI Settings</h3>
            </div>
            <span className="clinical-badge" style={settings.hasKey && providerInfo ? { background: providerInfo.color, color: '#fff' } : {}}>
              {settings.hasKey ? (providerInfo?.name || 'Enabled') : 'Off'}
            </span>
          </div>

          {/* Provider detection badge */}
          {apiKey.trim() && providerInfo && (
            <div style={{ margin: '8px 0', padding: '6px 10px', background: providerInfo.color + '18', border: `1px solid ${providerInfo.color}55`, borderRadius: '6px', fontSize: '0.82rem', color: providerInfo.color, fontWeight: '600' }}>
              ✓ Detected: {providerInfo.name} key
            </div>
          )}

          <div className="question-input compact-input">
            <label htmlFor="global-api-key" style={{ fontSize: '0.85rem', color: '#475569' }}>
              API Key &mdash; OpenRouter, OpenAI, or Anthropic
            </label>
            <input
              id="global-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={settings.hasKey ? `${providerInfo?.name || 'Key'} saved in browser` : 'Paste any AI provider key...'}
              autoComplete="off"
              onKeyDown={(e) => e.key === 'Enter' && saveSettings()}
            />
          </div>

          <div className="button-group">
            <button type="button" className="btn-primary" onClick={saveSettings} disabled={!apiKey.trim() && !settings.hasKey}>
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={clearSettings} disabled={!settings.hasKey}>
              Clear
            </button>
          </div>

          {message && <div className="success-message compact-message">{message}</div>}
          {error && <div className="error-message compact-message">{error}</div>}

          {/* Free key instructions */}
          <div style={{ marginTop: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
            <p style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '600', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Get a free API key</p>
            {Object.entries(PROVIDER_INFO).map(([key, info]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', background: info.color, color: '#fff', flexShrink: 0 }}>{info.badge}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={info.freeUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem', color: info.color, textDecoration: 'none', fontWeight: '600', display: 'block' }}>
                    {info.name} →
                  </a>
                  <span style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block' }}>{info.freeNote}</span>
                </div>
              </div>
            ))}
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '8px 0 0' }}>
              Your key is saved only in your browser and never sent to our servers.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CoachToggle({ enabled, onChange }) {
  return (
    <label className="coach-toggle">
      <input
        type="checkbox"
        role="switch"
        checked={enabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-label="Coach"
      />
      <span className="coach-toggle-track" />
      <span>Coach</span>
      <strong>{enabled ? 'On' : 'Off'}</strong>
    </label>
  );
}

function App() {
  const [step, setStep] = useState(-1);
  const [sessionId, setSessionId] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [interviewSupports, setInterviewSupports] = useState([]);
  const [interviewProgress, setInterviewProgress] = useState(null);
  const [clock, setClock] = useState({ elapsed_seconds: 0, timing_events: {} });
  const [timerTick, setTimerTick] = useState(0);
  const [caseRecord, setCaseRecord] = useState(INITIAL_CASE_RECORD);
  const [aiSettings, setAiSettings] = useState(() => getTutorSettings());
  const [coachPreference, setCoachPreference] = useState(() => getCoachPreference());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const coachEnabled = Boolean(coachPreference.enabled);

  const handleStart = async () => {
    setLoading(true);
    setError('');
    setCaseRecord(INITIAL_CASE_RECORD);

    try {
      const data = await startSimulation();
      setSessionId(data.session_id);
      setPatientData({
        age: data.age,
        sex: data.sex,
        transport: data.transport,
        complaint: data.complaint,
        intake: data.intake || null
      });
      setInterviewSupports(data.interview_supports || []);
      setInterviewProgress(data.interview_progress || null);
      setClock(data.clock || { elapsed_seconds: 0, timing_events: {} });
      setTimerTick(0);
      setStep(0);
    } catch (err) {
      setError('Failed to start the simulation. Refresh the page and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setStep((prev) => Math.min(prev + 1, WORKFLOW_STEPS.length - 1));
  };

  const [coachTrigger, setCoachTrigger] = useState(0);

  const handleCapture = (patch) => {
    setCaseRecord((prev) => ({ ...prev, ...patch }));
    setCoachTrigger((prev) => prev + 1);
  };

  const handleCoachPreferenceChange = (enabled) => {
    setCoachPreference(saveCoachPreference({ enabled }));
  };

  const handleRestart = async () => {
    setStep(-1);
    setSessionId(null);
    setPatientData(null);
    setInterviewSupports([]);
    setInterviewProgress(null);
    setClock({ elapsed_seconds: 0, timing_events: {} });
    setTimerTick(0);
    setError('');
    await handleStart();
  };

  useEffect(() => {
    handleStart();
  }, []);

  useEffect(() => {
    if (!clock.started_at_ms || clock.completed_at_ms) return undefined;
    const intervalId = window.setInterval(() => {
      setTimerTick((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [clock.started_at_ms, clock.completed_at_ms]);

  useEffect(() => {
    if (!aiSettings.hasKey) {
      return undefined;
    }

    let cancelled = false;
    const runPrewarm = async () => {
      if (cancelled) return;
      try {
        await prewarmSemanticCache();
      } catch {
        // The case remains fully usable if the local similarity cache is unavailable.
      }
    };

    const idleId = window.requestIdleCallback
      ? window.requestIdleCallback(runPrewarm, { timeout: 2000 })
      : window.setTimeout(runPrewarm, 800);

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback && typeof idleId === 'number') {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, [aiSettings.hasKey, aiSettings.model]);

  if (loading || step === -1) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={handleStart} />;
  }

  const activeStep = WORKFLOW_STEPS[step];
  const displayElapsed = realElapsedSeconds(clock, timerTick);

  return (
    <div className="app">
      <header className="app-topbar">
        <div>
          <span className="eyebrow">Emergency medicine education</span>
          <h1>ED Triage Trainer <span className="logo-pulse-dot" /></h1>
        </div>
        <div className="topbar-actions">
          <CoachToggle
            enabled={coachEnabled}
            onChange={handleCoachPreferenceChange}
          />
          <AiSettingsMenu
            settings={aiSettings}
            onSettingsChange={setAiSettings}
          />
        </div>
      </header>

      <CaseSummaryBanner
        patientData={patientData}
        caseRecord={caseRecord}
        activeStep={activeStep}
        elapsedSeconds={displayElapsed}
      />
      <ReasoningSpine currentStep={step} />

      {(() => {
        const stageName = getStageName(step);
        const showSidebar = coachEnabled && stageName;
        return (
          <div className={`app-layout ${showSidebar ? 'with-coach' : ''}`}>
            <main className="case-stage">
              {step === 0 && (
                <FocusedInterview
                  sessionId={sessionId}
                  interviewSupports={interviewSupports}
                  initialProgress={interviewProgress}
                  patientSex={patientData?.sex}
                  coachEnabled={coachEnabled}
                  onNext={handleNext}
                  onCapture={handleCapture}
                  onClock={setClock}
                />
              )}

              {step === 1 && (
                <VitalSigns
                  sessionId={sessionId}
                  patientData={patientData}
                  coachEnabled={coachEnabled}
                  onNext={handleNext}
                  onCapture={handleCapture}
                  onClock={setClock}
                />
              )}

              {step === 2 && (
                <TriageAssignment
                  sessionId={sessionId}
                  coachEnabled={coachEnabled}
                  onNext={handleNext}
                  onCapture={handleCapture}
                  onClock={setClock}
                />
              )}

              {step === 3 && (
                <Interventions
                  sessionId={sessionId}
                  coachEnabled={coachEnabled}
                  onNext={handleNext}
                  onCapture={handleCapture}
                  onClock={setClock}
                />
              )}

              {step === 4 && (
                <SbarHandoff
                  sessionId={sessionId}
                  coachEnabled={coachEnabled}
                  onNext={handleNext}
                  onCapture={handleCapture}
                  onClock={setClock}
                />
              )}

              {step === 5 && (
                <Feedback
                  sessionId={sessionId}
                  caseRecord={caseRecord}
                  aiSettings={aiSettings}
                  onAiSettingsChange={setAiSettings}
                  onRestart={handleRestart}
                />
              )}
            </main>

            {showSidebar && (
              <aside className="coach-sidebar">
                <div className="coach-card">
                  <div className="coach-card-header">
                    <span className="coach-status-dot"></span>
                    <h3>Clinical Coach</h3>
                  </div>
                  <DecisionHint
                    key={`${sessionId}-${step}-${coachTrigger}`}
                    sessionId={sessionId}
                    stage={stageName}
                    active={coachEnabled}
                  />
                </div>
              </aside>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default App;
