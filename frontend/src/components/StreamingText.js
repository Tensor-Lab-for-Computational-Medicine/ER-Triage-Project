import React, { useState, useEffect } from 'react';

function StreamingText({ text, isStreaming }) {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    setDisplayText(text);
  }, [text]);
  
  return (
    <div className="streaming-response">
      <div className="patient-label">Patient:</div>
      <div className="response-text">
        {displayText}
        {isStreaming && <span className="cursor">|</span>}
      </div>
    </div>
  );
}

export default StreamingText;

