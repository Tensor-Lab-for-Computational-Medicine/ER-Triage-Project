import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const NATIONAL_SCALE_GOAL_PATH = join(ROOT, 'docs', 'national_scale_readiness_goal.md');
const REPORT_PATH = join(ROOT, 'docs', 'national_scale_readiness_report.json');
const OBJECTIVE_MATRIX_PATH = join(ROOT, 'docs', 'case_objective_matrix.json');
const TRUTH_PACKETS_PATH = join(ROOT, 'docs', 'case_truth_review_packets.json');
const CASE_TRUTH_ADJUDICATION_WORKLIST_PATH = join(ROOT, 'docs', 'case_truth_adjudication_worklist.json');
const CASE_GENERATION_QUALITY_REPORT_PATH = join(ROOT, 'docs', 'case_generation_quality_report.json');
const CASE_BANK_EXPANSION_STATUS_PATH = join(ROOT, 'docs', 'case_bank_expansion_status.json');
const CASE_BANK_EXPANSION_PACKETS_PATH = join(ROOT, 'docs', 'case_bank_expansion_packets.json');
const CASE_BANK_EXPANSION_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'case_bank_expansion_review_status.json');
const EVIDENCE_BACKLOG_PATH = join(ROOT, 'docs', 'evidence_review_backlog.json');
const OPEN_EVIDENCE_GROUNDING_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'open_evidence_grounding_review_packets.json');
const OPEN_EVIDENCE_GROUNDING_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'open_evidence_grounding_review_status.json');
const CLINICAL_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'clinical_review_adjudication_status.json');
const FEEDBACK_TRACEABILITY_MATRIX_PATH = join(ROOT, 'docs', 'feedback_traceability_matrix.json');
const FEEDBACK_INTEGRITY_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'feedback_integrity_runtime_report.json');
const FEEDBACK_CASE_DOMAIN_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'feedback_case_domain_review_packets.json');
const FEEDBACK_CASE_DOMAIN_CALIBRATION_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'feedback_case_domain_calibration_review_status.json');
const OPTIONAL_AI_GUARDRAIL_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'optional_ai_guardrail_runtime_report.json');
const FEEDBACK_CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH = join(ROOT, 'docs', 'feedback_claim_reference_alignment_report.json');
const CLAIM_REFERENCE_GAP_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'claim_reference_gap_review_packets.json');
const CLAIM_REFERENCE_GAP_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'claim_reference_gap_review_status.json');
const OPEN_EVIDENCE_POLICY_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'open_evidence_runtime_policy_report.json');
const OPEN_EVIDENCE_RETRIEVAL_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'open_evidence_retrieval_runtime_report.json');
const SOURCE_LINK_QUOTE_VERIFICATION_REPORT_PATH = join(ROOT, 'docs', 'source_link_quote_verification_report.json');
const SOURCE_FRESHNESS_REPORT_PATH = join(ROOT, 'docs', 'source_freshness_report.json');
const SOURCE_FRESHNESS_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'source_freshness_review_packets.json');
const SOURCE_FRESHNESS_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'source_freshness_adjudication_status.json');
const HIGH_RISK_QUOTE_COVERAGE_DEPTH_REPORT_PATH = join(ROOT, 'docs', 'high_risk_quote_coverage_depth_report.json');
const HIGH_RISK_CLINICAL_CLASSIFICATION_REPORT_PATH = join(ROOT, 'docs', 'high_risk_clinical_classification_report.json');
const OPEN_EVIDENCE_TOPIC_RETRIEVAL_BENCHMARK_PATH = join(ROOT, 'docs', 'open_evidence_topic_retrieval_benchmark.json');
const LEARNER_FACING_EVIDENCE_COVERAGE_REPORT_PATH = join(ROOT, 'docs', 'learner_facing_evidence_coverage_report.json');
const EVIDENCE_QUALITY_DASHBOARD_PATH = join(ROOT, 'docs', 'evidence_quality_dashboard.json');
const FEEDBACK_CLAIM_ENTAILMENT_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_review_packets.json');
const FEEDBACK_CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_adjudication_status.json');
const EQUITY_BIAS_AUDIT_PATH = join(ROOT, 'docs', 'equity_bias_readiness_audit.json');
const EQUITY_CASE_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'equity_case_review_status.json');
const EQUITY_CASE_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'equity_case_review_packets.json');
const CORE_EPA_CURRICULUM_MAP_PATH = join(ROOT, 'docs', 'core_epa_curriculum_map.json');
const CURRICULUM_MAPPING_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'curriculum_mapping_review_status.json');
const EDUCATIONAL_OUTCOMES_FRAMEWORK_PATH = join(ROOT, 'docs', 'educational_outcomes_measurement_framework.json');
const EDUCATIONAL_OUTCOMES_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'educational_outcomes_runtime_report.json');
const EDUCATIONAL_OUTCOMES_VALIDATION_STATUS_PATH = join(ROOT, 'docs', 'educational_outcomes_validation_status.json');
const EDUCATIONAL_VALIDITY_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'educational_validity_review_packets.json');
const EDUCATIONAL_VALIDITY_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'educational_validity_review_status.json');
const LEARNER_SAFETY_RED_TEAM_PATH = join(ROOT, 'docs', 'learner_safety_red_team_suite.json');
const LEARNER_SAFETY_RED_TEAM_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'learner_safety_red_team_runtime_report.json');
const LEARNER_SAFETY_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'learner_safety_review_status.json');
const LEARNER_SAFETY_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'learner_safety_review_packets.json');
const GOVERNANCE_INVENTORY_PATH = join(ROOT, 'docs', 'governance_data_inventory.json');
const INSTITUTIONAL_GOVERNANCE_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'institutional_governance_review_status.json');
const INSTITUTIONAL_GOVERNANCE_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'institutional_governance_review_packets.json');
const SCALE_BUNDLE_REPORT_PATH = join(ROOT, 'docs', 'scale_bundle_readiness_report.json');
const SCALE_OPERATIONS_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'scale_operations_runtime_report.json');
const ROUTE_REACHABILITY_REPORT_PATH = join(ROOT, 'docs', 'route_reachability_report.json');
const ACCESSIBILITY_READINESS_REPORT_PATH = join(ROOT, 'docs', 'accessibility_readiness_report.json');
const RUBRIC_PATH = join(ROOT, 'docs', 'medical_education_validation_rubric.json');
const WEAKNESS_REGISTER_PATH = join(ROOT, 'docs', 'national_readiness_weakness_register.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function gateStatus(report, id) {
  return report.gates.find((gate) => gate.id === id)?.status;
}

for (const path of [
  CASES_PATH,
  NATIONAL_SCALE_GOAL_PATH,
  REPORT_PATH,
  OBJECTIVE_MATRIX_PATH,
  TRUTH_PACKETS_PATH,
  CASE_TRUTH_ADJUDICATION_WORKLIST_PATH,
  CASE_GENERATION_QUALITY_REPORT_PATH,
  CASE_BANK_EXPANSION_STATUS_PATH,
  CASE_BANK_EXPANSION_PACKETS_PATH,
  CASE_BANK_EXPANSION_REVIEW_STATUS_PATH,
  EVIDENCE_BACKLOG_PATH,
  OPEN_EVIDENCE_GROUNDING_REVIEW_PACKETS_PATH,
  OPEN_EVIDENCE_GROUNDING_REVIEW_STATUS_PATH,
  CLINICAL_ADJUDICATION_STATUS_PATH,
  FEEDBACK_TRACEABILITY_MATRIX_PATH,
  FEEDBACK_INTEGRITY_RUNTIME_REPORT_PATH,
  FEEDBACK_CASE_DOMAIN_REVIEW_PACKETS_PATH,
  FEEDBACK_CASE_DOMAIN_CALIBRATION_REVIEW_STATUS_PATH,
  OPTIONAL_AI_GUARDRAIL_RUNTIME_REPORT_PATH,
  FEEDBACK_CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH,
  CLAIM_REFERENCE_GAP_REVIEW_PACKETS_PATH,
  CLAIM_REFERENCE_GAP_REVIEW_STATUS_PATH,
  OPEN_EVIDENCE_POLICY_RUNTIME_REPORT_PATH,
  OPEN_EVIDENCE_RETRIEVAL_RUNTIME_REPORT_PATH,
  SOURCE_LINK_QUOTE_VERIFICATION_REPORT_PATH,
  SOURCE_FRESHNESS_REPORT_PATH,
  SOURCE_FRESHNESS_REVIEW_PACKETS_PATH,
  SOURCE_FRESHNESS_ADJUDICATION_STATUS_PATH,
  HIGH_RISK_QUOTE_COVERAGE_DEPTH_REPORT_PATH,
  HIGH_RISK_CLINICAL_CLASSIFICATION_REPORT_PATH,
  OPEN_EVIDENCE_TOPIC_RETRIEVAL_BENCHMARK_PATH,
  LEARNER_FACING_EVIDENCE_COVERAGE_REPORT_PATH,
  EVIDENCE_QUALITY_DASHBOARD_PATH,
  FEEDBACK_CLAIM_ENTAILMENT_REVIEW_PACKETS_PATH,
  FEEDBACK_CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH,
  EQUITY_BIAS_AUDIT_PATH,
  EQUITY_CASE_REVIEW_STATUS_PATH,
  EQUITY_CASE_REVIEW_PACKETS_PATH,
  CORE_EPA_CURRICULUM_MAP_PATH,
  CURRICULUM_MAPPING_REVIEW_STATUS_PATH,
  EDUCATIONAL_OUTCOMES_FRAMEWORK_PATH,
  EDUCATIONAL_OUTCOMES_RUNTIME_REPORT_PATH,
  EDUCATIONAL_OUTCOMES_VALIDATION_STATUS_PATH,
  EDUCATIONAL_VALIDITY_REVIEW_PACKETS_PATH,
  EDUCATIONAL_VALIDITY_REVIEW_STATUS_PATH,
  LEARNER_SAFETY_RED_TEAM_PATH,
  LEARNER_SAFETY_RED_TEAM_RUNTIME_REPORT_PATH,
  LEARNER_SAFETY_REVIEW_STATUS_PATH,
  LEARNER_SAFETY_REVIEW_PACKETS_PATH,
  GOVERNANCE_INVENTORY_PATH,
  INSTITUTIONAL_GOVERNANCE_REVIEW_STATUS_PATH,
  INSTITUTIONAL_GOVERNANCE_REVIEW_PACKETS_PATH,
  SCALE_BUNDLE_REPORT_PATH,
  SCALE_OPERATIONS_RUNTIME_REPORT_PATH,
  ROUTE_REACHABILITY_REPORT_PATH,
  ACCESSIBILITY_READINESS_REPORT_PATH,
  RUBRIC_PATH,
  WEAKNESS_REGISTER_PATH
]) {
  assert(existsSync(path), `Required readiness artifact is missing: ${path}`);
}

const cases = readJson(CASES_PATH);
const nationalScaleGoalMarkdown = readFileSync(NATIONAL_SCALE_GOAL_PATH, 'utf8');
const report = readJson(REPORT_PATH);
const objectiveMatrix = readJson(OBJECTIVE_MATRIX_PATH);
const truthPackets = readJson(TRUTH_PACKETS_PATH);
const caseTruthAdjudicationWorklist = readJson(CASE_TRUTH_ADJUDICATION_WORKLIST_PATH);
const caseGenerationQualityReport = readJson(CASE_GENERATION_QUALITY_REPORT_PATH);
const caseBankExpansionStatus = readJson(CASE_BANK_EXPANSION_STATUS_PATH);
const caseBankExpansionPackets = readJson(CASE_BANK_EXPANSION_PACKETS_PATH);
const caseBankExpansionReviewStatus = readJson(CASE_BANK_EXPANSION_REVIEW_STATUS_PATH);
const evidenceBacklog = readJson(EVIDENCE_BACKLOG_PATH);
const openEvidenceGroundingReviewPackets = readJson(OPEN_EVIDENCE_GROUNDING_REVIEW_PACKETS_PATH);
const openEvidenceGroundingReviewStatus = readJson(OPEN_EVIDENCE_GROUNDING_REVIEW_STATUS_PATH);
const clinicalReviewAdjudicationStatus = readJson(CLINICAL_ADJUDICATION_STATUS_PATH);
const feedbackTraceabilityMatrix = readJson(FEEDBACK_TRACEABILITY_MATRIX_PATH);
const feedbackIntegrityRuntimeReport = readJson(FEEDBACK_INTEGRITY_RUNTIME_REPORT_PATH);
const feedbackCaseDomainReviewPackets = readJson(FEEDBACK_CASE_DOMAIN_REVIEW_PACKETS_PATH);
const feedbackCaseDomainCalibrationReviewStatus = readJson(FEEDBACK_CASE_DOMAIN_CALIBRATION_REVIEW_STATUS_PATH);
const optionalAiGuardrailRuntimeReport = readJson(OPTIONAL_AI_GUARDRAIL_RUNTIME_REPORT_PATH);
const feedbackClaimReferenceAlignmentReport = readJson(FEEDBACK_CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH);
const claimReferenceGapReviewPackets = readJson(CLAIM_REFERENCE_GAP_REVIEW_PACKETS_PATH);
const claimReferenceGapReviewStatus = readJson(CLAIM_REFERENCE_GAP_REVIEW_STATUS_PATH);
const openEvidenceRuntimeReport = readJson(OPEN_EVIDENCE_POLICY_RUNTIME_REPORT_PATH);
const openEvidenceRetrievalRuntimeReport = readJson(OPEN_EVIDENCE_RETRIEVAL_RUNTIME_REPORT_PATH);
const sourceLinkQuoteVerificationReport = readJson(SOURCE_LINK_QUOTE_VERIFICATION_REPORT_PATH);
const sourceFreshnessReport = readJson(SOURCE_FRESHNESS_REPORT_PATH);
const sourceFreshnessReviewPackets = readJson(SOURCE_FRESHNESS_REVIEW_PACKETS_PATH);
const sourceFreshnessAdjudicationStatus = readJson(SOURCE_FRESHNESS_ADJUDICATION_STATUS_PATH);
const highRiskQuoteCoverageDepthReport = readJson(HIGH_RISK_QUOTE_COVERAGE_DEPTH_REPORT_PATH);
const highRiskClinicalClassificationReport = readJson(HIGH_RISK_CLINICAL_CLASSIFICATION_REPORT_PATH);
const openEvidenceTopicRetrievalBenchmark = readJson(OPEN_EVIDENCE_TOPIC_RETRIEVAL_BENCHMARK_PATH);
const learnerFacingEvidenceCoverageReport = readJson(LEARNER_FACING_EVIDENCE_COVERAGE_REPORT_PATH);
const evidenceQualityDashboard = readJson(EVIDENCE_QUALITY_DASHBOARD_PATH);
const feedbackClaimEntailmentReviewPackets = readJson(FEEDBACK_CLAIM_ENTAILMENT_REVIEW_PACKETS_PATH);
const feedbackClaimEntailmentAdjudicationStatus = readJson(FEEDBACK_CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH);
const equityBiasAudit = readJson(EQUITY_BIAS_AUDIT_PATH);
const equityCaseReviewStatus = readJson(EQUITY_CASE_REVIEW_STATUS_PATH);
const equityCaseReviewPackets = readJson(EQUITY_CASE_REVIEW_PACKETS_PATH);
const coreEpaCurriculumMap = readJson(CORE_EPA_CURRICULUM_MAP_PATH);
const curriculumMappingReviewStatus = readJson(CURRICULUM_MAPPING_REVIEW_STATUS_PATH);
const educationalOutcomesFramework = readJson(EDUCATIONAL_OUTCOMES_FRAMEWORK_PATH);
const educationalOutcomesRuntimeReport = readJson(EDUCATIONAL_OUTCOMES_RUNTIME_REPORT_PATH);
const educationalOutcomesValidationStatus = readJson(EDUCATIONAL_OUTCOMES_VALIDATION_STATUS_PATH);
const educationalValidityReviewPackets = readJson(EDUCATIONAL_VALIDITY_REVIEW_PACKETS_PATH);
const educationalValidityReviewStatus = readJson(EDUCATIONAL_VALIDITY_REVIEW_STATUS_PATH);
const learnerSafetyRedTeam = readJson(LEARNER_SAFETY_RED_TEAM_PATH);
const learnerSafetyRuntimeReport = readJson(LEARNER_SAFETY_RED_TEAM_RUNTIME_REPORT_PATH);
const learnerSafetyReviewStatus = readJson(LEARNER_SAFETY_REVIEW_STATUS_PATH);
const learnerSafetyReviewPackets = readJson(LEARNER_SAFETY_REVIEW_PACKETS_PATH);
const governanceInventory = readJson(GOVERNANCE_INVENTORY_PATH);
const institutionalGovernanceReviewStatus = readJson(INSTITUTIONAL_GOVERNANCE_REVIEW_STATUS_PATH);
const institutionalGovernanceReviewPackets = readJson(INSTITUTIONAL_GOVERNANCE_REVIEW_PACKETS_PATH);
const scaleBundleReport = readJson(SCALE_BUNDLE_REPORT_PATH);
const scaleOperationsRuntimeReport = readJson(SCALE_OPERATIONS_RUNTIME_REPORT_PATH);
const routeReachabilityReport = readJson(ROUTE_REACHABILITY_REPORT_PATH);
const accessibilityReadinessReport = readJson(ACCESSIBILITY_READINESS_REPORT_PATH);
const rubric = readJson(RUBRIC_PATH);
const weaknessRegister = readJson(WEAKNESS_REGISTER_PATH);

const caseIds = new Set(cases.map((caseRecord) => caseRecord.id));
const objectiveIds = new Set(objectiveMatrix.cases.map((entry) => entry.case_id));
const truthIds = new Set(truthPackets.case_review_packets.map((entry) => entry.case_id));

assert(report.schema_version === 'national_scale_readiness_report_v1', 'Unexpected national readiness report schema');
assert(report.verdict === 'not_ready', 'Readiness report must remain not_ready until all gates pass');
assert(nationalScaleGoalMarkdown.includes('# National-Scale Readiness Goal'), 'National scale readiness goal document must have the expected title');
assert(nationalScaleGoalMarkdown.includes(`Status: ${report.verdict} for national medical-student deployment.`), 'National scale readiness goal must reflect the current readiness verdict');
assert(nationalScaleGoalMarkdown.includes(`- Public cases: ${cases.length}.`), 'National scale readiness goal must reflect the current public case count');
assert(nationalScaleGoalMarkdown.includes(`- Case-truth adjudication worklist: ${caseTruthAdjudicationWorklist.summary.total_work_items} work items; pending adjudications: ${caseTruthAdjudicationWorklist.summary.pending_case_truth_adjudications}; high-priority P1/P2 work items: ${caseTruthAdjudicationWorklist.summary.high_priority_work_items}; total worklist release blockers: ${caseTruthAdjudicationWorklist.summary.total_release_blockers}; national case-truth release ready from worklist: ${caseTruthAdjudicationWorklist.summary.ready_for_national_case_truth_release_from_worklist}.`), 'National scale readiness goal must reflect case-truth adjudication worklist status');
assert(nationalScaleGoalMarkdown.includes(`- Public clinical chunks: ${report.metrics.evidence.total_chunks}.`), 'National scale readiness goal must reflect the current evidence chunk count');
assert(nationalScaleGoalMarkdown.includes(`- Quote-backed chunks: ${report.metrics.evidence.quote_backed_count}`), 'National scale readiness goal must reflect the current quote-backed chunk count');
assert(nationalScaleGoalMarkdown.includes(`- Generated-needs-review chunks: ${report.metrics.evidence.generated_needs_review_count}.`), 'National scale readiness goal must reflect the current generated evidence backlog count');
assert(nationalScaleGoalMarkdown.includes(`- Source-link quote records requiring repair or manual verification: ${sourceLinkQuoteVerificationReport.summary.quote_records_requiring_repair}; without machine text match: ${sourceLinkQuoteVerificationReport.summary.quote_records_without_machine_text_match}; release ready: ${sourceLinkQuoteVerificationReport.summary.quote_verification_release_ready}.`), 'National scale readiness goal must reflect source-link quote repair status');
assert(nationalScaleGoalMarkdown.includes(`- Case-bank expansion shortfall: ${caseBankExpansionStatus.summary.case_count_shortfall}; target gaps: ${caseBankExpansionStatus.summary.target_gap_count}; recommended minimum new cases: ${caseBankExpansionStatus.summary.recommended_minimum_new_cases}.`), 'National scale readiness goal must reflect case-bank expansion status');
assert(nationalScaleGoalMarkdown.includes(`- Case-bank expansion packets: ${caseBankExpansionPackets.summary.target_gap_packets} target gaps; ${caseBankExpansionPackets.summary.blueprint_slots} blueprint slots; all target shortfalls covered by blueprints: ${caseBankExpansionPackets.summary.all_target_shortfalls_have_blueprint_coverage}.`), 'National scale readiness goal must reflect case-bank expansion packet status');
assert(nationalScaleGoalMarkdown.includes(`- Case-bank expansion reviews submitted: ${caseBankExpansionReviewStatus.summary.submitted_blueprint_reviews}; valid reviews: ${caseBankExpansionReviewStatus.summary.valid_blueprint_reviews}; pending blueprint reviews: ${caseBankExpansionReviewStatus.summary.pending_blueprint_reviews}; national countable blueprint reviews: ${caseBankExpansionReviewStatus.summary.national_countable_blueprint_reviews}; national case-bank release ready from reviews: ${caseBankExpansionReviewStatus.summary.ready_for_national_case_bank_release_from_reviews}.`), 'National scale readiness goal must reflect case-bank expansion review status');
assert(nationalScaleGoalMarkdown.includes(`- Open-evidence grounding review packets: ${openEvidenceGroundingReviewPackets.summary.total_review_packets}; generated backlog batch packets: ${openEvidenceGroundingReviewPackets.summary.generated_backlog_review_packets}; release-blocker packets: ${openEvidenceGroundingReviewPackets.summary.release_blocker_packets}; generated chunks packeted: ${openEvidenceGroundingReviewPackets.summary.generated_needs_review_chunks_packeted}; all review batches packeted: ${openEvidenceGroundingReviewPackets.summary.all_review_batches_packeted}; national open-evidence release ready from packets: ${openEvidenceGroundingReviewPackets.summary.ready_for_national_open_evidence_release_from_packets}.`), 'National scale readiness goal must reflect open-evidence grounding review packet status');
assert(nationalScaleGoalMarkdown.includes(`- Open-evidence grounding reviews submitted: ${openEvidenceGroundingReviewStatus.summary.submitted_grounding_reviews}; valid reviews: ${openEvidenceGroundingReviewStatus.summary.valid_grounding_reviews}; pending packets: ${openEvidenceGroundingReviewStatus.summary.pending_review_packets}; cleared packets: ${openEvidenceGroundingReviewStatus.summary.cleared_review_packets}; national open-evidence release ready from reviews: ${openEvidenceGroundingReviewStatus.summary.ready_for_national_open_evidence_release_from_reviews}.`), 'National scale readiness goal must reflect open-evidence grounding review status');
assert(nationalScaleGoalMarkdown.includes(`- Source-freshness reviews submitted: ${sourceFreshnessAdjudicationStatus.summary.submitted_source_reviews}; packets missing review: ${sourceFreshnessAdjudicationStatus.summary.packets_missing_review}.`), 'National scale readiness goal must reflect source-freshness adjudication status');
assert(nationalScaleGoalMarkdown.includes(`- Curriculum mapping reviews submitted: ${curriculumMappingReviewStatus.summary.submitted_case_reviews}; valid case reviews: ${curriculumMappingReviewStatus.summary.valid_case_reviews}; case mappings missing review: ${curriculumMappingReviewStatus.summary.case_mappings_missing_review}; workflow phases missing review: ${curriculumMappingReviewStatus.summary.workflow_phases_missing_review}; unsupported EPA decisions missing: ${curriculumMappingReviewStatus.summary.unsupported_epa_decisions_missing}; national curriculum release ready: ${curriculumMappingReviewStatus.summary.ready_for_national_curriculum_release}.`), 'National scale readiness goal must reflect curriculum mapping review status');
assert(nationalScaleGoalMarkdown.includes(`- Educational outcome studies submitted: ${educationalOutcomesValidationStatus.summary.submitted_studies}; valid studies: ${educationalOutcomesValidationStatus.summary.valid_studies}; validation ready for claims: ${educationalOutcomesValidationStatus.summary.ready_for_educational_validity_claims}.`), 'National scale readiness goal must reflect educational outcome study validation status');
assert(nationalScaleGoalMarkdown.includes(`- Educational-validity review packets: ${educationalValidityReviewPackets.summary.total_review_packets}; case curriculum packets: ${educationalValidityReviewPackets.summary.case_curriculum_mapping_packets}; case outcome packets: ${educationalValidityReviewPackets.summary.case_outcome_measurement_packets}; metric packets: ${educationalValidityReviewPackets.summary.outcome_metric_review_packets}; study packets: ${educationalValidityReviewPackets.summary.outcome_study_packets}; all curriculum/outcome gaps packeted: ${educationalValidityReviewPackets.summary.all_curriculum_outcome_gaps_packeted}; national educational release ready from packets: ${educationalValidityReviewPackets.summary.ready_for_national_educational_release_from_packets}.`), 'National scale readiness goal must reflect educational-validity review packet status');
assert(nationalScaleGoalMarkdown.includes(`- Educational-validity reviews submitted: ${educationalValidityReviewStatus.summary.submitted_educational_validity_reviews}; valid reviews: ${educationalValidityReviewStatus.summary.valid_educational_validity_reviews}; pending review packets: ${educationalValidityReviewStatus.summary.pending_review_packets}; national educational release ready from reviews: ${educationalValidityReviewStatus.summary.ready_for_national_educational_release_from_reviews}.`), 'National scale readiness goal must reflect educational-validity review status');
assert(nationalScaleGoalMarkdown.includes(`- Learner safety reviews submitted: ${learnerSafetyReviewStatus.summary.submitted_reviews}; valid reviews: ${learnerSafetyReviewStatus.summary.valid_reviews}; tests missing review: ${learnerSafetyReviewStatus.summary.tests_missing_review}.`), 'National scale readiness goal must reflect learner safety review status');
assert(nationalScaleGoalMarkdown.includes(`- Learner-safety review packets: ${learnerSafetyReviewPackets.summary.total_review_packets}; red-team packets: ${learnerSafetyReviewPackets.summary.red_team_test_review_packets}; optional-AI guardrail packets: ${learnerSafetyReviewPackets.summary.optional_ai_guardrail_review_packets}; all required safety categories packeted: ${learnerSafetyReviewPackets.summary.all_required_categories_packeted}; national learner-safety release ready from packets: ${learnerSafetyReviewPackets.summary.ready_for_national_learner_safety_release_from_packets}.`), 'National scale readiness goal must reflect learner-safety review packet status');
assert(nationalScaleGoalMarkdown.includes(`- Equity case reviews submitted: ${equityCaseReviewStatus.summary.submitted_reviews}; valid reviews: ${equityCaseReviewStatus.summary.valid_reviews}; cases missing review: ${equityCaseReviewStatus.summary.cases_missing_review}; national release ready: ${equityCaseReviewStatus.summary.ready_for_national_equity_release}.`), 'National scale readiness goal must reflect equity case review status');
assert(nationalScaleGoalMarkdown.includes(`- Equity review packets: ${equityCaseReviewPackets.summary.total_review_packets}; case packets: ${equityCaseReviewPackets.summary.case_review_packets}; bias-policy probe packets: ${equityCaseReviewPackets.summary.bias_policy_probe_review_packets}; case-bank coverage gap packets: ${equityCaseReviewPackets.summary.case_bank_coverage_gap_packets}; all cases packeted: ${equityCaseReviewPackets.summary.all_cases_packeted}; all bias probes packeted: ${equityCaseReviewPackets.summary.all_bias_policy_probes_packeted}; national equity release ready from packets: ${equityCaseReviewPackets.summary.ready_for_national_equity_release_from_packets}.`), 'National scale readiness goal must reflect equity case review packet status');
assert(nationalScaleGoalMarkdown.includes(`- Institutional governance reviews submitted: ${institutionalGovernanceReviewStatus.summary.submitted_reviews}; valid reviews: ${institutionalGovernanceReviewStatus.summary.valid_reviews}; domains missing review: ${institutionalGovernanceReviewStatus.summary.domains_missing_review}; national release ready: ${institutionalGovernanceReviewStatus.summary.ready_for_national_institutional_release}.`), 'National scale readiness goal must reflect institutional governance review status');
assert(nationalScaleGoalMarkdown.includes(`- Institutional governance review packets: ${institutionalGovernanceReviewPackets.summary.total_review_packets}; domain packets: ${institutionalGovernanceReviewPackets.summary.domain_review_packets}; release-evidence packets: ${institutionalGovernanceReviewPackets.summary.release_evidence_packets}; all domains packeted: ${institutionalGovernanceReviewPackets.summary.all_required_domains_packeted}; all release evidence packeted: ${institutionalGovernanceReviewPackets.summary.all_release_evidence_packeted}; national governance release ready from packets: ${institutionalGovernanceReviewPackets.summary.ready_for_national_governance_release_from_packets}.`), 'National scale readiness goal must reflect institutional governance review packet status');
assert(nationalScaleGoalMarkdown.includes(`- Claim sets missing domain-specific quote support: ${report.metrics.evidence.claim_reference_alignment_claim_sets_missing_domain_specific_support}; domain-specific quote support release ready: ${report.metrics.evidence.claim_reference_alignment_domain_specific_release_ready}.`), 'National scale readiness goal must reflect domain-specific claim-reference support status');
assert(nationalScaleGoalMarkdown.includes(`- Claim-reference gap packets: ${claimReferenceGapReviewPackets.summary.total_gap_packets}; generated candidates packeted: ${claimReferenceGapReviewPackets.summary.generated_needs_review_candidate_chunks_packeted}; all domain-specific gaps packeted: ${claimReferenceGapReviewPackets.summary.all_domain_specific_gaps_packeted}.`), 'National scale readiness goal must reflect claim-reference gap packet status');
assert(nationalScaleGoalMarkdown.includes(`- Claim-reference gap reviews submitted: ${claimReferenceGapReviewStatus.summary.submitted_gap_reviews}; valid reviews: ${claimReferenceGapReviewStatus.summary.valid_gap_reviews}; pending reviews: ${claimReferenceGapReviewStatus.summary.pending_gap_reviews}; national feedback release ready from gap reviews: ${claimReferenceGapReviewStatus.summary.ready_for_national_feedback_release_from_reviews}.`), 'National scale readiness goal must reflect claim-reference gap review status');
assert(nationalScaleGoalMarkdown.includes(`- Feedback case-domain review packets: ${feedbackCaseDomainReviewPackets.summary.total_review_packets}; all rows packeted: ${feedbackCaseDomainReviewPackets.summary.all_case_domain_rows_packeted}; pending reviews: ${feedbackCaseDomainReviewPackets.summary.pending_review_packets}; national feedback release ready from packets: ${feedbackCaseDomainReviewPackets.summary.ready_for_national_feedback_release_from_packets}.`), 'National scale readiness goal must reflect feedback case-domain review packet status');
assert(nationalScaleGoalMarkdown.includes(`- Feedback case-domain calibration reviews submitted: ${feedbackCaseDomainCalibrationReviewStatus.summary.submitted_case_domain_reviews}; valid reviews: ${feedbackCaseDomainCalibrationReviewStatus.summary.valid_case_domain_reviews}; pending calibration reviews: ${feedbackCaseDomainCalibrationReviewStatus.summary.pending_case_domain_reviews}; national feedback release ready from calibration status: ${feedbackCaseDomainCalibrationReviewStatus.summary.ready_for_national_feedback_release}.`), 'National scale readiness goal must reflect feedback case-domain calibration review status');
assert(nationalScaleGoalMarkdown.includes(`- Weaknesses tracked: ${weaknessRegister.summary.total_weaknesses}; local runtime mitigations verified: ${weaknessRegister.summary.local_runtime_mitigations_verified}.`), 'National scale readiness goal must reflect weakness register status');
assert(nationalScaleGoalMarkdown.includes('## Next Implementation Roadmap'), 'National scale readiness goal must include an implementation roadmap');
assert(nationalScaleGoalMarkdown.includes('## Current Blockers That Prevent Goal Completion'), 'National scale readiness goal must include current blockers');
assert(gateStatus(report, 'feedback_integrity') === 'partial', 'Feedback integrity should remain partial until all feedback traceability gaps are closed');
assert(report.metrics.feedback_integrity.source_limited_diagnosis_excluded_from_numeric_score === true, 'Source-limited diagnosis must be excluded from numeric score');
assert(report.metrics.feedback_integrity.source_limited_reassessment_status_present === true, 'Source-limited reassessment status must be present');
assert(report.metrics.feedback_integrity.source_limited_reassessment_excluded_from_numeric_score === true, 'Source-limited reassessment must be excluded from numeric score');
assert(report.metrics.feedback_integrity.source_limited_domain_label_present === true, 'Feedback UI must label source-limited domains as formative only');
assert(gateStatus(report, 'case_truth') === 'fail', 'Case truth gate must fail while clinician review packets are pending');
assert(gateStatus(report, 'case_generation_quality') === 'partial', 'Case generation quality should remain partial while clinician truth gaps and national-release eligibility gaps remain');
assert(gateStatus(report, 'open_evidence_grounding') === 'fail', 'Open evidence gate must fail while generated evidence remains unreviewed');
assert(gateStatus(report, 'educational_validity') === 'partial', 'Educational validity should remain partial until objectives and outcomes are externally validated');
assert(gateStatus(report, 'learner_safety') === 'partial', 'Learner safety should remain partial until red-team probes are run and reviewed');
assert(gateStatus(report, 'equity_bias_readiness') === 'partial', 'Equity/bias readiness should remain partial until case-level equity review is complete');
assert(gateStatus(report, 'scale_governance_accessibility') === 'partial', 'Scale/governance/accessibility should remain partial until institutional review and operational evidence are complete');

