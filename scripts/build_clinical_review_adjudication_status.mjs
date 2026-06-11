import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const BUNDLE_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_knowledge_bundle.json');
const CASE_TRUTH_PACKETS_PATH = join(ROOT, 'docs', 'case_truth_review_packets.json');
const EVIDENCE_BACKLOG_PATH = join(ROOT, 'docs', 'evidence_review_backlog.json');
const CASE_ADJUDICATIONS_PATH = join(ROOT, 'docs', 'case_truth_adjudications.json');
const EVIDENCE_ADJUDICATIONS_PATH = join(ROOT, 'docs', 'evidence_chunk_adjudications.json');
const CONTRACT_PATH = join(ROOT, 'docs', 'clinical_review_adjudication_contract.md');
const STATUS_PATH = join(ROOT, 'docs', 'clinical_review_adjudication_status.json');

const REQUIRED_CLINICIAN_FIELDS = [
  'reference_esi_confirmation',
  'source_record_or_best_adjudicated_diagnosis',
  'acceptable_differential_diagnoses',
  'consult_or_referral_truth',
  'immediate_stabilization_priorities',
  'expected_resource_profile',
  'objective_data_to_reveal_if_requested',
  'reassessment_and_escalation_triggers',
  'disposition_truth_and_rationale',
  'unsafe_or_misleading_feedback_to_block',
  'equity_bias_and_language_notes'
];

const REQUIRED_EDUCATOR_FIELDS = [
  'intended_learner_level',
  'clinical_reasoning_objectives_supported',
  'common_error_patterns_to_teach',
  'debrief_feedback_points',
  'assessment_rubric_alignment'
];

