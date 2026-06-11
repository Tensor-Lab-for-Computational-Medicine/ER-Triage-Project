import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPrivacySafeEducationalOutcomeExport,
  extractEducationalOutcomeMetrics,
  summarizeEducationalOutcomeMetrics
} from '../frontend/src/services/educationalOutcomeMetricsService.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'educational_outcomes_runtime_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'educational_outcomes_runtime_report.md');

const DISALLOWED_KEYS = [
  'student_name',
  'student_email',
  'student_id',
  'learner_name',
  'learner_email',
  'patient_name',
  'subject_id',
  'hadm_id',
  'stay_id',
  'raw_learner_text',
  'raw_rationale',
  'free_text',
  'soap_text',
  'ai_draft_text',
  'transcript',
  'message_text'
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function domain(id, score, possible, options = {}) {
  return {
    id,
    label: options.label || id.replace(/_/g, ' '),
    score,
    possible,
    percentage: possible ? Math.round((score / possible) * 100) : 0,
    scored: options.scored ?? possible > 0,
    scoring_status: options.scoring_status || (possible > 0 ? 'scored' : 'formative_only'),
    scoring_basis: options.scoring_basis || '',
    source_limited: Boolean(options.source_limited),
    formative_score: options.formative_score || 0,
    formative_possible: options.formative_possible || 0
  };
}

function baseFeedback({ caseRecord, learnerEsi, referenceEsi, comparison, scorePercent = 74, sourceLimited = true, aiDraftRequested = false }) {
  const highRiskUndertriage = Number(referenceEsi) <= 2 && Number(learnerEsi) > Number(referenceEsi);
  return {
    case_id: caseRecord.id,
    session_summary: {
      case_id: caseRecord.id,
      triage_level_assigned: learnerEsi
    },
    triage_analysis: {
      user_level: learnerEsi,
      expert_level: referenceEsi,
      comparison
    },
    scorecard: {
      total: scorePercent,
      possible: 100,
      percentage: scorePercent,
      domains: [
        domain('esi', learnerEsi === referenceEsi ? 25 : 0, 25, { label: 'Final ESI accuracy' }),
        domain('interview', 12, 15, { label: 'Interview coverage' }),
        domain('focused_exam', 8, 10, { label: 'Focused exam selection' }),
        domain('diagnosis', 0, 0, {
          label: 'Working diagnosis',
          scored: false,
          scoring_status: 'formative_only',
          scoring_basis: sourceLimited ? 'source_record_diagnosis_unavailable' : 'case_truth_diagnosis_available',
          source_limited: sourceLimited,
          formative_score: 6,
          formative_possible: 10
        }),
        domain('referral', 0, 0, {
          label: 'Consult judgment',
          scored: false,
          scoring_status: 'formative_only',
          scoring_basis: sourceLimited ? 'clinician_approved_consult_unavailable' : 'case_truth_referral_available',
          source_limited: sourceLimited,
          formative_score: 4,
          formative_possible: 6
        }),
        domain('escalation', highRiskUndertriage ? 5 : 16, 20, { label: 'Initial management priorities' }),
        domain('reassessment', 0, 0, {
          label: 'Reassessment targets',
          scored: false,
          scoring_status: 'formative_only',
          scoring_basis: sourceLimited ? 'reassessment_truth_unavailable' : 'case_truth_reassessment_available',
          source_limited: sourceLimited,
          formative_score: 3,
          formative_possible: 5
        }),
        domain('soap', 9, 12, { label: 'SOAP note' }),
        domain('sbar', 6, 10, { label: 'SBAR handoff' })
      ]
    },
    workflow_analysis: {
      interview: {
        covered_domains: ['Chief concern', 'Risk symptoms'],
        missed_domains: highRiskUndertriage ? ['Shock symptoms', 'Medication risk'] : []
      },
      escalation: {
        expected: [{ category: 'Stabilization', name: 'Monitored bed' }],
        matched: highRiskUndertriage ? [] : [{ category: 'Stabilization', name: 'Monitored bed' }],
        missed: highRiskUndertriage ? [{ category: 'Stabilization', name: 'Monitored bed' }] : [],
        extra: []
      },
      diagnosis: {
        source_limited: sourceLimited,
        evidence_status: sourceLimited ? 'source_record_diagnosis_unavailable' : 'diagnosis_truth_available',
        scoring_basis: sourceLimited ? 'formative_reasoning_structure' : 'case_truth_diagnosis_comparison'
      },
      referral: {
        source_limited: sourceLimited,
        evidence_status: sourceLimited ? 'clinician_approved_consult_unavailable' : 'consult_truth_available',
        scoring_basis: sourceLimited ? 'unscored_formative_consult_reasoning' : 'case_truth_consult_comparison'
      },
      reassessment: {
        source_limited: sourceLimited,
        evidence_status: sourceLimited ? 'reassessment_truth_unavailable' : 'reassessment_truth_available',
        scoring_basis: sourceLimited ? 'unscored_formative_reassessment_reasoning' : 'case_truth_reassessment_comparison'
      },
      sbar: {
        missing: highRiskUndertriage ? ['Assessment'] : [],
        gaps: highRiskUndertriage ? ['Name acuity risk explicitly'] : []
      }
    },
    clinical_decision_review: {
      safety_flags: highRiskUndertriage ? ['high_risk_undertriage'] : []
    },
    learner_profile_delta: {
      esi_error_direction: comparison,
      interview_gaps: highRiskUndertriage ? ['Shock symptoms', 'Medication risk'] : [],
      missed_escalation_categories: highRiskUndertriage ? ['Stabilization'] : [],
      weak_sbar_sections: highRiskUndertriage ? ['Assessment'] : []
    },
    optional_ai_probe: {
      aiDraftRequested
    }
  };
}

function findCase(cases, predicate, fallbackIndex = 0) {
  return cases.find(predicate) || cases[fallbackIndex];
}

function scanKeys(value, path = '') {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => scanKeys(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const currentPath = path ? `${path}.${key}` : key;
    const keyLower = key.toLowerCase();
    const own = DISALLOWED_KEYS.includes(keyLower) ? [currentPath] : [];
    return [...own, ...scanKeys(child, currentPath)];
  });
}

