import React, { useState, useEffect, useRef } from 'react';
import './styles/App.css';
import {
  clearTutorSettings,
  getTutorSettings,
  prewarmSemanticCache,
  saveTutorSettings,
  startSimulation
} from './services/api';
import PatientInfo from './components/PatientInfo';
import FocusedInterview from './components/FocusedInterview';
import VitalSigns from './components/VitalSigns';
import TriageAssignment from './components/TriageAssignment';
import Interventions from './components/Interventions';
import SbarHandoff from './components/SbarHandoff';
import Feedback from './components/Feedback';

const WORKFLOW_STEPS = [
  {
    id: 'arrival',
    label: 'First look',
    title: 'Arrival safety screen',
    detail: 'Separate stable presentations from immediate threats.'
  },
  {
    id: 'interview',
    label: 'Interview',
    title: 'Focused interview',
    detail: 'Use a focused question budget for risk-changing information.'
  },
  {
    id: 'provisional',
    label: 'Early ESI',
    title: 'Provisional acuity',
    detail: 'Make an early ESI estimate before complete objective review.'
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
    label: 'Escalate',
    title: 'Triage escalation',
    detail: 'Choose placement, protocol, monitoring, and safety actions.'
  },
  {
    id: 'handoff',
    label: 'SBAR',
    title: 'Handoff',
    detail: 'Communicate the case in a concise ED handoff.'
  },
  {
    id: 'debrief',
    label: 'Debrief',
    title: 'Data-grounded debrief',
    detail: 'Review decisions against MIETIC data and deterministic scoring.'
  }
];

