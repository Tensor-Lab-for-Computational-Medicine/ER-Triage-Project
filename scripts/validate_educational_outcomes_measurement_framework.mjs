import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractEducationalOutcomeMetrics,
  summarizeEducationalOutcomeMetrics
} from '../frontend/src/services/educationalOutcomeMetricsService.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const FRAMEWORK_PATH = join(ROOT, 'docs', 'educational_outcomes_measurement_framework.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(existsSync(CASES_PATH), `Missing cases file: ${CASES_PATH}`);
assert(existsSync(FRAMEWORK_PATH), `Missing educational outcomes framework: ${FRAMEWORK_PATH}`);

const cases = readJson(CASES_PATH);
const framework = readJson(FRAMEWORK_PATH);

assert(framework.schema_version === 'educational_outcomes_measurement_framework_v1', 'Unexpected educational outcomes framework schema');
assert(framework.review_status === 'draft_instrumentation_framework_needs_pilot_validation', 'Outcomes framework must remain draft until pilot validation');
assert(framework.summary.total_metrics >= 15, 'Outcomes framework should define at least 15 metrics');
assert(framework.summary.currently_instrumented_metrics >= 10, 'Outcomes framework should expose currently instrumented metrics');
assert(framework.summary.source_limited_metrics >= 3, 'Outcomes framework should identify source-limited diagnosis, consult, and reassessment metrics');
assert(framework.summary.requires_external_validation_metrics >= 3, 'Outcomes framework should identify externally validated metrics');
assert(framework.summary.cases_mapped === cases.length, 'Outcomes framework case map must match case count');
assert(framework.summary.reviewed_outcome_studies === 0, 'Outcomes framework must not claim reviewed outcome studies');
assert(framework.case_measurement_map.length === cases.length, 'Case measurement map length must match cases');
assert(framework.privacy_safe_export_contract.exclude.includes('student email'), 'Privacy export contract must exclude direct student identifiers');
assert(framework.privacy_safe_export_contract.exclude.includes('direct patient identifiers'), 'Privacy export contract must exclude patient identifiers');

for (const metricId of [
  'esi_accuracy',
  'esi_error_direction',
  'high_risk_undertriage',
  'score_domain_percentages',
  'interview_domain_coverage',
  'escalation_action_alignment',
  'reassessment_target_score',
  'soap_note_score',
  'sbar_handoff_score',
  'source_limited_feedback_exposure',
  'osce_or_sim_lab_transfer'
]) {
  assert(framework.metric_definitions.some((item) => item.id === metricId), `Missing metric definition ${metricId}`);
}

const sampleFeedback = {
  session_summary: {
    case_id: 'case_undertriage_fixture',
    triage_level_assigned: 4
  },
  triage_analysis: {
    user_level: 4,
    expert_level: 2,
    comparison: 'Under-triaged'
  },
  scorecard: {
    total: 72,
    possible: 100,
    percentage: 72,
    domains: [
      { id: 'esi', label: 'Final ESI accuracy', score: 0, possible: 30, percentage: 0 },
      { id: 'interview', label: 'Interview coverage', score: 10, possible: 15, percentage: 67 },
      { id: 'escalation', label: 'Initial management priorities', score: 8, possible: 20, percentage: 40 },
      { id: 'reassessment', label: 'Reassessment targets', score: 5, possible: 10, percentage: 50 },
      { id: 'soap', label: 'SOAP note', score: 8, possible: 12, percentage: 67 },
      { id: 'sbar', label: 'SBAR handoff', score: 6, possible: 10, percentage: 60 }
    ]
  },
  workflow_analysis: {
    interview: {
      covered_domains: ['Chief concern'],
      missed_domains: ['Red flags']
    },
    escalation: {
      expected: [{ category: 'Stabilization', name: 'Monitored bed' }],
      matched: [],
      missed: [{ category: 'Stabilization', name: 'Monitored bed' }],
      extra: []
    },
    diagnosis: {
      source_limited: true,
      evidence_status: 'source_record_diagnosis_unavailable',
      scoring_basis: 'formative_reasoning_structure'
    },
    referral: {
      source_limited: true,
      evidence_status: 'clinician_approved_consult_unavailable',
      scoring_basis: 'unscored_formative_consult_reasoning'
    },
    reassessment: {
      source_limited: true,
      evidence_status: 'reassessment_truth_unavailable',
      scoring_basis: 'unscored_formative_reassessment_reasoning'
    },
    sbar: {
      missing: ['Assessment'],
      gaps: ['Name acuity risk explicitly']
    }
  },
  learner_profile_delta: {
    esi_error_direction: 'under_triage',
    interview_gaps: ['Red flags'],
    missed_escalation_categories: ['Stabilization'],
    weak_sbar_sections: ['Assessment']
  }
};

const sampleMetrics = extractEducationalOutcomeMetrics(sampleFeedback, {
  caseRecord: {
    id: 'case_undertriage_fixture',
    acuity: 2
  }
});
const sampleSummary = summarizeEducationalOutcomeMetrics([sampleMetrics]);

assert(sampleMetrics.esi_error_direction === 'under_triage', 'Synthetic metrics should classify undertriage');
assert(sampleMetrics.high_risk_undertriage === true, 'Synthetic metrics should identify high-risk undertriage');
assert(sampleMetrics.interview.missed_count === 1, 'Synthetic metrics should count missed interview domains');
assert(sampleMetrics.escalation.missed_categories.includes('Stabilization'), 'Synthetic metrics should preserve missed escalation category');
assert(sampleMetrics.source_limited_feedback.diagnosis_truth_source_limited === true, 'Synthetic metrics should mark source-limited diagnosis truth');
assert(sampleMetrics.source_limited_feedback.consult_truth_source_limited === true, 'Synthetic metrics should mark source-limited consult truth');
assert(sampleMetrics.source_limited_feedback.reassessment_truth_source_limited === true, 'Synthetic metrics should mark source-limited reassessment truth');
assert(sampleSummary.undertriage_rate === 100, 'Synthetic summary should compute undertriage rate');
assert(sampleSummary.source_limited_feedback_exposure_rate === 100, 'Synthetic summary should compute source-limited exposure rate');

console.log(JSON.stringify({
  framework_status: framework.review_status,
  total_metrics: framework.summary.total_metrics,
  current_metrics: framework.summary.currently_instrumented_metrics,
  source_limited_metrics: framework.summary.source_limited_metrics,
  external_validation_metrics: framework.summary.requires_external_validation_metrics,
  cases_mapped: framework.summary.cases_mapped,
  sample_undertriage_rate: sampleSummary.undertriage_rate
}, null, 2));
