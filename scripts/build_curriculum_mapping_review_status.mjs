import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OBJECTIVE_MATRIX_PATH = join(ROOT, 'docs', 'case_objective_matrix.json');
const CORE_EPA_MAP_PATH = join(ROOT, 'docs', 'core_epa_curriculum_map.json');
const REVIEWS_PATH = join(ROOT, 'docs', 'curriculum_mapping_reviews.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'curriculum_mapping_review_status.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'curriculum_mapping_review_status.md');

const ALLOWED_DECISIONS = new Set([
  'approved_for_national_release',
  'approved_for_supervised_pilot_only',
  'revisions_required',
  'rejected'
]);

const ALLOWED_UNSUPPORTED_EPA_DECISIONS = new Set([
  'approved_out_of_scope',
  'feature_required_before_release',
  'pilot_only_exclusion',
  'rejected'
]);

const REQUIRED_CASE_REVIEW_ROLES = [
  'clinical_educator',
  'simulation_educator',
  'curriculum_or_clerkship_director'
];

const REQUIRED_WORKFLOW_REVIEW_ROLES = [
  'clinical_educator',
  'assessment_or_curriculum_reviewer'
];

const RESTRICTED_KEYS = new Set([
  'student_name',
  'student_email',
  'student_id',
  'learner_name',
  'learner_email',
  'patient_name',
  'subject_id',
  'stay_id',
  'hadm_id',
  'patient_id',
  'mrn',
  'csn',
  'encounter_id',
  'raw_learner_text',
  'free_text',
  'transcript'
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

function isPendingText(value) {
  return /^(pending|todo|tbd|unknown|n\/a|not reviewed)$/i.test(cleanText(value));
}

function hasCompleteValue(value) {
  if (value === false || value === true || typeof value === 'number') return true;
  if (typeof value === 'string') return cleanText(value).length > 0 && !isPendingText(value);
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

function flatten(raw, keys) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  for (const key of keys) {
    if (Array.isArray(raw[key])) return raw[key];
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

function reviewerRoles(review) {
  const roles = new Set(asArray(review.reviewer_roles).map(cleanText).filter(Boolean));
  for (const reviewer of asArray(review.reviewed_by)) {
    for (const role of asArray(reviewer?.role || reviewer?.roles)) {
      const clean = cleanText(role);
      if (clean) roles.add(clean);
    }
  }
  return roles;
}

function reviewerEvidenceComplete(review, requiredRoles) {
  const reviewers = asArray(review.reviewed_by);
  const identities = new Set(reviewers.map(reviewerIdentity).filter(Boolean));
  const roles = reviewerRoles(review);
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

function hasAll(values, requiredValues) {
  const present = new Set(asArray(values).map(cleanText).filter(Boolean));
  return requiredValues.every((item) => present.has(item));
}

function validateCaseReview(review, caseMapping, objectiveEntry, index) {
  const issues = [];
  const label = `case_mapping_reviews[${index}]`;
  const decision = cleanText(review.review_decision || review.decision || review.status);
  const nationalApproval = decision === 'approved_for_national_release';
  const pilotApproval = decision === 'approved_for_supervised_pilot_only';
  const requiredDomains = ['noticing', 'interpreting', 'responding', 'reflecting'];

  if (!ALLOWED_DECISIONS.has(decision)) {
    issues.push(`${label}.review_decision must be one of ${[...ALLOWED_DECISIONS].join(', ')}.`);
  }
  if (!hasCompleteValue(review.review_id)) issues.push(`${label}.review_id is required.`);
  if (!hasCompleteValue(review.reviewed_at)) issues.push(`${label}.reviewed_at is required.`);
  if (!hasCompleteValue(review.signature_attestation)) issues.push(`${label}.signature_attestation is required.`);
  if (!reviewerEvidenceComplete(review, REQUIRED_CASE_REVIEW_ROLES)) {
    issues.push(`${label}.reviewed_by must include credentialed reviewers covering ${REQUIRED_CASE_REVIEW_ROLES.join(', ')}.`);
  }
  if (!hasAll(review.objective_domains_reviewed, requiredDomains)) {
    issues.push(`${label}.objective_domains_reviewed must include ${requiredDomains.join(', ')}.`);
  }
  if (!hasAll(review.epas_reviewed, caseMapping.mapped_epas || [])) {
    issues.push(`${label}.epas_reviewed must include every current mapped EPA for ${caseMapping.case_id}.`);
  }
  if (!hasCompleteValue(review.learner_level_and_supervision_rationale)) {
    issues.push(`${label}.learner_level_and_supervision_rationale is required.`);
  }
  if (!hasCompleteValue(review.assessment_use)) {
    issues.push(`${label}.assessment_use is required.`);
  }
  if (!hasCompleteValue(review.objective_alignment_rationale)) {
    issues.push(`${label}.objective_alignment_rationale is required.`);
  }
  if (!hasCompleteValue(review.case_truth_limitations_reviewed)) {
    issues.push(`${label}.case_truth_limitations_reviewed is required.`);
  }
  if ((nationalApproval || pilotApproval) && objectiveEntry?.review_status !== 'draft_needs_clinician_educator_review') {
    issues.push(`${label} must align with current objective-matrix review status.`);
  }
  if (nationalApproval && hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes must be cleared before national approval.`);
  }
  if ((pilotApproval || decision === 'revisions_required' || decision === 'rejected') && !hasCompleteValue(review.restrictions_or_required_changes)) {
    issues.push(`${label}.restrictions_or_required_changes must explain non-national decisions.`);
  }

  const restricted = collectRestrictedKeys(review);
  if (restricted.length) issues.push(`${label} includes restricted or direct identifier keys: ${restricted.join(', ')}.`);

  return {
    case_id: caseMapping.case_id,
    review_id: cleanText(review.review_id) || `missing_${index}`,
    review_decision: decision || 'missing',
    valid: issues.length === 0,
    nationally_approved: issues.length === 0 && nationalApproval,
    supervised_pilot_approved: issues.length === 0 && pilotApproval,
    issues
  };
}

function validateWorkflowReview(review, phase, index) {
  const issues = [];
  const label = `workflow_phase_reviews[${index}]`;
  const decision = cleanText(review.review_decision || review.decision || review.status);
  const nationalApproval = decision === 'approved_for_national_release';
  const pilotApproval = decision === 'approved_for_supervised_pilot_only';

  if (!ALLOWED_DECISIONS.has(decision)) {
    issues.push(`${label}.review_decision must be one of ${[...ALLOWED_DECISIONS].join(', ')}.`);
  }
  if (!hasCompleteValue(review.review_id)) issues.push(`${label}.review_id is required.`);
  if (!hasCompleteValue(review.reviewed_at)) issues.push(`${label}.reviewed_at is required.`);
  if (!hasCompleteValue(review.signature_attestation)) issues.push(`${label}.signature_attestation is required.`);
  if (!reviewerEvidenceComplete(review, REQUIRED_WORKFLOW_REVIEW_ROLES)) {
    issues.push(`${label}.reviewed_by must include credentialed reviewers covering ${REQUIRED_WORKFLOW_REVIEW_ROLES.join(', ')}.`);
  }
  if (!hasAll(review.epas_reviewed, phase.mapped_epas || [])) {
    issues.push(`${label}.epas_reviewed must include every EPA mapped to workflow phase ${phase.id}.`);
  }
  if (!hasCompleteValue(review.workflow_alignment_rationale)) {
    issues.push(`${label}.workflow_alignment_rationale is required.`);
  }
  if (!hasCompleteValue(review.assessment_boundary)) {
    issues.push(`${label}.assessment_boundary is required.`);
  }
  if (!hasCompleteValue(review.supervision_or_scope_notes)) {
    issues.push(`${label}.supervision_or_scope_notes is required.`);
  }
  if (nationalApproval && hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes must be cleared before national approval.`);
  }
  if ((pilotApproval || decision === 'revisions_required' || decision === 'rejected') && !hasCompleteValue(review.restrictions_or_required_changes)) {
    issues.push(`${label}.restrictions_or_required_changes must explain non-national decisions.`);
  }

  const restricted = collectRestrictedKeys(review);
  if (restricted.length) issues.push(`${label} includes restricted or direct identifier keys: ${restricted.join(', ')}.`);

  return {
    workflow_phase_id: phase.id,
    review_id: cleanText(review.review_id) || `missing_${index}`,
    review_decision: decision || 'missing',
    valid: issues.length === 0,
    nationally_approved: issues.length === 0 && nationalApproval,
    supervised_pilot_approved: issues.length === 0 && pilotApproval,
    issues
  };
}

function validateUnsupportedEpaDecision(decisionRecord, epa, index) {
  const issues = [];
  const label = `unsupported_epa_decisions[${index}]`;
  const decision = cleanText(decisionRecord.decision || decisionRecord.review_decision || decisionRecord.status);
  const nationalResolved = decision === 'approved_out_of_scope';

  if (!ALLOWED_UNSUPPORTED_EPA_DECISIONS.has(decision)) {
    issues.push(`${label}.decision must be one of ${[...ALLOWED_UNSUPPORTED_EPA_DECISIONS].join(', ')}.`);
  }
  if (!hasCompleteValue(decisionRecord.review_id)) issues.push(`${label}.review_id is required.`);
  if (!hasCompleteValue(decisionRecord.reviewed_at)) issues.push(`${label}.reviewed_at is required.`);
  if (!hasCompleteValue(decisionRecord.signature_attestation)) issues.push(`${label}.signature_attestation is required.`);
  if (!reviewerEvidenceComplete(decisionRecord, REQUIRED_WORKFLOW_REVIEW_ROLES)) {
    issues.push(`${label}.reviewed_by must include credentialed reviewers covering ${REQUIRED_WORKFLOW_REVIEW_ROLES.join(', ')}.`);
  }
  if (!hasCompleteValue(decisionRecord.exclusion_or_feature_rationale)) {
    issues.push(`${label}.exclusion_or_feature_rationale is required.`);
  }
  if (nationalResolved && hasCompleteValue(decisionRecord.required_changes)) {
    issues.push(`${label}.required_changes must be cleared before approved_out_of_scope.`);
  }
  if (decision !== 'approved_out_of_scope' && !hasCompleteValue(decisionRecord.restrictions_or_required_changes)) {
    issues.push(`${label}.restrictions_or_required_changes is required for unresolved unsupported EPAs.`);
  }

  const restricted = collectRestrictedKeys(decisionRecord);
  if (restricted.length) issues.push(`${label} includes restricted or direct identifier keys: ${restricted.join(', ')}.`);

  return {
    epa_id: epa.id,
    review_id: cleanText(decisionRecord.review_id) || `missing_${index}`,
    decision: decision || 'missing',
    valid: issues.length === 0,
    nationally_resolved: issues.length === 0 && nationalResolved,
    issues
  };
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function markdown(data) {
  const lines = [
    '# Curriculum Mapping Review Status',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Review file present: ${data.summary.review_file_present}`,
    `- Case mappings: ${data.summary.case_mappings}`,
    `- Submitted case reviews: ${data.summary.submitted_case_reviews}`,
    `- Valid case reviews: ${data.summary.valid_case_reviews}`,
    `- Nationally approved case mappings: ${data.summary.nationally_approved_case_mappings}`,
    `- Case mappings missing review: ${data.summary.case_mappings_missing_review}`,
    `- Workflow phases missing review: ${data.summary.workflow_phases_missing_review}`,
    `- Unsupported EPA decisions missing: ${data.summary.unsupported_epa_decisions_missing}`,
    `- Ready for national curriculum release: ${data.summary.ready_for_national_curriculum_release}`,
    '',
    '## Case Mapping Status',
    '',
    '| Case | Decision | Valid | National Approval | Issues |',
    '|---|---|---:|---:|---:|',
    ...data.case_mapping_review_status.map((row) =>
      `| ${markdownEscape(row.case_id)} | ${row.review_decision} | ${row.valid} | ${row.nationally_approved} | ${row.issue_count} |`
    ),
    '',
    '## Workflow Phase Status',
    '',
    '| Phase | Decision | Valid | National Approval | Issues |',
    '|---|---|---:|---:|---:|',
    ...data.workflow_phase_review_status.map((row) =>
      `| ${markdownEscape(row.workflow_phase_id)} | ${row.review_decision} | ${row.valid} | ${row.nationally_approved} | ${row.issue_count} |`
    ),
    '',
    '## Reviewer Input',
    '',
    'Completed curriculum reviews should be recorded in `docs/curriculum_mapping_reviews.json` using the `review_submission_template` in the JSON artifact. Draft objective and Core EPA maps are not faculty approval evidence.'
  ];
  return `${lines.join('\n')}\n`;
}

const objectiveMatrix = readJson(OBJECTIVE_MATRIX_PATH);
const coreEpaMap = readJson(CORE_EPA_MAP_PATH);
const reviewFile = readOptionalJson(REVIEWS_PATH);
const caseReviews = flatten(reviewFile, ['case_mapping_reviews', 'case_reviews', 'reviews']);
const workflowReviews = flatten(reviewFile, ['workflow_phase_reviews', 'workflow_reviews']);
const unsupportedEpaDecisions = flatten(reviewFile, ['unsupported_epa_decisions', 'unsupported_epa_reviews']);
const objectiveByCaseId = new Map((objectiveMatrix.cases || []).map((entry) => [entry.case_id, entry]));
const caseMappingById = new Map((coreEpaMap.case_epa_map || []).map((entry) => [entry.case_id, entry]));
const workflowPhaseById = new Map((coreEpaMap.workflow_phase_map || []).map((entry) => [entry.id, entry]));
const unsupportedEpas = (coreEpaMap.core_epas || []).filter((epa) => epa.app_alignment_status === 'not_currently_supported');
const unsupportedEpaById = new Map(unsupportedEpas.map((epa) => [epa.id, epa]));
const issues = [];

if (reviewFile && reviewFile.schema_version !== 'curriculum_mapping_reviews_v1') {
  issues.push('curriculum_mapping_reviews.json must use schema_version curriculum_mapping_reviews_v1.');
}

const caseReviewStatusById = new Map();
const seenCases = new Set();
for (const [index, review] of caseReviews.entries()) {
  const caseId = cleanText(review.case_id);
  const caseMapping = caseMappingById.get(caseId);
  const objectiveEntry = objectiveByCaseId.get(caseId);
  if (!caseMapping || !objectiveEntry) {
    issues.push(`case_mapping_reviews[${index}].case_id does not match current objective/Core EPA map: ${caseId || 'missing'}.`);
    continue;
  }
  const status = validateCaseReview(review, caseMapping, objectiveEntry, index);
  if (seenCases.has(caseId)) status.issues.push(`case_mapping_reviews[${index}].case_id is duplicated: ${caseId}.`);
  seenCases.add(caseId);
  caseReviewStatusById.set(caseId, status);
  issues.push(...status.issues);
}

const workflowReviewStatusById = new Map();
const seenWorkflowPhases = new Set();
for (const [index, review] of workflowReviews.entries()) {
  const phaseId = cleanText(review.workflow_phase_id || review.phase_id);
  const phase = workflowPhaseById.get(phaseId);
  if (!phase) {
    issues.push(`workflow_phase_reviews[${index}].workflow_phase_id does not match current workflow phase map: ${phaseId || 'missing'}.`);
    continue;
  }
  const status = validateWorkflowReview(review, phase, index);
  if (seenWorkflowPhases.has(phaseId)) status.issues.push(`workflow_phase_reviews[${index}].workflow_phase_id is duplicated: ${phaseId}.`);
  seenWorkflowPhases.add(phaseId);
  workflowReviewStatusById.set(phaseId, status);
  issues.push(...status.issues);
}

const unsupportedDecisionStatusById = new Map();
const seenUnsupportedEpas = new Set();
for (const [index, decisionRecord] of unsupportedEpaDecisions.entries()) {
  const epaId = cleanText(decisionRecord.epa_id);
  const epa = unsupportedEpaById.get(epaId);
  if (!epa) {
    issues.push(`unsupported_epa_decisions[${index}].epa_id does not match current unsupported EPAs: ${epaId || 'missing'}.`);
    continue;
  }
  const status = validateUnsupportedEpaDecision(decisionRecord, epa, index);
  if (seenUnsupportedEpas.has(epaId)) status.issues.push(`unsupported_epa_decisions[${index}].epa_id is duplicated: ${epaId}.`);
  seenUnsupportedEpas.add(epaId);
  unsupportedDecisionStatusById.set(epaId, status);
  issues.push(...status.issues);
}

const caseMappingReviewStatus = (coreEpaMap.case_epa_map || []).map((mapping) => {
  const status = caseReviewStatusById.get(mapping.case_id) || {
    case_id: mapping.case_id,
    review_id: 'not_submitted',
    review_decision: 'not_reviewed',
    valid: false,
    nationally_approved: false,
    supervised_pilot_approved: false,
    issues: ['No completed curriculum case-mapping review submitted.']
  };
  return {
    ...status,
    mapped_epas: mapping.mapped_epas || [],
    mapped_epa_count: mapping.mapped_epa_count || 0,
    issue_count: status.issues.length
  };
});

const workflowPhaseReviewStatus = (coreEpaMap.workflow_phase_map || []).map((phase) => {
  const status = workflowReviewStatusById.get(phase.id) || {
    workflow_phase_id: phase.id,
    review_id: 'not_submitted',
    review_decision: 'not_reviewed',
    valid: false,
    nationally_approved: false,
    supervised_pilot_approved: false,
    issues: ['No completed curriculum workflow-phase review submitted.']
  };
  return {
    ...status,
    mapped_epas: phase.mapped_epas || [],
    issue_count: status.issues.length
  };
});

const unsupportedEpaDecisionStatus = unsupportedEpas.map((epa) => {
  const status = unsupportedDecisionStatusById.get(epa.id) || {
    epa_id: epa.id,
    review_id: 'not_submitted',
    decision: 'not_reviewed',
    valid: false,
    nationally_resolved: false,
    issues: ['No completed unsupported-EPA scope decision submitted.']
  };
  return {
    ...status,
    epa_title: epa.title,
    issue_count: status.issues.length
  };
});

const validCaseReviews = caseMappingReviewStatus.filter((row) => row.valid).length;
const nationallyApprovedCaseMappings = caseMappingReviewStatus.filter((row) => row.nationally_approved).length;
const caseMappingsMissingReview = caseMappingReviewStatus.filter((row) => row.review_decision === 'not_reviewed').length;
const validWorkflowReviews = workflowPhaseReviewStatus.filter((row) => row.valid).length;
const nationallyApprovedWorkflowPhases = workflowPhaseReviewStatus.filter((row) => row.nationally_approved).length;
const workflowPhasesMissingReview = workflowPhaseReviewStatus.filter((row) => row.review_decision === 'not_reviewed').length;
const validUnsupportedEpaDecisions = unsupportedEpaDecisionStatus.filter((row) => row.valid).length;
const nationallyResolvedUnsupportedEpas = unsupportedEpaDecisionStatus.filter((row) => row.nationally_resolved).length;
const unsupportedEpaDecisionsMissing = unsupportedEpaDecisionStatus.filter((row) => row.decision === 'not_reviewed').length;
const invalidReviewInputCount = issues.length;
const readyForNationalCurriculumRelease = caseMappingReviewStatus.length > 0
  && nationallyApprovedCaseMappings === caseMappingReviewStatus.length
  && nationallyApprovedWorkflowPhases === workflowPhaseReviewStatus.length
  && nationallyResolvedUnsupportedEpas === unsupportedEpaDecisionStatus.length
  && invalidReviewInputCount === 0;

const artifact = {
  schema_version: 'curriculum_mapping_review_status_v1',
  generated_at: new Date().toISOString(),
  review_status: !reviewFile
    ? 'curriculum_mapping_review_inputs_pending'
    : invalidReviewInputCount > 0
      ? 'curriculum_mapping_review_inputs_invalid'
      : readyForNationalCurriculumRelease
        ? 'curriculum_mapping_ready_for_national_release'
        : 'curriculum_mapping_review_inputs_partial',
  warning: 'This status validates completed curriculum mapping review submissions. It does not replace clinician case-truth review, entrustment decisions, curriculum committee approval, or learner outcome validation.',
  source_contract: {
    objective_matrix_schema: objectiveMatrix.schema_version,
    core_epa_curriculum_map_schema: coreEpaMap.schema_version,
    completed_review_file_present: Boolean(reviewFile),
    completed_review_file_path: 'docs/curriculum_mapping_reviews.json',
    required_completed_review_schema: 'curriculum_mapping_reviews_v1'
  },
  summary: {
    review_file_present: Boolean(reviewFile),
    case_mappings: caseMappingReviewStatus.length,
    submitted_case_reviews: caseReviews.length,
    valid_case_reviews: validCaseReviews,
    nationally_approved_case_mappings: nationallyApprovedCaseMappings,
    case_mappings_missing_review: caseMappingsMissingReview,
    workflow_phases: workflowPhaseReviewStatus.length,
    submitted_workflow_reviews: workflowReviews.length,
    valid_workflow_reviews: validWorkflowReviews,
    nationally_approved_workflow_phases: nationallyApprovedWorkflowPhases,
    workflow_phases_missing_review: workflowPhasesMissingReview,
    unsupported_epas: unsupportedEpaDecisionStatus.length,
    submitted_unsupported_epa_decisions: unsupportedEpaDecisions.length,
    valid_unsupported_epa_decisions: validUnsupportedEpaDecisions,
    nationally_resolved_unsupported_epas: nationallyResolvedUnsupportedEpas,
    unsupported_epa_decisions_missing: unsupportedEpaDecisionsMissing,
    invalid_review_input_count: invalidReviewInputCount,
    ready_for_national_curriculum_release: readyForNationalCurriculumRelease,
    case_review_decision_counts: countBy(caseMappingReviewStatus, (row) => row.review_decision),
    workflow_review_decision_counts: countBy(workflowPhaseReviewStatus, (row) => row.review_decision),
    unsupported_epa_decision_counts: countBy(unsupportedEpaDecisionStatus, (row) => row.decision)
  },
  review_submission_template: {
    schema_version: 'curriculum_mapping_reviews_v1',
    case_mapping_reviews: [
      {
        case_id: caseMappingReviewStatus[0]?.case_id || '',
        review_id: 'curriculum_case_review_001',
        review_decision: 'approved_for_national_release | approved_for_supervised_pilot_only | revisions_required | rejected',
        reviewed_by: [
          {
            name: '',
            role: 'clinical_educator | simulation_educator | curriculum_or_clerkship_director',
            institution: '',
            credential_or_position: ''
          }
        ],
        reviewed_at: '',
        objective_domains_reviewed: ['noticing', 'interpreting', 'responding', 'reflecting'],
        epas_reviewed: caseMappingReviewStatus[0]?.mapped_epas || [],
        learner_level_and_supervision_rationale: '',
        assessment_use: 'formative_only | supervised_pilot | summative_assessment',
        objective_alignment_rationale: '',
        case_truth_limitations_reviewed: '',
        required_changes: [],
        restrictions_or_required_changes: [],
        signature_attestation: ''
      }
    ],
    workflow_phase_reviews: [
      {
        workflow_phase_id: workflowPhaseReviewStatus[0]?.workflow_phase_id || '',
        review_id: 'curriculum_workflow_review_001',
        review_decision: 'approved_for_national_release | approved_for_supervised_pilot_only | revisions_required | rejected',
        reviewed_by: [
          {
            name: '',
            role: 'clinical_educator | assessment_or_curriculum_reviewer',
            institution: '',
            credential_or_position: ''
          }
        ],
        reviewed_at: '',
        epas_reviewed: workflowPhaseReviewStatus[0]?.mapped_epas || [],
        workflow_alignment_rationale: '',
        assessment_boundary: '',
        supervision_or_scope_notes: '',
        required_changes: [],
        restrictions_or_required_changes: [],
        signature_attestation: ''
      }
    ],
    unsupported_epa_decisions: [
      {
        epa_id: unsupportedEpaDecisionStatus[0]?.epa_id || '',
        review_id: 'unsupported_epa_decision_001',
        decision: 'approved_out_of_scope | feature_required_before_release | pilot_only_exclusion | rejected',
        reviewed_by: [
          {
            name: '',
            role: 'clinical_educator | assessment_or_curriculum_reviewer',
            institution: '',
            credential_or_position: ''
          }
        ],
        reviewed_at: '',
        exclusion_or_feature_rationale: '',
        required_changes: [],
        restrictions_or_required_changes: [],
        signature_attestation: ''
      }
    ]
  },
  case_mapping_review_status: caseMappingReviewStatus,
  workflow_phase_review_status: workflowPhaseReviewStatus,
  unsupported_epa_decision_status: unsupportedEpaDecisionStatus,
  issues,
  readiness_effect: {
    educational_validity_gate_can_pass_from_current_curriculum_reviews: readyForNationalCurriculumRelease,
    missing_case_mapping_reviews_block_release: caseMappingsMissingReview > 0,
    missing_workflow_phase_reviews_block_release: workflowPhasesMissingReview > 0,
    missing_unsupported_epa_decisions_block_release: unsupportedEpaDecisionsMissing > 0,
    invalid_curriculum_review_inputs_block_release: invalidReviewInputCount > 0
  }
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  review_file_present: artifact.summary.review_file_present,
  submitted_case_reviews: artifact.summary.submitted_case_reviews,
  valid_case_reviews: artifact.summary.valid_case_reviews,
  case_mappings_missing_review: artifact.summary.case_mappings_missing_review,
  workflow_phases_missing_review: artifact.summary.workflow_phases_missing_review,
  unsupported_epa_decisions_missing: artifact.summary.unsupported_epa_decisions_missing,
  ready_for_national_curriculum_release:
    artifact.summary.ready_for_national_curriculum_release,
  status_path: OUTPUT_JSON_PATH
}, null, 2));
