import React, { lazy, Suspense } from 'react';
import ClinicalReasoningSimulator from './screens/ClinicalReasoningSimulator';

const ClinicalFlowboard = lazy(() => import('./components/ClinicalFlowboard'));

function App() {
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname.replace(/\/$/, '');
  const aiSimulatorMode = pathname.endsWith('/ai-simulator') || params.get('sim') === 'ai';

  if (aiSimulatorMode) {
    return <ClinicalReasoningSimulator />;
  }

  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f4f7f8]" />}>
      <ClinicalFlowboard />
    </Suspense>
  );
}

export default App;
