import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUITE_PATH = join(ROOT, 'docs', 'learner_safety_red_team_suite.json');
const RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'learner_safety_red_team_runtime_report.json');
const REVIEWS_PATH = join(ROOT, 'docs', 'learner_safety_red_team_reviews.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'learner_safety_review_status.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'learner_safety_review_status.md');

const ALLOWED_REVIEW_STATUSES = new Set([
  'approved_for_national_release',
  'approved_for_supervised_pilot_only',
  'revisions_required',
  'rejected'
]);

const APPROVAL_STATUSES = new Set([
  'approved_for_national_release',
  'approved_for_supervised_pilot_only'
]);

const REQUIRED_SCOPE_PATTERNS = [
  /expected safe behavior/i,
  /prohibited behavior/i,
  /runtime/i,
  /(clinical safety|learner safety|patient safety)/i,
  /(evidence|source|case truth)/i
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

function flattenReviews(rawReviews) {
  if (!rawReviews) return [];
  if (Array.isArray(rawReviews)) return rawReviews;
  for (const key of ['safety_reviews', 'red_team_reviews', 'reviews']) {
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

function scopeSufficient(review) {
  const scopeText = asArray(review.review_scope).map(cleanText).join(' | ');
  return REQUIRED_SCOPE_PATTERNS.every((pattern) => pattern.test(scopeText));
}

function validateReview(review, test, runtimeResult, index) {
  const issues = [];
  const label = `red_team_reviews[${index}]`;
  const status = cleanText(review.review_status || review.status);
  const isApproval = APPROVAL_STATUSES.has(status);
  const isNationalApproval = status === 'approved_for_national_release';

  if (!ALLOWED_REVIEW_STATUSES.has(status)) {
    issues.push(`${label}.review_status must be one of ${[...ALLOWED_REVIEW_STATUSES].join(', ')}.`);
  }
  if (!hasCompleteValue(review.reviewed_at)) issues.push(`${label}.reviewed_at is required.`);
  if (!hasCompleteValue(review.signature_attestation)) issues.push(`${label}.signature_attestation is required.`);
  if (!reviewerEvidenceComplete(review, ['emergency_clinician_or_patient_safety_reviewer', 'simulation_educator'])) {
    issues.push(`${label}.reviewed_by must include at least two credentialed reviewers with emergency_clinician_or_patient_safety_reviewer and simulation_educator roles.`);
  }
  if (!scopeSufficient(review)) {
    issues.push(`${label}.review_scope must cover expected safe behavior, prohibited behavior, runtime result, safety, and evidence or case-truth basis.`);
  }
  if (isApproval && runtimeResult?.pass !== true) {
    issues.push(`${label} cannot approve ${test.id} while runtime probe did not pass.`);
  }
  if (isApproval && !hasCompleteValue(review.safety_rationale)) {
    issues.push(`${label}.safety_rationale is required for approval.`);
  }
  if (isApproval && !hasCompleteValue(review.evidence_basis_reviewed)) {
    issues.push(`${label}.evidence_basis_reviewed is required for approval.`);
  }
  if (isApproval && hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes must be cleared before approval.`);
  }
  if (['revisions_required', 'rejected'].includes(status) && !hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes is required for ${status}.`);
  }
  if (isNationalApproval && !hasCompleteValue(review.deployment_limitations)) {
    issues.push(`${label}.deployment_limitations is required for national approval, even if the limitation is none.`);
  }
  if (isNationalApproval && test.category === 'unsupported_medication_or_procedure' && !/dose|medication|procedure|local protocol|supervision/i.test(cleanText(review.safety_rationale))) {
    issues.push(`${label}.safety_rationale must explicitly address medication/procedure scope for ${test.id}.`);
  }

  const restricted = collectRestrictedKeys(review);
  if (restricted.length) issues.push(`${label} includes restricted or direct identifier keys: ${restricted.join(', ')}.`);

  return {
    test_id: test.id,
    category: test.category,
    review_status: status || 'missing',
    valid: issues.length === 0,
    nationally_approved: issues.length === 0 && isNationalApproval,
    supervised_pilot_approved: issues.length === 0 && status === 'approved_for_supervised_pilot_only',
    issues
  };
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function markdown(data) {
  const lines = [
    '# Learner Safety Review Status',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Review file present: ${data.summary.review_file_present}`,
    `- Submitted reviews: ${data.summary.submitted_reviews}`,
    `- Valid reviews: ${data.summary.valid_reviews}`,
    `- Nationally approved tests: ${data.summary.nationally_approved_tests}`,
    `- Tests missing review: ${data.summary.tests_missing_review}`,
    `- Invalid review input count: ${data.summary.invalid_review_input_count}`,
    `- Ready for national learner safety release: ${data.summary.ready_for_national_learner_safety_release}`,
    '',
    '## Test Review Status',
    '',
    '| Test | Category | Review Status | Valid | Issues |',
    '|---|---|---|---:|---:|',
    ...data.test_review_status.map((row) =>
      `| ${markdownEscape(row.test_id)} | ${row.category} | ${row.review_status} | ${row.valid} | ${row.issue_count} |`
    ),
    '',
    '## Reviewer Input',
    '',
    'Completed reviews should be recorded in `docs/learner_safety_red_team_reviews.json` using the `review_submission_template` in the JSON artifact. Runtime probe success alone does not authorize national learner-facing use.'
  ];
  return `${lines.join('\n')}\n`;
}

const suite = readJson(SUITE_PATH);
const runtimeReport = readJson(RUNTIME_REPORT_PATH);
const reviewFile = readOptionalJson(REVIEWS_PATH);
const reviews = flattenReviews(reviewFile);
const testsById = new Map((suite.tests || []).map((test) => [test.id, test]));
const runtimeById = new Map((runtimeReport.results || []).map((result) => [result.test_id, result]));
const issues = [];

if (reviewFile && reviewFile.schema_version !== 'learner_safety_red_team_reviews_v1') {
  issues.push('learner_safety_red_team_reviews.json must use schema_version learner_safety_red_team_reviews_v1.');
}

const seen = new Set();
const reviewStatusByTestId = new Map();
for (const [index, review] of reviews.entries()) {
  const testId = cleanText(review.test_id);
  const test = testsById.get(testId);
  if (!test) {
    issues.push(`red_team_reviews[${index}].test_id does not match a current safety test: ${testId || 'missing'}.`);
    continue;
  }
  if (seen.has(testId)) issues.push(`red_team_reviews[${index}].test_id is duplicated: ${testId}.`);
  seen.add(testId);

  const status = validateReview(review, test, runtimeById.get(testId), index);
  reviewStatusByTestId.set(testId, status);
  issues.push(...status.issues);
}

const testReviewStatus = (suite.tests || []).map((test) => {
  const status = reviewStatusByTestId.get(test.id) || {
    test_id: test.id,
    category: test.category,
    review_status: 'not_reviewed',
    valid: false,
    nationally_approved: false,
    supervised_pilot_approved: false,
    issues: ['No completed learner-safety red-team review submitted.']
  };
  const runtimeResult = runtimeById.get(test.id);
  return {
    ...status,
    runtime_passed: Boolean(runtimeResult?.pass),
    target_surface: test.target_surface,
    issue_count: status.issues.length
  };
});

const validReviews = testReviewStatus.filter((row) => row.valid).length;
const nationallyApprovedTests = testReviewStatus.filter((row) => row.nationally_approved).length;
const supervisedPilotApprovedTests = testReviewStatus.filter((row) => row.supervised_pilot_approved).length;
const testsMissingReview = testReviewStatus.filter((row) => row.review_status === 'not_reviewed').length;
const invalidReviewInputCount = issues.length;
const readyForNationalLearnerSafetyRelease = testReviewStatus.length > 0
  && nationallyApprovedTests === testReviewStatus.length
  && invalidReviewInputCount === 0
  && runtimeReport.summary?.all_policy_tests_passed === true
  && runtimeReport.summary?.all_required_categories_passed === true;

const artifact = {
  schema_version: 'learner_safety_review_status_v1',
  generated_at: new Date().toISOString(),
  review_status: !reviewFile
    ? 'learner_safety_review_inputs_pending'
    : invalidReviewInputCount > 0
      ? 'learner_safety_review_inputs_invalid'
      : readyForNationalLearnerSafetyRelease
        ? 'learner_safety_review_complete_ready_for_readiness_gate'
        : 'learner_safety_review_inputs_partial',
  warning: 'This status validates completed learner-safety red-team review submissions. It does not replace clinical governance approval, legal review, accessibility review, or production monitoring.',
  source_contract: {
    learner_safety_red_team_suite_schema: suite.schema_version,
    learner_safety_runtime_report_schema: runtimeReport.schema_version,
    completed_review_file_present: Boolean(reviewFile),
    completed_review_file_path: 'docs/learner_safety_red_team_reviews.json',
    required_completed_review_schema: 'learner_safety_red_team_reviews_v1'
  },
  summary: {
    review_file_present: Boolean(reviewFile),
    total_tests: testReviewStatus.length,
    submitted_reviews: reviews.length,
    valid_reviews: validReviews,
    nationally_approved_tests: nationallyApprovedTests,
    supervised_pilot_approved_tests: supervisedPilotApprovedTests,
    tests_missing_review: testsMissingReview,
    invalid_review_input_count: invalidReviewInputCount,
    runtime_passed_tests: runtimeReport.summary?.passed_policy_tests || 0,
    runtime_failed_tests: runtimeReport.summary?.failed_policy_tests || 0,
    ready_for_national_learner_safety_release: readyForNationalLearnerSafetyRelease,
    review_status_counts: countBy(testReviewStatus, (row) => row.review_status),
    category_counts: countBy(testReviewStatus, (row) => row.category)
  },
  review_submission_template: {
    schema_version: 'learner_safety_red_team_reviews_v1',
    red_team_reviews: [
      {
        test_id: suite.tests?.[0]?.id || '',
        review_status: 'approved_for_national_release | approved_for_supervised_pilot_only | revisions_required | rejected',
        reviewed_by: [
          {
            name: '',
            role: '',
            institution: '',
            credential_or_position: ''
          }
        ],
        reviewed_at: '',
        review_scope: [
          'expected safe behavior',
          'prohibited behavior',
          'runtime result',
          'clinical safety',
          'evidence or case truth basis'
        ],
        evidence_basis_reviewed: [],
        safety_rationale: '',
        deployment_limitations: '',
        required_changes: [],
        signature_attestation: ''
      }
    ]
  },
  test_review_status: testReviewStatus,
  issues,
  readiness_effect: {
    learner_safety_gate_can_pass_from_current_reviews: readyForNationalLearnerSafetyRelease,
    missing_reviews_block_release: testsMissingReview > 0,
    invalid_review_inputs_block_release: invalidReviewInputCount > 0,
    runtime_failures_block_release: (runtimeReport.summary?.failed_policy_tests || 0) > 0
  }
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  review_file_present: artifact.summary.review_file_present,
  submitted_reviews: artifact.summary.submitted_reviews,
  valid_reviews: artifact.summary.valid_reviews,
  tests_missing_review: artifact.summary.tests_missing_review,
  ready_for_national_learner_safety_release:
    artifact.summary.ready_for_national_learner_safety_release,
  status_path: OUTPUT_JSON_PATH
}, null, 2));
