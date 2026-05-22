import React, { useState, useEffect } from 'react';
import {
  askTutorQuestion,
  getFeedback,
  getAiDebrief,
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
  const finalEsi = getDomain(domains, 'esi');
  const diagnosis = getDomain(domains, 'diagnosis');
  const referral = getDomain(domains, 'referral');
  const escalation = getDomain(domains, 'escalation');
  const reassessment = getDomain(domains, 'reassessment');
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
      score: averagePercentage([finalEsi, diagnosis]),
      evidence: diagnosis?.message || triageAnalysis?.rationale_feedback || finalEsi?.message || 'Acuity and diagnostic interpretation were scored from learner decisions.',
      action: diagnosis?.message || finalEsi?.message || 'Connect risk, vital signs, diagnosis, and expected resources.'
    },
    {
      label: 'Responding',
      score: averagePercentage([escalation, referral, safety]),
      evidence: workflowAnalysis?.referral?.message || workflowAnalysis?.escalation?.message || escalation?.message || 'Response scoring used referral, placement, monitoring, and escalation priorities.',
      action: workflowAnalysis?.referral?.message || (workflowAnalysis?.escalation?.missed?.length
        ? `Missed actions: ${workflowAnalysis.escalation.missed.map((item) => item.name).join(', ')}.`
        : 'Escalation choices matched the main data-grounded priorities.')
    },
    {
      label: 'Reflecting',
      score: averagePercentage([reassessment, sbar]),
      evidence: workflowAnalysis?.reassessment?.message || workflowAnalysis?.sbar?.message || sbar?.message || 'Reflection was scored from reassessment and handoff completeness.',
      action: workflowAnalysis?.sbar?.missing?.length
        ? `Missing SBAR elements: ${workflowAnalysis.sbar.missing.join(', ')}.`
        : 'Reassessment and handoff closed the loop on the ED encounter.'
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

function SbarBlock({ sbar }) {
  if (!sbar) return <p className="sbar-text">SBAR reference unavailable.</p>;
  if (typeof sbar === 'string') return <pre className="sbar-text">{sbar}</pre>;
  const rows = [
    ['S', 'Situation', sbar.situation],
    ['B', 'Background', sbar.background],
    ['A', 'Assessment', sbar.assessment],
    ['R', 'Recommendation', sbar.recommendation]
  ].filter(([, , text]) => text);

  if (!rows.length) return <p className="sbar-text">SBAR reference unavailable.</p>;

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

function NextCaseChecklist({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="next-case-checklist" style={{ padding: 0, border: 'none', background: 'none' }}>
      <ol style={{ paddingLeft: '20px', margin: '12px 0 0', lineHeight: '1.6' }}>
        {items.map((item) => (
          <li key={item} style={{ marginBottom: '8px', color: '#334155' }}>{item}</li>
        ))}
      </ol>
    </section>
  );
}

function LearnerProfilePanel({ delta, recommendation }) {
  if (!delta && !recommendation) return null;
  const changes = [
    delta?.esi_error_direction && delta.esi_error_direction !== 'matched' ? `Acuity pattern: ${delta.esi_error_direction.replace('_', ' ')}` : '',
    delta?.interview_gaps?.length ? `Interview gaps: ${delta.interview_gaps.join(', ')}` : '',
    delta?.missed_escalation_categories?.length ? `Escalation gaps: ${delta.missed_escalation_categories.join(', ')}` : '',
    delta?.weak_sbar_sections?.length ? `SBAR gaps: ${delta.weak_sbar_sections.join(', ')}` : ''
  ].filter(Boolean);

  return (
    <section className="feedback-section full-width learner-profile-panel" style={{ marginTop: '20px', padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <div className="section-header compact">
        <div>
          <span className="eyebrow">Next case focus</span>
          <h4 style={{ margin: '4px 0 0', fontSize: '1.1rem' }}>{recommendation?.focus || 'Balanced triage practice'}</h4>
        </div>
      </div>
      <p style={{ margin: '8px 0', fontSize: '0.95rem', color: '#475569' }}>{recommendation?.rationale || 'Continue rotating through acuity, interview, escalation, and handoff skills.'}</p>
      {changes.length > 0 && (
        <EvidenceList
          items={changes}
          emptyText="No recurring learner gap was added from this case."
          renderItem={(item) => item}
        />
      )}
    </section>
  );
}

function JudgmentRubricAudit({ domains, workflowAnalysis, triageAnalysis }) {
  const rows = judgmentRows(domains, workflowAnalysis, triageAnalysis);
  if (!rows.length) return null;

  return (
    <section className="feedback-section full-width">
      <h4>Clinical Judgment Rubric</h4>
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
      {response.gold_standard_sbar && <SbarBlock sbar={response.gold_standard_sbar} />}
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
  const tutorLocked = !settings?.hasKey;

  const askQuestion = async (text = question) => {
    const trimmed = text.trim();
    const activeSettings = getTutorSettings();
    if (!activeSettings.hasKey) {
      setError('Add an API key from AI Settings in the header to use the AI tutor. OpenRouter, OpenAI, and Anthropic keys are supported.');
      return;
    }
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
      setMessages((prev) => [...prev, { role: 'tutor', response: answer }]);
    } catch (err) {
      setError('The clinical tutor could not answer right now.');
    } finally {
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    'Summarize this case like an attending physician.',
    'Show the reference-informed SBAR.',
    'What should I improve next time?'
  ];

  return (
    <section className="feedback-section full-width tutor-panel" style={{ padding: 0, border: 'none', background: 'none' }}>
      <p className="instruction">
        {tutorLocked
          ? 'AI tutor is locked in Local mode. Add an API key from AI Settings in the header to ask case-specific follow-up questions.'
          : 'Ask any clinical question or request specific clarification on this case.'}
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
          placeholder="Example: Why was this patient placed in monitored care?"
          rows="3"
          disabled={loading || tutorLocked}
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
            <span className="eyebrow">Written Rationale Review</span>
            <h4>Written Rationale Critique</h4>
          </div>
        </div>
        <p className="instruction">Enable AI in settings to request an educator-style critique.</p>
      </section>
    );
  }

  return (
    <section className="feedback-section full-width reasoning-review-panel">
      <div className="section-header compact">
        <div>
          <span className="eyebrow">Written Rationale Review</span>
          <h4>Written Rationale Critique</h4>
        </div>
      </div>

      {loading && <div className="loading compact-loading">Reviewing clinical reasoning...</div>}
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
        <p className="instruction">Written rationale feedback is shown.</p>
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
              <span>Written Rationale Score</span>
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
              </article>
            ))}
          </div>
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

  const [aiDebriefLoading, setAiDebriefLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchFeedback = async () => {
      try {
        const data = await getFeedback(sessionId);
        if (isMounted) {
          setFeedback(data);
          setReasoningReview(data.local_reasoning_review || null);
          
          const settings = aiSettings || getTutorSettings();
          if (settings?.hasKey) {
            setAiDebriefLoading(true);
            getAiDebrief(sessionId).then(aiData => {
              if (isMounted && aiData) {
                setFeedback(prev => {
                  if (!prev) return prev;
                  const updated = { ...prev };
                  
                  if (aiData.expert_soap_note) {
                    updated.physician_debrief = {
                      ...updated.physician_debrief,
                      soap_note: aiData.expert_soap_note
                    };
                  }
                  
                  if (aiData.clinical_tips) {
                    const tips = [
                      ...(aiData.clinical_tips.red_flags || []).map((item) => `Red flags: ${item}`),
                      ...(aiData.clinical_tips.interview_quality || []).map((item) => `Interview: ${item}`),
                      ...(aiData.clinical_tips.what_to_do_differently || []).map((item) => `Next case: ${item}`)
                    ].filter(Boolean);
                    if (tips.length) updated.next_case_checklist = tips;
                  }
                  
                  return updated;
                });
              }
            }).catch(e => {
              console.error('AI Debrief failed:', e);
            }).finally(() => {
              if (isMounted) setAiDebriefLoading(false);
            });
          }
        }
      } catch (err) {
        if (isMounted) setError(`Failed to load feedback: ${err.message || err.toString()}`);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchFeedback();
    return () => { isMounted = false; };
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
      setReviewError('Add an API key from AI Settings in the header to request an AI critique.');
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
        <div className="loading">Generating simulation debrief...</div>
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
    physician_debrief,
    physician_case_review,
    next_case_checklist,
    case_evidence,
    learner_profile_delta,
    next_case_recommendation
  } = feedback;

  const comparisonClass = getComparisonClass(triage_analysis?.comparison);
  const matched = String(triage_analysis?.comparison || '').toLowerCase().includes('correct') || String(triage_analysis?.comparison || '').toLowerCase().includes('match');
  const bannerHeadline = matched
    ? `Matched Reference Acuity: ESI ${triage_analysis?.expert_level}`
    : `${triage_analysis?.comparison}: Student ESI ${triage_analysis?.user_level} vs Reference ESI ${triage_analysis?.expert_level}`;
  
  const primaryTakeaway = next_case_recommendation?.rationale || physician_debrief?.physician_read || "Systematically identify danger-zone vitals and match expected ED resources.";
  const domains = scorecard?.domains || [];
  const scorePercent = scorecard?.possible
    ? Math.round(((scorecard.total || 0) / scorecard.possible) * 100)
    : 0;

  const soapNote = physician_debrief?.soap_note || physician_case_review?.soap_note;
  const missedEscalation = workflow_analysis?.escalation?.missed?.[0]?.name;
  const firstChecklistItem = next_case_checklist?.[0];
  const secondChecklistItem = next_case_checklist?.[1];
  const diagnosisMessage = workflow_analysis?.diagnosis?.message || 'Working diagnosis was reviewed against available case context.';
  const referralMessage = workflow_analysis?.referral?.message || 'Referral judgment was reviewed when source context was available.';

  return (
    <section className="step-card debrief-card" aria-labelledby="debrief-heading">
      <div className="section-header">
        <div>
          <span className="eyebrow">Debrief</span>
          <h2 id="debrief-heading">Clinical Judgment Debrief</h2>
        </div>
        <span className={`result-badge ${comparisonClass}`}>{triage_analysis?.comparison}</span>
      </div>

      <div className="debrief-quick-grid" aria-label="Debrief summary">
        <article className="debrief-quick-card">
          <span>What happened</span>
          <h3>{bannerHeadline}</h3>
          <p>{missedEscalation ? `Critical missed action: ${missedEscalation}.` : diagnosisMessage}</p>
          <small>{referralMessage}</small>
        </article>
        <article className="debrief-quick-card">
          <span>What to improve</span>
          <h3>{primaryTakeaway}</h3>
          {firstChecklistItem && <p>{firstChecklistItem}</p>}
          {secondChecklistItem && <small>{secondChecklistItem}</small>}
        </article>
        <article className="debrief-quick-card">
          <span>Next case focus</span>
          <h3>{next_case_recommendation?.focus || 'Balanced ED workflow practice'}</h3>
          <p>{next_case_recommendation?.rationale || 'Keep connecting history, vitals, exam, acuity, plan, reassessment, and handoff.'}</p>
        </article>
      </div>

      <div className="debrief-detail-grid">
        <details className="advanced-debrief-details clinical-review-details">
          <summary>
            <span>Clinical Review</span>
            <strong>Assessment, referral, reassessment, and SBAR</strong>
          </summary>
          <div className="advanced-debrief-content">
            {aiDebriefLoading ? (
              <div className="expert-soap-breakdown loading-state" style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <div className="spinner" style={{ margin: '0 auto 16px', width: '40px', height: '40px', border: '4px solid #cbd5e1', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <h4 style={{ color: '#0f172a', margin: '0 0 8px' }}>Generating simulation guidance...</h4>
                <p style={{ color: '#475569', margin: 0, fontSize: '0.95rem' }}>Draft assessment and plan text must be validated before clinical use.</p>
              </div>
            ) : soapNote && (
              <div className="expert-soap-breakdown">
                <div className="soap-header">
                  <span className="detail-kicker">Simulation synthesis</span>
                  <h3>Simulation Assessment & Initial Plan</h3>
                  <p className="subtitle" style={{ margin: '4px 0 0' }}>
                    Diagnosis and management guidance is simulation support unless source-backed or clinician-reviewed in the validation view.
                  </p>
                </div>

                <div className="soap-grid">
                  <div className="soap-column subjective-objective">
                    <div className="soap-box">
                      <h4>Subjective & Objective Baseline</h4>
                      <p style={{ marginBottom: '8px' }}><strong>Chief Concern:</strong> {soapNote.subjective?.chief_concern}</p>
                      {soapNote.subjective?.hpi ? (
                        <>
                          <p style={{ marginBottom: '8px' }}><strong>History of Present Illness:</strong> {soapNote.subjective.hpi}</p>
                          {soapNote.subjective?.pmh && <p style={{ marginBottom: '8px' }}><strong>Past Medical History:</strong> {soapNote.subjective.pmh}</p>}
                          {soapNote.subjective?.meds && <p style={{ marginBottom: '8px' }}><strong>Home Medications:</strong> {soapNote.subjective.meds}</p>}
                          {soapNote.subjective?.allergies && <p style={{ marginBottom: '8px' }}><strong>Allergies:</strong> {soapNote.subjective.allergies}</p>}
                        </>
                      ) : (
                        <p style={{ marginBottom: '8px' }}><strong>History & Context:</strong> {soapNote.subjective?.history}</p>
                      )}
                      <div className="objective-list" style={{ marginTop: '16px' }}>
                        <strong>Objective Vitals & Physical Exam:</strong>
                        <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                          {(soapNote.objective || []).map((obj, i) => (
                            <li key={i} style={{ marginBottom: '4px', fontSize: '0.95rem' }}>{obj}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="soap-column assessment-plan">
                    <div className="soap-box highlighted">
                      <h4>Simulation Assessment & Differential Diagnosis</h4>
                      <p><strong>Primary Working Diagnosis:</strong> {soapNote.assessment?.primary_diagnosis || 'Undifferentiated acute presentation'}</p>
                      <div className="ddx-container" style={{ marginTop: '12px' }}>
                        <strong>Differential Diagnosis Considerations:</strong>
                        <ul className="ddx-list" style={{ margin: '8px 0 0', paddingLeft: 0, listStyle: 'none' }}>
                          {(soapNote.assessment?.ddx || []).map((ddx, i) => (
                            <li key={i} className="ddx-item" style={{ marginBottom: '8px', background: '#fff', borderRadius: '6px', border: '1px solid #dcfce7', overflow: 'hidden' }}>
                              <details open style={{ padding: '0' }}>
                                <summary style={{ padding: '10px', color: '#166534', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  {ddx.diagnosis}
                                  <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>v</span>
                                </summary>
                                <p className="ddx-rationale" style={{ margin: '0', padding: '0 10px 10px', fontSize: '0.9rem', color: '#475569', borderTop: '1px solid #f0fdf4', paddingTop: '8px' }}>{ddx.rationale}</p>
                              </details>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {soapNote.assessment?.justification && (
                        <p className="justification-text" style={{ marginTop: '12px', fontSize: '0.95rem', fontStyle: 'italic', borderTop: '1px dashed #bbf7d0', paddingTop: '8px' }}>
                          <strong>Clinical Rationale:</strong> {soapNote.assessment.justification}
                        </p>
                      )}
                    </div>

                    <div className="soap-box plan-box" style={{ background: '#f8fafc', padding: '16px' }}>
                      <h4 style={{ marginBottom: '8px' }}>Initial ED Care Plan - Simulation Draft</h4>
                      <ul className="plan-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {(soapNote.plan || []).map((pItem, i) => {
                          const isObj = pItem && typeof pItem === 'object';
                          return (
                            <li key={i} style={{ padding: '6px 0', borderBottom: i < soapNote.plan.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                              {isObj ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{i + 1}. {pItem.problem}</strong>
                                  <span style={{ fontSize: '0.9rem', color: '#475569', paddingLeft: '16px' }}>{pItem.plan}</span>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.9rem', color: '#0f172a' }}>{i + 1}. {pItem}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="decision-review-grid">
              <article className="decision-review-card">
                <span className="detail-kicker">Diagnosis</span>
                <h3>Working Diagnosis Review</h3>
                <p><strong>Your diagnosis:</strong> {session_summary?.working_diagnosis || 'No working diagnosis recorded.'}</p>
                {session_summary?.differential?.length > 0 && (
                  <p><strong>Your differential:</strong> {session_summary.differential.join(', ')}</p>
                )}
                <p><strong>Reference context:</strong> {workflow_analysis?.diagnosis?.reference?.primary?.join(', ') || 'No reference diagnosis available.'}</p>
                <p>{workflow_analysis?.diagnosis?.message}</p>
              </article>

              <article className="decision-review-card">
                <span className="detail-kicker">Referral</span>
                <h3>Referral Judgment Review</h3>
                <p>
                  <strong>Your decision:</strong>{' '}
                  {session_summary?.referral_needed === null || session_summary?.referral_needed === undefined
                    ? 'No referral decision recorded.'
                    : session_summary.referral_needed
                      ? `Request ${session_summary.referral_specialty}`
                      : 'No immediate specialty referral.'}
                </p>
                <p>
                  <strong>Reference context:</strong>{' '}
                  {workflow_analysis?.referral?.reference?.clinician_approved_specialty?.length
                    ? workflow_analysis.referral.reference.clinician_approved_specialty.join(', ')
                    : 'No clinician-approved specialty reference for this case.'}
                </p>
                <p>{workflow_analysis?.referral?.message}</p>
              </article>

              <article className="decision-review-card">
                <span className="detail-kicker">Exam</span>
                <h3>Focused Exam Review</h3>
                <p>
                  <strong>Selected:</strong>{' '}
                  {workflow_analysis?.focused_exam?.selected_systems?.length
                    ? workflow_analysis.focused_exam.selected_systems.map((item) => item.name).join(', ')
                    : 'No focused exam systems recorded.'}
                </p>
                <p>
                  <strong>Expected:</strong>{' '}
                  {workflow_analysis?.focused_exam?.expected_systems?.length
                    ? workflow_analysis.focused_exam.expected_systems.map((item) => item.name).join(', ')
                    : 'No case-specific focused exam reference available.'}
                </p>
                <p>{workflow_analysis?.focused_exam?.message}</p>
              </article>
            </div>

            <div className={`takeaway-banner ${matched ? 'matched' : 'mismatched'}`}>
              <div className="banner-content">
                <span className="takeaway-badge">{matched ? 'Acuity Alignment Achieved' : 'Acuity Delta'}</span>
                <h3 style={{ margin: '8px 0', fontSize: '1.4rem' }}>{bannerHeadline}</h3>
                <div className="banner-details">
                  <p className="takeaway-point" style={{ fontSize: '1.05rem', margin: '4px 0 12px' }}>
                    <strong>Clinical Takeaway:</strong> {physician_debrief?.physician_read || primaryTakeaway}
                  </p>
                  <div className="student-rationale-box" style={{ background: 'rgba(255,255,255,0.6)', padding: '12px', borderRadius: '6px', border: '1px dashed rgba(0,0,0,0.1)' }}>
                    <strong style={{ display: 'block', fontSize: '0.88rem', textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>Your Documented Triage Rationale</strong>
                    <p style={{ margin: 0, fontSize: '0.95rem', fontStyle: 'italic', color: '#1e293b' }}>
                      "{session_summary?.triage_rationale || 'No rationale documented.'}"
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="reassessment-debrief-box">
              <span className="detail-kicker">Reassessment</span>
              <h3 style={{ margin: '8px 0' }}>Reassessment Review</h3>
              <p style={{ margin: '0 0 12px' }}>
                {workflow_analysis?.reassessment?.message || 'No reassessment analysis was recorded.'}
              </p>
              <div className="reassessment-targets" style={{ display: 'grid', gap: '8px' }}>
                <p style={{ margin: 0 }}>
                  <strong>Selected:</strong>{' '}
                  {workflow_analysis?.reassessment?.selected_targets?.length
                    ? workflow_analysis.reassessment.selected_targets.map((item) => item.label).join(', ')
                    : 'No reassessment targets selected.'}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Expected:</strong>{' '}
                  {workflow_analysis?.reassessment?.expected?.length
                    ? workflow_analysis.reassessment.expected.map((item) => item.label).join(', ')
                    : 'No required reassessment target from available fields.'}
                </p>
                {session_summary?.reassessment_rationale && (
                  <p style={{ margin: 0 }}>
                    <strong>Rationale:</strong> {session_summary.reassessment_rationale}
                  </p>
                )}
              </div>
            </div>

            <div className="sbar-critique-section">
              <h3>Communication & SBAR Handoff</h3>
              <div className="sbar-comparison-grid">
                <div className="sbar-card student-sbar">
                  <h4>Your SBAR Handoff</h4>
                  <pre className="sbar-text">{session_summary?.sbar_handoff || 'No handoff documented.'}</pre>
                </div>
                <div className="sbar-card reference-informed-sbar">
                  <h4>Reference-Informed SBAR Example</h4>
                  <SbarBlock sbar={physician_case_review?.gold_standard_sbar || physician_debrief?.gold_standard_sbar} />
                </div>
              </div>
              {workflow_analysis?.sbar?.message && (
                <div className="sbar-rubric-feedback">
                  <strong>Rubric Score: {workflow_analysis.sbar.score} / {workflow_analysis.sbar.possible}</strong>
                  <p>{workflow_analysis.sbar.message}</p>
                  {workflow_analysis?.sbar?.gaps?.length > 0 && (
                    <small style={{ display: 'block', marginTop: '8px', color: '#1e40af' }}>Key opportunities to improve: {workflow_analysis.sbar.gaps.join('; ')}</small>
                  )}
                </div>
              )}
            </div>
          </div>
        </details>

        <details className="advanced-debrief-details scoring-validation-details">
          <summary>
            <span>Scoring & Validation</span>
            <strong>Provenance, score ledger, AI review, and tutor</strong>
          </summary>
          <div className="advanced-debrief-content">
            <div className="provenance-legend" aria-label="Debrief provenance legend">
              <span className="provenance-tag source-tag">Source record</span>
              <span className="provenance-tag inference-tag">Reviewed teaching inference</span>
              <span className="provenance-tag warning-tag">LLM draft awaiting validation</span>
            </div>

            <div className="validation-notice" role="note">
              Diagnosis, referral, and management guidance is for simulation debriefing until hallucination validation and clinical expert review are complete.
            </div>

            <div className="debrief-accordion-stack simplified">
              <DebriefAccordion title="Complete Clinical Domain Scoring Ledger" badge={`Overall Score: ${scorePercent}% (${scorecard?.total ?? 0}/${scorecard?.possible ?? 100})`}>
                <section className="feedback-section full-width" style={{ padding: 0 }}>
                  <h4>Case Score Overview</h4>
                  <div className="score-meter" aria-label={`Case score ${scorePercent}%`} style={{ margin: '12px 0 20px' }}>
                    <span style={{ width: `${Math.max(0, Math.min(scorePercent, 100))}%` }} />
                  </div>
                  <p className="instruction">{scorecard?.method}</p>
                </section>

                <section className="feedback-section full-width" style={{ padding: 0, marginTop: '24px' }}>
                  <h4>Score Domains</h4>
                  <div className="score-domain-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {domains.filter(domain => domain.key !== 'provisional_esi').map((domain) => (
                      <DomainScore domain={domain} key={domain.key} />
                    ))}
                  </div>
                </section>

                <div style={{ marginTop: '24px' }}>
                  <JudgmentRubricAudit
                    domains={domains}
                    workflowAnalysis={workflow_analysis}
                    triageAnalysis={triage_analysis}
                  />
                </div>

                <div style={{ marginTop: '24px' }}>
                  <ReasoningReviewPanel
                    review={reasoningReview}
                    loading={reviewLoading}
                    error={reviewError}
                    settings={aiSettings || getTutorSettings()}
                    onRetry={requestReasoningReview}
                  />
                </div>
              </DebriefAccordion>
            </div>

            <LearnerProfilePanel delta={learner_profile_delta} recommendation={next_case_recommendation} />
            <NextCaseChecklist items={next_case_checklist} />
            <TutorPanel sessionId={sessionId} aiSettings={aiSettings} />
          </div>
        </details>
      </div>

      <div className="step-actions">
        <button type="button" className="btn-primary restart-button" onClick={onRestart}>
          Start Another Simulation Case
        </button>
      </div>
    </section>
  );
}

export default Feedback;