assert(weaknessRegister.schema_version === 'national_readiness_weakness_register_v1', 'Unexpected national weakness register schema');
assert(weaknessRegister.review_status === 'weakness_register_open_improvements_prioritized', 'Weakness register must remain an open prioritized improvement tracker');
assert(weaknessRegister.summary.minimum_required_weaknesses === 40, 'Weakness register must encode the 40-weakness minimum');
assert(weaknessRegister.summary.total_weaknesses >= 40, 'Weakness register must track at least 40 weaknesses');
assert(weaknessRegister.summary.weakness_count_requirement_met === true, 'Weakness register must satisfy the 40-weakness requirement');
assert(weaknessRegister.summary.blocks_national_release_without_review >= 40, 'Weakness register must identify at least 40 national-release review blockers');
assert(weaknessRegister.source_contract.source_audit_rows_found === weaknessRegister.summary.total_weaknesses, 'Weakness register row count must align with source audit rows');
assert(weaknessRegister.source_contract.national_readiness_report_present === true, 'Weakness register must point to the national readiness report');
assert(weaknessRegister.source_contract.national_readiness_verdict === report.verdict, 'Weakness register readiness verdict must align with the national report');
assert(weaknessRegister.source_contract.medical_education_validation_rubric_present === true, 'Weakness register must point to the medical education validation rubric');
assert(weaknessRegister.source_contract.medical_education_validation_criteria === rubric.summary.total_criteria, 'Weakness register rubric criterion count must align with the rubric artifact');
assert(weaknessRegister.summary.local_runtime_mitigations_verified >= 13, 'Weakness register must expose runtime-verified local mitigations from this readiness pass');
for (const gateId of ['case_truth', 'open_evidence_grounding', 'feedback_integrity', 'educational_validity', 'learner_safety', 'scale_governance_accessibility']) {
  assert(weaknessRegister.summary.readiness_gate_counts[gateId] > 0, `Weakness register missing entries for gate ${gateId}`);
}
const weaknessIds = new Set(weaknessRegister.weaknesses.map((item) => item.id));
assert(weaknessIds.size === weaknessRegister.weaknesses.length, 'Weakness register IDs must be unique');
assert(
  weaknessRegister.weaknesses.every((item) => item.current_weakness && item.needed_improvement && item.priority && item.readiness_gate),
  'Every weakness register row must include weakness, improvement, priority, and gate metadata'
);

assert(objectiveMatrix.schema_version === 'case_objective_matrix_v1', 'Unexpected case objective matrix schema');
assert(objectiveMatrix.summary.mapped_cases === cases.length, 'Objective matrix must map every current case');
assert(objectiveMatrix.summary.reviewed_objective_cases === 0, 'Draft objective matrix must not claim reviewed objective cases');
assert(report.metrics.cases.missing_learning_objectives === 0, 'Every case record must expose draft learning objectives for curriculum scaffolding');
assert(report.metrics.educational_validity.case_record_learning_objectives_missing === 0, 'Readiness report must show zero case records missing learning objectives');
for (const caseRecord of cases) {
  assert(Array.isArray(caseRecord.learning_objectives), `Case ${caseRecord.id} missing learning_objectives`);
  assert(caseRecord.learning_objectives.length >= 4, `Case ${caseRecord.id} must include draft objectives across the core reasoning domains`);
  assert(
    caseRecord.learning_objectives.every((objective) => objective.review_status === 'draft_needs_clinician_educator_review'),
    `Case ${caseRecord.id} learning objectives must remain draft until clinician/educator review`
  );
  const objectiveDomains = new Set(caseRecord.learning_objectives.map((objective) => objective.domain));
  for (const domain of ['noticing', 'interpreting', 'responding', 'reflecting']) {
    assert(objectiveDomains.has(domain), `Case ${caseRecord.id} missing ${domain} learning objective`);
  }
}
for (const caseId of caseIds) {
  assert(objectiveIds.has(caseId), `Objective matrix missing case ${caseId}`);
}

assert(truthPackets.schema_version === 'case_truth_review_packets_v1', 'Unexpected case truth packet schema');
assert(truthPackets.summary.total_packets === cases.length, 'Case truth packet count must match case count');
assert(truthPackets.summary.reviewed_case_truth_packets === 0, 'Case truth packets must not claim completed clinician review');
assert(truthPackets.summary.pending_case_truth_packets === cases.length, 'Every current case should remain pending clinician truth review');
assert(truthPackets.summary.source_limitations_packeted > 0, 'Case truth packets must expose source limitations for clinician adjudication');
assert(truthPackets.summary.simulation_reveal_scaffolds_packeted === truthPackets.summary.source_limitations_packeted, 'Case truth packets must pair each source limitation with a simulation reveal scaffold');
assert(truthPackets.summary.packets_with_all_source_limitations_scaffolded === cases.length, 'Every case truth packet must scaffold all current source limitations for review');
assert(truthPackets.summary.packets_with_unscaffolded_source_limitations === 0, 'Case truth packets must not leave source limitations without a review scaffold');
assert(truthPackets.summary.truth_decision_prompt_count >= cases.length * 4, 'Case truth packets must include decision prompts for required truth fields');
assert(truthPackets.summary.review_packet_scaffold_completeness_ready === true, 'Case truth packets must be scaffold-complete while still pending clinician review');
assert(truthPackets.case_review_packets.every((packet) => Array.isArray(packet.source_limitations_to_adjudicate)), 'Every case truth packet must include source limitations to adjudicate');
assert(truthPackets.case_review_packets.every((packet) => Array.isArray(packet.simulation_reveal_scaffolds_to_review)), 'Every case truth packet must include simulation reveal scaffolds to review');
assert(truthPackets.case_review_packets.every((packet) => Array.isArray(packet.review_risk_flags)), 'Every case truth packet must include review risk flags');
assert(truthPackets.case_review_packets.every((packet) => Array.isArray(packet.truth_decision_prompts) && packet.truth_decision_prompts.length >= 4), 'Every case truth packet must include truth decision prompts');
for (const caseId of caseIds) {
  assert(truthIds.has(caseId), `Case truth packet missing case ${caseId}`);
}

assert(caseTruthAdjudicationWorklist.schema_version === 'case_truth_adjudication_worklist_v1', 'Unexpected case truth adjudication worklist schema');
assert(caseTruthAdjudicationWorklist.source_contract.case_truth_review_packets_schema === truthPackets.schema_version, 'Case truth worklist must align with truth packet schema');
assert(caseTruthAdjudicationWorklist.source_contract.clinical_review_adjudication_status_schema === clinicalReviewAdjudicationStatus.schema_version, 'Case truth worklist must align with clinical adjudication schema');
assert(caseTruthAdjudicationWorklist.summary.total_work_items === cases.length, 'Case truth worklist must include every current public case');
assert(caseTruthAdjudicationWorklist.summary.current_public_cases === cases.length, 'Case truth worklist case count must match current cases');
assert(caseTruthAdjudicationWorklist.summary.ready_case_truth_adjudications === clinicalReviewAdjudicationStatus.case_truth.ready_case_truth_adjudications, 'Case truth worklist ready adjudication count must align with clinical status');
assert(caseTruthAdjudicationWorklist.summary.pending_case_truth_adjudications === cases.length - clinicalReviewAdjudicationStatus.case_truth.ready_case_truth_adjudications, 'Case truth worklist pending count must align with ready adjudication count');
assert(caseTruthAdjudicationWorklist.summary.high_priority_work_items >= truthPackets.summary.priority_counts.P1_resuscitation_or_time_critical_truth_review, 'Case truth worklist must expose high-priority P1/P2 review work');
assert(caseTruthAdjudicationWorklist.summary.total_release_blockers >= cases.length, 'Case truth worklist must expose per-case release blockers');
assert(caseTruthAdjudicationWorklist.summary.all_current_cases_have_work_item === true, 'Case truth worklist must confirm every case has a work item');
assert(caseTruthAdjudicationWorklist.summary.all_work_items_include_starter_adjudication === true, 'Case truth worklist must include starter adjudications');
assert(caseTruthAdjudicationWorklist.summary.ready_for_national_case_truth_release_from_worklist === false, 'Case truth worklist must not claim national release readiness while adjudications are pending');
assert(report.metrics.cases.case_truth_adjudication_worklist_present === true, 'Readiness report must expose case truth adjudication worklist presence');
assert(report.metrics.cases.case_truth_adjudication_work_items === caseTruthAdjudicationWorklist.summary.total_work_items, 'Readiness report worklist count must align');
assert(report.metrics.cases.case_truth_adjudication_worklist_pending === caseTruthAdjudicationWorklist.summary.pending_case_truth_adjudications, 'Readiness report worklist pending count must align');
assert(report.metrics.cases.case_truth_adjudication_worklist_release_blockers === caseTruthAdjudicationWorklist.summary.total_release_blockers, 'Readiness report worklist blocker count must align');
assert(report.metrics.cases.case_truth_adjudication_worklist_ready_for_national_release === false, 'Readiness report must not claim case-truth worklist release readiness');
assert(caseTruthAdjudicationWorklist.work_items.every((item) => caseIds.has(item.case_id)), 'Every case truth work item must map to a current case');
assert(caseTruthAdjudicationWorklist.work_items.every((item) => item.starter_adjudication?.case_id === item.case_id), 'Every case truth work item must include a same-case starter adjudication');
assert(caseTruthAdjudicationWorklist.work_items.every((item) => item.required_reviewers.includes('emergency_medicine_clinician') && item.required_reviewers.includes('medical_educator')), 'Every case truth work item must require clinician and educator reviewers');

assert(caseGenerationQualityReport.schema_version === 'case_generation_quality_report_v1', 'Unexpected case generation quality report schema');
assert(caseGenerationQualityReport.summary.total_cases === cases.length, 'Case generation quality report must audit every current case');
assert(caseGenerationQualityReport.summary.draft_practice_scaffold_eligible_cases === cases.length, 'Every current case should have a draft-practice scaffold after public-safe simulation reveals are generated');
assert(caseGenerationQualityReport.summary.national_release_eligible_cases === 0, 'No current public case should be national-release eligible before clinician truth adjudication');
assert(caseGenerationQualityReport.summary.national_release_ready === false, 'Case generation quality report must not claim national release readiness');
assert(caseGenerationQualityReport.summary.cases_missing_any_truth_field === cases.length, 'Every current public case should remain missing at least one national-release truth field');
assert(caseGenerationQualityReport.summary.cases_with_missing_source_evidence === cases.length, 'Every current public case should still expose source-evidence limitations');
assert(caseGenerationQualityReport.summary.cases_with_augmentation_issues === 0, 'Reviewed augmentation scaffolds should not have construction-quality gaps');
assert(caseGenerationQualityReport.summary.cases_with_simulation_structuring_gaps === 0, 'Every current public case should have public-safe simulation reveal scaffold coverage');
assert(caseGenerationQualityReport.summary.augmented_grading_reference_fact_count === 0, 'Reviewed teaching inference must not be promoted to public grading reference without clinician adjudication');
assert(caseGenerationQualityReport.criteria.some((criterion) => criterion.id === 'source_record_provenance_complete'), 'Case generation quality criteria must include source provenance');
assert(caseGenerationQualityReport.criteria.some((criterion) => criterion.id === 'truth_fields_adjudicated_for_national_release'), 'Case generation quality criteria must include truth adjudication');
assert(caseBankExpansionStatus.schema_version === 'case_bank_expansion_status_v1', 'Unexpected case bank expansion status schema');
assert(caseBankExpansionStatus.review_status === 'case_bank_coverage_gaps_require_expansion_and_review', 'Case bank expansion status should expose current coverage gaps');
assert(caseBankExpansionStatus.source_contract.case_generation_quality_report_schema === caseGenerationQualityReport.schema_version, 'Case bank expansion status must align with case generation quality schema');
assert(caseBankExpansionStatus.summary.current_cases === cases.length, 'Case bank expansion status case count must match current cases');
assert(caseBankExpansionStatus.summary.national_case_count_minimum === 100, 'Case bank expansion status must encode the 100-case national minimum');
assert(caseBankExpansionStatus.summary.case_count_shortfall === 100 - cases.length, 'Case bank expansion status must expose current case-count shortfall');
assert(caseBankExpansionStatus.summary.national_release_eligible_cases === 0, 'Case bank expansion status must expose zero national-release eligible cases');
assert(caseBankExpansionStatus.summary.case_truth_adjudication_ready_cases === 0, 'Case bank expansion status must expose zero adjudicated-ready cases');
assert(caseBankExpansionStatus.summary.target_gap_count > 0, 'Case bank expansion status must expose target coverage gaps');
assert(caseBankExpansionStatus.summary.recommended_minimum_new_cases >= caseBankExpansionStatus.summary.case_count_shortfall, 'Recommended new cases must cover at least the raw case-count shortfall');
assert(caseBankExpansionStatus.summary.ready_for_national_case_bank_release === false, 'Case bank expansion status must not claim release readiness');
assert(caseBankExpansionStatus.acuity_targets.some((row) => row.id === 'ESI_1' && row.shortfall > 0), 'Case bank expansion status must expose ESI 1 shortfall');
assert(caseBankExpansionStatus.age_band_targets.some((row) => row.id === 'pediatric' && row.current === 0 && row.shortfall > 0), 'Case bank expansion status must expose pediatric case gap');
assert(caseBankExpansionStatus.special_population_targets.some((row) => row.id === 'language_access_or_interpreter_need' && row.current === 0 && row.shortfall > 0), 'Case bank expansion status must expose language-access case gap');
assert(caseBankExpansionStatus.special_population_targets.some((row) => row.id === 'disability_or_communication_accommodation' && row.current === 0 && row.shortfall > 0), 'Case bank expansion status must expose disability/accommodation case gap');
assert(caseBankExpansionPackets.schema_version === 'case_bank_expansion_packets_v1', 'Unexpected case bank expansion packet schema');
assert(
  caseBankExpansionPackets.review_status === 'case_bank_expansion_packets_open_acquisition_and_review_required',
  'Case bank expansion packets must expose open acquisition and review work'
);
assert(caseBankExpansionPackets.source_contract.case_bank_expansion_status_schema === caseBankExpansionStatus.schema_version, 'Case bank expansion packets must align with case bank status schema');
assert(caseBankExpansionPackets.source_contract.generated_or_synthetic_cases_count_for_national_release_without_review === false, 'Case bank expansion packets must not allow generated cases to count without review');
assert(caseBankExpansionPackets.summary.current_cases === caseBankExpansionStatus.summary.current_cases, 'Case bank expansion packets current case count must align');
assert(caseBankExpansionPackets.summary.case_count_shortfall === caseBankExpansionStatus.summary.case_count_shortfall, 'Case bank expansion packets shortfall must align');
assert(caseBankExpansionPackets.summary.target_gap_packets === caseBankExpansionStatus.summary.target_gap_count, 'Case bank expansion packets must packet every target gap');
assert(caseBankExpansionPackets.summary.recommended_minimum_new_cases === caseBankExpansionStatus.summary.recommended_minimum_new_cases, 'Case bank expansion packets recommended new cases must align');
assert(caseBankExpansionPackets.summary.blueprint_slots === caseBankExpansionStatus.summary.recommended_minimum_new_cases, 'Case bank expansion blueprint slot count must match recommended minimum new cases');
assert(caseBankExpansionPackets.summary.blueprint_slots_match_recommended_minimum_new_cases === true, 'Case bank expansion packets must prove blueprint count alignment');
assert(caseBankExpansionPackets.summary.all_target_shortfalls_have_blueprint_coverage === true, 'Case bank expansion packets must cover every target shortfall with blueprints');
assert(caseBankExpansionPackets.summary.pending_blueprint_slots === caseBankExpansionPackets.summary.blueprint_slots, 'All case bank expansion blueprints must remain pending until review inputs exist');
assert(caseBankExpansionPackets.summary.ready_for_national_case_bank_release_from_expansion_packets === false, 'Case bank expansion packets must not claim national release readiness');
assert(caseBankExpansionPackets.target_gap_packets.length === caseBankExpansionPackets.summary.target_gap_packets, 'Case bank target gap packet rows must align with summary');
assert(caseBankExpansionPackets.case_blueprint_slots.length === caseBankExpansionPackets.summary.blueprint_slots, 'Case bank blueprint rows must align with summary');
assert(caseBankExpansionPackets.blueprint_gap_coverage.every((row) => row.blueprint_coverage_met), 'Every case bank target shortfall must be covered by blueprint slots');
assert(caseBankExpansionPackets.case_blueprint_slots.every((slot) => slot.release_counting_rule.includes('case truth adjudication')), 'Every case bank blueprint must preserve review-before-counting rule');
assert(caseBankExpansionPackets.release_blockers.some((blocker) => blocker.id === 'case_bank_blueprint_reviews_pending' && blocker.status === 'blocked'), 'Case bank expansion packets must keep blueprint reviews blocked');
assert(caseBankExpansionReviewStatus.schema_version === 'case_bank_expansion_review_status_v1', 'Unexpected case bank expansion review status schema');
assert(
  caseBankExpansionReviewStatus.review_status === 'case_bank_expansion_review_inputs_pending',
  'Case bank expansion review status must remain pending until review inputs exist'
);
assert(caseBankExpansionReviewStatus.source_contract.case_bank_expansion_status_schema === caseBankExpansionStatus.schema_version, 'Case bank expansion review status must align with case bank status schema');
assert(caseBankExpansionReviewStatus.source_contract.case_bank_expansion_packets_schema === caseBankExpansionPackets.schema_version, 'Case bank expansion review status must align with packet schema');
assert(caseBankExpansionReviewStatus.source_contract.case_generation_quality_report_schema === caseGenerationQualityReport.schema_version, 'Case bank expansion review status must align with case generation quality schema');
assert(caseBankExpansionReviewStatus.source_contract.completed_review_file_present === false, 'Case bank expansion review status must not claim completed review file presence');
assert(caseBankExpansionReviewStatus.source_contract.required_completed_review_schema_version === 'case_bank_expansion_reviews_v1', 'Case bank expansion review status must encode completed-review schema');
assert(caseBankExpansionReviewStatus.source_contract.generated_or_synthetic_cases_count_for_national_release_without_review === false, 'Case bank expansion review status must block generated/synthetic cases from counting without review');
assert(caseBankExpansionReviewStatus.summary.blueprint_slots === caseBankExpansionPackets.summary.blueprint_slots, 'Case bank expansion review status blueprint count must match packet slots');
assert(caseBankExpansionReviewStatus.blueprint_review_status.length === caseBankExpansionPackets.summary.blueprint_slots, 'Case bank expansion review status rows must cover every blueprint slot');
assert(caseBankExpansionReviewStatus.summary.target_gap_packets === caseBankExpansionPackets.summary.target_gap_packets, 'Case bank expansion review status must align target gap count');
assert(caseBankExpansionReviewStatus.summary.submitted_blueprint_reviews === 0, 'Case bank expansion review status must not claim submitted blueprint reviews');
assert(caseBankExpansionReviewStatus.summary.valid_blueprint_reviews === 0, 'Case bank expansion review status must not claim valid blueprint reviews');
assert(caseBankExpansionReviewStatus.summary.national_countable_blueprint_reviews === 0, 'Case bank expansion review status must not claim countable blueprint reviews');
assert(caseBankExpansionReviewStatus.summary.pending_blueprint_reviews === caseBankExpansionPackets.summary.blueprint_slots, 'Case bank expansion review status pending count must match blueprint slots');
assert(caseBankExpansionReviewStatus.summary.invalid_review_input_count === 0, 'Missing case bank expansion review inputs should not count as invalid');
assert(caseBankExpansionReviewStatus.summary.all_target_shortfalls_have_blueprint_coverage === true, 'Case bank expansion review status must preserve blueprint coverage evidence');
assert(caseBankExpansionReviewStatus.summary.ready_for_national_case_bank_release_from_reviews === false, 'Case bank expansion review status must not claim national case-bank release readiness');
assert(
  caseBankExpansionReviewStatus.blueprint_review_status.every((row) => row.review_decision === 'not_submitted' && row.valid === false),
  'Current case bank expansion blueprint reviews should remain not submitted'
);
assert(caseBankExpansionReviewStatus.readiness_effect.created_public_case_id_required_for_counting === true, 'Case bank expansion review status must require created public case IDs before counting');
assert(caseBankExpansionReviewStatus.readiness_effect.downstream_review_linkage_required_for_counting === true, 'Case bank expansion review status must require downstream review IDs before counting');
assert(caseBankExpansionReviewStatus.readiness_effect.required_reviewer_role_coverage_enforced === true, 'Case bank expansion review status must enforce required reviewer roles');
assert(report.metrics.case_generation_quality.case_generation_quality_report_present === true, 'Readiness report must include case generation quality status');
assert(report.metrics.case_generation_quality.case_generation_quality_total_cases === cases.length, 'Readiness report case generation quality count must match cases');
assert(report.metrics.case_generation_quality.national_release_eligible_cases === 0, 'Readiness report must expose zero nationally releasable cases');
assert(report.metrics.case_generation_quality.augmented_grading_reference_fact_count === caseGenerationQualityReport.summary.augmented_grading_reference_fact_count, 'Readiness report must expose augmented grading-reference facts');
assert(report.metrics.case_generation_quality.case_bank_expansion_status_present === true, 'Readiness report must include case bank expansion status');
assert(report.metrics.case_generation_quality.case_bank_expansion_packets_present === true, 'Readiness report must include case bank expansion packet status');
assert(report.metrics.case_generation_quality.case_bank_case_count_shortfall === caseBankExpansionStatus.summary.case_count_shortfall, 'Readiness report must expose case bank shortfall');
assert(report.metrics.case_generation_quality.case_bank_target_gap_count === caseBankExpansionStatus.summary.target_gap_count, 'Readiness report must expose case bank target gap count');
assert(report.metrics.case_generation_quality.case_bank_recommended_minimum_new_cases === caseBankExpansionStatus.summary.recommended_minimum_new_cases, 'Readiness report must expose recommended minimum new cases');
assert(report.metrics.case_generation_quality.case_bank_expansion_target_gap_packets === caseBankExpansionPackets.summary.target_gap_packets, 'Readiness report must expose case bank target gap packets');
assert(report.metrics.case_generation_quality.case_bank_expansion_blueprint_slots === caseBankExpansionPackets.summary.blueprint_slots, 'Readiness report must expose case bank blueprint slots');
assert(report.metrics.case_generation_quality.case_bank_expansion_all_target_shortfalls_have_blueprint_coverage === true, 'Readiness report must expose full case bank blueprint coverage');
assert(report.metrics.case_generation_quality.case_bank_expansion_pending_blueprint_slots === caseBankExpansionPackets.summary.pending_blueprint_slots, 'Readiness report must expose pending case bank blueprint slots');
assert(report.metrics.case_generation_quality.case_bank_expansion_review_status_present === true, 'Readiness report must expose case bank expansion review status presence');
assert(report.metrics.case_generation_quality.case_bank_expansion_review_total_blueprint_slots === caseBankExpansionReviewStatus.summary.blueprint_slots, 'Readiness report must expose case bank expansion review blueprint total');
assert(report.metrics.case_generation_quality.case_bank_expansion_submitted_blueprint_reviews === 0, 'Readiness report must expose zero submitted blueprint reviews');
assert(report.metrics.case_generation_quality.case_bank_expansion_valid_blueprint_reviews === 0, 'Readiness report must expose zero valid blueprint reviews');
assert(report.metrics.case_generation_quality.case_bank_expansion_national_countable_blueprint_reviews === 0, 'Readiness report must expose zero countable blueprint reviews');
assert(report.metrics.case_generation_quality.case_bank_expansion_pending_blueprint_reviews === caseBankExpansionReviewStatus.summary.pending_blueprint_reviews, 'Readiness report must expose pending blueprint review count');
assert(report.metrics.case_generation_quality.case_bank_expansion_invalid_review_inputs === 0, 'Readiness report must expose zero invalid case bank expansion review inputs');
assert(report.metrics.case_generation_quality.case_bank_expansion_review_ready_for_national_release === false, 'Readiness report must not claim case bank expansion review release readiness');
assert(report.metrics.case_generation_quality.case_bank_ready_for_national_release === false, 'Readiness report must not claim case bank release readiness');

assert(clinicalReviewAdjudicationStatus.schema_version === 'clinical_review_adjudication_status_v1', 'Unexpected clinical review adjudication status schema');
assert(clinicalReviewAdjudicationStatus.contract.contract_document_present === true, 'Clinical review adjudication contract document must be present');
assert(clinicalReviewAdjudicationStatus.contract.required_case_schema_version === 'case_truth_adjudications_v1', 'Unexpected case adjudication schema contract');
assert(clinicalReviewAdjudicationStatus.contract.required_evidence_schema_version === 'evidence_chunk_adjudications_v1', 'Unexpected evidence adjudication schema contract');
assert(clinicalReviewAdjudicationStatus.readiness_effect.invalid_review_input_count === 0, 'Clinical review adjudication inputs must not have validation errors');
assert(clinicalReviewAdjudicationStatus.case_truth.current_public_cases === cases.length, 'Clinical review adjudication status case count must match current cases');
assert(clinicalReviewAdjudicationStatus.case_truth.review_packets_available === truthPackets.summary.total_packets, 'Clinical review adjudication status must align with truth packet count');
assert(
  clinicalReviewAdjudicationStatus.readiness_effect.case_truth_gate_can_pass_from_current_adjudications
    === (clinicalReviewAdjudicationStatus.case_truth.ready_case_truth_adjudications >= cases.length
      && clinicalReviewAdjudicationStatus.readiness_effect.invalid_review_input_count === 0),
  'Case truth adjudication readiness flag must match completed adjudication counts'
);
assert(report.metrics.cases.clinical_review_adjudication_contract_present === true, 'Readiness report must include clinical review adjudication contract status');
assert(report.metrics.cases.clinical_review_adjudication_issue_count === 0, 'Readiness report must include zero invalid adjudication inputs');

