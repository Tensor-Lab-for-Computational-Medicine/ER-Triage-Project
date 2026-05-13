import React, { useState, useEffect } from 'react';
import './styles/App.css';
import { startSimulation } from './services/api';
import PatientInfo from './components/PatientInfo';
import ChiefComplaint from './components/ChiefComplaint';
import VitalSigns from './components/VitalSigns';
import MedicalHistory from './components/MedicalHistory';
import TriageAssignment from './components/TriageAssignment';
import Interventions from './components/Interventions';
import Feedback from './components/Feedback';

const WORKFLOW_STEPS = [
  {
    id: 'arrival',
    label: 'Arrival',
    title: 'Patient arrival brief',
    detail: 'Confirm identifiers and mode of arrival.'
  },
  {
    id: 'interview',
    label: 'Interview',
    title: 'Chief concern',
    detail: 'Elicit the presenting problem in the patient voice.'
  },
  {
    id: 'vitals',
    label: 'Vitals',
    title: 'Primary survey data',
    detail: 'Select and interpret objective triage signals.'
  },
  {
    id: 'history',
    label: 'History',
    title: 'Focused history',
    detail: 'Ask one high-yield question before disposition.'
  },
  {
    id: 'esi',
    label: 'ESI',
    title: 'Acuity decision',
    detail: 'Assign an Emergency Severity Index level.'
  },
  {
    id: 'orders',
    label: 'Actions',
    title: 'Initial triage actions',
    detail: 'Choose escalation, access, airway, medication, or safety actions.'
  },
  {
    id: 'debrief',
    label: 'Debrief',
    title: 'Expert comparison',
    detail: 'Review the decision against MIETIC outcomes.'
  }
];

const INITIAL_CASE_RECORD = {
  chiefQuestion: '',
  chiefResponse: '',
  vitals: [],
  historyQuestion: '',
  historyResponse: '',
  triageLevel: null,
  triageRationale: '',
  interventions: []
};

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
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function CaseChart({ patientData, caseRecord }) {
  const triageLabel = caseRecord.triageLevel
    ? `ESI ${caseRecord.triageLevel}`
    : 'Pending';

  return (
    <aside className="case-chart" aria-label="Current case chart">
      <div className="chart-card patient-identity">
        <span className="eyebrow">Arrival record</span>
        <h2>{patientData ? `${patientData.age} year old ${patientData.sex}` : 'Loading case'}</h2>
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
        <span className="eyebrow">Learner chart</span>
        <div className="chart-row">
          <span>Chief concern</span>
          <strong>{caseRecord.chiefResponse ? 'Captured' : 'Pending'}</strong>
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
          <span>Acuity level</span>
          <strong>{triageLabel}</strong>
        </div>
        <div className="chart-row">
          <span>Initial actions</span>
          <strong>{caseRecord.interventions.length || 'None yet'}</strong>
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
        <p>Loading the MIETIC case record and simulation state.</p>
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

function App() {
  const [step, setStep] = useState(-1);
  const [sessionId, setSessionId] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [caseRecord, setCaseRecord] = useState(INITIAL_CASE_RECORD);
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
      setStep(0);
    } catch (err) {
      setError('Failed to start the simulation. Confirm the Flask backend is running on port 5001.');
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
    setError('');
    await handleStart();
  };

  useEffect(() => {
    handleStart();
  }, []);

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
          <span>Simulation case</span>
          <strong>{sessionId ? sessionId.slice(0, 8).toUpperCase() : 'Pending'}</strong>
        </div>
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

          {step === 0 && <PatientInfo patientData={patientData} onNext={handleNext} />}

          {step === 1 && (
            <ChiefComplaint
              sessionId={sessionId}
              onNext={handleNext}
              onCapture={handleCapture}
            />
          )}

          {step === 2 && (
            <VitalSigns
              sessionId={sessionId}
              onNext={handleNext}
              onCapture={handleCapture}
            />
          )}

          {step === 3 && (
            <MedicalHistory
              sessionId={sessionId}
              onNext={handleNext}
              onCapture={handleCapture}
            />
          )}

          {step === 4 && (
            <TriageAssignment
              sessionId={sessionId}
              onNext={handleNext}
              onCapture={handleCapture}
            />
          )}

          {step === 5 && (
            <Interventions
              sessionId={sessionId}
              onNext={handleNext}
              onCapture={handleCapture}
            />
          )}

          {step === 6 && (
            <Feedback
              sessionId={sessionId}
              caseRecord={caseRecord}
              onRestart={handleRestart}
            />
          )}
        </main>

        <CaseChart patientData={patientData} caseRecord={caseRecord} />
      </div>
    </div>
  );
}

export default App;
