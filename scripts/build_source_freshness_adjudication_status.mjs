import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_FRESHNESS_REPORT_PATH = join(ROOT, 'docs', 'source_freshness_report.json');
const SOURCE_FRESHNESS_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'source_freshness_review_packets.json');
const SOURCE_FRESHNESS_REVIEWS_PATH = join(ROOT, 'docs', 'source_freshness_reviews.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'source_freshness_adjudication_status.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'source_freshness_adjudication_status.md');

const ALLOWED_OUTCOMES = new Set([
  'current_source_confirmed_for_formative_feedback',
  'current_source_confirmed_for_national_feedback',
  'replace_with_newer_public_source',
  'retire_or_quarantine_affected_chunks',
  'revise_claims_or_chunk_topic_mapping',
  'escalate_for_specialty_adjudication',
  'rejected'
]);

const ALLOWED_LEARNER_FACING_USE = new Set([
  'blocked',
  'formative_only',
  'approved_for_national_feedback'
]);

const ALLOWED_CHUNK_ACTIONS = new Set([
  'keep',
  'revise',
  'replace',
  'retire',
  'escalate'
]);

const NATIONAL_OUTCOMES = new Set([
  'current_source_confirmed_for_national_feedback'
]);

const NONAPPROVAL_OUTCOMES = new Set([
  'replace_with_newer_public_source',
  'retire_or_quarantine_affected_chunks',
  'revise_claims_or_chunk_topic_mapping',
  'escalate_for_specialty_adjudication',
  'rejected'
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

function flattenReviews(rawReviews) {
  if (!rawReviews) return [];
  if (Array.isArray(rawReviews)) return rawReviews;
  for (const key of ['source_reviews', 'reviews', 'sources']) {
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

function normalizedChunkAction(review) {
  const raw = cleanText(review.affected_chunk_action || review.chunk_action);
  if (!raw) return '';
  return raw.split('|')[0].trim();
}

function newestSourceConfirmed(review) {
  const value = review.newest_source_confirmed;
  if (value === true) return true;
  return /^(true|yes|confirmed|current|newest_source_confirmed)$/i.test(cleanText(value));
}

function validateReview(review, packet, context, index) {
  const issues = [];
  const label = `source_reviews[${index}]`;
  const outcome = cleanText(review.review_outcome || review.review_status || review.status);
  const learnerUse = cleanText(review.learner_facing_use || review.learner_use);
  const chunkAction = normalizedChunkAction(review);
  const isNationalApproval = NATIONAL_OUTCOMES.has(outcome) || learnerUse === 'approved_for_national_feedback';
  const isNonapproval = NONAPPROVAL_OUTCOMES.has(outcome) || ['revise', 'replace', 'retire', 'escalate'].includes(chunkAction);

  if (!ALLOWED_OUTCOMES.has(outcome)) {
    issues.push(`${label}.review_outcome must be one of ${[...ALLOWED_OUTCOMES].join(', ')}.`);
  }
  if (!ALLOWED_LEARNER_FACING_USE.has(learnerUse)) {
    issues.push(`${label}.learner_facing_use must be one of ${[...ALLOWED_LEARNER_FACING_USE].join(', ')}.`);
  }
  if (!ALLOWED_CHUNK_ACTIONS.has(chunkAction)) {
    issues.push(`${label}.affected_chunk_action must be one of ${[...ALLOWED_CHUNK_ACTIONS].join(', ')}.`);
  }
  if (!hasCompleteValue(review.reviewed_at)) issues.push(`${label}.reviewed_at is required.`);
  if (!hasCompleteValue(review.source_version_or_access_date_reviewed)) {
    issues.push(`${label}.source_version_or_access_date_reviewed is required.`);
  }
  if (!hasCompleteValue(review.signature_attestation)) issues.push(`${label}.signature_attestation is required.`);
  if (!reviewerEvidenceComplete(review, packet.reviewer_roles_required || [])) {
    issues.push(`${label}.reviewed_by must include at least two credentialed reviewers covering required roles: ${(packet.reviewer_roles_required || []).join(', ')}.`);
  }
  if (isNationalApproval && !newestSourceConfirmed(review)) {
    issues.push(`${label}.newest_source_confirmed must be true before national feedback approval.`);
  }
  if (isNationalApproval && chunkAction !== 'keep') {
    issues.push(`${label}.affected_chunk_action must be keep for national approval; revise, replace, retire, or escalate means approval is not complete.`);
  }
  if (isNationalApproval && hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes must be cleared before national approval.`);
  }
  if (learnerUse === 'approved_for_national_feedback' && !NATIONAL_OUTCOMES.has(outcome)) {
    issues.push(`${label}.review_outcome must be current_source_confirmed_for_national_feedback when learner_facing_use is approved_for_national_feedback.`);
  }
  if (learnerUse === 'blocked' && !isNonapproval) {
    issues.push(`${label}.review_outcome or affected_chunk_action should explain why learner-facing use is blocked.`);
  }
  if (['replace', 'retire', 'escalate'].includes(chunkAction) && !hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes is required when affected_chunk_action is ${chunkAction}.`);
  }
  if (chunkAction === 'replace' && !hasCompleteValue(review.replacement_source_id_or_url)) {
    issues.push(`${label}.replacement_source_id_or_url is required when affected_chunk_action is replace.`);
  }
  if (packet.status === 'stale' && isNationalApproval && !context.sourceFreshnessReleaseReady) {
    issues.push(`${label} cannot clear stale source ${packet.source_id} until source metadata, replacement, or chunk retirement makes the source freshness report release-ready.`);
  }

  const restricted = collectRestrictedKeys(review);
  if (restricted.length) issues.push(`${label} includes restricted source keys: ${restricted.join(', ')}.`);

  return {
    packet_id: packet.id,
    source_id: packet.source_id,
    review_outcome: outcome || 'missing',
    learner_facing_use: learnerUse || 'missing',
    affected_chunk_action: chunkAction || 'missing',
    valid: issues.length === 0,
    issues
  };
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function markdown(data) {
  const lines = [
    '# Source Freshness Adjudication Status',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Review file present: ${data.summary.review_file_present}`,
    `- Submitted reviews: ${data.summary.submitted_source_reviews}`,
    `- Valid source reviews: ${data.summary.valid_source_reviews}`,
    `- Nationally approved source reviews: ${data.summary.nationally_approved_source_reviews}`,
    `- Invalid review input count: ${data.summary.invalid_review_input_count}`,
    `- Packets missing review: ${data.summary.packets_missing_review}`,
    `- Ready for national source freshness release: ${data.summary.ready_for_national_source_freshness_release}`,
    '',
    '## Source Status',
    '',
    '| Source | Packet | Outcome | Learner Use | Valid | Issues |',
    '|---|---|---|---|---:|---:|',
    ...data.source_review_status.map((row) =>
      `| ${markdownEscape(row.source_id)} | ${row.packet_id} | ${row.review_outcome} | ${row.learner_facing_use} | ${row.valid} | ${row.issue_count} |`
    )
  ];
  return `${lines.join('\n')}\n`;
}

const sourceFreshnessReport = readJson(SOURCE_FRESHNESS_REPORT_PATH);
const packets = readJson(SOURCE_FRESHNESS_REVIEW_PACKETS_PATH);
const reviewFile = readOptionalJson(SOURCE_FRESHNESS_REVIEWS_PATH);
const reviews = flattenReviews(reviewFile);
const packetsBySourceId = new Map((packets.source_review_packets || []).map((packet) => [packet.source_id, packet]));
const sourceFreshnessReleaseReady = Boolean(sourceFreshnessReport.summary?.learner_facing_source_freshness_release_ready);
const issues = [];

if (reviewFile && reviewFile.schema_version !== 'source_freshness_reviews_v1') {
  issues.push('source_freshness_reviews.json must use schema_version source_freshness_reviews_v1.');
}

const seen = new Set();
const reviewStatusBySourceId = new Map();
for (const [index, review] of reviews.entries()) {
  const sourceId = cleanText(review.source_id);
  const packet = packetsBySourceId.get(sourceId);
  if (!packet) {
    issues.push(`source_reviews[${index}].source_id does not match a current source freshness packet: ${sourceId || 'missing'}.`);
    continue;
  }
  if (seen.has(sourceId)) issues.push(`source_reviews[${index}].source_id is duplicated: ${sourceId}.`);
  seen.add(sourceId);

  const status = validateReview(review, packet, { sourceFreshnessReleaseReady }, index);
  reviewStatusBySourceId.set(sourceId, status);
  issues.push(...status.issues);
}

const sourceReviewStatus = (packets.source_review_packets || []).map((packet) => {
  const status = reviewStatusBySourceId.get(packet.source_id) || {
    packet_id: packet.id,
    source_id: packet.source_id,
    review_outcome: 'not_reviewed',
    learner_facing_use: 'blocked',
    affected_chunk_action: 'missing',
    valid: false,
    issues: ['No completed source freshness review submitted.']
  };
  return {
    ...status,
    packet_priority: packet.priority,
    source_status: packet.status,
    release_blocker_from_freshness_report: packet.release_blocker,
    required_roles: packet.reviewer_roles_required || [],
    issue_count: status.issues.length
  };
});

const validReviews = sourceReviewStatus.filter((row) => row.valid).length;
const nationallyApprovedSourceReviews = sourceReviewStatus.filter((row) =>
  row.valid
    && row.review_outcome === 'current_source_confirmed_for_national_feedback'
    && row.learner_facing_use === 'approved_for_national_feedback'
).length;
const packetsMissingReview = sourceReviewStatus.filter((row) => row.review_outcome === 'not_reviewed').length;
const invalidReviewInputCount = issues.length;
const readyForNationalSourceFreshnessRelease = sourceReviewStatus.length > 0
  && nationallyApprovedSourceReviews === sourceReviewStatus.length
  && invalidReviewInputCount === 0
  && sourceFreshnessReleaseReady
  && sourceFreshnessReport.summary?.learner_facing_quote_backed_sources_release_blocked === 0
  && sourceFreshnessReport.summary?.stale_learner_facing_quote_backed_sources === 0;

const reviewStatus = !reviewFile
  ? 'source_freshness_review_inputs_pending'
  : invalidReviewInputCount > 0
    ? 'source_freshness_review_inputs_invalid'
    : nationallyApprovedSourceReviews === sourceReviewStatus.length && !sourceFreshnessReleaseReady
      ? 'source_freshness_review_complete_metadata_or_replacement_updates_required'
      : readyForNationalSourceFreshnessRelease
        ? 'source_freshness_review_complete_ready_for_readiness_gate'
        : 'source_freshness_review_inputs_partial';

const artifact = {
  schema_version: 'source_freshness_adjudication_status_v1',
  generated_at: new Date().toISOString(),
  review_status: reviewStatus,
  warning: 'This status validates completed source-freshness review submissions. It does not replace source metadata updates, evidence chunk adjudication, or clinician approval of case-specific feedback.',
  source_contract: {
    source_freshness_report_schema: sourceFreshnessReport.schema_version,
    source_freshness_review_packets_schema: packets.schema_version,
    completed_review_file_present: Boolean(reviewFile),
    completed_review_file_path: 'docs/source_freshness_reviews.json',
    required_completed_review_schema: 'source_freshness_reviews_v1',
    local_review_date_may_be_added_only_after_valid_completed_review: true
  },
  summary: {
    review_file_present: Boolean(reviewFile),
    total_packets: packets.summary?.total_packets || sourceReviewStatus.length,
    submitted_source_reviews: reviews.length,
    valid_source_reviews: validReviews,
    nationally_approved_source_reviews: nationallyApprovedSourceReviews,
    invalid_review_input_count: invalidReviewInputCount,
    packets_missing_review: packetsMissingReview,
    source_freshness_report_release_ready: sourceFreshnessReleaseReady,
    learner_facing_quote_backed_sources_release_blocked:
      sourceFreshnessReport.summary?.learner_facing_quote_backed_sources_release_blocked || 0,
    stale_learner_facing_quote_backed_sources:
      sourceFreshnessReport.summary?.stale_learner_facing_quote_backed_sources || 0,
    ready_for_national_source_freshness_release: readyForNationalSourceFreshnessRelease,
    review_outcome_counts: countBy(sourceReviewStatus, (row) => row.review_outcome),
    source_status_counts: countBy(sourceReviewStatus, (row) => row.source_status)
  },
  review_submission_template: {
    schema_version: 'source_freshness_reviews_v1',
    source_reviews: [
      {
        source_id: packets.source_review_packets?.[0]?.source_id || '',
        review_outcome: 'current_source_confirmed_for_national_feedback | current_source_confirmed_for_formative_feedback | replace_with_newer_public_source | retire_or_quarantine_affected_chunks | revise_claims_or_chunk_topic_mapping | escalate_for_specialty_adjudication | rejected',
        reviewed_by: [
          {
            name: '',
            role: '',
            institution: '',
            credential_or_position: ''
          }
        ],
        reviewed_at: '',
        source_version_or_access_date_reviewed: '',
        newest_source_confirmed: false,
        replacement_source_id_or_url: '',
        affected_chunk_action: 'keep | revise | replace | retire | escalate',
        learner_facing_use: 'blocked | formative_only | approved_for_national_feedback',
        required_changes: [],
        signature_attestation: ''
      }
    ]
  },
  source_review_status: sourceReviewStatus,
  issues,
  readiness_effect: {
    source_freshness_gate_can_pass_from_current_reviews: readyForNationalSourceFreshnessRelease,
    missing_source_reviews_block_release: packetsMissingReview > 0,
    invalid_review_inputs_block_release: invalidReviewInputCount > 0,
    freshness_metadata_or_replacement_updates_still_required: !sourceFreshnessReleaseReady
  }
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  review_file_present: artifact.summary.review_file_present,
  submitted_source_reviews: artifact.summary.submitted_source_reviews,
  valid_source_reviews: artifact.summary.valid_source_reviews,
  invalid_review_input_count: artifact.summary.invalid_review_input_count,
  ready_for_national_source_freshness_release:
    artifact.summary.ready_for_national_source_freshness_release,
  status_path: OUTPUT_JSON_PATH
}, null, 2));
