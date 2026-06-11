export const EDUCATIONAL_OUTCOME_METRICS_VERSION = 'educational_outcome_metrics_v1';

export const EDUCATIONAL_OUTCOME_METRIC_DEFINITIONS = [
  {
    id: 'esi_accuracy',
    construct: 'interpreting',
    status: 'currently_instrumented',
    app_signal: 'triage_analysis.user_level, triage_analysis.expert_level',
    validation_need: 'Expert consensus benchmark for every case and learner level.'
  },
  {
    id: 'esi_error_direction',
    construct: 'interpreting',
    status: 'currently_instrumented',
    app_signal: 'triage_analysis.comparison',
    validation_need: 'Faculty review of undertriage and overtriage consequence thresholds.'
  },
  {
    id: 'high_risk_undertriage',
    construct: 'patient_safety',
    status: 'currently_instrumented',
    app_signal: 'reference ESI with learner ESI direction',
    validation_need: 'Clinician adjudication of ESI 1 and ESI 2 case truth.'
  },
  {
    id: 'lower_acuity_overtriage',
    construct: 'resource_calibration',
    status: 'currently_instrumented',
    app_signal: 'reference ESI 4 or 5 with learner ESI direction',
    validation_need: 'Triage educator review of resource-calibration cases.'
  },
  {
    id: 'score_percent',
    construct: 'overall_formative_performance',
    status: 'currently_instrumented',
    app_signal: 'scorecard.percentage',
    validation_need: 'Internal consistency and relation to external assessments.'
  },
  {
    id: 'score_domain_percentages',
    construct: 'clinical_reasoning_domains',
    status: 'currently_instrumented',
    app_signal: 'scorecard.domains',
    validation_need: 'Faculty calibration and domain weighting review.'
  },
  {
    id: 'interview_domain_coverage',
    construct: 'noticing',
    status: 'currently_instrumented',
    app_signal: 'workflow_analysis.interview',
    validation_need: 'Expert review of expected question domains by complaint.'
  },
  {
    id: 'focused_exam_selection',
    construct: 'noticing',
    status: 'currently_instrumented',
    app_signal: 'scorecard domain focused_exam',
    validation_need: 'Case-level exam truth and source-boundary review.'
  },
  {
    id: 'diagnostic_reasoning_score',
    construct: 'interpreting',
    status: 'source_limited',
    app_signal: 'workflow_analysis.diagnosis, scorecard domain diagnosis',
    validation_need: 'Clinician-reviewed diagnosis and differential truth records.'
  },
  {
    id: 'consult_judgment_score',
    construct: 'responding',
    status: 'source_limited',
    app_signal: 'workflow_analysis.referral, scorecard domain referral',
    validation_need: 'Clinician-approved consult/referral references.'
  },
  {
    id: 'escalation_action_alignment',
    construct: 'responding',
    status: 'currently_instrumented',
    app_signal: 'workflow_analysis.escalation',
    validation_need: 'Clinician review of expected placement and stabilization actions.'
  },
  {
    id: 'reassessment_target_score',
    construct: 'reflecting',
    status: 'source_limited',
    app_signal: 'workflow_analysis.reassessment, scorecard domain reassessment',
    validation_need: 'Clinician-adjudicated reassessment triggers or optional objective follow-up data.'
  },
  {
    id: 'soap_note_score',
    construct: 'reflecting',
    status: 'currently_instrumented',
    app_signal: 'workflow_analysis.soap, scorecard domain soap',
    validation_need: 'Faculty calibration of note-quality anchors.'
  },
  {
    id: 'sbar_handoff_score',
    construct: 'communication',
    status: 'currently_instrumented',
    app_signal: 'workflow_analysis.sbar, scorecard domain sbar',
    validation_need: 'Simulation educator review of handoff triggers and SBAR scoring.'
  },
  {
    id: 'source_limited_feedback_exposure',
    construct: 'learner_calibration',
    status: 'currently_instrumented',
    app_signal: 'workflow_analysis diagnosis/referral/reassessment evidence_status and scoring_basis',
    validation_need: 'Learner response-process study showing source limitation labels are understood.'
  },
  {
    id: 'learner_profile_gap_delta',
    construct: 'longitudinal_formative_progression',
    status: 'currently_instrumented',
    app_signal: 'learner_profile_delta',
    validation_need: 'Privacy-reviewed cohort export and longitudinal validity evidence.'
  },
  {
    id: 'optional_ai_draft_use',
    construct: 'ai_use_monitoring',
    status: 'requires_external_validation',
    app_signal: 'future optional AI draft viewed/requested event',
    validation_need: 'Institutional policy for collecting AI-use telemetry.'
  },
  {
    id: 'delayed_retention_case_performance',
    construct: 'learning_transfer',
    status: 'requires_external_validation',
    app_signal: 'future pre/post and delayed case-set export',
    validation_need: 'Pilot or multi-site study with delayed follow-up cases.'
  },
  {
    id: 'osce_or_sim_lab_transfer',
    construct: 'clinical_performance_transfer',
    status: 'requires_external_validation',
    app_signal: 'external OSCE, simulation lab, or clerkship assessment linkage',
    validation_need: 'IRB or institutional approval and external assessment data.'
  },
  {
    id: 'workplace_supervisor_rating',
    construct: 'hospital_performance_proxy',
    status: 'requires_external_validation',
    app_signal: 'external supervised clinical performance measure',
    validation_need: 'Institutional governance, consent, and multi-assessor evidence.'
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value) {
  return String(value || '').trim();
}

function slug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
}

