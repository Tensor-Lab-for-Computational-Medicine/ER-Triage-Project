import React, { useEffect } from 'react';
import ClinicalReasoningSimulator from './screens/ClinicalReasoningSimulator';

function App() {
  useEffect(() => {
    const pathname = window.location.pathname.replace(/\/$/, '');
    if (!pathname.endsWith('/ai-simulator')) {
      window.history.replaceState(null, '', `/ai-simulator${window.location.search}${window.location.hash}`);
    }
  }, []);

  return <ClinicalReasoningSimulator />;
}

export default App;
