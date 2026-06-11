import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = join(ROOT, 'docs', 'national_scale_readiness_goal.md');
const READINESS_REPORT_PATH = join(ROOT, 'docs', 'national_scale_readiness_report.json');
const WEAKNESS_REGISTER_PATH = join(ROOT, 'docs', 'national_readiness_weakness_register.json');
const CASE_GENERATION_QUALITY_REPORT_PATH = join(ROOT, 'docs', 'case_generation_quality_report.json');
const CASE_BANK_EXPANSION_STATUS_PATH = join(ROOT, 'docs', 'case_bank_expansion_status.json');
const CASE_BANK_EXPANSION_PACKETS_PATH = join(ROOT, 'docs', 'case_bank_expansion_packets.json');
const CASE_BANK_EXPANSION_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'case_bank_expansion_review_status.json');
const CLINICAL_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'clinical_review_adjudication_status.json');
const CASE_TRUTH_ADJUDICATION_WORKLIST_PATH = join(ROOT, 'docs', 'case_truth_adjudication_worklist.json');
const EVIDENCE_BACKLOG_PATH = join(ROOT, 'docs', 'evidence_review_backlog.json');
const OPEN_EVIDENCE_GROUNDING_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'open_evidence_grounding_review_packets.json');
const OPEN_EVIDENCE_GROUNDING_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'open_evidence_grounding_review_status.json');
const LEARNER_FACING_EVIDENCE_COVERAGE_REPORT_PATH = join(ROOT, 'docs', 'learner_facing_evidence_coverage_report.json');
const CLAIM_REFERENCE_GAP_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'claim_reference_gap_review_packets.json');
const CLAIM_REFERENCE_GAP_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'claim_reference_gap_review_status.json');
const FEEDBACK_CASE_DOMAIN_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'feedback_case_domain_review_packets.json');
const FEEDBACK_CASE_DOMAIN_CALIBRATION_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'feedback_case_domain_calibration_review_status.json');
const SOURCE_FRESHNESS_REPORT_PATH = join(ROOT, 'docs', 'source_freshness_report.json');
const SOURCE_FRESHNESS_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'source_freshness_adjudication_status.json');
const HIGH_RISK_QUOTE_COVERAGE_DEPTH_REPORT_PATH = join(ROOT, 'docs', 'high_risk_quote_coverage_depth_report.json');
const CURRICULUM_MAPPING_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'curriculum_mapping_review_status.json');
const EDUCATIONAL_OUTCOMES_FRAMEWORK_PATH = join(ROOT, 'docs', 'educational_outcomes_measurement_framework.json');
const EDUCATIONAL_OUTCOMES_VALIDATION_STATUS_PATH = join(ROOT, 'docs', 'educational_outcomes_validation_status.json');
const EDUCATIONAL_VALIDITY_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'educational_validity_review_packets.json');
const EDUCATIONAL_VALIDITY_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'educational_validity_review_status.json');
const LEARNER_SAFETY_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'learner_safety_review_status.json');
const LEARNER_SAFETY_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'learner_safety_review_packets.json');
const EQUITY_CASE_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'equity_case_review_status.json');
const EQUITY_CASE_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'equity_case_review_packets.json');
const INSTITUTIONAL_GOVERNANCE_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'institutional_governance_review_status.json');
const INSTITUTIONAL_GOVERNANCE_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'institutional_governance_review_packets.json');
const MEDICAL_EDUCATION_RUBRIC_PATH = join(ROOT, 'docs', 'medical_education_validation_rubric.json');
const SCALE_BUNDLE_REPORT_PATH = join(ROOT, 'docs', 'scale_bundle_readiness_report.json');
const ACCESSIBILITY_READINESS_REPORT_PATH = join(ROOT, 'docs', 'accessibility_readiness_report.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  return existsSync(path) ? readJson(path) : null;
}