function scorePercentage(score, possible, fallback = null) {
  const numericScore = toNumber(score);
  const numericPossible = toNumber(possible);
  if (numericScore === null || !numericPossible) return fallback;
  return Math.round((numericScore / numericPossible) * 100);
}

function normalizeScoreDomain(domain = {}) {
  const id = domain.id || slug(domain.label);
  const score = toNumber(domain.score, 0);
  const possible = toNumber(domain.possible, 0);
  return {
    id,
    label: cleanText(domain.label || id),
    score,
    possible,
    percentage: toNumber(domain.percentage, scorePercentage(score, possible, 0)),
    scored: domain.scored !== undefined ? Boolean(domain.scored) : possible > 0,
    scoring_status: domain.scoring_status || (possible > 0 ? 'scored' : 'formative_only'),
    scoring_basis: cleanText(domain.scoring_basis || ''),
    source_limited: Boolean(domain.source_limited),
    formative_score: toNumber(domain.formative_score, 0),
    formative_possible: toNumber(domain.formative_possible, 0)
  };
}

function scoreDomain(domains, id) {
  return domains.find((domain) => domain.id === id) || null;
}

function objectHasAny(value, keys) {
  if (!value || typeof value !== 'object') return false;
  return keys.some((key) => {
    const item = value[key];
    return Array.isArray(item) ? item.length > 0 : Boolean(item);
  });
}

function caseHasOptionalObjectiveData(caseRecord) {
  return objectHasAny(caseRecord, ['optional_objective_data'])
    || objectHasAny(caseRecord?.source, ['optional_objective_data'])
    || objectHasAny(caseRecord?.augmentation, ['optional_objective_data']);
}

function actionName(action) {
  if (typeof action === 'string') return action;
  return cleanText(action?.name || action?.label || action?.id || action?.category || 'unknown');
}

function actionCategory(action) {
  if (typeof action === 'string') return 'uncategorized';
  return cleanText(action?.category || action?.group || 'uncategorized');
}

function statusIsSourceLimited(value) {
  const text = cleanText(value).toLowerCase();
  return text.includes('unavailable') || text.includes('source_limited') || text.includes('formative') || text.includes('unscored');
}

function sourceLimitFromWorkflow(workflow, caseRecord) {
  const diagnosis = workflow.diagnosis || {};
  const referral = workflow.referral || {};
  const reassessment = workflow.reassessment || {};
  return {
    diagnosis_truth_source_limited: Boolean(diagnosis.source_limited)
      || statusIsSourceLimited(diagnosis.evidence_status)
      || statusIsSourceLimited(diagnosis.scoring_basis),
    consult_truth_source_limited: Boolean(referral.source_limited)
      || statusIsSourceLimited(referral.evidence_status)
      || statusIsSourceLimited(referral.scoring_basis),
    reassessment_truth_source_limited: Boolean(reassessment.source_limited)
      || statusIsSourceLimited(reassessment.evidence_status)
      || statusIsSourceLimited(reassessment.scoring_basis),
    objective_data_source_limited: caseRecord ? !caseHasOptionalObjectiveData(caseRecord) : null
  };
}

export function classifyEsiError(learnerEsi, referenceEsi, comparison = '') {
  const text = cleanText(comparison).toLowerCase();
  if (text.includes('under')) return 'under_triage';
  if (text.includes('over')) return 'over_triage';
  if (text.includes('correct') || text.includes('match')) return 'matched';

  const learner = toNumber(learnerEsi);
  const reference = toNumber(referenceEsi);
  if (learner === null || reference === null) return 'not_available';
  if (learner === reference) return 'matched';
  // ESI is inverted: a higher assigned number means less urgent care.
  return learner > reference ? 'under_triage' : 'over_triage';
}

