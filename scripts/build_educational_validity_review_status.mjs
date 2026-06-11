import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EDUCATIONAL_VALIDITY_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'educational_validity_review_packets.json');
const CURRICULUM_MAPPING_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'curriculum_mapping_review_status.json');
const EDUCATIONAL_OUTCOMES_VALIDATION_STATUS_PATH = join(ROOT, 'docs', 'educational_outcomes_validation_status.json');
const EDUCATIONAL_OUTCOMES_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'educational_outcomes_runtime_report.json');
const REVIEWS_PATH = join(ROOT, 'docs', 'educational_validity_reviews.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'educational_validity_review_status.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'educational_validity_review_status.md');

const ALLOWED_REVIEW_STATUSES = new Set([
  'approved_for_national_educational_release',
  'approved_for_supervised_pilot_only',
  'approved_formative_only',
  'revisions_required',
  'blocked_pending_curriculum_or_outcome_evidence',
  'rejected'
]);

const APPROVAL_STATUSES = new Set([
  'approved_for_national_educational_release',
  'approved_for_supervised_pilot_only',
  'approved_formative_only'
]);

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
  'raw_rationale',
  'free_text',
  'soap_text',
  'ai_draft_text',
  'transcript',
  'message_text',
  'raw_case_text',
  'raw_patient_text'
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

function flattenReviews(rawReviews) {
  if (!rawReviews) return [];
  if (Array.isArray(rawReviews)) return rawReviews;
  for (const key of ['educational_validity_reviews', 'review_packet_reviews', 'packet_reviews', 'reviews']) {
    if (Array.isArray(rawReviews[key])) return rawReviews[key];
  }
  return [];
}