function markdownEscape(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function gateEvidenceSummary(gate) {
  const e = gate.evidence || {};
  switch (gate.id) {
    case 'case_truth':
      return `${e.total_cases} cases; ${e.case_truth_pending_cases} truth packets pending; ${e.case_truth_adjudication_ready_cases} adjudicated ready`;
    case 'case_generation_quality':
      return `${e.draft_practice_scaffold_eligible_cases} draft-practice scaffolds; ${e.national_release_eligible_cases} national-release cases; ${e.case_generation_quality_case_count_shortfall} case shortfall; ${e.case_bank_expansion_blueprint_slots ?? 0} expansion blueprint slots; ${e.case_bank_expansion_valid_blueprint_reviews ?? 0} valid blueprint reviews`;
    case 'open_evidence_grounding':
      return `${e.quote_backed_count}/${e.total_chunks} quote-backed chunks; ${e.generated_needs_review_count} generated chunks pending; ${e.open_evidence_grounding_total_review_packets ?? 0} open-evidence packets; ${e.open_evidence_grounding_review_valid_reviews ?? 0}/${e.open_evidence_grounding_review_total_packets ?? 0} grounding reviews valid; ${e.source_link_quote_verification_quote_records_requiring_repair} source-link quote repairs; ${e.source_freshness_adjudication_packets_missing_review} source freshness reviews missing; ${e.claim_reference_alignment_claim_sets_missing_domain_specific_support ?? 0} claim-standard quote gaps; ${e.claim_reference_gap_valid_reviews ?? 0}/${e.claim_reference_gap_review_total_packets ?? 0} claim-reference gap reviews valid`;
    case 'feedback_integrity':
      return `${e.feedback_integrity_runtime_passed_probes}/${e.feedback_integrity_runtime_total_probes} feedback probes passed; ${e.feedback_claim_entailment_reviewed_claim_sets}/${e.feedback_claim_entailment_total_claim_sets} claim sets reviewed; ${e.feedback_case_domain_total_review_packets ?? 0} case-domain packets; ${e.feedback_case_domain_calibration_valid_reviews ?? 0}/${e.feedback_case_domain_calibration_total_review_packets ?? 0} calibration reviews valid`;
    case 'educational_validity':
      return `${e.curriculum_mapping_nationally_approved_case_mappings}/${e.objective_matrix_cases_mapped} curriculum-approved case mappings; ${e.curriculum_mapping_case_mappings_missing_review} curriculum reviews missing; ${e.educational_validity_valid_reviews ?? 0}/${e.educational_validity_review_total_packets ?? 0} educational-validity reviews valid; ${e.educational_outcome_pilot_studies_completed} pilot studies; ${e.educational_outcome_multi_site_studies_completed} multi-site studies`;
    case 'learner_safety':
      return `${e.red_team_runtime_passed_tests}/${e.red_team_total_tests} safety runtime tests passed; ${e.red_team_clinician_reviewed_tests} clinician-reviewed safety tests; ${e.learner_safety_total_review_packets ?? 0} learner-safety packets`;
    case 'equity_bias_readiness':
      return `${e.equity_case_nationally_approved_cases}/${e.equity_bias_total_cases} cases nationally equity-approved; ${e.equity_case_cases_missing_review} cases missing review; ${e.equity_case_total_review_packets ?? 0} equity packets; ${e.bias_policy_probes_passed}/${e.bias_policy_probes} bias probes passed`;
    case 'scale_governance_accessibility':
      return `bundle budget passed: ${e.default_route_initial_budget_passed}; route probes: ${e.route_reachability_passed_probes}/${e.route_reachability_total_probes}; institutional domains missing review: ${e.institutional_governance_domains_missing_review}; governance packets: ${e.institutional_governance_total_review_packets ?? 0}; institutional review ready: ${e.institutional_review_ready}`;
    default:
      return JSON.stringify(e);
  }
}

function gateRequiredSummary(gate) {
  const required = gate.required || {};
  switch (gate.id) {
    case 'case_truth':
      return '100+ cases; all required truth fields; every case adjudicated';
    case 'case_generation_quality':
      return 'all current cases national-release eligible and truth complete';
    case 'open_evidence_grounding':
      return 'no generated evidence backlog; every learner-facing quote source-linked or manually verified; source freshness and claim reviews ready';
    case 'feedback_integrity':
      return 'all feedback domains reviewed and deterministic behavior preserved';
    case 'educational_validity':
      return 'curriculum mapping, objectives, Core EPA workflow scope, rubric, and outcomes externally validated';
    case 'learner_safety':
      return 'all red-team tests clinician-reviewed and runtime guardrails passing';
    case 'equity_bias_readiness':
      return 'all cases equity-reviewed with language, disability, pregnancy, and stereotype-risk coverage';
    case 'scale_governance_accessibility':
      return 'approved governance, production load evidence, monitoring, incident drills, and full accessibility review';
    default:
      return JSON.stringify(required);
  }
}

function gateRows(report) {
  return [
    '| Gate | Status | Current Evidence | Required Standard |',
    '|---|---|---|---|',
    ...report.gates.map((gate) =>
      `| ${markdownEscape(gate.id)} | ${gate.status} | ${markdownEscape(gateEvidenceSummary(gate))} | ${markdownEscape(gateRequiredSummary(gate))} |`
    )
  ];
}

function topWeaknessRows(register) {
  return [
    '| ID | Priority | Gate | Improvement Needed |',
    '|---|---|---|---|',
    ...(register?.weaknesses || [])
      .slice()
      .sort((a, b) => a.priority.localeCompare(b.priority) || a.id.localeCompare(b.id))
      .slice(0, 12)
      .map((item) =>
        `| ${item.id} | ${item.priority} | ${item.readiness_gate} | ${markdownEscape(item.needed_improvement)} |`
      )
  ];
}

function phase(title, bullets) {
  return [
    `### ${title}`,
    '',
    ...bullets.map((bullet) => `- ${bullet}`),
    ''
  ];
}

const readiness = readJson(READINESS_REPORT_PATH);
const weakness = readOptionalJson(WEAKNESS_REGISTER_PATH);
const caseQuality = readOptionalJson(CASE_GENERATION_QUALITY_REPORT_PATH);
const caseBank = readOptionalJson(CASE_BANK_EXPANSION_STATUS_PATH);
const caseBankPackets = readOptionalJson(CASE_BANK_EXPANSION_PACKETS_PATH);
const caseBankReviewStatus = readOptionalJson(CASE_BANK_EXPANSION_REVIEW_STATUS_PATH);
const clinicalStatus = readOptionalJson(CLINICAL_ADJUDICATION_STATUS_PATH);
const caseTruthAdjudicationWorklist = readOptionalJson(CASE_TRUTH_ADJUDICATION_WORKLIST_PATH);
const evidenceBacklog = readOptionalJson(EVIDENCE_BACKLOG_PATH);
const openEvidenceGroundingPackets = readOptionalJson(OPEN_EVIDENCE_GROUNDING_REVIEW_PACKETS_PATH);
const openEvidenceGroundingReviewStatus = readOptionalJson(OPEN_EVIDENCE_GROUNDING_REVIEW_STATUS_PATH);
const learnerCoverage = readOptionalJson(LEARNER_FACING_EVIDENCE_COVERAGE_REPORT_PATH);
const claimReferenceGapPackets = readOptionalJson(CLAIM_REFERENCE_GAP_REVIEW_PACKETS_PATH);
const claimReferenceGapReviewStatus = readOptionalJson(CLAIM_REFERENCE_GAP_REVIEW_STATUS_PATH);
const feedbackCaseDomainPackets = readOptionalJson(FEEDBACK_CASE_DOMAIN_REVIEW_PACKETS_PATH);
const feedbackCaseDomainCalibrationStatus = readOptionalJson(FEEDBACK_CASE_DOMAIN_CALIBRATION_REVIEW_STATUS_PATH);
const sourceFreshness = readOptionalJson(SOURCE_FRESHNESS_REPORT_PATH);
const sourceFreshnessAdjudication = readOptionalJson(SOURCE_FRESHNESS_ADJUDICATION_STATUS_PATH);
const quoteDepth = readOptionalJson(HIGH_RISK_QUOTE_COVERAGE_DEPTH_REPORT_PATH);
const curriculumReview = readOptionalJson(CURRICULUM_MAPPING_REVIEW_STATUS_PATH);
const outcomes = readOptionalJson(EDUCATIONAL_OUTCOMES_FRAMEWORK_PATH);
const outcomeValidation = readOptionalJson(EDUCATIONAL_OUTCOMES_VALIDATION_STATUS_PATH);
const educationalValidityPackets = readOptionalJson(EDUCATIONAL_VALIDITY_REVIEW_PACKETS_PATH);
const educationalValidityReviewStatus = readOptionalJson(EDUCATIONAL_VALIDITY_REVIEW_STATUS_PATH);
const learnerSafetyReview = readOptionalJson(LEARNER_SAFETY_REVIEW_STATUS_PATH);
const learnerSafetyPackets = readOptionalJson(LEARNER_SAFETY_REVIEW_PACKETS_PATH);
const equityCaseReview = readOptionalJson(EQUITY_CASE_REVIEW_STATUS_PATH);
const equityCasePackets = readOptionalJson(EQUITY_CASE_REVIEW_PACKETS_PATH);
const institutionalGovernanceReview = readOptionalJson(INSTITUTIONAL_GOVERNANCE_REVIEW_STATUS_PATH);
const institutionalGovernancePackets = readOptionalJson(INSTITUTIONAL_GOVERNANCE_REVIEW_PACKETS_PATH);
const rubric = readOptionalJson(MEDICAL_EDUCATION_RUBRIC_PATH);
const scaleBundle = readOptionalJson(SCALE_BUNDLE_REPORT_PATH);
const accessibility = readOptionalJson(ACCESSIBILITY_READINESS_REPORT_PATH);

const evidence = readiness.metrics.evidence;
const cases = readiness.metrics.cases;
const feedback = readiness.metrics.feedback_integrity;
const education = readiness.metrics.educational_validity;
const learnerSafety = readiness.metrics.learner_safety;
const equity = readiness.metrics.equity_bias_readiness;
const scale = readiness.metrics.scale_governance_accessibility;

const lines = [
  '# National-Scale Readiness Goal',
  '',
  `Generated from current readiness artifacts: ${new Date().toISOString()}`,
  '',
  '## Goal',
  '',
  'Prepare the ER Clinical Workflow Simulator for reliable national-scale use by medical students by strengthening the app across clinical accuracy, open-evidence grounding, educational validity, scalable delivery, privacy and governance, learner safety, and measurable impact on clinical judgment.',
  '',
  'The app should produce medically accurate simulation cases and feedback that improve medical students clinical judgment and hospital performance. The source of truth must remain deterministic, auditable, and based on open evidence or clinician-reviewed case data. LLM-generated material remains optional draft support only, clearly labeled, grounded when possible, and never the default basis for scoring, diagnosis, disposition, or learner feedback.',
  '',
  '## Current Readiness Verdict',
  '',
  `Status: ${readiness.verdict} for national medical-student deployment.`,
  '',
  readiness.verdict === 'ready'
    ? 'All national readiness gates currently pass. This status still depends on maintaining review artifacts, source freshness, production monitoring, and institutional approvals.'
    : 'The project is not nationally ready. The current repository contains useful engineering guardrails and review queues, but clinical, evidence, educational, institutional, and outcome validation remain incomplete.',
  '',
  '## Current Measured State',
  '',
  `- Public cases: ${cases.total_cases}.`,
  `- Case truth packets pending: ${cases.case_truth_pending_cases}; ready case-truth adjudications: ${cases.case_truth_adjudication_ready_cases}.`,
  `- Case truth packet scaffolding: ${cases.case_truth_source_limitations_packeted ?? 0} source limitations packeted; ${cases.case_truth_simulation_reveal_scaffolds_packeted ?? 0} simulation reveal scaffolds packeted; all-source-limitation scaffold completeness ready: ${cases.case_truth_review_packet_scaffold_completeness_ready ?? false}.`,
  `- Case-truth adjudication worklist: ${caseTruthAdjudicationWorklist?.summary?.total_work_items ?? cases.case_truth_adjudication_work_items ?? 0} work items; pending adjudications: ${caseTruthAdjudicationWorklist?.summary?.pending_case_truth_adjudications ?? cases.case_truth_adjudication_worklist_pending ?? 0}; high-priority P1/P2 work items: ${caseTruthAdjudicationWorklist?.summary?.high_priority_work_items ?? cases.case_truth_adjudication_worklist_high_priority_items ?? 0}; total worklist release blockers: ${caseTruthAdjudicationWorklist?.summary?.total_release_blockers ?? cases.case_truth_adjudication_worklist_release_blockers ?? 0}; national case-truth release ready from worklist: ${caseTruthAdjudicationWorklist?.summary?.ready_for_national_case_truth_release_from_worklist ?? cases.case_truth_adjudication_worklist_ready_for_national_release ?? false}.`,
  `- National-release eligible cases: ${caseQuality?.summary?.national_release_eligible_cases ?? readiness.metrics.case_generation_quality.national_release_eligible_cases}.`,
  `- Case-bank expansion shortfall: ${caseBank?.summary?.case_count_shortfall ?? readiness.metrics.case_generation_quality.case_bank_case_count_shortfall}; target gaps: ${caseBank?.summary?.target_gap_count ?? readiness.metrics.case_generation_quality.case_bank_target_gap_count}; recommended minimum new cases: ${caseBank?.summary?.recommended_minimum_new_cases ?? readiness.metrics.case_generation_quality.case_bank_recommended_minimum_new_cases}.`,
  `- Case-bank expansion packets: ${caseBankPackets?.summary?.target_gap_packets ?? readiness.metrics.case_generation_quality.case_bank_expansion_target_gap_packets ?? 0} target gaps; ${caseBankPackets?.summary?.blueprint_slots ?? readiness.metrics.case_generation_quality.case_bank_expansion_blueprint_slots ?? 0} blueprint slots; all target shortfalls covered by blueprints: ${caseBankPackets?.summary?.all_target_shortfalls_have_blueprint_coverage ?? readiness.metrics.case_generation_quality.case_bank_expansion_all_target_shortfalls_have_blueprint_coverage ?? false}.`,
  `- Case-bank expansion reviews submitted: ${caseBankReviewStatus?.summary?.submitted_blueprint_reviews ?? readiness.metrics.case_generation_quality.case_bank_expansion_submitted_blueprint_reviews ?? 0}; valid reviews: ${caseBankReviewStatus?.summary?.valid_blueprint_reviews ?? readiness.metrics.case_generation_quality.case_bank_expansion_valid_blueprint_reviews ?? 0}; pending blueprint reviews: ${caseBankReviewStatus?.summary?.pending_blueprint_reviews ?? readiness.metrics.case_generation_quality.case_bank_expansion_pending_blueprint_reviews ?? 0}; national countable blueprint reviews: ${caseBankReviewStatus?.summary?.national_countable_blueprint_reviews ?? readiness.metrics.case_generation_quality.case_bank_expansion_national_countable_blueprint_reviews ?? 0}; national case-bank release ready from reviews: ${caseBankReviewStatus?.summary?.ready_for_national_case_bank_release_from_reviews ?? readiness.metrics.case_generation_quality.case_bank_expansion_review_ready_for_national_release ?? false}.`,
  `- Public clinical sources: ${evidence.total_sources}.`,
  `- Public clinical chunks: ${evidence.total_chunks}.`,
  `- Quote-backed chunks: ${evidence.quote_backed_count} (${evidence.quote_backed_percentage}%).`,
  `- Learner-facing quote-backed chunks: ${learnerCoverage?.summary?.learner_facing_eligible_quote_backed_chunks ?? evidence.learner_facing_eligible_quote_backed_chunks}.`,
  `- Source-link quote records requiring repair or manual verification: ${evidence.source_link_quote_verification_quote_records_requiring_repair}; without machine text match: ${evidence.source_link_quote_verification_quote_records_without_machine_text_match}; release ready: ${evidence.source_link_quote_verification_release_ready}.`,
  `- Generated-needs-review chunks: ${evidence.generated_needs_review_count}.`,
  `- Open-evidence grounding review packets: ${openEvidenceGroundingPackets?.summary?.total_review_packets ?? evidence.open_evidence_grounding_total_review_packets ?? 0}; generated backlog batch packets: ${openEvidenceGroundingPackets?.summary?.generated_backlog_review_packets ?? evidence.open_evidence_grounding_generated_backlog_review_packets ?? 0}; release-blocker packets: ${openEvidenceGroundingPackets?.summary?.release_blocker_packets ?? evidence.open_evidence_grounding_release_blocker_packets ?? 0}; generated chunks packeted: ${openEvidenceGroundingPackets?.summary?.generated_needs_review_chunks_packeted ?? evidence.open_evidence_grounding_generated_chunks_packeted ?? 0}; all review batches packeted: ${openEvidenceGroundingPackets?.summary?.all_review_batches_packeted ?? evidence.open_evidence_grounding_all_review_batches_packeted ?? false}; national open-evidence release ready from packets: ${openEvidenceGroundingPackets?.summary?.ready_for_national_open_evidence_release_from_packets ?? evidence.open_evidence_grounding_ready_for_national_release_from_packets ?? false}.`,
  `- Open-evidence grounding reviews submitted: ${openEvidenceGroundingReviewStatus?.summary?.submitted_grounding_reviews ?? evidence.open_evidence_grounding_review_submitted_reviews ?? 0}; valid reviews: ${openEvidenceGroundingReviewStatus?.summary?.valid_grounding_reviews ?? evidence.open_evidence_grounding_review_valid_reviews ?? 0}; pending packets: ${openEvidenceGroundingReviewStatus?.summary?.pending_review_packets ?? evidence.open_evidence_grounding_review_pending_packets ?? 0}; cleared packets: ${openEvidenceGroundingReviewStatus?.summary?.cleared_review_packets ?? evidence.open_evidence_grounding_review_cleared_packets ?? 0}; national open-evidence release ready from reviews: ${openEvidenceGroundingReviewStatus?.summary?.ready_for_national_open_evidence_release_from_reviews ?? evidence.open_evidence_grounding_review_ready_for_national_release ?? false}.`,
  `- Evidence adjudication approved chunks: ${clinicalStatus?.evidence?.approved_chunks ?? evidence.evidence_adjudication_approved_chunks}.`,
  `- High-risk topics meeting core quote-depth: ${quoteDepth?.summary?.topics_meeting_core_facet_depth ?? evidence.high_risk_quote_coverage_depth_topics_meeting_core_facet_depth}/${quoteDepth?.summary?.high_risk_topic_count ?? evidence.learner_facing_high_risk_topic_count}.`,
  `- High-risk quote-depth missing topic/facet pairs: ${quoteDepth?.summary?.missing_required_topic_facet_pairs ?? evidence.high_risk_quote_coverage_depth_missing_required_topic_facet_pairs}.`,
  `- Learner-facing source freshness release-blocked sources: ${sourceFreshness?.summary?.learner_facing_quote_backed_sources_release_blocked ?? evidence.source_freshness_learner_facing_quote_backed_sources_release_blocked}.`,
  `- Source-freshness reviews submitted: ${sourceFreshnessAdjudication?.summary?.submitted_source_reviews ?? evidence.source_freshness_adjudication_submitted_reviews}; packets missing review: ${sourceFreshnessAdjudication?.summary?.packets_missing_review ?? evidence.source_freshness_adjudication_packets_missing_review}.`,
  `- Claim sets missing domain-specific quote support: ${evidence.claim_reference_alignment_claim_sets_missing_domain_specific_support ?? 0}; domain-specific quote support release ready: ${evidence.claim_reference_alignment_domain_specific_release_ready ?? false}.`,
  `- Claim-reference gap packets: ${claimReferenceGapPackets?.summary?.total_gap_packets ?? evidence.claim_reference_gap_packets_total ?? 0}; generated candidates packeted: ${claimReferenceGapPackets?.summary?.generated_needs_review_candidate_chunks_packeted ?? evidence.claim_reference_gap_packets_generated_candidates ?? 0}; all domain-specific gaps packeted: ${claimReferenceGapPackets?.summary?.all_domain_specific_gaps_packeted ?? evidence.claim_reference_gap_packets_all_domain_specific_gaps_packeted ?? false}.`,
  `- Claim-reference gap reviews submitted: ${claimReferenceGapReviewStatus?.summary?.submitted_gap_reviews ?? evidence.claim_reference_gap_submitted_reviews ?? 0}; valid reviews: ${claimReferenceGapReviewStatus?.summary?.valid_gap_reviews ?? evidence.claim_reference_gap_valid_reviews ?? 0}; pending reviews: ${claimReferenceGapReviewStatus?.summary?.pending_gap_reviews ?? evidence.claim_reference_gap_pending_reviews ?? 0}; national feedback release ready from gap reviews: ${claimReferenceGapReviewStatus?.summary?.ready_for_national_feedback_release_from_reviews ?? evidence.claim_reference_gap_ready_for_national_feedback_release_from_reviews ?? false}.`,
  `- Feedback claim-entailment reviewed claim sets: ${evidence.learner_facing_claim_entailment_reviewed_claims}.`,
  `- Feedback case-domain review packets: ${feedbackCaseDomainPackets?.summary?.total_review_packets ?? feedback.feedback_case_domain_total_review_packets ?? 0}; all rows packeted: ${feedbackCaseDomainPackets?.summary?.all_case_domain_rows_packeted ?? feedback.feedback_case_domain_all_rows_packeted ?? false}; pending reviews: ${feedbackCaseDomainPackets?.summary?.pending_review_packets ?? feedback.feedback_case_domain_pending_review_packets ?? 0}; national feedback release ready from packets: ${feedbackCaseDomainPackets?.summary?.ready_for_national_feedback_release_from_packets ?? feedback.feedback_case_domain_ready_for_national_release_from_packets ?? false}.`,
  `- Feedback case-domain calibration reviews submitted: ${feedbackCaseDomainCalibrationStatus?.summary?.submitted_case_domain_reviews ?? feedback.feedback_case_domain_calibration_submitted_reviews ?? 0}; valid reviews: ${feedbackCaseDomainCalibrationStatus?.summary?.valid_case_domain_reviews ?? feedback.feedback_case_domain_calibration_valid_reviews ?? 0}; pending calibration reviews: ${feedbackCaseDomainCalibrationStatus?.summary?.pending_case_domain_reviews ?? feedback.feedback_case_domain_calibration_pending_reviews ?? 0}; national feedback release ready from calibration status: ${feedbackCaseDomainCalibrationStatus?.summary?.ready_for_national_feedback_release ?? feedback.feedback_case_domain_calibration_ready_for_national_release ?? false}.`,
  `- Optional AI guardrail runtime probes passed: ${feedback.optional_ai_guardrail_runtime_all_probes_passed}.`,
  `- Curriculum mapping reviews submitted: ${curriculumReview?.summary?.submitted_case_reviews ?? education.curriculum_mapping_submitted_case_reviews}; valid case reviews: ${curriculumReview?.summary?.valid_case_reviews ?? education.curriculum_mapping_valid_case_reviews}; case mappings missing review: ${curriculumReview?.summary?.case_mappings_missing_review ?? education.curriculum_mapping_case_mappings_missing_review}; workflow phases missing review: ${curriculumReview?.summary?.workflow_phases_missing_review ?? education.curriculum_mapping_workflow_phases_missing_review}; unsupported EPA decisions missing: ${curriculumReview?.summary?.unsupported_epa_decisions_missing ?? education.curriculum_mapping_unsupported_epa_decisions_missing}; national curriculum release ready: ${curriculumReview?.summary?.ready_for_national_curriculum_release ?? education.curriculum_mapping_ready_for_national_release}.`,
  `- Educational outcome metrics defined: ${education.educational_outcome_metrics}; pilot studies completed: ${education.educational_outcome_pilot_studies_completed}; multi-site studies completed: ${education.educational_outcome_multi_site_studies_completed}.`,
  `- Educational outcome studies submitted: ${outcomeValidation?.summary?.submitted_studies ?? education.educational_outcome_submitted_studies}; valid studies: ${outcomeValidation?.summary?.valid_studies ?? education.educational_outcome_valid_studies}; validation ready for claims: ${outcomeValidation?.summary?.ready_for_educational_validity_claims ?? education.educational_outcome_validation_ready_for_claims}.`,
  `- Educational-validity review packets: ${educationalValidityPackets?.summary?.total_review_packets ?? education.educational_validity_total_review_packets ?? 0}; case curriculum packets: ${educationalValidityPackets?.summary?.case_curriculum_mapping_packets ?? education.educational_validity_case_curriculum_mapping_packets ?? 0}; case outcome packets: ${educationalValidityPackets?.summary?.case_outcome_measurement_packets ?? education.educational_validity_case_outcome_measurement_packets ?? 0}; metric packets: ${educationalValidityPackets?.summary?.outcome_metric_review_packets ?? education.educational_validity_outcome_metric_review_packets ?? 0}; study packets: ${educationalValidityPackets?.summary?.outcome_study_packets ?? education.educational_validity_outcome_study_packets ?? 0}; all curriculum/outcome gaps packeted: ${educationalValidityPackets?.summary?.all_curriculum_outcome_gaps_packeted ?? education.educational_validity_all_curriculum_outcome_gaps_packeted ?? false}; national educational release ready from packets: ${educationalValidityPackets?.summary?.ready_for_national_educational_release_from_packets ?? education.educational_validity_ready_for_national_release_from_packets ?? false}.`,
  `- Educational-validity reviews submitted: ${educationalValidityReviewStatus?.summary?.submitted_educational_validity_reviews ?? education.educational_validity_submitted_reviews ?? 0}; valid reviews: ${educationalValidityReviewStatus?.summary?.valid_educational_validity_reviews ?? education.educational_validity_valid_reviews ?? 0}; pending review packets: ${educationalValidityReviewStatus?.summary?.pending_review_packets ?? education.educational_validity_review_pending_packets ?? 0}; national educational release ready from reviews: ${educationalValidityReviewStatus?.summary?.ready_for_national_educational_release_from_reviews ?? education.educational_validity_review_ready_for_national_release ?? false}.`,
  `- Learner safety red-team tests: ${learnerSafety.red_team_total_tests}; clinician-reviewed safety tests: ${learnerSafety.red_team_clinician_reviewed_tests}.`,
  `- Learner safety reviews submitted: ${learnerSafetyReview?.summary?.submitted_reviews ?? learnerSafety.red_team_submitted_reviews}; valid reviews: ${learnerSafetyReview?.summary?.valid_reviews ?? learnerSafety.red_team_valid_reviews}; tests missing review: ${learnerSafetyReview?.summary?.tests_missing_review ?? learnerSafety.red_team_tests_missing_review}.`,
  `- Learner-safety review packets: ${learnerSafetyPackets?.summary?.total_review_packets ?? learnerSafety.learner_safety_total_review_packets ?? 0}; red-team packets: ${learnerSafetyPackets?.summary?.red_team_test_review_packets ?? learnerSafety.learner_safety_red_team_test_review_packets ?? 0}; optional-AI guardrail packets: ${learnerSafetyPackets?.summary?.optional_ai_guardrail_review_packets ?? learnerSafety.learner_safety_optional_ai_guardrail_review_packets ?? 0}; all required safety categories packeted: ${learnerSafetyPackets?.summary?.all_required_categories_packeted ?? learnerSafety.learner_safety_all_required_categories_packeted ?? false}; national learner-safety release ready from packets: ${learnerSafetyPackets?.summary?.ready_for_national_learner_safety_release_from_packets ?? learnerSafety.learner_safety_ready_for_national_release_from_packets ?? false}.`,
  `- Equity-reviewed cases: ${equity.equity_reviewed_cases}.`,
  `- Equity case reviews submitted: ${equityCaseReview?.summary?.submitted_reviews ?? equity.equity_case_submitted_reviews}; valid reviews: ${equityCaseReview?.summary?.valid_reviews ?? equity.equity_case_valid_reviews}; cases missing review: ${equityCaseReview?.summary?.cases_missing_review ?? equity.equity_case_cases_missing_review}; national release ready: ${equityCaseReview?.summary?.ready_for_national_equity_release ?? equity.equity_case_ready_for_national_release}.`,
  `- Equity review packets: ${equityCasePackets?.summary?.total_review_packets ?? equity.equity_case_total_review_packets ?? 0}; case packets: ${equityCasePackets?.summary?.case_review_packets ?? equity.equity_case_review_packet_cases ?? 0}; bias-policy probe packets: ${equityCasePackets?.summary?.bias_policy_probe_review_packets ?? equity.equity_bias_policy_probe_review_packets ?? 0}; case-bank coverage gap packets: ${equityCasePackets?.summary?.case_bank_coverage_gap_packets ?? equity.equity_case_bank_coverage_gap_packets ?? 0}; all cases packeted: ${equityCasePackets?.summary?.all_cases_packeted ?? equity.equity_case_all_cases_packeted ?? false}; all bias probes packeted: ${equityCasePackets?.summary?.all_bias_policy_probes_packeted ?? equity.equity_bias_policy_all_probes_packeted ?? false}; national equity release ready from packets: ${equityCasePackets?.summary?.ready_for_national_equity_release_from_packets ?? equity.equity_case_ready_for_national_release_from_packets ?? false}.`,
  `- Default-route initial JS budget passed: ${scale.default_route_initial_budget_passed}; initial JS KB: ${scaleBundle?.summary?.initial_js_kb ?? scale.default_route_initial_js_kb}.`,
  `- Accessibility critical static issues: ${accessibility?.summary?.critical_static_issue_count ?? scale.accessibility_critical_static_issue_count}; manual WCAG review required: ${accessibility?.summary?.manual_wcag_required ?? scale.accessibility_manual_wcag_required}.`,
  `- Institutional governance reviews submitted: ${institutionalGovernanceReview?.summary?.submitted_reviews ?? scale.institutional_governance_submitted_reviews}; valid reviews: ${institutionalGovernanceReview?.summary?.valid_reviews ?? scale.institutional_governance_valid_reviews}; domains missing review: ${institutionalGovernanceReview?.summary?.domains_missing_review ?? scale.institutional_governance_domains_missing_review}; national release ready: ${institutionalGovernanceReview?.summary?.ready_for_national_institutional_release ?? scale.institutional_governance_ready_for_national_release}.`,
  `- Institutional governance review packets: ${institutionalGovernancePackets?.summary?.total_review_packets ?? scale.institutional_governance_total_review_packets ?? 0}; domain packets: ${institutionalGovernancePackets?.summary?.domain_review_packets ?? scale.institutional_governance_domain_review_packets ?? 0}; release-evidence packets: ${institutionalGovernancePackets?.summary?.release_evidence_packets ?? scale.institutional_governance_release_evidence_packets ?? 0}; all domains packeted: ${institutionalGovernancePackets?.summary?.all_required_domains_packeted ?? scale.institutional_governance_all_required_domains_packeted ?? false}; all release evidence packeted: ${institutionalGovernancePackets?.summary?.all_release_evidence_packeted ?? scale.institutional_governance_all_release_evidence_packeted ?? false}; national governance release ready from packets: ${institutionalGovernancePackets?.summary?.ready_for_national_governance_release_from_packets ?? scale.institutional_governance_ready_for_national_release_from_packets ?? false}.`,
  `- Weaknesses tracked: ${weakness?.summary?.total_weaknesses ?? 'missing'}; local runtime mitigations verified: ${weakness?.summary?.local_runtime_mitigations_verified ?? 'missing'}.`,
  `- Medical education validation criteria: ${rubric?.summary?.total_criteria ?? 'missing'}; external review passes: ${rubric?.summary?.external_review_passes ?? 'missing'}.`,
  '',
  '## Evidence Used',
  '',
  '- `docs/national_scale_readiness_report.json` for current gate status and metrics.',
  '- `docs/national_readiness_weakness_register.json` for the prioritized 60-weakness improvement register.',
  '- `docs/case_truth_review_packets.json`, `docs/case_truth_adjudication_worklist.json`, and `docs/clinical_review_adjudication_status.json` for case-truth and evidence-adjudication readiness.',
  '- `docs/case_bank_expansion_status.json` for national case-bank size, acuity, age, special-population, and presentation coverage gaps.',
  '- `docs/case_bank_expansion_packets.json` for national case acquisition and review blueprints.',
  '- `docs/case_bank_expansion_review_status.json` for completed case-bank expansion blueprint review validation.',
  '- `docs/source_freshness_report.json`, `docs/source_freshness_review_packets.json`, and `docs/source_freshness_adjudication_status.json` for source currency review state.',
  '- `docs/learner_facing_evidence_coverage_report.json`, `docs/source_link_quote_verification_report.json`, and `docs/high_risk_quote_coverage_depth_report.json` for learner-facing evidence grounding.',
  '- `docs/open_evidence_grounding_review_packets.json` for generated-backlog source review batches and evidence release-blocker assignments.',
  '- `docs/open_evidence_grounding_review_status.json` for completed open-evidence grounding review validation.',
  '- `docs/claim_reference_gap_review_packets.json` for named-standard feedback evidence gaps such as ESI.',
  '- `docs/claim_reference_gap_review_status.json` for completed named-standard evidence-gap review validation.',
  '- `docs/feedback_case_domain_review_packets.json` for row-level deterministic feedback calibration review assignments.',
  '- `docs/feedback_case_domain_calibration_review_status.json` for completed row-level feedback calibration review validation.',
  '- `docs/curriculum_mapping_review_status.json` for completed curriculum, Core EPA, and workflow-phase review state.',
  '- `docs/educational_outcomes_measurement_framework.json`, `docs/educational_outcomes_validation_status.json`, and `docs/educational_outcomes_protocol.md` for educational validation planning.',
  '- `docs/educational_validity_review_packets.json` for curriculum, Core EPA, metric, case-outcome, and study-evidence review assignments.',
  '- `docs/educational_validity_review_status.json` for completed educational-validity packet review validation.',
  '- `docs/learner_safety_review_packets.json` for red-team and optional-AI guardrail safety review assignments.',
  '- `docs/equity_case_review_status.json` for completed case-level equity and bias review state.',
  '- `docs/equity_case_review_packets.json` for case-level equity, automated bias-policy, and case-bank coverage gap review assignments.',
  '- `docs/institutional_governance_review_status.json` for domain-by-domain privacy, accessibility, operations, and institutional approval state.',
  '- `docs/institutional_governance_review_packets.json` for privacy/security, FERPA/HIPAA, accessibility, AI-provider, operations, IRB/QI, production-evidence, and multi-institution release review assignments.',
  '- `docs/medical_education_validation_rubric.json` for paper-informed validation criteria.',
  '- The project papers on AI in healthcare simulation, clinical reasoning curricula, ESI improvement, and LLM virtual patients.',
  '',
  '## Product Principle',
  '',
  'The project should move from "LLM-assisted simulation" toward "evidence-governed simulation with optional LLM drafting."',
  '',
  'Required behavior:',
  '',
  '- Deterministic scoring remains the learner-facing grade source.',
  '- Open evidence and clinician-reviewed case truth drive feedback.',
  '- Retrieval and citation quality are visible and testable.',
  '- LLM outputs are optional, labeled as drafts, separately auditable, and blocked when grounding fails.',
  '- Any unreviewed clinical inference is marked as simulation support, not medical truth.',
  '',
  '## National Readiness Gates',
  '',
  ...gateRows(readiness),
  '',
  '## Highest-Priority Open Weaknesses',
  '',
  ...topWeaknessRows(weakness),
  '',
  '## Minimum Definition Of National Readiness',
  '',
  'The project should not be described as nationally ready until all of the following are true:',
  '',
  '1. At least 100 public cases are reviewed by clinicians and mapped to learning objectives.',
  '2. Every case has a complete truth record for acuity, diagnosis, disposition, referral, stabilization, reassessment, and expected resources.',
  '3. High-risk clinical feedback is quote-backed or clinician-approved.',
  '4. Generated-needs-review evidence chunks are either removed, reviewed, or clearly excluded from source-of-truth feedback.',
  '5. Deterministic feedback has regression tests across the full case bank.',
  '6. Optional AI output cannot mutate scoring or deterministic feedback.',
  '7. Clinical educators approve a representative sample of feedback across all ESI levels.',
  '8. A pre/post educational evaluation protocol is ready and institutionally reviewed.',
  '9. Privacy, governance, provider disclosure, retention, and incident response docs are complete.',
  '10. The deployment is load-tested and monitored for cohort use.',
  '',
  '## Next Implementation Roadmap',
  '',
  ...phase('Phase 1: Preserve Feedback Integrity', [
    'Keep deterministic scoring, SOAP synthesis, checklist feedback, and source-limited labels separated from optional AI drafts.',
    'Expand deterministic feedback regression tests across the full reviewed case bank as cases are adjudicated.',
    'Keep optional AI guardrail probes passing and block unsafe or unsupported draft output before external calls whenever possible.'
  ]),
  ...phase('Phase 2: Make Case Truth Reviewable And Complete', [
    'Use `docs/case_truth_review_packets.json` to assign clinician and educator review for every current case.',
    'Use `docs/case_truth_adjudication_worklist.json` starter adjudications to collect complete case-truth review inputs without adding restricted source identifiers.',
    'Record completed reviews in `docs/case_truth_adjudications.json` and keep `docs/clinical_review_adjudication_status.json` valid.',
    'Record completed case-bank expansion reviews in `docs/case_bank_expansion_reviews.json` before counting blueprint slots as public national-release cases.',
    'Expand the public case bank from 23 to at least 100 reviewed cases with acuity, age, sex, language-access, pregnancy, disability, social-context, and presentation coverage.'
  ]),
  ...phase('Phase 3: Rebuild Evidence Provenance', [
    'Replace or adjudicate the 2400 generated-needs-review chunks before using them as source-of-truth learner feedback.',
    'Use open-evidence grounding review packets to assign every generated-needs-review batch and evidence dashboard release blocker to clinician, librarian/source, and simulation educator review.',
    'Record completed open-evidence grounding reviews and keep the grounding review status artifact valid before clearing generated evidence or source-release blockers.',
    'Record completed named-standard claim-reference gap reviews before clearing ESI or other standard-specific feedback support blockers.',
    'Use the source-freshness packets and source-freshness adjudication status to complete qualified review before adding local review dates.',
    'Keep high-risk quote-depth at 15/15 core topics while raising overall learner-facing quote-backed coverage.'
  ]),
  ...phase('Phase 4: Validate Feedback Claims', [
    'Use claim-entailment packets to review every learner-facing feedback domain.',
    'Use feedback case-domain review packets to calibrate every current case-domain feedback row before national learner-facing release.',
    'Record completed feedback case-domain calibration reviews and keep the calibration review status artifact valid.',
    'Keep source-limited diagnosis, referral, and reassessment domains formative-only until case truth and evidence reviews are complete.',
    'Require clinician, simulation educator, and evidence-review signoff before national learner-facing feedback release.',
    'Use learner-safety review packets to review red-team and optional-AI guardrail behavior before national learner-facing release.'
  ]),
  ...phase('Phase 5: Prove Educational Value', [
    'Use educational-validity review packets to assign curriculum mapping, workflow/EPA scope, metric validity, case outcome, and study-design reviews.',
    'Record completed educational-validity packet reviews and keep the review status artifact valid before clearing educational release blockers.',
    'Run response-process usability work before pilot claims.',
    'Complete a single-site pre/post pilot with ESI accuracy, undertriage, rationale quality, escalation choice, and reassessment outcomes.',
    'Only claim national educational efficacy after multi-site or externally reviewed outcome evidence.'
  ]),
  ...phase('Phase 6: Complete Governance, Equity, Accessibility, And Scale', [
    'Complete institutional privacy/security review, model/provider disclosure, retention policy, and incident-response ownership.',
    'Use institutional governance review packets to assign privacy/security, FERPA/HIPAA, accessibility, AI-provider, clinical-content governance, IRB/QI, operations, production-evidence, and multi-institution release reviews.',
    'Use equity review packets to complete case-level equity, bias-policy, language-access, disability/accommodation, and case-bank coverage review.',
    'Complete manual WCAG/accessibility review.',
    'Run production-representative load testing, monitoring, release rollback, and incident drills before multi-school cohorts.'
  ]),
  '## Current Blockers That Prevent Goal Completion',
  '',
  ...readiness.next_required_actions.map((action) => `- ${action}`),
  ''
];

writeFileSync(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8');

console.log(JSON.stringify({
  status: readiness.verdict,
  cases: cases.total_cases,
  quote_backed_chunks: evidence.quote_backed_count,
  total_chunks: evidence.total_chunks,
  weaknesses: weakness?.summary?.total_weaknesses || 0,
  output_path: OUTPUT_PATH
}, null, 2));