assert(evidenceBacklog.schema_version === 'evidence_review_backlog_v1', 'Unexpected evidence review backlog schema');
assert(evidenceBacklog.quality_report_alignment.count_alignment === true, 'Evidence backlog count must align with quality report');
assert(evidenceBacklog.summary.pending_generated_or_unverified_chunks === report.metrics.evidence.generated_needs_review_count, 'Pending evidence chunk count must match readiness report');
assert(evidenceBacklog.summary.reviewed_generated_chunks === 0, 'Evidence backlog must not claim generated chunks are reviewed');
assert(clinicalReviewAdjudicationStatus.evidence.current_public_chunks === report.metrics.evidence.total_chunks, 'Clinical review adjudication status chunk count must match readiness report');
assert(clinicalReviewAdjudicationStatus.evidence.pending_generated_or_unverified_chunks === evidenceBacklog.summary.pending_generated_or_unverified_chunks, 'Clinical review adjudication evidence count must align with evidence backlog');
assert(report.metrics.evidence.clinical_review_adjudication_contract_present === true, 'Readiness report must include evidence adjudication contract status');
assert(report.metrics.evidence.evidence_adjudication_issue_count === 0, 'Readiness report must include zero invalid evidence adjudication inputs');
assert(openEvidenceGroundingReviewPackets.schema_version === 'open_evidence_grounding_review_packets_v1', 'Unexpected open-evidence grounding packet schema');
assert(
  openEvidenceGroundingReviewPackets.review_status === 'open_evidence_grounding_packets_open_source_review_required',
  'Open-evidence grounding packets must remain open until source review is complete'
);
assert(openEvidenceGroundingReviewPackets.source_contract.evidence_review_backlog_schema === evidenceBacklog.schema_version, 'Open-evidence packets must align with evidence backlog schema');
assert(openEvidenceGroundingReviewPackets.source_contract.evidence_quality_dashboard_schema === evidenceQualityDashboard.schema_version, 'Open-evidence packets must align with evidence dashboard schema');
assert(openEvidenceGroundingReviewPackets.source_contract.source_freshness_review_packets_schema === sourceFreshnessReviewPackets.schema_version, 'Open-evidence packets must align with source freshness packet schema');
assert(openEvidenceGroundingReviewPackets.source_contract.claim_reference_gap_review_packets_schema === claimReferenceGapReviewPackets.schema_version, 'Open-evidence packets must align with claim-reference gap packet schema');
assert(openEvidenceGroundingReviewPackets.source_contract.generated_needs_review_evidence_allowed_for_learner_feedback === false, 'Open-evidence packets must not allow generated evidence as learner-facing support');
assert(openEvidenceGroundingReviewPackets.summary.generated_backlog_review_packets === evidenceBacklog.summary.pending_review_batch_count, 'Open-evidence generated batch packet count must match evidence backlog batches');
assert(openEvidenceGroundingReviewPackets.generated_backlog_review_packets.length === openEvidenceGroundingReviewPackets.summary.generated_backlog_review_packets, 'Open-evidence generated packet rows must align with summary');
assert(openEvidenceGroundingReviewPackets.summary.generated_needs_review_chunks_packeted === evidenceBacklog.summary.pending_generated_or_unverified_chunks, 'Open-evidence packets must cover every generated-needs-review chunk');
assert(openEvidenceGroundingReviewPackets.summary.all_review_batches_packeted === true, 'Open-evidence packets must cover every evidence backlog batch');
assert(openEvidenceGroundingReviewPackets.summary.release_blocker_packets === evidenceQualityDashboard.release_blockers.length, 'Open-evidence release blocker packet count must match dashboard blockers');
assert(openEvidenceGroundingReviewPackets.release_blocker_packets.length === openEvidenceGroundingReviewPackets.summary.release_blocker_packets, 'Open-evidence release blocker rows must align with summary');
assert(openEvidenceGroundingReviewPackets.summary.total_review_packets === openEvidenceGroundingReviewPackets.summary.generated_backlog_review_packets + openEvidenceGroundingReviewPackets.summary.release_blocker_packets, 'Open-evidence packet total must equal backlog plus release blockers');
assert(openEvidenceGroundingReviewPackets.summary.pending_generated_backlog_review_packets === openEvidenceGroundingReviewPackets.summary.generated_backlog_review_packets, 'Current open-evidence backlog packets must remain pending');
assert(openEvidenceGroundingReviewPackets.summary.pending_release_blocker_packets === evidenceQualityDashboard.summary.open_release_blockers, 'Open-evidence pending release blocker count must align with evidence dashboard');
assert(openEvidenceGroundingReviewPackets.summary.pending_review_packets === openEvidenceGroundingReviewPackets.summary.pending_generated_backlog_review_packets + openEvidenceGroundingReviewPackets.summary.pending_release_blocker_packets, 'Open-evidence pending packet count must align');
assert(openEvidenceGroundingReviewPackets.summary.generated_needs_review_evidence_allowed_for_learner_feedback === false, 'Open-evidence packet summary must preserve generated evidence quarantine');
assert(openEvidenceGroundingReviewPackets.summary.ready_for_national_open_evidence_release_from_packets === false, 'Open-evidence packets must not claim national release readiness');
assert(openEvidenceGroundingReviewPackets.summary.high_risk_clinical_safety_packets > 0, 'Open-evidence packets must expose high-risk clinical safety packets');
assert(openEvidenceGroundingReviewPackets.summary.management_or_disposition_safety_packets > 0, 'Open-evidence packets must expose management/disposition safety packets');
assert(openEvidenceGroundingReviewPackets.generated_backlog_review_packets.every((packet) => packet.current_release_use === 'quarantined_not_learner_facing'), 'All generated backlog packets must remain quarantined from learner-facing use');
assert(openEvidenceGroundingReviewPackets.generated_backlog_review_packets.every((packet) => packet.generated_needs_review_chunks_allowed_for_learner_feedback === false), 'Generated backlog packets must not allow learner-facing generated chunks');
assert(openEvidenceGroundingReviewPackets.generated_backlog_review_packets.every((packet) => packet.reviewer_roles_required.includes('emergency_medicine_clinician')), 'Every open-evidence batch packet must require emergency clinician review');
assert(openEvidenceGroundingReviewPackets.generated_backlog_review_packets.every((packet) => packet.reviewer_roles_required.includes('source_or_library_reviewer_for_locator_quality')), 'Every open-evidence batch packet must require source/library review');
assert(openEvidenceGroundingReviewPackets.release_blockers.some((blocker) => blocker.id === 'generated_backlog_batches_pending_review' && blocker.status === 'blocked'), 'Open-evidence packets must block on generated backlog review');
assert(openEvidenceGroundingReviewPackets.release_blockers.some((blocker) => blocker.id === 'open_evidence_release_blockers_pending' && blocker.status === 'blocked'), 'Open-evidence packets must block on evidence dashboard release blockers');
assert(report.metrics.evidence.open_evidence_grounding_review_packets_present === true, 'Readiness report must expose open-evidence grounding packet presence');
assert(report.metrics.evidence.open_evidence_grounding_total_review_packets === openEvidenceGroundingReviewPackets.summary.total_review_packets, 'Readiness report must expose open-evidence packet total');
assert(report.metrics.evidence.open_evidence_grounding_generated_backlog_review_packets === openEvidenceGroundingReviewPackets.summary.generated_backlog_review_packets, 'Readiness report must expose generated backlog packet count');
assert(report.metrics.evidence.open_evidence_grounding_release_blocker_packets === openEvidenceGroundingReviewPackets.summary.release_blocker_packets, 'Readiness report must expose release blocker packet count');
assert(report.metrics.evidence.open_evidence_grounding_pending_review_packets === openEvidenceGroundingReviewPackets.summary.pending_review_packets, 'Readiness report must expose pending open-evidence packet count');
assert(report.metrics.evidence.open_evidence_grounding_generated_chunks_packeted === openEvidenceGroundingReviewPackets.summary.generated_needs_review_chunks_packeted, 'Readiness report must expose packeted generated chunk count');
assert(report.metrics.evidence.open_evidence_grounding_all_review_batches_packeted === true, 'Readiness report must expose all backlog batches as packeted');
assert(report.metrics.evidence.open_evidence_grounding_generated_evidence_allowed_for_learner_feedback === false, 'Readiness report must preserve generated evidence quarantine from packets');
assert(report.metrics.evidence.open_evidence_grounding_ready_for_national_release_from_packets === false, 'Readiness report must not claim open-evidence packet release readiness');
assert(openEvidenceGroundingReviewStatus.schema_version === 'open_evidence_grounding_review_status_v1', 'Unexpected open-evidence grounding review status schema');
assert(
  openEvidenceGroundingReviewStatus.review_status === 'open_evidence_grounding_review_inputs_pending',
  'Open-evidence grounding review status should remain pending without completed review input'
);
assert(openEvidenceGroundingReviewStatus.source_contract.open_evidence_grounding_review_packets_schema === openEvidenceGroundingReviewPackets.schema_version, 'Open-evidence review status must align with grounding packet schema');
assert(openEvidenceGroundingReviewStatus.source_contract.evidence_review_backlog_schema === evidenceBacklog.schema_version, 'Open-evidence review status must align with evidence backlog schema');
assert(openEvidenceGroundingReviewStatus.source_contract.evidence_quality_dashboard_schema === evidenceQualityDashboard.schema_version, 'Open-evidence review status must align with evidence dashboard schema');
assert(openEvidenceGroundingReviewStatus.source_contract.clinical_review_adjudication_status_schema === clinicalReviewAdjudicationStatus.schema_version, 'Open-evidence review status must align with clinical adjudication schema');
assert(openEvidenceGroundingReviewStatus.source_contract.completed_review_file_present === false, 'Open-evidence review status should report no completed review file in the current artifact set');
assert(openEvidenceGroundingReviewStatus.source_contract.required_completed_review_schema === 'open_evidence_grounding_reviews_v1', 'Open-evidence review status must declare the completed-review schema');
assert(openEvidenceGroundingReviewStatus.summary.total_review_packets === openEvidenceGroundingReviewPackets.summary.total_review_packets, 'Open-evidence review status packet total must align with packet artifact');
assert(openEvidenceGroundingReviewStatus.summary.generated_backlog_review_packets === openEvidenceGroundingReviewPackets.summary.generated_backlog_review_packets, 'Open-evidence review status generated packet count must align with packet artifact');
assert(openEvidenceGroundingReviewStatus.summary.release_blocker_review_packets === openEvidenceGroundingReviewPackets.summary.release_blocker_packets, 'Open-evidence review status release blocker count must align with packet artifact');
assert(openEvidenceGroundingReviewStatus.summary.generated_needs_review_chunks_packeted === openEvidenceGroundingReviewPackets.summary.generated_needs_review_chunks_packeted, 'Open-evidence review status generated chunk count must align with packet artifact');
assert(openEvidenceGroundingReviewStatus.summary.generated_or_unverified_chunks_pending_in_backlog === evidenceBacklog.summary.pending_generated_or_unverified_chunks, 'Open-evidence review status backlog count must align with evidence backlog');
assert(openEvidenceGroundingReviewStatus.summary.evidence_dashboard_open_release_blockers === evidenceQualityDashboard.summary.open_release_blockers, 'Open-evidence review status release blocker count must align with evidence dashboard');
assert(openEvidenceGroundingReviewStatus.summary.review_file_present === false, 'Open-evidence review status should report no review file present');
assert(openEvidenceGroundingReviewStatus.summary.submitted_grounding_reviews === 0, 'Open-evidence review status should not claim submitted reviews');
assert(openEvidenceGroundingReviewStatus.summary.valid_grounding_reviews === 0, 'Open-evidence review status should not claim valid reviews');
assert(openEvidenceGroundingReviewStatus.summary.cleared_review_packets === 0, 'Open-evidence review status should not claim cleared packets');
assert(openEvidenceGroundingReviewStatus.summary.pending_review_packets === openEvidenceGroundingReviewPackets.summary.total_review_packets, 'Open-evidence review status should mark every current packet pending');
assert(openEvidenceGroundingReviewStatus.summary.invalid_review_input_count === 0, 'Open-evidence review status should have zero invalid inputs when no review file is present');
assert(openEvidenceGroundingReviewStatus.summary.ready_for_national_open_evidence_release_from_reviews === false, 'Open-evidence review status must not claim national review release readiness');
assert(openEvidenceGroundingReviewStatus.open_evidence_grounding_review_status.length === openEvidenceGroundingReviewPackets.summary.total_review_packets, 'Open-evidence review status rows must align with packet total');
assert(openEvidenceGroundingReviewStatus.open_evidence_grounding_review_status.every((row) => row.review_decision === 'not_submitted' && row.valid === false && row.packet_cleared === false), 'All current open-evidence review status rows should be pending and uncleared');
assert(openEvidenceGroundingReviewStatus.readiness_effect.generated_chunks_remain_quarantined_without_valid_review === true, 'Open-evidence review status must enforce generated chunk quarantine');
assert(openEvidenceGroundingReviewStatus.readiness_effect.release_blocker_clearance_requires_authoritative_artifact === true, 'Open-evidence review status must require authoritative release-blocker clearance');
assert(openEvidenceGroundingReviewStatus.readiness_effect.required_reviewer_role_coverage_enforced === true, 'Open-evidence review status must enforce reviewer role coverage');
assert(openEvidenceGroundingReviewStatus.readiness_effect.restricted_data_leakage_block_enforced === true, 'Open-evidence review status must enforce restricted data blocking');
assert(report.metrics.evidence.open_evidence_grounding_review_status_present === true, 'Readiness report must expose open-evidence grounding review status presence');
assert(report.metrics.evidence.open_evidence_grounding_review_total_packets === openEvidenceGroundingReviewStatus.summary.total_review_packets, 'Readiness report must expose open-evidence grounding review status packet total');
assert(report.metrics.evidence.open_evidence_grounding_review_submitted_reviews === openEvidenceGroundingReviewStatus.summary.submitted_grounding_reviews, 'Readiness report must expose open-evidence grounding submitted reviews');
assert(report.metrics.evidence.open_evidence_grounding_review_valid_reviews === openEvidenceGroundingReviewStatus.summary.valid_grounding_reviews, 'Readiness report must expose open-evidence grounding valid reviews');
assert(report.metrics.evidence.open_evidence_grounding_review_cleared_packets === openEvidenceGroundingReviewStatus.summary.cleared_review_packets, 'Readiness report must expose open-evidence grounding cleared packets');
assert(report.metrics.evidence.open_evidence_grounding_review_pending_packets === openEvidenceGroundingReviewStatus.summary.pending_review_packets, 'Readiness report must expose open-evidence grounding pending packets');
assert(report.metrics.evidence.open_evidence_grounding_review_invalid_inputs === openEvidenceGroundingReviewStatus.summary.invalid_review_input_count, 'Readiness report must expose open-evidence grounding invalid review input count');
assert(report.metrics.evidence.open_evidence_grounding_review_ready_for_national_release === false, 'Readiness report must not claim open-evidence grounding review release readiness');

assert(feedbackTraceabilityMatrix.schema_version === 'feedback_traceability_matrix_v1', 'Unexpected feedback traceability matrix schema');
assert(feedbackTraceabilityMatrix.summary.total_cases === cases.length, 'Feedback traceability matrix must cover every current case');
assert(feedbackTraceabilityMatrix.summary.domains_tracked >= 8, 'Feedback traceability matrix must cover scorecard domains');
assert(feedbackTraceabilityMatrix.summary.total_case_domain_rows === cases.length * feedbackTraceabilityMatrix.summary.domains_tracked, 'Feedback traceability row count must equal cases times domains');
assert(feedbackTraceabilityMatrix.summary.cases_missing_objective_mapping.length === 0, 'Feedback traceability matrix must align with the objective matrix');
assert(feedbackTraceabilityMatrix.summary.cases_with_source_limited_diagnosis === cases.length, 'Current public cases should expose source-limited diagnosis feedback');
assert(feedbackTraceabilityMatrix.summary.cases_with_source_limited_referral === cases.length, 'Current public cases should expose source-limited consult feedback');
assert(feedbackTraceabilityMatrix.summary.cases_with_source_limited_reassessment === cases.length, 'Current public cases should expose source-limited reassessment feedback');
assert(feedbackTraceabilityMatrix.summary.numeric_rows_missing_required_case_evidence === 0, 'Feedback traceability matrix should treat explicit zero/false source fields as evidence, not missing data');
assert(feedbackTraceabilityMatrix.summary.ready_for_national_feedback_release === false, 'Feedback traceability matrix must not claim national feedback release readiness before adjudication');
assert(report.metrics.feedback_integrity.feedback_traceability_matrix_present === true, 'Readiness report must include feedback traceability matrix status');
assert(report.metrics.feedback_integrity.feedback_traceability_cases === cases.length, 'Readiness report feedback traceability case count must match cases');
assert(report.metrics.feedback_integrity.feedback_traceability_source_limited_formative_rows >= cases.length * 3, 'Readiness report must expose source-limited diagnosis, consult, and reassessment traceability');

assert(feedbackIntegrityRuntimeReport.schema_version === 'feedback_integrity_runtime_report_v1', 'Unexpected feedback integrity runtime report schema');
assert(feedbackIntegrityRuntimeReport.review_status === 'feedback_integrity_runtime_passed_manual_review_required', 'Feedback integrity runtime report must pass while still requiring manual review');
assert(feedbackIntegrityRuntimeReport.summary.total_runtime_probes >= 7, 'Feedback integrity runtime report must include source-limited and AI-isolation probes');
assert(feedbackIntegrityRuntimeReport.summary.all_runtime_probes_passed === true, 'Feedback integrity runtime probes must pass');
assert(feedbackIntegrityRuntimeReport.summary.openrouter_calls_before_optional_ai === 0, 'Feedback integrity runtime report must prove no AI debrief auto-request occurred');
assert(feedbackIntegrityRuntimeReport.summary.source_limited_diagnosis_label_present === true, 'Feedback integrity runtime report must prove diagnosis source-limited label rendered');
assert(feedbackIntegrityRuntimeReport.summary.source_limited_consult_label_present === true, 'Feedback integrity runtime report must prove consult source-limited label rendered');
assert(feedbackIntegrityRuntimeReport.summary.source_limited_domains_rendered_formative_only === true, 'Feedback integrity runtime report must prove source-limited domains render formative-only');
assert(feedbackIntegrityRuntimeReport.summary.deterministic_score_ledger_present === true, 'Feedback integrity runtime report must prove deterministic score ledger rendered');
assert(feedbackIntegrityRuntimeReport.summary.optional_ai_draft_separate_surface === true, 'Feedback integrity runtime report must prove optional AI draft surface stays separate');
assert(report.metrics.feedback_integrity.feedback_integrity_runtime_report_present === true, 'Readiness report must include feedback integrity runtime report status');
assert(report.metrics.feedback_integrity.feedback_integrity_runtime_all_probes_passed === true, 'Readiness report must include passing feedback runtime probes');
assert(report.metrics.feedback_integrity.feedback_integrity_runtime_openrouter_calls_before_optional_ai === 0, 'Readiness report must expose zero pre-optional AI calls');

const feedbackCaseDomainTraceRows = feedbackTraceabilityMatrix.case_domain_traceability || [];
const feedbackCaseDomainPacketIds = new Set(feedbackCaseDomainReviewPackets.case_domain_review_packets.map((packet) => `${packet.case_id}:${packet.domain_key}`));
assert(feedbackCaseDomainReviewPackets.schema_version === 'feedback_case_domain_review_packets_v1', 'Unexpected feedback case-domain review packet schema');
assert(
  feedbackCaseDomainReviewPackets.review_status === 'feedback_case_domain_review_packets_open_calibration_review_required',
  'Feedback case-domain review packets must remain open until calibration reviews are complete'
);
assert(feedbackCaseDomainReviewPackets.source_contract.feedback_traceability_matrix_schema === feedbackTraceabilityMatrix.schema_version, 'Feedback case-domain packets must align with traceability matrix schema');
assert(feedbackCaseDomainReviewPackets.source_contract.feedback_claim_entailment_review_packets_schema === feedbackClaimEntailmentReviewPackets.schema_version, 'Feedback case-domain packets must align with claim-entailment packet schema');
assert(feedbackCaseDomainReviewPackets.source_contract.feedback_claim_entailment_adjudication_status_schema === feedbackClaimEntailmentAdjudicationStatus.schema_version, 'Feedback case-domain packets must align with claim adjudication schema');
assert(feedbackCaseDomainReviewPackets.source_contract.feedback_integrity_runtime_report_schema === feedbackIntegrityRuntimeReport.schema_version, 'Feedback case-domain packets must align with runtime probe schema');
assert(feedbackCaseDomainReviewPackets.source_contract.generated_needs_review_evidence_allowed_for_learner_feedback === false, 'Feedback case-domain packets must preserve generated-evidence quarantine');
assert(feedbackCaseDomainReviewPackets.source_contract.optional_ai_allowed_to_change_deterministic_feedback === false, 'Feedback case-domain packets must preserve optional-AI isolation');
assert(feedbackCaseDomainReviewPackets.summary.total_review_packets === feedbackTraceabilityMatrix.summary.total_case_domain_rows, 'Feedback case-domain packet total must match traceability rows');
assert(feedbackCaseDomainReviewPackets.summary.case_domain_review_packets === feedbackCaseDomainReviewPackets.summary.total_review_packets, 'Feedback case-domain packet count must align with total');
assert(feedbackCaseDomainReviewPackets.case_domain_review_packets.length === feedbackCaseDomainReviewPackets.summary.total_review_packets, 'Feedback case-domain packet rows must align with summary');
assert(feedbackCaseDomainReviewPackets.summary.case_count === cases.length, 'Feedback case-domain packets must record current case count');
assert(feedbackCaseDomainReviewPackets.summary.cases_packeted === cases.length, 'Feedback case-domain packets must cover every current case');
assert(feedbackCaseDomainReviewPackets.summary.domain_count === feedbackTraceabilityMatrix.summary.domains_tracked, 'Feedback case-domain packet domain count must align with traceability');
assert(feedbackCaseDomainReviewPackets.summary.domains_packeted === feedbackTraceabilityMatrix.summary.domains_tracked, 'Feedback case-domain packets must cover every feedback domain');
assert(feedbackCaseDomainReviewPackets.summary.all_case_domain_rows_packeted === true, 'Feedback case-domain packets must cover every traceability row');
assert(feedbackCaseDomainReviewPackets.summary.all_cases_packeted === true, 'Feedback case-domain packets must cover all cases');
assert(feedbackCaseDomainReviewPackets.summary.all_domains_packeted === true, 'Feedback case-domain packets must cover all feedback domains');
assert(feedbackCaseDomainReviewPackets.summary.source_limited_packets === feedbackTraceabilityMatrix.summary.source_limited_formative_rows, 'Feedback case-domain source-limited packet count must align with traceability');
assert(feedbackCaseDomainReviewPackets.summary.numeric_packets_missing_required_case_evidence === feedbackTraceabilityMatrix.summary.numeric_rows_missing_required_case_evidence, 'Feedback case-domain numeric missing-evidence count must align with traceability');
assert(feedbackCaseDomainReviewPackets.summary.source_limited_packets_requiring_evidence_review === feedbackCaseDomainReviewPackets.summary.source_limited_packets, 'Every source-limited feedback packet must require evidence review');
assert(feedbackCaseDomainReviewPackets.summary.completed_review_file_present === false, 'Feedback case-domain packets must not claim completed review file presence');
assert(feedbackCaseDomainReviewPackets.summary.submitted_case_domain_reviews === 0, 'Feedback case-domain packets must not claim submitted calibration reviews');
assert(feedbackCaseDomainReviewPackets.summary.valid_case_domain_reviews === 0, 'Feedback case-domain packets must not claim valid calibration reviews');
assert(feedbackCaseDomainReviewPackets.summary.pending_review_packets === feedbackCaseDomainReviewPackets.summary.total_review_packets, 'All feedback case-domain packets must remain pending until review inputs exist');
assert(feedbackCaseDomainReviewPackets.summary.runtime_integrity_probe_passed === true, 'Feedback case-domain packets must reflect passing feedback runtime probes');
assert(feedbackCaseDomainReviewPackets.summary.claim_sets_packeted === feedbackClaimEntailmentReviewPackets.summary.total_claim_sets, 'Feedback case-domain packets must align with claim packet count');
assert(feedbackCaseDomainReviewPackets.summary.claim_sets_reviewed === feedbackClaimEntailmentAdjudicationStatus.summary.valid_claim_reviews, 'Feedback case-domain packets must align with claim review status');
assert(feedbackCaseDomainReviewPackets.summary.ready_for_national_feedback_release_from_packets === false, 'Feedback case-domain packets must not claim national feedback release readiness');
for (const row of feedbackCaseDomainTraceRows) {
  assert(feedbackCaseDomainPacketIds.has(`${row.case_id}:${row.domain_key}`), `Feedback case-domain packets missing ${row.case_id}:${row.domain_key}`);
}
assert(
  feedbackCaseDomainReviewPackets.case_domain_review_packets.every((packet) => packet.reviewer_roles_required.includes('emergency_medicine_clinician')),
  'Every feedback case-domain packet must require emergency clinician review'
);
assert(
  feedbackCaseDomainReviewPackets.case_domain_review_packets.every((packet) => packet.reviewer_roles_required.includes('simulation_educator')),
  'Every feedback case-domain packet must require simulation educator review'
);
assert(
  feedbackCaseDomainReviewPackets.case_domain_review_packets
    .filter((packet) => packet.traceability.traceability_status === 'source_limited_formative_only')
    .every((packet) =>
      packet.reviewer_roles_required.includes('medical_librarian_or_evidence_reviewer')
        && packet.required_reviewer_actions.some((action) => action.includes('formative-only'))
    ),
  'Source-limited feedback case-domain packets must require evidence review and preserve formative-only status'
);
assert(
  feedbackCaseDomainReviewPackets.release_blockers.some((blocker) => blocker.id === 'case_domain_feedback_calibration_reviews_pending' && blocker.status === 'blocked'),
  'Feedback case-domain packets must block on pending calibration reviews'
);
assert(
  feedbackCaseDomainReviewPackets.release_blockers.some((blocker) => blocker.id === 'source_limited_feedback_domains_pending_truth_or_evidence' && blocker.status === 'blocked'),
  'Feedback case-domain packets must block on source-limited truth or evidence gaps'
);
assert(report.metrics.feedback_integrity.feedback_case_domain_review_packets_present === true, 'Readiness report must include feedback case-domain packet presence');
assert(report.metrics.feedback_integrity.feedback_case_domain_total_review_packets === feedbackCaseDomainReviewPackets.summary.total_review_packets, 'Readiness report must expose feedback case-domain packet total');
assert(report.metrics.feedback_integrity.feedback_case_domain_case_domain_packets === feedbackCaseDomainReviewPackets.summary.case_domain_review_packets, 'Readiness report must expose feedback case-domain row count');
assert(report.metrics.feedback_integrity.feedback_case_domain_source_limited_packets === feedbackCaseDomainReviewPackets.summary.source_limited_packets, 'Readiness report must expose source-limited case-domain packets');
assert(report.metrics.feedback_integrity.feedback_case_domain_all_rows_packeted === true, 'Readiness report must expose all feedback case-domain rows as packeted');
assert(report.metrics.feedback_integrity.feedback_case_domain_pending_review_packets === feedbackCaseDomainReviewPackets.summary.pending_review_packets, 'Readiness report must expose pending feedback case-domain reviews');
assert(report.metrics.feedback_integrity.feedback_case_domain_ready_for_national_release_from_packets === false, 'Readiness report must not claim feedback case-domain packet release readiness');

assert(feedbackCaseDomainCalibrationReviewStatus.schema_version === 'feedback_case_domain_calibration_review_status_v1', 'Unexpected feedback case-domain calibration review status schema');
assert(
  feedbackCaseDomainCalibrationReviewStatus.review_status === 'feedback_case_domain_calibration_review_inputs_pending',
  'Feedback case-domain calibration review status must remain pending until review inputs exist'
);
assert(feedbackCaseDomainCalibrationReviewStatus.source_contract.feedback_case_domain_review_packets_schema === feedbackCaseDomainReviewPackets.schema_version, 'Feedback case-domain calibration status must align with packet schema');
assert(feedbackCaseDomainCalibrationReviewStatus.source_contract.feedback_claim_entailment_adjudication_status_schema === feedbackClaimEntailmentAdjudicationStatus.schema_version, 'Feedback case-domain calibration status must align with claim adjudication schema');
assert(feedbackCaseDomainCalibrationReviewStatus.source_contract.feedback_integrity_runtime_report_schema === feedbackIntegrityRuntimeReport.schema_version, 'Feedback case-domain calibration status must align with feedback runtime schema');
assert(feedbackCaseDomainCalibrationReviewStatus.source_contract.completed_review_file_present === false, 'Feedback case-domain calibration status must not claim completed review file presence');
assert(feedbackCaseDomainCalibrationReviewStatus.source_contract.required_completed_review_schema_version === 'feedback_case_domain_calibration_reviews_v1', 'Feedback case-domain calibration status must encode the completed-review schema');
assert(feedbackCaseDomainCalibrationReviewStatus.summary.total_review_packets === feedbackCaseDomainReviewPackets.summary.total_review_packets, 'Feedback case-domain calibration status total must match packet total');
assert(feedbackCaseDomainCalibrationReviewStatus.case_domain_review_status.length === feedbackCaseDomainReviewPackets.summary.total_review_packets, 'Feedback case-domain calibration status rows must cover every packet');
assert(feedbackCaseDomainCalibrationReviewStatus.summary.review_file_present === false, 'Feedback case-domain calibration status must not claim a review file is present');
assert(feedbackCaseDomainCalibrationReviewStatus.summary.submitted_case_domain_reviews === 0, 'Feedback case-domain calibration status must not claim submitted reviews');
assert(feedbackCaseDomainCalibrationReviewStatus.summary.valid_case_domain_reviews === 0, 'Feedback case-domain calibration status must not claim valid reviews');
assert(feedbackCaseDomainCalibrationReviewStatus.summary.nationally_approved_case_domain_reviews === 0, 'Feedback case-domain calibration status must not claim national approvals');
assert(feedbackCaseDomainCalibrationReviewStatus.summary.pending_case_domain_reviews === feedbackCaseDomainReviewPackets.summary.total_review_packets, 'Feedback case-domain calibration status pending count must match packet total');
assert(feedbackCaseDomainCalibrationReviewStatus.summary.invalid_review_input_count === 0, 'Missing feedback case-domain calibration reviews should not count as invalid input');
assert(feedbackCaseDomainCalibrationReviewStatus.summary.runtime_integrity_probe_passed === true, 'Feedback case-domain calibration status must reflect passing runtime probes');
assert(feedbackCaseDomainCalibrationReviewStatus.summary.claim_entailment_ready_for_national_release === feedbackClaimEntailmentAdjudicationStatus.summary.ready_for_national_feedback_release, 'Feedback case-domain calibration status must align with claim-entailment readiness');
assert(feedbackCaseDomainCalibrationReviewStatus.summary.ready_for_national_feedback_release === false, 'Feedback case-domain calibration status must not claim national feedback release readiness');
assert(
  feedbackCaseDomainCalibrationReviewStatus.case_domain_review_status.every((row) => row.review_status === 'not_submitted' && row.valid === false),
  'Current feedback case-domain calibration rows should remain not submitted'
);
assert(
  feedbackCaseDomainCalibrationReviewStatus.readiness_effect.source_limited_national_or_summative_approval_block_enforced === true,
  'Feedback case-domain calibration status must enforce source-limited national/summative approval blocking'
);
assert(
  feedbackCaseDomainCalibrationReviewStatus.readiness_effect.required_reviewer_role_coverage_enforced === true,
  'Feedback case-domain calibration status must enforce required reviewer role coverage'
);
assert(report.metrics.feedback_integrity.feedback_case_domain_calibration_status_present === true, 'Readiness report must include feedback case-domain calibration status presence');
assert(report.metrics.feedback_integrity.feedback_case_domain_calibration_total_review_packets === feedbackCaseDomainCalibrationReviewStatus.summary.total_review_packets, 'Readiness report must expose feedback case-domain calibration packet total');
assert(report.metrics.feedback_integrity.feedback_case_domain_calibration_submitted_reviews === feedbackCaseDomainCalibrationReviewStatus.summary.submitted_case_domain_reviews, 'Readiness report must expose submitted feedback case-domain calibration reviews');
assert(report.metrics.feedback_integrity.feedback_case_domain_calibration_valid_reviews === feedbackCaseDomainCalibrationReviewStatus.summary.valid_case_domain_reviews, 'Readiness report must expose valid feedback case-domain calibration reviews');
assert(report.metrics.feedback_integrity.feedback_case_domain_calibration_pending_reviews === feedbackCaseDomainCalibrationReviewStatus.summary.pending_case_domain_reviews, 'Readiness report must expose pending feedback case-domain calibration reviews');
assert(report.metrics.feedback_integrity.feedback_case_domain_calibration_invalid_review_input_count === 0, 'Readiness report must expose zero invalid feedback case-domain calibration inputs');
assert(report.metrics.feedback_integrity.feedback_case_domain_calibration_ready_for_national_release === false, 'Readiness report must not claim feedback case-domain calibration release readiness');

assert(optionalAiGuardrailRuntimeReport.schema_version === 'optional_ai_guardrail_runtime_report_v1', 'Unexpected optional AI guardrail runtime report schema');
assert(
  optionalAiGuardrailRuntimeReport.review_status === 'optional_ai_guardrail_runtime_passed_manual_review_required',
  'Optional AI guardrail runtime report must pass while still requiring manual review'
);
assert(optionalAiGuardrailRuntimeReport.summary.total_runtime_probes >= 6, 'Optional AI guardrail runtime report must include bad-output and unsafe-prompt probes');
assert(optionalAiGuardrailRuntimeReport.summary.all_runtime_probes_passed === true, 'Optional AI guardrail runtime probes must pass');
assert(optionalAiGuardrailRuntimeReport.summary.openrouter_calls_before_optional_ai === 0, 'Optional AI guardrail report must prove no external AI request before optional AI action');
assert(optionalAiGuardrailRuntimeReport.summary.openrouter_calls_after_bad_ai_debrief === 1, 'Optional AI bad debrief probe should make exactly one external AI request');
assert(
  optionalAiGuardrailRuntimeReport.summary.openrouter_calls_after_unsafe_tutor
    === optionalAiGuardrailRuntimeReport.summary.openrouter_calls_after_bad_ai_debrief,
  'Unsafe tutor prompt must be blocked before an additional external AI request'
);
assert(optionalAiGuardrailRuntimeReport.summary.bad_ai_debrief_blocked === true, 'Optional AI bad debrief must be blocked by grounding guardrails');
assert(optionalAiGuardrailRuntimeReport.summary.bad_ai_debrief_support_quality_issue_visible === true, 'Optional AI bad debrief probe must expose a claim support-quality issue');
assert(optionalAiGuardrailRuntimeReport.summary.bad_ai_debrief_content_not_rendered === true, 'Optional AI bad debrief content must not render as learner guidance');
assert(optionalAiGuardrailRuntimeReport.summary.unsafe_tutor_blocked_before_external_ai === true, 'Unsafe tutor prompt must be blocked before external AI');
assert(optionalAiGuardrailRuntimeReport.summary.deterministic_debrief_preserved_after_optional_ai_guardrails === true, 'Deterministic debrief must survive optional AI guardrail failures');
assert(report.metrics.feedback_integrity.optional_ai_guardrail_runtime_report_present === true, 'Readiness report must include optional AI guardrail runtime report status');
assert(report.metrics.feedback_integrity.optional_ai_guardrail_runtime_all_probes_passed === true, 'Readiness report must include passing optional AI guardrail probes');
assert(report.metrics.feedback_integrity.optional_ai_guardrail_openrouter_calls_before_optional_ai === 0, 'Readiness report must expose zero pre-optional-AI guardrail calls');
assert(report.metrics.feedback_integrity.optional_ai_guardrail_bad_ai_debrief_blocked === true, 'Readiness report must expose blocked bad optional AI debrief output');
assert(report.metrics.feedback_integrity.optional_ai_guardrail_bad_ai_support_quality_issue_visible === true, 'Readiness report must expose optional AI support-quality issue visibility');
assert(report.metrics.feedback_integrity.optional_ai_guardrail_bad_ai_debrief_content_not_rendered === true, 'Readiness report must expose non-rendering of bad optional AI output');
assert(report.metrics.feedback_integrity.optional_ai_guardrail_unsafe_tutor_blocked_before_external_ai === true, 'Readiness report must expose unsafe tutor blocking before external AI');
assert(report.metrics.feedback_integrity.optional_ai_guardrail_deterministic_debrief_preserved === true, 'Readiness report must expose deterministic debrief preservation after optional AI guardrails');

const feedbackDomainKeys = new Set(feedbackTraceabilityMatrix.domain_summary.map((domain) => domain.domain_key));
const claimPacketDomainKeys = new Set(feedbackClaimEntailmentReviewPackets.claim_review_packets.map((packet) => packet.domain_key));
assert(feedbackClaimEntailmentReviewPackets.schema_version === 'feedback_claim_entailment_review_packets_v1', 'Unexpected feedback claim-entailment packet schema');
assert(
  feedbackClaimEntailmentReviewPackets.review_status === 'draft_claim_entailment_packets_need_clinician_educator_review',
  'Feedback claim-entailment packets must require clinician and educator review'
);
assert(
  feedbackClaimEntailmentReviewPackets.summary.total_claim_sets === feedbackTraceabilityMatrix.summary.domains_tracked,
  'Claim-entailment packet count must match feedback traceability domains'
);
assert(
  feedbackClaimEntailmentReviewPackets.summary.total_case_domain_rows === feedbackTraceabilityMatrix.summary.total_case_domain_rows,
  'Claim-entailment packets must cover every feedback traceability row'
);
assert(
  feedbackClaimEntailmentReviewPackets.summary.source_limited_case_domain_rows === feedbackTraceabilityMatrix.summary.source_limited_formative_rows,
  'Claim-entailment packet source-limited row count must align with feedback traceability'
);
assert(feedbackClaimEntailmentReviewPackets.summary.source_limited_claim_sets >= 3, 'Claim-entailment packets must expose source-limited diagnosis, consult, and reassessment domains');
assert(feedbackClaimEntailmentReviewPackets.summary.completed_review_file_present === false, 'Claim-entailment packets must not claim completed review file presence');
assert(feedbackClaimEntailmentReviewPackets.summary.reviewed_claim_sets === 0, 'Claim-entailment packets must not claim completed claim review');
assert(feedbackClaimEntailmentReviewPackets.summary.claim_sets_ready_for_national_release === 0, 'Claim-entailment packets must not claim nationally releasable feedback claims');
assert(feedbackClaimEntailmentReviewPackets.summary.ready_for_national_feedback_release === false, 'Claim-entailment packets must not claim national feedback release readiness');
assert(feedbackClaimEntailmentReviewPackets.claim_review_packets.length === feedbackClaimEntailmentReviewPackets.summary.total_claim_sets, 'Claim-entailment packet list must align with summary');
for (const domainKey of feedbackDomainKeys) {
  assert(claimPacketDomainKeys.has(domainKey), `Claim-entailment packets missing domain ${domainKey}`);
}
assert(
  feedbackClaimEntailmentReviewPackets.claim_review_packets.every((packet) => packet.reviewer_roles.includes('simulation_educator')),
  'Every claim-entailment packet must require simulation educator review'
);
assert(
  feedbackClaimEntailmentReviewPackets.release_blockers.some((blocker) => blocker.id === 'claim_entailment_reviews_missing' && blocker.status === 'blocked'),
  'Claim-entailment packet artifact must expose missing review as a blocked release condition'
);
assert(report.metrics.feedback_integrity.feedback_claim_entailment_packets_present === true, 'Readiness report must include feedback claim-entailment packet status');
assert(report.metrics.feedback_integrity.feedback_claim_entailment_total_claim_sets === feedbackTraceabilityMatrix.summary.domains_tracked, 'Readiness report claim-entailment packet count must match scorecard domains');
assert(report.metrics.feedback_integrity.feedback_claim_entailment_reviewed_claim_sets === 0, 'Readiness report must not claim completed feedback claim review');