function packetRows(packets) {
  return [
    ...(packets.case_curriculum_mapping_packets || []),
    ...(packets.workflow_phase_review_packets || []),
    ...(packets.unsupported_epa_decision_packets || []),
    ...(packets.case_outcome_measurement_packets || []),
    ...(packets.outcome_metric_review_packets || []),
    ...(packets.outcome_study_packets || [])
  ];
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

function packetIdentifier(review) {
  return cleanText(review.packet_id || review.review_packet_id || review.educational_validity_packet_id);
}

function releaseScope(review) {
  return cleanText(review.release_scope || review.educational_release_scope || review.claim_scope);
}

function evidenceBasisComplete(review, packet, isApproval) {
  if (!isApproval) return true;
  const basis = review.evidence_basis || {};
  const sourceEvidence = [
    ...asArray(basis.curriculum_committee_review_ids),
    ...asArray(basis.curriculum_mapping_review_ids),
    ...asArray(basis.outcome_study_ids),
    ...asArray(basis.metric_review_ids),
    ...asArray(basis.faculty_rubric_ids),
    ...asArray(basis.irb_or_qi_approval_ids)
  ];
  if (packet.packet_type === 'case_curriculum_mapping_review') {
    return sourceEvidence.length > 0 && hasCompleteValue(review.objective_alignment_rationale);
  }
  if (packet.packet_type === 'workflow_phase_curriculum_review') {
    return sourceEvidence.length > 0 && hasCompleteValue(review.workflow_alignment_rationale);
  }
  if (packet.packet_type === 'unsupported_epa_scope_decision') {
    return hasCompleteValue(review.exclusion_or_feature_rationale);
  }
  if (packet.packet_type === 'case_outcome_measurement_review') {
    return sourceEvidence.length > 0 && hasCompleteValue(review.measurement_validity_rationale);
  }
  if (packet.packet_type === 'educational_outcome_metric_review') {
    return sourceEvidence.length > 0 && hasCompleteValue(review.metric_validity_rationale);
  }
  if (packet.packet_type === 'educational_outcome_study_evidence_packet') {
    return sourceEvidence.length > 0
      && hasCompleteValue(review.study_design_rationale)
      && hasCompleteValue(review.study_or_protocol_status);
  }
  return sourceEvidence.length > 0;
}

function validateReview(review, packet, context, index) {
  const issues = [];
  const label = `educational_validity_reviews[${index}]`;
  const reviewStatus = cleanText(review.review_status || review.review_decision || review.status);
  const isApproval = APPROVAL_STATUSES.has(reviewStatus);
  const isNationalApproval = reviewStatus === 'approved_for_national_educational_release';
  const scope = releaseScope(review);

  if (!ALLOWED_REVIEW_STATUSES.has(reviewStatus)) {
    issues.push(`${label}.review_status must be one of ${[...ALLOWED_REVIEW_STATUSES].join(', ')}.`);
  }
  if (packetIdentifier(review) !== packet.id) {
    issues.push(`${label}.packet_id must match ${packet.id}.`);
  }
  if (!hasCompleteValue(review.reviewed_at)) issues.push(`${label}.reviewed_at is required.`);
  if (!hasCompleteValue(review.signature_attestation)) issues.push(`${label}.signature_attestation is required.`);
  if (!reviewerEvidenceComplete(review, packet.reviewer_roles_required || [])) {
    issues.push(`${label}.reviewed_by must include at least two credentialed reviewers covering required roles: ${(packet.reviewer_roles_required || []).join(', ')}.`);
  }
  if (isApproval && !['formative_only', 'supervised_pilot_only', 'national_educational_release'].includes(scope)) {
    issues.push(`${label}.release_scope must be formative_only, supervised_pilot_only, or national_educational_release for approval.`);
  }
  if (reviewStatus === 'approved_for_national_educational_release' && scope !== 'national_educational_release') {
    issues.push(`${label}.release_scope must be national_educational_release for national approval.`);
  }
  if (reviewStatus === 'approved_for_supervised_pilot_only' && !['supervised_pilot_only', 'formative_only'].includes(scope)) {
    issues.push(`${label}.release_scope is incompatible with supervised pilot approval.`);
  }
  if (isApproval && !evidenceBasisComplete(review, packet, isApproval)) {
    issues.push(`${label}.evidence_basis and packet-specific rationale are required before approval.`);
  }
  if (isApproval && hasCompleteValue(review.restrictions_or_required_changes)) {
    issues.push(`${label}.restrictions_or_required_changes must be cleared before approval.`);
  }
  if (['revisions_required', 'blocked_pending_curriculum_or_outcome_evidence', 'rejected'].includes(reviewStatus)
    && !hasCompleteValue(review.restrictions_or_required_changes)) {
    issues.push(`${label}.restrictions_or_required_changes is required for ${reviewStatus}.`);
  }
  if (isNationalApproval && !context.curriculumReady) {
    issues.push(`${label} cannot approve national educational release while curriculum mapping review is not nationally ready.`);
  }
  if (isNationalApproval && !context.outcomeClaimsReady) {
    issues.push(`${label} cannot approve national educational release while educational outcome studies do not support validity claims.`);
  }
  if (isNationalApproval && !context.outcomeRuntimeReady) {
    issues.push(`${label} cannot approve national educational release while outcome runtime instrumentation or privacy probes are not passing.`);
  }
  if (isNationalApproval && packet.packet_type === 'educational_outcome_study_evidence_packet' && packet.current_valid_supporting_studies < 1) {
    issues.push(`${label} cannot approve study packet ${packet.id} without at least one valid supporting study.`);
  }
  if (isNationalApproval && packet.packet_type === 'educational_outcome_metric_review' && packet.metric_status === 'requires_external_validation') {
    issues.push(`${label} cannot approve metric ${packet.metric_id} for national educational release until external validation evidence is linked.`);
  }
  if (isNationalApproval && packet.packet_type === 'educational_outcome_metric_review' && packet.metric_status === 'source_limited') {
    issues.push(`${label} cannot approve source-limited metric ${packet.metric_id} for national educational release until source-limited behavior is resolved or explicitly excluded.`);
  }

  const restricted = collectRestrictedKeys(review);
  if (restricted.length) issues.push(`${label} includes restricted or direct identifier keys: ${restricted.join(', ')}.`);

  return {
    packet_id: packet.id,
    packet_type: packet.packet_type,
    review_status: reviewStatus || 'missing',
    valid: issues.length === 0,
    nationally_approved: issues.length === 0 && isNationalApproval,
    supervised_pilot_approved: issues.length === 0 && reviewStatus === 'approved_for_supervised_pilot_only',
    formative_only_approved: issues.length === 0 && reviewStatus === 'approved_formative_only',
    issues
  };
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function markdown(data) {
  const lines = [
    '# Educational Validity Review Status',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Review file present: ${data.summary.review_file_present}`,
    `- Total review packets: ${data.summary.total_review_packets}`,
    `- Submitted educational-validity reviews: ${data.summary.submitted_educational_validity_reviews}`,
    `- Valid educational-validity reviews: ${data.summary.valid_educational_validity_reviews}`,
    `- Nationally approved review packets: ${data.summary.nationally_approved_review_packets}`,
    `- Pending review packets: ${data.summary.pending_review_packets}`,
    `- Invalid review input count: ${data.summary.invalid_review_input_count}`,
    `- Ready for national educational release from reviews: ${data.summary.ready_for_national_educational_release_from_reviews}`,
    '',
    '## Packet Status',
    '',
    '| Packet | Type | Status | Valid | Issues |',
    '|---|---|---|---:|---:|',
    ...data.educational_validity_review_status.map((row) =>
      `| ${markdownEscape(row.packet_id)} | ${row.packet_type} | ${row.review_status} | ${row.valid} | ${row.issue_count} |`
    ),
    '',
    '## Reviewer Input',
    '',
    'Completed packet reviews should be recorded in `docs/educational_validity_reviews.json`. This status validates review input only; it does not replace curriculum committee approval, outcome-study evidence, IRB/QI review, or multi-site validation.'
  ];
  return `${lines.join('\n')}\n`;
}

const packets = readJson(EDUCATIONAL_VALIDITY_REVIEW_PACKETS_PATH);
const curriculumReviewStatus = readJson(CURRICULUM_MAPPING_REVIEW_STATUS_PATH);
const outcomesValidationStatus = readJson(EDUCATIONAL_OUTCOMES_VALIDATION_STATUS_PATH);
const outcomesRuntimeReport = readJson(EDUCATIONAL_OUTCOMES_RUNTIME_REPORT_PATH);
const reviewFile = readOptionalJson(REVIEWS_PATH);
const reviews = flattenReviews(reviewFile);
const packetsRows = packetRows(packets);
const packetById = new Map(packetsRows.map((packet) => [packet.id, packet]));
const context = {
  curriculumReady: Boolean(curriculumReviewStatus.summary?.ready_for_national_curriculum_release),
  outcomeClaimsReady: Boolean(outcomesValidationStatus.summary?.ready_for_educational_validity_claims),
  outcomeRuntimeReady:
    Boolean(outcomesRuntimeReport.summary?.all_probes_passed)
    && outcomesRuntimeReport.summary?.privacy_disallowed_key_count === 0
    && outcomesRuntimeReport.summary?.direct_identifier_value_count === 0
};

const topLevelIssues = [];
if (reviewFile && reviewFile.schema_version !== 'educational_validity_reviews_v1') {
  topLevelIssues.push('educational_validity_reviews.json must use schema_version educational_validity_reviews_v1.');
}

const seen = new Set();
const reviewStatusByPacketId = new Map();
for (const [index, review] of reviews.entries()) {
  const packetId = packetIdentifier(review);
  const packet = packetById.get(packetId);
  if (!packet) {
    const status = {
      packet_id: packetId || 'missing',
      packet_type: cleanText(review.packet_type) || 'missing',
      review_status: cleanText(review.review_status || review.review_decision || review.status) || 'missing',
      valid: false,
      nationally_approved: false,
      supervised_pilot_approved: false,
      formative_only_approved: false,
      issues: [`educational_validity_reviews[${index}] does not match a current educational-validity packet.`]
    };
    reviewStatusByPacketId.set(`${packetId || 'missing'}:${index}`, status);
    continue;
  }

  const status = validateReview(review, packet, context, index);
  if (seen.has(packet.id)) {
    status.issues.push(`educational_validity_reviews[${index}].packet_id is duplicated: ${packet.id}.`);
    status.valid = false;
    status.nationally_approved = false;
    status.supervised_pilot_approved = false;
    status.formative_only_approved = false;
  }
  seen.add(packet.id);
  reviewStatusByPacketId.set(packet.id, status);
}

const unmatchedReviewStatuses = [...reviewStatusByPacketId.entries()]
  .filter(([packetId]) => !packetById.has(packetId))
  .map(([, status]) => status);

const educationalValidityReviewStatus = packetsRows.map((packet) => {
  const status = reviewStatusByPacketId.get(packet.id) || {
    packet_id: packet.id,
    packet_type: packet.packet_type,
    review_status: 'not_submitted',
    valid: false,
    nationally_approved: false,
    supervised_pilot_approved: false,
    formative_only_approved: false,
    issues: ['No completed educational-validity packet review submitted.']
  };
  return {
    ...status,
    priority: packet.priority,
    required_reviewer_roles: packet.reviewer_roles_required || [],
    issue_count: status.issues.length
  };
});

const allSubmittedResults = [
  ...educationalValidityReviewStatus.filter((row) => row.review_status !== 'not_submitted'),
  ...unmatchedReviewStatuses
];
const reviewInputIssues = [
  ...topLevelIssues,
  ...allSubmittedResults.flatMap((row) => row.issues)
];
const validRows = educationalValidityReviewStatus.filter((row) => row.valid);
const nationallyApprovedRows = educationalValidityReviewStatus.filter((row) => row.nationally_approved);
const pendingReviewPackets = educationalValidityReviewStatus.filter((row) => row.review_status === 'not_submitted').length;
const readyForNationalEducationalRelease = educationalValidityReviewStatus.length > 0
  && nationallyApprovedRows.length === educationalValidityReviewStatus.length
  && reviewInputIssues.length === 0
  && pendingReviewPackets === 0
  && context.curriculumReady
  && context.outcomeClaimsReady
  && context.outcomeRuntimeReady;

const artifact = {
  schema_version: 'educational_validity_review_status_v1',
  generated_at: new Date().toISOString(),
  review_status: !reviewFile
    ? 'educational_validity_review_inputs_pending'
    : reviewInputIssues.length > 0
      ? 'educational_validity_review_inputs_invalid'
      : readyForNationalEducationalRelease
        ? 'educational_validity_reviews_complete_ready_for_external_audit'
        : 'educational_validity_reviews_partial_or_limited',
  warning: 'This status validates completed educational-validity review submissions. It does not itself prove improved clinical judgment, authorize hospital-performance claims, or replace curriculum committee, IRB/QI, or multi-site outcome evidence.',
  source_contract: {
    educational_validity_review_packets_schema: packets.schema_version,
    educational_validity_review_packets_path: 'docs/educational_validity_review_packets.json',
    curriculum_mapping_review_status_schema: curriculumReviewStatus.schema_version,
    educational_outcomes_validation_status_schema: outcomesValidationStatus.schema_version,
    educational_outcomes_runtime_report_schema: outcomesRuntimeReport.schema_version,
    completed_review_file_present: Boolean(reviewFile),
    completed_review_file_path: 'docs/educational_validity_reviews.json',
    required_completed_review_schema: 'educational_validity_reviews_v1',
    allowed_review_statuses: [...ALLOWED_REVIEW_STATUSES].sort(),
    restricted_keys_blocked: [...RESTRICTED_KEYS].sort()
  },
  summary: {
    review_file_present: Boolean(reviewFile),
    total_review_packets: educationalValidityReviewStatus.length,
    case_curriculum_mapping_packets: packets.summary?.case_curriculum_mapping_packets || 0,
    workflow_phase_review_packets: packets.summary?.workflow_phase_review_packets || 0,
    unsupported_epa_decision_packets: packets.summary?.unsupported_epa_decision_packets || 0,
    case_outcome_measurement_packets: packets.summary?.case_outcome_measurement_packets || 0,
    outcome_metric_review_packets: packets.summary?.outcome_metric_review_packets || 0,
    outcome_study_packets: packets.summary?.outcome_study_packets || 0,
    submitted_educational_validity_reviews: reviews.length,
    valid_educational_validity_reviews: validRows.length,
    nationally_approved_review_packets: nationallyApprovedRows.length,
    supervised_pilot_approved_review_packets:
      educationalValidityReviewStatus.filter((row) => row.supervised_pilot_approved).length,
    formative_only_approved_review_packets:
      educationalValidityReviewStatus.filter((row) => row.formative_only_approved).length,
    pending_review_packets: pendingReviewPackets,
    invalid_review_input_count: reviewInputIssues.length,
    unmatched_submitted_reviews: unmatchedReviewStatuses.length,
    curriculum_ready_for_national_release: context.curriculumReady,
    educational_outcome_claims_ready: context.outcomeClaimsReady,
    educational_outcome_runtime_ready: context.outcomeRuntimeReady,
    ready_for_national_educational_release_from_reviews: readyForNationalEducationalRelease,
    review_status_counts: countBy(educationalValidityReviewStatus, (row) => row.review_status),
    packet_type_counts: countBy(educationalValidityReviewStatus, (row) => row.packet_type),
    required_reviewer_role_counts:
      countBy(educationalValidityReviewStatus.flatMap((row) => row.required_reviewer_roles), (role) => role)
  },
  educational_validity_review_status: educationalValidityReviewStatus,
  unmatched_submitted_reviews: unmatchedReviewStatuses,
  readiness_effect: {
    educational_validity_gate_can_pass_from_current_reviews: readyForNationalEducationalRelease,
    improved_clinical_judgment_claims_blocked_without_outcome_evidence: true,
    national_release_requires_curriculum_and_outcome_readiness: true,
    required_reviewer_role_coverage_enforced: true,
    restricted_data_leakage_block_enforced: true,
    invalid_review_input_count: reviewInputIssues.length
  },
  issues: reviewInputIssues
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

if (reviewInputIssues.length) {
  console.error(`Educational-validity review inputs are invalid. Issues: ${reviewInputIssues.length}. Status written to ${OUTPUT_JSON_PATH}`);
  for (const issue of reviewInputIssues.slice(0, 20)) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(JSON.stringify({
  review_status: artifact.review_status,
  review_file_present: artifact.summary.review_file_present,
  total_review_packets: artifact.summary.total_review_packets,
  submitted_educational_validity_reviews: artifact.summary.submitted_educational_validity_reviews,
  valid_educational_validity_reviews: artifact.summary.valid_educational_validity_reviews,
  pending_review_packets: artifact.summary.pending_review_packets,
  invalid_review_input_count: artifact.summary.invalid_review_input_count,
  ready_for_national_educational_release_from_reviews:
    artifact.summary.ready_for_national_educational_release_from_reviews,
  status_path: OUTPUT_JSON_PATH
}, null, 2));
