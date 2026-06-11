import React, { useState, useEffect, useRef } from 'react';
import {
  askTutorQuestion,
  getFeedback,
  getAiDebrief,
  getTutorSettings,
  gradeReasoningReview
} from '../services/api';
import {
  EvidenceStatusBadge,
  SourceVerificationActions,
  SourceVerificationBadge,
  SourceVerificationDrawer
} from './SourceVerification';

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

function evidenceStatusText(status = '') {
  switch (status) {
    case 'source_record_diagnosis_available':
      return 'Source-record diagnosis available';
    case 'source_record_diagnosis_unavailable':
      return 'Source-record diagnosis unavailable; formative reasoning review';
    case 'clinician_approved_consult_available':
      return 'Clinician-approved consult reference available';
    case 'clinician_approved_consult_unavailable':
      return 'Clinician-approved consult reference unavailable; formative consult review';
    default:
      return status ? status.replace(/_/g, ' ') : 'Evidence status unavailable';
  }
}

function scoringBasisText(status = '') {
  switch (status) {
    case 'source_record_comparison':
      return 'Compared with source-record diagnosis context';
    case 'formative_reasoning_structure':
      return 'Formative reasoning structure review; excluded from numeric score';
    case 'clinician_approved_consult_comparison':
      return 'Compared with clinician-approved consult reference';
    case 'unscored_formative_consult_reasoning':
      return 'Unscored formative consult reasoning';
    default:
      return status ? status.replace(/_/g, ' ') : 'Scoring basis unavailable';
  }
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
  const soap = getDomain(domains, 'soap');

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
      score: averagePercentage([reassessment, soap]),
      evidence: workflowAnalysis?.reassessment?.message || soap?.message || 'Reflection was scored from reassessment and SOAP documentation.',
      action: 'Reassessment and SOAP documentation closed the loop on the ED encounter.'
    }
  ];
}

