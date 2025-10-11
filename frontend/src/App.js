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

function App() {
  const [step, setStep] = useState(-1); // -1 = initial, 0-6 = workflow steps
  const [sessionId, setSessionId] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleStart = async () => {
    setLoading(true);
    setError('');
    
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
      setLoading(false);
    } catch (err) {
      setError('Failed to start simulation. Make sure the backend is running.');
      setLoading(false);
    }
  };
  
  const handleNext = () => {
    setStep(prev => prev + 1);
  };
  
  const handleRestart = async () => {
    setStep(-1);
    setSessionId(null);
    setPatientData(null);
    setError('');
    // Start a new simulation immediately
    await handleStart();
  };
  
  // Auto-start on mount
  useEffect(() => {
    handleStart();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  if (loading) {
    return (
      <div className="app">
        <div className="container">
          <div className="loading-screen">
            <h1>ER Triage Simulation</h1>
            <div className="loading">Loading case...</div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="app">
        <div className="container">
          <div className="error-screen">
            <h1>ER Triage Simulation</h1>
            <div className="error-message">{error}</div>
            <button className="btn-primary" onClick={handleStart}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="app">
      <div className="container">
        <header className="app-header">
          <h1>ER Triage Simulation</h1>
          <p className="subtitle">Practice Emergency Department Triage with Real MIETIC Data</p>
        </header>
        
        <main className="app-main">
          {step === 0 && (
            <PatientInfo 
              patientData={patientData} 
              onNext={handleNext} 
            />
          )}
          
          {step === 1 && (
            <ChiefComplaint 
              sessionId={sessionId} 
              onNext={handleNext} 
            />
          )}
          
          {step === 2 && (
            <VitalSigns 
              sessionId={sessionId} 
              onNext={handleNext} 
            />
          )}
          
          {step === 3 && (
            <MedicalHistory 
              sessionId={sessionId} 
              onNext={handleNext} 
            />
          )}
          
          {step === 4 && (
            <TriageAssignment 
              sessionId={sessionId} 
              onNext={handleNext} 
            />
          )}
          
          {step === 5 && (
            <Interventions 
              sessionId={sessionId} 
              onNext={handleNext} 
            />
          )}
          
          {step === 6 && (
            <Feedback 
              sessionId={sessionId} 
              onRestart={handleRestart} 
            />
          )}
        </main>
        
        <footer className="app-footer">
          <p>Cases from the MIMIC-IV Dataset</p>
          <p className="footer-credit">Tensor Lab</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
