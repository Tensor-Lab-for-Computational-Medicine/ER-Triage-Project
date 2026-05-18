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

const WORKFLOW_STEPS = [
  {
    id: 'interview',
    label: 'Conversation',
    title: 'Patient conversation',
    detail: 'Gather the history that changes risk, acuity, or next actions.'
  },
  {
    id: 'provisional',
    label: 'First ESI',
    title: 'Initial acuity call',
    detail: 'State the working ESI level before the complete objective review.'
  },
  {
    id: 'vitals',
    label: 'Vitals',
    title: 'Baseline vitals',
    detail: 'Interpret objective triage signals and reassess urgency.'
  },
  {
    id: 'esi',
    label: 'Final ESI',
    title: 'Final acuity decision',
    detail: 'Lock the Emergency Severity Index level with rationale.'
  },
  {
    id: 'orders',
    label: 'Priorities',
    title: 'Care priorities',
    detail: 'Choose placement, monitoring, and escalation actions.'
  },
  {
    id: 'handoff',
    label: 'SBAR',
    title: 'Handoff',
    detail: 'Communicate the case in a concise ED handoff.'
  },
  {
    id: 'debrief',
    label: 'Report',
    title: 'Performance report',
    detail: 'Review clinical judgment, safety decisions, and next practice steps.'
  }
];

const INITIAL_CASE_RECORD = {
  chiefQuestion: '',
  chiefResponse: '',
  interviewLog: [],
  interviewMode: 'assessment',
  interviewSupports: [],
  vitals: [],
  historyQuestion: '',
  historyResponse: '',
  provisionalTriageLevel: null,
  provisionalTriageRationale: '',
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

function WorkflowStrip({ currentStep }) {
  const active = WORKFLOW_STEPS[currentStep] || WORKFLOW_STEPS[0];

  return (
    <nav className="workflow-strip" aria-label="Case workflow">
      <div className="workflow-current">
        <span className="workflow-strip-status">Step {currentStep + 1} of {WORKFLOW_STEPS.length}</span>
        <strong>{active.title}</strong>
      </div>
      <ol className="workflow-list">
        {WORKFLOW_STEPS.map((item, index) => {
          const status =
            index < currentStep ? 'complete' : index === currentStep ? 'active' : 'pending';

          return (
            <li
              key={item.id}
              className={`workflow-item ${status}`}
              aria-label={`${item.label}: ${status}`}
            >
              <span className="workflow-index" aria-hidden="true">{index + 1}</span>
              <span className="workflow-label">{item.label}</span>
            </li>
          );
        })}
      </ol>
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

function AiSettingsMenu({ settings, onSettingsChange }) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const menuRef = useRef(null);

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

  const saveSettings = () => {
    setMessage('');
    setError('');

    try {
      const activeSettings = getTutorSettings();
      const next = saveTutorSettings({
        key: apiKey || activeSettings.key,
        model: activeSettings.model
      });
      setApiKey('');
      onSettingsChange(next);
      setMessage('AI responses enabled.');
      setOpen(false);
    } catch (err) {
      setError('AI settings could not be saved.');
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
        <span>{settings.hasKey ? 'AI on' : 'Local'}</span>
        <strong>Settings</strong>
      </button>

      {open && (
        <div className="ai-menu-panel">
          <div className="section-header compact">
            <div>
              <span className="eyebrow">Optional AI</span>
              <h3>AI settings</h3>
            </div>
            <span className="clinical-badge">{settings.hasKey ? 'Enabled' : 'Off'}</span>
          </div>

          <div className="question-input compact-input">
            <label htmlFor="global-openrouter-key">API key</label>
            <input
              id="global-openrouter-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={settings.hasKey ? 'Key saved in this browser' : 'sk-or-v1-...'}
              autoComplete="off"
            />
          </div>

          <div className="button-group">
            <button type="button" className="btn-primary" onClick={saveSettings}>
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={clearSettings}>
              Clear
            </button>
          </div>

          {message && <div className="success-message compact-message">{message}</div>}
          {error && <div className="error-message compact-message">{error}</div>}
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

  const handleCapture = (patch) => {
    setCaseRecord((prev) => ({ ...prev, ...patch }));
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
          <h1>ED Triage Trainer</h1>
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
      <WorkflowStrip currentStep={step} />

      <div className="app-layout">
        <main className="case-stage">
          {step === 0 && (
            <FocusedInterview
              sessionId={sessionId}
              interviewSupports={interviewSupports}
              initialProgress={interviewProgress}
              patientSex={patientData?.sex}
              onNext={handleNext}
              onCapture={handleCapture}
              onClock={setClock}
            />
          )}

          {step === 1 && (
            <TriageAssignment
              sessionId={sessionId}
              variant="provisional"
              coachEnabled={coachEnabled}
              onNext={handleNext}
              onCapture={handleCapture}
              onClock={setClock}
            />
          )}

          {step === 2 && (
            <VitalSigns
              sessionId={sessionId}
              onNext={handleNext}
              onCapture={handleCapture}
              onClock={setClock}
            />
          )}

          {step === 3 && (
            <TriageAssignment
              sessionId={sessionId}
              coachEnabled={coachEnabled}
              onNext={handleNext}
              onCapture={handleCapture}
              onClock={setClock}
            />
          )}

          {step === 4 && (
            <Interventions
              sessionId={sessionId}
              coachEnabled={coachEnabled}
              onNext={handleNext}
              onCapture={handleCapture}
              onClock={setClock}
            />
          )}

          {step === 5 && (
            <SbarHandoff
              sessionId={sessionId}
              coachEnabled={coachEnabled}
              onNext={handleNext}
              onCapture={handleCapture}
              onClock={setClock}
            />
          )}

          {step === 6 && (
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
    </div>
  );
}

export default App;