function domainMetric(domain) {
  if (!domain) {
    return {
      available: false,
      score: null,
      possible: null,
      percentage: null
    };
  }
  return {
    available: true,
    score: domain.score,
    possible: domain.possible,
    percentage: domain.percentage
  };
}

function clinicalReasoningDomains(scoreDomains, workflow) {
  const interview = workflow.interview || {};
  const escalation = workflow.escalation || {};
  const sbar = workflow.sbar || {};
  return {
    noticing: {
      score_domains: ['interview', 'focused_exam', 'safety'].map((id) => domainMetric(scoreDomain(scoreDomains, id))),
      interview_covered_count: asArray(interview.covered_domains).length,
      interview_missed_count: asArray(interview.missed_domains).length
    },
    interpreting: {
      score_domains: ['esi', 'diagnosis'].map((id) => domainMetric(scoreDomain(scoreDomains, id)))
    },
    responding: {
      score_domains: ['referral', 'escalation'].map((id) => domainMetric(scoreDomain(scoreDomains, id))),
      escalation_expected_count: asArray(escalation.expected).length,
      escalation_matched_count: asArray(escalation.matched).length,
      escalation_missed_count: asArray(escalation.missed).length,
      escalation_extra_count: asArray(escalation.extra).length
    },
    reflecting: {
      score_domains: ['reassessment', 'soap', 'sbar'].map((id) => domainMetric(scoreDomain(scoreDomains, id))),
      weak_sbar_sections_count: asArray(sbar.missing).length
    }
  };
}

export function extractEducationalOutcomeMetrics(feedback = {}, options = {}) {
  const caseRecord = options.caseRecord || null;
  const summary = feedback.session_summary || {};
  const triage = feedback.triage_analysis || {};
  const workflow = feedback.workflow_analysis || {};
  const scorecard = feedback.scorecard || {};
  const scoreDomains = asArray(scorecard.domains).map(normalizeScoreDomain);
  const learnerEsi = toNumber(summary.triage_level_assigned ?? triage.user_level ?? triage.learner_esi);
  const referenceEsi = toNumber(triage.expert_level ?? triage.reference_level ?? triage.reference_esi ?? caseRecord?.acuity);
  const esiErrorDirection = classifyEsiError(learnerEsi, referenceEsi, triage.comparison);
  const highRiskCase = referenceEsi === 1 || referenceEsi === 2;
  const lowerAcuityCase = referenceEsi === 4 || referenceEsi === 5;
  const interview = workflow.interview || {};
  const escalation = workflow.escalation || {};
  const sbar = workflow.sbar || {};
  const sourceLimited = sourceLimitFromWorkflow(workflow, caseRecord);
  const safetyFlags = [...asArray(feedback.clinical_decision_review?.safety_flags || workflow.safety_flags)];

  if (highRiskCase && esiErrorDirection === 'under_triage') {
    safetyFlags.push('high_risk_undertriage');
  }

  return {
    schema_version: EDUCATIONAL_OUTCOME_METRICS_VERSION,
    case_id: cleanText(caseRecord?.id || feedback.case_id || summary.case_id || ''),
    public_case_uid: cleanText(caseRecord?.public_case_uid || caseRecord?.source?.public_case_uid || ''),
    content_version: cleanText(caseRecord?.version || caseRecord?.content_version || caseRecord?.augmentation?.version || ''),
    learner_level: cleanText(options.learnerLevel || ''),
    cohort: cleanText(options.cohort || ''),
    reference_esi: referenceEsi,
    learner_esi: learnerEsi,
    esi_match: esiErrorDirection === 'matched',
    esi_error_direction: esiErrorDirection,
    high_risk_case: highRiskCase,
    high_risk_undertriage: highRiskCase && esiErrorDirection === 'under_triage',
    lower_acuity_overtriage: lowerAcuityCase && esiErrorDirection === 'over_triage',
    score_percent: toNumber(scorecard.percentage, scorePercentage(scorecard.total, scorecard.possible)),
    score_total: toNumber(scorecard.total),
    score_possible: toNumber(scorecard.possible),
    score_domains: scoreDomains,
    clinical_reasoning_domains: clinicalReasoningDomains(scoreDomains, workflow),
    interview: {
      covered_count: asArray(interview.covered_domains).length,
      missed_count: asArray(interview.missed_domains).length,
      covered_domains: asArray(interview.covered_domains).map(cleanText).filter(Boolean),
      missed_domains: asArray(interview.missed_domains).map(cleanText).filter(Boolean)
    },
    escalation: {
      expected_count: asArray(escalation.expected).length,
      matched_count: asArray(escalation.matched).length,
      missed_count: asArray(escalation.missed).length,
      extra_count: asArray(escalation.extra).length,
      missed_categories: [...new Set(asArray(escalation.missed).map(actionCategory).filter(Boolean))],
      matched_actions: asArray(escalation.matched).map(actionName).filter(Boolean),
      missed_actions: asArray(escalation.missed).map(actionName).filter(Boolean),
      extra_actions: asArray(escalation.extra).map(actionName).filter(Boolean)
    },
    reassessment: {
      ...domainMetric(scoreDomain(scoreDomains, 'reassessment'))
    },
    soap: {
      ...domainMetric(scoreDomain(scoreDomains, 'soap'))
    },
    sbar: {
      ...domainMetric(scoreDomain(scoreDomains, 'sbar')),
      missing_sections: asArray(sbar.missing).map(cleanText).filter(Boolean),
      gap_count: asArray(sbar.gaps).length
    },
    source_limited_feedback: sourceLimited,
    safety: {
      flags: [...new Set(safetyFlags.map(cleanText).filter(Boolean))],
      flag_count: [...new Set(safetyFlags.map(cleanText).filter(Boolean))].length
    },
    learner_profile_delta: feedback.learner_profile_delta ? clone(feedback.learner_profile_delta) : null,
    optional_ai: {
      draft_requested: Boolean(options.aiDraftRequested),
      draft_used_for_scoring: false
    }
  };
}

