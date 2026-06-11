import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const FEEDBACK_TRACEABILITY_MATRIX_PATH = join(ROOT, 'docs', 'feedback_traceability_matrix.json');
const CLINICAL_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'clinical_review_adjudication_status.json');
const CASE_GENERATION_QUALITY_REPORT_PATH = join(ROOT, 'docs', 'case_generation_quality_report.json');
const EVIDENCE_REVIEW_BACKLOG_PATH = join(ROOT, 'docs', 'evidence_review_backlog.json');
const OPEN_EVIDENCE_POLICY_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'open_evidence_runtime_policy_report.json');
const CLAIM_ENTAILMENT_REVIEWS_PATH = join(ROOT, 'docs', 'learner_facing_claim_entailment_reviews.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_review_packets.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_review_packets.md');

const APPROVED_NATIONAL_STATUSES = new Set([
  'approved_for_national_release',
  'approved_for_summative_feedback',
  'approved_for_learner_feedback'
]);

const APPROVED_LIMITED_STATUSES = new Set([
  ...APPROVED_NATIONAL_STATUSES,
  'approved_formative_only',
  'clinician_approved',
  'approved'
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  return existsSync(path) ? readJson(path) : null;
}

function flattenClaimReviews(rawReviews) {
  if (!rawReviews) return [];
  if (Array.isArray(rawReviews)) return rawReviews;
  for (const key of ['claim_reviews', 'reviews', 'claims']) {
    if (Array.isArray(rawReviews[key])) return rawReviews[key];
  }
  return [];
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function uniqueSorted(items) {
  return [...new Set(items.filter(Boolean))].sort();
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function ageBand(ageValue) {
  const age = Number(ageValue);
  if (!Number.isFinite(age)) return 'unknown';
  if (age < 18) return 'pediatric';
  if (age < 40) return 'adult_18_39';
  if (age < 65) return 'adult_40_64';
  return 'older_adult_65_plus';
}

function caseSummary(caseRecord) {
  return {
    case_id: caseRecord.id,
    acuity: caseRecord.acuity || '',
    complaint: cleanText(caseRecord.complaint || caseRecord.source?.chief_complaint),
    age_band: ageBand(caseRecord.demographics?.age ?? caseRecord.source?.age),
    sex: caseRecord.demographics?.sex || caseRecord.source?.sex || 'unknown',
    vitals_present: Boolean(caseRecord.vitals && Object.keys(caseRecord.vitals).length > 0),
    source_basis: caseRecord.augmentation?.source_basis || caseRecord.source_basis || '',
    review_status: caseRecord.augmentation?.review_status || caseRecord.review_status || 'unknown'
  };
}

function claimSetType(domain) {
  if (domain.scoring_mode === 'formative_when_truth_missing') return 'source_limited_formative_claim_set';
  if (domain.scoring_mode?.includes('structure')) return 'rubric_grounded_documentation_claim_set';
  return 'case_grounded_numeric_feedback_claim_set';
}

function reviewerRolesForDomain(domainKey) {
  const roles = new Set(['simulation_educator']);
  if (['esi', 'safety', 'focused_exam', 'diagnosis', 'referral', 'escalation', 'reassessment'].includes(domainKey)) {
    roles.add('emergency_clinician');
  }
  if (['interview', 'soap', 'sbar'].includes(domainKey)) {
    roles.add('clinical_skills_faculty');
  }
  if (['diagnosis', 'referral', 'escalation', 'reassessment'].includes(domainKey)) {
    roles.add('medical_librarian_or_evidence_reviewer');
  }
  return [...roles];
}

function currentReleaseStatus(domain, reviewStatus) {
  if (APPROVED_NATIONAL_STATUSES.has(reviewStatus)) return 'reviewed_for_national_release_pending_system_gate_alignment';
  if (APPROVED_LIMITED_STATUSES.has(reviewStatus)) return 'reviewed_limited_scope_not_national_release';
  if (domain.source_limited_formative_cases > 0) return 'blocked_truth_unavailable_formative_only';
  if (domain.scoring_mode?.includes('structure')) return 'rubric_grounded_pending_faculty_calibration';
  return 'case_grounded_pending_clinician_educator_calibration';
}

function reviewScopeForDomain(domain) {
  const common = [
    'learner-facing feedback messages',
    'numeric or formative scoring behavior',
    'unsafe omission and escalation language',
    'case-source traceability rows'
  ];
  if (domain.scoring_mode === 'formative_when_truth_missing') {
    return [
      ...common,
      'formative-only limitation text',
      'criteria for promotion to numeric scoring after truth adjudication'
    ];
  }
  if (domain.scoring_mode?.includes('structure')) {
    return [
      ...common,
      'documentation rubric anchors',
      'minimum evidence-use expectations',
      'faculty calibration plan'
    ];
  }
  return [
    ...common,
    'score thresholds and partial-credit logic',
    'case truth and objective signal alignment'
  ];
}

function requiredEntailmentEvidence(domain) {
  const evidence = [
    'Feedback traceability rows for every current public case in this domain.',
    'Clinician or faculty reviewer attestation that the feedback claim is entailed by case facts or a clearly cited standard.',
    'Equity and learner-safety check for stereotype-sensitive or overconfident wording.'
  ];
  if (domain.source_limited_formative_cases > 0) {
    evidence.push('Case truth adjudication resolving missing source-record diagnosis, referral, or reassessment fields before numeric use.');
  }
  if (domain.scoring_mode?.includes('structure')) {
    evidence.push('Faculty calibration record for the rubric anchors before summative assessment use.');
  } else {
    evidence.push('Emergency clinician calibration record for scoring thresholds and unsafe omission handling.');
  }
  evidence.push('Quote-backed open evidence or clinician-approved local standard for any claim that goes beyond case-record facts.');
  return evidence;
}

function reviewQuestionsForDomain(domain) {
  return [
    `Are all ${domain.label} feedback claims supported by the case facts, quote-backed open evidence, or a clinician-approved local standard?`,
    'Could the current wording overstate certainty, imply a diagnosis that is not source-record truth, or recommend unsafe action?',
    'Is the scoring behavior appropriate for formative practice, summative assessment, or neither at national scale?',
    'What exact changes are required before this domain can be released to medical students outside a supervised pilot?'
  ];
}

function acceptanceCriteriaForDomain(domain) {
  const criteria = [
    {
      id: 'case_fact_entailment',
      criterion: 'Every feedback claim can be traced to case-source facts, adjudicated case truth, quote-backed evidence, or a named local standard.'
    },
    {
      id: 'no_unreviewed_generated_evidence',
      criterion: 'No generated-needs-review evidence chunk is used as learner-facing support.'
    },
    {
      id: 'safety_language_calibrated',
      criterion: 'High-risk escalation, stabilization, and unsafe omission feedback is clinically calibrated and does not overstate certainty.'
    },
    {
      id: 'equity_language_reviewed',
      criterion: 'Feedback avoids stereotype-driven reasoning and flags access, communication, and demographic limitations when relevant.'
    }
  ];
  if (domain.source_limited_formative_cases > 0) {
    criteria.push({
      id: 'truth_gap_preserved',
      criterion: 'The domain remains formative-only until missing source-record or clinician-adjudicated truth fields are completed.'
    });
  }
  if (domain.scoring_mode?.includes('structure')) {
    criteria.push({
      id: 'faculty_rubric_calibrated',
      criterion: 'At least two faculty reviewers calibrate rubric anchors against representative learner artifacts before summative use.'
    });
  }
  return criteria;
}

function reviewForPacket(reviews, packetId, domainKey) {
  return reviews.find((review) =>
    review.packet_id === packetId
      || review.domain_key === domainKey
      || review.claim_set_id === packetId
  ) || null;
}

function reviewStatus(review) {
  return review?.review_status || review?.status || 'not_reviewed';
}

function markdownEscape(value) {
  return cleanText(value).replace(/\|/g, '/');
}

function packetMarkdown(data) {
  const lines = [
    '# Feedback Claim Entailment Review Packets',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Claim sets: ${data.summary.total_claim_sets}`,
    `- Case-domain rows covered: ${data.summary.total_case_domain_rows}`,
    `- Source-limited claim sets: ${data.summary.source_limited_claim_sets}`,
    `- Reviewed claim sets: ${data.summary.reviewed_claim_sets}/${data.summary.total_claim_sets}`,
    `- National-release ready claim sets: ${data.summary.claim_sets_ready_for_national_release}`,
    `- Ready for national feedback release: ${data.summary.ready_for_national_feedback_release}`,
    '',
    '## Packet Queue',
    '',
    '| Packet | Domain | Type | Current status | Reviewer roles |',
    '|---|---|---|---|---|',
    ...data.claim_review_packets.map((packet) =>
      `| ${packet.id} | ${markdownEscape(packet.label)} | ${packet.claim_set_type} | ${packet.current_release_status} | ${packet.reviewer_roles.join(', ')} |`
    ),
    '',
    '## Reviewer Output File',
    '',
    'Completed reviews should be recorded in `docs/learner_facing_claim_entailment_reviews.json` using the `review_submission_template` in the JSON artifact. Do not mark a claim set ready for national release unless the reviewer evidence is complete and source-limited case truth gaps are closed.'
  ];
  return `${lines.join('\n')}\n`;
}

const cases = readJson(CASES_PATH);
const caseById = new Map(cases.map((caseRecord) => [caseRecord.id, caseRecord]));
const feedbackTraceabilityMatrix = readJson(FEEDBACK_TRACEABILITY_MATRIX_PATH);
const clinicalReviewAdjudicationStatus = readOptionalJson(CLINICAL_ADJUDICATION_STATUS_PATH);
const caseGenerationQualityReport = readOptionalJson(CASE_GENERATION_QUALITY_REPORT_PATH);
const evidenceReviewBacklog = readOptionalJson(EVIDENCE_REVIEW_BACKLOG_PATH);
const openEvidenceRuntimeReport = readOptionalJson(OPEN_EVIDENCE_POLICY_RUNTIME_REPORT_PATH);
const claimReviews = flattenClaimReviews(readOptionalJson(CLAIM_ENTAILMENT_REVIEWS_PATH));

const caseDomainRows = feedbackTraceabilityMatrix.case_domain_traceability || [];
const domains = feedbackTraceabilityMatrix.domain_summary || [];
const caseTruthReadyCases = clinicalReviewAdjudicationStatus?.case_truth?.ready_case_truth_adjudications || 0;
const approvedEvidenceChunks = clinicalReviewAdjudicationStatus?.evidence?.approved_chunks || 0;
const generatedNeedsReviewChunks = evidenceReviewBacklog?.summary?.pending_generated_or_unverified_chunks ?? null;
const quoteBackedChunks = openEvidenceRuntimeReport?.summary?.quote_backed_chunks ?? null;

const claimReviewPackets = domains.map((domain) => {
  const packetId = `domain_${domain.domain_key}_claim_entailment`;
  const domainRows = caseDomainRows.filter((row) => row.domain_key === domain.domain_key);
  const packetReview = reviewForPacket(claimReviews, packetId, domain.domain_key);
  const status = reviewStatus(packetReview);
  const caseIds = uniqueSorted(domainRows.map((row) => row.case_id));
  const representativeRows = domainRows.slice(0, 10).map((row) => ({
    case_id: row.case_id,
    traceability_status: row.traceability_status,
    expected_score_behavior: row.expected_score_behavior,
    missing_required_case_evidence: row.missing_required_case_evidence || []
  }));

  return {
    id: packetId,
    domain_key: domain.domain_key,
    label: domain.label,
    claim_set_type: claimSetType(domain),
    scoring_mode: domain.scoring_mode,
    feedback_basis: domain.feedback_basis,
    current_release_status: currentReleaseStatus(domain, status),
    reviewer_roles: reviewerRolesForDomain(domain.domain_key),
    review_status: status,
    reviewed_by: packetReview?.reviewed_by || [],
    reviewed_at: packetReview?.reviewed_at || '',
    cases: caseIds.length,
    case_ids: caseIds,
    representative_case_summaries: caseIds
      .slice(0, 10)
      .map((caseId) => caseById.get(caseId))
      .filter(Boolean)
      .map(caseSummary),
    traceability: {
      status_counts: domain.status_counts || countBy(domainRows, (row) => row.traceability_status),
      cases_missing_required_evidence: domain.cases_missing_required_evidence || 0,
      source_limited_formative_cases: domain.source_limited_formative_cases || 0,
      numeric_cases_missing_required_evidence: domain.numeric_cases_missing_required_evidence || 0,
      required_case_evidence: feedbackTraceabilityMatrix.domain_contracts
        ?.find((contract) => contract.key === domain.domain_key)
        ?.required_case_evidence || [],
      representative_rows: representativeRows
    },
    review_scope: reviewScopeForDomain(domain),
    required_entailment_evidence: requiredEntailmentEvidence(domain),
    review_questions: reviewQuestionsForDomain(domain),
    acceptance_criteria: acceptanceCriteriaForDomain(domain),
    prohibited_approval_conditions: [
      'Do not approve national release if generated-needs-review evidence is used as learner-facing support.',
      'Do not approve numeric diagnosis, consult, or reassessment scoring while source truth remains unavailable.',
      'Do not approve if the domain relies on hidden local assumptions that are not documented for participating schools.',
      'Do not approve if reviewer identity, role, review date, reviewed case scope, or required changes are missing.'
    ]
  };
});

const reviewedClaimSets = claimReviewPackets.filter((packet) => APPROVED_LIMITED_STATUSES.has(packet.review_status)).length;
const nationallyApprovedClaimSets = claimReviewPackets.filter((packet) => APPROVED_NATIONAL_STATUSES.has(packet.review_status)).length;
const sourceLimitedClaimSets = claimReviewPackets.filter((packet) => packet.traceability.source_limited_formative_cases > 0).length;
const numericCaseGroundedClaimSets = claimReviewPackets.filter((packet) => packet.claim_set_type === 'case_grounded_numeric_feedback_claim_set').length;
const rubricClaimSets = claimReviewPackets.filter((packet) => packet.claim_set_type === 'rubric_grounded_documentation_claim_set').length;
const readyClaimSets = claimReviewPackets.filter((packet) =>
  APPROVED_NATIONAL_STATUSES.has(packet.review_status)
    && packet.traceability.source_limited_formative_cases === 0
    && packet.traceability.numeric_cases_missing_required_evidence === 0
).length;
const readyForNationalFeedbackRelease = claimReviewPackets.length > 0
  && readyClaimSets === claimReviewPackets.length
  && caseTruthReadyCases >= cases.length
  && approvedEvidenceChunks > 0
  && (generatedNeedsReviewChunks === 0);

const artifact = {
  schema_version: 'feedback_claim_entailment_review_packets_v1',
  generated_at: new Date().toISOString(),
  review_status: 'draft_claim_entailment_packets_need_clinician_educator_review',
  warning: 'These packets organize claim-review work. They do not constitute clinical approval, national release approval, or proof that feedback improves learner performance.',
  source_contract: {
    feedback_traceability_matrix_schema: feedbackTraceabilityMatrix.schema_version,
    feedback_traceability_matrix_path: 'docs/feedback_traceability_matrix.json',
    completed_review_file_present: existsSync(CLAIM_ENTAILMENT_REVIEWS_PATH),
    completed_review_file_path: 'docs/learner_facing_claim_entailment_reviews.json',
    generated_needs_review_evidence_allowed_for_learner_feedback: false
  },
  summary: {
    total_claim_sets: claimReviewPackets.length,
    total_case_domain_rows: caseDomainRows.length,
    case_count: cases.length,
    source_limited_claim_sets: sourceLimitedClaimSets,
    source_limited_case_domain_rows: feedbackTraceabilityMatrix.summary?.source_limited_formative_rows || 0,
    case_grounded_numeric_claim_sets: numericCaseGroundedClaimSets,
    rubric_grounded_claim_sets: rubricClaimSets,
    claim_sets_requiring_clinician_review: claimReviewPackets.filter((packet) => packet.reviewer_roles.includes('emergency_clinician')).length,
    claim_sets_requiring_educator_review: claimReviewPackets.filter((packet) => packet.reviewer_roles.includes('simulation_educator')).length,
    claim_sets_requiring_evidence_review: claimReviewPackets.filter((packet) => packet.reviewer_roles.includes('medical_librarian_or_evidence_reviewer')).length,
    completed_review_file_present: existsSync(CLAIM_ENTAILMENT_REVIEWS_PATH),
    reviewed_claim_sets: reviewedClaimSets,
    nationally_approved_claim_sets: nationallyApprovedClaimSets,
    claim_sets_ready_for_national_release: readyClaimSets,
    case_truth_adjudication_ready_cases: caseTruthReadyCases,
    evidence_adjudication_approved_chunks: approvedEvidenceChunks,
    generated_needs_review_chunks: generatedNeedsReviewChunks,
    quote_backed_chunks_available: quoteBackedChunks,
    national_release_eligible_cases: caseGenerationQualityReport?.summary?.national_release_eligible_cases || 0,
    ready_for_national_feedback_release: readyForNationalFeedbackRelease
  },
  review_submission_template: {
    schema_version: 'learner_facing_claim_entailment_reviews_v1',
    claim_reviews: [
      {
        packet_id: 'domain_esi_claim_entailment',
        domain_key: 'esi',
        review_status: 'approved_for_national_release | approved_formative_only | revisions_required | rejected',
        reviewer_roles: ['emergency_clinician', 'simulation_educator'],
        reviewed_by: [
          {
            name: '',
            role: '',
            institution: '',
            credential_or_position: ''
          }
        ],
        reviewed_at: '',
        case_ids_reviewed: [],
        claim_scope_reviewed: [
          'scoring behavior',
          'feedback messages',
          'clinical safety language',
          'evidence citations'
        ],
        evidence_basis: [
          'case_truth_adjudication',
          'feedback_traceability_matrix',
          'quote_backed_open_evidence_or_clinician_approved_standard'
        ],
        approval_limitations: '',
        required_changes: [],
        signature_attestation: ''
      }
    ]
  },
  claim_review_packets: claimReviewPackets,
  release_blockers: [
    {
      id: 'claim_entailment_reviews_missing',
      status: reviewedClaimSets >= claimReviewPackets.length && claimReviewPackets.length > 0 ? 'cleared' : 'blocked',
      evidence: {
        reviewed_claim_sets: reviewedClaimSets,
        total_claim_sets: claimReviewPackets.length
      },
      required_to_clear: 'Complete every packet in docs/learner_facing_claim_entailment_reviews.json with clinician and educator reviewer attestations.'
    },
    {
      id: 'source_limited_domains_not_truth_adjudicated',
      status: sourceLimitedClaimSets === 0 ? 'cleared' : 'blocked',
      evidence: {
        source_limited_claim_sets: sourceLimitedClaimSets,
        source_limited_case_domain_rows: feedbackTraceabilityMatrix.summary?.source_limited_formative_rows || 0
      },
      required_to_clear: 'Resolve diagnosis, consult/referral, and reassessment truth gaps before promoting those domains from formative to numeric scoring.'
    },
    {
      id: 'evidence_backlog_blocks_national_release',
      status: generatedNeedsReviewChunks === 0 && approvedEvidenceChunks > 0 ? 'cleared' : 'blocked',
      evidence: {
        generated_needs_review_chunks: generatedNeedsReviewChunks,
        evidence_adjudication_approved_chunks: approvedEvidenceChunks
      },
      required_to_clear: 'Replace, remove, or adjudicate generated-needs-review evidence before using it as learner-facing support.'
    }
  ]
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, packetMarkdown(artifact), 'utf8');

console.log(`Wrote ${claimReviewPackets.length} feedback claim-entailment review packets to ${OUTPUT_JSON_PATH}`);
