import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASE_DOMAIN_PACKETS_PATH = join(ROOT, 'docs', 'feedback_case_domain_review_packets.json');
const CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_adjudication_status.json');
const RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'feedback_integrity_runtime_report.json');
const REVIEWS_PATH = join(ROOT, 'docs', 'feedback_case_domain_calibration_reviews.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'feedback_case_domain_calibration_review_status.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'feedback_case_domain_calibration_review_status.md');

const ALLOWED_REVIEW_STATUSES = new Set([
  'approved_for_national_release',
  'approved_for_summative_feedback',
  'approved_formative_only',
  'pilot_only',
  'changes_required',
  'blocked_truth_or_evidence_gap',
  'blocked_safety_or_equity_gap',
  'rejected'
]);

const APPROVAL_STATUSES = new Set([
  'approved_for_national_release',
  'approved_for_summative_feedback',
  'approved_formative_only',
  'pilot_only'
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
  'raw_case_text'
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
  for (const key of ['case_domain_reviews', 'feedback_case_domain_reviews', 'reviews']) {
    if (Array.isArray(rawReviews[key])) return rawReviews[key];
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

function evidenceBasisComplete(review, packet, isApproval) {
  if (!isApproval) return true;
  const basis = review.evidence_basis || {};
  const caseFacts = asArray(basis.case_fact_fields_reviewed);
  const sourceEvidence = [
    ...asArray(basis.clinician_adjudications),
    ...asArray(basis.quote_backed_sources),
    ...asArray(basis.local_standards)
  ];
  const requiredEvidence = packet.traceability?.required_case_evidence || [];
  const factsCoverRequired = requiredEvidence.length === 0
    || requiredEvidence.every((field) => caseFacts.includes(field));
  const hasSourceBasis = sourceEvidence.length > 0;
  return factsCoverRequired && hasSourceBasis;
}

function validateScope(review, packet, isApproval) {
  const scope = cleanText(review.release_scope);
  if (!isApproval) return true;
  if (!scope) return false;
  if (review.review_status === 'approved_for_national_release') {
    return ['national_formative', 'national_summative'].includes(scope);
  }
  if (review.review_status === 'approved_for_summative_feedback') {
    return ['single_institution', 'national_summative'].includes(scope);
  }
  if (review.review_status === 'approved_formative_only') {
    return ['supervised_pilot_only', 'single_institution', 'national_formative'].includes(scope);
  }
  if (review.review_status === 'pilot_only') {
    return scope === 'supervised_pilot_only';
  }
  return Boolean(packet);
}

function validateReview(review, packet, context, index) {
  const issues = [];
  const label = `case_domain_reviews[${index}]`;
  const status = cleanText(review.review_status || review.status);
  const isApproval = APPROVAL_STATUSES.has(status);
  const isNationalApproval = status === 'approved_for_national_release';
  const isSummativeApproval = status === 'approved_for_summative_feedback';
  const sourceLimited = packet.traceability?.traceability_status === 'source_limited_formative_only';
  const numericMissingEvidence = packet.traceability?.expected_score_behavior?.startsWith('numeric')
    && (packet.traceability?.missing_required_case_evidence || []).length > 0;

  if (!ALLOWED_REVIEW_STATUSES.has(status)) {
    issues.push(`${label}.review_status must be one of ${[...ALLOWED_REVIEW_STATUSES].join(', ')}.`);
  }
  if (cleanText(review.packet_id || review.case_domain_review_id) !== packet.id) {
    issues.push(`${label}.packet_id must match ${packet.id}.`);
  }
  if (cleanText(review.case_id) !== packet.case_id) {
    issues.push(`${label}.case_id must match ${packet.case_id}.`);
  }
  if (cleanText(review.domain_key) !== packet.domain_key) {
    issues.push(`${label}.domain_key must match ${packet.domain_key}.`);
  }
  if (!hasCompleteValue(review.reviewed_at)) issues.push(`${label}.reviewed_at is required.`);
  if (!hasCompleteValue(review.signature_attestation)) issues.push(`${label}.signature_attestation is required.`);
  if (!reviewerEvidenceComplete(review, packet.reviewer_roles_required || [])) {
    issues.push(`${label}.reviewed_by must include at least two credentialed reviewers covering required roles: ${(packet.reviewer_roles_required || []).join(', ')}.`);
  }
  if (isApproval && !validateScope(review, packet, isApproval)) {
    issues.push(`${label}.release_scope is missing or incompatible with ${status}.`);
  }
  if (isApproval && review.scoring_behavior_approved !== true) {
    issues.push(`${label}.scoring_behavior_approved must be true for approval.`);
  }
  if (isApproval && review.learner_feedback_wording_approved !== true) {
    issues.push(`${label}.learner_feedback_wording_approved must be true for approval.`);
  }
  if (isApproval && !evidenceBasisComplete(review, packet, isApproval)) {
    issues.push(`${label}.evidence_basis must cover required case facts plus clinician adjudication, quote-backed evidence, or local standards.`);
  }
  if (isApproval && hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes must be cleared before approval.`);
  }
  if (['changes_required', 'blocked_truth_or_evidence_gap', 'blocked_safety_or_equity_gap', 'rejected'].includes(status) && !hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes is required for ${status}.`);
  }
  if ((isNationalApproval || isSummativeApproval) && sourceLimited) {
    issues.push(`${label} cannot approve national or summative feedback while ${packet.id} remains source-limited formative-only.`);
  }
  if ((isNationalApproval || isSummativeApproval) && numericMissingEvidence) {
    issues.push(`${label} cannot approve national or summative feedback while required numeric case evidence is missing.`);
  }
  if (isNationalApproval && !context.runtimeIntegrityPassed) {
    issues.push(`${label} cannot approve national release while feedback runtime integrity probes are not passing.`);
  }
  if (isNationalApproval && !context.claimEntailmentReady) {
    issues.push(`${label} cannot approve national release while feedback claim-entailment reviews are not nationally ready.`);
  }
  if (isNationalApproval && context.sourceLimitedPackets > 0) {
    issues.push(`${label} cannot approve national release while ${context.sourceLimitedPackets} source-limited feedback packets remain unresolved.`);
  }

  const restricted = collectRestrictedKeys(review);
  if (restricted.length) issues.push(`${label} includes restricted or direct identifier keys: ${restricted.join(', ')}.`);

  return {
    packet_id: packet.id,
    case_id: packet.case_id,
    domain_key: packet.domain_key,
    review_status: status || 'missing',
    valid: issues.length === 0,
    nationally_approved: issues.length === 0 && isNationalApproval,
    summative_approved: issues.length === 0 && isSummativeApproval,
    formative_only_approved: issues.length === 0 && status === 'approved_formative_only',
    pilot_only_approved: issues.length === 0 && status === 'pilot_only',
    source_limited: sourceLimited,
    issues
  };
}

function markdownEscape(value) {
  return cleanText(value).replace(/\|/g, '/');
}

function markdown(data) {
  const lines = [
    '# Feedback Case-Domain Calibration Review Status',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Review file present: ${data.summary.review_file_present}`,
    `- Submitted case-domain reviews: ${data.summary.submitted_case_domain_reviews}`,
    `- Valid case-domain reviews: ${data.summary.valid_case_domain_reviews}`,
    `- Pending case-domain reviews: ${data.summary.pending_case_domain_reviews}`,
    `- Nationally approved case-domain reviews: ${data.summary.nationally_approved_case_domain_reviews}`,
    `- Invalid review input count: ${data.summary.invalid_review_input_count}`,
    `- Ready for national feedback release: ${data.summary.ready_for_national_feedback_release}`,
    '',
    '## Packet Status',
    '',
    '| Packet | Case | Domain | Status | Valid | Issues |',
    '|---|---|---|---|---:|---:|',
    ...data.case_domain_review_status.map((row) =>
      `| ${markdownEscape(row.packet_id)} | ${row.case_id} | ${row.domain_key} | ${row.review_status} | ${row.valid} | ${row.issue_count} |`
    ),
    '',
    '## Reviewer Input',
    '',
    'Completed feedback calibration reviews should be recorded in `docs/feedback_case_domain_calibration_reviews.json` using the `review_submission_template` in the packet artifact. Packet generation and runtime probes do not equal clinician approval.'
  ];
  return `${lines.join('\n')}\n`;
}

const packets = readJson(CASE_DOMAIN_PACKETS_PATH);
const claimAdjudication = readJson(CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH);
const runtimeReport = readJson(RUNTIME_REPORT_PATH);
const reviewFile = readOptionalJson(REVIEWS_PATH);
const reviews = flattenReviews(reviewFile);
const packetRows = packets.case_domain_review_packets || [];
const packetById = new Map(packetRows.map((packet) => [packet.id, packet]));
const context = {
  runtimeIntegrityPassed: Boolean(runtimeReport.summary?.all_runtime_probes_passed),
  claimEntailmentReady: Boolean(claimAdjudication.summary?.ready_for_national_feedback_release),
  sourceLimitedPackets: packets.summary?.source_limited_packets || 0
};

const topLevelIssues = [];
if (reviewFile && reviewFile.schema_version !== 'feedback_case_domain_calibration_reviews_v1') {
  topLevelIssues.push('feedback_case_domain_calibration_reviews.json must use schema_version feedback_case_domain_calibration_reviews_v1.');
}

const seen = new Set();
const reviewStatusByPacketId = new Map();
for (const [index, review] of reviews.entries()) {
  const packetId = cleanText(review.packet_id || review.case_domain_review_id);
  const packet = packetById.get(packetId);
  if (!packet) {
    const status = {
      packet_id: packetId || 'missing',
      case_id: cleanText(review.case_id) || 'missing',
      domain_key: cleanText(review.domain_key) || 'missing',
      review_status: cleanText(review.review_status || review.status) || 'missing',
      valid: false,
      nationally_approved: false,
      summative_approved: false,
      formative_only_approved: false,
      pilot_only_approved: false,
      source_limited: false,
      issues: [`case_domain_reviews[${index}] does not match a current feedback case-domain packet.`]
    };
    reviewStatusByPacketId.set(`${packetId || 'missing'}:${index}`, status);
    continue;
  }
  const status = validateReview(review, packet, context, index);
  if (seen.has(packet.id)) {
    status.issues.push(`case_domain_reviews[${index}].packet_id is duplicated: ${packet.id}.`);
    status.valid = false;
    status.nationally_approved = false;
    status.summative_approved = false;
    status.formative_only_approved = false;
    status.pilot_only_approved = false;
  }
  seen.add(packet.id);
  reviewStatusByPacketId.set(packet.id, status);
}

const unmatchedReviewStatuses = [...reviewStatusByPacketId.entries()]
  .filter(([packetId]) => !packetById.has(packetId))
  .map(([, status]) => status);

const caseDomainReviewStatus = packetRows.map((packet) => {
  const status = reviewStatusByPacketId.get(packet.id) || {
    packet_id: packet.id,
    case_id: packet.case_id,
    domain_key: packet.domain_key,
    review_status: 'not_submitted',
    valid: false,
    nationally_approved: false,
    summative_approved: false,
    formative_only_approved: false,
    pilot_only_approved: false,
    source_limited: packet.traceability?.traceability_status === 'source_limited_formative_only',
    issues: ['No completed feedback case-domain calibration review submitted.']
  };
  return {
    ...status,
    required_reviewer_roles: packet.reviewer_roles_required || [],
    current_release_status: packet.current_release_status,
    priority: packet.priority,
    issue_count: status.issues.length
  };
});

const allSubmittedResults = [
  ...caseDomainReviewStatus.filter((row) => row.review_status !== 'not_submitted'),
  ...unmatchedReviewStatuses
];
const reviewInputIssues = [
  ...topLevelIssues,
  ...allSubmittedResults.flatMap((row) => row.issues)
];
const validRows = caseDomainReviewStatus.filter((row) => row.valid);
const nationallyApprovedRows = caseDomainReviewStatus.filter((row) => row.nationally_approved);
const sourceLimitedValidRows = caseDomainReviewStatus.filter((row) => row.source_limited && row.valid);
const pendingCaseDomainReviews = caseDomainReviewStatus.filter((row) => row.review_status === 'not_submitted').length;
const readyForNationalFeedbackRelease = caseDomainReviewStatus.length > 0
  && nationallyApprovedRows.length === caseDomainReviewStatus.length
  && reviewInputIssues.length === 0
  && pendingCaseDomainReviews === 0
  && context.runtimeIntegrityPassed
  && context.claimEntailmentReady
  && context.sourceLimitedPackets === 0;

const artifact = {
  schema_version: 'feedback_case_domain_calibration_review_status_v1',
  generated_at: new Date().toISOString(),
  review_status: !reviewFile
    ? 'feedback_case_domain_calibration_review_inputs_pending'
    : reviewInputIssues.length > 0
      ? 'feedback_case_domain_calibration_review_inputs_invalid'
      : readyForNationalFeedbackRelease
        ? 'feedback_case_domain_calibration_reviews_complete_ready_for_external_audit'
        : 'feedback_case_domain_calibration_reviews_partial_or_limited',
  warning: 'This status validates submitted case-domain feedback calibration reviews. It does not itself provide clinical approval, national release approval, or evidence that feedback improves learner outcomes.',
  source_contract: {
    feedback_case_domain_review_packets_schema: packets.schema_version,
    feedback_case_domain_review_packets_path: 'docs/feedback_case_domain_review_packets.json',
    feedback_claim_entailment_adjudication_status_schema: claimAdjudication.schema_version,
    feedback_integrity_runtime_report_schema: runtimeReport.schema_version,
    completed_review_file_present: Boolean(reviewFile),
    completed_review_file_path: 'docs/feedback_case_domain_calibration_reviews.json',
    required_completed_review_schema_version: 'feedback_case_domain_calibration_reviews_v1',
    allowed_review_statuses: [...ALLOWED_REVIEW_STATUSES].sort(),
    restricted_keys_blocked: [...RESTRICTED_KEYS].sort()
  },
  summary: {
    total_review_packets: caseDomainReviewStatus.length,
    review_file_present: Boolean(reviewFile),
    submitted_case_domain_reviews: reviews.length,
    valid_case_domain_reviews: validRows.length,
    nationally_approved_case_domain_reviews: nationallyApprovedRows.length,
    summative_approved_case_domain_reviews: caseDomainReviewStatus.filter((row) => row.summative_approved).length,
    formative_only_approved_case_domain_reviews: caseDomainReviewStatus.filter((row) => row.formative_only_approved).length,
    pilot_only_approved_case_domain_reviews: caseDomainReviewStatus.filter((row) => row.pilot_only_approved).length,
    source_limited_packets: packets.summary?.source_limited_packets || 0,
    source_limited_valid_reviews: sourceLimitedValidRows.length,
    pending_case_domain_reviews: pendingCaseDomainReviews,
    missing_case_domain_reviews: pendingCaseDomainReviews,
    invalid_review_input_count: reviewInputIssues.length,
    unmatched_submitted_reviews: unmatchedReviewStatuses.length,
    runtime_integrity_probe_passed: context.runtimeIntegrityPassed,
    claim_entailment_ready_for_national_release: context.claimEntailmentReady,
    ready_for_national_feedback_release: readyForNationalFeedbackRelease,
    review_status_counts: countBy(caseDomainReviewStatus, (row) => row.review_status),
    current_release_status_counts: countBy(caseDomainReviewStatus, (row) => row.current_release_status),
    required_reviewer_role_counts: countBy(caseDomainReviewStatus.flatMap((row) => row.required_reviewer_roles), (role) => role)
  },
  case_domain_review_status: caseDomainReviewStatus,
  unmatched_submitted_reviews: unmatchedReviewStatuses,
  readiness_effect: {
    feedback_integrity_gate_can_pass_from_current_reviews: readyForNationalFeedbackRelease,
    invalid_review_input_count: reviewInputIssues.length,
    source_limited_national_or_summative_approval_block_enforced: true,
    optional_ai_deterministic_feedback_block_enforced: true,
    generated_or_restricted_data_leakage_block_enforced: true,
    required_reviewer_role_coverage_enforced: true
  },
  issues: reviewInputIssues
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

if (reviewInputIssues.length) {
  console.error(`Feedback case-domain calibration review inputs are invalid. Issues: ${reviewInputIssues.length}. Status written to ${OUTPUT_JSON_PATH}`);
  for (const issue of reviewInputIssues.slice(0, 20)) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(JSON.stringify({
  review_status: artifact.review_status,
  review_file_present: artifact.summary.review_file_present,
  submitted_case_domain_reviews: artifact.summary.submitted_case_domain_reviews,
  valid_case_domain_reviews: artifact.summary.valid_case_domain_reviews,
  pending_case_domain_reviews: artifact.summary.pending_case_domain_reviews,
  invalid_review_input_count: artifact.summary.invalid_review_input_count,
  ready_for_national_feedback_release: artifact.summary.ready_for_national_feedback_release,
  status_path: OUTPUT_JSON_PATH
}, null, 2));