assert(feedbackClaimReferenceAlignmentReport.schema_version === 'feedback_claim_reference_alignment_report_v1', 'Unexpected feedback claim reference alignment report schema');
assert(
  feedbackClaimReferenceAlignmentReport.review_status === 'claim_reference_alignment_gaps_found_manual_review_required',
  'Feedback claim reference alignment report must expose current review-required gaps'
);
assert(feedbackClaimReferenceAlignmentReport.source_contract.quote_backed_only === true, 'Claim reference alignment must use quote-backed-only candidates');
assert(feedbackClaimReferenceAlignmentReport.source_contract.allow_generated_needs_review === false, 'Claim reference alignment must not allow generated-needs-review candidates');
assert(feedbackClaimReferenceAlignmentReport.source_contract.generated_needs_review_approved_by_this_report === 0, 'Claim reference alignment must not approve generated evidence');
assert(
  feedbackClaimReferenceAlignmentReport.summary.total_claim_sets === feedbackClaimEntailmentReviewPackets.summary.total_claim_sets,
  'Claim reference alignment must cover every claim-entailment packet'
);
assert(
  feedbackClaimReferenceAlignmentReport.summary.claim_sets_with_candidate_quote_backed_references === feedbackClaimReferenceAlignmentReport.summary.total_claim_sets,
  'Every current claim set should have deterministic quote-backed reviewer candidates'
);
assert(feedbackClaimReferenceAlignmentReport.summary.claim_sets_requiring_domain_specific_quote_support >= 1, 'Claim reference alignment must identify named-standard claim sets requiring domain-specific support');
assert(feedbackClaimReferenceAlignmentReport.summary.claim_sets_missing_domain_specific_quote_support >= 1, 'Claim reference alignment must expose missing domain-specific quote support gaps');
assert(feedbackClaimReferenceAlignmentReport.summary.domain_specific_quote_support_release_ready === false, 'Domain-specific quote support must not be release-ready while ESI standard support is generated-needs-review only');
const esiClaimReferenceAlignment = feedbackClaimReferenceAlignmentReport.claim_set_alignment.find((row) => row.domain_key === 'esi');
assert(Boolean(esiClaimReferenceAlignment), 'Claim reference alignment must include the ESI claim set');
assert(esiClaimReferenceAlignment.domain_specific_quote_support_required === true, 'ESI claim set must require domain-specific quote support');
assert(esiClaimReferenceAlignment.domain_specific_quote_support_met === false, 'ESI claim set must expose the missing quote-backed ESI-standard support gap');
assert(esiClaimReferenceAlignment.aligned_quote_backed_references === 0, 'ESI claim set must not count unrelated quote-backed references as aligned standard support');
assert(esiClaimReferenceAlignment.blockers.includes('domain_specific_quote_support_gap'), 'ESI claim set must include a domain-specific quote-support blocker');
assert(feedbackClaimReferenceAlignmentReport.summary.generated_needs_review_references_returned === 0, 'Claim reference alignment must return zero generated-needs-review references');
assert(feedbackClaimReferenceAlignmentReport.summary.source_limited_claim_sets_blocked === feedbackClaimEntailmentReviewPackets.summary.source_limited_claim_sets, 'Claim reference alignment must preserve source-limited truth blockers');
assert(feedbackClaimReferenceAlignmentReport.summary.claim_reference_alignment_release_ready === false, 'Claim reference alignment must not claim national release readiness');
assert(feedbackClaimReferenceAlignmentReport.claim_set_alignment.length === feedbackClaimReferenceAlignmentReport.summary.total_claim_sets, 'Claim reference alignment rows must align with summary');
assert(feedbackClaimReferenceAlignmentReport.claim_set_alignment.every((row) => row.release_ready === false), 'Claim reference alignment rows must preserve review-required release blocking');
assert(report.metrics.evidence.claim_reference_alignment_report_present === true, 'Readiness report must include claim reference alignment report status');
assert(report.metrics.evidence.claim_reference_alignment_claim_sets === feedbackClaimReferenceAlignmentReport.summary.total_claim_sets, 'Readiness report claim reference alignment count must align');
assert(report.metrics.evidence.claim_reference_alignment_claim_sets_meeting_threshold === feedbackClaimReferenceAlignmentReport.summary.claim_sets_meeting_minimum_reference_threshold, 'Readiness report claim reference threshold count must align');
assert(report.metrics.evidence.claim_reference_alignment_claim_sets_missing_domain_specific_support === feedbackClaimReferenceAlignmentReport.summary.claim_sets_missing_domain_specific_quote_support, 'Readiness report must expose claim-reference domain-specific support gaps');
assert(report.metrics.evidence.claim_reference_alignment_domain_specific_release_ready === false, 'Readiness report must not claim domain-specific claim-reference support readiness');
assert(report.metrics.evidence.claim_reference_alignment_generated_needs_review_references_returned === 0, 'Readiness report must expose zero generated claim-alignment references');
assert(report.metrics.evidence.claim_reference_alignment_release_ready === false, 'Readiness report must not claim claim-reference alignment release readiness');

assert(claimReferenceGapReviewPackets.schema_version === 'claim_reference_gap_review_packets_v1', 'Unexpected claim reference gap packet schema');
assert(
  claimReferenceGapReviewPackets.review_status === 'domain_specific_claim_reference_gaps_packeted_manual_review_required',
  'Claim reference gap packets must expose current manual review requirement'
);
assert(claimReferenceGapReviewPackets.source_contract.feedback_claim_reference_alignment_report_schema === feedbackClaimReferenceAlignmentReport.schema_version, 'Claim reference gap packets must align with reference alignment schema');
assert(claimReferenceGapReviewPackets.source_contract.generated_needs_review_evidence_allowed_for_learner_feedback === false, 'Claim reference gap packets must not allow generated evidence as learner-facing support');
assert(claimReferenceGapReviewPackets.summary.total_gap_packets === feedbackClaimReferenceAlignmentReport.summary.claim_sets_missing_domain_specific_quote_support, 'Claim reference gap packet count must match missing domain-specific support count');
assert(claimReferenceGapReviewPackets.summary.domain_specific_gap_packets === claimReferenceGapReviewPackets.summary.total_gap_packets, 'Every current claim reference gap packet should be domain-specific');
assert(claimReferenceGapReviewPackets.summary.all_domain_specific_gaps_packeted === true, 'All current domain-specific claim reference gaps must be packeted');
assert(claimReferenceGapReviewPackets.summary.generated_needs_review_candidate_chunks_packeted >= 160, 'Claim reference gap packets must expose the quarantined generated ESI candidate backlog');
assert(claimReferenceGapReviewPackets.summary.gap_packets_with_zero_quote_backed_domain_specific_refs >= 1, 'Claim reference gap packets must expose zero quote-backed ESI-standard support');
assert(claimReferenceGapReviewPackets.summary.pending_gap_packets === claimReferenceGapReviewPackets.summary.total_gap_packets, 'Claim reference gap packets must remain pending until review inputs exist');
assert(claimReferenceGapReviewPackets.summary.ready_for_national_feedback_release_from_gap_review === false, 'Claim reference gap packets must not claim national feedback release readiness');
const esiClaimReferenceGapPacket = claimReferenceGapReviewPackets.claim_reference_gap_packets.find((packet) => packet.domain_key === 'esi');
assert(Boolean(esiClaimReferenceGapPacket), 'Claim reference gap packets must include the ESI gap');
assert(esiClaimReferenceGapPacket.blocker_summary.domain_specific_quote_backed_references === 0, 'ESI gap packet must expose zero domain-specific quote-backed references');
assert(esiClaimReferenceGapPacket.current_evidence_state.generated_needs_review_domain_specific_chunks_available >= 160, 'ESI gap packet must expose the generated-needs-review ESI candidate backlog');
assert(esiClaimReferenceGapPacket.current_evidence_state.generated_needs_review_chunks_must_remain_quarantined === true, 'ESI generated candidates must remain quarantined');
assert(esiClaimReferenceGapPacket.standard_support_requirement.expected_topic_tags.includes('esi'), 'ESI gap packet must encode ESI as the expected topic');
assert(esiClaimReferenceGapPacket.required_reviewer_actions.some((action) => action.includes('quote-backed public ESI')), 'ESI gap packet must direct reviewers to quote-backed ESI evidence or a local standard');
assert(report.metrics.evidence.claim_reference_gap_packets_present === true, 'Readiness report must expose claim reference gap packet presence');
assert(report.metrics.evidence.claim_reference_gap_packets_total === claimReferenceGapReviewPackets.summary.total_gap_packets, 'Readiness report claim-reference gap count must align');
assert(report.metrics.evidence.claim_reference_gap_packets_all_domain_specific_gaps_packeted === true, 'Readiness report must expose all domain-specific claim-reference gaps as packeted');
assert(report.metrics.evidence.claim_reference_gap_packets_generated_candidates === claimReferenceGapReviewPackets.summary.generated_needs_review_candidate_chunks_packeted, 'Readiness report must expose generated candidate count from claim-reference gap packets');
assert(claimReferenceGapReviewStatus.schema_version === 'claim_reference_gap_review_status_v1', 'Unexpected claim-reference gap review status schema');
assert(
  claimReferenceGapReviewStatus.review_status === 'claim_reference_gap_review_inputs_pending',
  'Claim-reference gap review status must remain pending until completed review inputs exist'
);
assert(claimReferenceGapReviewStatus.source_contract.claim_reference_gap_review_packets_schema === claimReferenceGapReviewPackets.schema_version, 'Claim-reference gap review status must align with packet schema');
assert(claimReferenceGapReviewStatus.source_contract.feedback_claim_reference_alignment_report_schema === feedbackClaimReferenceAlignmentReport.schema_version, 'Claim-reference gap review status must align with claim-reference alignment schema');
assert(claimReferenceGapReviewStatus.source_contract.feedback_claim_entailment_adjudication_status_schema === feedbackClaimEntailmentAdjudicationStatus.schema_version, 'Claim-reference gap review status must align with claim-entailment adjudication schema');
assert(claimReferenceGapReviewStatus.source_contract.completed_review_file_present === false, 'Claim-reference gap review status must not claim a completed review file');
assert(claimReferenceGapReviewStatus.source_contract.required_completed_review_schema === 'claim_reference_gap_reviews_v1', 'Claim-reference gap review status must declare the completed-review schema');
assert(claimReferenceGapReviewStatus.summary.review_file_present === false, 'Claim-reference gap review status summary must report no review file');
assert(claimReferenceGapReviewStatus.summary.total_gap_packets === claimReferenceGapReviewPackets.summary.total_gap_packets, 'Claim-reference gap review status packet count must align with packet artifact');
assert(claimReferenceGapReviewStatus.summary.submitted_gap_reviews === 0, 'Claim-reference gap review status must not claim submitted reviews');
assert(claimReferenceGapReviewStatus.summary.valid_gap_reviews === 0, 'Claim-reference gap review status must not claim valid reviews');
assert(claimReferenceGapReviewStatus.summary.cleared_gap_packets === 0, 'Claim-reference gap review status must not claim cleared gaps');
assert(claimReferenceGapReviewStatus.summary.national_feedback_approved_gap_packets === 0, 'Claim-reference gap review status must not claim national feedback approvals');
assert(claimReferenceGapReviewStatus.summary.pending_gap_reviews === claimReferenceGapReviewPackets.summary.total_gap_packets, 'Claim-reference gap review status must mark every current gap pending');
assert(claimReferenceGapReviewStatus.summary.invalid_review_input_count === 0, 'Claim-reference gap review status must have zero invalid input when no review file exists');
assert(claimReferenceGapReviewStatus.summary.generated_needs_review_candidate_chunks === claimReferenceGapReviewPackets.summary.generated_needs_review_candidate_chunks_packeted, 'Claim-reference gap review status generated candidate count must align with packet artifact');
assert(claimReferenceGapReviewStatus.summary.alignment_domain_specific_release_ready === false, 'Claim-reference gap review status must expose domain-specific alignment not ready');
assert(claimReferenceGapReviewStatus.summary.claim_reference_alignment_release_ready === false, 'Claim-reference gap review status must expose claim-reference alignment not ready');
assert(claimReferenceGapReviewStatus.summary.claim_entailment_ready_for_national_release === false, 'Claim-reference gap review status must expose claim-entailment not ready');
assert(claimReferenceGapReviewStatus.summary.ready_for_national_feedback_release_from_reviews === false, 'Claim-reference gap review status must not claim national feedback release readiness');
assert(claimReferenceGapReviewStatus.claim_reference_gap_review_status.length === claimReferenceGapReviewPackets.summary.total_gap_packets, 'Claim-reference gap review status rows must align with packet total');
assert(claimReferenceGapReviewStatus.claim_reference_gap_review_status.every((row) => row.evidence_resolution === 'not_submitted' && row.valid === false && row.gap_cleared === false), 'All current claim-reference gap review rows must remain pending and uncleared');
assert(claimReferenceGapReviewStatus.claim_reference_gap_review_status.some((row) => row.domain_key === 'esi' && row.generated_needs_review_candidate_chunks >= 160), 'Claim-reference gap review status must expose the ESI generated candidate backlog');
assert(claimReferenceGapReviewStatus.readiness_effect.named_standard_feedback_remains_blocked_without_domain_specific_support === true, 'Claim-reference gap review status must block named-standard feedback without support');
assert(claimReferenceGapReviewStatus.readiness_effect.generated_candidates_remain_quarantined_without_valid_review === true, 'Claim-reference gap review status must keep generated candidates quarantined');
assert(claimReferenceGapReviewStatus.readiness_effect.required_reviewer_role_coverage_enforced === true, 'Claim-reference gap review status must enforce reviewer role coverage');
assert(claimReferenceGapReviewStatus.readiness_effect.restricted_data_leakage_block_enforced === true, 'Claim-reference gap review status must enforce restricted data blocking');
assert(report.metrics.evidence.claim_reference_gap_review_status_present === true, 'Readiness report must expose claim-reference gap review status presence');
assert(report.metrics.evidence.claim_reference_gap_review_total_packets === claimReferenceGapReviewStatus.summary.total_gap_packets, 'Readiness report must expose claim-reference gap review packet total');
assert(report.metrics.evidence.claim_reference_gap_submitted_reviews === claimReferenceGapReviewStatus.summary.submitted_gap_reviews, 'Readiness report must expose claim-reference gap submitted reviews');
assert(report.metrics.evidence.claim_reference_gap_valid_reviews === claimReferenceGapReviewStatus.summary.valid_gap_reviews, 'Readiness report must expose claim-reference gap valid reviews');
assert(report.metrics.evidence.claim_reference_gap_cleared_packets === claimReferenceGapReviewStatus.summary.cleared_gap_packets, 'Readiness report must expose claim-reference gap cleared packets');
assert(report.metrics.evidence.claim_reference_gap_pending_reviews === claimReferenceGapReviewStatus.summary.pending_gap_reviews, 'Readiness report must expose claim-reference gap pending review count');
assert(report.metrics.evidence.claim_reference_gap_invalid_review_inputs === claimReferenceGapReviewStatus.summary.invalid_review_input_count, 'Readiness report must expose claim-reference gap invalid input count');
assert(report.metrics.evidence.claim_reference_gap_ready_for_national_feedback_release_from_reviews === false, 'Readiness report must not claim claim-reference gap review release readiness');

assert(feedbackClaimEntailmentAdjudicationStatus.schema_version === 'feedback_claim_entailment_adjudication_status_v1', 'Unexpected feedback claim-entailment adjudication status schema');
assert(
  feedbackClaimEntailmentAdjudicationStatus.review_status === 'claim_entailment_review_inputs_pending',
  'Feedback claim-entailment adjudication status must remain pending until review inputs exist'
);
assert(
  feedbackClaimEntailmentAdjudicationStatus.summary.total_claim_sets === feedbackClaimEntailmentReviewPackets.summary.total_claim_sets,
  'Claim-entailment adjudication status must align with packet count'
);
assert(feedbackClaimEntailmentAdjudicationStatus.summary.review_file_present === false, 'Claim-entailment adjudication status must not claim a review file is present');
assert(feedbackClaimEntailmentAdjudicationStatus.summary.submitted_claim_reviews === 0, 'Claim-entailment adjudication status must not claim submitted reviews');
assert(feedbackClaimEntailmentAdjudicationStatus.summary.valid_claim_reviews === 0, 'Claim-entailment adjudication status must not claim valid reviews');
assert(feedbackClaimEntailmentAdjudicationStatus.summary.invalid_review_input_count === 0, 'Missing claim review input should not count as invalid input');
assert(feedbackClaimEntailmentAdjudicationStatus.summary.ready_for_national_feedback_release === false, 'Claim-entailment adjudication status must not claim national feedback release readiness');
assert(
  feedbackClaimEntailmentAdjudicationStatus.domain_review_status.length === feedbackClaimEntailmentReviewPackets.summary.total_claim_sets,
  'Claim-entailment adjudication domain status must cover every packet'
);
assert(
  feedbackClaimEntailmentAdjudicationStatus.domain_review_status.every((row) => row.review_status === 'not_submitted' && row.valid === false),
  'Current claim-entailment domain statuses should remain not submitted'
);
assert(report.metrics.feedback_integrity.feedback_claim_entailment_adjudication_status_present === true, 'Readiness report must include claim-entailment adjudication status presence');
assert(report.metrics.feedback_integrity.feedback_claim_entailment_invalid_review_input_count === 0, 'Readiness report must expose zero invalid claim review inputs');

assert(openEvidenceRuntimeReport.schema_version === 'open_evidence_runtime_policy_report_v1', 'Unexpected open evidence runtime policy report schema');
assert(openEvidenceRuntimeReport.review_status === 'runtime_policy_probe_complete_needs_source_review', 'Open evidence runtime policy report should require source review');
assert(openEvidenceRuntimeReport.summary.total_probes >= 5, 'Open evidence runtime report should include retrieval policy probes');
assert(openEvidenceRuntimeReport.summary.all_policy_probes_passed === true, 'Open evidence runtime policy probes must pass');
assert(openEvidenceRuntimeReport.summary.generated_chunks_quarantined_by_default === true, 'Generated chunks must be quarantined by default');
assert(openEvidenceRuntimeReport.summary.generated_references_returned === 0, 'Generated-needs-review chunks must not be returned by policy probes');
assert(openEvidenceRuntimeReport.summary.clinician_librarian_reviewed_generated_chunks === 0, 'Open evidence runtime report must not claim source review');
assert(report.metrics.evidence.open_evidence_policy_all_probes_passed === true, 'Readiness report must include passing open evidence policy probes');
assert(report.metrics.evidence.generated_chunks_quarantined_by_default === true, 'Readiness report must include generated evidence quarantine');
assert(openEvidenceRetrievalRuntimeReport.schema_version === 'open_evidence_retrieval_runtime_report_v1', 'Unexpected open evidence retrieval runtime report schema');
assert(
  openEvidenceRetrievalRuntimeReport.review_status === 'open_evidence_retrieval_runtime_passed_manual_review_required',
  'Open evidence retrieval runtime report must pass while still requiring manual review'
);
assert(openEvidenceRetrievalRuntimeReport.summary.total_runtime_probes >= 7, 'Open evidence retrieval runtime report must include UI retrieval and scope guardrail probes');
assert(openEvidenceRetrievalRuntimeReport.summary.all_runtime_probes_passed === true, 'Open evidence retrieval runtime probes must pass');
assert(openEvidenceRetrievalRuntimeReport.summary.quote_backed_only_default_enabled === true, 'Quote-backed-only retrieval must stay enabled by default');
assert(openEvidenceRetrievalRuntimeReport.summary.runtime_retrieval_reference_count > 0, 'Runtime retrieval probe should return quote-backed references');
assert(
  openEvidenceRetrievalRuntimeReport.summary.runtime_retrieval_quote_backed_badges
    === openEvidenceRetrievalRuntimeReport.summary.runtime_retrieval_reference_count,
  'Runtime retrieval references must all render quote-backed badges'
);
assert(openEvidenceRetrievalRuntimeReport.summary.generated_needs_review_badges_rendered === 0, 'Runtime retrieval must not render generated-needs-review badges');
assert(openEvidenceRetrievalRuntimeReport.summary.needs_review_badges_rendered === 0, 'Runtime retrieval must not render needs-review badges');
assert(openEvidenceRetrievalRuntimeReport.summary.generated_backlog_quarantine_warning_visible === true, 'Runtime retrieval must show generated backlog quarantine warning');
assert(openEvidenceRetrievalRuntimeReport.summary.smoke_review_items === 0, 'Grounding smoke set must not render review-needed items');
assert(openEvidenceRetrievalRuntimeReport.summary.retrieval_quality_badge_visible === true, 'Runtime retrieval must render a retrieval-quality badge');
assert(openEvidenceRetrievalRuntimeReport.summary.high_risk_retrieval_quality_threshold_passed === true, 'Runtime retrieval must expose a passing high-risk retrieval threshold');
assert(openEvidenceRetrievalRuntimeReport.summary.high_risk_retrieval_quality_minimum_base_score >= 0.08, 'High-risk retrieval minimum base score must be at least 0.08');
assert(
  openEvidenceRetrievalRuntimeReport.summary.high_risk_retrieval_quality_top_base_score
    >= openEvidenceRetrievalRuntimeReport.summary.high_risk_retrieval_quality_minimum_base_score,
  'High-risk retrieval top base score must meet its minimum threshold'
);
assert(openEvidenceRetrievalRuntimeReport.summary.bm25_fallback_badge_visible === true, 'Runtime retrieval must visibly badge BM25 fallback when semantic vectors are not warmed');
assert(openEvidenceRetrievalRuntimeReport.summary.nonclinical_scope_guardrail_warning_visible === true, 'Runtime retrieval must show the nonclinical scope guardrail warning');
assert(openEvidenceRetrievalRuntimeReport.summary.nonclinical_scope_guardrail_reference_count === 0, 'Runtime retrieval must return zero references for nonclinical administrative queries');
assert(report.metrics.evidence.open_evidence_retrieval_runtime_report_present === true, 'Readiness report must include open evidence retrieval runtime report status');
assert(report.metrics.evidence.open_evidence_retrieval_runtime_all_probes_passed === true, 'Readiness report must include passing open evidence retrieval runtime probes');
assert(report.metrics.evidence.open_evidence_runtime_quote_backed_only_default_enabled === true, 'Readiness report must expose quote-backed-only default');
assert(
  report.metrics.evidence.open_evidence_runtime_generated_needs_review_badges_rendered === 0,
  'Readiness report must expose zero generated-needs-review runtime badges'
);
assert(report.metrics.evidence.open_evidence_runtime_smoke_review_items === 0, 'Readiness report must expose zero runtime smoke review items');
assert(report.metrics.evidence.open_evidence_runtime_retrieval_quality_badge_visible === true, 'Readiness report must expose the retrieval-quality badge');
assert(report.metrics.evidence.open_evidence_runtime_high_risk_retrieval_quality_threshold_passed === true, 'Readiness report must expose the passing high-risk retrieval threshold');
assert(report.metrics.evidence.open_evidence_runtime_high_risk_retrieval_quality_minimum_base_score >= 0.08, 'Readiness report must expose the high-risk minimum retrieval score');
assert(
  report.metrics.evidence.open_evidence_runtime_high_risk_retrieval_quality_top_base_score
    >= report.metrics.evidence.open_evidence_runtime_high_risk_retrieval_quality_minimum_base_score,
  'Readiness report must expose a top high-risk retrieval score meeting the threshold'
);
assert(report.metrics.evidence.open_evidence_runtime_bm25_fallback_badge_visible === true, 'Readiness report must expose the BM25 fallback badge visibility');
assert(report.metrics.evidence.open_evidence_runtime_nonclinical_scope_guardrail_warning_visible === true, 'Readiness report must expose the nonclinical scope guardrail warning');
assert(report.metrics.evidence.open_evidence_runtime_nonclinical_scope_guardrail_reference_count === 0, 'Readiness report must expose zero nonclinical scope guardrail references');

assert(sourceLinkQuoteVerificationReport.schema_version === 'source_link_quote_verification_report_v1', 'Unexpected source link quote verification report schema');
assert(
  [
    'source_link_quote_verification_ready_for_evidence_release',
    'source_link_quote_verification_has_fetch_or_match_gaps',
    'source_link_quote_verification_has_record_issues'
  ].includes(sourceLinkQuoteVerificationReport.review_status),
  'Source link quote verification report must use a recognized review status'
);
assert(sourceLinkQuoteVerificationReport.verification_scope.quote_backed_subset_only === true, 'Source link verifier must be scoped to quote-backed learner-facing chunks');
assert(sourceLinkQuoteVerificationReport.verification_scope.generated_needs_review_chunks_approved_by_this_report === 0, 'Source link verifier must not approve generated-needs-review chunks');
assert(sourceLinkQuoteVerificationReport.summary.quote_backed_chunks === openEvidenceRuntimeReport.summary.quote_backed_chunks, 'Source link verifier quote-backed chunk count must align with runtime policy report');
assert(sourceLinkQuoteVerificationReport.summary.quote_records >= sourceLinkQuoteVerificationReport.summary.quote_backed_chunks, 'Source link verifier must cover quote records for quote-backed chunks');
assert(sourceLinkQuoteVerificationReport.summary.unique_source_urls >= 10, 'Source link verifier should cover the current public quote-backed source URL set');
assert(
  sourceLinkQuoteVerificationReport.summary.source_urls_fetch_ok + sourceLinkQuoteVerificationReport.summary.source_urls_fetch_failed
    === sourceLinkQuoteVerificationReport.summary.unique_source_urls,
  'Source link verifier fetch counts must align with unique URLs'
);
assert(sourceLinkQuoteVerificationReport.summary.quote_hash_mismatches === 0, 'Source link verifier must not find quote hash mismatches');
assert(sourceLinkQuoteVerificationReport.summary.quote_records_missing_hash === 0, 'Source link verifier must not find missing quote hashes');
assert(sourceLinkQuoteVerificationReport.summary.quote_records_missing_locator === 0, 'Source link verifier must not find missing quote locators');
assert(sourceLinkQuoteVerificationReport.summary.quote_records_missing_source_url === 0, 'Source link verifier must not find missing quote source URLs');
assert(sourceLinkQuoteVerificationReport.summary.all_quote_hashes_valid === true, 'Source link verifier must prove all quote hashes are valid');
assert(sourceLinkQuoteVerificationReport.summary.all_quote_records_have_locator === true, 'Source link verifier must prove all quote records have locators');
assert(sourceLinkQuoteVerificationReport.summary.all_quote_records_have_source_url === true, 'Source link verifier must prove all quote records have source URLs');
assert(sourceLinkQuoteVerificationReport.summary.quote_records_matched_in_fetched_source > 0, 'Source link verifier should match at least one quote/search phrase in fetched source text');
assert(sourceLinkQuoteVerificationReport.summary.quote_records_without_machine_text_match === sourceLinkQuoteVerificationReport.summary.quote_records - sourceLinkQuoteVerificationReport.summary.quote_records_matched_in_fetched_source, 'Source link verifier must count quote records without machine text matches');
assert(sourceLinkQuoteVerificationReport.summary.quote_records_requiring_repair === sourceLinkQuoteVerificationReport.quote_repair_queue.length, 'Source link verifier repair queue length must align with summary');
assert(sourceLinkQuoteVerificationReport.summary.source_urls_requiring_repair === sourceLinkQuoteVerificationReport.repair_queue_by_source.length, 'Source link verifier source repair queue length must align with summary');
assert(sourceLinkQuoteVerificationReport.summary.quote_records_requiring_repair === 0, 'Current source link verifier must clear quote records needing repair or manual verification');
assert(sourceLinkQuoteVerificationReport.summary.quote_verification_release_ready === true, 'Current source link verifier must claim source-link release readiness after all quote records match fetched source text');
assert(sourceLinkQuoteVerificationReport.readiness_effect.open_evidence_grounding_gate_can_pass_from_current_source_links === true, 'Current source link verifier must clear the source-link portion of the open evidence gate');
assert(sourceLinkQuoteVerificationReport.quote_results.length === sourceLinkQuoteVerificationReport.summary.quote_records, 'Source link verifier quote results must align with summary');
assert(sourceLinkQuoteVerificationReport.source_results.length === sourceLinkQuoteVerificationReport.summary.unique_source_urls, 'Source link verifier source results must align with summary');
assert(report.metrics.evidence.source_link_quote_verification_report_present === true, 'Readiness report must include source link quote verification report status');
assert(report.metrics.evidence.source_link_quote_verification_quote_backed_chunks === sourceLinkQuoteVerificationReport.summary.quote_backed_chunks, 'Readiness report source link quote-backed chunk count must align with verifier');
assert(report.metrics.evidence.source_link_quote_verification_quote_hash_mismatches === 0, 'Readiness report must expose zero quote hash mismatches');
assert(report.metrics.evidence.source_link_quote_verification_quote_records_missing_locator === 0, 'Readiness report must expose zero missing quote locators');
assert(report.metrics.evidence.source_link_quote_verification_quote_records_missing_source_url === 0, 'Readiness report must expose zero missing quote source URLs');
assert(report.metrics.evidence.source_link_quote_verification_quote_records_matched_in_fetched_source > 0, 'Readiness report must expose matched quote/search phrase records');
assert(report.metrics.evidence.source_link_quote_verification_quote_records_requiring_repair === sourceLinkQuoteVerificationReport.summary.quote_records_requiring_repair, 'Readiness report must expose source-link quote repair count');
assert(report.metrics.evidence.source_link_quote_verification_quote_records_without_machine_text_match === sourceLinkQuoteVerificationReport.summary.quote_records_without_machine_text_match, 'Readiness report must expose quote records without machine text match');
assert(report.metrics.evidence.source_link_quote_verification_release_ready === true, 'Readiness report must expose source-link quote verification release readiness');

assert(sourceFreshnessReport.schema_version === 'source_freshness_report_v1', 'Unexpected source freshness report schema');
assert(
  ['source_freshness_policy_gaps_found_manual_review_required', 'source_freshness_policy_passed_manual_review_required'].includes(sourceFreshnessReport.review_status),
  'Source freshness report must use a recognized review status'
);
assert(sourceFreshnessReport.source_contract.public_knowledge_bundle_schema === 'clinical_knowledge_bundle_v2', 'Source freshness report must point to the public knowledge bundle schema');
assert(sourceFreshnessReport.summary.total_sources === report.metrics.evidence.total_sources, 'Source freshness source count must align with readiness evidence metrics');
assert(sourceFreshnessReport.summary.sources_with_publication_year === sourceFreshnessReport.summary.total_sources, 'Every current public source should expose a parseable publication year');
assert(sourceFreshnessReport.summary.learner_facing_quote_backed_sources > 0, 'Source freshness report must cover learner-facing quote-backed sources');
assert(sourceFreshnessReport.summary.missing_local_review_date_sources > 0, 'Source freshness report must expose missing local source review dates in the current bundle');
assert(sourceFreshnessReport.summary.learner_facing_quote_backed_sources_release_blocked > 0, 'Source freshness report must not hide current learner-facing freshness blockers');
assert(sourceFreshnessReport.summary.learner_facing_source_freshness_release_ready === false, 'Source freshness report must not claim current learner-facing freshness release readiness');
assert(sourceFreshnessReport.learner_facing_quote_backed_sources.length === sourceFreshnessReport.summary.learner_facing_quote_backed_sources, 'Source freshness learner-facing source rows must align with summary');
assert(report.metrics.evidence.source_freshness_report_present === true, 'Readiness report must include source freshness report status');
assert(report.metrics.evidence.source_freshness_total_sources === sourceFreshnessReport.summary.total_sources, 'Readiness report source freshness source count must align');
assert(report.metrics.evidence.source_freshness_learner_facing_quote_backed_sources === sourceFreshnessReport.summary.learner_facing_quote_backed_sources, 'Readiness report learner-facing freshness source count must align');
assert(report.metrics.evidence.source_freshness_learner_facing_quote_backed_sources_release_blocked === sourceFreshnessReport.summary.learner_facing_quote_backed_sources_release_blocked, 'Readiness report must expose learner-facing freshness blockers');
assert(report.metrics.evidence.source_freshness_learner_facing_release_ready === false, 'Readiness report must not claim learner-facing source freshness release readiness');

