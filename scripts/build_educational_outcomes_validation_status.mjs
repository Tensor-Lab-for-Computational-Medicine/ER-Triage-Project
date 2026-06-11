import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FRAMEWORK_PATH = join(ROOT, 'docs', 'educational_outcomes_measurement_framework.json');
const RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'educational_outcomes_runtime_report.json');
const PROTOCOL_PATH = join(ROOT, 'docs', 'educational_outcomes_protocol.md');
const STUDIES_PATH = join(ROOT, 'docs', 'educational_outcome_studies.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'educational_outcomes_validation_status.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'educational_outcomes_validation_status.md');

const ALLOWED_PHASES = new Set([
  'response_process_usability',
  'single_site_pilot',
  'multi_site_controlled',
  'multi_site_stepped_wedge',
  'external_transfer_validation'
]);

const ALLOWED_STATUSES = new Set([
  'planned',
  'approved_not_started',
  'data_collection_active',
  'analysis_complete',
  'completed_positive_or_mixed',
  'completed_no_effect_or_harm',
  'rejected_or_invalid'
]);

const REQUIRED_PRIMARY_OUTCOMES = new Set([
  'esi_accuracy',
  'undertriage_rate',
  'rationale_quality'
]);

const REQUIRED_SAFETY_OUTCOMES = new Set([
  'dangerous_undertriage',
  'unsafe_disposition_reasoning',
  'unsupported_diagnostic_certainty'
]);

const RESTRICTED_KEYS = new Set([
  'student_name',
  'student_email',
  'student_id',
  'learner_name',
  'learner_email',
  'subject_id',
  'stay_id',
  'hadm_id',
  'patient_id',
  'mrn',
  'csn',
  'encounter_id',
  'raw_learner_text',
  'raw_rationale',
  'free_text',
  'soap_text',
  'ai_draft_text',
  'transcript',
  'message_text'
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  return existsSync(path) ? readJson(path) : null;
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function hasCompleteValue(value) {
  if (value === false || value === true || typeof value === 'number') return true;
  if (typeof value === 'string') return cleanText(value).length > 0 && !/^(pending|todo|tbd|unknown|n\/a|not reviewed)$/i.test(cleanText(value));
  if (Array.isArray(value)) return value.length > 0 && value.every(hasCompleteValue);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    return entries.length > 0 && entries.every(([, child]) => hasCompleteValue(child));
  }
  return false;
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function collectRestrictedKeys(value, path = '$', found = []) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectRestrictedKeys(item, `${path}[${index}]`, found));
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (RESTRICTED_KEYS.has(key)) found.push(childPath);
    collectRestrictedKeys(child, childPath, found);
  }
  return found;
}

function flattenStudies(rawStudies) {
  if (!rawStudies) return [];
  if (Array.isArray(rawStudies)) return rawStudies;
  for (const key of ['studies', 'outcome_studies', 'educational_outcome_studies']) {
    if (Array.isArray(rawStudies[key])) return rawStudies[key];
  }
  return [];
}

function reviewerIdentity(reviewer) {
  return cleanText([
    reviewer?.name,
    reviewer?.reviewer_id || reviewer?.id,
    reviewer?.institution,
    reviewer?.credential_or_position
  ].filter(Boolean).join('|'));
}

function reviewerRoles(study) {
  const roles = new Set(asArray(study.reviewer_roles).map(cleanText).filter(Boolean));
  for (const reviewer of asArray(study.reviewed_by)) {
    for (const role of asArray(reviewer?.role || reviewer?.roles)) {
      const clean = cleanText(role);
      if (clean) roles.add(clean);
    }
  }
  return roles;
}

