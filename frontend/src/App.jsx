import React from 'react';
import ClinicalFlowboard from './components/ClinicalFlowboard';
import ClinicalReasoningSimulator from './screens/ClinicalReasoningSimulator';

function App() {
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname.replace(/\/$/, '');
  const aiSimulatorMode = pathname.endsWith('/ai-simulator') || params.get('sim') === 'ai';

  if (aiSimulatorMode) {
    return <ClinicalReasoningSimulator />;
  }

  return <ClinicalFlowboard />;
}

export default App;