function rate(numerator, denominator) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(2)) : null;
}

function mean(values) {
  const numeric = values.map((value) => toNumber(value)).filter((value) => value !== null);
  if (!numeric.length) return null;
  return Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(2));
}

export function summarizeEducationalOutcomeMetrics(rows = []) {
  const metrics = asArray(rows);
  const esiEvaluable = metrics.filter((row) => row.esi_error_direction !== 'not_available');
  const highRisk = metrics.filter((row) => row.high_risk_case);
  const sourceLimitedRows = metrics.filter((row) => Object.values(row.source_limited_feedback || {}).some(Boolean));
  const safetyFlagRows = metrics.filter((row) => row.safety?.flag_count > 0);
  const directionCounts = metrics.reduce((acc, row) => {
    const key = row.esi_error_direction || 'not_available';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    schema_version: `${EDUCATIONAL_OUTCOME_METRICS_VERSION}_summary`,
    encounters: metrics.length,
    esi_evaluable_encounters: esiEvaluable.length,
    esi_accuracy_rate: rate(directionCounts.matched || 0, esiEvaluable.length),
    undertriage_rate: rate(directionCounts.under_triage || 0, esiEvaluable.length),
    overtriage_rate: rate(directionCounts.over_triage || 0, esiEvaluable.length),
    high_risk_undertriage_rate: rate(metrics.filter((row) => row.high_risk_undertriage).length, highRisk.length),
    lower_acuity_overtriage_count: metrics.filter((row) => row.lower_acuity_overtriage).length,
    mean_score_percent: mean(metrics.map((row) => row.score_percent)),
    source_limited_feedback_exposure_rate: rate(sourceLimitedRows.length, metrics.length),
    safety_flag_encounter_rate: rate(safetyFlagRows.length, metrics.length),
    direction_counts: directionCounts
  };
}

export const EDUCATIONAL_OUTCOME_PRIVACY_SAFE_EXPORT_VERSION = 'educational_outcome_privacy_safe_export_v1';

function safeScoreDomain(domain = {}) {
  return {
    id: cleanText(domain.id),
    label: cleanText(domain.label),
    percentage: toNumber(domain.percentage),
    scored: Boolean(domain.scored),
    scoring_status: cleanText(domain.scoring_status),
    source_limited: Boolean(domain.source_limited)
  };
}

function learnerProfileDeltaSummary(delta = null) {
  if (!delta || typeof delta !== 'object') {
    return {
      present: false,
      esi_error_direction: '',
      interview_gap_count: 0,
      missed_escalation_category_count: 0,
      weak_sbar_section_count: 0
    };
  }
  return {
    present: true,
    esi_error_direction: cleanText(delta.esi_error_direction),
    interview_gap_count: asArray(delta.interview_gaps).length,
    missed_escalation_category_count: asArray(delta.missed_escalation_categories).length,
    weak_sbar_section_count: asArray(delta.weak_sbar_sections).length
  };
}

function safeEncounterMetric(row = {}, options = {}) {
  const learnerLevel = options.learnerLevel || row.learner_level || '';
  const cohort = options.cohort || row.cohort || '';
  return {
    schema_version: EDUCATIONAL_OUTCOME_METRICS_VERSION,
    case_id: cleanText(row.case_id),
    public_case_uid: cleanText(row.public_case_uid),
    content_version: cleanText(row.content_version),
    learner_level: cleanText(learnerLevel),
    cohort: cleanText(cohort),
    reference_esi: toNumber(row.reference_esi),
    learner_esi: toNumber(row.learner_esi),
    esi_match: Boolean(row.esi_match),
    esi_error_direction: cleanText(row.esi_error_direction || 'not_available'),
    high_risk_case: Boolean(row.high_risk_case),
    high_risk_undertriage: Boolean(row.high_risk_undertriage),
    lower_acuity_overtriage: Boolean(row.lower_acuity_overtriage),
    score_percent: toNumber(row.score_percent),
    score_domains: asArray(row.score_domains).map(safeScoreDomain),
    clinical_reasoning_counts: {
      interview_covered_count: toNumber(row.interview?.covered_count, 0),
      interview_missed_count: toNumber(row.interview?.missed_count, 0),
      escalation_expected_count: toNumber(row.escalation?.expected_count, 0),
      escalation_matched_count: toNumber(row.escalation?.matched_count, 0),
      escalation_missed_count: toNumber(row.escalation?.missed_count, 0),
      escalation_extra_count: toNumber(row.escalation?.extra_count, 0),
      sbar_missing_section_count: asArray(row.sbar?.missing_sections).length,
      sbar_gap_count: toNumber(row.sbar?.gap_count, 0)
    },
    missed_escalation_categories: asArray(row.escalation?.missed_categories).map(cleanText).filter(Boolean),
    source_limited_feedback: {
      diagnosis_truth_source_limited: Boolean(row.source_limited_feedback?.diagnosis_truth_source_limited),
      consult_truth_source_limited: Boolean(row.source_limited_feedback?.consult_truth_source_limited),
      reassessment_truth_source_limited: Boolean(row.source_limited_feedback?.reassessment_truth_source_limited),
      objective_data_source_limited: Boolean(row.source_limited_feedback?.objective_data_source_limited)
    },
    safety: {
      flag_count: toNumber(row.safety?.flag_count, 0),
      flags: asArray(row.safety?.flags).map(cleanText).filter(Boolean)
    },
    learner_profile_delta_summary: learnerProfileDeltaSummary(row.learner_profile_delta),
    optional_ai: {
      draft_requested: Boolean(row.optional_ai?.draft_requested),
      draft_used_for_scoring: false
    }
  };
}

export function buildPrivacySafeEducationalOutcomeExport(rows = [], options = {}) {
  const encounterRows = asArray(rows).map((row) => safeEncounterMetric(row, options));
  return {
    schema_version: EDUCATIONAL_OUTCOME_PRIVACY_SAFE_EXPORT_VERSION,
    generated_at: options.generatedAt || new Date().toISOString(),
    row_count: encounterRows.length,
    privacy_contract: {
      excludes_direct_student_identifiers: true,
      excludes_direct_patient_identifiers: true,
      excludes_raw_learner_free_text: true,
      excludes_optional_ai_draft_text: true,
      notes: 'Rows contain bounded encounter metrics, controlled domain labels, source-limited flags, safety flags, and optional cohort/training-level codes only when approved.'
    },
    rows: encounterRows,
    summary: summarizeEducationalOutcomeMetrics(encounterRows),
    limitations: [
      'This export supports pilot measurement and QA; it does not prove learner improvement or transfer to hospital performance.',
      'Cohort and learner-level fields require institutional privacy approval before production use.',
      'Source-limited feedback exposure should be reported alongside all formative score outcomes.'
    ]
  };
}

export function summarizeOutcomeMetricDefinitions() {
  const counts = EDUCATIONAL_OUTCOME_METRIC_DEFINITIONS.reduce((acc, definition) => {
    acc[definition.status] = (acc[definition.status] || 0) + 1;
    return acc;
  }, {});
  return {
    schema_version: `${EDUCATIONAL_OUTCOME_METRICS_VERSION}_definitions`,
    total_metrics: EDUCATIONAL_OUTCOME_METRIC_DEFINITIONS.length,
    status_counts: counts,
    definitions: clone(EDUCATIONAL_OUTCOME_METRIC_DEFINITIONS)
  };
}
