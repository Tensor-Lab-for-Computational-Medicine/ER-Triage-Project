import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const FEEDBACK_TRACEABILITY_MATRIX_PATH = join(ROOT, 'docs', 'feedback_traceability_matrix.json');
const FEEDBACK_CLAIM_ENTAILMENT_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_review_packets.json');
const FEEDBACK_CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_adjudication_status.json');
const FEEDBACK_INTEGRITY_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'feedback_integrity_runtime_report.json');
const CASE_DOMAIN_REVIEWS_PATH = join(ROOT, 'docs', 'feedback_case_domain_calibration_reviews.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'feedback_case_domain_review_packets.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'feedback_case_domain_review_packets.md');

const APPROVED_NATIONAL_STATUSES = new Set([
  'approved_for_national_release',
  'approved_for_summative_feedback',
  'approved_for_learner_feedback'
]);

const VALID_REVIEW_STATUSES = new Set([
  ...APPROVED_NATIONAL_STATUSES,
  'approved_formative_only',
  'changes_required',
  'blocked_truth_or_evidence_gap',
  'blocked_safety_or_equity_gap',
  'pilot_only'
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  return existsSync(path) ? readJson(path) : null;
}

function flattenReviews(rawReviews) {
  if (!rawReviews) return [];
  if (Array.isArray(rawReviews)) return rawReviews;
  for (const key of ['case_domain_reviews', 'reviews', 'feedback_case_domain_reviews']) {
    if (Array.isArray(rawReviews[key])) return rawReviews[key];
  }
  return [];
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniqueSorted(items) {
  return [...new Set(items.filter(Boolean))].sort();
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function ageBand(ageValue) {
  const age = Number(ageValue);
  if (!Number.isFinite(age)) return 'unknown';
  if (age < 18) return 'pediatric';
  if (age < 40) return 'adult_18_39';
  if (age < 65) return 'adult_40_64';
  return 'older_adult_65_plus';
}

function compactVitals(vitals = {}) {
  const fields = ['temp', 'hr', 'rr', 'o2', 'sbp', 'dbp', 'pain'];
  return Object.fromEntries(fields.filter((key) => vitals[key] !== undefined).map((key) => [key, vitals[key]]));
}

function caseSummary(caseRecord) {
  return {
    case_id: caseRecord.id,
    reference_esi: caseRecord.acuity || caseRecord.source?.reference_esi || '',
    complaint: cleanText(caseRecord.complaint || caseRecord.source?.chief_complaint),
    age_band: ageBand(caseRecord.demographics?.age ?? caseRecord.source?.age),
    sex: caseRecord.demographics?.sex || caseRecord.source?.sex || 'unknown',
    transport: caseRecord.demographics?.transport || caseRecord.source?.arrival_transport || 'unknown',
    disposition: caseRecord.disposition || caseRecord.source?.disposition || '',
    resources_used: caseRecord.resources_used ?? caseRecord.source?.resource_signals?.resources_used ?? '',
    vitals: compactVitals(caseRecord.vitals || caseRecord.source?.vitals || {})
  };
}

function traceReviewStatus(row) {
  if (row.traceability_status === 'source_limited_formative_only') return 'blocked_truth_unavailable_formative_only';
  if ((row.missing_required_case_evidence || []).length > 0) return 'blocked_required_case_evidence_missing';
  if (row.scoring_mode?.includes('structure')) return 'rubric_grounded_pending_faculty_calibration';
  return 'case_grounded_pending_case_domain_calibration';
}

function reviewForPacket(reviews, packetId, row) {
  return reviews.find((review) =>
    review.packet_id === packetId
      || review.case_domain_review_id === packetId
      || (review.case_id === row.case_id && review.domain_key === row.domain_key)
  ) || null;
}

function reviewStatus(review) {
  return review?.review_status || review?.status || 'not_reviewed';
}

function isValidReview(review) {
  const status = reviewStatus(review);
  return VALID_REVIEW_STATUSES.has(status)
    && Array.isArray(review?.reviewed_by)
    && review.reviewed_by.length > 0
    && Boolean(review.reviewed_at);
}

function reviewerRolesForRow(row) {
  const roles = new Set(['emergency_medicine_clinician', 'simulation_educator']);
  if (
    row.traceability_status === 'source_limited_formative_only'
      || (row.missing_required_case_evidence || []).length > 0
      || ['esi', 'diagnosis', 'referral', 'reassessment', 'escalation'].includes(row.domain_key)
  ) {
    roles.add('medical_librarian_or_evidence_reviewer');
  }
  if (['interview', 'soap', 'sbar', 'focused_exam'].includes(row.domain_key)) {
    roles.add('clinical_skills_faculty');
  }
  return [...roles];
}

function priorityForRow(row, caseRecord) {
  const acuity = Number(caseRecord?.acuity ?? caseRecord?.source?.reference_esi);
  const highAcuity = Number.isFinite(acuity) && acuity <= 2;
  const criticalDomain = ['esi', 'safety', 'diagnosis', 'referral', 'escalation', 'reassessment'].includes(row.domain_key);
  if (highAcuity && criticalDomain) return 'P0';
  if (criticalDomain || row.traceability_status === 'source_limited_formative_only') return 'P1';
  return 'P2';
}

function riskFlags(row, caseRecord) {
  const flags = [];
  const acuity = Number(caseRecord?.acuity ?? caseRecord?.source?.reference_esi);
  if (Number.isFinite(acuity) && acuity <= 2) flags.push('high_acuity_case_feedback');
  if (row.domain_key === 'esi') flags.push('esi_undertriage_or_overtriage_consequence_review');
  if (['safety', 'escalation', 'reassessment'].includes(row.domain_key)) flags.push('stabilization_or_course_correction_safety_review');
  if (row.traceability_status === 'source_limited_formative_only') flags.push('source_limited_formative_only_truth_gap');
  if ((row.missing_required_case_evidence || []).length > 0) flags.push('missing_required_case_evidence');
  if (row.scoring_mode?.includes('structure')) flags.push('faculty_rubric_calibration_required');
  if (['diagnosis', 'referral'].includes(row.domain_key)) flags.push('overconfident_clinical_inference_risk');
  return uniqueSorted(flags);
}

function requiredReviewerActions(row) {
  const actions = [
    'Compare deterministic learner-facing feedback for this case-domain pair against the case facts and traceability row.',
    'Confirm whether the current numeric, structure-rubric, or formative-only scoring behavior is appropriate for medical-student use.',
    'Document required wording or scoring changes before any national release claim.',
    'Verify that optional AI draft output is not used as the approval basis for this feedback row.'
  ];
  if (row.traceability_status === 'source_limited_formative_only') {
    actions.push('Resolve missing case truth or explicitly preserve formative-only status; do not promote this row to numeric scoring without clinician-adjudicated truth.');
  }
  if ((row.missing_required_case_evidence || []).length > 0) {
    actions.push('Supply or adjudicate the missing required case evidence before approving learner-facing numeric feedback.');
  }
  if (row.domain_key === 'esi') {
    actions.push('Confirm reference ESI and resource-signal interpretation against quote-backed ESI evidence or a documented clinician-approved local standard.');
  }
  if (['safety', 'escalation', 'reassessment'].includes(row.domain_key)) {
    actions.push('Calibrate escalation, stabilization, unsafe-omission, and reassessment language for safety and appropriate uncertainty.');
  }
  if (row.scoring_mode?.includes('structure')) {
    actions.push('Calibrate SOAP or SBAR rubric anchors against representative learner artifacts before summative use.');
  }
  return actions;
}

function acceptanceCriteria(row) {
  const criteria = [
    {
      id: 'case_specific_entailment',
      criterion: 'Feedback claims and partial-credit logic are entailed by case facts, adjudicated case truth, quote-backed evidence, or a named local standard.'
    },
    {
      id: 'scoring_behavior_calibrated',
      criterion: 'Reviewers approve whether this row is numeric, structure-rubric, formative-only, pilot-only, or blocked.'
    },
    {
      id: 'no_optional_ai_dependency',
      criterion: 'Optional AI draft text is not used to approve or change deterministic scoring or learner-facing feedback.'
    },
    {
      id: 'safe_and_equitable_wording',
      criterion: 'Feedback wording avoids overconfidence, unsafe escalation advice, stereotype-driven reasoning, and hidden local assumptions.'
    }
  ];
  if (row.traceability_status === 'source_limited_formative_only') {
    criteria.push({
      id: 'source_limited_status_preserved',
      criterion: 'The row remains formative-only until missing case truth or evidence is adjudicated.'
    });
  }
  return criteria;
}

function reviewQuestions(row) {
  return [
    `Is the ${row.label} feedback for ${row.case_id} supported by the case facts, adjudicated truth, quote-backed evidence, or a named local standard?`,
    'Does the current score behavior match the available evidence, or should it be formative-only, pilot-only, blocked, or revised?',
    'Could the wording overstate certainty, imply unavailable diagnosis or consult truth, or encourage unsafe triage or management?',
    'What exact changes are required before this case-domain row can be used with medical students outside a supervised pilot?'
  ];
}

function buildPacket(row, caseRecord, review) {
  const packetId = `feedback_case_domain_${row.case_id}_${row.domain_key}`;
  return {
    id: packetId,
    packet_type: 'feedback_case_domain_calibration_review',
    case_id: row.case_id,
    domain_key: row.domain_key,
    domain_label: row.label,
    priority: priorityForRow(row, caseRecord),
    review_status: reviewStatus(review) === 'not_reviewed'
      ? 'pending_clinician_educator_feedback_calibration_review'
      : reviewStatus(review),
    current_release_status: traceReviewStatus(row),
    reviewer_roles_required: reviewerRolesForRow(row),
    case_summary: caseSummary(caseRecord || { id: row.case_id }),
    traceability: {
      scoring_mode: row.scoring_mode,
      feedback_basis: row.feedback_basis,
      required_case_evidence: row.required_case_evidence || [],
      missing_required_case_evidence: row.missing_required_case_evidence || [],
      traceability_status: row.traceability_status,
      expected_score_behavior: row.expected_score_behavior,
      national_review_need: row.national_review_need
    },
    risk_flags: riskFlags(row, caseRecord),
    required_reviewer_actions: requiredReviewerActions(row),
    review_questions: reviewQuestions(row),
    acceptance_criteria: acceptanceCriteria(row),
    prohibited_approval_conditions: [
      'Do not approve national release without named clinician and simulation educator review.',
      'Do not approve numeric diagnosis, consult, or reassessment feedback while source truth remains unavailable.',
      'Do not approve if generated-needs-review evidence is used as learner-facing support.',
      'Do not approve if optional AI draft text is the basis for deterministic feedback or scoring.',
      'Do not approve if required changes, reviewer identity, role, institution, date, or release scope are missing.'
    ],
    completed_review: review
      ? {
          review_status: reviewStatus(review),
          valid_review_record: isValidReview(review),
          reviewed_by: review.reviewed_by || [],
          reviewed_at: review.reviewed_at || '',
          release_scope: review.release_scope || ''
        }
      : null
  };
}

function markdownEscape(value) {
  return cleanText(value).replace(/\|/g, '/');
}

function packetMarkdown(data) {
  const lines = [
    '# Feedback Case-Domain Review Packets',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Case-domain review packets: ${data.summary.case_domain_review_packets}`,
    `- Source-limited packets: ${data.summary.source_limited_packets}`,
    `- Pending review packets: ${data.summary.pending_review_packets}`,
    `- Runtime integrity probes passed: ${data.summary.runtime_integrity_probe_passed}`,
    `- Ready for national feedback release from packets: ${data.summary.ready_for_national_feedback_release_from_packets}`,
    '',
    '## Packet Queue',
    '',
    '| Packet | Case | Domain | Priority | Current release status | Reviewer roles |',
    '|---|---|---|---|---|---|',
    ...data.case_domain_review_packets.map((packet) =>
      `| ${packet.id} | ${packet.case_id} | ${markdownEscape(packet.domain_label)} | ${packet.priority} | ${packet.current_release_status} | ${packet.reviewer_roles_required.join(', ')} |`
    ),
    '',
    '## Reviewer Output File',
    '',
    'Completed reviews should be recorded in `docs/feedback_case_domain_calibration_reviews.json` using the `review_submission_template` in the JSON artifact. These packets do not approve national feedback release; they expose the row-level calibration work still required.'
  ];
  return `${lines.join('\n')}\n`;
}

const cases = readJson(CASES_PATH);
const caseById = new Map(cases.map((caseRecord) => [caseRecord.id, caseRecord]));
const feedbackTraceabilityMatrix = readJson(FEEDBACK_TRACEABILITY_MATRIX_PATH);
const claimPackets = readJson(FEEDBACK_CLAIM_ENTAILMENT_REVIEW_PACKETS_PATH);
const claimAdjudication = readJson(FEEDBACK_CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH);
const runtimeReport = readOptionalJson(FEEDBACK_INTEGRITY_RUNTIME_REPORT_PATH);
const submittedReviews = flattenReviews(readOptionalJson(CASE_DOMAIN_REVIEWS_PATH));
const rows = feedbackTraceabilityMatrix.case_domain_traceability || [];

const packets = rows.map((row) => {
  const packetId = `feedback_case_domain_${row.case_id}_${row.domain_key}`;
  return buildPacket(row, caseById.get(row.case_id), reviewForPacket(submittedReviews, packetId, row));
});

const validReviewPackets = packets.filter((packet) => packet.completed_review?.valid_review_record).length;
const nationallyApprovedPackets = packets.filter((packet) => APPROVED_NATIONAL_STATUSES.has(packet.completed_review?.review_status)).length;
const sourceLimitedPackets = packets.filter((packet) => packet.traceability.traceability_status === 'source_limited_formative_only').length;
const numericPacketsMissingRequiredEvidence = packets.filter((packet) =>
  packet.traceability.expected_score_behavior?.startsWith('numeric')
    && packet.traceability.missing_required_case_evidence.length > 0
).length;
const caseIdsPacketed = uniqueSorted(packets.map((packet) => packet.case_id));
const domainKeysPacketed = uniqueSorted(packets.map((packet) => packet.domain_key));
const pendingReviewPackets = packets.length - validReviewPackets;
const runtimeIntegrityProbePassed = Boolean(runtimeReport?.summary?.all_runtime_probes_passed);
const allCaseDomainRowsPacketed = packets.length === rows.length
  && rows.every((row) => packets.some((packet) => packet.case_id === row.case_id && packet.domain_key === row.domain_key));
const readyForNationalFeedbackRelease = packets.length > 0
  && allCaseDomainRowsPacketed
  && pendingReviewPackets === 0
  && nationallyApprovedPackets === packets.length
  && sourceLimitedPackets === 0
  && numericPacketsMissingRequiredEvidence === 0
  && runtimeIntegrityProbePassed
  && Boolean(claimAdjudication.summary?.ready_for_national_feedback_release);

const artifact = {
  schema_version: 'feedback_case_domain_review_packets_v1',
  generated_at: new Date().toISOString(),
  review_status: 'feedback_case_domain_review_packets_open_calibration_review_required',
  warning: 'These packets organize deterministic case-domain feedback calibration. They do not constitute clinical approval, national release approval, or proof that feedback improves learner performance.',
  source_contract: {
    feedback_traceability_matrix_schema: feedbackTraceabilityMatrix.schema_version,
    feedback_traceability_matrix_path: 'docs/feedback_traceability_matrix.json',
    feedback_claim_entailment_review_packets_schema: claimPackets.schema_version,
    feedback_claim_entailment_review_packets_path: 'docs/feedback_claim_entailment_review_packets.json',
    feedback_claim_entailment_adjudication_status_schema: claimAdjudication.schema_version,
    feedback_claim_entailment_adjudication_status_path: 'docs/feedback_claim_entailment_adjudication_status.json',
    feedback_integrity_runtime_report_schema: runtimeReport?.schema_version || 'missing',
    feedback_integrity_runtime_report_path: 'docs/feedback_integrity_runtime_report.json',
    completed_review_file_present: existsSync(CASE_DOMAIN_REVIEWS_PATH),
    completed_review_file_path: 'docs/feedback_case_domain_calibration_reviews.json',
    generated_needs_review_evidence_allowed_for_learner_feedback: false,
    optional_ai_allowed_to_change_deterministic_feedback: false
  },
  summary: {
    total_review_packets: packets.length,
    case_domain_review_packets: packets.length,
    case_count: cases.length,
    cases_packeted: caseIdsPacketed.length,
    domain_count: feedbackTraceabilityMatrix.summary?.domains_tracked || domainKeysPacketed.length,
    domains_packeted: domainKeysPacketed.length,
    all_case_domain_rows_packeted: allCaseDomainRowsPacketed,
    all_cases_packeted: caseIdsPacketed.length === cases.length,
    all_domains_packeted: domainKeysPacketed.length === (feedbackTraceabilityMatrix.summary?.domains_tracked || domainKeysPacketed.length),
    source_limited_packets: sourceLimitedPackets,
    numeric_packets_missing_required_case_evidence: numericPacketsMissingRequiredEvidence,
    case_grounded_numeric_packets: packets.filter((packet) => packet.current_release_status === 'case_grounded_pending_case_domain_calibration').length,
    rubric_grounded_packets: packets.filter((packet) => packet.current_release_status === 'rubric_grounded_pending_faculty_calibration').length,
    high_acuity_priority_packets: packets.filter((packet) => packet.priority === 'P0').length,
    reviewer_role_counts: countBy(packets.flatMap((packet) => packet.reviewer_roles_required), (role) => role),
    source_limited_packets_requiring_evidence_review: packets.filter((packet) =>
      packet.traceability.traceability_status === 'source_limited_formative_only'
        && packet.reviewer_roles_required.includes('medical_librarian_or_evidence_reviewer')
    ).length,
    completed_review_file_present: existsSync(CASE_DOMAIN_REVIEWS_PATH),
    submitted_case_domain_reviews: submittedReviews.length,
    valid_case_domain_reviews: validReviewPackets,
    nationally_approved_case_domain_reviews: nationallyApprovedPackets,
    pending_review_packets: pendingReviewPackets,
    runtime_integrity_probe_passed: runtimeIntegrityProbePassed,
    claim_sets_packeted: claimPackets.summary?.total_claim_sets || 0,
    claim_sets_reviewed: claimAdjudication.summary?.valid_claim_reviews || 0,
    ready_for_national_feedback_release_from_packets: readyForNationalFeedbackRelease
  },
  review_submission_template: {
    schema_version: 'feedback_case_domain_calibration_reviews_v1',
    case_domain_reviews: [
      {
        packet_id: 'feedback_case_domain_case_002_esi',
        case_id: 'case_002',
        domain_key: 'esi',
        review_status: 'approved_formative_only | approved_for_summative_feedback | approved_for_national_release | changes_required | blocked_truth_or_evidence_gap | blocked_safety_or_equity_gap | pilot_only',
        release_scope: 'supervised_pilot_only | single_institution | national_formative | national_summative',
        reviewed_by: [
          {
            name: '',
            role: 'emergency_medicine_clinician | simulation_educator | medical_librarian_or_evidence_reviewer | clinical_skills_faculty',
            institution: '',
            credential_or_position: ''
          }
        ],
        reviewed_at: 'YYYY-MM-DD',
        evidence_basis: {
          case_fact_fields_reviewed: [],
          clinician_adjudications: [],
          quote_backed_sources: [],
          local_standards: []
        },
        scoring_behavior_approved: false,
        learner_feedback_wording_approved: false,
        required_changes: [],
        reviewer_notes: ''
      }
    ]
  },
  case_domain_review_packets: packets,
  release_blockers: [
    {
      id: 'case_domain_feedback_calibration_reviews_pending',
      status: pendingReviewPackets === 0 ? 'cleared' : 'blocked',
      pending_review_packets: pendingReviewPackets
    },
    {
      id: 'source_limited_feedback_domains_pending_truth_or_evidence',
      status: sourceLimitedPackets === 0 ? 'cleared' : 'blocked',
      source_limited_packets: sourceLimitedPackets
    },
    {
      id: 'claim_entailment_reviews_pending',
      status: claimAdjudication.summary?.missing_claim_reviews === 0 ? 'cleared' : 'blocked',
      missing_claim_reviews: claimAdjudication.summary?.missing_claim_reviews || 0
    },
    {
      id: 'national_feedback_release_not_approved_by_case_domain_packets',
      status: readyForNationalFeedbackRelease ? 'cleared' : 'blocked',
      ready_for_national_feedback_release_from_packets: readyForNationalFeedbackRelease
    }
  ]
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, packetMarkdown(artifact), 'utf8');

console.log(JSON.stringify({
  status: artifact.review_status,
  review_packets: artifact.summary.total_review_packets,
  source_limited_packets: artifact.summary.source_limited_packets,
  pending_review_packets: artifact.summary.pending_review_packets,
  output_path: OUTPUT_JSON_PATH
}, null, 2));
