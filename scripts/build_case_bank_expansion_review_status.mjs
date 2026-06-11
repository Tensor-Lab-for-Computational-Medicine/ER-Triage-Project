import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const CASE_BANK_EXPANSION_STATUS_PATH = join(ROOT, 'docs', 'case_bank_expansion_status.json');
const CASE_BANK_EXPANSION_PACKETS_PATH = join(ROOT, 'docs', 'case_bank_expansion_packets.json');
const CASE_GENERATION_QUALITY_REPORT_PATH = join(ROOT, 'docs', 'case_generation_quality_report.json');
const REVIEWS_PATH = join(ROOT, 'docs', 'case_bank_expansion_reviews.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'case_bank_expansion_review_status.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'case_bank_expansion_review_status.md');

const ALLOWED_COUNTING_DECISIONS = new Set([
  'approved_to_count_toward_national_case_bank',
  'approved_for_supervised_pilot_only',
  'source_or_truth_revisions_required',
  'equity_or_curriculum_revisions_required',
  'rejected',
  'blocked'
]);

const COUNTING_APPROVAL_DECISIONS = new Set([
  'approved_to_count_toward_national_case_bank'
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
  'raw_case_text',
  'raw_source_note',
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
  return /^(pending|todo|tbd|unknown|n\/a|not reviewed|blocked)$/i.test(cleanText(value));
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
  for (const key of ['blueprint_reviews', 'case_bank_expansion_reviews', 'reviews']) {
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
    const role = cleanText(reviewer?.role);
    if (role) roles.add(role);
    for (const nestedRole of asArray(reviewer?.roles)) {
      const clean = cleanText(nestedRole);
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

function targetProfileMatches(review, blueprint) {
  const confirmed = review.target_profile_confirmed || review.target_profile || {};
  return ['acuity', 'age_band', 'special_population', 'presentation'].every((key) =>
    cleanText(confirmed[key]) === cleanText(blueprint.target_profile?.[key])
  );
}

function validateReview(review, blueprint, caseIds, index) {
  const issues = [];
  const label = `blueprint_reviews[${index}]`;
  const decision = cleanText(review.national_case_bank_counting_decision || review.review_status || review.status);
  const approvedToCount = COUNTING_APPROVAL_DECISIONS.has(decision);

  if (!ALLOWED_COUNTING_DECISIONS.has(decision)) {
    issues.push(`${label}.national_case_bank_counting_decision must be one of ${[...ALLOWED_COUNTING_DECISIONS].join(', ')}.`);
  }
  if (cleanText(review.blueprint_id) !== blueprint.id) {
    issues.push(`${label}.blueprint_id must match ${blueprint.id}.`);
  }
  if (!hasCompleteValue(review.reviewed_at)) issues.push(`${label}.reviewed_at is required.`);
  if (!hasCompleteValue(review.reviewer_attestation)) issues.push(`${label}.reviewer_attestation is required.`);
  if (!reviewerEvidenceComplete(review, blueprint.required_reviews_before_counting || [])) {
    issues.push(`${label}.reviewed_by must include at least two credentialed reviewers covering required roles: ${(blueprint.required_reviews_before_counting || []).join(', ')}.`);
  }
  if (!targetProfileMatches(review, blueprint)) {
    issues.push(`${label}.target_profile_confirmed must match blueprint target profile.`);
  }
  if (approvedToCount && !hasCompleteValue(review.created_case_id)) {
    issues.push(`${label}.created_case_id is required before a blueprint can count toward the national case bank.`);
  }
  if (approvedToCount && !caseIds.has(cleanText(review.created_case_id))) {
    issues.push(`${label}.created_case_id must exist in frontend/src/data/cases.json before counting.`);
  }
  if (approvedToCount && !hasCompleteValue(review.source_record_or_teaching_case_provenance)) {
    issues.push(`${label}.source_record_or_teaching_case_provenance is required for counting approval.`);
  }
  if (approvedToCount && !hasCompleteValue(review.source_deidentification_attestation)) {
    issues.push(`${label}.source_deidentification_attestation is required for counting approval.`);
  }
  for (const field of [
    'case_truth_adjudication_id',
    'equity_review_id',
    'curriculum_mapping_review_id',
    'feedback_traceability_review_id'
  ]) {
    if (approvedToCount && !hasCompleteValue(review[field])) {
      issues.push(`${label}.${field} is required before counting approval.`);
    }
  }
  if (approvedToCount && hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes must be cleared before counting approval.`);
  }
  if (!approvedToCount && ['source_or_truth_revisions_required', 'equity_or_curriculum_revisions_required', 'rejected', 'blocked'].includes(decision) && !hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes is required for ${decision}.`);
  }

  const restricted = collectRestrictedKeys(review);
  if (restricted.length) issues.push(`${label} includes restricted or direct identifier keys: ${restricted.join(', ')}.`);

  return {
    blueprint_id: blueprint.id,
    created_case_id: cleanText(review.created_case_id),
    review_decision: decision || 'missing',
    valid: issues.length === 0,
    approved_to_count_toward_national_case_bank: issues.length === 0 && approvedToCount,
    supervised_pilot_approved: issues.length === 0 && decision === 'approved_for_supervised_pilot_only',
    target_profile: blueprint.target_profile,
    issues
  };
}

function markdownEscape(value) {
  return cleanText(value).replace(/\|/g, '/');
}

function markdown(data) {
  const lines = [
    '# Case Bank Expansion Review Status',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Review file present: ${data.summary.review_file_present}`,
    `- Blueprint slots: ${data.summary.blueprint_slots}`,
    `- Submitted blueprint reviews: ${data.summary.submitted_blueprint_reviews}`,
    `- Valid blueprint reviews: ${data.summary.valid_blueprint_reviews}`,
    `- National countable blueprint reviews: ${data.summary.national_countable_blueprint_reviews}`,
    `- Pending blueprint reviews: ${data.summary.pending_blueprint_reviews}`,
    `- Invalid review input count: ${data.summary.invalid_review_input_count}`,
    `- Ready for national case-bank release from reviews: ${data.summary.ready_for_national_case_bank_release_from_reviews}`,
    '',
    '## Blueprint Status',
    '',
    '| Blueprint | Decision | Valid | Countable | Issues |',
    '|---|---|---:|---:|---:|',
    ...data.blueprint_review_status.slice(0, 60).map((row) =>
      `| ${markdownEscape(row.blueprint_id)} | ${row.review_decision} | ${row.valid} | ${row.approved_to_count_toward_national_case_bank} | ${row.issue_count} |`
    ),
    data.blueprint_review_status.length > 60
      ? `| ... | ${data.blueprint_review_status.length - 60} additional blueprint statuses omitted from Markdown preview |  |  |  |`
      : '',
    '',
    '## Reviewer Input',
    '',
    'Completed case-bank expansion reviews should be recorded in `docs/case_bank_expansion_reviews.json`. Approved blueprint reviews cannot count toward national release unless the created case is present in the public case bank and downstream truth, equity, curriculum, and feedback review IDs are recorded.'
  ].filter((line) => line !== '');
  return `${lines.join('\n')}\n`;
}

const cases = readJson(CASES_PATH);
const caseIds = new Set(cases.map((caseRecord) => caseRecord.id));
const caseBankStatus = readJson(CASE_BANK_EXPANSION_STATUS_PATH);
const packets = readJson(CASE_BANK_EXPANSION_PACKETS_PATH);
const qualityReport = readJson(CASE_GENERATION_QUALITY_REPORT_PATH);
const reviewFile = readOptionalJson(REVIEWS_PATH);
const reviews = flattenReviews(reviewFile);
const blueprintSlots = packets.case_blueprint_slots || [];
const blueprintById = new Map(blueprintSlots.map((blueprint) => [blueprint.id, blueprint]));

const topLevelIssues = [];
if (reviewFile && reviewFile.schema_version !== 'case_bank_expansion_reviews_v1') {
  topLevelIssues.push('case_bank_expansion_reviews.json must use schema_version case_bank_expansion_reviews_v1.');
}

const seen = new Set();
const reviewStatusByBlueprintId = new Map();
const unmatchedReviews = [];
for (const [index, review] of reviews.entries()) {
  const blueprintId = cleanText(review.blueprint_id);
  const blueprint = blueprintById.get(blueprintId);
  if (!blueprint) {
    unmatchedReviews.push({
      blueprint_id: blueprintId || 'missing',
      created_case_id: cleanText(review.created_case_id),
      review_decision: cleanText(review.national_case_bank_counting_decision || review.review_status || review.status) || 'missing',
      valid: false,
      approved_to_count_toward_national_case_bank: false,
      supervised_pilot_approved: false,
      issues: [`blueprint_reviews[${index}] does not match a current case-bank expansion blueprint.`]
    });
    continue;
  }
  const status = validateReview(review, blueprint, caseIds, index);
  if (seen.has(blueprint.id)) {
    status.issues.push(`blueprint_reviews[${index}].blueprint_id is duplicated: ${blueprint.id}.`);
    status.valid = false;
    status.approved_to_count_toward_national_case_bank = false;
    status.supervised_pilot_approved = false;
  }
  seen.add(blueprint.id);
  reviewStatusByBlueprintId.set(blueprint.id, status);
}

const blueprintReviewStatus = blueprintSlots.map((blueprint) => {
  const status = reviewStatusByBlueprintId.get(blueprint.id) || {
    blueprint_id: blueprint.id,
    created_case_id: '',
    review_decision: 'not_submitted',
    valid: false,
    approved_to_count_toward_national_case_bank: false,
    supervised_pilot_approved: false,
    target_profile: blueprint.target_profile,
    issues: ['No completed case-bank expansion blueprint review submitted.']
  };
  return {
    ...status,
    required_reviews_before_counting: blueprint.required_reviews_before_counting || [],
    issue_count: status.issues.length
  };
});

const submittedStatuses = [
  ...blueprintReviewStatus.filter((row) => row.review_decision !== 'not_submitted'),
  ...unmatchedReviews
];
const reviewInputIssues = [
  ...topLevelIssues,
  ...submittedStatuses.flatMap((row) => row.issues)
];
const validBlueprintReviews = blueprintReviewStatus.filter((row) => row.valid).length;
const nationalCountableBlueprintReviews = blueprintReviewStatus.filter((row) => row.approved_to_count_toward_national_case_bank).length;
const supervisedPilotBlueprintReviews = blueprintReviewStatus.filter((row) => row.supervised_pilot_approved).length;
const pendingBlueprintReviews = blueprintReviewStatus.filter((row) => row.review_decision === 'not_submitted').length;
const readyForNationalCaseBankReleaseFromReviews = blueprintReviewStatus.length > 0
  && nationalCountableBlueprintReviews === blueprintReviewStatus.length
  && reviewInputIssues.length === 0
  && pendingBlueprintReviews === 0
  && qualityReport.summary?.national_release_ready === true
  && caseBankStatus.summary?.ready_for_national_case_bank_release === true;

const artifact = {
  schema_version: 'case_bank_expansion_review_status_v1',
  generated_at: new Date().toISOString(),
  review_status: !reviewFile
    ? 'case_bank_expansion_review_inputs_pending'
    : reviewInputIssues.length > 0
      ? 'case_bank_expansion_review_inputs_invalid'
      : readyForNationalCaseBankReleaseFromReviews
        ? 'case_bank_expansion_reviews_complete_ready_for_external_audit'
        : 'case_bank_expansion_reviews_partial_or_limited',
  warning: 'This status validates completed case-bank expansion blueprint reviews. It does not create cases, approve generated cases, or replace case truth, evidence, equity, curriculum, feedback, governance, or outcomes review.',
  source_contract: {
    case_bank_expansion_status_schema: caseBankStatus.schema_version,
    case_bank_expansion_status_path: 'docs/case_bank_expansion_status.json',
    case_bank_expansion_packets_schema: packets.schema_version,
    case_bank_expansion_packets_path: 'docs/case_bank_expansion_packets.json',
    case_generation_quality_report_schema: qualityReport.schema_version,
    completed_review_file_present: Boolean(reviewFile),
    completed_review_file_path: 'docs/case_bank_expansion_reviews.json',
    required_completed_review_schema_version: 'case_bank_expansion_reviews_v1',
    allowed_counting_decisions: [...ALLOWED_COUNTING_DECISIONS].sort(),
    restricted_keys_blocked: [...RESTRICTED_KEYS].sort(),
    generated_or_synthetic_cases_count_for_national_release_without_review: false
  },
  summary: {
    review_file_present: Boolean(reviewFile),
    current_cases: caseBankStatus.summary?.current_cases || cases.length,
    national_case_count_minimum: caseBankStatus.summary?.national_case_count_minimum || 100,
    case_count_shortfall: caseBankStatus.summary?.case_count_shortfall || 0,
    target_gap_packets: packets.summary?.target_gap_packets || 0,
    blueprint_slots: blueprintReviewStatus.length,
    submitted_blueprint_reviews: reviews.length,
    valid_blueprint_reviews: validBlueprintReviews,
    national_countable_blueprint_reviews: nationalCountableBlueprintReviews,
    supervised_pilot_blueprint_reviews: supervisedPilotBlueprintReviews,
    pending_blueprint_reviews: pendingBlueprintReviews,
    missing_blueprint_reviews: pendingBlueprintReviews,
    invalid_review_input_count: reviewInputIssues.length,
    unmatched_submitted_reviews: unmatchedReviews.length,
    all_target_shortfalls_have_blueprint_coverage:
      Boolean(packets.summary?.all_target_shortfalls_have_blueprint_coverage),
    national_release_eligible_cases: qualityReport.summary?.national_release_eligible_cases || 0,
    case_generation_quality_national_release_ready:
      Boolean(qualityReport.summary?.national_release_ready),
    case_bank_status_ready_for_national_release:
      Boolean(caseBankStatus.summary?.ready_for_national_case_bank_release),
    ready_for_national_case_bank_release_from_reviews:
      readyForNationalCaseBankReleaseFromReviews,
    review_decision_counts: countBy(blueprintReviewStatus, (row) => row.review_decision),
    required_reviewer_role_counts:
      countBy(blueprintReviewStatus.flatMap((row) => row.required_reviews_before_counting), (role) => role)
  },
  blueprint_review_status: blueprintReviewStatus,
  unmatched_submitted_reviews: unmatchedReviews,
  readiness_effect: {
    case_generation_quality_gate_can_pass_from_current_reviews:
      readyForNationalCaseBankReleaseFromReviews,
    invalid_review_input_count: reviewInputIssues.length,
    generated_or_synthetic_case_counting_block_enforced: true,
    created_public_case_id_required_for_counting: true,
    downstream_review_linkage_required_for_counting: true,
    restricted_data_leakage_block_enforced: true,
    required_reviewer_role_coverage_enforced: true
  },
  issues: reviewInputIssues
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

if (reviewInputIssues.length) {
  console.error(`Case-bank expansion review inputs are invalid. Issues: ${reviewInputIssues.length}. Status written to ${OUTPUT_JSON_PATH}`);
  for (const issue of reviewInputIssues.slice(0, 20)) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(JSON.stringify({
  review_status: artifact.review_status,
  review_file_present: artifact.summary.review_file_present,
  submitted_blueprint_reviews: artifact.summary.submitted_blueprint_reviews,
  valid_blueprint_reviews: artifact.summary.valid_blueprint_reviews,
  pending_blueprint_reviews: artifact.summary.pending_blueprint_reviews,
  invalid_review_input_count: artifact.summary.invalid_review_input_count,
  ready_for_national_case_bank_release_from_reviews:
    artifact.summary.ready_for_national_case_bank_release_from_reviews,
  status_path: OUTPUT_JSON_PATH
}, null, 2));