function reviewerEvidenceComplete(study, requiredRoles) {
  const reviewers = asArray(study.reviewed_by);
  const identities = new Set(reviewers.map(reviewerIdentity).filter(Boolean));
  const roles = reviewerRoles(study);
  const reviewersHaveIdentity = reviewers.length >= 2 && identities.size >= 2;
  const reviewersHaveCredentials = reviewers.every((reviewer) =>
    hasCompleteValue(reviewer?.name || reviewer?.reviewer_id || reviewer?.id)
      && hasCompleteValue(reviewer?.role || reviewer?.roles)
      && hasCompleteValue(reviewer?.institution)
      && hasCompleteValue(reviewer?.credential_or_position)
  );
  return reviewersHaveIdentity
    && reviewersHaveCredentials
    && requiredRoles.every((role) => roles.has(role));
}

function hasAll(values, required) {
  const present = new Set(asArray(values).map(cleanText));
  return [...required].every((item) => present.has(item));
}

function numericAtLeast(value, minimum) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum;
}

function validateStudy(study, index) {
  const issues = [];
  const label = `studies[${index}]`;
  const phase = cleanText(study.phase);
  const status = cleanText(study.status);
  const completed = /^completed_/.test(status) || status === 'analysis_complete';
  const nationalEvidence = [
    'single_site_pilot',
    'multi_site_controlled',
    'multi_site_stepped_wedge',
    'external_transfer_validation'
  ].includes(phase) && completed && status !== 'completed_no_effect_or_harm';

  if (!hasCompleteValue(study.study_id)) issues.push(`${label}.study_id is required.`);
  if (!ALLOWED_PHASES.has(phase)) issues.push(`${label}.phase must be one of ${[...ALLOWED_PHASES].join(', ')}.`);
  if (!ALLOWED_STATUSES.has(status)) issues.push(`${label}.status must be one of ${[...ALLOWED_STATUSES].join(', ')}.`);
  if (!hasCompleteValue(study.title)) issues.push(`${label}.title is required.`);
  if (!hasCompleteValue(study.institution_or_sites)) issues.push(`${label}.institution_or_sites is required.`);
  if (!hasCompleteValue(study.design)) issues.push(`${label}.design is required.`);
  if (!numericAtLeast(study.sample_size, phase === 'response_process_usability' ? 10 : 40)) {
    issues.push(`${label}.sample_size is below the minimum for ${phase}.`);
  }
  if (!hasAll(study.primary_outcomes, REQUIRED_PRIMARY_OUTCOMES)) {
    issues.push(`${label}.primary_outcomes must include ${[...REQUIRED_PRIMARY_OUTCOMES].join(', ')}.`);
  }
  if (!hasAll(study.safety_outcomes, REQUIRED_SAFETY_OUTCOMES)) {
    issues.push(`${label}.safety_outcomes must include ${[...REQUIRED_SAFETY_OUTCOMES].join(', ')}.`);
  }
  if (!hasCompleteValue(study.analysis_plan)) issues.push(`${label}.analysis_plan is required.`);
  if (!hasCompleteValue(study.results_summary) && completed) {
    issues.push(`${label}.results_summary is required for completed or analysis-complete studies.`);
  }
  if (!hasCompleteValue(study.limitations) && completed) {
    issues.push(`${label}.limitations is required for completed or analysis-complete studies.`);
  }
  if (!hasCompleteValue(study.governance_approval)) {
    issues.push(`${label}.governance_approval is required.`);
  }
  if (!hasCompleteValue(study.privacy_review)) {
    issues.push(`${label}.privacy_review is required.`);
  }
  if (!hasCompleteValue(study.irb_or_qi_status)) {
    issues.push(`${label}.irb_or_qi_status is required.`);
  }
  if (!reviewerEvidenceComplete(study, ['clinical_educator', 'measurement_or_biostatistics_reviewer'])) {
    issues.push(`${label}.reviewed_by must include at least two credentialed reviewers with clinical_educator and measurement_or_biostatistics_reviewer roles.`);
  }
  if (nationalEvidence && !hasCompleteValue(study.effect_interpretation)) {
    issues.push(`${label}.effect_interpretation is required before a study supports readiness.`);
  }
  if (nationalEvidence && !hasCompleteValue(study.safety_interpretation)) {
    issues.push(`${label}.safety_interpretation is required before a study supports readiness.`);
  }

  const restricted = collectRestrictedKeys(study);
  if (restricted.length) issues.push(`${label} includes restricted or direct identifier keys: ${restricted.join(', ')}.`);

  return {
    study_id: cleanText(study.study_id) || `missing_${index}`,
    phase: phase || 'missing',
    status: status || 'missing',
    sample_size: Number(study.sample_size) || 0,
    valid: issues.length === 0,
    supports_national_readiness_claim: issues.length === 0 && nationalEvidence,
    issues
  };
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function markdown(data) {
  const lines = [
    '# Educational Outcomes Validation Status',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Study file present: ${data.summary.study_file_present}`,
    `- Submitted studies: ${data.summary.submitted_studies}`,
    `- Valid studies: ${data.summary.valid_studies}`,
    `- Completed pilot studies: ${data.summary.completed_pilot_studies}`,
    `- Completed multi-site studies: ${data.summary.completed_multi_site_studies}`,
    `- Invalid study input count: ${data.summary.invalid_study_input_count}`,
    `- Ready for educational validity claims: ${data.summary.ready_for_educational_validity_claims}`,
    '',
    '## Study Status',
    '',
    '| Study | Phase | Status | Valid | Supports Readiness | Issues |',
    '|---|---|---|---:|---:|---:|',
    ...data.study_status.map((row) =>
      `| ${markdownEscape(row.study_id)} | ${row.phase} | ${row.status} | ${row.valid} | ${row.supports_national_readiness_claim} | ${row.issue_count} |`
    ),
    '',
    '## Reviewer Input',
    '',
    'Completed studies should be recorded in `docs/educational_outcome_studies.json` using the `study_submission_template` in the JSON artifact. Do not claim improved clinical judgment or hospital performance until the relevant study rows are valid and externally reviewed.'
  ];
  return `${lines.join('\n')}\n`;
}

const framework = readJson(FRAMEWORK_PATH);
const runtimeReport = readJson(RUNTIME_REPORT_PATH);
const studyFile = readOptionalJson(STUDIES_PATH);
const studies = flattenStudies(studyFile);
const issues = [];

if (studyFile && studyFile.schema_version !== 'educational_outcome_studies_v1') {
  issues.push('educational_outcome_studies.json must use schema_version educational_outcome_studies_v1.');
}

const seen = new Set();
const studyStatus = studies.map((study, index) => {
  const status = validateStudy(study, index);
  if (seen.has(status.study_id)) {
    status.issues.push(`studies[${index}].study_id is duplicated: ${status.study_id}.`);
  }
  seen.add(status.study_id);
  issues.push(...status.issues);
  return {
    ...status,
    issue_count: status.issues.length
  };
});

const validStudies = studyStatus.filter((row) => row.valid);
const completedPilotStudies = validStudies.filter((row) => row.phase === 'single_site_pilot' && row.supports_national_readiness_claim);
const completedMultiSiteStudies = validStudies.filter((row) =>
  ['multi_site_controlled', 'multi_site_stepped_wedge', 'external_transfer_validation'].includes(row.phase)
    && row.supports_national_readiness_claim
);
const completedResponseProcessStudies = validStudies.filter((row) =>
  row.phase === 'response_process_usability' && ['analysis_complete', 'completed_positive_or_mixed'].includes(row.status)
);
const readyForEducationalValidityClaims = completedPilotStudies.length > 0
  && completedMultiSiteStudies.length > 0
  && completedResponseProcessStudies.length > 0
  && issues.length === 0
  && runtimeReport.summary?.all_probes_passed === true
  && runtimeReport.summary?.privacy_disallowed_key_count === 0
  && runtimeReport.summary?.direct_identifier_value_count === 0;

const artifact = {
  schema_version: 'educational_outcomes_validation_status_v1',
  generated_at: new Date().toISOString(),
  review_status: !studyFile
    ? 'educational_outcome_study_inputs_pending'
    : issues.length > 0
      ? 'educational_outcome_study_inputs_invalid'
      : readyForEducationalValidityClaims
        ? 'educational_outcome_validation_ready_for_external_audit'
        : 'educational_outcome_study_inputs_partial',
  warning: 'This status validates study-evidence submissions for educational outcomes. It does not replace IRB/QI review, curriculum committee approval, clinician-educator review, or publication-quality peer review.',
  source_contract: {
    educational_outcomes_framework_schema: framework.schema_version,
    educational_outcomes_runtime_report_schema: runtimeReport.schema_version,
    outcomes_protocol_present: existsSync(PROTOCOL_PATH),
    completed_study_file_present: Boolean(studyFile),
    completed_study_file_path: 'docs/educational_outcome_studies.json',
    required_completed_study_schema: 'educational_outcome_studies_v1'
  },
  summary: {
    study_file_present: Boolean(studyFile),
    submitted_studies: studies.length,
    valid_studies: validStudies.length,
    completed_response_process_studies: completedResponseProcessStudies.length,
    completed_pilot_studies: completedPilotStudies.length,
    completed_multi_site_studies: completedMultiSiteStudies.length,
    studies_supporting_national_readiness_claims:
      studyStatus.filter((row) => row.supports_national_readiness_claim).length,
    invalid_study_input_count: issues.length,
    ready_for_educational_validity_claims: readyForEducationalValidityClaims,
    phase_counts: countBy(studyStatus, (row) => row.phase),
    status_counts: countBy(studyStatus, (row) => row.status)
  },
  study_submission_template: {
    schema_version: 'educational_outcome_studies_v1',
    studies: [
      {
        study_id: 'single_site_pilot_001',
        phase: 'response_process_usability | single_site_pilot | multi_site_controlled | multi_site_stepped_wedge | external_transfer_validation',
        status: 'planned | approved_not_started | data_collection_active | analysis_complete | completed_positive_or_mixed | completed_no_effect_or_harm | rejected_or_invalid',
        title: '',
        institution_or_sites: [],
        design: '',
        sample_size: 0,
        primary_outcomes: ['esi_accuracy', 'undertriage_rate', 'rationale_quality'],
        safety_outcomes: ['dangerous_undertriage', 'unsafe_disposition_reasoning', 'unsupported_diagnostic_certainty'],
        analysis_plan: '',
        results_summary: '',
        limitations: '',
        governance_approval: '',
        privacy_review: '',
        irb_or_qi_status: '',
        effect_interpretation: '',
        safety_interpretation: '',
        reviewed_by: [
          {
            name: '',
            role: '',
            institution: '',
            credential_or_position: ''
          }
        ],
        signature_attestation: ''
      }
    ]
  },
  study_status: studyStatus,
  issues,
  readiness_effect: {
    educational_validity_gate_can_pass_from_current_studies: readyForEducationalValidityClaims,
    missing_study_file_blocks_release: !studyFile,
    invalid_study_inputs_block_release: issues.length > 0,
    pilot_or_multisite_evidence_missing: completedPilotStudies.length === 0 || completedMultiSiteStudies.length === 0
  }
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  study_file_present: artifact.summary.study_file_present,
  submitted_studies: artifact.summary.submitted_studies,
  valid_studies: artifact.summary.valid_studies,
  completed_pilot_studies: artifact.summary.completed_pilot_studies,
  completed_multi_site_studies: artifact.summary.completed_multi_site_studies,
  ready_for_educational_validity_claims: artifact.summary.ready_for_educational_validity_claims,
  status_path: OUTPUT_JSON_PATH
}, null, 2));
