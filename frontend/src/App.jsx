import React, { Suspense, lazy } from 'react';
import ClinicalFlowboard from './components/ClinicalFlowboard';

const LegacySimulatorApp = lazy(() => import('./LegacySimulatorApp'));

function App() {
  const params = new URLSearchParams(window.location.search);
  const legacyMode = window.location.pathname === '/legacy' || params.get('legacy') === '1';

  if (legacyMode) {
    return (
      <Suspense fallback={<main className="flowboard-app"><div className="flowboard-shell">Loading legacy simulator...</div></main>}>
        <LegacySimulatorApp />
      </Suspense>
    );
  }

  return <ClinicalFlowboard />;
}

export default App;
