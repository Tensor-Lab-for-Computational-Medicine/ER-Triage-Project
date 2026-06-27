import React, { useEffect } from 'react';
import ClinicalReasoningSimulator from './screens/ClinicalReasoningSimulator';

function App() {
  useEffect(() => {
    const pathname = window.location.pathname.replace(/\/$/, '');
    if (!pathname.endsWith('/ai-simulator')) {
      const rawBase = import.meta.env.BASE_URL || '/';
      const basePath = rawBase === './' ? '' : rawBase.replace(/\/$/, '');
      const targetPath = `${basePath}/ai-simulator`.replace(/\/{2,}/g, '/');
      window.history.replaceState(null, '', `${targetPath}${window.location.search}${window.location.hash}`);
    }
  }, []);

  return <ClinicalReasoningSimulator />;
}

export default App;
