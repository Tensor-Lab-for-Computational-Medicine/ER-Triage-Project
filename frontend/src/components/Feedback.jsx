import React, { useState, useEffect } from 'react';
import {
  askTutorQuestion,
  getFeedback,
  getTutorSettings,
  gradeReasoningReview
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

function getDomain(domains = [], key) {
  return domains.find((domain) => domain.key === key);
}

function averagePercentage(domains = []) {
  const valid = domains.filter(Boolean);
  if (!valid.length) return 0;
  const total = valid.reduce((sum, domain) => sum + (Number(domain.score) || 0), 0);
  const possible = valid.reduce((sum, domain) => sum + (Number(domain.possible) || 0), 0);
  return possible ? Math.round((total / possible) * 100) : 0;
}

function judgmentRows(domains = [], workflowAnalysis = {}, triageAnalysis = {}) {
  const safety = getDomain(domains, 'safety');
  const interview = getDomain(domains, 'interview');
  const provisional = getDomain(domains, 'provisional_esi');
  const finalEsi = getDomain(domains, 'esi');
  const escalation = getDomain(domains, 'escalation');
  const sbar = getDomain(domains, 'sbar');

  return [
    {
      label: 'Noticing',
      score: averagePercentage([safety, interview]),
      evidence: workflowAnalysis?.interview?.message || safety?.message || 'Initial cue recognition was scored from intake and interview coverage.',
      action: workflowAnalysis?.interview?.missed_domains?.length
        ? `Missed domains: ${workflowAnalysis.interview.missed_domains.join(', ')}.`
        : 'Arrival cues and focused questions covered the main risk signals.'
    },
    {
      label: 'Interpreting',
      score: averagePercentage([provisional, finalEsi]),
      evidence: triageAnalysis?.rationale_feedback || finalEsi?.message || 'Acuity interpretation was scored from provisional and final ESI decisions.',
      action: finalEsi?.message || 'Connect risk, vital signs, and expected resources in the ESI rationale.'
    },
    {
      label: 'Responding',
      score: averagePercentage([escalation, safety]),
      evidence: workflowAnalysis?.escalation?.message || escalation?.message || 'Response scoring used placement, monitoring, and escalation priorities.',
      action: workflowAnalysis?.escalation?.missed?.length
        ? `Missed actions: ${workflowAnalysis.escalation.missed.map((item) => item.name).join(', ')}.`
        : 'Escalation choices matched the main data-grounded priorities.'
    },
    {
      label: 'Reflecting',
      score: averagePercentage([sbar]),
      evidence: workflowAnalysis?.sbar?.message || sbar?.message || 'Reflection was scored from handoff completeness.',
      action: workflowAnalysis?.sbar?.missing?.length
        ? `Missing SBAR elements: ${workflowAnalysis.sbar.missing.join(', ')}.`
        : 'The handoff included the expected SBAR structure.'
    }
  ];
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

function SoapNote({ note }) {
  if (!note) return null;

  return (
    <section className="soap-note-panel">
      <div className="section-header compact">
        <div>
          <span className="eyebrow">Case report</span>
          <h4>Physician assessment and plan</h4>
        </div>
      </div>

      <div className="soap-priority-grid">
        <article className="soap-section assessment-section">
          <span>A</span>
          <h5>Assessment</h5>
          <p><strong>Primary Diagnosis:</strong> {note.assessment?.primary_diagnosis}</p>
          <div className="soap-ddx">
            <strong>DDx:</strong>
            <ul>
              {(note.assessment?.ddx || []).map((item) => (
                <li key={item.diagnosis}>
                  <b>{item.diagnosis}</b>
                  <small>{item.rationale}</small>
                </li>
              ))}
            </ul>
          </div>
          <p><strong>Justification:</strong> {note.assessment?.justification}</p>
        </article>

        <article className="soap-section plan-section">
          <span>P</span>
          <h5>Plan</h5>
          <ol>
            {(note.plan || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>
      </div>

      <details className="soap-source-details">
        <summary>Subjective and objective findings</summary>
        <div className="soap-grid soap-source-grid">
          <article className="soap-section">
            <span>S</span>
            <h5>Subjective</h5>
            <p><strong>Chief concern:</strong> {note.subjective?.chief_concern}</p>
            <p>{note.subjective?.history}</p>
          </article>

          <article className="soap-section">
            <span>O</span>
            <h5>Objective</h5>
            <ul>
              {(note.objective || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </details>
    </section>
  );
}

function PhysicianCaseReview({ review, triageAnalysis }) {
  if (!review) return null;

  return (
    <section className="physician-case-review">
      <div className="physician-review-overview">
        <div>
          <span className="eyebrow">Physician case review</span>
          <h4>Clinical read</h4>
          <p>{review.case_summary}</p>
          {review.physician_read && <p>{review.physician_read}</p>}
        </div>
        <dl className="case-review-summary">
          <div>
            <dt>Reference ESI</dt>
            <dd>ESI {review.reference_esi || triageAnalysis?.expert_level}</dd>
          </div>
          <div>
            <dt>Learner ESI</dt>
            <dd>{review.learner_esi ? `ESI ${review.learner_esi}` : 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Disposition</dt>
            <dd>{review.disposition || 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Final status</dt>
            <dd>{review.final_status || triageAnalysis?.comparison}</dd>
          </div>
        </dl>
      </div>

      <SoapNote note={review.soap_note} />
    </section>
  );
}

function DecisionDeltas({ deltas }) {
  if (!deltas || deltas.length === 0) return null;

  return (
    <section className="decision-deltas-panel">
      <div className="section-header compact">
        <div>
          <span className="eyebrow">Acuity reasoning</span>
          <h4>What changed the acuity</h4>
        </div>
      </div>

      <div className="decision-delta-list">
        {deltas.map((delta, index) => (
          <article className="decision-delta-card" key={`${delta.finding}-${index}`}>
            <div className="delta-main">
              <span>Clinical finding</span>
              <strong>{delta.finding}</strong>
              <p>{delta.clinical_significance}</p>
            </div>
            <div className="delta-comparison">
              <div>
                <span>Learner action</span>
                <p>{delta.learner_action}</p>
              </div>
              <div>
                <span>Reference action</span>
                <p>{delta.reference_action}</p>
              </div>
              <div>
                <span>Recommended next step</span>
                <p>{delta.recommended_next_step}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NextCaseChecklist({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="next-case-checklist">
      <div className="section-header compact">
        <div>
          <span className="eyebrow">Next case</span>
          <h4>Next case checklist</h4>
        </div>
      </div>
      <ol>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}

function ReferenceSbarPanel({ sbar, triageAnalysis }) {
  if (!sbar) return null;

  return (
    <section className="gold-standard-panel">
      <div className="section-header compact">
        <div>
          <span className="eyebrow">Reference handoff</span>
          <h4>Reference SBAR</h4>
        </div>
        <span className="clinical-badge">ESI {triageAnalysis?.expert_level}</span>
      </div>
      <SbarBlock sbar={sbar} />
    </section>
  );
}

function JudgmentRubricAudit({ domains, workflowAnalysis, triageAnalysis }) {
  const rows = judgmentRows(domains, workflowAnalysis, triageAnalysis);
  if (!rows.length) return null;

  return (
    <section className="feedback-section full-width">
      <h4>Clinical judgment rubric</h4>
      <div className="judgment-rubric-grid audit-rubric-grid">
        {rows.map((row) => (
          <article className={`judgment-rubric-item ${scoreClass(row.score)}`} key={row.label}>
            <div className="rubric-heading">
              <strong>{row.label}</strong>
              <span>{row.score}%</span>
            </div>
            <p>{row.evidence}</p>
            <small>{row.action}</small>
          </article>
        ))}
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
      setError('Enable AI in settings to ask follow-up questions.');
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
      setError('The clinical tutor could not answer right now.');
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
        Ask a follow-up question about the case.
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
  if (!review && !loading && !error) {
    return (
      <section className="feedback-section full-width reasoning-review-panel">
        <div className="section-header compact">
          <div>
            <span className="eyebrow">Reasoning review</span>
            <h4>Clinical critique</h4>
          </div>
        </div>
        <p className="instruction">
          Enable AI in settings to request an educator-style critique.
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
      </div>

      {loading && (
        <div className="loading compact-loading">
          Reviewing clinical reasoning.
        </div>
      )}

      {error && (
        <div className="review-retry-panel">
          <div className="error-message compact-message">{error}</div>
          {settings?.hasKey && (
            <div className="retry-controls">
              <button type="button" className="btn-secondary" onClick={() => onRetry?.()} disabled={loading}>
                Retry review
              </button>
            </div>
          )}
        </div>
      )}

      {!settings?.hasKey && review?.source === 'Local rubric review' && (
        <p className="instruction">
          Core rubric feedback is shown.
        </p>
      )}

      {settings?.hasKey && review?.source === 'Local rubric review' && !loading && !error && (
        <div className="review-retry-panel compact-ai-action">
          <p className="instruction">Request a deeper free-text critique when needed.</p>
          <button type="button" className="btn-secondary" onClick={() => onRetry?.()}>
            Request critique
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

  const requestReasoningReview = async () => {
    const activeSettings = getTutorSettings();
    if (!activeSettings.hasKey) {
      setReviewError('Enable AI in settings to request a critique.');
      return;
    }

    setReviewLoading(true);
    setReviewError('');

    try {
      const review = await gradeReasoningReview(sessionId);
      setReasoningReview(review);
    } catch (err) {
      setReasoningReview(feedback?.local_reasoning_review || null);
      setReviewError('The critique could not be generated.');
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
    physician_debrief,
    physician_case_review,
    decision_deltas,
    next_case_checklist,
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
          <h3>Physician case review</h3>
        </div>
        <span className={`result-badge ${comparisonClass}`}>{triage_analysis.comparison}</span>
      </div>

      <PhysicianCaseReview
        review={physician_case_review || {
          case_summary: physician_debrief?.case_summary,
          physician_read: physician_debrief?.physician_read,
          reference_esi: triage_analysis?.expert_level,
          learner_esi: triage_analysis?.user_level,
          disposition: case_evidence?.outcomes?.find((item) => item.label === 'Disposition')?.value,
          final_status: triage_analysis?.comparison,
          soap_note: physician_debrief?.soap_note
        }}
        triageAnalysis={triage_analysis}
      />

      <DecisionDeltas deltas={decision_deltas || physician_case_review?.decision_deltas} />

      <NextCaseChecklist items={next_case_checklist || physician_case_review?.next_case_checklist} />

      <div className="debrief-accordion-stack simplified">
        <DebriefAccordion title="Reference SBAR" badge={`ESI ${triage_analysis?.expert_level}`}>
          <ReferenceSbarPanel
            sbar={physician_case_review?.gold_standard_sbar || physician_debrief?.gold_standard_sbar}
            triageAnalysis={triage_analysis}
          />
        </DebriefAccordion>

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
              {(workflow_analysis?.sbar?.gaps?.length > 0 || workflow_analysis?.sbar?.missing?.length > 0) && (
                <p>
                  Weak or missing elements: {(workflow_analysis.sbar.gaps?.length
                    ? workflow_analysis.sbar.gaps.slice(0, 6)
                    : workflow_analysis.sbar.missing
                  ).join('; ')}.
                </p>
              )}
            </div>
          </section>
        </DebriefAccordion>

        <DebriefAccordion title="Score audit" badge={`${scorecard?.total ?? 0} / ${scorecard?.possible ?? 100}`}>
          <section className="feedback-section full-width">
            <h4>Case score</h4>
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

          <JudgmentRubricAudit
            domains={domains}
            workflowAnalysis={workflow_analysis}
            triageAnalysis={triage_analysis}
          />
        </DebriefAccordion>

        <DebriefAccordion title="Case evidence" badge="Review">
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
                  emptyText="No resource needs were recorded for this case."
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
                  <strong>{workflow_analysis?.interview?.mode_label || 'Focused interview'}</strong>
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

          <section className="feedback-section">
            <h4>Outcome signals</h4>
            <EvidenceList
              items={case_evidence?.outcomes}
              emptyText="No disposition or outcome signal was available for this case."
              renderItem={(item) => `${item.label}: ${item.value}`}
            />
          </section>
        </DebriefAccordion>

        <DebriefAccordion title="Clinical tutor" badge={(aiSettings || getTutorSettings()).hasKey ? 'Enabled' : 'Optional'}>
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