function scanDirectIdentifierValues(value, path = '') {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => scanDirectIdentifierValues(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== 'object') {
    const text = cleanText(value);
    if (!text) return [];
    const looksLikeEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
    const looksLikeRestrictedClinicalId = /\b(?:subject_id|hadm_id|stay_id|mrn)\s*[:=]\s*\d+\b/i.test(text);
    return looksLikeEmail || looksLikeRestrictedClinicalId ? [{ path, value: text.slice(0, 80) }] : [];
  }
  return Object.entries(value).flatMap(([key, child]) => scanDirectIdentifierValues(child, path ? `${path}.${key}` : key));
}

function probe(id, passed, evidence, failure = '') {
  return {
    id,
    passed: Boolean(passed),
    failure: passed ? '' : failure,
    evidence
  };
}

function markdown(report) {
  const lines = [
    '# Educational Outcomes Runtime Report',
    '',
    `Generated at: ${report.generated_at}`,
    '',
    `Review status: ${report.review_status}`,
    '',
    'This report proves the deterministic metrics service can generate a bounded, privacy-safe pilot export from completed feedback-shaped objects. It does not prove educational efficacy or hospital-performance transfer.',
    '',
    '## Summary',
    '',
    `- Probes passed: ${report.summary.passed_probes}/${report.summary.total_probes}`,
    `- Export rows: ${report.summary.export_row_count}`,
    `- High-risk undertriage rows: ${report.summary.high_risk_undertriage_rows}`,
    `- Source-limited feedback rows: ${report.summary.source_limited_feedback_rows}`,
    `- Disallowed export keys: ${report.summary.privacy_disallowed_key_count}`,
    `- Direct identifier values: ${report.summary.direct_identifier_value_count}`,
    '',
    '## Probe Results',
    '',
    '| Probe | Passed |',
    '|---|---:|',
    ...report.probes.map((item) => `| ${item.id} | ${item.passed} |`),
    '',
    '## Required Next Actions',
    '',
    ...report.next_actions.map((item) => `- ${item}`)
  ];
  return `${lines.join('\n')}\n`;
}