const CASE_READY_STATUS = 'adjudicated_ready_for_case_truth';
const EVIDENCE_APPROVAL_STATUSES = new Set([
  'approved_for_learner_feedback',
  'approved_for_background_teaching',
  'approved_case_specific_only'
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

function reviewerRoles(reviewers = []) {
  return new Set(reviewers.flatMap((reviewer) => reviewer.roles || reviewer.role || []));
}

function reviewerIds(reviewers = []) {
  return new Set(reviewers.map((reviewer) => cleanText(reviewer.reviewer_id || reviewer.id)).filter(Boolean));
}

function reviewersComplete(reviewers = [], requiredRoles = []) {
  const roles = reviewerRoles(reviewers);
  const ids = reviewerIds(reviewers);
  const attested = reviewers.every((reviewer) => cleanText(reviewer.attested_at).length > 0 && hasCompleteValue(reviewer.scope || reviewer.review_scope || 'scope'));
  return reviewers.length >= 2
    && ids.size >= 2
    && attested
    && requiredRoles.every((role) => roles.has(role));
}

function chunkIsHighRisk(chunk) {
  const haystack = [
    chunk?.facet_id,
    chunk?.section,
    ...(chunk?.topic_tags || [])
  ].join(' ');
  return /(shock|sepsis|stroke|acs|troponin|overdose|naloxone|infant|ectopic|restraints|agitation|dka|hhs|arrest|airway|thrombolytic|red_flags|initial_management|medication_procedure|disposition_reassessment)/i.test(haystack);
}

function learnerFacingUse(adjudication) {
  const learnerUse = adjudication.learner_use || adjudication.approved_use || [];
  const values = Array.isArray(learnerUse) ? learnerUse : [learnerUse];
  return values.some((value) => /(deterministic_feedback|high_risk_feedback|scoring_reference|learner_feedback)/i.test(cleanText(value)));
}

function validateCaseAdjudications(file, cases, packets) {
  const issues = [];
  const caseIds = new Set(cases.map((caseRecord) => caseRecord.id));
  const packetIds = new Set((packets.case_review_packets || []).map((packet) => packet.case_id));
  const adjudications = file?.adjudications || [];

  if (!file) {
    return {
      file_present: false,
      schema_version: 'missing',
      total_adjudications: 0,
      ready_case_truth_adjudications: 0,
      status_counts: {},
      issues,
      can_claim_reviewed_case_truth: false
    };
  }

  if (file.schema_version !== 'case_truth_adjudications_v1') {
    issues.push('case_truth_adjudications.json must use schema_version case_truth_adjudications_v1.');
  }

  const seen = new Set();
  for (const [index, adjudication] of adjudications.entries()) {
    const label = `adjudications[${index}]`;
    const caseId = adjudication.case_id;
    if (!caseIds.has(caseId)) issues.push(`${label}.case_id does not match a current public case: ${caseId || 'missing'}.`);
    if (!packetIds.has(caseId)) issues.push(`${label}.case_id does not have a matching review packet: ${caseId || 'missing'}.`);
    if (seen.has(caseId)) issues.push(`${label}.case_id is duplicated: ${caseId}.`);
    seen.add(caseId);

    const restricted = collectRestrictedKeys(adjudication);
    if (restricted.length) issues.push(`${label} includes restricted source keys: ${restricted.join(', ')}.`);

    if (adjudication.status === CASE_READY_STATUS) {
      const clinician = adjudication.clinician_adjudication || {};
      const educator = adjudication.educator_validation || {};
      for (const field of REQUIRED_CLINICIAN_FIELDS) {
        if (!hasCompleteValue(clinician[field])) issues.push(`${label}.clinician_adjudication.${field} is required before case truth can be ready.`);
      }
      for (const field of REQUIRED_EDUCATOR_FIELDS) {
        if (!hasCompleteValue(educator[field])) issues.push(`${label}.educator_validation.${field} is required before case truth can be ready.`);
      }
      if (!reviewersComplete(adjudication.reviewers || [], ['emergency_medicine_clinician', 'medical_educator'])) {
        issues.push(`${label}.reviewers must include at least two attested reviewers with emergency_medicine_clinician and medical_educator roles.`);
      }
      const disagreement = adjudication.disagreement_resolution || {};
      if (disagreement.disagreement_present === true && !hasCompleteValue(disagreement.resolution_summary)) {
        issues.push(`${label}.disagreement_resolution.resolution_summary is required when disagreement_present is true.`);
      }
    }
  }

  const readyCount = adjudications.filter((item) => item.status === CASE_READY_STATUS).length;
  return {
    file_present: true,
    schema_version: file.schema_version || 'missing',
    total_adjudications: adjudications.length,
    ready_case_truth_adjudications: readyCount,
    status_counts: countBy(adjudications, (item) => item.status),
    issues,
    can_claim_reviewed_case_truth: issues.length === 0 && readyCount === cases.length
  };
}

function validateEvidenceAdjudications(file, bundle) {
  const issues = [];
  const chunksById = new Map((bundle.chunks || []).map((chunk) => [chunk.id, chunk]));
  const adjudications = file?.adjudications || [];

  if (!file) {
    return {
      file_present: false,
      schema_version: 'missing',
      total_adjudications: 0,
      approved_chunks: 0,
      learner_feedback_approved_chunks: 0,
      high_risk_learner_feedback_approved_chunks: 0,
      status_counts: {},
      issues,
      can_release_generated_chunks: false
    };
  }

  if (file.schema_version !== 'evidence_chunk_adjudications_v1') {
    issues.push('evidence_chunk_adjudications.json must use schema_version evidence_chunk_adjudications_v1.');
  }

  const seen = new Set();
  for (const [index, adjudication] of adjudications.entries()) {
    const label = `adjudications[${index}]`;
    const chunkId = adjudication.chunk_id;
    const chunk = chunksById.get(chunkId);
    if (!chunk) issues.push(`${label}.chunk_id does not match a public evidence chunk: ${chunkId || 'missing'}.`);
    if (seen.has(chunkId)) issues.push(`${label}.chunk_id is duplicated: ${chunkId}.`);
    seen.add(chunkId);

    const restricted = collectRestrictedKeys(adjudication);
    if (restricted.length) issues.push(`${label} includes restricted source keys: ${restricted.join(', ')}.`);

    if (EVIDENCE_APPROVAL_STATUSES.has(adjudication.status)) {
      const locator = adjudication.source_locator || {};
      if (!hasCompleteValue(locator.url || locator.doi || locator.pmid)) {
        issues.push(`${label}.source_locator must include a URL, DOI, or PMID for approved evidence.`);
      }
      if (!hasCompleteValue(locator.section_or_page || locator.heading || locator.table_or_figure)) {
        issues.push(`${label}.source_locator must include a retrievable section, page, heading, table, or figure.`);
      }
      const hasQuoteOrClinicalParaphrase = hasCompleteValue(adjudication.quote_backed_excerpt)
        || hasCompleteValue(adjudication.clinician_approved_paraphrase);
      if (!hasQuoteOrClinicalParaphrase) {
        issues.push(`${label} needs quote_backed_excerpt or clinician_approved_paraphrase before approval.`);
      }
      if (!hasCompleteValue(adjudication.applicability_limits)) {
        issues.push(`${label}.applicability_limits is required for approved evidence.`);
      }
      if (!reviewersComplete(adjudication.reviewers || [], ['source_or_library_reviewer_for_locator_quality'])) {
        issues.push(`${label}.reviewers must include at least two attested reviewers and a source_or_library_reviewer_for_locator_quality role.`);
      }
      if ((chunkIsHighRisk(chunk) || learnerFacingUse(adjudication)) && !reviewerRoles(adjudication.reviewers || []).has('emergency_medicine_clinician')) {
        issues.push(`${label}.reviewers must include emergency_medicine_clinician for high-risk or learner-facing approval.`);
      }
    }
  }

  const approved = adjudications.filter((item) => EVIDENCE_APPROVAL_STATUSES.has(item.status));
  const learnerApproved = approved.filter(learnerFacingUse);
  const highRiskLearnerApproved = learnerApproved.filter((item) => chunkIsHighRisk(chunksById.get(item.chunk_id)));
  return {
    file_present: true,
    schema_version: file.schema_version || 'missing',
    total_adjudications: adjudications.length,
    approved_chunks: approved.length,
    learner_feedback_approved_chunks: learnerApproved.length,
    high_risk_learner_feedback_approved_chunks: highRiskLearnerApproved.length,
    status_counts: countBy(adjudications, (item) => item.status),
    issues,
    can_release_generated_chunks: issues.length === 0 && approved.length > 0
  };
}

const cases = readJson(CASES_PATH);
const bundle = readJson(BUNDLE_PATH);
const packets = readJson(CASE_TRUTH_PACKETS_PATH);
const evidenceBacklog = readJson(EVIDENCE_BACKLOG_PATH);
const caseAdjudications = readOptionalJson(CASE_ADJUDICATIONS_PATH);
const evidenceAdjudications = readOptionalJson(EVIDENCE_ADJUDICATIONS_PATH);

const caseTruth = validateCaseAdjudications(caseAdjudications, cases, packets);
const evidence = validateEvidenceAdjudications(evidenceAdjudications, bundle);
const allIssues = [...caseTruth.issues, ...evidence.issues];

const artifact = {
  schema_version: 'clinical_review_adjudication_status_v1',
  generated_at: new Date().toISOString(),
  review_status: allIssues.length
    ? 'adjudication_inputs_invalid'
    : caseTruth.ready_case_truth_adjudications === cases.length && evidence.approved_chunks >= evidenceBacklog.summary.pending_generated_or_unverified_chunks
      ? 'adjudication_complete_ready_for_external_audit'
      : 'contract_ready_review_inputs_pending',
  warning: 'This status validates the review contract only. It does not turn draft case augmentations or generated evidence into medical truth without completed reviewer attestations.',
  contract: {
    contract_document_present: existsSync(CONTRACT_PATH),
    contract_document_path: 'docs/clinical_review_adjudication_contract.md',
    required_case_schema_version: 'case_truth_adjudications_v1',
    required_evidence_schema_version: 'evidence_chunk_adjudications_v1',
    minimum_case_reviewers_per_case: 2,
    minimum_evidence_reviewers_per_chunk: 2,
    restricted_keys_blocked: [...RESTRICTED_KEYS].sort()
  },
  case_truth: {
    ...caseTruth,
    current_public_cases: cases.length,
    review_packets_available: packets.case_review_packets?.length || 0,
    required_clinician_fields: REQUIRED_CLINICIAN_FIELDS,
    required_educator_fields: REQUIRED_EDUCATOR_FIELDS
  },
  evidence: {
    ...evidence,
    current_public_chunks: bundle.chunks?.length || 0,
    pending_generated_or_unverified_chunks: evidenceBacklog.summary.pending_generated_or_unverified_chunks,
    required_approval_statuses: [...EVIDENCE_APPROVAL_STATUSES].sort()
  },
  readiness_effect: {
    case_truth_gate_can_pass_from_current_adjudications: caseTruth.can_claim_reviewed_case_truth,
    open_evidence_gate_can_release_generated_chunks_from_current_adjudications: evidence.can_release_generated_chunks,
    invalid_review_input_count: allIssues.length
  },
  issues: allIssues
};

writeFileSync(STATUS_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

if (allIssues.length) {
  console.error(`Clinical review adjudication inputs are invalid. Issues: ${allIssues.length}. Status written to ${STATUS_PATH}`);
  for (const issue of allIssues.slice(0, 20)) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(JSON.stringify({
  review_status: artifact.review_status,
  contract_document_present: artifact.contract.contract_document_present,
  ready_case_truth_adjudications: artifact.case_truth.ready_case_truth_adjudications,
  approved_evidence_chunks: artifact.evidence.approved_chunks,
  invalid_review_input_count: artifact.readiness_effect.invalid_review_input_count,
  status_path: STATUS_PATH
}, null, 2));
