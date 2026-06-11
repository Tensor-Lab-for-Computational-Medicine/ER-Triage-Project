import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAP_PACKETS_PATH = join(ROOT, 'docs', 'claim_reference_gap_review_packets.json');
const CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH = join(ROOT, 'docs', 'feedback_claim_reference_alignment_report.json');
const CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_adjudication_status.json');
const REVIEWS_PATH = join(ROOT, 'docs', 'claim_reference_gap_reviews.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'claim_reference_gap_review_status.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'claim_reference_gap_review_status.md');

const ALLOWED_RESOLUTIONS = new Set([
  'add_quote_backed_public_evidence',
  'approve_clinician_local_standard',
  'retire_or_reword_claim_set',
  'keep_blocked',
  'rejected'
]);

const RELEASE_DECISIONS = new Set([
  'blocked',
  'approved_for_local_formative',
  'approved_for_supervised_pilot',
  'approved_for_national_feedback'
]);

const CLEARING_RESOLUTIONS = new Set([
  'add_quote_backed_public_evidence',
  'approve_clinician_local_standard',
  'retire_or_reword_claim_set',
  'rejected'
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
  for (const key of ['claim_reference_gap_reviews', 'gap_reviews', 'reviews']) {
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
  for (const reviewer of asArray(review.reviewed_by || review.reviewer_roles)) {
    for (const role of asArray(reviewer?.role || reviewer?.roles || reviewer)) {
      const clean = cleanText(role);
      if (clean) roles.add(clean);
    }
  }
  return roles;
}

function reviewerEvidenceComplete(review, requiredRoles) {
  const reviewers = asArray(review.reviewed_by || review.reviewer_roles);
  const credentialedReviewers = reviewers.filter((reviewer) => typeof reviewer === 'object');
  const identities = new Set(credentialedReviewers.map(reviewerIdentity).filter(Boolean));
  const roles = reviewerRoles(review);
  const reviewersHaveIdentity = credentialedReviewers.length >= 2 && identities.size >= 2;
  const reviewersHaveCredentials = credentialedReviewers.every((reviewer) =>
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
  return cleanText(review.gap_packet_id || review.packet_id || review.claim_reference_gap_packet_id);
}

function booleanTrue(value) {
  return value === true || /^(true|yes|met|cleared)$/i.test(cleanText(value));
}

function addedPublicEvidenceComplete(review) {
  return hasCompleteValue(review.added_or_approved_source_ids)
    && (
      hasCompleteValue(review.quote_backed_chunk_ids_added)
      || hasCompleteValue(review.public_source_locator_evidence)
      || hasCompleteValue(review.locator_evidence_added)
    );
}

function localStandardEvidenceComplete(review) {
  return hasCompleteValue(review.local_standard_name_and_version)
    && hasCompleteValue(review.local_standard_scope)
    && hasCompleteValue(review.local_standard_owner_or_committee);
}

function generatedCandidatesDispositioned(review, packet) {
  const generatedCount = packet.current_evidence_state?.generated_needs_review_domain_specific_chunks_available || 0;
  if (generatedCount === 0) return true;
  const dispositions = [
    ...asArray(review.generated_chunks_replaced_or_retired),
    ...asArray(review.generated_chunk_disposition_ids),
    ...asArray(review.retired_or_quarantined_generated_chunk_ids)
  ];
  return dispositions.length >= generatedCount;
}

function gapCleared(review, packet, context, isClearingResolution) {
  if (!isClearingResolution) return false;
  const resolution = cleanText(review.evidence_resolution || review.review_resolution || review.status);
  if (resolution === 'add_quote_backed_public_evidence') {
    return addedPublicEvidenceComplete(review)
      && booleanTrue(review.domain_specific_quote_support_met)
      && generatedCandidatesDispositioned(review, packet);
  }
  if (resolution === 'approve_clinician_local_standard') {
    return localStandardEvidenceComplete(review)
      && booleanTrue(review.domain_specific_quote_support_met)
      && generatedCandidatesDispositioned(review, packet);
  }
  if (['retire_or_reword_claim_set', 'rejected'].includes(resolution)) {
    return hasCompleteValue(review.claim_set_disposition)
      && generatedCandidatesDispositioned(review, packet);
  }
  return context.alignmentDomainSpecificReleaseReady && context.claimReferenceAlignmentReleaseReady;
}

function validateReview(review, packet, context, index) {
  const issues = [];
  const label = `claim_reference_gap_reviews[${index}]`;
  const resolution = cleanText(review.evidence_resolution || review.review_resolution || review.status);
  const releaseDecision = cleanText(review.national_feedback_release_decision || review.release_decision || 'blocked');
  const isClearingResolution = CLEARING_RESOLUTIONS.has(resolution);
  const nationalApproval = releaseDecision === 'approved_for_national_feedback';

  if (!ALLOWED_RESOLUTIONS.has(resolution)) {
    issues.push(`${label}.evidence_resolution must be one of ${[...ALLOWED_RESOLUTIONS].join(', ')}.`);
  }
  if (!RELEASE_DECISIONS.has(releaseDecision)) {
    issues.push(`${label}.national_feedback_release_decision must be one of ${[...RELEASE_DECISIONS].join(', ')}.`);
  }
  if (packetIdentifier(review) !== packet.id) {
    issues.push(`${label}.gap_packet_id must match ${packet.id}.`);
  }
  if (cleanText(review.claim_packet_id) !== packet.claim_packet_id) {
    issues.push(`${label}.claim_packet_id must match ${packet.claim_packet_id}.`);
  }
  if (cleanText(review.domain_key) !== packet.domain_key) {
    issues.push(`${label}.domain_key must match ${packet.domain_key}.`);
  }
  if (!hasCompleteValue(review.reviewed_at)) issues.push(`${label}.reviewed_at is required.`);
  if (!hasCompleteValue(review.reviewer_attestation || review.signature_attestation)) {
    issues.push(`${label}.reviewer_attestation or signature_attestation is required.`);
  }
  if (!reviewerEvidenceComplete(review, [
    'emergency_clinician_or_triage_expert',
    'medical_librarian_or_evidence_reviewer',
    'simulation_educator'
  ])) {
    issues.push(`${label}.reviewed_by must include credentialed reviewers covering emergency_clinician_or_triage_expert, medical_librarian_or_evidence_reviewer, and simulation_educator.`);
  }
  if (resolution === 'add_quote_backed_public_evidence' && !addedPublicEvidenceComplete(review)) {
    issues.push(`${label} must include added public source IDs plus quote-backed chunk IDs or locator evidence.`);
  }
  if (resolution === 'approve_clinician_local_standard' && !localStandardEvidenceComplete(review)) {
    issues.push(`${label} must include a named, versioned local standard, scope, and owner or committee.`);
  }
  if (isClearingResolution && !generatedCandidatesDispositioned(review, packet)) {
    issues.push(`${label} must replace, retire, or quarantine all generated-needs-review candidate chunks in ${packet.id}.`);
  }
  if (isClearingResolution && !gapCleared(review, packet, context, isClearingResolution)) {
    issues.push(`${label} does not yet meet the packet-specific evidence or disposition requirements to clear the gap.`);
  }
  if (nationalApproval && !context.alignmentDomainSpecificReleaseReady) {
    issues.push(`${label} cannot approve national feedback while domain-specific claim-reference alignment is not release-ready.`);
  }
  if (nationalApproval && !context.claimEntailmentReady) {
    issues.push(`${label} cannot approve national feedback while claim-entailment adjudication is not nationally ready.`);
  }
  if (nationalApproval && resolution === 'approve_clinician_local_standard' && !hasCompleteValue(review.multi_institution_applicability_rationale)) {
    issues.push(`${label}.multi_institution_applicability_rationale is required before a local standard can support national feedback.`);
  }
  if (['keep_blocked', 'rejected'].includes(resolution) && !hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes is required for ${resolution}.`);
  }
  if (isClearingResolution && hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes must be cleared before the gap is counted as reviewed.`);
  }

  const restricted = collectRestrictedKeys(review);
  if (restricted.length) issues.push(`${label} includes restricted or direct identifier keys: ${restricted.join(', ')}.`);

  const valid = issues.length === 0;
  const cleared = valid && gapCleared(review, packet, context, isClearingResolution);
  return {
    gap_packet_id: packet.id,
    claim_packet_id: packet.claim_packet_id,
    domain_key: packet.domain_key,
    evidence_resolution: resolution || 'missing',
    national_feedback_release_decision: releaseDecision || 'missing',
    valid,
    gap_cleared: cleared,
    national_feedback_approved: cleared && nationalApproval,
    issues
  };
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function markdown(data) {
  const lines = [
    '# Claim Reference Gap Review Status',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Review file present: ${data.summary.review_file_present}`,
    `- Total gap packets: ${data.summary.total_gap_packets}`,
    `- Submitted gap reviews: ${data.summary.submitted_gap_reviews}`,
    `- Valid gap reviews: ${data.summary.valid_gap_reviews}`,
    `- Cleared gap packets: ${data.summary.cleared_gap_packets}`,
    `- Pending gap reviews: ${data.summary.pending_gap_reviews}`,
    `- Invalid review input count: ${data.summary.invalid_review_input_count}`,
    `- Ready for national feedback release from gap reviews: ${data.summary.ready_for_national_feedback_release_from_reviews}`,
    '',
    '## Gap Status',
    '',
    '| Gap Packet | Domain | Resolution | Release Decision | Valid | Cleared | Issues |',
    '|---|---|---|---|---:|---:|---:|',
    ...data.claim_reference_gap_review_status.map((row) =>
      `| ${markdownEscape(row.gap_packet_id)} | ${row.domain_key} | ${row.evidence_resolution} | ${row.national_feedback_release_decision} | ${row.valid} | ${row.gap_cleared} | ${row.issue_count} |`
    ),
    '',
    '## Reviewer Input',
    '',
    'Completed claim-reference gap reviews should be recorded in `docs/claim_reference_gap_reviews.json`. This status validates review input only; it does not itself add quote-backed ESI evidence, update the knowledge bundle, or approve national learner-facing feedback.'
  ];
  return `${lines.join('\n')}\n`;
}

const gapPackets = readJson(GAP_PACKETS_PATH);
const claimReferenceAlignmentReport = readJson(CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH);
const claimEntailmentAdjudicationStatus = readJson(CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH);
const reviewFile = readOptionalJson(REVIEWS_PATH);
const reviews = flattenReviews(reviewFile);
const packetsRows = gapPackets.claim_reference_gap_packets || [];
const packetById = new Map(packetsRows.map((packet) => [packet.id, packet]));
const context = {
  alignmentDomainSpecificReleaseReady:
    Boolean(claimReferenceAlignmentReport.summary?.domain_specific_quote_support_release_ready),
  claimReferenceAlignmentReleaseReady:
    Boolean(claimReferenceAlignmentReport.summary?.claim_reference_alignment_release_ready),
  claimEntailmentReady:
    Boolean(claimEntailmentAdjudicationStatus.summary?.ready_for_national_feedback_release)
};

const topLevelIssues = [];
if (reviewFile && reviewFile.schema_version !== 'claim_reference_gap_reviews_v1') {
  topLevelIssues.push('claim_reference_gap_reviews.json must use schema_version claim_reference_gap_reviews_v1.');
}

const seen = new Set();
const reviewStatusByPacketId = new Map();
for (const [index, review] of reviews.entries()) {
  const packetId = packetIdentifier(review);
  const packet = packetById.get(packetId);
  if (!packet) {
    const status = {
      gap_packet_id: packetId || 'missing',
      claim_packet_id: cleanText(review.claim_packet_id) || 'missing',
      domain_key: cleanText(review.domain_key) || 'missing',
      evidence_resolution: cleanText(review.evidence_resolution || review.review_resolution || review.status) || 'missing',
      national_feedback_release_decision:
        cleanText(review.national_feedback_release_decision || review.release_decision) || 'missing',
      valid: false,
      gap_cleared: false,
      national_feedback_approved: false,
      issues: [`claim_reference_gap_reviews[${index}] does not match a current claim-reference gap packet.`]
    };
    reviewStatusByPacketId.set(`${packetId || 'missing'}:${index}`, status);
    continue;
  }

  const status = validateReview(review, packet, context, index);
  if (seen.has(packet.id)) {
    status.issues.push(`claim_reference_gap_reviews[${index}].gap_packet_id is duplicated: ${packet.id}.`);
    status.valid = false;
    status.gap_cleared = false;
    status.national_feedback_approved = false;
  }
  seen.add(packet.id);
  reviewStatusByPacketId.set(packet.id, status);
}

const unmatchedReviewStatuses = [...reviewStatusByPacketId.entries()]
  .filter(([packetId]) => !packetById.has(packetId))
  .map(([, status]) => status);

const claimReferenceGapReviewStatus = packetsRows.map((packet) => {
  const status = reviewStatusByPacketId.get(packet.id) || {
    gap_packet_id: packet.id,
    claim_packet_id: packet.claim_packet_id,
    domain_key: packet.domain_key,
    evidence_resolution: 'not_submitted',
    national_feedback_release_decision: 'blocked',
    valid: false,
    gap_cleared: false,
    national_feedback_approved: false,
    issues: ['No completed claim-reference gap review submitted.']
  };
  return {
    ...status,
    priority: packet.priority,
    required_reviewer_roles: [
      'emergency_clinician_or_triage_expert',
      'medical_librarian_or_evidence_reviewer',
      'simulation_educator'
    ],
    generated_needs_review_candidate_chunks:
      packet.current_evidence_state?.generated_needs_review_domain_specific_chunks_available || 0,
    domain_specific_quote_backed_references:
      packet.blocker_summary?.domain_specific_quote_backed_references || 0,
    required_domain_specific_quote_backed_references:
      packet.blocker_summary?.required_domain_specific_quote_backed_references || 0,
    issue_count: status.issues.length
  };
});

const allSubmittedResults = [
  ...claimReferenceGapReviewStatus.filter((row) => row.evidence_resolution !== 'not_submitted'),
  ...unmatchedReviewStatuses
];
const reviewInputIssues = [
  ...topLevelIssues,
  ...allSubmittedResults.flatMap((row) => row.issues)
];
const validRows = claimReferenceGapReviewStatus.filter((row) => row.valid);
const clearedRows = claimReferenceGapReviewStatus.filter((row) => row.gap_cleared);
const pendingGapReviews = claimReferenceGapReviewStatus.filter((row) => row.evidence_resolution === 'not_submitted').length;
const readyForNationalFeedbackRelease = claimReferenceGapReviewStatus.length === 0
  ? context.alignmentDomainSpecificReleaseReady
    && context.claimReferenceAlignmentReleaseReady
    && context.claimEntailmentReady
  : clearedRows.length === claimReferenceGapReviewStatus.length
    && reviewInputIssues.length === 0
    && pendingGapReviews === 0
    && context.alignmentDomainSpecificReleaseReady
    && context.claimReferenceAlignmentReleaseReady
    && context.claimEntailmentReady;

const artifact = {
  schema_version: 'claim_reference_gap_review_status_v1',
  generated_at: new Date().toISOString(),
  review_status: !reviewFile
    ? 'claim_reference_gap_review_inputs_pending'
    : reviewInputIssues.length > 0
      ? 'claim_reference_gap_review_inputs_invalid'
      : readyForNationalFeedbackRelease
        ? 'claim_reference_gap_reviews_complete_ready_for_external_audit'
        : 'claim_reference_gap_reviews_partial_or_limited',
  warning: 'This status validates completed claim-reference gap review submissions. It does not add quote-backed evidence, approve generated evidence, update claim entailment, or authorize national learner-facing feedback.',
  source_contract: {
    claim_reference_gap_review_packets_schema: gapPackets.schema_version,
    claim_reference_gap_review_packets_path: 'docs/claim_reference_gap_review_packets.json',
    feedback_claim_reference_alignment_report_schema: claimReferenceAlignmentReport.schema_version,
    feedback_claim_entailment_adjudication_status_schema: claimEntailmentAdjudicationStatus.schema_version,
    completed_review_file_present: Boolean(reviewFile),
    completed_review_file_path: 'docs/claim_reference_gap_reviews.json',
    required_completed_review_schema: 'claim_reference_gap_reviews_v1',
    allowed_evidence_resolutions: [...ALLOWED_RESOLUTIONS].sort(),
    allowed_release_decisions: [...RELEASE_DECISIONS].sort(),
    restricted_keys_blocked: [...RESTRICTED_KEYS].sort()
  },
  summary: {
    review_file_present: Boolean(reviewFile),
    total_gap_packets: claimReferenceGapReviewStatus.length,
    submitted_gap_reviews: reviews.length,
    valid_gap_reviews: validRows.length,
    cleared_gap_packets: clearedRows.length,
    national_feedback_approved_gap_packets:
      claimReferenceGapReviewStatus.filter((row) => row.national_feedback_approved).length,
    pending_gap_reviews: pendingGapReviews,
    invalid_review_input_count: reviewInputIssues.length,
    unmatched_submitted_reviews: unmatchedReviewStatuses.length,
    generated_needs_review_candidate_chunks:
      gapPackets.summary?.generated_needs_review_candidate_chunks_packeted || 0,
    alignment_domain_specific_release_ready: context.alignmentDomainSpecificReleaseReady,
    claim_reference_alignment_release_ready: context.claimReferenceAlignmentReleaseReady,
    claim_entailment_ready_for_national_release: context.claimEntailmentReady,
    ready_for_national_feedback_release_from_reviews: readyForNationalFeedbackRelease,
    evidence_resolution_counts: countBy(claimReferenceGapReviewStatus, (row) => row.evidence_resolution),
    domain_counts: countBy(claimReferenceGapReviewStatus, (row) => row.domain_key),
    required_reviewer_role_counts:
      countBy(claimReferenceGapReviewStatus.flatMap((row) => row.required_reviewer_roles), (role) => role)
  },
  claim_reference_gap_review_status: claimReferenceGapReviewStatus,
  unmatched_submitted_reviews: unmatchedReviewStatuses,
  readiness_effect: {
    open_evidence_grounding_gate_can_pass_from_current_gap_reviews: readyForNationalFeedbackRelease,
    named_standard_feedback_remains_blocked_without_domain_specific_support: !readyForNationalFeedbackRelease,
    generated_candidates_remain_quarantined_without_valid_review: true,
    national_feedback_requires_claim_entailment_readiness: true,
    required_reviewer_role_coverage_enforced: true,
    restricted_data_leakage_block_enforced: true,
    invalid_review_input_count: reviewInputIssues.length
  },
  issues: reviewInputIssues
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

if (reviewInputIssues.length) {
  console.error(`Claim-reference gap review inputs are invalid. Issues: ${reviewInputIssues.length}. Status written to ${OUTPUT_JSON_PATH}`);
  for (const issue of reviewInputIssues.slice(0, 20)) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(JSON.stringify({
  review_status: artifact.review_status,
  review_file_present: artifact.summary.review_file_present,
  total_gap_packets: artifact.summary.total_gap_packets,
  submitted_gap_reviews: artifact.summary.submitted_gap_reviews,
  valid_gap_reviews: artifact.summary.valid_gap_reviews,
  pending_gap_reviews: artifact.summary.pending_gap_reviews,
  invalid_review_input_count: artifact.summary.invalid_review_input_count,
  ready_for_national_feedback_release_from_reviews:
    artifact.summary.ready_for_national_feedback_release_from_reviews,
  status_path: OUTPUT_JSON_PATH
}, null, 2));
