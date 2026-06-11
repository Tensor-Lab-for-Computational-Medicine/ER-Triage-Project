import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EQUITY_AUDIT_PATH = join(ROOT, 'docs', 'equity_bias_readiness_audit.json');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const REVIEWS_PATH = join(ROOT, 'docs', 'equity_case_reviews.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'equity_case_review_status.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'equity_case_review_status.md');

const ALLOWED_REVIEW_DECISIONS = new Set([
  'approved_for_national_release',
  'approved_for_supervised_pilot_only',
  'revisions_required',
  'rejected'
]);

const REQUIRED_REVIEWER_ROLES = [
  'clinical_equity_reviewer',
  'simulation_educator',
  'language_access_or_accessibility_reviewer'
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

function flattenReviews(rawReviews) {
  if (!rawReviews) return [];
  if (Array.isArray(rawReviews)) return rawReviews;
  for (const key of ['equity_case_reviews', 'case_reviews', 'reviews']) {
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

function reviewerEvidenceComplete(review) {
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
    && REQUIRED_REVIEWER_ROLES.every((role) => roles.has(role));
}

function hasAll(values, requiredValues) {
  const present = new Set(asArray(values).map(cleanText).filter(Boolean));
  return requiredValues.every((item) => present.has(item));
}

function queueByCase(audit) {
  return new Map((audit.case_equity_review_queue || []).map((entry) => [entry.case_id, entry]));
}

function validateReview(review, queueEntry, index) {
  const issues = [];
  const label = `equity_case_reviews[${index}]`;
  const decision = cleanText(review.review_decision || review.decision || review.status);
  const nationalApproval = decision === 'approved_for_national_release';
  const pilotApproval = decision === 'approved_for_supervised_pilot_only';
  const requiredDomains = queueEntry.required_review_domains || [];

  if (!ALLOWED_REVIEW_DECISIONS.has(decision)) {
    issues.push(`${label}.review_decision must be one of ${[...ALLOWED_REVIEW_DECISIONS].join(', ')}.`);
  }
  if (!hasCompleteValue(review.review_id)) issues.push(`${label}.review_id is required.`);
  if (!hasCompleteValue(review.reviewed_at)) issues.push(`${label}.reviewed_at is required.`);
  if (!hasCompleteValue(review.signature_attestation)) issues.push(`${label}.signature_attestation is required.`);
  if (!reviewerEvidenceComplete(review)) {
    issues.push(`${label}.reviewed_by must include at least two credentialed reviewers covering ${REQUIRED_REVIEWER_ROLES.join(', ')}.`);
  }
  if (!hasAll(review.review_domains_approved || review.domains_reviewed, requiredDomains)) {
    issues.push(`${label}.review_domains_approved must include every required case domain: ${requiredDomains.join(', ')}.`);
  }
  if (!hasCompleteValue(review.bias_risk_assessment)) issues.push(`${label}.bias_risk_assessment is required.`);
  if (!hasCompleteValue(review.language_access_review)) issues.push(`${label}.language_access_review is required.`);
  if (!hasCompleteValue(review.disability_accommodation_review)) issues.push(`${label}.disability_accommodation_review is required.`);
  if (!hasCompleteValue(review.pain_and_distress_review)) issues.push(`${label}.pain_and_distress_review is required.`);
  if (!hasCompleteValue(review.safe_follow_up_review)) issues.push(`${label}.safe_follow_up_review is required.`);
  if (requiredDomains.includes('pregnancy_and_reproductive_health_safety') && !hasCompleteValue(review.pregnancy_reproductive_health_review)) {
    issues.push(`${label}.pregnancy_reproductive_health_review is required for this case.`);
  }
  if (requiredDomains.includes('older_adult_atypical_presentation_and_delirium_risk') && !hasCompleteValue(review.older_adult_review)) {
    issues.push(`${label}.older_adult_review is required for this case.`);
  }
  if (requiredDomains.includes('mental_health_substance_use_and_capacity_stigma_review') && !hasCompleteValue(review.mental_health_substance_use_stigma_review)) {
    issues.push(`${label}.mental_health_substance_use_stigma_review is required for this case.`);
  }
  if (requiredDomains.includes('social_context_without_blame_or_noncompliance_labels') && !hasCompleteValue(review.social_context_review)) {
    issues.push(`${label}.social_context_review is required for this case.`);
  }
  if ((nationalApproval || pilotApproval) && !hasCompleteValue(review.feedback_or_case_text_reviewed)) {
    issues.push(`${label}.feedback_or_case_text_reviewed is required before approval.`);
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
    case_id: queueEntry.case_id,
    review_id: cleanText(review.review_id) || `missing_${index}`,
    review_decision: decision || 'missing',
    valid: issues.length === 0,
    nationally_approved: issues.length === 0 && nationalApproval,
    supervised_pilot_approved: issues.length === 0 && pilotApproval,
    issues
  };
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function markdown(data) {
  const lines = [
    '# Equity Case Review Status',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Review file present: ${data.summary.review_file_present}`,
    `- Total cases: ${data.summary.total_cases}`,
    `- Submitted reviews: ${data.summary.submitted_reviews}`,
    `- Valid reviews: ${data.summary.valid_reviews}`,
    `- Nationally approved cases: ${data.summary.nationally_approved_cases}`,
    `- Supervised-pilot approved cases: ${data.summary.supervised_pilot_approved_cases}`,
    `- Cases missing review: ${data.summary.cases_missing_review}`,
    `- Invalid review input count: ${data.summary.invalid_review_input_count}`,
    `- Ready for national equity release: ${data.summary.ready_for_national_equity_release}`,
    '',
    '## Case Status',
    '',
    '| Case | Decision | Valid | National Approval | Issues |',
    '|---|---|---:|---:|---:|',
    ...data.case_review_status.map((row) =>
      `| ${markdownEscape(row.case_id)} | ${row.review_decision} | ${row.valid} | ${row.nationally_approved} | ${row.issue_count} |`
    ),
    '',
    '## Reviewer Input',
    '',
    'Completed equity reviews should be recorded in `docs/equity_case_reviews.json` using the `review_submission_template` in the JSON artifact. Automated bias-policy probes are not case-level equity approval.'
  ];
  return `${lines.join('\n')}\n`;
}

const cases = readJson(CASES_PATH);
const equityAudit = readJson(EQUITY_AUDIT_PATH);
const reviewFile = readOptionalJson(REVIEWS_PATH);
const reviews = flattenReviews(reviewFile);
const caseQueueById = queueByCase(equityAudit);
const issues = [];

if (reviewFile && reviewFile.schema_version !== 'equity_case_reviews_v1') {
  issues.push('equity_case_reviews.json must use schema_version equity_case_reviews_v1.');
}

const seen = new Set();
const reviewStatusByCaseId = new Map();
for (const [index, review] of reviews.entries()) {
  const caseId = cleanText(review.case_id);
  const queueEntry = caseQueueById.get(caseId);
  if (!queueEntry) {
    issues.push(`equity_case_reviews[${index}].case_id does not match a current equity review queue case: ${caseId || 'missing'}.`);
    continue;
  }
  const status = validateReview(review, queueEntry, index);
  if (seen.has(caseId)) {
    status.issues.push(`equity_case_reviews[${index}].case_id is duplicated: ${caseId}.`);
  }
  seen.add(caseId);
  reviewStatusByCaseId.set(caseId, status);
  issues.push(...status.issues);
}

const caseReviewStatus = (equityAudit.case_equity_review_queue || []).map((entry) => {
  const status = reviewStatusByCaseId.get(entry.case_id) || {
    case_id: entry.case_id,
    review_id: 'not_submitted',
    review_decision: 'not_reviewed',
    valid: false,
    nationally_approved: false,
    supervised_pilot_approved: false,
    issues: ['No completed equity case review submitted.']
  };
  return {
    ...status,
    required_review_domains: entry.required_review_domains || [],
    age_band: entry.age_band,
    sex: entry.sex,
    reference_esi: entry.reference_esi,
    issue_count: status.issues.length
  };
});

const validReviews = caseReviewStatus.filter((row) => row.valid).length;
const nationallyApprovedCases = caseReviewStatus.filter((row) => row.nationally_approved).length;
const supervisedPilotApprovedCases = caseReviewStatus.filter((row) => row.supervised_pilot_approved).length;
const casesMissingReview = caseReviewStatus.filter((row) => row.review_decision === 'not_reviewed').length;
const invalidReviewInputCount = issues.length;
const readyForNationalEquityRelease = caseReviewStatus.length > 0
  && nationallyApprovedCases === caseReviewStatus.length
  && invalidReviewInputCount === 0
  && equityAudit.summary?.all_bias_policy_probes_passed === true
  && equityAudit.summary?.learner_safety_bias_probe_present === true;

const artifact = {
  schema_version: 'equity_case_review_status_v1',
  generated_at: new Date().toISOString(),
  review_status: !reviewFile
    ? 'equity_case_review_inputs_pending'
    : invalidReviewInputCount > 0
      ? 'equity_case_review_inputs_invalid'
      : readyForNationalEquityRelease
        ? 'equity_case_reviews_ready_for_national_release'
        : 'equity_case_review_inputs_partial',
  warning: 'This status validates completed equity and bias review submissions for cases. It does not replace clinical case-truth review, accessibility review, language-access policy approval, curriculum committee review, or institutional governance approval.',
  source_contract: {
    equity_bias_readiness_audit_schema: equityAudit.schema_version,
    completed_review_file_present: Boolean(reviewFile),
    completed_review_file_path: 'docs/equity_case_reviews.json',
    required_completed_review_schema: 'equity_case_reviews_v1',
    current_case_count: cases.length
  },
  summary: {
    review_file_present: Boolean(reviewFile),
    total_cases: caseReviewStatus.length,
    submitted_reviews: reviews.length,
    valid_reviews: validReviews,
    nationally_approved_cases: nationallyApprovedCases,
    supervised_pilot_approved_cases: supervisedPilotApprovedCases,
    cases_missing_review: casesMissingReview,
    invalid_review_input_count: invalidReviewInputCount,
    automated_bias_policy_probes_passed: Boolean(equityAudit.summary?.all_bias_policy_probes_passed),
    learner_safety_bias_probe_present: Boolean(equityAudit.summary?.learner_safety_bias_probe_present),
    ready_for_national_equity_release: readyForNationalEquityRelease,
    decision_counts: countBy(caseReviewStatus, (row) => row.review_decision)
  },
  review_submission_template: {
    schema_version: 'equity_case_reviews_v1',
    case_reviews: [
      {
        case_id: caseReviewStatus[0]?.case_id || '',
        review_id: 'equity_case_review_001',
        review_decision: 'approved_for_national_release | approved_for_supervised_pilot_only | revisions_required | rejected',
        reviewed_by: [
          {
            name: '',
            role: 'clinical_equity_reviewer | simulation_educator | language_access_or_accessibility_reviewer',
            institution: '',
            credential_or_position: ''
          }
        ],
        reviewed_at: '',
        review_domains_approved: caseReviewStatus[0]?.required_review_domains || [],
        feedback_or_case_text_reviewed: '',
        bias_risk_assessment: '',
        language_access_review: '',
        disability_accommodation_review: '',
        pregnancy_reproductive_health_review: '',
        older_adult_review: '',
        mental_health_substance_use_stigma_review: '',
        social_context_review: '',
        pain_and_distress_review: '',
        safe_follow_up_review: '',
        required_changes: [],
        restrictions_or_required_changes: [],
        signature_attestation: ''
      }
    ]
  },
  case_review_status: caseReviewStatus,
  issues,
  readiness_effect: {
    equity_bias_gate_can_pass_from_current_reviews: readyForNationalEquityRelease,
    missing_equity_reviews_block_release: casesMissingReview > 0,
    invalid_equity_review_inputs_block_release: invalidReviewInputCount > 0
  }
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  review_file_present: artifact.summary.review_file_present,
  submitted_reviews: artifact.summary.submitted_reviews,
  valid_reviews: artifact.summary.valid_reviews,
  cases_missing_review: artifact.summary.cases_missing_review,
  ready_for_national_equity_release: artifact.summary.ready_for_national_equity_release,
  status_path: OUTPUT_JSON_PATH
}, null, 2));
