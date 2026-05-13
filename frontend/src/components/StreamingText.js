import React from 'react';

function StreamingText({ text, isStreaming }) {
  return (
    <div className="streaming-response">
      <div className="patient-label">Patient response</div>
      <div className="response-text">
        {text}
        {isStreaming && <span className="cursor">|</span>}
      </div>
    </div>
  );
}

export default StreamingText;