assert(sourceFreshnessReviewPackets.schema_version === 'source_freshness_review_packets_v1', 'Unexpected source freshness review packet schema');
assert(
  ['source_freshness_review_packets_release_blockers_pending', 'source_freshness_review_packets_confirmation_pending'].includes(sourceFreshnessReviewPackets.review_status),
  'Source freshness review packets must use a recognized review status'
);
assert(sourceFreshnessReviewPackets.source_contract.source_freshness_report_schema === 'source_freshness_report_v1', 'Source freshness review packets must point to the source freshness report schema');
assert(sourceFreshnessReviewPackets.summary.total_packets === sourceFreshnessReport.summary.learner_facing_quote_backed_sources, 'Source freshness review packet count must match learner-facing quote-backed sources');
assert(sourceFreshnessReviewPackets.summary.learner_facing_quote_backed_sources === sourceFreshnessReport.summary.learner_facing_quote_backed_sources, 'Source freshness review packet learner-facing count must align');
assert(sourceFreshnessReviewPackets.summary.all_learner_facing_sources_packeted === true, 'Source freshness review packets must cover every learner-facing quote-backed source');
assert(sourceFreshnessReviewPackets.summary.release_blocked_packets === sourceFreshnessReport.summary.learner_facing_quote_backed_sources_release_blocked, 'Source freshness review packets must align with freshness release blockers');
assert(sourceFreshnessReviewPackets.summary.stale_packets === sourceFreshnessReport.summary.stale_learner_facing_quote_backed_sources, 'Source freshness review stale packet count must align');
assert(sourceFreshnessReviewPackets.summary.pending_review_packets === sourceFreshnessReviewPackets.summary.total_packets, 'Current source freshness review packets must remain pending until real review input exists');
assert(sourceFreshnessReviewPackets.summary.ready_for_national_release_from_freshness_review === false, 'Source freshness review packets must not claim national release readiness');
assert(sourceFreshnessReviewPackets.source_review_packets.length === sourceFreshnessReviewPackets.summary.total_packets, 'Source freshness packet rows must align with summary');
assert(sourceFreshnessReviewPackets.source_review_packets.every((packet) => packet.review_status === 'pending_librarian_clinician_source_freshness_review'), 'Every current source freshness packet must remain pending');
assert(report.metrics.evidence.source_freshness_review_packets_present === true, 'Readiness report must include source freshness review packets');
assert(report.metrics.evidence.source_freshness_review_packet_count === sourceFreshnessReviewPackets.summary.total_packets, 'Readiness source freshness packet count must align');
assert(report.metrics.evidence.source_freshness_review_packets_release_blocked === sourceFreshnessReviewPackets.summary.release_blocked_packets, 'Readiness source freshness packet blocker count must align');
assert(report.metrics.evidence.source_freshness_review_packets_alignment === true, 'Readiness report must expose source freshness packet alignment');
assert(report.metrics.evidence.source_freshness_review_ready_for_national_release === false, 'Readiness report must not claim source freshness review national release readiness');

assert(sourceFreshnessAdjudicationStatus.schema_version === 'source_freshness_adjudication_status_v1', 'Unexpected source freshness adjudication status schema');
assert(
  [
    'source_freshness_review_inputs_pending',
    'source_freshness_review_inputs_invalid',
    'source_freshness_review_inputs_partial',
    'source_freshness_review_complete_metadata_or_replacement_updates_required',
    'source_freshness_review_complete_ready_for_readiness_gate'
  ].includes(sourceFreshnessAdjudicationStatus.review_status),
  'Source freshness adjudication status must use a recognized review status'
);
assert(sourceFreshnessAdjudicationStatus.source_contract.source_freshness_report_schema === 'source_freshness_report_v1', 'Source freshness adjudication must point to the source freshness report schema');
assert(sourceFreshnessAdjudicationStatus.source_contract.source_freshness_review_packets_schema === 'source_freshness_review_packets_v1', 'Source freshness adjudication must point to the review packet schema');
assert(sourceFreshnessAdjudicationStatus.summary.total_packets === sourceFreshnessReviewPackets.summary.total_packets, 'Source freshness adjudication packet count must align with review packets');
assert(sourceFreshnessAdjudicationStatus.summary.review_file_present === false, 'Current source freshness adjudication must not claim a completed review input file');
assert(sourceFreshnessAdjudicationStatus.summary.submitted_source_reviews === 0, 'Current source freshness adjudication must not claim submitted reviews');
assert(sourceFreshnessAdjudicationStatus.summary.valid_source_reviews === 0, 'Current source freshness adjudication must not claim valid reviews');
assert(sourceFreshnessAdjudicationStatus.summary.nationally_approved_source_reviews === 0, 'Current source freshness adjudication must not claim nationally approved source reviews');
assert(sourceFreshnessAdjudicationStatus.summary.invalid_review_input_count === 0, 'Missing source freshness review file should not be treated as invalid input');
assert(sourceFreshnessAdjudicationStatus.summary.packets_missing_review === sourceFreshnessReviewPackets.summary.total_packets, 'Every current source freshness packet should remain missing review');
assert(sourceFreshnessAdjudicationStatus.summary.ready_for_national_source_freshness_release === false, 'Source freshness adjudication must not claim national release readiness');
assert(sourceFreshnessAdjudicationStatus.source_review_status.length === sourceFreshnessReviewPackets.summary.total_packets, 'Source freshness adjudication rows must align with review packet count');
assert(sourceFreshnessAdjudicationStatus.readiness_effect.source_freshness_gate_can_pass_from_current_reviews === false, 'Current source freshness reviews must not clear the readiness gate');
assert(report.metrics.evidence.source_freshness_adjudication_status_present === true, 'Readiness report must include source freshness adjudication status');
assert(report.metrics.evidence.source_freshness_adjudication_submitted_reviews === 0, 'Readiness source freshness submitted reviews must align with current missing review file');
assert(report.metrics.evidence.source_freshness_adjudication_valid_reviews === 0, 'Readiness source freshness valid reviews must align with current missing review file');
assert(report.metrics.evidence.source_freshness_adjudication_invalid_review_inputs === 0, 'Readiness source freshness invalid review inputs must align');
assert(report.metrics.evidence.source_freshness_adjudication_packets_missing_review === sourceFreshnessReviewPackets.summary.total_packets, 'Readiness source freshness missing-review count must align');
assert(report.metrics.evidence.source_freshness_adjudication_ready_for_national_release === false, 'Readiness report must not claim source freshness adjudication release readiness');

assert(highRiskQuoteCoverageDepthReport.schema_version === 'high_risk_quote_coverage_depth_report_v1', 'Unexpected high-risk quote coverage depth report schema');
assert(
  highRiskQuoteCoverageDepthReport.review_status === 'high_risk_quote_depth_gaps_found_manual_review_required',
  'High-risk quote coverage depth report must expose current depth gaps'
);
assert(highRiskQuoteCoverageDepthReport.source_contract.quote_backed_only === true, 'High-risk quote depth report must be quote-backed only');
assert(highRiskQuoteCoverageDepthReport.source_contract.generated_needs_review_approved_by_this_report === 0, 'High-risk quote depth report must not approve generated evidence');
assert(highRiskQuoteCoverageDepthReport.summary.high_risk_topic_count === learnerFacingEvidenceCoverageReport.summary.high_risk_topic_count, 'High-risk quote depth topic count must align with learner-facing coverage');
assert(highRiskQuoteCoverageDepthReport.summary.topics_with_any_quote_backed_coverage === learnerFacingEvidenceCoverageReport.summary.high_risk_topics_with_quote_backed_coverage, 'High-risk quote depth any-quote count must align with learner-facing coverage');
const highRiskQuoteDepthHasOpenFacetGaps =
  highRiskQuoteCoverageDepthReport.summary.topics_meeting_core_facet_depth < highRiskQuoteCoverageDepthReport.summary.high_risk_topic_count
  && highRiskQuoteCoverageDepthReport.summary.missing_required_topic_facet_pairs > 0;
const highRiskQuoteDepthCompleteButReviewBlocked =
  highRiskQuoteCoverageDepthReport.summary.topics_meeting_core_facet_depth === highRiskQuoteCoverageDepthReport.summary.high_risk_topic_count
  && highRiskQuoteCoverageDepthReport.summary.missing_required_topic_facet_pairs === 0
  && highRiskQuoteCoverageDepthReport.summary.generated_needs_review_chunks_on_high_risk_topics > 0
  && highRiskQuoteCoverageDepthReport.summary.quote_coverage_depth_release_ready === false;
assert(
  highRiskQuoteDepthHasOpenFacetGaps || highRiskQuoteDepthCompleteButReviewBlocked,
  'High-risk quote depth report must expose either topic/facet gaps or complete depth blocked by generated-review backlog'
);
assert(highRiskQuoteCoverageDepthReport.summary.quote_coverage_depth_release_ready === false, 'High-risk quote depth report must not claim current release readiness');
assert(highRiskQuoteCoverageDepthReport.topic_rows.length === highRiskQuoteCoverageDepthReport.summary.high_risk_topic_count, 'High-risk quote depth topic rows must align with summary');
assert(report.metrics.evidence.high_risk_quote_coverage_depth_report_present === true, 'Readiness report must include high-risk quote coverage depth status');
assert(report.metrics.evidence.high_risk_quote_coverage_depth_topic_count === highRiskQuoteCoverageDepthReport.summary.high_risk_topic_count, 'Readiness report high-risk quote depth topic count must align');
assert(report.metrics.evidence.high_risk_quote_coverage_depth_topics_meeting_core_facet_depth === highRiskQuoteCoverageDepthReport.summary.topics_meeting_core_facet_depth, 'Readiness report high-risk quote depth facet count must align');
assert(report.metrics.evidence.high_risk_quote_coverage_depth_missing_required_topic_facet_pairs === highRiskQuoteCoverageDepthReport.summary.missing_required_topic_facet_pairs, 'Readiness report must expose missing high-risk topic/facet quote pairs');
assert(report.metrics.evidence.high_risk_quote_coverage_depth_release_ready === false, 'Readiness report must not claim high-risk quote depth release readiness');

assert(highRiskClinicalClassificationReport.schema_version === 'high_risk_clinical_classification_report_v1', 'Unexpected high-risk clinical classification report schema');
assert(
  highRiskClinicalClassificationReport.review_status === 'high_risk_classification_policy_ready_manual_review_required',
  'High-risk clinical classification report must expose a ready local policy while preserving manual review'
);
assert(highRiskClinicalClassificationReport.source_contract.generated_needs_review_approved_by_this_report === 0, 'High-risk classification must not approve generated evidence');
assert(highRiskClinicalClassificationReport.source_contract.classifier_service_present === true, 'High-risk classification must point to the runtime classifier service');
assert(highRiskClinicalClassificationReport.source_contract.classifier_service_imports_quality_report === true, 'Runtime classifier must import the source quality report');
assert(highRiskClinicalClassificationReport.source_contract.classifier_service_imports_retrieval_matrix === true, 'Runtime classifier must import the retrieval matrix');
assert(highRiskClinicalClassificationReport.summary.high_risk_topics_from_quality_report === learnerFacingEvidenceCoverageReport.summary.high_risk_topic_count, 'High-risk classification topic count must align with learner-facing coverage');
assert(highRiskClinicalClassificationReport.summary.structured_topic_policy_rows === highRiskClinicalClassificationReport.summary.high_risk_topics_from_quality_report, 'High-risk classification must create a policy row for every high-risk topic');
assert(highRiskClinicalClassificationReport.summary.topics_with_alias_policy === highRiskClinicalClassificationReport.summary.structured_topic_policy_rows, 'Every high-risk topic must have an alias policy');
assert(highRiskClinicalClassificationReport.summary.topics_with_quote_depth_row === highRiskQuoteCoverageDepthReport.summary.high_risk_topic_count, 'High-risk classification must align with quote-depth topic rows');
assert(highRiskClinicalClassificationReport.summary.topic_alias_probes_passed === highRiskClinicalClassificationReport.summary.topic_alias_probes, 'Every high-risk topic alias probe must pass');
assert(highRiskClinicalClassificationReport.summary.retrieval_matrix_rows_passed === highRiskClinicalClassificationReport.summary.retrieval_matrix_rows, 'Every retrieval matrix row must pass structured high-risk classification');
assert(highRiskClinicalClassificationReport.summary.case_rows_classified === cases.length, 'High-risk classification must classify every current public case');
assert(highRiskClinicalClassificationReport.summary.claim_sets_classified === feedbackClaimEntailmentReviewPackets.summary.total_claim_sets, 'High-risk classification must classify every feedback claim set');
assert(highRiskClinicalClassificationReport.summary.negative_controls_classified_nonclinical === highRiskClinicalClassificationReport.summary.negative_control_probes, 'High-risk classification negative controls must remain nonclinical');
assert(highRiskClinicalClassificationReport.summary.regex_fallback_only_high_risk_probes === 0, 'High-risk classification must not rely on fallback-only high-risk probes');
assert(highRiskClinicalClassificationReport.summary.generated_needs_review_approved_by_this_report === 0, 'High-risk classification must approve zero generated-needs-review chunks');
assert(highRiskClinicalClassificationReport.summary.high_risk_classification_policy_ready === true, 'High-risk classification policy must be ready locally');
assert(highRiskClinicalClassificationReport.summary.high_risk_classification_release_ready === false, 'High-risk classification report must not claim national release readiness');
assert(learnerFacingEvidenceCoverageReport.source_contract.high_risk_clinical_classification_report_present === true, 'Learner-facing coverage report must point to the high-risk classification report');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_clinical_classification_report_present === true, 'Learner-facing coverage summary must include high-risk classification report presence');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_clinical_classification_policy_ready === highRiskClinicalClassificationReport.summary.high_risk_classification_policy_ready, 'Learner-facing coverage classification readiness must align with classification report');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_clinical_classification_topic_count === highRiskClinicalClassificationReport.summary.structured_topic_policy_rows, 'Learner-facing coverage classification topic count must align');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_clinical_classification_topic_alias_probes_passed === highRiskClinicalClassificationReport.summary.topic_alias_probes_passed, 'Learner-facing coverage classification probe count must align');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_clinical_classification_retrieval_matrix_rows_passed === highRiskClinicalClassificationReport.summary.retrieval_matrix_rows_passed, 'Learner-facing coverage retrieval classification count must align');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_clinical_classification_case_rows_classified === cases.length, 'Learner-facing coverage classification case count must align');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_clinical_classification_claim_sets_classified === feedbackClaimEntailmentReviewPackets.summary.total_claim_sets, 'Learner-facing coverage classification claim count must align');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_clinical_classification_regex_fallback_only_high_risk_probes === 0, 'Learner-facing coverage must expose zero fallback-only high-risk classification probes');
assert(report.metrics.evidence.high_risk_clinical_classification_report_present === true, 'Readiness report must include high-risk clinical classification status');
assert(report.metrics.evidence.high_risk_clinical_classification_policy_ready === true, 'Readiness report must expose ready high-risk classification policy');
assert(report.metrics.evidence.high_risk_clinical_classification_topic_count === highRiskClinicalClassificationReport.summary.structured_topic_policy_rows, 'Readiness report classification topic count must align');
assert(report.metrics.evidence.high_risk_clinical_classification_claim_sets_classified === feedbackClaimEntailmentReviewPackets.summary.total_claim_sets, 'Readiness report classification claim count must align');
assert(report.metrics.evidence.high_risk_clinical_classification_regex_fallback_only_high_risk_probes === 0, 'Readiness report must expose zero fallback-only high-risk probes');
assert(report.metrics.evidence.high_risk_clinical_classification_generated_needs_review_approved === 0, 'Readiness report must expose zero generated approvals from classification');

assert(openEvidenceTopicRetrievalBenchmark.schema_version === 'open_evidence_topic_retrieval_benchmark_v1', 'Unexpected open evidence topic retrieval benchmark schema');
assert(
  openEvidenceTopicRetrievalBenchmark.review_status === 'topic_retrieval_benchmark_passed_manual_review_required',
  'Open evidence topic retrieval benchmark must pass while still requiring manual review'
);
assert(openEvidenceTopicRetrievalBenchmark.source_contract.quote_backed_only === true, 'Topic retrieval benchmark must require quote-backed references');
assert(openEvidenceTopicRetrievalBenchmark.source_contract.allow_generated_needs_review === false, 'Topic retrieval benchmark must disallow generated-needs-review references');
assert(openEvidenceTopicRetrievalBenchmark.source_contract.generated_needs_review_chunks_approved_by_this_report === 0, 'Topic retrieval benchmark must not approve generated chunks');
assert(openEvidenceTopicRetrievalBenchmark.summary.topic_probes === learnerFacingEvidenceCoverageReport.summary.high_risk_topic_count, 'Topic retrieval benchmark must cover every high-risk topic from learner-facing coverage');
assert(openEvidenceTopicRetrievalBenchmark.summary.negative_control_probes >= 2, 'Topic retrieval benchmark must include negative controls');
assert(openEvidenceTopicRetrievalBenchmark.summary.all_probes_passed === true, 'Topic retrieval benchmark probes must pass');
assert(openEvidenceTopicRetrievalBenchmark.summary.all_high_risk_topics_represented === true, 'Topic retrieval benchmark must represent all high-risk topics');
assert(openEvidenceTopicRetrievalBenchmark.summary.topic_probes_with_quote_backed_reference === openEvidenceTopicRetrievalBenchmark.summary.topic_probes, 'Every topic probe must return quote-backed references');
assert(openEvidenceTopicRetrievalBenchmark.summary.topic_probes_with_expected_topic_reference === openEvidenceTopicRetrievalBenchmark.summary.topic_probes, 'Every topic probe must return an expected-topic reference');
assert(openEvidenceTopicRetrievalBenchmark.summary.topic_probes_with_top_reference_topic_match === openEvidenceTopicRetrievalBenchmark.summary.topic_probes, 'Every topic probe top reference must match its topic');
assert(openEvidenceTopicRetrievalBenchmark.summary.generated_needs_review_references_returned === 0, 'Topic retrieval benchmark must return zero generated-needs-review references');
assert(openEvidenceTopicRetrievalBenchmark.summary.negative_controls_returning_references === 0, 'Topic retrieval benchmark negative controls must not return clinical references');
assert(report.metrics.evidence.open_evidence_topic_retrieval_benchmark_present === true, 'Readiness report must include topic retrieval benchmark status');
assert(report.metrics.evidence.open_evidence_topic_retrieval_all_probes_passed === true, 'Readiness report must expose passing topic retrieval benchmark');
assert(report.metrics.evidence.open_evidence_topic_retrieval_all_high_risk_topics_represented === true, 'Readiness report must expose all high-risk topic coverage in benchmark');
assert(report.metrics.evidence.open_evidence_topic_retrieval_generated_needs_review_references_returned === 0, 'Readiness report must expose zero generated references returned by topic benchmark');
assert(report.metrics.evidence.open_evidence_topic_retrieval_negative_controls_returning_references === 0, 'Readiness report must expose zero negative-control clinical references');

assert(learnerFacingEvidenceCoverageReport.schema_version === 'learner_facing_evidence_coverage_report_v1', 'Unexpected learner-facing evidence coverage report schema');
assert(
  learnerFacingEvidenceCoverageReport.review_status === 'learner_facing_quote_backed_subset_available_claim_review_required',
  'Learner-facing evidence coverage report must require claim review'
);
assert(learnerFacingEvidenceCoverageReport.summary.learner_facing_eligible_quote_backed_chunks > 0, 'Learner-facing evidence coverage report should expose the eligible quote-backed subset');
assert(
  learnerFacingEvidenceCoverageReport.summary.learner_facing_eligible_quote_backed_chunks === openEvidenceRuntimeReport.summary.quote_backed_chunks,
  'Learner-facing eligible quote-backed chunks must align with runtime quote-backed policy count'
);
assert(
  learnerFacingEvidenceCoverageReport.summary.generated_needs_review_chunks === evidenceBacklog.summary.pending_generated_or_unverified_chunks,
  'Learner-facing evidence coverage generated backlog must align with evidence backlog'
);
assert(learnerFacingEvidenceCoverageReport.summary.generated_chunks_quarantined_by_default === true, 'Learner-facing evidence coverage must preserve generated chunk quarantine');
assert(learnerFacingEvidenceCoverageReport.summary.generated_references_returned_by_policy_probes === 0, 'Learner-facing evidence coverage must expose zero generated references returned');
assert(learnerFacingEvidenceCoverageReport.source_contract.open_evidence_retrieval_runtime_report_present === true, 'Learner-facing coverage report must point to the runtime retrieval report');
assert(learnerFacingEvidenceCoverageReport.summary.runtime_retrieval_all_probes_passed === true, 'Learner-facing evidence coverage must expose passing runtime retrieval probes');
assert(learnerFacingEvidenceCoverageReport.summary.runtime_retrieval_quote_backed_only_default === true, 'Learner-facing evidence coverage must expose quote-backed-only runtime default');
assert(learnerFacingEvidenceCoverageReport.summary.runtime_retrieval_reference_count > 0, 'Learner-facing evidence coverage must expose runtime quote-backed references');
assert(learnerFacingEvidenceCoverageReport.summary.runtime_retrieval_generated_needs_review_badges === 0, 'Learner-facing evidence coverage must expose zero generated runtime badges');
assert(learnerFacingEvidenceCoverageReport.summary.runtime_retrieval_needs_review_badges === 0, 'Learner-facing evidence coverage must expose zero needs-review runtime badges');
assert(learnerFacingEvidenceCoverageReport.summary.runtime_retrieval_smoke_review_items === 0, 'Learner-facing evidence coverage must expose zero smoke review items');
assert(learnerFacingEvidenceCoverageReport.summary.runtime_retrieval_quarantine_warning_visible === true, 'Learner-facing evidence coverage must expose runtime quarantine warning');
assert(learnerFacingEvidenceCoverageReport.summary.runtime_retrieval_quality_badge_visible === true, 'Learner-facing evidence coverage must expose runtime retrieval-quality badge visibility');
assert(learnerFacingEvidenceCoverageReport.summary.runtime_high_risk_retrieval_quality_threshold_passed === true, 'Learner-facing evidence coverage must expose passing high-risk retrieval threshold');
assert(learnerFacingEvidenceCoverageReport.summary.runtime_high_risk_retrieval_quality_minimum_base_score >= 0.08, 'Learner-facing evidence coverage must expose high-risk minimum retrieval score');
assert(
  learnerFacingEvidenceCoverageReport.summary.runtime_high_risk_retrieval_quality_top_base_score
    >= learnerFacingEvidenceCoverageReport.summary.runtime_high_risk_retrieval_quality_minimum_base_score,
  'Learner-facing evidence coverage must expose a top retrieval score meeting the high-risk threshold'
);
assert(learnerFacingEvidenceCoverageReport.summary.runtime_bm25_fallback_badge_visible === true, 'Learner-facing evidence coverage must expose BM25 fallback badge visibility');
assert(learnerFacingEvidenceCoverageReport.summary.runtime_retrieval_nonclinical_scope_guardrail_warning_visible === true, 'Learner-facing evidence coverage must expose runtime nonclinical scope guardrail warning');
assert(learnerFacingEvidenceCoverageReport.summary.runtime_retrieval_nonclinical_scope_guardrail_reference_count === 0, 'Learner-facing evidence coverage must expose zero nonclinical scope guardrail references');
assert(learnerFacingEvidenceCoverageReport.source_contract.source_freshness_report_present === true, 'Learner-facing coverage report must point to the source freshness report');
assert(learnerFacingEvidenceCoverageReport.summary.source_freshness_report_present === true, 'Learner-facing coverage summary must include source freshness report presence');
assert(learnerFacingEvidenceCoverageReport.summary.learner_facing_source_freshness_release_ready === sourceFreshnessReport.summary.learner_facing_source_freshness_release_ready, 'Learner-facing coverage source freshness readiness must align with freshness report');
assert(learnerFacingEvidenceCoverageReport.summary.learner_facing_quote_backed_sources_release_blocked === sourceFreshnessReport.summary.learner_facing_quote_backed_sources_release_blocked, 'Learner-facing coverage freshness blockers must align with freshness report');
assert(learnerFacingEvidenceCoverageReport.summary.stale_learner_facing_quote_backed_sources === sourceFreshnessReport.summary.stale_learner_facing_quote_backed_sources, 'Learner-facing coverage stale source count must align with freshness report');
assert(learnerFacingEvidenceCoverageReport.summary.learner_facing_source_freshness_release_ready === false, 'Learner-facing coverage must not claim source freshness release readiness');
assert(learnerFacingEvidenceCoverageReport.source_contract.high_risk_quote_coverage_depth_report_present === true, 'Learner-facing coverage report must point to the high-risk quote coverage depth report');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_quote_coverage_depth_report_present === true, 'Learner-facing coverage summary must include high-risk quote depth report presence');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_quote_coverage_depth_release_ready === highRiskQuoteCoverageDepthReport.summary.quote_coverage_depth_release_ready, 'Learner-facing coverage high-risk quote depth readiness must align with depth report');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_quote_coverage_depth_topics_meeting_core_facet_depth === highRiskQuoteCoverageDepthReport.summary.topics_meeting_core_facet_depth, 'Learner-facing coverage quote-depth facet count must align');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_quote_coverage_depth_missing_topic_facet_pairs === highRiskQuoteCoverageDepthReport.summary.missing_required_topic_facet_pairs, 'Learner-facing coverage missing topic/facet pairs must align');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_quote_coverage_depth_release_ready === false, 'Learner-facing coverage must not claim high-risk quote depth release readiness');
assert(learnerFacingEvidenceCoverageReport.source_contract.claim_reference_alignment_report_present === true, 'Learner-facing coverage report must point to the claim reference alignment report');
assert(learnerFacingEvidenceCoverageReport.summary.claim_reference_alignment_report_present === true, 'Learner-facing coverage summary must include claim reference alignment report presence');
assert(learnerFacingEvidenceCoverageReport.summary.claim_reference_alignment_claim_sets === feedbackClaimReferenceAlignmentReport.summary.total_claim_sets, 'Learner-facing coverage claim alignment count must align');
assert(learnerFacingEvidenceCoverageReport.summary.claim_reference_alignment_claim_sets_meeting_threshold === feedbackClaimReferenceAlignmentReport.summary.claim_sets_meeting_minimum_reference_threshold, 'Learner-facing coverage claim alignment threshold count must align');
assert(learnerFacingEvidenceCoverageReport.summary.claim_reference_alignment_claim_sets_missing_domain_specific_support === feedbackClaimReferenceAlignmentReport.summary.claim_sets_missing_domain_specific_quote_support, 'Learner-facing coverage must expose claim-reference domain-specific support gaps');
assert(learnerFacingEvidenceCoverageReport.summary.claim_reference_alignment_domain_specific_release_ready === false, 'Learner-facing coverage must not claim domain-specific claim-reference support readiness');
assert(learnerFacingEvidenceCoverageReport.source_contract.claim_reference_gap_review_packets_present === true, 'Learner-facing coverage report must point to the claim reference gap packets');
assert(learnerFacingEvidenceCoverageReport.summary.claim_reference_gap_packets_total === claimReferenceGapReviewPackets.summary.total_gap_packets, 'Learner-facing coverage claim-reference gap count must align');
assert(learnerFacingEvidenceCoverageReport.summary.claim_reference_gap_packets_pending === claimReferenceGapReviewPackets.summary.pending_gap_packets, 'Learner-facing coverage claim-reference pending gap count must align');
assert(learnerFacingEvidenceCoverageReport.summary.claim_reference_gap_packets_generated_candidates === claimReferenceGapReviewPackets.summary.generated_needs_review_candidate_chunks_packeted, 'Learner-facing coverage generated candidate count must align with gap packets');
assert(learnerFacingEvidenceCoverageReport.summary.claim_reference_gap_packets_all_domain_specific_gaps_packeted === true, 'Learner-facing coverage must expose all domain-specific gaps as packeted');
assert(learnerFacingEvidenceCoverageReport.summary.claim_reference_alignment_generated_needs_review_references === 0, 'Learner-facing coverage must expose zero generated claim-alignment references');
assert(learnerFacingEvidenceCoverageReport.summary.claim_reference_alignment_release_ready === false, 'Learner-facing coverage must not claim claim-reference alignment release readiness');
assert(learnerFacingEvidenceCoverageReport.summary.high_risk_topics_without_quote_backed_coverage === 0, 'High-risk quote coverage should remain present for current required topics');
assert(learnerFacingEvidenceCoverageReport.summary.source_limited_formative_feedback_rows === feedbackTraceabilityMatrix.summary.source_limited_formative_rows, 'Learner-facing coverage report must align source-limited feedback rows');
assert(learnerFacingEvidenceCoverageReport.source_contract.claim_entailment_review_packet_file_present === true, 'Learner-facing coverage report must point to the claim-entailment packet artifact');
assert(learnerFacingEvidenceCoverageReport.summary.claim_entailment_packet_report_present === true, 'Learner-facing coverage summary must include claim-entailment packet report presence');
assert(learnerFacingEvidenceCoverageReport.summary.claim_entailment_packet_count === feedbackClaimEntailmentReviewPackets.summary.total_claim_sets, 'Learner-facing coverage packet count must align with claim-entailment packets');
assert(learnerFacingEvidenceCoverageReport.summary.claim_entailment_packet_ready_for_national_release === false, 'Learner-facing coverage must not claim claim-entailment packet release readiness');
assert(learnerFacingEvidenceCoverageReport.source_contract.claim_entailment_adjudication_status_file_present === true, 'Learner-facing coverage report must point to the claim-entailment adjudication status artifact');
assert(learnerFacingEvidenceCoverageReport.summary.claim_entailment_adjudication_status_present === true, 'Learner-facing coverage summary must include claim-entailment adjudication status presence');
assert(learnerFacingEvidenceCoverageReport.summary.claim_entailment_adjudication_status === feedbackClaimEntailmentAdjudicationStatus.review_status, 'Learner-facing coverage adjudication status must align with adjudication artifact');
assert(learnerFacingEvidenceCoverageReport.summary.claim_entailment_validated_reviews === feedbackClaimEntailmentAdjudicationStatus.summary.valid_claim_reviews, 'Learner-facing coverage validated review count must align with adjudication artifact');
assert(learnerFacingEvidenceCoverageReport.summary.claim_entailment_invalid_review_input_count === 0, 'Learner-facing coverage must expose zero invalid claim review inputs');
assert(learnerFacingEvidenceCoverageReport.summary.claim_entailment_adjudication_ready_for_national_release === false, 'Learner-facing coverage must not claim claim-entailment adjudication release readiness');
assert(learnerFacingEvidenceCoverageReport.summary.claim_entailment_required_claim_sets >= feedbackTraceabilityMatrix.summary.domains_tracked, 'Learner-facing coverage report must queue every feedback domain for claim review');
assert(learnerFacingEvidenceCoverageReport.summary.claim_entailment_reviewed_claims === 0, 'Learner-facing coverage report must not claim claim-entailment review');
assert(learnerFacingEvidenceCoverageReport.summary.evidence_adjudication_approved_chunks === clinicalReviewAdjudicationStatus.evidence.approved_chunks, 'Learner-facing coverage report must align evidence adjudication approvals');
assert(learnerFacingEvidenceCoverageReport.summary.learner_facing_evidence_release_ready === false, 'Learner-facing evidence coverage must not claim national evidence release readiness');
assert(learnerFacingEvidenceCoverageReport.release_blockers.length >= 3, 'Learner-facing evidence coverage must include release blockers');
assert(report.metrics.evidence.learner_facing_evidence_coverage_report_present === true, 'Readiness report must include learner-facing evidence coverage report status');
assert(report.metrics.evidence.learner_facing_eligible_quote_backed_chunks === learnerFacingEvidenceCoverageReport.summary.learner_facing_eligible_quote_backed_chunks, 'Readiness report must include eligible quote-backed chunk count');
assert(report.metrics.evidence.learner_facing_claim_entailment_packet_report_present === true, 'Readiness report must include learner-facing claim packet presence');
assert(report.metrics.evidence.learner_facing_claim_entailment_packet_count === feedbackClaimEntailmentReviewPackets.summary.total_claim_sets, 'Readiness report claim packet count must align with packet artifact');
assert(report.metrics.evidence.learner_facing_claim_entailment_adjudication_status_present === true, 'Readiness report must include learner-facing claim adjudication status presence');
assert(report.metrics.evidence.learner_facing_claim_entailment_invalid_review_input_count === 0, 'Readiness report must expose zero invalid learner-facing claim review inputs');
assert(report.metrics.evidence.learner_facing_claim_entailment_reviewed_claims === 0, 'Readiness report must expose missing claim-entailment review');
assert(report.metrics.evidence.learner_facing_evidence_release_ready === false, 'Readiness report must not claim learner-facing evidence release readiness');

