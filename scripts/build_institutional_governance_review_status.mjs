import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GOVERNANCE_INVENTORY_PATH = join(ROOT, 'docs', 'governance_data_inventory.json');
const GOVERNANCE_PLAN_PATH = join(ROOT, 'docs', 'institutional_governance_privacy_plan.md');
const SCALE_OPERATIONS_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'scale_operations_runtime_report.json');
const ACCESSIBILITY_READINESS_REPORT_PATH = join(ROOT, 'docs', 'accessibility_readiness_report.json');
const REVIEWS_PATH = join(ROOT, 'docs', 'institutional_governance_reviews.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'institutional_governance_review_status.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'institutional_governance_review_status.md');

const ALLOWED_DECISIONS = new Set([
  'approved_for_national_release',
  'approved_for_supervised_pilot_only',
  'revisions_required',
  'rejected'
]);

const DOMAIN_POLICIES = [
  {
    domain: 'privacy_security',
    required_roles: ['privacy_security_officer'],
    required_scope: ['data_inventory', 'browser_storage', 'api_key_handling', 'data_retention', 'incident_response'],
    required_artifacts: ['docs/governance_data_inventory.json', 'docs/institutional_governance_privacy_plan.md']
  },
  {
    domain: 'ferpa_student_record',
    required_roles: ['education_privacy_or_registrar_reviewer'],
    required_scope: ['learner_records', 'cohort_analytics', 'consent_or_disclosure', 'institutional_access', 'retention'],
    required_artifacts: ['docs/governance_data_inventory.json', 'docs/educational_outcomes_measurement_framework.json']
  },
  {
    domain: 'hipaa_or_clinical_data',
    required_roles: ['clinical_privacy_or_compliance_reviewer'],
    required_scope: ['public_case_deidentification', 'restricted_case_boundary', 'optional_ai_data_boundary', 'local_case_policy'],
    required_artifacts: ['docs/governance_data_inventory.json', 'scripts/check_restricted_data_privacy.py']
  },
  {
    domain: 'accessibility_wcag',
    required_roles: ['accessibility_reviewer'],
    required_scope: ['manual_wcag_audit', 'keyboard', 'screen_reader', 'accommodation_process', 'required_curricular_use'],
    required_artifacts: ['docs/accessibility_readiness_report.json', 'docs/scale_accessibility_monitoring_plan.md']
  },
  {
    domain: 'ai_provider_and_dpa',
    required_roles: ['privacy_security_officer'],
    required_scope: ['approved_provider_list', 'data_processing_terms', 'prompt_data_boundary', 'opt_out_or_no_ai_path', 'student_key_policy'],
    required_artifacts: ['docs/governance_data_inventory.json', 'docs/optional_ai_guardrail_runtime_report.json']
  },
  {
    domain: 'clinical_content_governance',
    required_roles: ['clinical_content_owner'],
    required_scope: ['case_truth_review_process', 'source_update_sop', 'unsafe_case_retirement', 'clinical_incident_escalation'],
    required_artifacts: ['docs/case_truth_review_packets.json', 'docs/source_freshness_review_packets.json']
  },
  {
    domain: 'educational_research_irb_or_qi',
    required_roles: ['medical_education_or_irb_reviewer'],
    required_scope: ['irb_or_qi_determination', 'outcome_metrics', 'consent_or_exemption', 'privacy_safe_exports', 'learner_safety_monitoring'],
    required_artifacts: ['docs/educational_outcomes_measurement_framework.json', 'docs/educational_outcomes_validation_status.json']
  },
  {
    domain: 'operations_incident_response',
    required_roles: ['technical_operations_owner'],
    required_scope: ['production_load_test', 'monitoring_dashboard', 'rollback_plan', 'incident_response_drill', 'support_sla'],
    required_artifacts: ['docs/scale_operations_runtime_report.json', 'docs/deployment.md']
  },
  {
    domain: 'multi_institution_release',
    required_roles: ['institutional_sponsor_or_program_owner'],
    required_scope: ['participating_sites', 'governance_board', 'data_sharing_or_no_collection_agreement', 'localization_review', 'support_model'],
    required_artifacts: ['docs/institutional_governance_privacy_plan.md', 'docs/national_scale_readiness_report.json']
  }
];

