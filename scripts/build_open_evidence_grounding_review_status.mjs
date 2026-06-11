import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'open_evidence_grounding_review_packets.json');
const EVIDENCE_BACKLOG_PATH = join(ROOT, 'docs', 'evidence_review_backlog.json');
const EVIDENCE_DASHBOARD_PATH = join(ROOT, 'docs', 'evidence_quality_dashboard.json');
const CLINICAL_REVIEW_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'clinical_review_adjudication_status.json');
const REVIEWS_PATH = join(ROOT, 'docs', 'open_evidence_grounding_reviews.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'open_evidence_grounding_review_status.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'open_evidence_grounding_review_status.md');

const ALLOWED_DECISIONS = new Set([
  'approved_for_learner_facing_quote_backed_use',
  'approved_source_replacement_required',
  'approved_for_background_only',
  'blocked_generated_or_unverified_evidence',
  'revisions_required',
  'rejected'
]);

const CLEARING_DECISIONS = new Set([
  'approved_for_learner_facing_quote_backed_use',
  'approved_source_replacement_required',
  'approved_for_background_only',
  'blocked_generated_or_unverified_evidence',
  'rejected'
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
  'patient_name',
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
  for (const key of [
    'open_evidence_grounding_reviews',
    'grounding_reviews',
    'generated_backlog_reviews',
    'release_blocker_reviews',
    'reviews'
  ]) {
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

function packetRows(packets) {
  return [
    ...(packets.generated_backlog_review_packets || []),
    ...(packets.release_blocker_packets || [])
  ];
}

function packetIdentifier(review) {
  return cleanText(
    review.packet_id
      || review.grounding_packet_id
      || review.review_packet_id
      || review.batch_packet_id
      || review.release_blocker_packet_id
  );
}

function packetBatchMatches(review, packet) {
  if (packet.packet_type !== 'generated_backlog_batch_grounding_review') return true;
  const batchId = cleanText(review.batch_id);
  return !batchId || batchId === packet.batch_id;
}

function packetBlockerMatches(review, packet) {
  if (packet.packet_type !== 'open_evidence_release_blocker_review') return true;
  const blockerId = cleanText(review.blocker_id);
  return !blockerId || blockerId === packet.blocker_id;
}

function locatorEvidenceComplete(review) {
  return [
    review.replacement_quote_backed_chunk_ids,
    review.locator_evidence_added,
    review.quote_hashes_verified,
    review.source_locator_evidence,
    review.evidence_adjudication_ids,
    review.retired_or_quarantined_chunk_ids,
    review.chunk_ids_retired_or_quarantined
  ].some(hasCompleteValue);
}

function approvedChunkIds(review) {
  return [
    ...asArray(review.chunk_ids_approved_for_learner_feedback),
    ...asArray(review.replacement_quote_backed_chunk_ids)
  ].map(cleanText).filter(Boolean);
}

function clearedGeneratedPacket(review, packet, isClearingDecision) {
  if (!isClearingDecision) return false;
  const approvedChunks = approvedChunkIds(review);
  const backgroundChunks = asArray(review.chunk_ids_background_only).map(cleanText).filter(Boolean);
  const retiredChunks = [
    ...asArray(review.chunk_ids_retired_or_quarantined),
    ...asArray(review.retired_or_quarantined_chunk_ids)
  ].map(cleanText).filter(Boolean);
  const totalDispositioned = approvedChunks.length + backgroundChunks.length + retiredChunks.length;
  return packet.packet_type === 'generated_backlog_batch_grounding_review'
    && totalDispositioned >= packet.pending_chunk_count
    && locatorEvidenceComplete(review);
}

function clearedReleaseBlocker(review, packet, isClearingDecision, context) {
  if (!isClearingDecision) return false;
  if (packet.packet_type !== 'open_evidence_release_blocker_review') return false;
  if (packet.current_ready) return true;
  const clearedInArtifact = asArray(review.cleared_in_authoritative_artifact).some((value) =>
    /^(true|yes|cleared)$/i.test(cleanText(value))
  );
  const explicitBlockerCleared = review.release_blocker_cleared === true
    || /^(true|yes|cleared)$/i.test(cleanText(review.release_blocker_cleared));
  return clearedInArtifact
    && explicitBlockerCleared
    && context.evidenceDashboardReleaseReady
    && context.evidenceDashboardOpenReleaseBlockers === 0;
}

function validateReview(review, packet, context, index) {
  const issues = [];
  const label = `open_evidence_grounding_reviews[${index}]`;
  const reviewDecision = cleanText(review.review_decision || review.review_status || review.status);
  const isClearingDecision = CLEARING_DECISIONS.has(reviewDecision);
  const isLearnerFacingApproval = reviewDecision === 'approved_for_learner_facing_quote_backed_use';

  if (!ALLOWED_DECISIONS.has(reviewDecision)) {
    issues.push(`${label}.review_decision must be one of ${[...ALLOWED_DECISIONS].join(', ')}.`);
  }
  if (packetIdentifier(review) !== packet.id) {
    issues.push(`${label}.packet_id must match ${packet.id}.`);
  }
  if (!packetBatchMatches(review, packet)) {
    issues.push(`${label}.batch_id must match ${packet.batch_id}.`);
  }
  if (!packetBlockerMatches(review, packet)) {
    issues.push(`${label}.blocker_id must match ${packet.blocker_id}.`);
  }
  if (!hasCompleteValue(review.reviewed_at)) issues.push(`${label}.reviewed_at is required.`);
  if (!hasCompleteValue(review.signature_attestation || review.reviewer_attestation)) {
    issues.push(`${label}.signature_attestation or reviewer_attestation is required.`);
  }
  if (!hasCompleteValue(review.source_version_or_access_date_reviewed)) {
    issues.push(`${label}.source_version_or_access_date_reviewed is required.`);
  }
  if (!reviewerEvidenceComplete(review, packet.reviewer_roles_required || [])) {
    issues.push(`${label}.reviewed_by must include at least two credentialed reviewers covering required roles: ${(packet.reviewer_roles_required || []).join(', ')}.`);
  }
  if (isClearingDecision && packet.packet_type === 'generated_backlog_batch_grounding_review' && !clearedGeneratedPacket(review, packet, isClearingDecision)) {
    issues.push(`${label} must disposition every packet chunk and include replacement locator, adjudication, or retirement evidence before clearing a generated backlog packet.`);
  }
  if (isLearnerFacingApproval && !hasCompleteValue(review.replacement_quote_backed_chunk_ids)) {
    issues.push(`${label}.replacement_quote_backed_chunk_ids is required before learner-facing quote-backed approval.`);
  }
  if (isLearnerFacingApproval && !context.evidenceAdjudicationReadyForLearnerFeedback) {
    issues.push(`${label} cannot approve learner-facing use while evidence adjudication has not approved all learner-facing replacement evidence.`);
  }
  if (isLearnerFacingApproval && context.pendingGeneratedOrUnverifiedChunks > 0) {
    issues.push(`${label} cannot approve learner-facing use while ${context.pendingGeneratedOrUnverifiedChunks} generated or unverified chunks remain in the authoritative backlog.`);
  }
  if (
    packet.packet_type === 'open_evidence_release_blocker_review'
    && isClearingDecision
    && !clearedReleaseBlocker(review, packet, isClearingDecision, context)
  ) {
    issues.push(`${label} cannot clear release blocker ${packet.blocker_id} until the authoritative evidence dashboard and review input both show the blocker cleared.`);
  }
  if (['revisions_required', 'rejected'].includes(reviewDecision) && !hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes is required for ${reviewDecision}.`);
  }
  if (isClearingDecision && hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes must be empty before a clearing decision is counted.`);
  }

  const restricted = collectRestrictedKeys(review);
  if (restricted.length) issues.push(`${label} includes restricted or direct identifier keys: ${restricted.join(', ')}.`);

  const valid = issues.length === 0;
  const packetCleared = valid && (
    clearedGeneratedPacket(review, packet, isClearingDecision)
    || clearedReleaseBlocker(review, packet, isClearingDecision, context)
  );

  return {
    packet_id: packet.id,
    packet_type: packet.packet_type,
    batch_id: packet.batch_id,
    blocker_id: packet.blocker_id,
    review_decision: reviewDecision || 'missing',
    valid,
    learner_facing_quote_backed_approved: valid && isLearnerFacingApproval,
    packet_cleared: packetCleared,
    generated_backlog_packet: packet.packet_type === 'generated_backlog_batch_grounding_review',
    release_blocker_packet: packet.packet_type === 'open_evidence_release_blocker_review',
    issues
  };
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function markdown(data) {
  const rows = data.open_evidence_grounding_review_status.slice(0, 120);
  const lines = [
    '# Open Evidence Grounding Review Status',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Review file present: ${data.summary.review_file_present}`,
    `- Total review packets: ${data.summary.total_review_packets}`,
    `- Generated backlog review packets: ${data.summary.generated_backlog_review_packets}`,
    `- Release blocker review packets: ${data.summary.release_blocker_review_packets}`,
    `- Submitted grounding reviews: ${data.summary.submitted_grounding_reviews}`,
    `- Valid grounding reviews: ${data.summary.valid_grounding_reviews}`,
    `- Cleared review packets: ${data.summary.cleared_review_packets}`,
    `- Pending review packets: ${data.summary.pending_review_packets}`,
    `- Invalid review input count: ${data.summary.invalid_review_input_count}`,
    `- Ready for national open-evidence release from reviews: ${data.summary.ready_for_national_open_evidence_release_from_reviews}`,
    '',
    '## Packet Status',
    '',
    '| Packet | Type | Decision | Valid | Cleared | Issues |',
    '|---|---|---|---:|---:|---:|',
    ...rows.map((row) =>
      `| ${markdownEscape(row.packet_id)} | ${row.packet_type} | ${row.review_decision} | ${row.valid} | ${row.packet_cleared} | ${row.issue_count} |`
    ),
    '',
    '## Reviewer Input',
    '',
    'Completed grounding reviews should be recorded in `docs/open_evidence_grounding_reviews.json`. This status validates review input only; it does not promote generated evidence, repair source locators, or prove medical education effectiveness.'
  ];
  return `${lines.join('\n')}\n`;
}

const packets = readJson(REVIEW_PACKETS_PATH);
const evidenceBacklog = readJson(EVIDENCE_BACKLOG_PATH);
const evidenceDashboard = readJson(EVIDENCE_DASHBOARD_PATH);
const clinicalReviewAdjudicationStatus = readJson(CLINICAL_REVIEW_ADJUDICATION_STATUS_PATH);
const reviewFile = readOptionalJson(REVIEWS_PATH);
const reviews = flattenReviews(reviewFile);
const packetsRows = packetRows(packets);
const packetById = new Map(packetsRows.map((packet) => [packet.id, packet]));

const context = {
  pendingGeneratedOrUnverifiedChunks: evidenceBacklog.summary?.pending_generated_or_unverified_chunks || 0,
  evidenceDashboardReleaseReady: Boolean(evidenceDashboard.summary?.dashboard_release_ready),
  evidenceDashboardOpenReleaseBlockers: evidenceDashboard.summary?.open_release_blockers || 0,
  evidenceAdjudicationReadyForLearnerFeedback:
    Boolean(clinicalReviewAdjudicationStatus?.evidence?.ready_for_national_evidence_release)
    || (
      (clinicalReviewAdjudicationStatus?.evidence?.pending_generated_or_unverified_chunks || 0) === 0
      && (clinicalReviewAdjudicationStatus?.evidence?.learner_feedback_approved_chunks || 0) > 0
      && (clinicalReviewAdjudicationStatus?.evidence?.issues || []).length === 0
    )
};

const topLevelIssues = [];
if (reviewFile && reviewFile.schema_version !== 'open_evidence_grounding_reviews_v1') {
  topLevelIssues.push('open_evidence_grounding_reviews.json must use schema_version open_evidence_grounding_reviews_v1.');
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
      batch_id: cleanText(review.batch_id) || undefined,
      blocker_id: cleanText(review.blocker_id) || undefined,
      review_decision: cleanText(review.review_decision || review.review_status || review.status) || 'missing',
      valid: false,
      learner_facing_quote_backed_approved: false,
      packet_cleared: false,
      generated_backlog_packet: false,
      release_blocker_packet: false,
      issues: [`open_evidence_grounding_reviews[${index}] does not match a current open-evidence grounding packet.`]
    };
    reviewStatusByPacketId.set(`${packetId || 'missing'}:${index}`, status);
    continue;
  }

  const status = validateReview(review, packet, context, index);
  if (seen.has(packet.id)) {
    status.issues.push(`open_evidence_grounding_reviews[${index}].packet_id is duplicated: ${packet.id}.`);
    status.valid = false;
    status.learner_facing_quote_backed_approved = false;
    status.packet_cleared = false;
  }
  seen.add(packet.id);
  reviewStatusByPacketId.set(packet.id, status);
}

const unmatchedReviewStatuses = [...reviewStatusByPacketId.entries()]
  .filter(([packetId]) => !packetById.has(packetId))
  .map(([, status]) => status);

const openEvidenceGroundingReviewStatus = packetsRows.map((packet) => {
  const status = reviewStatusByPacketId.get(packet.id) || {
    packet_id: packet.id,
    packet_type: packet.packet_type,
    batch_id: packet.batch_id,
    blocker_id: packet.blocker_id,
    review_decision: 'not_submitted',
    valid: false,
    learner_facing_quote_backed_approved: false,
    packet_cleared: false,
    generated_backlog_packet: packet.packet_type === 'generated_backlog_batch_grounding_review',
    release_blocker_packet: packet.packet_type === 'open_evidence_release_blocker_review',
    issues: ['No completed open-evidence grounding review submitted.']
  };
  return {
    ...status,
    priority: packet.priority,
    source_id: packet.source_id,
    pending_chunk_count: packet.pending_chunk_count || 0,
    current_ready: packet.current_ready,
    required_reviewer_roles: packet.reviewer_roles_required || [],
    issue_count: status.issues.length
  };
});

const allSubmittedResults = [
  ...openEvidenceGroundingReviewStatus.filter((row) => row.review_decision !== 'not_submitted'),
  ...unmatchedReviewStatuses
];
const reviewInputIssues = [
  ...topLevelIssues,
  ...allSubmittedResults.flatMap((row) => row.issues)
];
const validRows = openEvidenceGroundingReviewStatus.filter((row) => row.valid);
const clearedRows = openEvidenceGroundingReviewStatus.filter((row) => row.packet_cleared);
const pendingReviewPackets = openEvidenceGroundingReviewStatus.filter((row) => row.review_decision === 'not_submitted').length;
const generatedBacklogRows = openEvidenceGroundingReviewStatus.filter((row) => row.generated_backlog_packet);
const releaseBlockerRows = openEvidenceGroundingReviewStatus.filter((row) => row.release_blocker_packet);
const generatedBacklogRowsCleared = generatedBacklogRows.filter((row) => row.packet_cleared).length;
const releaseBlockerRowsCleared = releaseBlockerRows.filter((row) => row.packet_cleared).length;
const readyForNationalOpenEvidenceRelease = openEvidenceGroundingReviewStatus.length > 0
  && clearedRows.length === openEvidenceGroundingReviewStatus.length
  && reviewInputIssues.length === 0
  && pendingReviewPackets === 0
  && context.pendingGeneratedOrUnverifiedChunks === 0
  && context.evidenceDashboardReleaseReady
  && context.evidenceDashboardOpenReleaseBlockers === 0
  && context.evidenceAdjudicationReadyForLearnerFeedback;

const artifact = {
  schema_version: 'open_evidence_grounding_review_status_v1',
  generated_at: new Date().toISOString(),
  review_status: !reviewFile
    ? 'open_evidence_grounding_review_inputs_pending'
    : reviewInputIssues.length > 0
      ? 'open_evidence_grounding_review_inputs_invalid'
      : readyForNationalOpenEvidenceRelease
        ? 'open_evidence_grounding_reviews_complete_ready_for_external_audit'
        : 'open_evidence_grounding_reviews_partial_or_limited',
  warning: 'This status validates completed open-evidence grounding reviews. It does not itself approve generated evidence, repair source locators, or authorize national learner-facing clinical feedback.',
  source_contract: {
    open_evidence_grounding_review_packets_schema: packets.schema_version,
    open_evidence_grounding_review_packets_path: 'docs/open_evidence_grounding_review_packets.json',
    evidence_review_backlog_schema: evidenceBacklog.schema_version,
    evidence_quality_dashboard_schema: evidenceDashboard.schema_version,
    clinical_review_adjudication_status_schema: clinicalReviewAdjudicationStatus.schema_version,
    completed_review_file_present: Boolean(reviewFile),
    completed_review_file_path: 'docs/open_evidence_grounding_reviews.json',
    required_completed_review_schema: 'open_evidence_grounding_reviews_v1',
    allowed_review_decisions: [...ALLOWED_DECISIONS].sort(),
    restricted_keys_blocked: [...RESTRICTED_KEYS].sort()
  },
  summary: {
    review_file_present: Boolean(reviewFile),
    total_review_packets: openEvidenceGroundingReviewStatus.length,
    generated_backlog_review_packets: generatedBacklogRows.length,
    release_blocker_review_packets: releaseBlockerRows.length,
    submitted_grounding_reviews: reviews.length,
    valid_grounding_reviews: validRows.length,
    learner_facing_quote_backed_approved_reviews:
      openEvidenceGroundingReviewStatus.filter((row) => row.learner_facing_quote_backed_approved).length,
    cleared_review_packets: clearedRows.length,
    cleared_generated_backlog_review_packets: generatedBacklogRowsCleared,
    cleared_release_blocker_review_packets: releaseBlockerRowsCleared,
    pending_review_packets: pendingReviewPackets,
    missing_grounding_reviews: pendingReviewPackets,
    invalid_review_input_count: reviewInputIssues.length,
    unmatched_submitted_reviews: unmatchedReviewStatuses.length,
    generated_needs_review_chunks_packeted: packets.summary?.generated_needs_review_chunks_packeted || 0,
    generated_or_unverified_chunks_pending_in_backlog: context.pendingGeneratedOrUnverifiedChunks,
    evidence_dashboard_open_release_blockers: context.evidenceDashboardOpenReleaseBlockers,
    evidence_dashboard_release_ready: context.evidenceDashboardReleaseReady,
    evidence_adjudication_ready_for_learner_feedback: context.evidenceAdjudicationReadyForLearnerFeedback,
    ready_for_national_open_evidence_release_from_reviews: readyForNationalOpenEvidenceRelease,
    review_decision_counts: countBy(openEvidenceGroundingReviewStatus, (row) => row.review_decision),
    packet_type_counts: countBy(openEvidenceGroundingReviewStatus, (row) => row.packet_type),
    required_reviewer_role_counts:
      countBy(openEvidenceGroundingReviewStatus.flatMap((row) => row.required_reviewer_roles), (role) => role)
  },
  open_evidence_grounding_review_status: openEvidenceGroundingReviewStatus,
  unmatched_submitted_reviews: unmatchedReviewStatuses,
  readiness_effect: {
    open_evidence_grounding_gate_can_pass_from_current_reviews: readyForNationalOpenEvidenceRelease,
    generated_chunks_remain_quarantined_without_valid_review: true,
    release_blocker_clearance_requires_authoritative_artifact: true,
    learner_facing_quote_backed_approval_requires_adjudicated_replacement_evidence: true,
    required_reviewer_role_coverage_enforced: true,
    restricted_data_leakage_block_enforced: true,
    invalid_review_input_count: reviewInputIssues.length
  },
  issues: reviewInputIssues
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

if (reviewInputIssues.length) {
  console.error(`Open-evidence grounding review inputs are invalid. Issues: ${reviewInputIssues.length}. Status written to ${OUTPUT_JSON_PATH}`);
  for (const issue of reviewInputIssues.slice(0, 20)) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(JSON.stringify({
  review_status: artifact.review_status,
  review_file_present: artifact.summary.review_file_present,
  total_review_packets: artifact.summary.total_review_packets,
  submitted_grounding_reviews: artifact.summary.submitted_grounding_reviews,
  valid_grounding_reviews: artifact.summary.valid_grounding_reviews,
  pending_review_packets: artifact.summary.pending_review_packets,
  invalid_review_input_count: artifact.summary.invalid_review_input_count,
  ready_for_national_open_evidence_release_from_reviews:
    artifact.summary.ready_for_national_open_evidence_release_from_reviews,
  status_path: OUTPUT_JSON_PATH
}, null, 2));
