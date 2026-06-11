import React, { useState, useEffect, useRef } from 'react';
import './styles/App.css';
import {
  clearTutorSettings,
  clearLocalCaseBundle,
  clearLocalClinicalKnowledgeBundle,
  getCaseSourceState,
  getClinicalKnowledgeState,
  getCoachPreference,
  getTutorSettings,
  loadLocalClinicalKnowledgeBundle,
  loadLocalCaseBundle,
  prewarmSemanticCache,
  restoreLocalClinicalKnowledgeBundle,
  saveCoachPreference,
  saveTutorSettings,
  startSimulation
} from './services/api';
import EncounterPhase from './components/EncounterPhase';
import ClinicalImpressionPhase from './components/ClinicalImpressionPhase';
import InitialPlanPhase from './components/InitialPlanPhase';
import ReassessmentSoapPhase from './components/ReassessmentSoapPhase';
import Feedback from './components/Feedback';
import CaseSummaryBanner from './components/CaseSummaryBanner';
import CaseSourceControls from './components/CaseSourceControls';
import DecisionHint from './components/DecisionHint';

const WORKFLOW_PHASES = [
  {
    id: 'encounter',
    label: 'Encounter',
    title: 'Interview and examine',
    detail: 'Ask focused questions, review vitals, and reveal exam findings.'
  },
  {
    id: 'impression',
    label: 'Impression',
    title: 'Acuity, diagnosis, and referral',
    detail: 'Assign ESI, commit to a working diagnosis, and decide on specialty input.'
  },
  {
    id: 'plan',
    label: 'Plan / Consults',
    title: 'Priority actions and consults',
    detail: 'Choose first actions, diagnostic strategy, consults, and disposition intent.'
  },
  {
    id: 'reassessment',
    label: 'Reassessment',
    title: 'Course correction and SOAP note',
    detail: 'Recheck trajectory, request linked data, and document a case-specific SOAP note.'
  },
  {
    id: 'debrief',
    label: 'Debrief',
    title: 'Simulation debrief',
    detail: 'Review the highest-yield performance signal and next practice focus.'
  }
];