const cases = readJson(CASES_PATH);
const highRiskCase = findCase(cases, (caseRecord) => Number(caseRecord.acuity) <= 2);
const lowerAcuityCase = findCase(cases, (caseRecord) => Number(caseRecord.acuity) >= 4, 0);
const midAcuityCase = findCase(cases, (caseRecord) => Number(caseRecord.acuity) === 3, 0);

const feedbackFixtures = [
  {
    label: 'high_risk_undertriage',
    caseRecord: highRiskCase,
    feedback: baseFeedback({
      caseRecord: highRiskCase,
      learnerEsi: Math.min(5, Number(highRiskCase.acuity) + 2),
      referenceEsi: Number(highRiskCase.acuity),
      comparison: 'Under-triaged',
      scorePercent: 51,
      sourceLimited: true,
      aiDraftRequested: true
    })
  },
  {
    label: 'matched_mid_acuity',
    caseRecord: midAcuityCase,
    feedback: baseFeedback({
      caseRecord: midAcuityCase,
      learnerEsi: Number(midAcuityCase.acuity),
      referenceEsi: Number(midAcuityCase.acuity),
      comparison: 'Correct',
      scorePercent: 86,
      sourceLimited: true
    })
  },
  {
    label: 'lower_acuity_overtriage',
    caseRecord: lowerAcuityCase,
    feedback: baseFeedback({
      caseRecord: lowerAcuityCase,
      learnerEsi: Math.max(1, Number(lowerAcuityCase.acuity) - 2),
      referenceEsi: Number(lowerAcuityCase.acuity),
      comparison: 'Over-triaged',
      scorePercent: 69,
      sourceLimited: true
    })
  }
];

const metricRows = feedbackFixtures.map((fixture) => extractEducationalOutcomeMetrics(fixture.feedback, {
  caseRecord: fixture.caseRecord,
  learnerLevel: 'm3_m4_probe',
  cohort: 'pilot_probe',
  aiDraftRequested: Boolean(fixture.feedback.optional_ai_probe?.aiDraftRequested)
}));
const metricSummary = summarizeEducationalOutcomeMetrics(metricRows);
const privacySafeExport = buildPrivacySafeEducationalOutcomeExport(metricRows, {
  cohort: 'pilot_probe',
  learnerLevel: 'm3_m4_probe'
});

const disallowedKeyPaths = scanKeys(privacySafeExport);
const directIdentifierValues = scanDirectIdentifierValues(privacySafeExport);
const sourceLimitedRows = privacySafeExport.rows.filter((row) => Object.values(row.source_limited_feedback || {}).some(Boolean));
const highRiskUndertriageRows = privacySafeExport.rows.filter((row) => row.high_risk_undertriage);
const lowerAcuityOvertriageRows = privacySafeExport.rows.filter((row) => row.lower_acuity_overtriage);