function DomainScore({ domain }) {
  if (!domain) return null;
  const formativeOnly = domain.scoring_status === 'formative_only' || domain.scored === false || domain.possible === 0;

  return (
    <div className={`score-domain ${scoreClass(domain.percentage)}`}>
      <div>
        <strong>{domain.label}</strong>
        <span>{domain.message}</span>
        {formativeOnly && (
          <span>Formative only; excluded from numeric score until case truth is reviewed.</span>
        )}
      </div>
      <b>
        {formativeOnly
          ? `Formative ${domain.formative_score || 0} / ${domain.formative_possible || 0}`
          : `${domain.score} / ${domain.possible}`}
      </b>
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

function CitationList({ grounding, citations, compact = false }) {
  const [verificationReference, setVerificationReference] = useState(null);
  const referenceCitations = citations?.references || grounding?.citations?.references || [];
  const caseCitations = citations?.case_evidence || grounding?.citations?.case_evidence || [];
  const issues = grounding?.issues || [];
  const supportQuality = grounding?.support_quality;
  if (!referenceCitations.length && !caseCitations.length && !issues.length && !supportQuality) return null;

  return (
    <div className={`citation-list ${compact ? 'compact' : ''}`} aria-label="Grounding citations">
      <div className="citation-list-header">
        <strong>Grounding</strong>
        {grounding?.status && <span className={`citation-status ${grounding.status}`}>{grounding.status.replace('_', ' ')}</span>}
      </div>
      {supportQuality && (
        <div className={`citation-support-quality ${supportQuality.status === 'passed' ? 'passed' : 'needs-review'}`}>
          <span>Support quality checked</span>
          <small>
            {supportQuality.supported_claims || 0}/{supportQuality.checked_claims || 0} supported
            {supportQuality.contradicted_claims ? `, ${supportQuality.contradicted_claims} contradicted` : ''}
            {supportQuality.weak_support_claims ? `, ${supportQuality.weak_support_claims} weak` : ''}
          </small>
        </div>
      )}
      {referenceCitations.length > 0 && (
        <ol className="citation-items">
          {referenceCitations.map((item) => (
            <li key={item.reference_chunk_id} className="citation-reference-item">
              <div className="citation-reference-line">
                <span>{item.citation_label || item.reference_chunk_id}</span>
                {item.source_url ? (
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                    {item.citation_title || item.source_title || item.reference_chunk_id}
                  </a>
                ) : (
                  <b>{item.citation_title || item.source_title || item.reference_chunk_id}</b>
                )}
                <SourceVerificationBadge status={item.verification_status} auditable={item.auditable} />
                <EvidenceStatusBadge status={item.evidence_status} quoteBacked={item.quote_backed} />
              </div>
              <SourceVerificationActions reference={item} onVerify={setVerificationReference} />
            </li>
          ))}
        </ol>
      )}
      <SourceVerificationDrawer
        reference={verificationReference}
        onClose={() => setVerificationReference(null)}
      />
      {caseCitations.length > 0 && (
        <ul className="case-citation-items">
          {caseCitations.slice(0, 4).map((item) => (
            <li key={item.case_evidence_id}>
              <span>{item.label}</span>
              <small>{item.text}</small>
            </li>
          ))}
        </ul>
      )}
      {issues.length > 0 && (
        <p className="citation-issues">{issues.slice(0, 2).join(' ')}</p>
      )}
    </div>
  );
}

function LearnerProfilePanel({ delta, recommendation }) {
  if (!delta && !recommendation) return null;
  const changes = [
    delta?.esi_error_direction && delta.esi_error_direction !== 'matched' ? `Acuity pattern: ${delta.esi_error_direction.replace('_', ' ')}` : '',
    delta?.interview_gaps?.length ? `Interview gaps: ${delta.interview_gaps.join(', ')}` : '',
    delta?.missed_escalation_categories?.length ? `Escalation gaps: ${delta.missed_escalation_categories.join(', ')}` : ''
  ].filter(Boolean);

  return (
    <section className="feedback-section full-width learner-profile-panel" style={{ marginTop: '20px', padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <div className="section-header compact">
        <div>
          <span className="eyebrow">Next case focus</span>
          <h4 style={{ margin: '4px 0 0', fontSize: '1.1rem' }}>{recommendation?.focus || 'Balanced triage practice'}</h4>
        </div>
      </div>
      <p style={{ margin: '8px 0', fontSize: '0.95rem', color: '#475569' }}>{recommendation?.rationale || 'Continue rotating through acuity, interview, escalation, and SOAP documentation.'}</p>
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
      <CitationList grounding={response.grounding} citations={response.citations} compact />
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
    'Review my SOAP note.',
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
          <CitationList grounding={review.grounding} compact />

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
  const [aiDebriefDraft, setAiDebriefDraft] = useState(null);
  const [aiDebriefError, setAiDebriefError] = useState('');
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const clinicalReviewRef = useRef(null);
  const scoringValidationRef = useRef(null);

  const toggleDebriefDetails = () => {
    const shouldExpand = !detailsExpanded;
    setDetailsExpanded(shouldExpand);
    [clinicalReviewRef.current, scoringValidationRef.current].forEach((details) => {
      if (details) details.open = shouldExpand;
    });
  };

  const syncDebriefDetailsState = () => {
    setDetailsExpanded(Boolean(clinicalReviewRef.current?.open && scoringValidationRef.current?.open));
  };

  useEffect(() => {
    let isMounted = true;
    const fetchFeedback = async () => {
      try {
        const data = await getFeedback(sessionId);
        if (isMounted) {
          setFeedback(data);
          setReasoningReview(data.local_reasoning_review || null);
          setAiDebriefDraft(null);
          setAiDebriefError('');
          setAiDebriefLoading(false);
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

  const requestAiDebriefDraft = async () => {
    const activeSettings = getTutorSettings();
    if (!activeSettings.hasKey) {
      setAiDebriefError('Add an API key from AI Settings in the header to request an optional AI draft.');
      return;
    }

    setAiDebriefLoading(true);
    setAiDebriefError('');
    try {
      const draft = await getAiDebrief(sessionId);
      if (!draft) {
        setAiDebriefDraft(null);
        setAiDebriefError('The AI draft returned no usable content. The evidence-based debrief is unchanged.');
        return;
      }
      setAiDebriefDraft(draft);
    } catch (err) {
      setAiDebriefDraft(null);
      setAiDebriefError('The AI draft could not be generated. The evidence-based debrief is unchanged.');
    } finally {
      setAiDebriefLoading(false);
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
  const learnerSoap = session_summary?.soap_note;
  const aiDraftSoap = aiDebriefDraft?.expert_soap_note || null;
  const aiDraftTips = aiDebriefDraft?.clinical_tips || null;
  const aiDraftBlocked = Boolean(aiDebriefDraft?.blocked);
  const aiDraftReady = Boolean(aiDebriefDraft && !aiDraftBlocked && (aiDraftSoap || aiDraftTips));
  const aiDraftTipItems = aiDraftTips ? [
    ...(aiDraftTips.red_flags || []).map((item) => `Red flags: ${item}`),
    ...(aiDraftTips.interview_quality || []).map((item) => `Interview: ${item}`),
    ...(aiDraftTips.what_to_do_differently || []).map((item) => `Next case: ${item}`)
  ].filter(Boolean) : [];
  const missedEscalation = workflow_analysis?.escalation?.missed?.[0]?.name;
  const firstChecklistItem = next_case_checklist?.[0];
  const secondChecklistItem = next_case_checklist?.[1];
  const diagnosisMessage = workflow_analysis?.diagnosis?.message || 'Working diagnosis was reviewed against available case context.';
  const referralMessage = workflow_analysis?.referral?.message || 'Consult judgment was reviewed when source context was available.';
  const restrictedDebriefData = session_summary?.restricted_debrief_data || [];
  const missedItems = [
    missedEscalation ? `Missed action: ${missedEscalation}` : '',
    workflow_analysis?.focused_exam?.missed_systems?.length
      ? `Missed exam: ${workflow_analysis.focused_exam.missed_systems.map((item) => item.name).join(', ')}`
      : '',
    workflow_analysis?.reassessment?.missed?.length
      ? `Missed reassessment: ${workflow_analysis.reassessment.missed.map((item) => item.label).join(', ')}`
      : ''
  ].filter(Boolean);

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
          <p>{next_case_recommendation?.rationale || 'Keep connecting history, vitals, exam, acuity, plan, reassessment, and SOAP documentation.'}</p>
        </article>
      </div>

      <div className="debrief-next-action" aria-label="Debrief next action">
        <div>
          <span className="detail-kicker">Next action</span>
          <strong>{firstChecklistItem || next_case_recommendation?.focus || 'Repeat the full ED workflow with tighter evidence use.'}</strong>
        </div>
        {missedItems.length > 0 && (
          <div>
            <span className="detail-kicker">What I missed</span>
            <p>{missedItems.slice(0, 3).join(' - ')}</p>
          </div>
        )}
      </div>

      <div className="debrief-toolbar" aria-label="Debrief section shortcuts">
        <a href="#clinical-review-details">Review</a>
        <a href="#scoring-validation-details">Scoring</a>
        <button type="button" className="btn-secondary compact-insert-button" onClick={toggleDebriefDetails}>
          {detailsExpanded ? 'Collapse details' : 'Expand details'}
        </button>
      </div>

      <div className="debrief-detail-grid">
        <details
          ref={clinicalReviewRef}
          className="advanced-debrief-details clinical-review-details"
          id="clinical-review-details"
          onToggle={syncDebriefDetailsState}
        >
          <summary>
            <span>Clinical Review</span>
            <strong>Assessment, consults, reassessment, and SOAP</strong>
          </summary>
          <div className="advanced-debrief-content">
            {soapNote && (
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
              {restrictedDebriefData.length > 0 && (
                <article className="decision-review-card">
                  <span className="detail-kicker">Restricted Linkage</span>
                  <h3>Debrief-Only MIMIC Context</h3>
                  {restrictedDebriefData.map((item) => (
                    <p key={item.id}>
                      <strong>{item.label}:</strong>{' '}
                      {item.availability === 'available' ? item.value || item.note : 'Not documented in linked local data.'}
                    </p>
                  ))}
                  <small>These retrospective facts are local-only and were not available during active learner decisions.</small>
                </article>
              )}

              {learnerSoap && (
                <article className="decision-review-card">
                  <span className="detail-kicker">Your Note</span>
                  <h3>SOAP Submission</h3>
                  <p><strong>S:</strong> {learnerSoap.subjective || 'Not recorded.'}</p>
                  <p><strong>O:</strong> {learnerSoap.objective || 'Not recorded.'}</p>
                  <p><strong>A:</strong> {learnerSoap.assessment || 'Not recorded.'}</p>
                  <p><strong>P:</strong> {learnerSoap.plan || 'Not recorded.'}</p>
                  <p>{workflow_analysis?.soap?.message}</p>
                </article>
              )}

              <article className="decision-review-card">
                <span className="detail-kicker">Diagnosis</span>
                <h3>Working Diagnosis Review</h3>
                <p><strong>Your diagnosis:</strong> {session_summary?.working_diagnosis || 'No working diagnosis recorded.'}</p>
                {session_summary?.differential?.length > 0 && (
                  <p><strong>Your differential:</strong> {session_summary.differential.join(', ')}</p>
                )}
                <p><strong>Reference context:</strong> {workflow_analysis?.diagnosis?.reference?.primary?.join(', ') || 'No reference diagnosis available.'}</p>
                <p><strong>Evidence status:</strong> {evidenceStatusText(workflow_analysis?.diagnosis?.evidence_status)}</p>
                <p><strong>Scoring basis:</strong> {scoringBasisText(workflow_analysis?.diagnosis?.scoring_basis)}</p>
                {workflow_analysis?.diagnosis?.safety_note && (
                  <p><strong>Safety note:</strong> {workflow_analysis.diagnosis.safety_note}</p>
                )}
                <p>{workflow_analysis?.diagnosis?.message}</p>
              </article>

              <article className="decision-review-card">
                <span className="detail-kicker">Consult</span>
                <h3>Consult Judgment Review</h3>
                <p>
                  <strong>Your decision:</strong>{' '}
                  {session_summary?.referral_needed === null || session_summary?.referral_needed === undefined
                    ? 'No consult decision recorded.'
                    : session_summary.referral_needed
                      ? `Request ${session_summary.referral_specialty}`
                      : 'No immediate consult.'}
                </p>
                <p>
                  <strong>Reference context:</strong>{' '}
                  {workflow_analysis?.referral?.reference?.clinician_approved_specialty?.length
                    ? workflow_analysis.referral.reference.clinician_approved_specialty.join(', ')
                    : 'No clinician-approved specialty reference for this case.'}
                </p>
                <p><strong>Evidence status:</strong> {evidenceStatusText(workflow_analysis?.referral?.evidence_status)}</p>
                <p><strong>Scoring basis:</strong> {scoringBasisText(workflow_analysis?.referral?.scoring_basis)}</p>
                {workflow_analysis?.referral?.safety_note && (
                  <p><strong>Safety note:</strong> {workflow_analysis.referral.safety_note}</p>
                )}
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

          </div>
        </details>

        <details
          ref={scoringValidationRef}
          className="advanced-debrief-details scoring-validation-details"
          id="scoring-validation-details"
          onToggle={syncDebriefDetailsState}
        >
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

            <section className="feedback-section full-width ai-draft-panel" style={{ padding: '16px', marginBottom: '20px' }}>
              <div className="section-header compact">
                <div>
                  <span className="eyebrow">Optional AI Draft</span>
                  <h4>AI Debrief Draft</h4>
                </div>
                <button type="button" className="btn-secondary" onClick={requestAiDebriefDraft} disabled={aiDebriefLoading}>
                  {aiDebriefLoading ? 'Requesting draft...' : aiDebriefDraft ? 'Refresh draft' : 'Request draft'}
                </button>
              </div>
              <p className="instruction">
                AI draft text is not used for scoring, the simulation SOAP synthesis, or the next-case checklist.
              </p>

              {aiDebriefError && <div className="error-message compact-message">{aiDebriefError}</div>}
              {aiDebriefLoading && <div className="loading compact-loading">Requesting grounded AI draft...</div>}

              {aiDebriefDraft && (
                <>
                  <div className="validation-notice" role="note">
                    {aiDraftBlocked
                      ? 'AI draft blocked by grounding guardrails. The evidence-based debrief remains unchanged.'
                      : 'AI draft is educator review material and requires citation review before clinical teaching use.'}
                  </div>
                  <CitationList grounding={aiDebriefDraft.grounding} citations={aiDebriefDraft.citations} compact />

                  {aiDraftReady && (
                    <div className="decision-review-grid" style={{ marginTop: '12px' }}>
                      {aiDraftSoap && (
                        <article className="decision-review-card">
                          <span className="detail-kicker">Draft SOAP</span>
                          <h3>AI Assessment Draft</h3>
                          <p><strong>Primary diagnosis:</strong> {aiDraftSoap.assessment?.primary_diagnosis || 'Not provided.'}</p>
                          {aiDraftSoap.assessment?.justification && (
                            <p><strong>Rationale:</strong> {aiDraftSoap.assessment.justification}</p>
                          )}
                          {aiDraftSoap.plan?.length > 0 && (
                            <ul className="clinical-list compact-list">
                              {aiDraftSoap.plan.slice(0, 5).map((item, index) => {
                                const isObject = item && typeof item === 'object';
                                return (
                                  <li key={`ai-draft-plan-${index}`}>
                                    {isObject ? `${item.problem || 'Plan'}: ${item.plan || item.action || ''}` : item}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </article>
                      )}

                      {aiDraftTipItems.length > 0 && (
                        <article className="decision-review-card">
                          <span className="detail-kicker">Draft Tips</span>
                          <h3>AI Teaching Tips</h3>
                          <EvidenceList
                            items={aiDraftTipItems}
                            emptyText="No AI teaching tips returned."
                            renderItem={(item) => item}
                          />
                        </article>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

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
                    {domains.filter(domain => !['provisional_esi', 'sbar'].includes(domain.key)).map((domain) => (
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
        <div className="workflow-action-status">
          <span>Status</span>
          <strong>{bannerHeadline}</strong>
        </div>
        <button type="button" className="btn-secondary workflow-jump-button" onClick={() => document.getElementById('clinical-review-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          Review details
        </button>
        <button type="button" className="btn-primary restart-button" onClick={onRestart}>
          Start Another Simulation Case
        </button>
      </div>
    </section>
  );
}

export default Feedback;
