import React, { useState, useEffect } from 'react';
import { askTutorQuestion, getFeedback } from '../services/api';

function getComparisonClass(comparison) {
  return String(comparison || '')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function getTeachingPoint(comparison) {
  if (comparison === 'Correct triage') {
    return 'Your acuity assignment matched the MIETIC reference decision. The next step is checking whether your rationale used the right evidence.';
  }

  if (comparison === 'Under-triaged') {
    return 'The reference decision placed this patient at higher acuity. Focus on missed risk, abnormal vitals, and resource needs.';
  }

  if (comparison === 'Over-triaged') {
    return 'Your assignment was more acute than the reference decision. Look for which danger signals were absent and whether fewer resources were expected.';
  }

  return 'Review the expert comparison and outcome signals before starting the next case.';
}

function TutorPanel({ sessionId }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const askQuestion = async (text = question) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Enter a question for the clinical tutor.');
      return;
    }

    setLoading(true);
    setError('');
    setMessages((prev) => [...prev, { role: 'learner', text: trimmed }]);
    setQuestion('');

    try {
      const answer = await askTutorQuestion(sessionId, trimmed);
      setMessages((prev) => [...prev, { role: 'tutor', text: answer }]);
    } catch (err) {
      setError(err.message || 'The clinical tutor could not answer right now.');
    } finally {
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    'Why was this ESI level chosen?',
    'Which vital signs mattered most?',
    'Why would IV access be placed?',
    'What should I do differently next time?'
  ];

  return (
    <section className="feedback-section full-width tutor-panel">
      <div className="section-header compact">
        <div>
          <span className="eyebrow">Post-case tutor</span>
          <h4>Ask why</h4>
        </div>
      </div>

      <p className="instruction">
        Ask follow-up questions about the ESI decision, missed clues, or why a
        recorded ED intervention happened.
      </p>

      <div className="prompt-bank">
        {suggestedQuestions.map((item) => (
          <button
            type="button"
            className="prompt-chip"
            key={item}
            onClick={() => askQuestion(item)}
            disabled={loading}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="question-input tutor-input">
        <label htmlFor="tutor-question">Tutor question</label>
        <textarea
          id="tutor-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Example: Why was this patient intubated?"
          rows="3"
          disabled={loading}
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      <button className="btn-primary" onClick={() => askQuestion()} disabled={loading}>
        {loading ? 'Asking tutor...' : 'Ask clinical tutor'}
      </button>

      {messages.length > 0 && (
        <div className="tutor-thread">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`tutor-message ${message.role}`}>
              <span>{message.role === 'learner' ? 'You' : 'Clinical tutor'}</span>
              <p>{message.text}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Feedback({ sessionId, caseRecord, onRestart }) {
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchFeedback = async () => {
      try {
        const data = await getFeedback(sessionId);
        if (isMounted) {
          setFeedback(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(`Failed to load feedback: ${err.message || err.toString()}`);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchFeedback();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <section className="step-card">
        <div className="loading">Generating expert debrief...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="step-card">
        <div className="error-message">{error}</div>
        <button className="btn-primary" onClick={onRestart}>
          Start new case
        </button>
      </section>
    );
  }

  const { session_summary, triage_analysis, clinical_feedback } = feedback;
  const comparisonClass = getComparisonClass(triage_analysis.comparison);

  return (
    <section className="step-card feedback-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Case debrief</span>
          <h3>Expert comparison</h3>
        </div>
        <span className={`result-badge ${comparisonClass}`}>{triage_analysis.comparison}</span>
      </div>

      <div className="debrief-summary">
        <div className="result-stat">
          <span>Your ESI</span>
          <strong>{triage_analysis.user_level}</strong>
        </div>
        <div className="result-stat">
          <span>Reference ESI</span>
          <strong>{triage_analysis.expert_level}</strong>
        </div>
        <div className="result-stat wide">
          <span>Arrival</span>
          <strong>{session_summary.arrival_method}</strong>
        </div>
      </div>

      <div className="teaching-point">
        <strong>Teaching point</strong>
        <p>{getTeachingPoint(triage_analysis.comparison)}</p>
      </div>

      <div className="feedback-grid">
        <section className="feedback-section">
          <h4>Why the reference ESI was chosen</h4>
          <ul className="clinical-list">
            {triage_analysis.reference_reasoning?.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="feedback-section">
          <h4>What to revisit</h4>
          {triage_analysis.missed_assessment?.length > 0 ? (
            <ul className="clinical-list">
              {triage_analysis.missed_assessment.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No major missed assessment items were flagged.</p>
          )}
        </section>
      </div>

      <section className="feedback-section full-width">
        <h4>Your ESI rationale</h4>
        <div className="feedback-content">
          <div className="question-item">
            <span>Documented rationale</span>
            <strong>{session_summary.triage_rationale || caseRecord.triageRationale || 'None documented'}</strong>
          </div>
          <p>{triage_analysis.rationale_feedback}</p>
        </div>
      </section>

      <div className="feedback-grid">
        <section className="feedback-section">
          <h4>Complete vital set</h4>
          <div className="mini-list">
            {triage_analysis.all_vitals?.map((vital) => (
              <strong key={`${vital.name}-${vital.value}`}>
                {vital.name}: {vital.value}
              </strong>
            ))}
          </div>
        </section>

        <section className="feedback-section">
          <h4>Abnormal or high-salience vitals</h4>
          {triage_analysis.abnormal_vitals?.length > 0 ? (
            <ul className="clinical-list">
              {triage_analysis.abnormal_vitals.map((vital) => (
                <li key={`${vital.name}-${vital.value}`}>
                  {vital.name}: {vital.value} ({vital.reason})
                </li>
              ))}
            </ul>
          ) : (
            <p>No danger-zone vital signs were flagged by the app thresholds.</p>
          )}
        </section>
      </div>

      <div className="feedback-grid">
        <section className="feedback-section">
          <h4>Learner case record</h4>
          <div className="feedback-content">
            <div className="info-row">
              <span className="label">Chief complaint</span>
              <span className="value">{session_summary.chief_complaint}</span>
            </div>
            {session_summary.chief_complaint_question && (
              <div className="question-item">
                <span>Opening question</span>
                <strong>{session_summary.chief_complaint_question}</strong>
              </div>
            )}
            {session_summary.medical_history_question && (
              <div className="question-item">
                <span>History question</span>
                <strong>{session_summary.medical_history_question}</strong>
              </div>
            )}
          </div>
        </section>

        <section className="feedback-section">
          <h4>Outcome signals</h4>
          <div className="feedback-content">
            {triage_analysis.outcomes && triage_analysis.outcomes.length > 0 ? (
              <ul className="clinical-list">
                {triage_analysis.outcomes.map((outcome) => (
                  <li key={outcome}>{outcome}</li>
                ))}
              </ul>
            ) : (
              <p>No outcome signals were available for this case.</p>
            )}
          </div>
        </section>
      </div>

      <section className="feedback-section full-width">
        <h4>Actual ED actions and why they matter</h4>
        <div className="feedback-content">
          {clinical_feedback && clinical_feedback.length > 0 ? (
            <div className="interventions-results compact">
              {clinical_feedback.map((item) => (
                <div key={item.value || item} className="intervention-result">
                  <span>Reference record</span>
                  <strong>{item.name || item}</strong>
                  {item.explanation && <small>{item.explanation}</small>}
                </div>
              ))}
            </div>
          ) : (
            <p>No tracked ED intervention categories were recorded for this visit.</p>
          )}
        </div>
      </section>

      <section className="feedback-section full-width">
        <h4>Your initial triage actions</h4>
        {caseRecord.interventions.length > 0 ? (
          <div className="interventions-results compact">
            {caseRecord.interventions.map((action) => (
              <div key={action.value} className="intervention-result">
                <span>Selected</span>
                <strong>{action.name}</strong>
                {action.description && <small>{action.description}</small>}
              </div>
            ))}
          </div>
        ) : (
          <p>No immediate triage actions were selected.</p>
        )}
      </section>

      <TutorPanel sessionId={sessionId} />

      <button className="btn-primary restart-button" onClick={onRestart}>
        Start another case
      </button>
    </section>
  );
}

export default Feedback;