const probes = [
  probe(
    'metrics_extract_three_fixture_rows',
    metricRows.length === 3 && privacySafeExport.row_count === 3,
    { metric_rows: metricRows.length, export_rows: privacySafeExport.row_count },
    'Expected three metric rows and three export rows.'
  ),
  probe(
    'high_risk_undertriage_detected',
    highRiskUndertriageRows.length >= 1 && metricSummary.high_risk_undertriage_rate !== null,
    { high_risk_undertriage_rows: highRiskUndertriageRows.length, rate: metricSummary.high_risk_undertriage_rate },
    'Expected high-risk undertriage to be detected in the synthetic high-risk fixture.'
  ),
  probe(
    'lower_acuity_overtriage_detected',
    lowerAcuityOvertriageRows.length >= 1,
    { lower_acuity_overtriage_rows: lowerAcuityOvertriageRows.length },
    'Expected lower-acuity overtriage to be detected in the synthetic low-acuity fixture.'
  ),
  probe(
    'source_limited_feedback_exposure_detected',
    sourceLimitedRows.length === privacySafeExport.row_count,
    { source_limited_rows: sourceLimitedRows.length, export_rows: privacySafeExport.row_count },
    'Expected source-limited diagnosis, consult, or reassessment exposure in every fixture row.'
  ),
  probe(
    'optional_ai_never_used_for_scoring',
    privacySafeExport.rows.every((row) => row.optional_ai?.draft_used_for_scoring === false),
    { rows_with_ai_draft_scoring: privacySafeExport.rows.filter((row) => row.optional_ai?.draft_used_for_scoring).length },
    'Optional AI draft telemetry must never mark AI as used for scoring.'
  ),
  probe(
    'privacy_export_excludes_disallowed_keys',
    disallowedKeyPaths.length === 0,
    { disallowed_key_paths: disallowedKeyPaths },
    'Privacy-safe export contains disallowed direct-identifier or raw text keys.'
  ),
  probe(
    'privacy_export_excludes_direct_identifier_values',
    directIdentifierValues.length === 0,
    { direct_identifier_values: directIdentifierValues },
    'Privacy-safe export contains direct identifier-looking values.'
  )
];

const failedProbes = probes.filter((item) => !item.passed);
const report = {
  schema_version: 'educational_outcomes_runtime_report_v1',
  generated_at: new Date().toISOString(),
  review_status: 'runtime_outcome_instrumentation_probe_complete_needs_pilot_validation',
  warning: 'Runtime probes verify deterministic metric extraction and privacy-safe export shape only. They do not prove learner improvement, response-process validity, or multi-site educational effectiveness.',
  fixtures: feedbackFixtures.map((fixture) => ({
    label: fixture.label,
    case_id: fixture.caseRecord.id,
    public_case_uid: fixture.caseRecord.source?.public_case_uid || '',
    reference_esi: fixture.caseRecord.acuity,
    complaint: fixture.caseRecord.complaint
  })),
  summary: {
    total_probes: probes.length,
    passed_probes: probes.length - failedProbes.length,
    failed_probes: failedProbes.length,
    all_probes_passed: failedProbes.length === 0,
    metric_row_count: metricRows.length,
    export_row_count: privacySafeExport.row_count,
    high_risk_undertriage_rows: highRiskUndertriageRows.length,
    lower_acuity_overtriage_rows: lowerAcuityOvertriageRows.length,
    source_limited_feedback_rows: sourceLimitedRows.length,
    privacy_disallowed_key_count: disallowedKeyPaths.length,
    direct_identifier_value_count: directIdentifierValues.length,
    pilot_studies_completed: 0,
    multi_site_studies_completed: 0
  },
  metric_summary: metricSummary,
  privacy_safe_export: privacySafeExport,
  probes,
  next_actions: [
    'Run the same export against real pilot sessions only after privacy/governance approval.',
    'Add faculty-reviewed rationale-quality and response-process ratings before making clinical-judgment improvement claims.',
    'Compare privacy-safe simulator metrics with held-out case performance, OSCE or simulation-lab performance, and delayed retention measures.',
    'Keep source-limited feedback exposure in every cohort report so formative-only domains are not mistaken for validated summative scores.'
  ]
};

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, markdown(report), 'utf8');

console.log(JSON.stringify({
  review_status: report.review_status,
  probes: `${report.summary.passed_probes}/${report.summary.total_probes}`,
  export_row_count: report.summary.export_row_count,
  high_risk_undertriage_rows: report.summary.high_risk_undertriage_rows,
  source_limited_feedback_rows: report.summary.source_limited_feedback_rows,
  privacy_disallowed_key_count: report.summary.privacy_disallowed_key_count,
  direct_identifier_value_count: report.summary.direct_identifier_value_count
}, null, 2));
