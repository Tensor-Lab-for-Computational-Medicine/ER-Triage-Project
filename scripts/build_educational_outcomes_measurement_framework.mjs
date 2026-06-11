import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EDUCATIONAL_OUTCOME_METRIC_DEFINITIONS,
  summarizeOutcomeMetricDefinitions
} from '../frontend/src/services/educationalOutcomeMetricsService.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const OBJECTIVE_MATRIX_PATH = join(ROOT, 'docs', 'case_objective_matrix.json');
const CORE_EPA_CURRICULUM_MAP_PATH = join(ROOT, 'docs', 'core_epa_curriculum_map.json');
const OUTCOMES_PROTOCOL_PATH = join(ROOT, 'docs', 'educational_outcomes_protocol.md');
const NATIONAL_READINESS_REPORT_PATH = join(ROOT, 'docs', 'national_scale_readiness_report.json');
const METRICS_SERVICE_PATH = join(ROOT, 'frontend', 'src', 'services', 'educationalOutcomeMetricsService.js');
const LEARNER_PROFILE_SERVICE_PATH = join(ROOT, 'frontend', 'src', 'services', 'learnerProfileService.js');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'educational_outcomes_measurement_framework.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'educational_outcomes_measurement_framework.md');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  return existsSync(path) ? readJson(path) : null;
}