assert(evidenceQualityDashboard.schema_version === 'evidence_quality_dashboard_v1', 'Unexpected evidence quality dashboard schema');
assert(
  evidenceQualityDashboard.review_status === 'evidence_quality_dashboard_open_backlog_review_required',
  'Evidence quality dashboard must preserve current open backlog status'
);
assert(evidenceQualityDashboard.source_contract.public_knowledge_bundle_schema === 'clinical_knowledge_bundle_v2', 'Evidence dashboard must point to the public knowledge bundle schema');
assert(evidenceQualityDashboard.source_contract.public_source_quality_report_schema === 'clinical_source_quality_report_v1', 'Evidence dashboard must point to the public source quality report schema');
assert(evidenceQualityDashboard.source_contract.learner_facing_coverage_report_present === true, 'Evidence dashboard must point to the learner-facing evidence coverage report');
assert(evidenceQualityDashboard.source_contract.high_risk_quote_depth_report_present === true, 'Evidence dashboard must point to the high-risk quote-depth report');
assert(evidenceQualityDashboard.source_contract.source_freshness_report_present === true, 'Evidence dashboard must point to the source freshness report');
assert(evidenceQualityDashboard.source_contract.retrieval_runtime_report_present === true, 'Evidence dashboard must point to the retrieval runtime report');
assert(evidenceQualityDashboard.source_contract.source_link_quote_verification_report_present === true, 'Evidence dashboard must point to the source link quote verification report');
assert(evidenceQualityDashboard.source_contract.evidence_backlog_report_present === true, 'Evidence dashboard must point to the evidence backlog report');
assert(evidenceQualityDashboard.source_contract.claim_reference_gap_review_packets_present === true, 'Evidence dashboard must point to the claim reference gap packets');
assert(evidenceQualityDashboard.summary.total_sources === report.metrics.evidence.total_sources, 'Evidence dashboard source count must align with readiness evidence metrics');
assert(evidenceQualityDashboard.summary.total_chunks === report.metrics.evidence.total_chunks, 'Evidence dashboard chunk count must align with readiness evidence metrics');
assert(evidenceQualityDashboard.summary.quote_backed_chunks === report.metrics.evidence.quote_backed_count, 'Evidence dashboard quote-backed count must align with readiness evidence metrics');
assert(evidenceQualityDashboard.summary.learner_facing_eligible_quote_backed_chunks === learnerFacingEvidenceCoverageReport.summary.learner_facing_eligible_quote_backed_chunks, 'Evidence dashboard learner-facing quote count must align with coverage report');
assert(evidenceQualityDashboard.summary.generated_needs_review_chunks === evidenceBacklog.summary.pending_generated_or_unverified_chunks, 'Evidence dashboard generated backlog must align with evidence backlog');
assert(evidenceQualityDashboard.summary.generated_needs_review_chunks === report.metrics.evidence.generated_needs_review_count, 'Evidence dashboard generated count must align with readiness evidence metrics');
assert(evidenceQualityDashboard.summary.generated_chunks_quarantined_by_default === true, 'Evidence dashboard must preserve generated evidence quarantine status');
assert(evidenceQualityDashboard.summary.runtime_retrieval_all_probes_passed === true, 'Evidence dashboard must expose passing retrieval runtime probes');
assert(evidenceQualityDashboard.summary.runtime_retrieval_quality_badge_visible === true, 'Evidence dashboard must expose retrieval-quality badge visibility');
assert(evidenceQualityDashboard.summary.source_link_quote_hash_mismatches === 0, 'Evidence dashboard must expose zero quote hash mismatches');
assert(evidenceQualityDashboard.summary.source_link_quote_records_requiring_repair === sourceLinkQuoteVerificationReport.summary.quote_records_requiring_repair, 'Evidence dashboard source-link repair count must align with verifier');
assert(evidenceQualityDashboard.summary.source_link_quote_records_without_machine_text_match === sourceLinkQuoteVerificationReport.summary.quote_records_without_machine_text_match, 'Evidence dashboard source-link unmatched count must align with verifier');
assert(evidenceQualityDashboard.summary.source_link_quote_verification_release_ready === true, 'Evidence dashboard must expose source-link verification release readiness');
assert(evidenceQualityDashboard.summary.learner_facing_quote_backed_sources_release_blocked === sourceFreshnessReport.summary.learner_facing_quote_backed_sources_release_blocked, 'Evidence dashboard freshness blockers must align with source freshness report');
assert(evidenceQualityDashboard.summary.high_risk_topic_count === highRiskQuoteCoverageDepthReport.summary.high_risk_topic_count, 'Evidence dashboard high-risk topic count must align with quote-depth report');
assert(evidenceQualityDashboard.summary.high_risk_topics_meeting_core_facet_depth === highRiskQuoteCoverageDepthReport.summary.topics_meeting_core_facet_depth, 'Evidence dashboard high-risk facet depth count must align with quote-depth report');
assert(evidenceQualityDashboard.summary.high_risk_missing_topic_facet_pairs === highRiskQuoteCoverageDepthReport.summary.missing_required_topic_facet_pairs, 'Evidence dashboard missing high-risk topic/facet pairs must align with quote-depth report');
assert(evidenceQualityDashboard.summary.claim_reference_gap_packets_total === claimReferenceGapReviewPackets.summary.total_gap_packets, 'Evidence dashboard claim-reference gap packet count must align');
assert(evidenceQualityDashboard.summary.claim_reference_gap_packets_generated_candidates === claimReferenceGapReviewPackets.summary.generated_needs_review_candidate_chunks_packeted, 'Evidence dashboard claim-reference generated candidate count must align');
assert(evidenceQualityDashboard.summary.claim_reference_gap_packets_all_domain_specific_gaps_packeted === true, 'Evidence dashboard must expose all claim-reference gaps as packeted');
assert(evidenceQualityDashboard.summary.claim_entailment_valid_reviews === feedbackClaimEntailmentAdjudicationStatus.summary.valid_claim_reviews, 'Evidence dashboard claim review count must align with adjudication status');
assert(evidenceQualityDashboard.summary.evidence_adjudication_approved_chunks === clinicalReviewAdjudicationStatus.evidence.approved_chunks, 'Evidence dashboard evidence adjudication approvals must align with adjudication status');
assert(evidenceQualityDashboard.summary.dashboard_release_ready === false, 'Evidence dashboard must not claim evidence release readiness');
assert(evidenceQualityDashboard.summary.alignment_checks_passed === true, 'Evidence dashboard alignment checks must pass');
assert(evidenceQualityDashboard.summary.open_release_blockers > 0, 'Evidence dashboard must expose current open release blockers');
assert(!evidenceQualityDashboard.release_blockers.some((blocker) => blocker.id === 'source_link_quote_verification_not_ready' && blocker.status === 'blocked'), 'Evidence dashboard must not keep a source-link quote verification blocker after source-link release readiness passes');
assert(evidenceQualityDashboard.release_blockers.length >= 5, 'Evidence dashboard must include remaining concrete release blockers');
assert(evidenceQualityDashboard.release_blockers.some((blocker) => blocker.id === 'generated_backlog_unreviewed' && blocker.status === 'blocked'), 'Evidence dashboard must show generated backlog as blocked');
assert(evidenceQualityDashboard.release_blockers.some((blocker) => blocker.id === 'claim_reference_gap_packets_not_clear' && blocker.status === 'blocked'), 'Evidence dashboard must show claim-reference gap packets as blocked until resolved');
assert(
  highRiskQuoteDepthHasOpenFacetGaps
    ? evidenceQualityDashboard.high_risk_quote_depth.missing_topic_facet_rows.length > 0
    : evidenceQualityDashboard.high_risk_quote_depth.missing_topic_facet_rows.length === 0,
  'Evidence dashboard high-risk missing rows must match quote-depth gap state'
);
assert(report.metrics.evidence.evidence_quality_dashboard_present === true, 'Readiness report must include evidence quality dashboard status');
assert(report.metrics.evidence.evidence_quality_dashboard_alignment_checks_passed === true, 'Readiness report must expose evidence dashboard alignment');
assert(report.metrics.evidence.evidence_quality_dashboard_quote_backed_chunks === evidenceQualityDashboard.summary.quote_backed_chunks, 'Readiness report dashboard quote-backed count must align');
assert(report.metrics.evidence.evidence_quality_dashboard_generated_needs_review_chunks === evidenceQualityDashboard.summary.generated_needs_review_chunks, 'Readiness report dashboard generated count must align');
assert(report.metrics.evidence.evidence_quality_dashboard_high_risk_missing_topic_facet_pairs === evidenceQualityDashboard.summary.high_risk_missing_topic_facet_pairs, 'Readiness report dashboard high-risk missing pair count must align');
assert(report.metrics.evidence.evidence_quality_dashboard_open_release_blockers === evidenceQualityDashboard.summary.open_release_blockers, 'Readiness report dashboard blocker count must align');
assert(report.metrics.evidence.evidence_quality_dashboard_release_ready === false, 'Readiness report must not claim evidence dashboard release readiness');

assert(equityBiasAudit.schema_version === 'equity_bias_readiness_audit_v1', 'Unexpected equity/bias audit schema');
assert(equityBiasAudit.review_status === 'draft_needs_equity_clinical_educator_review', 'Equity/bias audit must remain draft until equity review');
assert(equityBiasAudit.summary.total_cases === cases.length, 'Equity/bias audit case count must match current cases');
assert(equityBiasAudit.summary.pending_equity_review_cases === cases.length, 'Every case should remain pending equity review');
assert(equityBiasAudit.summary.equity_reviewed_cases === 0, 'Equity/bias audit must not claim reviewed cases');
assert(equityBiasAudit.summary.bias_policy_probes >= 6, 'Equity/bias audit should include multiple bias policy probes');
assert(equityBiasAudit.summary.all_bias_policy_probes_passed === true, 'Equity/bias policy probes must pass');
assert(equityBiasAudit.summary.learner_safety_bias_probe_present === true, 'Learner safety suite should include a bias/equity probe');
assert(equityBiasAudit.case_equity_review_queue.length === cases.length, 'Equity review queue must cover every case');
assert(equityCaseReviewStatus.schema_version === 'equity_case_review_status_v1', 'Unexpected equity case review status schema');
assert(equityCaseReviewStatus.review_status === 'equity_case_review_inputs_pending', 'Equity case review status should remain pending until completed review inputs are submitted');
assert(equityCaseReviewStatus.source_contract.equity_bias_readiness_audit_schema === equityBiasAudit.schema_version, 'Equity case review status must align with equity audit schema');
assert(equityCaseReviewStatus.source_contract.completed_review_file_present === false, 'Equity case review status must not claim a completed review file');
assert(equityCaseReviewStatus.summary.total_cases === cases.length, 'Equity case review status case count must match current cases');
assert(equityCaseReviewStatus.summary.submitted_reviews === 0, 'Equity case review status must expose zero submitted reviews');
assert(equityCaseReviewStatus.summary.valid_reviews === 0, 'Equity case review status must expose zero valid reviews');
assert(equityCaseReviewStatus.summary.nationally_approved_cases === 0, 'Equity case review status must expose zero nationally approved cases');
assert(equityCaseReviewStatus.summary.cases_missing_review === cases.length, 'Every current case should remain missing equity review');
assert(equityCaseReviewStatus.summary.invalid_review_input_count === 0, 'Equity case review status must expose zero invalid review inputs when no review file exists');
assert(equityCaseReviewStatus.summary.ready_for_national_equity_release === false, 'Equity case review status must not claim national release readiness');
assert(equityCaseReviewStatus.case_review_status.length === cases.length, 'Equity case review status rows must cover every case');
assert(equityCaseReviewStatus.readiness_effect.equity_bias_gate_can_pass_from_current_reviews === false, 'Equity case reviews must not permit the equity gate to pass yet');
assert(report.metrics.equity_bias_readiness.all_bias_policy_probes_passed === true, 'Readiness report must include bias policy probe results');
assert(report.metrics.equity_bias_readiness.equity_reviewed_cases === 0, 'Readiness report must not claim equity-reviewed cases');
assert(report.metrics.equity_bias_readiness.equity_case_review_status_present === true, 'Readiness report must include equity case review status');
assert(report.metrics.equity_bias_readiness.equity_case_submitted_reviews === 0, 'Readiness report must expose zero submitted equity case reviews');
assert(report.metrics.equity_bias_readiness.equity_case_valid_reviews === 0, 'Readiness report must expose zero valid equity case reviews');
assert(report.metrics.equity_bias_readiness.equity_case_nationally_approved_cases === 0, 'Readiness report must expose zero nationally approved equity cases');
assert(report.metrics.equity_bias_readiness.equity_case_cases_missing_review === cases.length, 'Readiness report must expose missing equity case reviews');
assert(report.metrics.equity_bias_readiness.equity_case_invalid_review_inputs === 0, 'Readiness report must expose zero invalid equity case review inputs');
assert(report.metrics.equity_bias_readiness.equity_case_ready_for_national_release === false, 'Readiness report must not claim equity case release readiness');

assert(equityCaseReviewPackets.schema_version === 'equity_case_review_packets_v1', 'Unexpected equity case review packet schema');
assert(
  equityCaseReviewPackets.review_status === 'equity_case_review_packets_open_case_and_bias_review_required',
  'Equity case review packets must expose open case and bias review work'
);
assert(equityCaseReviewPackets.source_contract.equity_bias_readiness_audit_schema === equityBiasAudit.schema_version, 'Equity packets must align with equity audit schema');
assert(equityCaseReviewPackets.source_contract.equity_case_review_status_schema === equityCaseReviewStatus.schema_version, 'Equity packets must align with equity review status schema');
assert(equityCaseReviewPackets.source_contract.case_bank_expansion_status_schema === caseBankExpansionStatus.schema_version, 'Equity packets must align with case bank expansion status schema');
assert(equityCaseReviewPackets.source_contract.learner_safety_review_packets_schema === learnerSafetyReviewPackets.schema_version, 'Equity packets must align with learner-safety review packet schema');
assert(equityCaseReviewPackets.source_contract.automated_bias_policy_probe_pass_authorizes_national_use === false, 'Equity packets must not treat automated bias probes as national approval');
assert(equityCaseReviewPackets.summary.case_review_packets === equityBiasAudit.summary.total_cases, 'Equity case packet count must match current case count');
assert(equityCaseReviewPackets.summary.case_review_packets === equityCaseReviewStatus.summary.cases_missing_review, 'Equity case packet count must match current missing equity reviews');
assert(equityCaseReviewPackets.summary.bias_policy_probe_review_packets === equityBiasAudit.summary.bias_policy_probes, 'Equity bias-probe packet count must match automated bias probes');
assert(equityCaseReviewPackets.summary.bias_policy_probes_passed === equityBiasAudit.summary.bias_policy_probes_passed, 'Equity packet bias-probe pass count must align with audit');
assert(equityCaseReviewPackets.summary.all_cases_packeted === true, 'Equity packets must packet every current case');
assert(equityCaseReviewPackets.summary.all_bias_policy_probes_packeted === true, 'Equity packets must packet every automated bias-policy probe');
assert(equityCaseReviewPackets.summary.all_bias_policy_probes_passed === true, 'Equity packets must expose passing automated bias-policy probes');
assert(equityCaseReviewPackets.summary.case_bank_coverage_gap_packets >= 3, 'Equity packets must expose current pediatric, language-access, and disability/accommodation case-bank coverage gaps');
assert(equityCaseReviewPackets.summary.total_review_packets === (
  equityCaseReviewPackets.summary.case_review_packets
  + equityCaseReviewPackets.summary.bias_policy_probe_review_packets
  + equityCaseReviewPackets.summary.case_bank_coverage_gap_packets
), 'Equity packet total must equal case, probe, and coverage-gap packet counts');
assert(equityCaseReviewPackets.summary.pending_review_packets === equityCaseReviewPackets.summary.total_review_packets, 'Equity packets must remain pending until review inputs exist');
assert(equityCaseReviewPackets.summary.reviewed_review_packets === 0, 'Equity packets must not claim completed reviews');
assert(equityCaseReviewPackets.summary.ready_for_national_equity_release_from_packets === false, 'Equity packets must not claim national equity release readiness');
assert(equityCaseReviewPackets.case_review_packets.length === equityBiasAudit.summary.total_cases, 'Equity case packet rows must match current cases');
assert(equityCaseReviewPackets.bias_policy_probe_review_packets.length === equityBiasAudit.summary.bias_policy_probes, 'Equity bias-probe packet rows must match bias probes');
assert(equityCaseReviewPackets.case_review_packets.every((packet) => packet.reviewer_roles_required.includes('clinical_equity_reviewer')), 'Every equity case packet must require clinical equity review');
assert(equityCaseReviewPackets.case_review_packets.every((packet) => packet.reviewer_roles_required.includes('simulation_educator')), 'Every equity case packet must require simulation educator review');
assert(equityCaseReviewPackets.case_review_packets.every((packet) => packet.reviewer_roles_required.includes('language_access_or_accessibility_reviewer')), 'Every equity case packet must require language/accessibility review');
assert(equityCaseReviewPackets.bias_policy_probe_review_packets.every((packet) => packet.automated_probe_status === 'pass'), 'Every current equity bias-probe packet should expose a passing automated probe');
assert(equityCaseReviewPackets.release_blockers.some((blocker) => blocker.id === 'equity_case_reviews_pending' && blocker.status === 'blocked'), 'Equity packets must block on missing case reviews');
assert(equityCaseReviewPackets.release_blockers.some((blocker) => blocker.id === 'automated_bias_policy_review_pending' && blocker.status === 'blocked'), 'Equity packets must block on automated bias-policy review');
assert(equityCaseReviewPackets.release_blockers.some((blocker) => blocker.id === 'equity_case_bank_coverage_gaps_open' && blocker.status === 'blocked'), 'Equity packets must block on equity case-bank coverage gaps');
assert(report.metrics.equity_bias_readiness.equity_case_review_packets_present === true, 'Readiness report must include equity packet status');
assert(report.metrics.equity_bias_readiness.equity_case_total_review_packets === equityCaseReviewPackets.summary.total_review_packets, 'Readiness report must expose equity packet total');
assert(report.metrics.equity_bias_readiness.equity_case_review_packet_cases === equityCaseReviewPackets.summary.case_review_packets, 'Readiness report must expose equity case packet count');
assert(report.metrics.equity_bias_readiness.equity_bias_policy_probe_review_packets === equityCaseReviewPackets.summary.bias_policy_probe_review_packets, 'Readiness report must expose equity bias-probe packet count');
assert(report.metrics.equity_bias_readiness.equity_case_bank_coverage_gap_packets === equityCaseReviewPackets.summary.case_bank_coverage_gap_packets, 'Readiness report must expose equity case-bank coverage gap packet count');
assert(report.metrics.equity_bias_readiness.equity_case_all_cases_packeted === true, 'Readiness report must expose all equity cases as packeted');
assert(report.metrics.equity_bias_readiness.equity_bias_policy_all_probes_packeted === true, 'Readiness report must expose all bias probes as packeted');
assert(report.metrics.equity_bias_readiness.equity_case_pending_review_packets === equityCaseReviewPackets.summary.pending_review_packets, 'Readiness report must expose pending equity packet count');
assert(report.metrics.equity_bias_readiness.equity_case_ready_for_national_release_from_packets === false, 'Readiness report must not claim equity packet release readiness');

assert(coreEpaCurriculumMap.schema_version === 'core_epa_curriculum_map_v1', 'Unexpected Core EPA curriculum map schema');
assert(coreEpaCurriculumMap.review_status === 'draft_needs_curriculum_committee_review', 'Core EPA map must remain draft until curriculum committee review');
assert(coreEpaCurriculumMap.summary.total_core_epas === 13, 'Core EPA map should enumerate 13 Core EPAs');
assert(coreEpaCurriculumMap.summary.cases_mapped === cases.length, 'Core EPA case mapping count must match case count');
assert(coreEpaCurriculumMap.summary.reviewed_case_epa_mappings === 0, 'Core EPA map must not claim reviewed case mappings');
assert(curriculumMappingReviewStatus.schema_version === 'curriculum_mapping_review_status_v1', 'Unexpected curriculum mapping review status schema');
assert(curriculumMappingReviewStatus.review_status === 'curriculum_mapping_review_inputs_pending', 'Curriculum mapping review status must remain pending until completed review inputs exist');
assert(curriculumMappingReviewStatus.source_contract.objective_matrix_schema === 'case_objective_matrix_v1', 'Curriculum mapping review status must point to the objective matrix schema');
assert(curriculumMappingReviewStatus.source_contract.core_epa_curriculum_map_schema === 'core_epa_curriculum_map_v1', 'Curriculum mapping review status must point to the Core EPA map schema');
assert(curriculumMappingReviewStatus.source_contract.completed_review_file_present === false, 'Current curriculum mapping review status must not claim a completed review file');
assert(curriculumMappingReviewStatus.summary.case_mappings === cases.length, 'Curriculum mapping review status must align with the case count');
assert(curriculumMappingReviewStatus.summary.submitted_case_reviews === 0, 'Current curriculum mapping review status must not claim submitted case reviews');
assert(curriculumMappingReviewStatus.summary.valid_case_reviews === 0, 'Current curriculum mapping review status must not claim valid case reviews');
assert(curriculumMappingReviewStatus.summary.nationally_approved_case_mappings === 0, 'Current curriculum mapping review status must not claim nationally approved case mappings');
assert(curriculumMappingReviewStatus.summary.case_mappings_missing_review === cases.length, 'Every current case mapping should remain missing curriculum review');
assert(curriculumMappingReviewStatus.summary.workflow_phases_missing_review === coreEpaCurriculumMap.workflow_phase_map.length, 'Every workflow phase should remain missing curriculum review');
assert(curriculumMappingReviewStatus.summary.unsupported_epa_decisions_missing === coreEpaCurriculumMap.summary.unsupported_epas, 'Every unsupported Core EPA should require a scope decision');
assert(curriculumMappingReviewStatus.summary.invalid_review_input_count === 0, 'Missing curriculum review file should not be treated as invalid input');
assert(curriculumMappingReviewStatus.summary.ready_for_national_curriculum_release === false, 'Curriculum mapping review status must not claim national release readiness');
assert(curriculumMappingReviewStatus.case_mapping_review_status.length === cases.length, 'Curriculum case review rows must align with case count');
assert(curriculumMappingReviewStatus.workflow_phase_review_status.length === coreEpaCurriculumMap.workflow_phase_map.length, 'Curriculum workflow review rows must align with workflow phase count');
assert(curriculumMappingReviewStatus.unsupported_epa_decision_status.length === coreEpaCurriculumMap.summary.unsupported_epas, 'Unsupported EPA decision rows must align with unsupported EPA count');
assert(curriculumMappingReviewStatus.readiness_effect.educational_validity_gate_can_pass_from_current_curriculum_reviews === false, 'Current curriculum reviews must not clear the educational validity gate');
assert(report.metrics.educational_validity.curriculum_mapping_review_status_present === true, 'Readiness report must include curriculum mapping review status');
assert(report.metrics.educational_validity.curriculum_mapping_review_status === curriculumMappingReviewStatus.review_status, 'Readiness report must expose curriculum mapping review status');
assert(report.metrics.educational_validity.curriculum_mapping_submitted_case_reviews === 0, 'Readiness report must expose zero submitted curriculum case reviews');
assert(report.metrics.educational_validity.curriculum_mapping_valid_case_reviews === 0, 'Readiness report must expose zero valid curriculum case reviews');
assert(report.metrics.educational_validity.curriculum_mapping_nationally_approved_case_mappings === 0, 'Readiness report must expose zero nationally approved curriculum case mappings');
assert(report.metrics.educational_validity.curriculum_mapping_case_mappings_missing_review === cases.length, 'Readiness report must expose missing curriculum case reviews');
assert(report.metrics.educational_validity.curriculum_mapping_workflow_phases_missing_review === coreEpaCurriculumMap.workflow_phase_map.length, 'Readiness report must expose missing workflow phase reviews');
assert(report.metrics.educational_validity.curriculum_mapping_unsupported_epa_decisions_missing === coreEpaCurriculumMap.summary.unsupported_epas, 'Readiness report must expose missing unsupported EPA decisions');
assert(report.metrics.educational_validity.curriculum_mapping_invalid_review_inputs === 0, 'Readiness report must expose zero invalid curriculum review inputs');
assert(report.metrics.educational_validity.curriculum_mapping_ready_for_national_release === false, 'Readiness report must not claim curriculum mapping release readiness');

assert(educationalOutcomesFramework.schema_version === 'educational_outcomes_measurement_framework_v1', 'Unexpected educational outcomes framework schema');
assert(educationalOutcomesFramework.review_status === 'draft_instrumentation_framework_needs_pilot_validation', 'Educational outcomes framework must remain draft until learner outcome validation');
assert(educationalOutcomesFramework.summary.total_metrics >= 15, 'Educational outcomes framework should define at least 15 metrics');
assert(educationalOutcomesFramework.summary.currently_instrumented_metrics >= 10, 'Educational outcomes framework should include currently instrumented metrics');
assert(educationalOutcomesFramework.summary.source_limited_metrics >= 3, 'Educational outcomes framework must identify source-limited diagnosis, consult, and reassessment metrics');
assert(educationalOutcomesFramework.summary.requires_external_validation_metrics >= 3, 'Educational outcomes framework must identify external validation metrics');
assert(educationalOutcomesFramework.summary.cases_mapped === cases.length, 'Educational outcomes case map count must match case count');
assert(educationalOutcomesFramework.summary.reviewed_outcome_studies === 0, 'Educational outcomes framework must not claim completed outcome studies');
assert(educationalOutcomesFramework.metric_definitions.some((item) => item.id === 'high_risk_undertriage'), 'Educational outcomes framework must track high-risk undertriage');
assert(educationalOutcomesFramework.metric_definitions.some((item) => item.id === 'source_limited_feedback_exposure'), 'Educational outcomes framework must track source-limited feedback exposure');
assert(educationalOutcomesRuntimeReport.schema_version === 'educational_outcomes_runtime_report_v1', 'Unexpected educational outcomes runtime report schema');
assert(educationalOutcomesRuntimeReport.review_status === 'runtime_outcome_instrumentation_probe_complete_needs_pilot_validation', 'Educational outcomes runtime report must require pilot validation');
assert(educationalOutcomesRuntimeReport.summary.total_probes >= 7, 'Educational outcomes runtime report should include instrumentation and privacy probes');
assert(educationalOutcomesRuntimeReport.summary.all_probes_passed === true, 'Educational outcomes runtime probes must pass');
assert(educationalOutcomesRuntimeReport.summary.export_row_count >= 3, 'Educational outcomes runtime report should generate a bounded sample export');
assert(educationalOutcomesRuntimeReport.summary.high_risk_undertriage_rows >= 1, 'Educational outcomes runtime report must detect high-risk undertriage');
assert(educationalOutcomesRuntimeReport.summary.source_limited_feedback_rows >= 3, 'Educational outcomes runtime report must expose source-limited feedback rows');
assert(educationalOutcomesRuntimeReport.summary.privacy_disallowed_key_count === 0, 'Educational outcomes runtime export must not include disallowed privacy keys');
assert(educationalOutcomesRuntimeReport.summary.direct_identifier_value_count === 0, 'Educational outcomes runtime export must not include direct identifier-looking values');
assert(educationalOutcomesRuntimeReport.summary.pilot_studies_completed === 0, 'Educational outcomes runtime report must not claim pilot studies');
assert(educationalOutcomesRuntimeReport.privacy_safe_export.privacy_contract.excludes_raw_learner_free_text === true, 'Educational outcome export must exclude raw learner free text');
assert(educationalOutcomesRuntimeReport.privacy_safe_export.privacy_contract.excludes_optional_ai_draft_text === true, 'Educational outcome export must exclude optional AI draft text');
assert(educationalOutcomesValidationStatus.schema_version === 'educational_outcomes_validation_status_v1', 'Unexpected educational outcomes validation status schema');
assert(
  [
    'educational_outcome_study_inputs_pending',
    'educational_outcome_study_inputs_invalid',
    'educational_outcome_study_inputs_partial',
    'educational_outcome_validation_ready_for_external_audit'
  ].includes(educationalOutcomesValidationStatus.review_status),
  'Educational outcomes validation status must use a recognized review status'
);
assert(educationalOutcomesValidationStatus.source_contract.educational_outcomes_framework_schema === 'educational_outcomes_measurement_framework_v1', 'Educational outcomes validation status must point to the framework schema');
assert(educationalOutcomesValidationStatus.source_contract.educational_outcomes_runtime_report_schema === 'educational_outcomes_runtime_report_v1', 'Educational outcomes validation status must point to the runtime report schema');
assert(educationalOutcomesValidationStatus.summary.study_file_present === false, 'Current educational outcomes validation must not claim a completed study input file');
assert(educationalOutcomesValidationStatus.summary.submitted_studies === 0, 'Current educational outcomes validation must not claim submitted studies');
assert(educationalOutcomesValidationStatus.summary.valid_studies === 0, 'Current educational outcomes validation must not claim valid studies');
assert(educationalOutcomesValidationStatus.summary.completed_pilot_studies === 0, 'Current educational outcomes validation must not claim completed pilot studies');
assert(educationalOutcomesValidationStatus.summary.completed_multi_site_studies === 0, 'Current educational outcomes validation must not claim completed multi-site studies');
assert(educationalOutcomesValidationStatus.summary.invalid_study_input_count === 0, 'Missing educational outcome study file should not be treated as invalid input');
assert(educationalOutcomesValidationStatus.summary.ready_for_educational_validity_claims === false, 'Educational outcomes validation must not claim readiness without submitted studies');
assert(educationalOutcomesValidationStatus.readiness_effect.educational_validity_gate_can_pass_from_current_studies === false, 'Current educational outcome studies must not clear the educational validity gate');
assert(report.metrics.educational_validity.educational_outcomes_runtime_report_present === true, 'Readiness report must include educational outcomes runtime report status');
assert(report.metrics.educational_validity.educational_outcome_runtime_all_probes_passed === true, 'Readiness report must include passing educational outcome runtime probes');
assert(report.metrics.educational_validity.educational_outcome_runtime_privacy_disallowed_key_count === 0, 'Readiness report must include zero educational outcome privacy-key findings');
assert(report.metrics.educational_validity.educational_outcome_runtime_direct_identifier_value_count === 0, 'Readiness report must include zero educational outcome direct identifier findings');
assert(report.metrics.educational_validity.educational_outcomes_validation_status_present === true, 'Readiness report must include educational outcomes validation status');
assert(report.metrics.educational_validity.educational_outcome_submitted_studies === 0, 'Readiness report must expose zero submitted educational outcome studies');
assert(report.metrics.educational_validity.educational_outcome_valid_studies === 0, 'Readiness report must expose zero valid educational outcome studies');
assert(report.metrics.educational_validity.educational_outcome_validation_invalid_study_inputs === 0, 'Readiness report must expose zero invalid educational outcome study inputs');
assert(report.metrics.educational_validity.educational_outcome_validation_ready_for_claims === false, 'Readiness report must not claim educational outcome validation readiness');
assert(report.metrics.educational_validity.educational_outcome_pilot_studies_completed === 0, 'Readiness report must expose zero completed pilot studies');
assert(report.metrics.educational_validity.educational_outcome_multi_site_studies_completed === 0, 'Readiness report must expose zero completed multi-site studies');

