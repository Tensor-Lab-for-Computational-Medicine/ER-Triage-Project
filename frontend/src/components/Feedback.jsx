import React, { useState, useEffect } from 'react';
import {
  askTutorQuestion,
  getFeedback,
  getTutorSettings,
  gradeReasoningReview,
  saveTutorSettings
} from '../services/api';

function getComparisonClass(comparison) {
  return String(comparison || '')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function scoreClass(percentage = 0) {
  if (percentage >= 85) return 'strong';
  if (percentage >= 65) return 'developing';
  return 'needs-review';
}

function DomainScore({ domain }) {
  if (!domain) return null;

  return (
    <div className={`score-domain ${scoreClass(domain.percentage)}`}>
      <div>
        <strong>{domain.label}</strong>
        <span>{domain.message}</span>
      </div>
      <b>{domain.score} / {domain.possible}</b>
    </div>
  );
}

function EvidenceList({ items, emptyText, renderItem }) {
  if (!items || items.length === 0) {
    return <p>{emptyText}</p>;
  }

  return (
    <ul className="clinical-list compact-list">
      {items.map((item, index) => (
        <li key={`${item.label || item.name || item.value || index}`}>
          {renderItem ? renderItem(item) : item}
        </li>
      ))}
    </ul>
  );
}

function ActionLedger({ items }) {
  if (!items || !items.length) return null;

  return (
    <section className="feedback-section full-width">
      <h4>Action scoring ledger</h4>
      <div className="action-ledger">
        {items.map((item) => (
          <div className="action-ledger-item" key={item.id}>
            <div className="ledger-heading">
              <div>
                <span>{item.label}</span>
                <strong>{item.score}</strong>
              </div>
            </div>
            <div className="ledger-comparison">
              <div>
                <span>Your action</span>
                <strong>{item.learner}</strong>
              </div>
              <div>
                <span>Reference</span>
                <strong>{item.reference}</strong>
              </div>
            </div>
            <p>{item.feedback}</p>
            <p>{item.action}</p>
            <ul>
              {(item.evidence || []).map((evidence, index) => (
                <li key={`${item.id}-evidence-${index}`}>{evidence}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function SbarBlock({ sbar }) {
  if (!sbar) return null;
  const rows = [
    ['S', 'Situation', sbar.situation],
    ['B', 'Background', sbar.background],
    ['A', 'Assessment', sbar.assessment],
    ['R', 'Recommendation', sbar.recommendation]
  ].filter(([, , text]) => text);

  if (!rows.length) return null;

  return (
    <div className="gold-sbar-grid">
      {rows.map(([letter, label, text]) => (
        <div className="gold-sbar-item" key={letter}>
          <span>{letter}</span>
          <div>
            <strong>{label}</strong>
            <p>{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PhysicianDebrief({ debrief, triageAnalysis, scorecard, scorePercent, comparisonClass }) {
  if (!debrief) return null;

  return (
    <section className="physician-debrief">
      <div className="physician-summary">
        <div>
          <span className="eyebrow">Emergency physician read</span>
          <h4>Case summary</h4>
          <p>{debrief.case_summary}</p>
          {debrief.physician_read && <p>{debrief.physician_read}</p>}
        </div>
        <div className="debrief-score-card">
          <span className={`result-badge ${comparisonClass}`}>{triageAnalysis.comparison}</span>
          <strong>{scorecard?.total ?? 0} / {scorecard?.possible ?? 100}</strong>
          <small>{scorePercent}% case score</small>
        </div>
      </div>

      <div className="gold-standard-panel">
        <div className="section-header compact">
          <div>
            <span className="eyebrow">Gold standard</span>
            <h4>Reference SBAR</h4>
          </div>
          <span className="clinical-badge">ESI {triageAnalysis.expert_level}</span>
        </div>
        <SbarBlock sbar={debrief.gold_standard_sbar} />
      </div>

      <div className="next-step-panel">
        <div className="section-header compact">
          <div>
            <span className="eyebrow">Next case</span>
            <h4>What to improve</h4>
          </div>
        </div>
        <div className="next-step-grid">
          {(debrief.next_steps || []).map((item) => (
            <article className="next-step-card" key={`${item.title}-${item.evidence}`}>
              <span>{item.title}</span>
              <strong>{item.evidence}</strong>
              <p>{item.action}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TutorResponse({ response }) {
  if (!response) return null;

  return (
    <div className="tutor-response-card">
      <div className="section-header compact">
        <div>
          <span className="eyebrow">{response.role || 'Emergency physician tutor'}</span>
          <h4>Case guidance</h4>
        </div>
        <span className="clinical-badge">{response.source || 'OpenRouter'}</span>
      </div>
      {response.summary && <p className="tutor-summary">{response.summary}</p>}
      {response.teaching_point && (
        <div className="teaching-point compact-teaching-point">
          <strong>Teaching point</strong>
          <p>{response.teaching_point}</p>
        </div>
      )}
      <SbarBlock sbar={response.gold_standard_sbar} />
      {response.next_steps?.length > 0 && (
        <div className="next-step-grid tutor-next-steps">
          {response.next_steps.map((item) => (
            <article className="next-step-card" key={`${item.title}-${item.action}`}>
              <span>{item.title}</span>
              {item.evidence && <strong>{item.evidence}</strong>}
              <p>{item.action}</p>
            </article>
          ))}
        </div>
      )}
      {response.bullets?.length > 0 && (
        <ul className="clinical-list compact-list">
          {response.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TutorPanel({ sessionId, aiSettings }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const settings = aiSettings || getTutorSettings();

  const askQuestion = async (text = question) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Enter a question for the clinical tutor.');
      return;
    }
    const activeSettings = getTutorSettings();
    if (!activeSettings.hasKey) {
      setError('Use AI settings in the header to enable the clinical tutor.');
      return;
    }

    setLoading(true);
    setError('');
    setMessages((prev) => [...prev, { role: 'learner', text: trimmed }]);
    setQuestion('');

    try {
      const answer = await askTutorQuestion(sessionId, trimmed);
      setMessages((prev) => [...prev, { role: 'tutor', response: answer }]);
    } catch (err) {
      setError(err.message || 'The clinical tutor could not answer right now.');
    } finally {
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    'Summarize this case like an attending physician.',
    'Show the gold-standard SBAR.',
    'What should I improve next time?'
  ];

  return (
    <section className="feedback-section full-width tutor-panel">
      <div className="section-header compact">
        <div>
          <span className="eyebrow">Clinical tutor</span>
          <h4>Case questions</h4>
        </div>
      </div>

      <p className="instruction">
        Ask for a concise attending-style explanation after the debrief. The tutor uses the global AI settings in the header.
      </p>

      <div className="source-card tutor-source">
        <span>{settings.hasKey ? 'AI tutor enabled' : 'AI tutor off'}</span>
        <strong>{settings.model}</strong>
        <small>{settings.hasKey ? 'OpenRouter key saved in this browser.' : 'The core debrief remains available in static mode.'}</small>
      </div>

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
        {loading ? 'Asking physician tutor...' : 'Ask physician tutor'}
      </button>

      {messages.length > 0 && (
        <div className="tutor-thread">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`tutor-message ${message.role}`}>
              <span>{message.role === 'learner' ? 'You' : 'Emergency physician tutor'}</span>
              {message.role === 'learner' ? <p>{message.text}</p> : <TutorResponse response={message.response} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReasoningReviewPanel({ review, loading, error, settings, onRetry }) {
  const [retryModel, setRetryModel] = useState(settings?.model || 'openrouter/free');

  useEffect(() => {
    setRetryModel(settings?.model || 'openrouter/free');
  }, [settings?.model]);

  if (!review && !loading && !error) {
    return (
      <section className="feedback-section full-width reasoning-review-panel">
        <div className="section-header compact">
          <div>
            <span className="eyebrow">Reasoning review</span>
            <h4>Clinical critique</h4>
          </div>
          <span className="clinical-badge">{settings?.hasKey ? 'Ready' : 'Local'}</span>
        </div>
        <p className="instruction">
          Save an OpenRouter key in AI settings to request an educator-style critique.
        </p>
      </section>
    );
  }

  return (
    <section className="feedback-section full-width reasoning-review-panel">
      <div className="section-header compact">
        <div>
          <span className="eyebrow">Reasoning review</span>
          <h4>Clinical critique</h4>
        </div>
        <span className="clinical-badge">{loading ? 'Reviewing' : review?.source || 'Unavailable'}</span>
      </div>

      {loading && (
        <div className="loading compact-loading">
          {review ? 'Requesting OpenRouter critique. Local rubric feedback remains available.' : 'Reviewing clinical reasoning with OpenRouter.'}
        </div>
      )}

      {error && (
        <div className="review-retry-panel">
          <div className="error-message compact-message">{error}</div>
          {settings?.hasKey && (
            <div className="retry-controls">
              <label htmlFor="reasoning-review-model">
                Retry model
                <input
                  id="reasoning-review-model"
                  type="text"
                  value={retryModel}
                  onChange={(event) => setRetryModel(event.target.value)}
                  placeholder="openrouter/free"
                />
              </label>
              <button type="button" className="btn-secondary" onClick={() => onRetry?.(retryModel)} disabled={loading}>
                Retry AI review
              </button>
            </div>
          )}
        </div>
      )}

      {!settings?.hasKey && review?.source === 'Local rubric review' && (
        <p className="instruction">
          Local rubric feedback is available without an API key. AI critique can be requested from the header settings.
        </p>
      )}

      {settings?.hasKey && review?.source === 'Local rubric review' && !loading && !error && (
        <div className="review-retry-panel compact-ai-action">
          <p className="instruction">Local rubric feedback is shown. An AI critique can be requested when deeper free-text review is needed.</p>
          <button type="button" className="btn-secondary" onClick={() => onRetry?.(retryModel)}>
            Request AI critique
          </button>
        </div>
      )}

      {review && (
        <>
          <div className={`reasoning-overall ${scoreClass(review.overall?.percentage)}`}>
            <div>
              <span>Reasoning score</span>
              <strong>{review.overall?.score ?? 0} / {review.overall?.possible ?? 0}</strong>
            </div>
            <p>{review.overall?.summary}</p>
            <small>{review.overall?.priority}</small>
            {review.semantic_score && <small>Semantic cache match: {Math.round(review.semantic_score * 100)}%</small>}
          </div>

          <div className="reasoning-section-grid">
            {(review.sections || []).map((section) => (
              <article className={`reasoning-section ${scoreClass(section.percentage)}`} key={section.id}>
                <div className="rubric-heading">
                  <strong>{section.label}</strong>
                  <span>{section.score} / {section.possible}</span>
                </div>
                <p>{section.feedback}</p>
                <div className="reasoning-lists">
                  <div>
                    <span>Strengths</span>
                    <ul>
                      {(section.strengths?.length ? section.strengths : ['No specific strength identified.']).map((item) => (
                        <li key={`${section.id}-strength-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span>Next steps</span>
                    <ul>
                      {(section.improvements?.length ? section.improvements : ['Use more explicit case evidence.']).map((item) => (
                        <li key={`${section.id}-improvement-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {section.evidence?.length > 0 && (
                  <div className="evidence-strip">
                    {section.evidence.map((item) => (
                      <span key={`${section.id}-evidence-${item}`}>{item}</span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>

          {(review.clinical_reasoning_feedback?.length > 0 || review.safety_flags?.length > 0) && (
            <div className="reasoning-footer">
              {review.clinical_reasoning_feedback?.length > 0 && (
                <div>
                  <span>Reasoning feedback</span>
                  <ul>
                    {review.clinical_reasoning_feedback.map((item) => (
                      <li key={`reasoning-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {review.safety_flags?.length > 0 && (
                <div>
                  <span>Safety flags</span>
                  <ul>
                    {review.safety_flags.map((item) => (
                      <li key={`safety-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DebriefAccordion({ title, badge, children, defaultOpen = false }) {
  return (
    <details className="debrief-accordion" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {badge && <strong>{badge}</strong>}
      </summary>
      <div className="debrief-accordion-content">
        {children}
      </div>
    </details>
  );
}

function Feedback({ sessionId, caseRecord, aiSettings, onAiSettingsChange, onRestart }) {
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reasoningReview, setReasoningReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchFeedback = async () => {
      try {
        const data = await getFeedback(sessionId);
        if (isMounted) {
          setFeedback(data);
          setReasoningReview(data.local_reasoning_review || null);
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

  useEffect(() => {
    if (!feedback) {
      setReviewLoading(false);
      return;
    }

    setReasoningReview(feedback.local_reasoning_review || null);
    setReviewError('');
    setReviewLoading(false);
  }, [feedback]);

  const requestReasoningReview = async (nextModel) => {
    const activeSettings = getTutorSettings();
    const trimmedModel = String(nextModel || activeSettings.model || '').trim();
    if (activeSettings.key && trimmedModel && trimmedModel !== activeSettings.model) {
      const next = saveTutorSettings({
        key: activeSettings.key,
        model: trimmedModel
      });
      onAiSettingsChange?.(next);
    }

    if (!activeSettings.hasKey) {
      setReviewError('Save an OpenRouter key in AI settings to request an AI critique.');
      return;
    }

    setReviewLoading(true);
    setReviewError('');

    try {
      const review = await gradeReasoningReview(sessionId);
      setReasoningReview(review);
    } catch (err) {
      setReasoningReview(feedback?.local_reasoning_review || null);
      setReviewError(err.message || 'AI reasoning review could not be generated.');
    } finally {
      setReviewLoading(false);
    }
  };

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

  const {
    session_summary,
    triage_analysis,
    workflow_analysis,
    scorecard,
    action_feedback,
    simulation_strategy,
    physician_debrief,
    case_evidence
  } = feedback;
  const comparisonClass = getComparisonClass(triage_analysis.comparison);
  const domains = scorecard?.domains || [];
  const scorePercent = scorecard?.possible
    ? Math.round(((scorecard.total || 0) / scorecard.possible) * 100)
    : 0;

  return (
    <section className="step-card feedback-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Case debrief</span>
          <h3>Expert comparison</h3>
        </div>
        <span className={`result-badge ${comparisonClass}`}>{triage_analysis.comparison}</span>
      </div>

      <PhysicianDebrief
        debrief={physician_debrief}
        triageAnalysis={triage_analysis}
        scorecard={scorecard}
        scorePercent={scorePercent}
        comparisonClass={comparisonClass}
      />

      <div className="debrief-accordion-stack simplified">
        <DebriefAccordion title="Reasoning review" badge={`${reasoningReview?.overall?.score ?? 0} / ${reasoningReview?.overall?.possible ?? 65}`}>
          <ReasoningReviewPanel
            review={reasoningReview}
            loading={reviewLoading}
            error={reviewError}
            settings={aiSettings || getTutorSettings()}
            onRetry={requestReasoningReview}
          />

          <div className="feedback-grid compact-debrief-grid">
            <section className="feedback-section">
              <h4>Your ESI rationale</h4>
              <div className="feedback-content">
                <div className="question-item">
                  <span>Documented rationale</span>
                  <strong>{session_summary.triage_rationale || caseRecord.triageRationale || 'None documented'}</strong>
                </div>
                <p>{triage_analysis.rationale_feedback}</p>
              </div>
            </section>

            <section className="feedback-section">
              <h4>Escalation rationale</h4>
              <div className="feedback-content">
                <div className="question-item">
                  <span>Documented rationale</span>
                  <strong>{session_summary.escalation_rationale || caseRecord.escalationRationale || 'None documented'}</strong>
                </div>
                <p>{workflow_analysis?.escalation?.message}</p>
              </div>
            </section>
          </div>

          <section className="feedback-section full-width">
            <h4>Your SBAR handoff</h4>
            <div className="feedback-content">
              <div className="question-item">
                <span>Score</span>
                <strong>{workflow_analysis?.sbar?.score} / {workflow_analysis?.sbar?.possible}</strong>
              </div>
              <p>{workflow_analysis?.sbar?.message}</p>
              {workflow_analysis?.sbar?.missing?.length > 0 && (
                <p>Missing elements: {workflow_analysis.sbar.missing.join(', ')}.</p>
              )}
            </div>
          </section>
        </DebriefAccordion>

        <DebriefAccordion title="Score details" badge={`${scorecard?.total ?? 0} / ${scorecard?.possible ?? 100}`}>
          <section className="feedback-section full-width">
            <h4>Score method</h4>
            <div className="score-meter" aria-label={`Case score ${scorePercent}%`}>
              <span style={{ width: `${Math.max(0, Math.min(scorePercent, 100))}%` }} />
            </div>
            <p className="instruction">{scorecard?.method}</p>
          </section>

          <section className="feedback-section full-width">
            <h4>Score domains</h4>
            <div className="score-domain-list">
              {domains.map((domain) => (
                <DomainScore domain={domain} key={domain.key} />
              ))}
            </div>
          </section>

          <ActionLedger items={action_feedback} />
        </DebriefAccordion>

        <DebriefAccordion title="Case evidence" badge="Data sources">
          <div className="feedback-grid">
            <section className="feedback-section">
              <h4>Vital signs and resources</h4>
              <div className="feedback-content">
                <EvidenceList
                  items={case_evidence?.vital_flags}
                  emptyText="No danger-zone vital signs were flagged by the app thresholds."
                  renderItem={(item) => `${item.name}: ${item.value} (${item.reason})`}
                />
                <EvidenceList
                  items={case_evidence?.resources}
                  emptyText="No counted resource fields were recorded."
                  renderItem={(item) => `${item.label}: ${item.value}`}
                />
              </div>
            </section>

            <section className="feedback-section">
              <h4>Interview coverage</h4>
              <div className="feedback-content">
                <p>{workflow_analysis?.interview?.message}</p>
                <div className="mini-list">
                  <span>Mode</span>
                  <strong>{workflow_analysis?.interview?.mode_label || 'Assessment'}</strong>
                  <span>Covered</span>
                  <strong>{workflow_analysis?.interview?.covered_domains?.join(', ') || 'None'}</strong>
                  <span>Missed</span>
                  <strong>{workflow_analysis?.interview?.missed_domains?.join(', ') || 'None'}</strong>
                  <span>Efficiency flags</span>
                  <strong>
                    {[
                      workflow_analysis?.interview?.duplicate_count
                        ? `${workflow_analysis.interview.duplicate_count} duplicate`
                        : '',
                      workflow_analysis?.interview?.low_yield_count
                        ? `${workflow_analysis.interview.low_yield_count} low-yield`
                        : '',
                      workflow_analysis?.interview?.support_count
                        ? `${workflow_analysis.interview.support_count} support`
                        : ''
                    ].filter(Boolean).join(', ') || 'None'}
                  </strong>
                </div>
              </div>
            </section>
          </div>

          <div className="feedback-grid">
            <section className="feedback-section">
              <h4>Escalation priorities</h4>
              <div className="feedback-content">
                <p>{workflow_analysis?.escalation?.message}</p>
                <div className="mini-list">
                  <span>Matched</span>
                  <strong>{workflow_analysis?.escalation?.matched?.map((item) => item.name).join(', ') || 'None'}</strong>
                  <span>Missed</span>
                  <strong>{workflow_analysis?.escalation?.missed?.map((item) => item.name).join(', ') || 'None'}</strong>
                </div>
              </div>
            </section>

            <section className="feedback-section">
              <h4>Recorded ED actions</h4>
              <EvidenceList
                items={case_evidence?.recorded_actions}
                emptyText="No tracked ED intervention categories were recorded for this visit."
                renderItem={(item) => item.name || item}
              />
            </section>
          </div>

          <div className="feedback-grid">
            <section className="feedback-section">
              <h4>Outcome signals</h4>
              <EvidenceList
                items={case_evidence?.outcomes}
                emptyText="No disposition or outcome signal was available for this case."
                renderItem={(item) => `${item.label}: ${item.value}`}
              />
            </section>

            <section className="feedback-section">
              <h4>Simulation realism</h4>
              <div className="priority-grid single-column">
                {(simulation_strategy || []).map((item) => (
                  <div className="priority-item" key={item.title}>
                    <span>{item.title}</span>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </DebriefAccordion>

        <DebriefAccordion title="Clinical tutor" badge={(aiSettings || getTutorSettings()).hasKey ? 'OpenRouter' : 'Optional'}>
          <TutorPanel sessionId={sessionId} aiSettings={aiSettings} />
        </DebriefAccordion>
      </div>

      <button className="btn-primary restart-button" onClick={onRestart}>
        Start another case
      </button>
    </section>
  );
}

export default Feedback;