const DOMAIN_POLICY_BY_ID = new Map(DOMAIN_POLICIES.map((policy) => [policy.domain, policy]));

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
  for (const key of ['institutional_reviews', 'governance_reviews', 'reviews']) {
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
  const reviewersHaveIdentity = reviewers.length >= 1 && identities.size >= 1;
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

function validateReview(review, index) {
  const issues = [];
  const label = `institutional_reviews[${index}]`;
  const domain = cleanText(review.domain);
  const decision = cleanText(review.decision || review.review_decision || review.status);
  const policy = DOMAIN_POLICY_BY_ID.get(domain);
  const nationallyApproved = decision === 'approved_for_national_release';
  const pilotApproved = decision === 'approved_for_supervised_pilot_only';

  if (!policy) {
    issues.push(`${label}.domain must be one of ${DOMAIN_POLICIES.map((item) => item.domain).join(', ')}.`);
  }
  if (!ALLOWED_DECISIONS.has(decision)) {
    issues.push(`${label}.decision must be one of ${[...ALLOWED_DECISIONS].join(', ')}.`);
  }
  if (!hasCompleteValue(review.review_id)) issues.push(`${label}.review_id is required.`);
  if (!hasCompleteValue(review.reviewed_at)) issues.push(`${label}.reviewed_at is required.`);
  if (!hasCompleteValue(review.signature_attestation)) issues.push(`${label}.signature_attestation is required.`);
  if (policy && !reviewerEvidenceComplete(review, policy.required_roles)) {
    issues.push(`${label}.reviewed_by must include credentialed reviewer evidence for roles: ${policy.required_roles.join(', ')}.`);
  }
  if (policy && !hasAll(review.scope_reviewed, policy.required_scope)) {
    issues.push(`${label}.scope_reviewed must include ${policy.required_scope.join(', ')}.`);
  }
  if (policy && !hasAll(review.evidence_artifacts_reviewed, policy.required_artifacts)) {
    issues.push(`${label}.evidence_artifacts_reviewed must include ${policy.required_artifacts.join(', ')}.`);
  }
  if ((nationallyApproved || pilotApproved) && !hasCompleteValue(review.approval_expiration_or_next_review_due)) {
    issues.push(`${label}.approval_expiration_or_next_review_due is required for approvals.`);
  }
  if (nationallyApproved && hasCompleteValue(review.required_changes)) {
    issues.push(`${label}.required_changes must be cleared before national approval.`);
  }
  if (nationallyApproved && !hasCompleteValue(review.risk_acceptance_or_release_rationale)) {
    issues.push(`${label}.risk_acceptance_or_release_rationale is required for national approval.`);
  }
  if ((decision === 'revisions_required' || decision === 'rejected' || pilotApproved) && !hasCompleteValue(review.restrictions_or_required_changes)) {
    issues.push(`${label}.restrictions_or_required_changes must explain non-national decisions.`);
  }

  const restricted = collectRestrictedKeys(review);
  if (restricted.length) issues.push(`${label} includes restricted or direct identifier keys: ${restricted.join(', ')}.`);

  return {
    domain: domain || 'missing',
    review_id: cleanText(review.review_id) || `missing_${index}`,
    decision: decision || 'missing',
    valid: issues.length === 0,
    nationally_approved: issues.length === 0 && nationallyApproved,
    supervised_pilot_approved: issues.length === 0 && pilotApproved,
    issues
  };
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function markdown(data) {
  const lines = [
    '# Institutional Governance Review Status',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Review file present: ${data.summary.review_file_present}`,
    `- Required domains: ${data.summary.required_domains}`,
    `- Submitted reviews: ${data.summary.submitted_reviews}`,
    `- Valid reviews: ${data.summary.valid_reviews}`,
    `- Nationally approved domains: ${data.summary.nationally_approved_domains}`,
    `- Supervised-pilot approved domains: ${data.summary.supervised_pilot_approved_domains}`,
    `- Domains missing review: ${data.summary.domains_missing_review}`,
    `- Invalid review input count: ${data.summary.invalid_review_input_count}`,
    `- Ready for national institutional release: ${data.summary.ready_for_national_institutional_release}`,
    '',
    '## Domain Status',
    '',
    '| Domain | Decision | Valid | National Approval | Issues |',
    '|---|---|---:|---:|---:|',
    ...data.domain_review_status.map((row) =>
      `| ${markdownEscape(row.domain)} | ${row.decision} | ${row.valid} | ${row.nationally_approved} | ${row.issue_count} |`
    ),
    '',
    '## Reviewer Input',
    '',
    'Completed institutional approvals should be recorded in `docs/institutional_governance_reviews.json` using the `review_submission_template` in the JSON artifact. Governance documentation, static smoke probes, and a draft privacy inventory do not authorize national learner-facing deployment by themselves.'
  ];
  return `${lines.join('\n')}\n`;
}

const governanceInventory = readJson(GOVERNANCE_INVENTORY_PATH);
const scaleOperationsRuntimeReport = readJson(SCALE_OPERATIONS_RUNTIME_REPORT_PATH);
const accessibilityReadinessReport = readJson(ACCESSIBILITY_READINESS_REPORT_PATH);
const reviewFile = readOptionalJson(REVIEWS_PATH);
const reviews = flattenReviews(reviewFile);
const issues = [];

if (reviewFile && reviewFile.schema_version !== 'institutional_governance_reviews_v1') {
  issues.push('institutional_governance_reviews.json must use schema_version institutional_governance_reviews_v1.');
}

const seen = new Set();
const reviewStatusByDomain = new Map();
for (const [index, review] of reviews.entries()) {
  const status = validateReview(review, index);
  if (seen.has(status.domain)) {
    status.issues.push(`institutional_reviews[${index}].domain is duplicated: ${status.domain}.`);
  }
  seen.add(status.domain);
  reviewStatusByDomain.set(status.domain, status);
  issues.push(...status.issues);
}

const domainReviewStatus = DOMAIN_POLICIES.map((policy) => {
  const status = reviewStatusByDomain.get(policy.domain) || {
    domain: policy.domain,
    review_id: 'not_submitted',
    decision: 'not_reviewed',
    valid: false,
    nationally_approved: false,
    supervised_pilot_approved: false,
    issues: ['No completed institutional governance review submitted.']
  };
  return {
    ...status,
    required_roles: policy.required_roles,
    required_scope: policy.required_scope,
    required_artifacts: policy.required_artifacts,
    issue_count: status.issues.length
  };
});

const validReviews = domainReviewStatus.filter((row) => row.valid).length;
const nationallyApprovedDomains = domainReviewStatus.filter((row) => row.nationally_approved).length;
const supervisedPilotApprovedDomains = domainReviewStatus.filter((row) => row.supervised_pilot_approved).length;
const domainsMissingReview = domainReviewStatus.filter((row) => row.decision === 'not_reviewed').length;
const invalidReviewInputCount = issues.length;
const requiredDomains = DOMAIN_POLICIES.length;
const runtimeOpsReady = scaleOperationsRuntimeReport.summary?.production_load_test_completed === true
  && scaleOperationsRuntimeReport.summary?.production_monitoring_dashboard_operational === true
  && scaleOperationsRuntimeReport.summary?.incident_response_drill_completed === true;
const manualWcagReady = accessibilityReadinessReport.summary?.manual_wcag_required === false;
const readyForNationalInstitutionalRelease = requiredDomains > 0
  && nationallyApprovedDomains === requiredDomains
  && invalidReviewInputCount === 0
  && governanceInventory.review_status === 'approved'
  && runtimeOpsReady
  && manualWcagReady;

const artifact = {
  schema_version: 'institutional_governance_review_status_v1',
  generated_at: new Date().toISOString(),
  review_status: !reviewFile
    ? 'institutional_governance_review_inputs_pending'
    : invalidReviewInputCount > 0
      ? 'institutional_governance_review_inputs_invalid'
      : readyForNationalInstitutionalRelease
        ? 'institutional_governance_ready_for_national_release'
        : 'institutional_governance_review_inputs_partial',
  warning: 'This status validates institutional governance review submissions. It does not replace legal advice, IRB determinations, FERPA/HIPAA decisions, security review, manual WCAG audit, production load testing, monitoring evidence, or signed multi-institution agreements.',
  source_contract: {
    governance_data_inventory_schema: governanceInventory.schema_version,
    governance_plan_present: existsSync(GOVERNANCE_PLAN_PATH),
    scale_operations_runtime_report_schema: scaleOperationsRuntimeReport.schema_version,
    accessibility_readiness_report_schema: accessibilityReadinessReport.schema_version,
    completed_review_file_present: Boolean(reviewFile),
    completed_review_file_path: 'docs/institutional_governance_reviews.json',
    required_completed_review_schema: 'institutional_governance_reviews_v1'
  },
  summary: {
    review_file_present: Boolean(reviewFile),
    required_domains: requiredDomains,
    submitted_reviews: reviews.length,
    valid_reviews: validReviews,
    nationally_approved_domains: nationallyApprovedDomains,
    supervised_pilot_approved_domains: supervisedPilotApprovedDomains,
    domains_missing_review: domainsMissingReview,
    invalid_review_input_count: invalidReviewInputCount,
    data_inventory_review_status: governanceInventory.review_status,
    production_load_test_completed: Boolean(scaleOperationsRuntimeReport.summary?.production_load_test_completed),
    production_monitoring_dashboard_operational: Boolean(scaleOperationsRuntimeReport.summary?.production_monitoring_dashboard_operational),
    incident_response_drill_completed: Boolean(scaleOperationsRuntimeReport.summary?.incident_response_drill_completed),
    manual_wcag_required: Boolean(accessibilityReadinessReport.summary?.manual_wcag_required),
    ready_for_national_institutional_release: readyForNationalInstitutionalRelease,
    decision_counts: countBy(domainReviewStatus, (row) => row.decision)
  },
  domain_policies: DOMAIN_POLICIES,
  review_submission_template: {
    schema_version: 'institutional_governance_reviews_v1',
    institutional_reviews: DOMAIN_POLICIES.map((policy) => ({
      review_id: `${policy.domain}_001`,
      domain: policy.domain,
      decision: 'approved_for_national_release | approved_for_supervised_pilot_only | revisions_required | rejected',
      reviewed_by: [
        {
          name: '',
          role: policy.required_roles[0],
          institution: '',
          credential_or_position: ''
        }
      ],
      reviewed_at: '',
      scope_reviewed: policy.required_scope,
      evidence_artifacts_reviewed: policy.required_artifacts,
      approval_expiration_or_next_review_due: '',
      risk_acceptance_or_release_rationale: '',
      restrictions_or_required_changes: [],
      signature_attestation: ''
    }))
  },
  domain_review_status: domainReviewStatus,
  issues,
  readiness_effect: {
    scale_governance_gate_can_pass_from_current_reviews: readyForNationalInstitutionalRelease,
    missing_governance_reviews_block_release: domainsMissingReview > 0,
    invalid_governance_review_inputs_block_release: invalidReviewInputCount > 0,
    data_inventory_approval_missing: governanceInventory.review_status !== 'approved',
    production_load_or_monitoring_evidence_missing: !runtimeOpsReady,
    manual_wcag_audit_missing: !manualWcagReady
  }
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  review_file_present: artifact.summary.review_file_present,
  submitted_reviews: artifact.summary.submitted_reviews,
  valid_reviews: artifact.summary.valid_reviews,
  domains_missing_review: artifact.summary.domains_missing_review,
  ready_for_national_institutional_release:
    artifact.summary.ready_for_national_institutional_release,
  status_path: OUTPUT_JSON_PATH
}, null, 2));
