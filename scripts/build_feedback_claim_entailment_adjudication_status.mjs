import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_review_packets.json');
const CLINICAL_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'clinical_review_adjudication_status.json');
const EVIDENCE_BACKLOG_PATH = join(ROOT, 'docs', 'evidence_review_backlog.json');
const CLAIM_REVIEWS_PATH = join(ROOT, 'docs', 'learner_facing_claim_entailment_reviews.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_adjudication_status.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_adjudication_status.md');

const ALLOWED_REVIEW_STATUSES = new Set([
  'approved_for_national_release',
  'approved_formative_only',
  'revisions_required',
  'rejected'
]);

const APPROVAL_STATUSES = new Set([
  'approved_for_national_release',
  'approved_formative_only'
]);

const RESTRICTED_KEYS = new Set([
  'subject_id',
  'stay_id',
  'hadm_id',
  'patient_id',
  'mrn',
  'csn',
  'encounter_id',
  'raw_row_index'
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

function flattenClaimReviews(rawReviews) {
  if (!rawReviews) return [];
  if (Array.isArray(rawReviews)) return rawReviews;
  for (const key of ['claim_reviews', 'reviews', 'claims']) {
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

function textListIncludes(values, patterns) {
  const haystack = asArray(values).map(cleanText).join(' | ').toLowerCase();
  return patterns.every((pattern) => pattern.test(haystack));
}

function evidenceBasisSufficient(review, requiresNationalEvidence) {
  const basis = asArray(review.evidence_basis);
  if (!textListIncludes(basis, [/feedback[_ -]?traceability[_ -]?matrix/])) return false;
  if (requiresNationalEvidence) {
    return textListIncludes(basis, [/case[_ -]?truth[_ -]?adjudication/])
      && textListIncludes(basis, [/(quote[_ -]?backed|clinician[_ -]?approved|local[_ -]?standard)/]);
  }
  return textListIncludes(basis, [/(case[_ -]?truth|quote[_ -]?backed|clinician[_ -]?approved|local[_ -]?standard|formative[_ -]?only|source[_ -]?limited|case[_ -]?source)/]);
}

function caseCoverageComplete(review, packet) {
  const reviewed = new Set(asArray(review.case_ids_reviewed).map(cleanText).filter(Boolean));
  return packet.case_ids.every((caseId) => reviewed.has(caseId));
}

function scopeSufficient(review) {
  return textListIncludes(review.claim_scope_reviewed, [
    /(scoring|formative|rubric)/,
    /feedback/,
    /(safety|unsafe|clinical)/,
    /(evidence|traceability|case)/
  ]);
}

function validateReview(review, packet, context, index) {
  const issues = [];
  const label = `claim_reviews[${index}]`;
  const status = cleanText(review.review_status || review.status);
  const isApproval = APPROVAL_STATUSES.has(status);
  const isNationalApproval = status === 'approved_for_national_release';

  if (!ALLOWED_REVIEW_STATUSES.has(status)) {
    issues.push(`${label}.review_status must be one of ${[...ALLOWED_REVIEW_STATUSES].join(', ')}.`);
  }
  if (!hasCompleteValue(review.reviewed_at)) issues.push(`${label}.reviewed_at is required.`);
  if (!hasCompleteValue(review.signature_attestation)) issues.push(`${label}.signature_attestation is required.`);
  if (!reviewerEvidenceComplete(review, packet.reviewer_roles || [])) {
    issues.push(`${label}.reviewed_by must include at least two credentialed reviewers covering required roles: ${(packet.reviewer_roles || []).join(', ')}.`);
  }
  if (!asArray(review.case_ids_reviewed).length) {
    issues.push(`${label}.case_ids_reviewed is required.`);
  }
  if (isApproval && !caseCoverageComplete(review, packet)) {
    issues.push(`${label}.case_ids_reviewed must cover all ${packet.case_ids.length} cases in packet ${packet.id} before approval.`);
  }
  if (!scopeSufficient(review)) {
    issues.push(`${label}.claim_scope_reviewed must cover scoring/rubric behavior, feedback messages, safety language, and evidence or traceability.`);
  }
  if (isApproval && !evidenceBasisSufficient(review, isNationalApproval)) {
    issues.push(`${label}.evidence_basis is insufficient for ${status}.`);
  }
  if (status === 'approved_formative_only' && !hasCompleteValue(review.approval_limitations)) {
    issues.push(`${label}.approval_limitations is required for formative-only approval.`);
  }
  if (['revisions_required', 'rejected'].includes(status) && !hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes is required for ${status}.`);
  }
  if (isApproval && hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes must be cleared before an approval status is used.`);
  }
  if (isNationalApproval && packet.traceability?.source_limited_formative_cases > 0) {
    issues.push(`${label} cannot approve national release while ${packet.traceability.source_limited_formative_cases} source-limited formative cases remain in ${packet.domain_key}.`);
  }
  if (isNationalApproval && context.caseTruthReadyCases < context.caseCount) {
    issues.push(`${label} cannot approve national release while case truth adjudications are incomplete (${context.caseTruthReadyCases}/${context.caseCount}).`);
  }
  if (isNationalApproval && context.generatedNeedsReviewChunks > 0) {
    issues.push(`${label} cannot approve national release while ${context.generatedNeedsReviewChunks} generated-needs-review evidence chunks remain unresolved.`);
  }
  if (isNationalApproval && context.evidenceApprovedChunks <= 0) {
    issues.push(`${label} cannot approve national release before evidence adjudication approvals are recorded.`);
  }

  const restricted = collectRestrictedKeys(review);
  if (restricted.length) issues.push(`${label} includes restricted source keys: ${restricted.join(', ')}.`);

  return {
    packet_id: packet.id,
    domain_key: packet.domain_key,
    review_status: status || 'missing',
    valid: issues.length === 0,
    issues
  };
}

function markdown(data) {
  const lines = [
    '# Feedback Claim Entailment Adjudication Status',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Review file present: ${data.summary.review_file_present}`,
    `- Submitted reviews: ${data.summary.submitted_claim_reviews}`,
    `- Valid claim reviews: ${data.summary.valid_claim_reviews}`,
    `- Approved/formative claim sets: ${data.summary.approved_or_formative_claim_sets}`,
    `- Nationally approved claim sets: ${data.summary.nationally_approved_claim_sets}`,
    `- Invalid review input count: ${data.summary.invalid_review_input_count}`,
    `- Ready for national feedback release: ${data.summary.ready_for_national_feedback_release}`,
    '',
    '## Domain Status',
    '',
    '| Domain | Packet | Status | Valid | Issues |',
    '|---|---|---|---:|---:|',
    ...data.domain_review_status.map((row) =>
      `| ${row.domain_key} | ${row.packet_id} | ${row.review_status} | ${row.valid} | ${row.issue_count} |`
    )
  ];
  return `${lines.join('\n')}\n`;
}

const cases = readJson(CASES_PATH);
const packets = readJson(REVIEW_PACKETS_PATH);
const clinicalStatus = readJson(CLINICAL_ADJUDICATION_STATUS_PATH);
const evidenceBacklog = readJson(EVIDENCE_BACKLOG_PATH);
const claimReviewFile = readOptionalJson(CLAIM_REVIEWS_PATH);
const claimReviews = flattenClaimReviews(claimReviewFile);
const packetById = new Map((packets.claim_review_packets || []).map((packet) => [packet.id, packet]));
const packetByDomain = new Map((packets.claim_review_packets || []).map((packet) => [packet.domain_key, packet]));
const context = {
  caseCount: cases.length,
  caseTruthReadyCases: clinicalStatus.case_truth?.ready_case_truth_adjudications || 0,
  evidenceApprovedChunks: clinicalStatus.evidence?.approved_chunks || 0,
  generatedNeedsReviewChunks: evidenceBacklog.summary?.pending_generated_or_unverified_chunks || 0
};

const topLevelIssues = [];
if (claimReviewFile && claimReviewFile.schema_version !== 'learner_facing_claim_entailment_reviews_v1') {
  topLevelIssues.push('learner_facing_claim_entailment_reviews.json must use schema_version learner_facing_claim_entailment_reviews_v1.');
}

const seenPacketIds = new Set();
const reviewResults = [];
for (const [index, review] of claimReviews.entries()) {
  const packetId = cleanText(review.packet_id || review.claim_set_id);
  const domainKey = cleanText(review.domain_key);
  const packet = packetById.get(packetId) || packetByDomain.get(domainKey);
  if (!packet) {
    reviewResults.push({
      packet_id: packetId || 'missing',
      domain_key: domainKey || 'missing',
      review_status: cleanText(review.review_status || review.status) || 'missing',
      valid: false,
      issues: [`claim_reviews[${index}] does not match a current claim-entailment packet.`]
    });
    continue;
  }
  if (seenPacketIds.has(packet.id)) {
    reviewResults.push({
      packet_id: packet.id,
      domain_key: packet.domain_key,
      review_status: cleanText(review.review_status || review.status) || 'missing',
      valid: false,
      issues: [`claim_reviews[${index}] duplicates packet_id ${packet.id}.`]
    });
    continue;
  }
  seenPacketIds.add(packet.id);
  reviewResults.push(validateReview(review, packet, context, index));
}

const resultByPacketId = new Map(reviewResults.map((result) => [result.packet_id, result]));
const domainReviewStatus = (packets.claim_review_packets || []).map((packet) => {
  const result = resultByPacketId.get(packet.id);
  return {
    packet_id: packet.id,
    domain_key: packet.domain_key,
    claim_set_type: packet.claim_set_type,
    required_reviewer_roles: packet.reviewer_roles || [],
    review_status: result?.review_status || 'not_submitted',
    valid: Boolean(result?.valid),
    issue_count: result?.issues?.length || 0,
    issues: result?.issues || []
  };
});

const allIssues = [
  ...topLevelIssues,
  ...reviewResults.flatMap((result) => result.issues)
];
const validResults = reviewResults.filter((result) => result.valid);
const approvedOrFormative = validResults.filter((result) => APPROVAL_STATUSES.has(result.review_status));
const nationallyApproved = validResults.filter((result) => result.review_status === 'approved_for_national_release');
const readyForNationalFeedbackRelease = nationallyApproved.length === (packets.claim_review_packets || []).length
  && nationallyApproved.length > 0
  && allIssues.length === 0
  && context.caseTruthReadyCases >= context.caseCount
  && context.generatedNeedsReviewChunks === 0
  && context.evidenceApprovedChunks > 0;

const artifact = {
  schema_version: 'feedback_claim_entailment_adjudication_status_v1',
  generated_at: new Date().toISOString(),
  review_status: allIssues.length
    ? 'claim_entailment_review_inputs_invalid'
    : claimReviews.length === 0
      ? 'claim_entailment_review_inputs_pending'
      : readyForNationalFeedbackRelease
        ? 'claim_entailment_reviews_complete_ready_for_external_audit'
        : 'claim_entailment_reviews_partial_or_limited',
  warning: 'This status validates submitted feedback claim-entailment reviews. It does not itself provide clinical approval; it prevents incomplete or overbroad approvals from satisfying national readiness gates.',
  source_contract: {
    packet_schema_version: packets.schema_version,
    packet_file_path: 'docs/feedback_claim_entailment_review_packets.json',
    completed_review_file_present: existsSync(CLAIM_REVIEWS_PATH),
    completed_review_file_path: 'docs/learner_facing_claim_entailment_reviews.json',
    required_completed_review_schema_version: 'learner_facing_claim_entailment_reviews_v1',
    allowed_review_statuses: [...ALLOWED_REVIEW_STATUSES].sort(),
    restricted_keys_blocked: [...RESTRICTED_KEYS].sort()
  },
  summary: {
    total_claim_sets: packets.summary?.total_claim_sets || packets.claim_review_packets?.length || 0,
    review_file_present: existsSync(CLAIM_REVIEWS_PATH),
    submitted_claim_reviews: claimReviews.length,
    valid_claim_reviews: validResults.length,
    approved_or_formative_claim_sets: approvedOrFormative.length,
    nationally_approved_claim_sets: nationallyApproved.length,
    claim_sets_ready_for_national_release: readyForNationalFeedbackRelease
      ? nationallyApproved.length
      : 0,
    missing_claim_reviews: Math.max((packets.claim_review_packets || []).length - seenPacketIds.size, 0),
    invalid_review_input_count: allIssues.length,
    case_truth_adjudication_ready_cases: context.caseTruthReadyCases,
    evidence_adjudication_approved_chunks: context.evidenceApprovedChunks,
    generated_needs_review_chunks: context.generatedNeedsReviewChunks,
    ready_for_national_feedback_release: readyForNationalFeedbackRelease
  },
  domain_review_status: domainReviewStatus,
  readiness_effect: {
    claim_entailment_gate_can_pass_from_current_reviews: readyForNationalFeedbackRelease,
    invalid_review_input_count: allIssues.length,
    source_limited_national_approval_block_enforced: true,
    generated_evidence_national_approval_block_enforced: true,
    minimum_reviewer_role_coverage_enforced: true
  },
  issues: allIssues
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

if (allIssues.length) {
  console.error(`Feedback claim-entailment review inputs are invalid. Issues: ${allIssues.length}. Status written to ${OUTPUT_JSON_PATH}`);
  for (const issue of allIssues.slice(0, 20)) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(JSON.stringify({
  review_status: artifact.review_status,
  review_file_present: artifact.summary.review_file_present,
  submitted_claim_reviews: artifact.summary.submitted_claim_reviews,
  valid_claim_reviews: artifact.summary.valid_claim_reviews,
  invalid_review_input_count: artifact.summary.invalid_review_input_count,
  ready_for_national_feedback_release: artifact.summary.ready_for_national_feedback_release,
  status_path: OUTPUT_JSON_PATH
}, null, 2));