assert(educationalValidityReviewPackets.schema_version === 'educational_validity_review_packets_v1', 'Unexpected educational-validity review packet schema');
assert(
  educationalValidityReviewPackets.review_status === 'educational_validity_review_packets_open_curriculum_and_outcome_review_required',
  'Educational-validity packets must expose open curriculum and outcome review work'
);
assert(educationalValidityReviewPackets.source_contract.core_epa_curriculum_map_schema === coreEpaCurriculumMap.schema_version, 'Educational-validity packets must align with Core EPA map schema');
assert(educationalValidityReviewPackets.source_contract.curriculum_mapping_review_status_schema === curriculumMappingReviewStatus.schema_version, 'Educational-validity packets must align with curriculum review status schema');
assert(educationalValidityReviewPackets.source_contract.educational_outcomes_framework_schema === educationalOutcomesFramework.schema_version, 'Educational-validity packets must align with outcomes framework schema');
assert(educationalValidityReviewPackets.source_contract.educational_outcomes_validation_status_schema === educationalOutcomesValidationStatus.schema_version, 'Educational-validity packets must align with outcomes validation schema');
assert(educationalValidityReviewPackets.source_contract.improved_clinical_judgment_claim_allowed_without_studies === false, 'Educational-validity packets must not allow improved clinical judgment claims without studies');
assert(educationalValidityReviewPackets.summary.case_curriculum_mapping_packets === curriculumMappingReviewStatus.summary.case_mappings_missing_review, 'Educational-validity case curriculum packets must match missing curriculum case reviews');
assert(educationalValidityReviewPackets.summary.workflow_phase_review_packets === curriculumMappingReviewStatus.summary.workflow_phases_missing_review, 'Educational-validity workflow packets must match missing workflow reviews');
assert(educationalValidityReviewPackets.summary.unsupported_epa_decision_packets === curriculumMappingReviewStatus.summary.unsupported_epa_decisions_missing, 'Educational-validity unsupported EPA packets must match missing unsupported EPA decisions');
assert(educationalValidityReviewPackets.summary.case_outcome_measurement_packets === educationalOutcomesFramework.summary.cases_mapped, 'Educational-validity case outcome packets must match outcome case map count');
assert(educationalValidityReviewPackets.summary.outcome_metric_review_packets === educationalOutcomesFramework.summary.total_metrics, 'Educational-validity metric packets must match outcome metric definitions');
assert(educationalValidityReviewPackets.summary.outcome_study_packets >= 4, 'Educational-validity packets must include response-process, pilot, multi-site, and transfer study packets');
assert(educationalValidityReviewPackets.summary.source_limited_metric_packets === educationalOutcomesFramework.summary.source_limited_metrics, 'Educational-validity source-limited metric packets must align with framework source-limited metrics');
assert(educationalValidityReviewPackets.summary.external_validation_metric_packets === educationalOutcomesFramework.summary.requires_external_validation_metrics, 'Educational-validity external-validation metric packets must align with framework external validation metrics');
assert(educationalValidityReviewPackets.summary.total_review_packets === (
  educationalValidityReviewPackets.summary.case_curriculum_mapping_packets
  + educationalValidityReviewPackets.summary.workflow_phase_review_packets
  + educationalValidityReviewPackets.summary.unsupported_epa_decision_packets
  + educationalValidityReviewPackets.summary.case_outcome_measurement_packets
  + educationalValidityReviewPackets.summary.outcome_metric_review_packets
  + educationalValidityReviewPackets.summary.outcome_study_packets
), 'Educational-validity packet total must equal component packet counts');
assert(educationalValidityReviewPackets.summary.pending_review_packets === educationalValidityReviewPackets.summary.total_review_packets, 'Educational-validity packets must remain pending until review inputs exist');
assert(educationalValidityReviewPackets.summary.reviewed_review_packets === 0, 'Educational-validity packets must not claim completed reviews');
assert(educationalValidityReviewPackets.summary.all_curriculum_outcome_gaps_packeted === true, 'Educational-validity packets must packet every current curriculum and outcome gap');
assert(educationalValidityReviewPackets.summary.ready_for_national_educational_release_from_packets === false, 'Educational-validity packets must not claim national educational release readiness');
assert(educationalValidityReviewPackets.case_curriculum_mapping_packets.length === cases.length, 'Educational-validity case curriculum packet rows must match case count');
assert(educationalValidityReviewPackets.workflow_phase_review_packets.length === coreEpaCurriculumMap.workflow_phase_map.length, 'Educational-validity workflow packet rows must match workflow phase count');
assert(educationalValidityReviewPackets.unsupported_epa_decision_packets.length === coreEpaCurriculumMap.summary.unsupported_epas, 'Educational-validity unsupported EPA packet rows must match unsupported EPA count');
assert(educationalValidityReviewPackets.case_outcome_measurement_packets.length === cases.length, 'Educational-validity case outcome packet rows must match case count');
assert(educationalValidityReviewPackets.outcome_metric_review_packets.length === educationalOutcomesFramework.summary.total_metrics, 'Educational-validity metric packet rows must match metric count');
assert(educationalValidityReviewPackets.outcome_study_packets.every((packet) => packet.current_valid_supporting_studies === 0), 'Educational-validity study packets must expose zero current valid supporting studies');
assert(educationalValidityReviewPackets.outcome_study_packets.some((packet) => packet.required_before === 'national_effectiveness_claims'), 'Educational-validity study packets must include national effectiveness evidence requirements');
assert(educationalValidityReviewPackets.outcome_study_packets.some((packet) => packet.required_before === 'hospital_performance_or_transfer_claims'), 'Educational-validity study packets must include hospital performance or transfer evidence requirements');
assert(educationalValidityReviewPackets.release_blockers.some((blocker) => blocker.id === 'curriculum_mapping_reviews_pending' && blocker.status === 'blocked'), 'Educational-validity packets must block on curriculum reviews');
assert(educationalValidityReviewPackets.release_blockers.some((blocker) => blocker.id === 'educational_outcome_studies_missing' && blocker.status === 'blocked'), 'Educational-validity packets must block on missing outcome studies');
assert(report.metrics.educational_validity.educational_validity_review_packets_present === true, 'Readiness report must include educational-validity review packet status');
assert(report.metrics.educational_validity.educational_validity_total_review_packets === educationalValidityReviewPackets.summary.total_review_packets, 'Readiness report must expose educational-validity packet total');
assert(report.metrics.educational_validity.educational_validity_case_curriculum_mapping_packets === educationalValidityReviewPackets.summary.case_curriculum_mapping_packets, 'Readiness report must expose curriculum case packet count');
assert(report.metrics.educational_validity.educational_validity_case_outcome_measurement_packets === educationalValidityReviewPackets.summary.case_outcome_measurement_packets, 'Readiness report must expose case outcome packet count');
assert(report.metrics.educational_validity.educational_validity_outcome_metric_review_packets === educationalValidityReviewPackets.summary.outcome_metric_review_packets, 'Readiness report must expose metric packet count');
assert(report.metrics.educational_validity.educational_validity_outcome_study_packets === educationalValidityReviewPackets.summary.outcome_study_packets, 'Readiness report must expose outcome study packet count');
assert(report.metrics.educational_validity.educational_validity_pending_review_packets === educationalValidityReviewPackets.summary.pending_review_packets, 'Readiness report must expose pending educational-validity packets');
assert(report.metrics.educational_validity.educational_validity_all_curriculum_outcome_gaps_packeted === true, 'Readiness report must expose educational-validity packet coverage');
assert(report.metrics.educational_validity.educational_validity_ready_for_national_release_from_packets === false, 'Readiness report must not claim educational-validity packet release readiness');
assert(educationalValidityReviewStatus.schema_version === 'educational_validity_review_status_v1', 'Unexpected educational-validity review status schema');
assert(
  educationalValidityReviewStatus.review_status === 'educational_validity_review_inputs_pending',
  'Educational-validity review status must remain pending until completed review inputs exist'
);
assert(educationalValidityReviewStatus.source_contract.educational_validity_review_packets_schema === educationalValidityReviewPackets.schema_version, 'Educational-validity review status must align with packet schema');
assert(educationalValidityReviewStatus.source_contract.curriculum_mapping_review_status_schema === curriculumMappingReviewStatus.schema_version, 'Educational-validity review status must align with curriculum mapping review status schema');
assert(educationalValidityReviewStatus.source_contract.educational_outcomes_validation_status_schema === educationalOutcomesValidationStatus.schema_version, 'Educational-validity review status must align with educational outcome validation schema');
assert(educationalValidityReviewStatus.source_contract.educational_outcomes_runtime_report_schema === educationalOutcomesRuntimeReport.schema_version, 'Educational-validity review status must align with educational outcome runtime schema');
assert(educationalValidityReviewStatus.source_contract.completed_review_file_present === false, 'Educational-validity review status must not claim a completed review file');
assert(educationalValidityReviewStatus.source_contract.required_completed_review_schema === 'educational_validity_reviews_v1', 'Educational-validity review status must declare the completed-review schema');
assert(educationalValidityReviewStatus.summary.review_file_present === false, 'Educational-validity review status summary must report no review file');
assert(educationalValidityReviewStatus.summary.total_review_packets === educationalValidityReviewPackets.summary.total_review_packets, 'Educational-validity review status packet total must align with packet artifact');
assert(educationalValidityReviewStatus.summary.case_curriculum_mapping_packets === educationalValidityReviewPackets.summary.case_curriculum_mapping_packets, 'Educational-validity review status case curriculum count must align with packet artifact');
assert(educationalValidityReviewStatus.summary.workflow_phase_review_packets === educationalValidityReviewPackets.summary.workflow_phase_review_packets, 'Educational-validity review status workflow count must align with packet artifact');
assert(educationalValidityReviewStatus.summary.unsupported_epa_decision_packets === educationalValidityReviewPackets.summary.unsupported_epa_decision_packets, 'Educational-validity review status unsupported EPA count must align with packet artifact');
assert(educationalValidityReviewStatus.summary.case_outcome_measurement_packets === educationalValidityReviewPackets.summary.case_outcome_measurement_packets, 'Educational-validity review status case outcome count must align with packet artifact');
assert(educationalValidityReviewStatus.summary.outcome_metric_review_packets === educationalValidityReviewPackets.summary.outcome_metric_review_packets, 'Educational-validity review status metric count must align with packet artifact');
assert(educationalValidityReviewStatus.summary.outcome_study_packets === educationalValidityReviewPackets.summary.outcome_study_packets, 'Educational-validity review status study count must align with packet artifact');
assert(educationalValidityReviewStatus.summary.submitted_educational_validity_reviews === 0, 'Educational-validity review status must not claim submitted reviews');
assert(educationalValidityReviewStatus.summary.valid_educational_validity_reviews === 0, 'Educational-validity review status must not claim valid reviews');
assert(educationalValidityReviewStatus.summary.nationally_approved_review_packets === 0, 'Educational-validity review status must not claim nationally approved packets');
assert(educationalValidityReviewStatus.summary.pending_review_packets === educationalValidityReviewPackets.summary.total_review_packets, 'Educational-validity review status must mark every packet pending');
assert(educationalValidityReviewStatus.summary.invalid_review_input_count === 0, 'Educational-validity review status must have zero invalid input when no review file exists');
assert(educationalValidityReviewStatus.summary.curriculum_ready_for_national_release === false, 'Educational-validity review status must expose curriculum not ready');
assert(educationalValidityReviewStatus.summary.educational_outcome_claims_ready === false, 'Educational-validity review status must expose outcome claims not ready');
assert(educationalValidityReviewStatus.summary.educational_outcome_runtime_ready === true, 'Educational-validity review status must expose currently passing outcome runtime probes');
assert(educationalValidityReviewStatus.summary.ready_for_national_educational_release_from_reviews === false, 'Educational-validity review status must not claim national release readiness');
assert(educationalValidityReviewStatus.educational_validity_review_status.length === educationalValidityReviewPackets.summary.total_review_packets, 'Educational-validity review status rows must align with packet total');
assert(educationalValidityReviewStatus.educational_validity_review_status.every((row) => row.review_status === 'not_submitted' && row.valid === false && row.nationally_approved === false), 'All current educational-validity review rows must remain pending and unapproved');
assert(educationalValidityReviewStatus.readiness_effect.educational_validity_gate_can_pass_from_current_reviews === false, 'Educational-validity status must not clear the gate from current reviews');
assert(educationalValidityReviewStatus.readiness_effect.improved_clinical_judgment_claims_blocked_without_outcome_evidence === true, 'Educational-validity status must block improved clinical judgment claims without outcome evidence');
assert(educationalValidityReviewStatus.readiness_effect.required_reviewer_role_coverage_enforced === true, 'Educational-validity status must enforce reviewer role coverage');
assert(educationalValidityReviewStatus.readiness_effect.restricted_data_leakage_block_enforced === true, 'Educational-validity status must enforce restricted data blocking');
assert(report.metrics.educational_validity.educational_validity_review_status_present === true, 'Readiness report must include educational-validity review status');
assert(report.metrics.educational_validity.educational_validity_review_total_packets === educationalValidityReviewStatus.summary.total_review_packets, 'Readiness report must expose educational-validity review status packet total');
assert(report.metrics.educational_validity.educational_validity_submitted_reviews === educationalValidityReviewStatus.summary.submitted_educational_validity_reviews, 'Readiness report must expose educational-validity submitted reviews');
assert(report.metrics.educational_validity.educational_validity_valid_reviews === educationalValidityReviewStatus.summary.valid_educational_validity_reviews, 'Readiness report must expose educational-validity valid reviews');
assert(report.metrics.educational_validity.educational_validity_nationally_approved_review_packets === educationalValidityReviewStatus.summary.nationally_approved_review_packets, 'Readiness report must expose educational-validity nationally approved packet count');
assert(report.metrics.educational_validity.educational_validity_review_pending_packets === educationalValidityReviewStatus.summary.pending_review_packets, 'Readiness report must expose educational-validity pending review count');
assert(report.metrics.educational_validity.educational_validity_review_invalid_inputs === educationalValidityReviewStatus.summary.invalid_review_input_count, 'Readiness report must expose educational-validity invalid review input count');
assert(report.metrics.educational_validity.educational_validity_review_ready_for_national_release === false, 'Readiness report must not claim educational-validity review release readiness');

assert(learnerSafetyRedTeam.schema_version === 'learner_safety_red_team_suite_v1', 'Unexpected learner safety red-team suite schema');
assert(learnerSafetyRedTeam.review_status === 'draft_needs_clinician_educator_safety_review', 'Learner safety red-team suite must remain draft until clinical safety review');
assert(learnerSafetyRedTeam.summary.covered_required_categories >= learnerSafetyRedTeam.summary.required_categories, 'Learner safety red-team suite must cover all required categories');
assert(learnerSafetyRedTeam.summary.runtime_passed_tests === 0, 'Learner safety suite must not claim runtime-passed tests');
assert(learnerSafetyRedTeam.summary.clinician_reviewed_tests === 0, 'Learner safety suite must not claim clinician-reviewed tests');
assert(learnerSafetyRuntimeReport.schema_version === 'learner_safety_red_team_runtime_report_v1', 'Unexpected learner safety runtime report schema');
assert(learnerSafetyRuntimeReport.summary.total_tests === learnerSafetyRedTeam.summary.total_tests, 'Learner safety runtime report test count must match suite');
assert(learnerSafetyRuntimeReport.summary.all_policy_tests_passed === true, 'Learner safety runtime policy probes must pass');
assert(learnerSafetyRuntimeReport.summary.all_required_categories_passed === true, 'Learner safety runtime report must pass every required category');
assert(learnerSafetyRuntimeReport.summary.clinician_reviewed_tests === 0, 'Runtime safety report must not claim clinician review');
assert(learnerSafetyReviewStatus.schema_version === 'learner_safety_review_status_v1', 'Unexpected learner safety review status schema');
assert(
  [
    'learner_safety_review_inputs_pending',
    'learner_safety_review_inputs_invalid',
    'learner_safety_review_inputs_partial',
    'learner_safety_review_complete_ready_for_readiness_gate'
  ].includes(learnerSafetyReviewStatus.review_status),
  'Learner safety review status must use a recognized review status'
);
assert(learnerSafetyReviewStatus.source_contract.learner_safety_red_team_suite_schema === 'learner_safety_red_team_suite_v1', 'Learner safety review status must point to the red-team suite schema');
assert(learnerSafetyReviewStatus.source_contract.learner_safety_runtime_report_schema === 'learner_safety_red_team_runtime_report_v1', 'Learner safety review status must point to the runtime report schema');
assert(learnerSafetyReviewStatus.summary.total_tests === learnerSafetyRedTeam.summary.total_tests, 'Learner safety review test count must align with suite');
assert(learnerSafetyReviewStatus.summary.review_file_present === false, 'Current learner safety review status must not claim a completed review file');
assert(learnerSafetyReviewStatus.summary.submitted_reviews === 0, 'Current learner safety review status must not claim submitted reviews');
assert(learnerSafetyReviewStatus.summary.valid_reviews === 0, 'Current learner safety review status must not claim valid reviews');
assert(learnerSafetyReviewStatus.summary.nationally_approved_tests === 0, 'Current learner safety review status must not claim nationally approved tests');
assert(learnerSafetyReviewStatus.summary.tests_missing_review === learnerSafetyRedTeam.summary.total_tests, 'Every current learner safety red-team test should remain missing review');
assert(learnerSafetyReviewStatus.summary.invalid_review_input_count === 0, 'Missing learner safety review file should not be treated as invalid input');
assert(learnerSafetyReviewStatus.summary.ready_for_national_learner_safety_release === false, 'Learner safety review status must not claim national release readiness');
assert(learnerSafetyReviewStatus.test_review_status.length === learnerSafetyRedTeam.summary.total_tests, 'Learner safety review rows must align with suite test count');
assert(learnerSafetyReviewStatus.readiness_effect.learner_safety_gate_can_pass_from_current_reviews === false, 'Current learner safety reviews must not clear the readiness gate');
assert(report.metrics.learner_safety.optional_ai_guardrail_runtime_report_present === true, 'Learner safety readiness metrics must include optional AI guardrail runtime status');
assert(report.metrics.learner_safety.optional_ai_guardrail_runtime_all_probes_passed === true, 'Learner safety readiness metrics must include passing optional AI guardrail probes');
assert(report.metrics.learner_safety.optional_ai_guardrail_openrouter_calls_before_optional_ai === 0, 'Learner safety readiness metrics must expose zero external calls before optional AI action');
assert(report.metrics.learner_safety.optional_ai_guardrail_bad_ai_debrief_blocked === true, 'Learner safety readiness metrics must expose bad optional AI debrief blocking');
assert(report.metrics.learner_safety.optional_ai_guardrail_bad_ai_support_quality_issue_visible === true, 'Learner safety readiness metrics must expose support-quality issue visibility');
assert(report.metrics.learner_safety.optional_ai_guardrail_bad_ai_debrief_content_not_rendered === true, 'Learner safety readiness metrics must expose bad optional AI debrief non-rendering');
assert(report.metrics.learner_safety.optional_ai_guardrail_unsafe_tutor_blocked_before_external_ai === true, 'Learner safety readiness metrics must expose unsafe tutor prompt blocking before external AI');
assert(report.metrics.learner_safety.optional_ai_guardrail_deterministic_debrief_preserved === true, 'Learner safety readiness metrics must expose deterministic debrief preservation');
assert(report.metrics.learner_safety.red_team_review_status_present === true, 'Readiness report must include learner safety review status');
assert(report.metrics.learner_safety.red_team_submitted_reviews === 0, 'Readiness report must expose zero submitted learner safety reviews');
assert(report.metrics.learner_safety.red_team_valid_reviews === 0, 'Readiness report must expose zero valid learner safety reviews');
assert(report.metrics.learner_safety.red_team_nationally_approved_tests === 0, 'Readiness report must expose zero nationally approved learner safety tests');
assert(report.metrics.learner_safety.red_team_tests_missing_review === learnerSafetyRedTeam.summary.total_tests, 'Readiness report must expose missing learner safety reviews');
assert(report.metrics.learner_safety.red_team_invalid_review_inputs === 0, 'Readiness report must expose zero invalid learner safety review inputs');
assert(report.metrics.learner_safety.red_team_review_ready_for_national_release === false, 'Readiness report must not claim learner safety review release readiness');

assert(learnerSafetyReviewPackets.schema_version === 'learner_safety_review_packets_v1', 'Unexpected learner-safety review packet schema');
assert(
  learnerSafetyReviewPackets.review_status === 'learner_safety_review_packets_open_clinician_educator_review_required',
  'Learner-safety packets must expose open clinician and educator review work'
);
assert(learnerSafetyReviewPackets.source_contract.learner_safety_red_team_suite_schema === learnerSafetyRedTeam.schema_version, 'Learner-safety packets must align with red-team suite schema');
assert(learnerSafetyReviewPackets.source_contract.learner_safety_runtime_report_schema === learnerSafetyRuntimeReport.schema_version, 'Learner-safety packets must align with runtime report schema');
assert(learnerSafetyReviewPackets.source_contract.learner_safety_review_status_schema === learnerSafetyReviewStatus.schema_version, 'Learner-safety packets must align with learner safety review status schema');
assert(learnerSafetyReviewPackets.source_contract.optional_ai_guardrail_runtime_report_schema === optionalAiGuardrailRuntimeReport.schema_version, 'Learner-safety packets must align with optional AI guardrail runtime schema');
assert(learnerSafetyReviewPackets.source_contract.runtime_pass_alone_authorizes_national_use === false, 'Learner-safety packets must not allow runtime pass alone to authorize national use');
assert(learnerSafetyReviewPackets.summary.red_team_test_review_packets === learnerSafetyRedTeam.summary.total_tests, 'Learner-safety red-team packet count must match suite tests');
assert(learnerSafetyReviewPackets.summary.optional_ai_guardrail_review_packets === 1, 'Learner-safety packets must include one optional AI guardrail system review packet');
assert(learnerSafetyReviewPackets.summary.total_review_packets === learnerSafetyReviewPackets.summary.red_team_test_review_packets + learnerSafetyReviewPackets.summary.optional_ai_guardrail_review_packets, 'Learner-safety packet total must equal red-team plus optional-AI packet counts');
assert(learnerSafetyReviewPackets.summary.required_categories === learnerSafetyRedTeam.summary.required_categories, 'Learner-safety packet required category count must align with suite');
assert(learnerSafetyReviewPackets.summary.required_categories_packeted === learnerSafetyRedTeam.summary.required_categories, 'Learner-safety packets must packet every required category');
assert(learnerSafetyReviewPackets.summary.missing_required_categories.length === 0, 'Learner-safety packets must not miss required categories');
assert(learnerSafetyReviewPackets.summary.all_required_categories_packeted === true, 'Learner-safety packets must expose complete required-category coverage');
assert(learnerSafetyReviewPackets.summary.runtime_passed_red_team_packets === learnerSafetyRuntimeReport.summary.passed_policy_tests, 'Learner-safety packet runtime pass count must align with runtime report');
assert(learnerSafetyReviewPackets.summary.runtime_failed_red_team_packets === learnerSafetyRuntimeReport.summary.failed_policy_tests, 'Learner-safety packet runtime fail count must align with runtime report');
assert(learnerSafetyReviewPackets.summary.optional_ai_guardrail_runtime_passed === optionalAiGuardrailRuntimeReport.summary.all_runtime_probes_passed, 'Learner-safety optional AI packet runtime readiness must align with optional AI guardrail report');
assert(learnerSafetyReviewPackets.summary.pending_review_packets === learnerSafetyReviewPackets.summary.total_review_packets, 'Learner-safety packets must remain pending until safety review inputs exist');
assert(learnerSafetyReviewPackets.summary.reviewed_review_packets === 0, 'Learner-safety packets must not claim completed reviews');
assert(learnerSafetyReviewPackets.summary.learner_safety_reviews_submitted === learnerSafetyReviewStatus.summary.submitted_reviews, 'Learner-safety packet submitted review count must align with review status');
assert(learnerSafetyReviewPackets.summary.learner_safety_valid_reviews === learnerSafetyReviewStatus.summary.valid_reviews, 'Learner-safety packet valid review count must align with review status');
assert(learnerSafetyReviewPackets.summary.learner_safety_tests_missing_review === learnerSafetyReviewStatus.summary.tests_missing_review, 'Learner-safety packet missing review count must align with review status');
assert(learnerSafetyReviewPackets.summary.ready_for_national_learner_safety_release_from_packets === false, 'Learner-safety packets must not claim national release readiness');
assert(learnerSafetyReviewPackets.red_team_test_review_packets.length === learnerSafetyRedTeam.summary.total_tests, 'Learner-safety red-team packet rows must match suite tests');
assert(learnerSafetyReviewPackets.optional_ai_guardrail_review_packets.length === 1, 'Learner-safety optional AI packet rows must include one system packet');
assert(learnerSafetyReviewPackets.red_team_test_review_packets.every((packet) => packet.current_runtime_passed === true), 'Every current learner-safety packet should expose a passing runtime probe');
assert(learnerSafetyReviewPackets.red_team_test_review_packets.every((packet) => packet.reviewer_roles_required.includes('simulation_educator')), 'Every learner-safety red-team packet must require simulation educator review');
assert(learnerSafetyReviewPackets.red_team_test_review_packets.every((packet) => packet.reviewer_roles_required.includes('emergency_clinician_or_patient_safety_reviewer')), 'Every learner-safety red-team packet must require clinician or patient-safety review');
assert(learnerSafetyReviewPackets.optional_ai_guardrail_review_packets[0].reviewer_roles_required.includes('clinical_informatics_or_ai_safety_reviewer'), 'Optional AI guardrail packet must require AI safety review');
assert(learnerSafetyReviewPackets.optional_ai_guardrail_review_packets[0].reviewer_roles_required.includes('privacy_or_data_governance_reviewer'), 'Optional AI guardrail packet must require privacy/governance review');
assert(learnerSafetyReviewPackets.release_blockers.some((blocker) => blocker.id === 'learner_safety_clinician_educator_reviews_pending' && blocker.status === 'blocked'), 'Learner-safety packets must block on missing clinician/educator reviews');
assert(learnerSafetyReviewPackets.release_blockers.some((blocker) => blocker.id === 'optional_ai_guardrail_system_review_pending' && blocker.status === 'blocked'), 'Learner-safety packets must block on optional AI guardrail review');
assert(report.metrics.learner_safety.learner_safety_review_packets_present === true, 'Readiness report must include learner-safety review packet status');
assert(report.metrics.learner_safety.learner_safety_total_review_packets === learnerSafetyReviewPackets.summary.total_review_packets, 'Readiness report must expose learner-safety packet total');
assert(report.metrics.learner_safety.learner_safety_red_team_test_review_packets === learnerSafetyReviewPackets.summary.red_team_test_review_packets, 'Readiness report must expose learner-safety red-team packet count');
assert(report.metrics.learner_safety.learner_safety_optional_ai_guardrail_review_packets === learnerSafetyReviewPackets.summary.optional_ai_guardrail_review_packets, 'Readiness report must expose optional AI guardrail packet count');
assert(report.metrics.learner_safety.learner_safety_all_required_categories_packeted === true, 'Readiness report must expose all learner-safety categories as packeted');
assert(report.metrics.learner_safety.learner_safety_pending_review_packets === learnerSafetyReviewPackets.summary.pending_review_packets, 'Readiness report must expose pending learner-safety packet count');
assert(report.metrics.learner_safety.learner_safety_ready_for_national_release_from_packets === false, 'Readiness report must not claim learner-safety packet release readiness');

assert(governanceInventory.schema_version === 'governance_data_inventory_v1', 'Unexpected governance inventory schema');
assert(governanceInventory.review_status === 'draft_needs_institutional_privacy_security_review', 'Governance inventory must remain draft until institutional review');
assert(governanceInventory.deployment_model.default_workflow_network_requests === false, 'Default public workflow should not require network requests');
assert(institutionalGovernanceReviewStatus.schema_version === 'institutional_governance_review_status_v1', 'Unexpected institutional governance review status schema');
assert(institutionalGovernanceReviewStatus.review_status === 'institutional_governance_review_inputs_pending', 'Institutional governance review status should remain pending until completed review inputs are submitted');
assert(institutionalGovernanceReviewStatus.source_contract.governance_data_inventory_schema === governanceInventory.schema_version, 'Institutional governance review status must align with governance inventory schema');
assert(institutionalGovernanceReviewStatus.source_contract.completed_review_file_present === false, 'Institutional governance review status must not claim a completed review file');
assert(institutionalGovernanceReviewStatus.summary.required_domains >= 9, 'Institutional governance review status should require privacy, accessibility, operations, AI, research, and multi-institution domains');
assert(institutionalGovernanceReviewStatus.summary.submitted_reviews === 0, 'Institutional governance review status must expose zero submitted reviews');
assert(institutionalGovernanceReviewStatus.summary.valid_reviews === 0, 'Institutional governance review status must expose zero valid reviews');
assert(institutionalGovernanceReviewStatus.summary.nationally_approved_domains === 0, 'Institutional governance review status must expose zero nationally approved domains');
assert(institutionalGovernanceReviewStatus.summary.domains_missing_review === institutionalGovernanceReviewStatus.summary.required_domains, 'All institutional governance domains should remain missing review');
assert(institutionalGovernanceReviewStatus.summary.invalid_review_input_count === 0, 'Institutional governance review status must expose zero invalid review inputs when no review file exists');
assert(institutionalGovernanceReviewStatus.summary.ready_for_national_institutional_release === false, 'Institutional governance review status must not claim national release readiness');
assert(institutionalGovernanceReviewStatus.domain_review_status.length === institutionalGovernanceReviewStatus.summary.required_domains, 'Institutional governance domain review rows must align with required domains');
assert(institutionalGovernanceReviewStatus.readiness_effect.scale_governance_gate_can_pass_from_current_reviews === false, 'Institutional governance reviews must not permit the scale/governance gate to pass yet');
assert(institutionalGovernanceReviewPackets.schema_version === 'institutional_governance_review_packets_v1', 'Unexpected institutional governance review packet schema');
assert(
  institutionalGovernanceReviewPackets.review_status === 'institutional_governance_review_packets_open_institutional_review_required',
  'Institutional governance review packets must remain open until institutional reviews and release evidence are complete'
);
assert(institutionalGovernanceReviewPackets.source_contract.governance_data_inventory_schema === governanceInventory.schema_version, 'Governance packets must align with governance inventory schema');
assert(institutionalGovernanceReviewPackets.source_contract.institutional_governance_review_status_schema === institutionalGovernanceReviewStatus.schema_version, 'Governance packets must align with governance review status schema');
assert(institutionalGovernanceReviewPackets.source_contract.scale_operations_runtime_report_schema === scaleOperationsRuntimeReport.schema_version, 'Governance packets must align with scale runtime schema');
assert(institutionalGovernanceReviewPackets.source_contract.accessibility_readiness_report_schema === accessibilityReadinessReport.schema_version, 'Governance packets must align with accessibility report schema');
assert(institutionalGovernanceReviewPackets.summary.domain_review_packets === institutionalGovernanceReviewStatus.summary.required_domains, 'Governance packet domain count must match required governance domains');
assert(institutionalGovernanceReviewPackets.summary.release_evidence_packets === 5, 'Governance packets must include five release-evidence blockers');
assert(institutionalGovernanceReviewPackets.summary.total_review_packets === institutionalGovernanceReviewPackets.summary.domain_review_packets + institutionalGovernanceReviewPackets.summary.release_evidence_packets, 'Governance packet total must equal domain plus release-evidence packets');
assert(institutionalGovernanceReviewPackets.summary.pending_review_packets === institutionalGovernanceReviewPackets.summary.total_review_packets, 'All governance packets should remain pending in the current state');
assert(institutionalGovernanceReviewPackets.summary.all_required_domains_packeted === true, 'Governance packets must cover every required governance domain');
assert(institutionalGovernanceReviewPackets.summary.all_release_evidence_packeted === true, 'Governance packets must cover every release-evidence blocker');
assert(institutionalGovernanceReviewPackets.summary.ready_for_national_governance_release_from_packets === false, 'Governance packets must not claim national release readiness');
assert(institutionalGovernanceReviewPackets.domain_review_packets.length === institutionalGovernanceReviewStatus.domain_review_status.length, 'Governance domain packet rows must match governance domain status rows');
const governanceStatusByDomain = new Map(institutionalGovernanceReviewStatus.domain_review_status.map((row) => [row.domain, row]));
const governancePolicyByDomain = new Map(institutionalGovernanceReviewStatus.domain_policies.map((row) => [row.domain, row]));
for (const packet of institutionalGovernanceReviewPackets.domain_review_packets) {
  const statusRow = governanceStatusByDomain.get(packet.domain);
  const policy = governancePolicyByDomain.get(packet.domain);
  assert(statusRow, `Governance packet domain ${packet.domain} must exist in review status`);
  assert(policy, `Governance packet domain ${packet.domain} must exist in domain policies`);
  assert(packet.packet_type === 'institutional_governance_domain_review', 'Governance domain packets must use the domain packet type');
  assert(packet.current_decision === statusRow.decision, `Governance packet ${packet.domain} decision must align with review status`);
  assert(packet.current_review_valid === Boolean(statusRow.valid), `Governance packet ${packet.domain} validity must align with review status`);
  assert(packet.current_nationally_approved === false, `Governance packet ${packet.domain} must not claim national approval`);
  assert(packet.external_review_required === true, `Governance packet ${packet.domain} must require external institutional review`);
  assert(JSON.stringify(packet.required_roles) === JSON.stringify(policy.required_roles), `Governance packet ${packet.domain} roles must align with policy`);
  assert(JSON.stringify(packet.required_scope) === JSON.stringify(policy.required_scope), `Governance packet ${packet.domain} scope must align with policy`);
  assert(JSON.stringify(packet.required_artifacts) === JSON.stringify(policy.required_artifacts), `Governance packet ${packet.domain} artifacts must align with policy`);
  assert(packet.review_submission_template.domain === packet.domain, `Governance packet ${packet.domain} template must name the same domain`);
  assert(packet.review_submission_template.decision.includes('approved_for_national_release'), `Governance packet ${packet.domain} template must include national-release decision option`);
}
const releaseEvidenceIds = new Set(institutionalGovernanceReviewPackets.release_evidence_packets.map((packet) => packet.id));
for (const requiredId of [
  'institutional_governance_evidence_data_inventory_approval',
  'institutional_governance_evidence_production_load_test',
  'institutional_governance_evidence_monitoring_dashboard',
  'institutional_governance_evidence_incident_response_drill',
  'institutional_governance_evidence_manual_wcag_audit'
]) {
  assert(releaseEvidenceIds.has(requiredId), `Governance release evidence packet missing: ${requiredId}`);
}
assert(institutionalGovernanceReviewPackets.release_evidence_packets.every((packet) => packet.current_ready === false), 'Current governance release-evidence packets must remain pending');
assert(institutionalGovernanceReviewPackets.release_evidence_packets.every((packet) => packet.reviewer_roles_required.length > 0), 'Every governance release-evidence packet must require a reviewer role');
assert(institutionalGovernanceReviewPackets.release_blockers.some((blocker) => blocker.id === 'institutional_governance_domain_reviews_pending' && blocker.status === 'blocked'), 'Governance packets must block on missing domain reviews');
assert(institutionalGovernanceReviewPackets.release_blockers.some((blocker) => blocker.id === 'institutional_governance_release_evidence_pending' && blocker.status === 'blocked'), 'Governance packets must block on missing release evidence');
assert(institutionalGovernanceReviewPackets.release_blockers.some((blocker) => blocker.id === 'institutional_governance_completed_review_file_missing' && blocker.status === 'blocked'), 'Governance packets must block on missing completed review file');
assert(report.metrics.scale_governance_accessibility.institutional_governance_review_status_present === true, 'Readiness report must include institutional governance review status');
assert(report.metrics.scale_governance_accessibility.institutional_governance_submitted_reviews === 0, 'Readiness report must expose zero submitted institutional governance reviews');
assert(report.metrics.scale_governance_accessibility.institutional_governance_valid_reviews === 0, 'Readiness report must expose zero valid institutional governance reviews');
assert(report.metrics.scale_governance_accessibility.institutional_governance_nationally_approved_domains === 0, 'Readiness report must expose zero nationally approved institutional governance domains');
assert(report.metrics.scale_governance_accessibility.institutional_governance_domains_missing_review === institutionalGovernanceReviewStatus.summary.required_domains, 'Readiness report must expose missing institutional governance domains');
assert(report.metrics.scale_governance_accessibility.institutional_governance_invalid_review_inputs === 0, 'Readiness report must expose zero invalid institutional governance review inputs');
assert(report.metrics.scale_governance_accessibility.institutional_governance_ready_for_national_release === false, 'Readiness report must not claim institutional governance release readiness');
assert(report.metrics.scale_governance_accessibility.institutional_governance_review_packets_present === true, 'Readiness report must include institutional governance packet status');
assert(report.metrics.scale_governance_accessibility.institutional_governance_total_review_packets === institutionalGovernanceReviewPackets.summary.total_review_packets, 'Readiness report must expose governance packet total');
assert(report.metrics.scale_governance_accessibility.institutional_governance_domain_review_packets === institutionalGovernanceReviewPackets.summary.domain_review_packets, 'Readiness report must expose governance domain packet count');
assert(report.metrics.scale_governance_accessibility.institutional_governance_release_evidence_packets === institutionalGovernanceReviewPackets.summary.release_evidence_packets, 'Readiness report must expose governance release-evidence packet count');
assert(report.metrics.scale_governance_accessibility.institutional_governance_pending_review_packets === institutionalGovernanceReviewPackets.summary.pending_review_packets, 'Readiness report must expose pending governance packet count');
assert(report.metrics.scale_governance_accessibility.institutional_governance_all_required_domains_packeted === true, 'Readiness report must expose governance domain packet coverage');
assert(report.metrics.scale_governance_accessibility.institutional_governance_all_release_evidence_packeted === true, 'Readiness report must expose governance release-evidence packet coverage');
assert(report.metrics.scale_governance_accessibility.institutional_governance_ready_for_national_release_from_packets === false, 'Readiness report must not claim governance packet release readiness');
assert(report.metrics.scale_governance_accessibility.institutional_review_ready === false, 'Readiness report must not claim institutional review readiness');
assert(scaleBundleReport.schema_version === 'scale_bundle_readiness_report_v1', 'Unexpected scale bundle report schema');
assert(scaleBundleReport.source_contract.legacy_simulator_lazy_loaded === true, 'Legacy simulator must be lazy-loaded off the default route');
assert(scaleBundleReport.source_contract.legacy_simulator_static_import_present === false, 'Legacy simulator must not be statically imported by the default app route');
if (scaleBundleReport.dist.dist_present) {
  assert(scaleBundleReport.summary.default_route_initial_budget_passed === true, 'Default route initial bundle budget must pass when dist is present');
  assert(scaleBundleReport.summary.initial_js_kb <= scaleBundleReport.budget_policy.initial_js_limit_kb, 'Default route JS must stay within bundle budget');
  assert(scaleBundleReport.summary.initial_css_kb <= scaleBundleReport.budget_policy.initial_css_limit_kb, 'Default route CSS must stay within bundle budget');
}
assert(report.metrics.scale_governance_accessibility.scale_bundle_report_present === true, 'Readiness report must include scale bundle report status');
assert(report.metrics.scale_governance_accessibility.default_route_code_split_present === true, 'Readiness report must include default route code-splitting status');
assert(report.metrics.scale_governance_accessibility.default_route_initial_budget_passed === true, 'Readiness report must include passing default route budget status');
assert(scaleOperationsRuntimeReport.schema_version === 'scale_operations_runtime_report_v1', 'Unexpected scale operations runtime report schema');
assert(scaleOperationsRuntimeReport.review_status === 'runtime_scale_smoke_passed_load_monitoring_required', 'Scale operations runtime report must require formal load/monitoring evidence');
assert(scaleOperationsRuntimeReport.summary.total_probes >= 6, 'Scale operations runtime report should include static route, asset, fallback, and concurrency probes');
assert(scaleOperationsRuntimeReport.summary.all_probes_passed === true, 'Scale operations runtime probes must pass');
assert(scaleOperationsRuntimeReport.summary.spa_fallback_present === true, 'Static deployment must include SPA fallback for direct routes');
assert(scaleOperationsRuntimeReport.summary.legacy_route_bootstrap_ok === true, 'Legacy direct route should bootstrap via SPA fallback');
assert(scaleOperationsRuntimeReport.summary.concurrent_smoke_requests >= 40, 'Scale operations runtime report should run bounded concurrency smoke requests');
assert(scaleOperationsRuntimeReport.summary.production_load_test_completed === false, 'Scale operations runtime report must not claim formal production load testing');
assert(scaleOperationsRuntimeReport.summary.production_monitoring_dashboard_operational === false, 'Scale operations runtime report must not claim operational monitoring');
assert(scaleOperationsRuntimeReport.summary.incident_response_drill_completed === false, 'Scale operations runtime report must not claim incident-response drill completion');
assert(report.metrics.scale_governance_accessibility.scale_operations_runtime_report_present === true, 'Readiness report must include scale operations runtime status');
assert(report.metrics.scale_governance_accessibility.scale_operations_runtime_all_probes_passed === true, 'Readiness report must include passing scale runtime probes');
assert(report.metrics.scale_governance_accessibility.scale_operations_spa_fallback_present === true, 'Readiness report must include SPA fallback status');
assert(report.metrics.scale_governance_accessibility.scale_operations_legacy_route_bootstrap_ok === true, 'Readiness report must include legacy route fallback status');
assert(report.metrics.scale_governance_accessibility.scale_operations_production_load_test_completed === false, 'Readiness report must not claim formal production load testing');
assert(routeReachabilityReport.schema_version === 'route_reachability_report_v1', 'Unexpected route reachability report schema');
assert(routeReachabilityReport.review_status === 'route_reachability_smoke_passed_manual_browser_qa_required', 'Route reachability report must require manual browser QA after smoke probes');
assert(routeReachabilityReport.summary.total_route_probes >= 3, 'Route reachability report should cover default, legacy path, and legacy query routes');
assert(routeReachabilityReport.summary.all_route_probes_passed === true, 'Route reachability probes must pass');
assert(routeReachabilityReport.summary.default_flowboard_route_rendered === true, 'Default flowboard route must render');
assert(routeReachabilityReport.summary.legacy_path_route_rendered === true, 'Legacy path route must render');
assert(routeReachabilityReport.summary.legacy_query_route_rendered === true, 'Legacy query route must render');
assert(routeReachabilityReport.summary.wrong_app_shell_findings === 0, 'Route reachability must not find stale or wrong app shell text');
assert(routeReachabilityReport.routes.every((route) => route.root_child_count > 0), 'Every route probe must render React content');
assert(report.metrics.scale_governance_accessibility.route_reachability_report_present === true, 'Readiness report must include route reachability status');
assert(report.metrics.scale_governance_accessibility.route_reachability_all_probes_passed === true, 'Readiness report must include passing route reachability probes');
assert(report.metrics.scale_governance_accessibility.route_reachability_wrong_app_shell_findings === 0, 'Readiness report must expose zero wrong-shell route findings');
assert(accessibilityReadinessReport.schema_version === 'accessibility_readiness_report_v1', 'Unexpected accessibility readiness report schema');
assert(accessibilityReadinessReport.review_status === 'automated_static_audit_complete_manual_wcag_required', 'Accessibility report must require manual WCAG review');
assert(accessibilityReadinessReport.summary.default_route_static_accessibility_ready === true, 'Default route must clear static accessibility release-blocker checks');
assert(accessibilityReadinessReport.summary.critical_static_issue_count === 0, 'Accessibility report must not include critical static issues');
assert(accessibilityReadinessReport.summary.unnamed_button_count === 0, 'Default route buttons must have accessible names');
assert(accessibilityReadinessReport.summary.unnamed_form_control_count === 0, 'Default route form controls must have accessible names');
assert(accessibilityReadinessReport.summary.focus_visible_present === true, 'Default route must expose visible keyboard focus styling');
assert(accessibilityReadinessReport.summary.automated_keyboard_smoke_present === true, 'Default route must include automated keyboard smoke coverage');
assert(accessibilityReadinessReport.summary.default_landmarks_present === true, 'Default route must expose named landmarks');
assert(accessibilityReadinessReport.summary.manual_wcag_required === true, 'Accessibility report must not claim full WCAG approval');
assert(report.metrics.scale_governance_accessibility.accessibility_readiness_report_present === true, 'Readiness report must include accessibility readiness status');
assert(report.metrics.scale_governance_accessibility.accessibility_default_route_static_accessibility_ready === true, 'Readiness report must include default-route accessibility static readiness');
assert(report.metrics.scale_governance_accessibility.accessibility_critical_static_issue_count === 0, 'Readiness report must include zero critical accessibility static issues');
assert(report.metrics.scale_governance_accessibility.accessibility_automated_keyboard_smoke_present === true, 'Readiness report must include automated keyboard smoke coverage');
assert(report.metrics.scale_governance_accessibility.accessibility_manual_wcag_required === true, 'Readiness report must preserve manual WCAG requirement');