const INITIAL_CASE_RECORD = {
  firstLookDecision: '',
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

function formatClock(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function WorkflowRail({ currentStep }) {
  return (
    <aside className="workflow-rail" aria-label="Case workflow">
      <div className="rail-header">
        <span className="eyebrow">Case pathway</span>
        <strong>{WORKFLOW_STEPS.length} stage simulation</strong>
      </div>
      <ol className="workflow-list">
        {WORKFLOW_STEPS.map((item, index) => {
          const status =
            index < currentStep ? 'complete' : index === currentStep ? 'active' : 'pending';

          return (
            <li key={item.id} className={`workflow-item ${status}`}>
              <span className="workflow-index">{index + 1}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.title}</small>
                {status === 'active' && <em>{item.detail}</em>}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function CaseChart({ patientData, caseRecord, activeStep }) {
  const triageLabel = caseRecord.triageLevel
    ? `ESI ${caseRecord.triageLevel}`
    : 'Pending';
  const modeLabels = {
    assessment: 'Assessment',
    intermediate: 'Practice',
    beginner: 'Guided'
  };
  const activeMode = modeLabels[caseRecord.interviewMode] || 'Assessment';

  return (
    <aside className="case-chart" aria-label="Current case chart">
      <div className="chart-card patient-identity">
        <span className="eyebrow">Arrival record</span>
        <h2>{patientData ? `${patientData.age} year old ${patientData.sex}` : 'Loading case'}</h2>
        <p className="chart-note">{patientData?.complaint || 'Chief concern pending'}</p>
        <div className="chart-row">
          <span>Transport</span>
          <strong>{patientData?.transport || 'Pending'}</strong>
        </div>
        <div className="chart-row">
          <span>Case source</span>
          <strong>MIETIC validation sample</strong>
        </div>
      </div>

      <div className="chart-card">
        <span className="eyebrow">Case worksheet</span>
        <div className="chart-row">
          <span>Current stage</span>
          <strong>{activeStep?.label || 'Pending'}</strong>
        </div>
        <div className="chart-row">
          <span>First look</span>
          <strong>{caseRecord.firstLookDecision ? 'Recorded' : 'Pending'}</strong>
        </div>
        <div className="chart-row">
          <span>Interview mode</span>
          <strong>{activeMode}</strong>
        </div>
        <div className="chart-row">
          <span>Chief concern</span>
          <strong>{caseRecord.chiefResponse ? 'Captured' : 'Pending'}</strong>
        </div>
        <div className="chart-row">
          <span>Questions used</span>
          <strong>{caseRecord.interviewLog.length || 'Pending'}</strong>
        </div>
        <div className="chart-row">
          <span>Vitals measured</span>
          <strong>{caseRecord.vitals.length ? caseRecord.vitals.length : 'Pending'}</strong>
        </div>
        <div className="chart-row">
          <span>Focused history</span>
          <strong>{caseRecord.historyResponse ? 'Captured' : 'Pending'}</strong>
        </div>
        <div className="chart-row">
          <span>Supports used</span>
          <strong>{caseRecord.interviewSupports.length || 'None'}</strong>
        </div>
        <div className="chart-row">
          <span>Acuity level</span>
          <strong>{triageLabel}</strong>
        </div>
        <div className="chart-row">
          <span>Provisional ESI</span>
          <strong>{caseRecord.provisionalTriageLevel ? `ESI ${caseRecord.provisionalTriageLevel}` : 'Pending'}</strong>
        </div>
        <div className="chart-row">
          <span>Escalation actions</span>
          <strong>{caseRecord.interventions.length || 'None yet'}</strong>
        </div>
        <div className="chart-row">
          <span>Escalation rationale</span>
          <strong>{caseRecord.escalationRationale ? 'Recorded' : 'Pending'}</strong>
        </div>
        <div className="chart-row">
          <span>SBAR</span>
          <strong>{caseRecord.sbarHandoff ? 'Recorded' : 'Pending'}</strong>
        </div>
      </div>

      <div className="chart-card reference-card">
        <span className="eyebrow">ESI anchors</span>
        <ul>
          <li>Life-saving intervention needed: ESI 1</li>
          <li>High risk, confusion, lethargy, or severe distress: ESI 2</li>
          <li>Stable but likely multiple resources: ESI 3</li>
          <li>One resource: ESI 4</li>
          <li>No resources: ESI 5</li>
        </ul>
      </div>
    </aside>
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

function AiSettingsMenu({ settings, onSettingsChange, semanticStatus }) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(settings.model);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    setModel(settings.model);
  }, [settings]);

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
        model
      });
      setApiKey('');
      onSettingsChange(next);
      setMessage('AI responses enabled for this browser.');
      setOpen(false);
    } catch (err) {
      setError(err.message || 'OpenRouter settings could not be saved.');
    }
  };

  const clearSettings = () => {
    const next = clearTutorSettings();
    setApiKey('');
    setMessage('AI key cleared from this browser.');
    setError('');
    onSettingsChange(next);
    setOpen(false);
  };

  return (
    <div className="ai-menu" ref={menuRef}>
      <button type="button" className="ai-menu-trigger" onClick={() => setOpen((value) => !value)}>
        <span>{settings.hasKey ? 'AI enabled' : 'Local mode'}</span>
        <strong>AI settings</strong>
        {semanticStatus && <small>{semanticStatus}</small>}
      </button>

      {open && (
        <div className="ai-menu-panel">
          <div className="section-header compact">
            <div>
              <span className="eyebrow">OpenRouter</span>
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

          <div className="question-input compact-input">
            <label htmlFor="global-openrouter-model">Model</label>
            <input
              id="global-openrouter-model"
              type="text"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="openrouter/free"
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

          <div className="source-card">
            <span>{settings.hasKey ? 'OpenRouter ready' : 'Static mode'}</span>
            <strong>{settings.model}</strong>
            <small>
              Keys are cached on this device until cleared. Repeated patient question intents are cached before any API call.
            </small>
            {semanticStatus && <small>{semanticStatus}</small>}
          </div>

          {message && <div className="success-message compact-message">{message}</div>}
          {error && <div className="error-message compact-message">{error}</div>}
        </div>
      )}
    </div>
  );
}

function App() {
  const [step, setStep] = useState(-1);
  const [sessionId, setSessionId] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [firstLook, setFirstLook] = useState(null);
  const [interviewModes, setInterviewModes] = useState([]);
  const [interviewSupports, setInterviewSupports] = useState([]);
  const [maxQuestions, setMaxQuestions] = useState(4);
  const [clock, setClock] = useState({ elapsed_seconds: 0, timing_events: {} });
  const [caseRecord, setCaseRecord] = useState(INITIAL_CASE_RECORD);
  const [aiSettings, setAiSettings] = useState(() => getTutorSettings());
  const [semanticStatus, setSemanticStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        complaint: data.complaint
      });
      setFirstLook(data.first_look);
      setInterviewModes(data.interview_modes || []);
      setInterviewSupports(data.interview_supports || []);
      setMaxQuestions(data.max_questions || 4);
      setClock(data.clock || { elapsed_seconds: 0, timing_events: {} });
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

  const handleRestart = async () => {
    setStep(-1);
    setSessionId(null);
    setPatientData(null);
    setFirstLook(null);
    setInterviewModes([]);
    setInterviewSupports([]);
    setClock({ elapsed_seconds: 0, timing_events: {} });
    setError('');
    await handleStart();
  };

  useEffect(() => {
    handleStart();
  }, []);

  useEffect(() => {
    if (!aiSettings.hasKey) {
      setSemanticStatus('Static scoring');
      return undefined;
    }

    let cancelled = false;
    const runPrewarm = async () => {
      if (cancelled) return;
      setSemanticStatus('Preparing cache');
      try {
        await prewarmSemanticCache();
        if (!cancelled) setSemanticStatus('Semantic cache ready');
      } catch {
        if (!cancelled) setSemanticStatus('Semantic cache unavailable');
      }
    };

    setSemanticStatus('Cache queued');
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
  const progressPercent = Math.round(((step + 1) / WORKFLOW_STEPS.length) * 100);

  return (
    <div className="app">
      <header className="app-topbar">
        <div>
          <span className="eyebrow">Emergency medicine education</span>
          <h1>ED Triage Trainer</h1>
        </div>
        <div className="case-meta">
          <span>Case clock</span>
          <strong>{formatClock(clock.elapsed_seconds)}</strong>
          <small>{sessionId ? sessionId.slice(0, 8).toUpperCase() : 'Pending'}</small>
        </div>
        <AiSettingsMenu
          settings={aiSettings}
          onSettingsChange={setAiSettings}
          semanticStatus={semanticStatus}
        />
      </header>

      <div className="progress-track" aria-label="Workflow progress">
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="app-layout">
        <WorkflowRail currentStep={step} />

        <main className="case-stage">
          <div className="stage-context">
            <span className="eyebrow">
              Step {step + 1} of {WORKFLOW_STEPS.length}
            </span>
            <h2>{activeStep.title}</h2>
            <p>{activeStep.detail}</p>
          </div>

          {step === 0 && (
            <PatientInfo
              sessionId={sessionId}
              patientData={patientData}
              firstLook={firstLook}
              onNext={handleNext}
              onCapture={handleCapture}
              onClock={setClock}
            />
          )}

          {step === 1 && (
            <FocusedInterview
              sessionId={sessionId}
              interviewModes={interviewModes}
              interviewSupports={interviewSupports}
              maxQuestions={maxQuestions}
              onNext={handleNext}
              onCapture={handleCapture}
              onClock={setClock}
            />
          )}

          {step === 2 && (
            <TriageAssignment
              sessionId={sessionId}
              variant="provisional"
              onNext={handleNext}
              onCapture={handleCapture}
              onClock={setClock}
            />
          )}

          {step === 3 && (
            <VitalSigns
              sessionId={sessionId}
              onNext={handleNext}
              onCapture={handleCapture}
              onClock={setClock}
            />
          )}

          {step === 4 && (
            <TriageAssignment
              sessionId={sessionId}
              onNext={handleNext}
              onCapture={handleCapture}
              onClock={setClock}
            />
          )}

          {step === 5 && (
            <Interventions
              sessionId={sessionId}
              onNext={handleNext}
              onCapture={handleCapture}
              onClock={setClock}
            />
          )}

          {step === 6 && (
            <SbarHandoff
              sessionId={sessionId}
              onNext={handleNext}
              onCapture={handleCapture}
              onClock={setClock}
            />
          )}

          {step === 7 && (
            <Feedback
              sessionId={sessionId}
              caseRecord={caseRecord}
              aiSettings={aiSettings}
              onAiSettingsChange={setAiSettings}
              onRestart={handleRestart}
            />
          )}
        </main>

        <CaseChart patientData={patientData} caseRecord={caseRecord} activeStep={activeStep} />
      </div>
    </div>
  );
}

export default App;