function getStageName(stepIndex) {
  switch (stepIndex) {
    case 0: return 'interview';
    case 1: return 'final';
    case 2: return 'escalation';
    case 3: return 'reassessment';
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
  workingDiagnosis: '',
  differential: [],
  diagnosisEvidence: '',
  referralNeeded: null,
  referralSpecialty: '',
  referralRationale: '',
  interventions: [],
  escalationActions: [],
  escalationRationale: '',
  initialPlan: {},
  reassessmentPlan: [],
  reassessmentRationale: '',
  reassessmentScenario: null,
  soapNote: null,
  handoffNote: '',
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
        {WORKFLOW_PHASES.map((item, index) => {
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
        <span className="eyebrow">ED Clinical Workflow Simulator</span>
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

function AiSettingsMenu({ settings, onSettingsChange, sourceState }) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const menuRef = useRef(null);

  const detectedProvider = apiKey.trim()
    ? (apiKey.startsWith('sk-ant-') ? 'anthropic' : apiKey.startsWith('sk-') && !apiKey.startsWith('sk-or-') ? 'openai' : 'openrouter')
    : (settings.hasKey ? (settings.key?.startsWith('sk-ant-') ? 'anthropic' : settings.key?.startsWith('sk-') && !settings.key?.startsWith('sk-or-') ? 'openai' : 'openrouter') : null);

  const providerInfo = detectedProvider ? PROVIDER_INFO[detectedProvider] : null;
  const restrictedLocalMode = sourceState?.mode === 'mimic_restricted_local';

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

  const toggleRestrictedAi = (enabled) => {
    const activeSettings = getTutorSettings();
    const next = saveTutorSettings({
      key: activeSettings.key,
      model: activeSettings.model,
      patientModel: activeSettings.patientModel,
      restrictedAiEnabled: enabled
    });
    onSettingsChange(next);
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

          {restrictedLocalMode && (
            <label className="restricted-ai-opt-in">
              <input
                type="checkbox"
                checked={Boolean(settings.restrictedAiEnabled)}
                onChange={(event) => toggleRestrictedAi(event.target.checked)}
              />
              <span>
                Allow external AI for local MIMIC cases this session. Restricted case text may be sent to your configured provider.
              </span>
            </label>
          )}

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

function DataStatusChip({ sourceState }) {
  const localMode = sourceState?.mode === 'mimic_restricted_local';
  return (
    <span className={`data-chip topbar-data-chip ${localMode ? 'restricted' : ''}`}>
      Data: {localMode ? 'Local MIMIC' : 'Public demo'}
    </span>
  );
}

function ToolsMenu({
  coachEnabled,
  onCoachChange,
  aiSettings,
  onAiSettingsChange,
  sourceState,
  knowledgeState,
  loading,
  onLoadLocalBundle,
  onUsePublicDemo,
  onLoadKnowledgeBundle,
  onClearKnowledgeBundle,
  showVoiceTools = false
}) {
  return (
    <details className="tools-menu">
      <summary>Tools</summary>
      <div className="tools-panel">
        <div className="tools-row">
          <CoachToggle enabled={coachEnabled} onChange={onCoachChange} />
        </div>
        <div className="tools-row">
          <span>AI</span>
          <AiSettingsMenu settings={aiSettings} onSettingsChange={onAiSettingsChange} sourceState={sourceState} />
        </div>
        {showVoiceTools && (
          <div className="tools-row stacked voice-tools-row">
            <span>Voice</span>
            <div id="encounter-voice-tools-root" className="voice-tools-root" />
          </div>
        )}
        <div className="tools-row stacked">
          <span>Data</span>
          <CaseSourceControls
            sourceState={sourceState}
            knowledgeState={knowledgeState}
            loading={loading}
            onLoadLocalBundle={onLoadLocalBundle}
            onUsePublicDemo={onUsePublicDemo}
            onLoadKnowledgeBundle={onLoadKnowledgeBundle}
            onClearKnowledgeBundle={onClearKnowledgeBundle}
          />
        </div>
      </div>
    </details>
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
  const [sourceState, setSourceState] = useState(() => getCaseSourceState());
  const [knowledgeState, setKnowledgeState] = useState(() => getClinicalKnowledgeState());
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
        intake: data.intake || null,
        caseSource: data.case_source,
        sourceRestriction: data.source_restriction,
        tasksAvailable: data.tasks_available || {}
      });
      setSourceState(data.source_state || getCaseSourceState());
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
    setStep((prev) => Math.min(prev + 1, WORKFLOW_PHASES.length - 1));
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

  const handleLoadLocalBundle = async (payload, fileName) => {
    setLoading(true);
    setError('');
    try {
      const nextSource = await loadLocalCaseBundle(payload, fileName);
      setSourceState(nextSource);
      setCaseRecord(INITIAL_CASE_RECORD);
      setStep(-1);
      await handleStart();
    } catch (err) {
      setError(err.message || 'Local case bundle could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const handleUsePublicDemo = async () => {
    setLoading(true);
    setError('');
    try {
      const nextSource = await clearLocalCaseBundle();
      setSourceState(nextSource);
      setCaseRecord(INITIAL_CASE_RECORD);
      setStep(-1);
      await handleStart();
    } catch (err) {
      setError(err.message || 'Could not return to public demo mode.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadKnowledgeBundle = async (payload, fileName) => {
    const nextKnowledgeState = await loadLocalClinicalKnowledgeBundle(payload, fileName);
    setKnowledgeState(nextKnowledgeState);
    return nextKnowledgeState;
  };

  const handleClearKnowledgeBundle = async () => {
    const nextKnowledgeState = await clearLocalClinicalKnowledgeBundle();
    setKnowledgeState(nextKnowledgeState);
    return nextKnowledgeState;
  };

  useEffect(() => {
    handleStart();
  }, []);

  useEffect(() => {
    let mounted = true;
    restoreLocalClinicalKnowledgeBundle()
      .then((nextKnowledgeState) => {
        if (mounted) setKnowledgeState(nextKnowledgeState);
      })
      .catch(() => {
        if (mounted) setKnowledgeState(getClinicalKnowledgeState());
      });
    return () => { mounted = false; };
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

  const activeStep = WORKFLOW_PHASES[step];
  const displayElapsed = realElapsedSeconds(clock, timerTick);

  return (
    <div className="app">
      <header className="app-topbar">
        <div>
          <h1>ED Clinical Workflow Simulator <span className="logo-pulse-dot" /></h1>
        </div>
        <div className="topbar-actions">
          <DataStatusChip sourceState={sourceState} />
          <ToolsMenu
            coachEnabled={coachEnabled}
            onCoachChange={handleCoachPreferenceChange}
            aiSettings={aiSettings}
            onAiSettingsChange={setAiSettings}
            sourceState={sourceState}
            knowledgeState={knowledgeState}
            loading={loading}
            onLoadLocalBundle={handleLoadLocalBundle}
            onUsePublicDemo={handleUsePublicDemo}
            onLoadKnowledgeBundle={handleLoadKnowledgeBundle}
            onClearKnowledgeBundle={handleClearKnowledgeBundle}
            showVoiceTools={step === 0}
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
        return (
          <div className="app-layout">
            <main className="case-stage">
              {coachEnabled && stageName && (
                <DecisionHint
                  key={`${sessionId}-${step}-${coachTrigger}`}
                  sessionId={sessionId}
                  stage={stageName}
                  active={coachEnabled}
                />
              )}

              {step === 0 && (
                <EncounterPhase
                  sessionId={sessionId}
                  patientData={patientData}
                  interviewSupports={interviewSupports}
                  initialProgress={interviewProgress}
                  coachEnabled={coachEnabled}
                  onNext={handleNext}
                  onCapture={handleCapture}
                  onClock={setClock}
                />
              )}

              {step === 1 && (
                <ClinicalImpressionPhase
                  sessionId={sessionId}
                  coachEnabled={coachEnabled}
                  onNext={handleNext}
                  onCapture={handleCapture}
                  onClock={setClock}
                />
              )}

              {step === 2 && (
                <InitialPlanPhase
                  sessionId={sessionId}
                  coachEnabled={coachEnabled}
                  onNext={handleNext}
                  onCapture={handleCapture}
                  onClock={setClock}
                />
              )}

              {step === 3 && (
                <ReassessmentSoapPhase
                  sessionId={sessionId}
                  onNext={handleNext}
                  onCapture={handleCapture}
                  onClock={setClock}
                />
              )}

              {step === 4 && (
                <Feedback
                  sessionId={sessionId}
                  caseRecord={caseRecord}
                  aiSettings={aiSettings}
                  onAiSettingsChange={setAiSettings}
                  onRestart={handleRestart}
                />
              )}
            </main>
          </div>
        );
      })()}
    </div>
  );
}

export default App;