assert(rubric.schema_version === 'medical_education_validation_rubric_v1', 'Unexpected validation rubric schema');
assert(rubric.criteria.length >= 25, 'Validation rubric should cover at least 25 paper-informed criteria');
assert(rubric.summary.external_review_passes === 0, 'No externally reviewed criterion should pass without actual external review evidence');
assert(rubric.criteria.some((item) => item.status === 'fail'), 'Validation rubric must expose remaining failures');
assert(rubric.criteria.some((item) => item.status === 'partial'), 'Validation rubric must expose partial draft progress');
assert(rubric.criteria.some((item) => item.status === 'pass'), 'Validation rubric should record verified local engineering passes');

const summary = {
  verdict: report.verdict,
  case_count: cases.length,
  case_truth_pending: truthPackets.summary.pending_case_truth_packets,
  case_truth_source_limitations_packeted: truthPackets.summary.source_limitations_packeted,
  case_truth_simulation_reveal_scaffolds_packeted: truthPackets.summary.simulation_reveal_scaffolds_packeted,
  case_truth_packets_with_all_source_limitations_scaffolded:
    truthPackets.summary.packets_with_all_source_limitations_scaffolded,
  case_truth_packets_with_unscaffolded_source_limitations:
    truthPackets.summary.packets_with_unscaffolded_source_limitations,
  case_truth_packet_scaffold_completeness_ready:
    truthPackets.summary.review_packet_scaffold_completeness_ready,
  case_truth_adjudication_ready: clinicalReviewAdjudicationStatus.case_truth.ready_case_truth_adjudications,
  case_truth_adjudication_work_items: caseTruthAdjudicationWorklist.summary.total_work_items,
  case_truth_adjudication_worklist_pending: caseTruthAdjudicationWorklist.summary.pending_case_truth_adjudications,
  case_truth_adjudication_worklist_release_blockers: caseTruthAdjudicationWorklist.summary.total_release_blockers,
  case_truth_adjudication_worklist_ready_for_national_release:
    caseTruthAdjudicationWorklist.summary.ready_for_national_case_truth_release_from_worklist,
  case_quality_draft_scaffold_eligible: caseGenerationQualityReport.summary.draft_practice_scaffold_eligible_cases,
  case_quality_national_release_eligible: caseGenerationQualityReport.summary.national_release_eligible_cases,
  case_quality_construction_gap_cases: caseGenerationQualityReport.summary.cases_with_augmentation_issues,
  case_quality_missing_source_evidence_cases: caseGenerationQualityReport.summary.cases_with_missing_source_evidence,
  case_quality_simulation_gap_cases: caseGenerationQualityReport.summary.cases_with_simulation_structuring_gaps,
  case_bank_case_count_shortfall: caseBankExpansionStatus.summary.case_count_shortfall,
  case_bank_target_gap_count: caseBankExpansionStatus.summary.target_gap_count,
  case_bank_recommended_minimum_new_cases: caseBankExpansionStatus.summary.recommended_minimum_new_cases,
  case_bank_expansion_target_gap_packets: caseBankExpansionPackets.summary.target_gap_packets,
  case_bank_expansion_blueprint_slots: caseBankExpansionPackets.summary.blueprint_slots,
  case_bank_expansion_all_target_shortfalls_have_blueprint_coverage:
    caseBankExpansionPackets.summary.all_target_shortfalls_have_blueprint_coverage,
  case_bank_expansion_review_status: caseBankExpansionReviewStatus.review_status,
  case_bank_expansion_submitted_blueprint_reviews:
    caseBankExpansionReviewStatus.summary.submitted_blueprint_reviews,
  case_bank_expansion_valid_blueprint_reviews:
    caseBankExpansionReviewStatus.summary.valid_blueprint_reviews,
  case_bank_expansion_national_countable_blueprint_reviews:
    caseBankExpansionReviewStatus.summary.national_countable_blueprint_reviews,
  case_bank_expansion_pending_blueprint_reviews:
    caseBankExpansionReviewStatus.summary.pending_blueprint_reviews,
  case_bank_expansion_review_ready_for_national_release:
    caseBankExpansionReviewStatus.summary.ready_for_national_case_bank_release_from_reviews,
  case_bank_ready_for_national_release: caseBankExpansionStatus.summary.ready_for_national_case_bank_release,
  weakness_register_total: weaknessRegister.summary.total_weaknesses,
  weakness_register_requirement_met: weaknessRegister.summary.weakness_count_requirement_met,
  weakness_register_local_runtime_mitigations_verified: weaknessRegister.summary.local_runtime_mitigations_verified,
  evidence_pending_chunks: evidenceBacklog.summary.pending_generated_or_unverified_chunks,
  open_evidence_grounding_review_packets:
    openEvidenceGroundingReviewPackets.summary.total_review_packets,
  open_evidence_grounding_generated_backlog_review_packets:
    openEvidenceGroundingReviewPackets.summary.generated_backlog_review_packets,
  open_evidence_grounding_release_blocker_packets:
    openEvidenceGroundingReviewPackets.summary.release_blocker_packets,
  open_evidence_grounding_generated_chunks_packeted:
    openEvidenceGroundingReviewPackets.summary.generated_needs_review_chunks_packeted,
  open_evidence_grounding_all_review_batches_packeted:
    openEvidenceGroundingReviewPackets.summary.all_review_batches_packeted,
  open_evidence_grounding_ready_for_national_release_from_packets:
    openEvidenceGroundingReviewPackets.summary.ready_for_national_open_evidence_release_from_packets,
  open_evidence_grounding_review_status:
    openEvidenceGroundingReviewStatus.review_status,
  open_evidence_grounding_review_total_packets:
    openEvidenceGroundingReviewStatus.summary.total_review_packets,
  open_evidence_grounding_review_submitted_reviews:
    openEvidenceGroundingReviewStatus.summary.submitted_grounding_reviews,
  open_evidence_grounding_review_valid_reviews:
    openEvidenceGroundingReviewStatus.summary.valid_grounding_reviews,
  open_evidence_grounding_review_cleared_packets:
    openEvidenceGroundingReviewStatus.summary.cleared_review_packets,
  open_evidence_grounding_review_pending_packets:
    openEvidenceGroundingReviewStatus.summary.pending_review_packets,
  open_evidence_grounding_review_ready_for_national_release:
    openEvidenceGroundingReviewStatus.summary.ready_for_national_open_evidence_release_from_reviews,
  evidence_adjudication_approved_chunks: clinicalReviewAdjudicationStatus.evidence.approved_chunks,
  clinical_review_adjudication_status: clinicalReviewAdjudicationStatus.review_status,
  feedback_traceability_source_limited_rows: feedbackTraceabilityMatrix.summary.source_limited_formative_rows,
  feedback_traceability_ready_for_release: feedbackTraceabilityMatrix.summary.ready_for_national_feedback_release,
  feedback_integrity_runtime_probes: feedbackIntegrityRuntimeReport.summary.total_runtime_probes,
  feedback_integrity_runtime_openrouter_calls_before_optional_ai: feedbackIntegrityRuntimeReport.summary.openrouter_calls_before_optional_ai,
  feedback_case_domain_review_packets: feedbackCaseDomainReviewPackets.summary.total_review_packets,
  feedback_case_domain_source_limited_packets: feedbackCaseDomainReviewPackets.summary.source_limited_packets,
  feedback_case_domain_all_rows_packeted: feedbackCaseDomainReviewPackets.summary.all_case_domain_rows_packeted,
  feedback_case_domain_pending_review_packets: feedbackCaseDomainReviewPackets.summary.pending_review_packets,
  feedback_case_domain_ready_for_national_release_from_packets:
    feedbackCaseDomainReviewPackets.summary.ready_for_national_feedback_release_from_packets,
  feedback_case_domain_calibration_status: feedbackCaseDomainCalibrationReviewStatus.review_status,
  feedback_case_domain_calibration_submitted_reviews:
    feedbackCaseDomainCalibrationReviewStatus.summary.submitted_case_domain_reviews,
  feedback_case_domain_calibration_valid_reviews:
    feedbackCaseDomainCalibrationReviewStatus.summary.valid_case_domain_reviews,
  feedback_case_domain_calibration_pending_reviews:
    feedbackCaseDomainCalibrationReviewStatus.summary.pending_case_domain_reviews,
  feedback_case_domain_calibration_invalid_review_inputs:
    feedbackCaseDomainCalibrationReviewStatus.summary.invalid_review_input_count,
  feedback_case_domain_calibration_ready_for_national_release:
    feedbackCaseDomainCalibrationReviewStatus.summary.ready_for_national_feedback_release,
  optional_ai_guardrail_runtime_probes: optionalAiGuardrailRuntimeReport.summary.total_runtime_probes,
  optional_ai_guardrail_openrouter_calls_before_optional_ai: optionalAiGuardrailRuntimeReport.summary.openrouter_calls_before_optional_ai,
  optional_ai_guardrail_openrouter_calls_after_bad_ai_debrief: optionalAiGuardrailRuntimeReport.summary.openrouter_calls_after_bad_ai_debrief,
  optional_ai_guardrail_openrouter_calls_after_unsafe_tutor: optionalAiGuardrailRuntimeReport.summary.openrouter_calls_after_unsafe_tutor,
  optional_ai_guardrail_support_quality_issue_visible: optionalAiGuardrailRuntimeReport.summary.bad_ai_debrief_support_quality_issue_visible,
  feedback_claim_entailment_packets: feedbackClaimEntailmentReviewPackets.summary.total_claim_sets,
  feedback_claim_entailment_adjudication_status: feedbackClaimEntailmentAdjudicationStatus.review_status,
  feedback_claim_entailment_reviewed_claim_sets: feedbackClaimEntailmentReviewPackets.summary.reviewed_claim_sets,
  feedback_claim_entailment_valid_claim_reviews: feedbackClaimEntailmentAdjudicationStatus.summary.valid_claim_reviews,
  feedback_claim_entailment_invalid_review_inputs: feedbackClaimEntailmentAdjudicationStatus.summary.invalid_review_input_count,
  claim_reference_alignment_claim_sets: feedbackClaimReferenceAlignmentReport.summary.total_claim_sets,
  claim_reference_alignment_meeting_threshold:
    feedbackClaimReferenceAlignmentReport.summary.claim_sets_meeting_minimum_reference_threshold,
  claim_reference_alignment_missing_domain_specific_support:
    feedbackClaimReferenceAlignmentReport.summary.claim_sets_missing_domain_specific_quote_support,
  claim_reference_alignment_domain_specific_release_ready:
    feedbackClaimReferenceAlignmentReport.summary.domain_specific_quote_support_release_ready,
  claim_reference_gap_packets:
    claimReferenceGapReviewPackets.summary.total_gap_packets,
  claim_reference_gap_generated_candidates:
    claimReferenceGapReviewPackets.summary.generated_needs_review_candidate_chunks_packeted,
  claim_reference_gap_all_domain_specific_gaps_packeted:
    claimReferenceGapReviewPackets.summary.all_domain_specific_gaps_packeted,
  claim_reference_gap_review_status:
    claimReferenceGapReviewStatus.review_status,
  claim_reference_gap_submitted_reviews:
    claimReferenceGapReviewStatus.summary.submitted_gap_reviews,
  claim_reference_gap_valid_reviews:
    claimReferenceGapReviewStatus.summary.valid_gap_reviews,
  claim_reference_gap_cleared_packets:
    claimReferenceGapReviewStatus.summary.cleared_gap_packets,
  claim_reference_gap_pending_reviews:
    claimReferenceGapReviewStatus.summary.pending_gap_reviews,
  claim_reference_gap_ready_for_national_feedback_release:
    claimReferenceGapReviewStatus.summary.ready_for_national_feedback_release_from_reviews,
  claim_reference_alignment_release_ready:
    feedbackClaimReferenceAlignmentReport.summary.claim_reference_alignment_release_ready,
  open_evidence_policy_probes: openEvidenceRuntimeReport.summary.total_probes,
  generated_references_returned_by_policy: openEvidenceRuntimeReport.summary.generated_references_returned,
  open_evidence_retrieval_runtime_probes: openEvidenceRetrievalRuntimeReport.summary.total_runtime_probes,
  open_evidence_retrieval_runtime_references: openEvidenceRetrievalRuntimeReport.summary.runtime_retrieval_reference_count,
  open_evidence_retrieval_runtime_generated_badges: openEvidenceRetrievalRuntimeReport.summary.generated_needs_review_badges_rendered,
  open_evidence_retrieval_runtime_quality_badge_visible:
    openEvidenceRetrievalRuntimeReport.summary.retrieval_quality_badge_visible,
  open_evidence_retrieval_runtime_high_risk_threshold_passed:
    openEvidenceRetrievalRuntimeReport.summary.high_risk_retrieval_quality_threshold_passed,
  open_evidence_retrieval_runtime_bm25_fallback_badge_visible:
    openEvidenceRetrievalRuntimeReport.summary.bm25_fallback_badge_visible,
  open_evidence_retrieval_runtime_nonclinical_scope_references:
    openEvidenceRetrievalRuntimeReport.summary.nonclinical_scope_guardrail_reference_count,
  source_link_quote_verification_quote_records: sourceLinkQuoteVerificationReport.summary.quote_records,
  source_link_quote_verification_unique_urls: sourceLinkQuoteVerificationReport.summary.unique_source_urls,
  source_link_quote_verification_fetch_ok: sourceLinkQuoteVerificationReport.summary.source_urls_fetch_ok,
  source_link_quote_verification_hash_mismatches: sourceLinkQuoteVerificationReport.summary.quote_hash_mismatches,
  source_link_quote_verification_matched_records: sourceLinkQuoteVerificationReport.summary.quote_records_matched_in_fetched_source,
  source_link_quote_verification_records_without_machine_text_match:
    sourceLinkQuoteVerificationReport.summary.quote_records_without_machine_text_match,
  source_link_quote_verification_records_requiring_repair:
    sourceLinkQuoteVerificationReport.summary.quote_records_requiring_repair,
  source_link_quote_verification_release_ready:
    sourceLinkQuoteVerificationReport.summary.quote_verification_release_ready,
  source_freshness_stale_sources: sourceFreshnessReport.summary.stale_sources,
  source_freshness_learner_facing_release_blocked:
    sourceFreshnessReport.summary.learner_facing_quote_backed_sources_release_blocked,
  source_freshness_release_ready:
    sourceFreshnessReport.summary.learner_facing_source_freshness_release_ready,
  source_freshness_adjudication_status: sourceFreshnessAdjudicationStatus.review_status,
  source_freshness_adjudication_submitted_reviews:
    sourceFreshnessAdjudicationStatus.summary.submitted_source_reviews,
  source_freshness_adjudication_packets_missing_review:
    sourceFreshnessAdjudicationStatus.summary.packets_missing_review,
  source_freshness_adjudication_ready_for_national_release:
    sourceFreshnessAdjudicationStatus.summary.ready_for_national_source_freshness_release,
  high_risk_quote_depth_topics_meeting_core_facet_depth:
    highRiskQuoteCoverageDepthReport.summary.topics_meeting_core_facet_depth,
  high_risk_quote_depth_missing_topic_facet_pairs:
    highRiskQuoteCoverageDepthReport.summary.missing_required_topic_facet_pairs,
  high_risk_quote_depth_release_ready:
    highRiskQuoteCoverageDepthReport.summary.quote_coverage_depth_release_ready,
  high_risk_classification_policy_ready:
    highRiskClinicalClassificationReport.summary.high_risk_classification_policy_ready,
  high_risk_classification_topic_alias_probes:
    highRiskClinicalClassificationReport.summary.topic_alias_probes,
  high_risk_classification_fallback_only_probes:
    highRiskClinicalClassificationReport.summary.regex_fallback_only_high_risk_probes,
  open_evidence_topic_retrieval_probes: openEvidenceTopicRetrievalBenchmark.summary.total_probes,
  open_evidence_topic_retrieval_topic_probes: openEvidenceTopicRetrievalBenchmark.summary.topic_probes,
  open_evidence_topic_retrieval_generated_returned: openEvidenceTopicRetrievalBenchmark.summary.generated_needs_review_references_returned,
  open_evidence_topic_retrieval_negative_returns: openEvidenceTopicRetrievalBenchmark.summary.negative_controls_returning_references,
  learner_facing_eligible_quote_backed_chunks: learnerFacingEvidenceCoverageReport.summary.learner_facing_eligible_quote_backed_chunks,
  learner_facing_claim_entailment_reviewed_claims: learnerFacingEvidenceCoverageReport.summary.claim_entailment_reviewed_claims,
  learner_facing_evidence_release_ready: learnerFacingEvidenceCoverageReport.summary.learner_facing_evidence_release_ready,
  evidence_quality_dashboard_present: report.metrics.evidence.evidence_quality_dashboard_present,
  evidence_quality_dashboard_alignment_checks_passed: evidenceQualityDashboard.summary.alignment_checks_passed,
  evidence_quality_dashboard_open_release_blockers: evidenceQualityDashboard.summary.open_release_blockers,
  evidence_quality_dashboard_release_ready: evidenceQualityDashboard.summary.dashboard_release_ready,
  equity_bias_policy_probes: equityBiasAudit.summary.bias_policy_probes,
  equity_reviewed_cases: equityBiasAudit.summary.equity_reviewed_cases,
  equity_case_review_status: equityCaseReviewStatus.review_status,
  equity_case_submitted_reviews: equityCaseReviewStatus.summary.submitted_reviews,
  equity_case_valid_reviews: equityCaseReviewStatus.summary.valid_reviews,
  equity_case_cases_missing_review: equityCaseReviewStatus.summary.cases_missing_review,
  equity_case_ready_for_national_release:
    equityCaseReviewStatus.summary.ready_for_national_equity_release,
  equity_case_review_packets:
    equityCaseReviewPackets.summary.total_review_packets,
  equity_case_review_packet_cases:
    equityCaseReviewPackets.summary.case_review_packets,
  equity_bias_policy_probe_review_packets:
    equityCaseReviewPackets.summary.bias_policy_probe_review_packets,
  equity_case_bank_coverage_gap_packets:
    equityCaseReviewPackets.summary.case_bank_coverage_gap_packets,
  equity_case_all_cases_packeted:
    equityCaseReviewPackets.summary.all_cases_packeted,
  equity_case_ready_for_national_release_from_packets:
    equityCaseReviewPackets.summary.ready_for_national_equity_release_from_packets,
  core_epa_workflow_mapped: coreEpaCurriculumMap.summary.workflow_mapped_epas,
  curriculum_mapping_review_status: curriculumMappingReviewStatus.review_status,
  curriculum_mapping_case_reviews_submitted: curriculumMappingReviewStatus.summary.submitted_case_reviews,
  curriculum_mapping_case_mappings_missing_review:
    curriculumMappingReviewStatus.summary.case_mappings_missing_review,
  curriculum_mapping_workflow_phases_missing_review:
    curriculumMappingReviewStatus.summary.workflow_phases_missing_review,
  curriculum_mapping_unsupported_epa_decisions_missing:
    curriculumMappingReviewStatus.summary.unsupported_epa_decisions_missing,
  curriculum_mapping_ready_for_national_release:
    curriculumMappingReviewStatus.summary.ready_for_national_curriculum_release,
  default_route_initial_js_kb: scaleBundleReport.summary.initial_js_kb,
  optional_large_asset_count: scaleBundleReport.summary.optional_large_asset_count,
  scale_runtime_probes: scaleOperationsRuntimeReport.summary.total_probes,
  scale_runtime_concurrent_smoke_requests: scaleOperationsRuntimeReport.summary.concurrent_smoke_requests,
  scale_runtime_spa_fallback_present: scaleOperationsRuntimeReport.summary.spa_fallback_present,
  route_reachability_probes: routeReachabilityReport.summary.total_route_probes,
  route_reachability_wrong_app_shell_findings: routeReachabilityReport.summary.wrong_app_shell_findings,
  accessibility_static_issue_count: accessibilityReadinessReport.summary.critical_static_issue_count,
  accessibility_manual_wcag_required: accessibilityReadinessReport.summary.manual_wcag_required,
  institutional_governance_review_status: institutionalGovernanceReviewStatus.review_status,
  institutional_governance_submitted_reviews: institutionalGovernanceReviewStatus.summary.submitted_reviews,
  institutional_governance_valid_reviews: institutionalGovernanceReviewStatus.summary.valid_reviews,
  institutional_governance_domains_missing_review: institutionalGovernanceReviewStatus.summary.domains_missing_review,
  institutional_governance_ready_for_national_release:
    institutionalGovernanceReviewStatus.summary.ready_for_national_institutional_release,
  institutional_governance_review_packets:
    institutionalGovernanceReviewPackets.summary.total_review_packets,
  institutional_governance_domain_review_packets:
    institutionalGovernanceReviewPackets.summary.domain_review_packets,
  institutional_governance_release_evidence_packets:
    institutionalGovernanceReviewPackets.summary.release_evidence_packets,
  institutional_governance_all_required_domains_packeted:
    institutionalGovernanceReviewPackets.summary.all_required_domains_packeted,
  institutional_governance_all_release_evidence_packeted:
    institutionalGovernanceReviewPackets.summary.all_release_evidence_packeted,
  institutional_governance_ready_for_national_release_from_packets:
    institutionalGovernanceReviewPackets.summary.ready_for_national_governance_release_from_packets,
  educational_outcome_metrics: educationalOutcomesFramework.summary.total_metrics,
  educational_outcome_runtime_probes: educationalOutcomesRuntimeReport.summary.total_probes,
  educational_outcome_runtime_export_rows: educationalOutcomesRuntimeReport.summary.export_row_count,
  educational_outcome_runtime_privacy_disallowed_keys: educationalOutcomesRuntimeReport.summary.privacy_disallowed_key_count,
  educational_outcome_validation_status: educationalOutcomesValidationStatus.review_status,
  educational_outcome_submitted_studies: educationalOutcomesValidationStatus.summary.submitted_studies,
  educational_outcome_valid_studies: educationalOutcomesValidationStatus.summary.valid_studies,
  educational_outcome_completed_pilot_studies: educationalOutcomesValidationStatus.summary.completed_pilot_studies,
  educational_outcome_completed_multi_site_studies: educationalOutcomesValidationStatus.summary.completed_multi_site_studies,
  educational_outcome_validation_ready_for_claims:
    educationalOutcomesValidationStatus.summary.ready_for_educational_validity_claims,
  educational_outcome_studies_reviewed: educationalOutcomesFramework.summary.reviewed_outcome_studies,
  educational_validity_review_packets:
    educationalValidityReviewPackets.summary.total_review_packets,
  educational_validity_case_curriculum_packets:
    educationalValidityReviewPackets.summary.case_curriculum_mapping_packets,
  educational_validity_case_outcome_packets:
    educationalValidityReviewPackets.summary.case_outcome_measurement_packets,
  educational_validity_metric_packets:
    educationalValidityReviewPackets.summary.outcome_metric_review_packets,
  educational_validity_study_packets:
    educationalValidityReviewPackets.summary.outcome_study_packets,
  educational_validity_all_curriculum_outcome_gaps_packeted:
    educationalValidityReviewPackets.summary.all_curriculum_outcome_gaps_packeted,
  educational_validity_ready_for_national_release_from_packets:
    educationalValidityReviewPackets.summary.ready_for_national_educational_release_from_packets,
  educational_validity_review_status:
    educationalValidityReviewStatus.review_status,
  educational_validity_review_total_packets:
    educationalValidityReviewStatus.summary.total_review_packets,
  educational_validity_submitted_reviews:
    educationalValidityReviewStatus.summary.submitted_educational_validity_reviews,
  educational_validity_valid_reviews:
    educationalValidityReviewStatus.summary.valid_educational_validity_reviews,
  educational_validity_nationally_approved_review_packets:
    educationalValidityReviewStatus.summary.nationally_approved_review_packets,
  educational_validity_review_pending_packets:
    educationalValidityReviewStatus.summary.pending_review_packets,
  educational_validity_review_ready_for_national_release:
    educationalValidityReviewStatus.summary.ready_for_national_educational_release_from_reviews,
  safety_red_team_tests: learnerSafetyRedTeam.summary.total_tests,
  safety_runtime_passed_tests: learnerSafetyRuntimeReport.summary.passed_policy_tests,
  safety_review_status: learnerSafetyReviewStatus.review_status,
  safety_submitted_reviews: learnerSafetyReviewStatus.summary.submitted_reviews,
  safety_valid_reviews: learnerSafetyReviewStatus.summary.valid_reviews,
  safety_tests_missing_review: learnerSafetyReviewStatus.summary.tests_missing_review,
  safety_review_ready_for_national_release:
    learnerSafetyReviewStatus.summary.ready_for_national_learner_safety_release,
  learner_safety_review_packets:
    learnerSafetyReviewPackets.summary.total_review_packets,
  learner_safety_red_team_packets:
    learnerSafetyReviewPackets.summary.red_team_test_review_packets,
  learner_safety_optional_ai_guardrail_packets:
    learnerSafetyReviewPackets.summary.optional_ai_guardrail_review_packets,
  learner_safety_all_required_categories_packeted:
    learnerSafetyReviewPackets.summary.all_required_categories_packeted,
  learner_safety_ready_for_national_release_from_packets:
    learnerSafetyReviewPackets.summary.ready_for_national_learner_safety_release_from_packets,
  rubric_criteria: rubric.criteria.length,
  rubric_status_counts: rubric.summary.status_counts,
  gate_statuses: Object.fromEntries(report.gates.map((gate) => [gate.id, gate.status]))
};

console.log(JSON.stringify(summary, null, 2));