function evidencePath(path) {
  return path.replace(`${ROOT}\\`, '').replaceAll('\\', '/');
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

const cases = readJson(CASES_PATH);
const objectiveMatrix = readOptionalJson(OBJECTIVE_MATRIX_PATH);
const coreEpaCurriculumMap = readOptionalJson(CORE_EPA_CURRICULUM_MAP_PATH);
const readinessReport = readOptionalJson(NATIONAL_READINESS_REPORT_PATH);
const definitionSummary = summarizeOutcomeMetricDefinitions();
const statusCounts = definitionSummary.status_counts;

const caseObjectiveById = new Map((objectiveMatrix?.cases || []).map((entry) => [entry.case_id, entry]));
const coreEpaByCaseId = new Map((coreEpaCurriculumMap?.case_epa_map || []).map((entry) => [entry.case_id, entry]));

const caseMeasurementMap = cases.map((caseRecord) => {
  const objective = caseObjectiveById.get(caseRecord.id) || {};
  const epa = coreEpaByCaseId.get(caseRecord.id) || {};
  return {
    case_id: caseRecord.id,
    public_case_uid: caseRecord.public_case_uid || caseRecord.source?.public_case_uid || '',
    reference_esi: caseRecord.acuity,
    complaint: caseRecord.complaint,
    measurement_status: 'draft_case_metrics_available_needs_expert_review',
    constructs_mapped: objective.constructs_mapped || objective.clinical_reasoning_domains || [
      'noticing',
      'interpreting',
      'responding',
      'reflecting'
    ],
    mapped_epas: epa.mapped_epas || [],
    evidence_limits: {
      diagnosis_truth: objective.evidence_limits?.diagnosis_truth_status || epa.evidence_limits?.diagnosis_truth || 'needs_case_truth_review',
      consult_truth: objective.evidence_limits?.consult_truth_status || epa.evidence_limits?.consult_truth || 'needs_case_truth_review',
      reassessment_truth: objective.evidence_limits?.reassessment_truth_status || epa.evidence_limits?.reassessment_truth || 'needs_case_truth_review',
      objective_data_truth: epa.evidence_limits?.objective_data_truth || 'needs_case_truth_review',
      learner_outcomes: 'not_yet_validated'
    }
  };
});

const artifact = {
  schema_version: 'educational_outcomes_measurement_framework_v1',
  generated_at: new Date().toISOString(),
  review_status: 'draft_instrumentation_framework_needs_pilot_validation',
  warning: 'This framework defines reproducible app signals for educational evaluation. It is not evidence that the simulator improves clinical judgment until usability, expert review, pilot, and multi-site outcome studies are completed.',
  summary: {
    total_metrics: definitionSummary.total_metrics,
    currently_instrumented_metrics: statusCounts.currently_instrumented || 0,
    source_limited_metrics: statusCounts.source_limited || 0,
    requires_external_validation_metrics: statusCounts.requires_external_validation || 0,
    cases_mapped: caseMeasurementMap.length,
    reviewed_case_outcome_maps: 0,
    reviewed_outcome_studies: 0,
    pilot_studies_completed: 0,
    multi_site_studies_completed: 0,
    deterministic_metric_service_present: existsSync(METRICS_SERVICE_PATH),
    learner_profile_service_present: existsSync(LEARNER_PROFILE_SERVICE_PATH),
    educational_outcomes_protocol_present: existsSync(OUTCOMES_PROTOCOL_PATH),
    readiness_verdict: readinessReport?.verdict || 'missing'
  },
  source_references: [
    {
      id: 'educational_outcomes_protocol',
      path: evidencePath(OUTCOMES_PROTOCOL_PATH),
      role: 'Defines construct model, study phases, outcomes, instrumentation requirements, and analysis plan.'
    },
    {
      id: 'outcome_metrics_service',
      path: evidencePath(METRICS_SERVICE_PATH),
      role: 'Extracts deterministic, privacy-safe encounter metrics from completed feedback objects.'
    },
    {
      id: 'learner_profile_service',
      path: evidencePath(LEARNER_PROFILE_SERVICE_PATH),
      role: 'Tracks local formative gap patterns for next-case recommendations.'
    },
    {
      id: 'case_objective_matrix',
      path: evidencePath(OBJECTIVE_MATRIX_PATH),
      role: 'Maps cases to draft learning objectives and evidence limits.'
    },
    {
      id: 'core_epa_curriculum_map',
      path: evidencePath(CORE_EPA_CURRICULUM_MAP_PATH),
      role: 'Maps workflow and cases to draft AAMC Core EPA curriculum planning categories.'
    }
  ],
  privacy_safe_export_contract: {
    exclude: [
      'student name',
      'student email',
      'student id',
      'direct patient identifiers',
      'raw optional AI draft text',
      'free-text learner rationale without institutional approval'
    ],
    include_by_default: [
      'case_id',
      'content_version',
      'cohort code if approved',
      'learner training level if approved',
      'ESI selection and direction',
      'score domains',
      'interview and escalation counts',
      'source-limited feedback exposure',
      'safety flags'
    ],
    review_status: 'draft_requires_institutional_privacy_review'
  },
  clinical_reasoning_constructs: [
    {
      id: 'noticing',
      app_signals: ['interview domain coverage', 'focused exam selection', 'objective safety reasoning']
    },
    {
      id: 'interpreting',
      app_signals: ['ESI accuracy', 'ESI error direction', 'diagnostic reasoning score']
    },
    {
      id: 'responding',
      app_signals: ['escalation action alignment', 'consult judgment', 'high-risk undertriage']
    },
    {
      id: 'reflecting',
      app_signals: ['reassessment target score', 'SOAP note score', 'SBAR handoff score', 'learner profile gap delta']
    }
  ],
  metric_definitions: EDUCATIONAL_OUTCOME_METRIC_DEFINITIONS,
  aggregation_plan: {
    release_level: [
      'Report metric schema version, case bundle version, source bundle version, and readiness gate statuses.'
    ],
    cohort_level: [
      'Report ESI accuracy, undertriage, overtriage, high-risk undertriage, mean domain scores, and source-limited feedback exposure with confidence intervals.',
      'Stratify only by privacy-approved learner level, cohort, case acuity, complaint category, and case review status.'
    ],
    validation_level: [
      'Compare simulator metrics against expert ESI consensus, faculty rubric scores, OSCE or simulation lab transfer, and delayed retention cases.',
      'Do not claim improvement in clinical judgment or hospital performance until pilot or multi-site external outcomes support the claim.'
    ]
  },
  validation_study_requirements: [
    'Complete response-process usability study with medical students and faculty observers.',
    'Complete clinician-educator review of case truth, scoring anchors, source-limited labels, and objective map.',
    'Run pre/post pilot with held-out cases and report undertriage and rationale-quality change.',
    'Run multi-site controlled or stepped-wedge study before making national efficacy claims.',
    'Link any external OSCE, simulation lab, clerkship, or workplace data only after governance approval.'
  ],
  case_measurement_map: caseMeasurementMap,
  metric_status_counts: countBy(EDUCATIONAL_OUTCOME_METRIC_DEFINITIONS, (item) => item.status)
};

function mdStatus(status) {
  return status.replaceAll('_', ' ');
}

function toMarkdown(data) {
  const lines = [
    '# Educational Outcomes Measurement Framework',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Review status: ${data.review_status}`,
    `- Metrics: ${data.summary.total_metrics}`,
    `- Currently instrumented: ${data.summary.currently_instrumented_metrics}`,
    `- Source-limited: ${data.summary.source_limited_metrics}`,
    `- Require external validation: ${data.summary.requires_external_validation_metrics}`,
    `- Cases mapped: ${data.summary.cases_mapped}`,
    `- Reviewed outcome studies: ${data.summary.reviewed_outcome_studies}`,
    '',
    '## Privacy-Safe Export Contract',
    '',
    `Default include: ${data.privacy_safe_export_contract.include_by_default.join(', ')}`,
    '',
    `Default exclude: ${data.privacy_safe_export_contract.exclude.join(', ')}`,
    '',
    '## Metrics',
    '',
    '| ID | Construct | Status | App Signal | Validation Need |',
    '|---|---|---|---|---|',
    ...data.metric_definitions.map((item) => `| ${item.id} | ${item.construct} | ${mdStatus(item.status)} | ${item.app_signal} | ${item.validation_need} |`),
    '',
    '## Validation Study Requirements',
    '',
    ...data.validation_study_requirements.map((item) => `- ${item}`),
    '',
    '## Source References',
    '',
    ...data.source_references.map((item) => `- ${item.id}: ${item.path} - ${item.role}`)
  ];
  return `${lines.join('\n')}\n`;
}

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, toMarkdown(artifact), 'utf8');

console.log(`Wrote educational outcomes framework to ${JSON_OUTPUT_PATH}`);
console.log(`Wrote Markdown summary to ${MD_OUTPUT_PATH}`);
