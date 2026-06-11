import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const QUALITY_REPORT_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_source_quality_report.json');
const FEEDBACK_PATH = join(ROOT, 'frontend', 'src', 'components', 'Feedback.jsx');
const STATIC_ENGINE_PATH = join(ROOT, 'frontend', 'src', 'services', 'staticEngine.js');
const OBJECTIVE_MATRIX_PATH = join(ROOT, 'docs', 'case_objective_matrix.json');
const CASE_TRUTH_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'case_truth_review_packets.json');
const CASE_TRUTH_ADJUDICATION_WORKLIST_PATH = join(ROOT, 'docs', 'case_truth_adjudication_worklist.json');
const CASE_GENERATION_QUALITY_REPORT_PATH = join(ROOT, 'docs', 'case_generation_quality_report.json');
const CASE_BANK_EXPANSION_STATUS_PATH = join(ROOT, 'docs', 'case_bank_expansion_status.json');
const CASE_BANK_EXPANSION_PACKETS_PATH = join(ROOT, 'docs', 'case_bank_expansion_packets.json');
const CASE_BANK_EXPANSION_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'case_bank_expansion_review_status.json');
const CORE_EPA_CURRICULUM_MAP_PATH = join(ROOT, 'docs', 'core_epa_curriculum_map.json');
const CURRICULUM_MAPPING_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'curriculum_mapping_review_status.json');
const OUTCOMES_PROTOCOL_PATH = join(ROOT, 'docs', 'educational_outcomes_protocol.md');
const EDUCATIONAL_OUTCOMES_FRAMEWORK_PATH = join(ROOT, 'docs', 'educational_outcomes_measurement_framework.json');
const EDUCATIONAL_OUTCOMES_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'educational_outcomes_runtime_report.json');
const EDUCATIONAL_OUTCOMES_VALIDATION_STATUS_PATH = join(ROOT, 'docs', 'educational_outcomes_validation_status.json');
const EDUCATIONAL_VALIDITY_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'educational_validity_review_packets.json');
const EDUCATIONAL_VALIDITY_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'educational_validity_review_status.json');
const GOVERNANCE_INVENTORY_PATH = join(ROOT, 'docs', 'governance_data_inventory.json');
const GOVERNANCE_PLAN_PATH = join(ROOT, 'docs', 'institutional_governance_privacy_plan.md');
const INSTITUTIONAL_GOVERNANCE_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'institutional_governance_review_status.json');
const INSTITUTIONAL_GOVERNANCE_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'institutional_governance_review_packets.json');
const SCALE_ACCESSIBILITY_PLAN_PATH = join(ROOT, 'docs', 'scale_accessibility_monitoring_plan.md');
const SCALE_BUNDLE_REPORT_PATH = join(ROOT, 'docs', 'scale_bundle_readiness_report.json');
const SCALE_OPERATIONS_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'scale_operations_runtime_report.json');
const ROUTE_REACHABILITY_REPORT_PATH = join(ROOT, 'docs', 'route_reachability_report.json');
const ACCESSIBILITY_READINESS_REPORT_PATH = join(ROOT, 'docs', 'accessibility_readiness_report.json');
const EVIDENCE_REVIEW_BACKLOG_PATH = join(ROOT, 'docs', 'evidence_review_backlog.json');
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
const MEDICAL_EDUCATION_RUBRIC_PATH = join(ROOT, 'docs', 'medical_education_validation_rubric.json');
const LEARNER_SAFETY_RED_TEAM_PATH = join(ROOT, 'docs', 'learner_safety_red_team_suite.json');
const LEARNER_SAFETY_RED_TEAM_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'learner_safety_red_team_runtime_report.json');
const LEARNER_SAFETY_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'learner_safety_review_status.json');
const LEARNER_SAFETY_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'learner_safety_review_packets.json');
const LEARNER_SAFETY_RED_TEAM_VALIDATOR_PATH = join(ROOT, 'scripts', 'validate_learner_safety_red_team_suite.mjs');
const RESTRICTED_PRIVACY_CHECK_PATH = join(ROOT, 'scripts', 'check_restricted_data_privacy.py');
const REPORT_PATH = join(ROOT, 'docs', 'national_scale_readiness_report.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  return existsSync(path) ? readJson(path) : null;
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function hasAny(value, keys) {
  if (!value || typeof value !== 'object') return false;
  return keys.some((key) => {
    const item = value[key];
    return Array.isArray(item) ? item.length > 0 : Boolean(item);
  });
}

function caseHasSourceRecordDiagnosis(caseRecord) {
  return hasAny(caseRecord.source, [
    'primary_diagnosis',
    'source_record_diagnosis',
    'diagnosis',
    'diagnoses',
    'icd',
    'icd_code',
    'icd_title'
  ]);
}

function caseHasClinicianApprovedReferral(caseRecord) {
  return hasAny(caseRecord.source, [
    'clinician_approved_referral',
    'clinician_approved_specialty',
    'consult_reference',
    'referral_reference'
  ]) || hasAny(caseRecord.augmentation, [
    'clinician_approved_referral',
    'clinician_approved_specialty',
    'consult_reference',
    'referral_reference'
  ]);
}

function caseHasRetrospectiveTruth(caseRecord) {
  return hasAny(caseRecord, ['retrospective_ground_truth'])
    || hasAny(caseRecord.source, ['retrospective_ground_truth', 'linked_context', 'diagnostic_truth']);
}

function caseHasOptionalObjectiveData(caseRecord) {
  return hasAny(caseRecord, ['optional_objective_data'])
    || hasAny(caseRecord.source, ['optional_objective_data'])
    || hasAny(caseRecord.augmentation, ['optional_objective_data']);
}

function caseHasLearningObjectives(caseRecord) {
  return hasAny(caseRecord, ['learning_objectives', 'competency_objectives'])
    || hasAny(caseRecord.augmentation, ['learning_objectives', 'competency_objectives']);
}

function gate(id, label, status, evidence, required) {
  return { id, label, status, evidence, required };
}

const cases = readJson(CASES_PATH);
const quality = readJson(QUALITY_REPORT_PATH);
const objectiveMatrix = readOptionalJson(OBJECTIVE_MATRIX_PATH);
const caseTruthReviewPackets = readOptionalJson(CASE_TRUTH_REVIEW_PACKETS_PATH);
const caseTruthAdjudicationWorklist = readOptionalJson(CASE_TRUTH_ADJUDICATION_WORKLIST_PATH);
const caseGenerationQualityReport = readOptionalJson(CASE_GENERATION_QUALITY_REPORT_PATH);
const caseBankExpansionStatus = readOptionalJson(CASE_BANK_EXPANSION_STATUS_PATH);
const caseBankExpansionPackets = readOptionalJson(CASE_BANK_EXPANSION_PACKETS_PATH);
const caseBankExpansionReviewStatus = readOptionalJson(CASE_BANK_EXPANSION_REVIEW_STATUS_PATH);
const coreEpaCurriculumMap = readOptionalJson(CORE_EPA_CURRICULUM_MAP_PATH);
const curriculumMappingReviewStatus = readOptionalJson(CURRICULUM_MAPPING_REVIEW_STATUS_PATH);
const educationalOutcomesFramework = readOptionalJson(EDUCATIONAL_OUTCOMES_FRAMEWORK_PATH);
const educationalOutcomesRuntimeReport = readOptionalJson(EDUCATIONAL_OUTCOMES_RUNTIME_REPORT_PATH);
const educationalOutcomesValidationStatus = readOptionalJson(EDUCATIONAL_OUTCOMES_VALIDATION_STATUS_PATH);
const educationalValidityReviewPackets = readOptionalJson(EDUCATIONAL_VALIDITY_REVIEW_PACKETS_PATH);
const educationalValidityReviewStatus = readOptionalJson(EDUCATIONAL_VALIDITY_REVIEW_STATUS_PATH);
const governanceInventory = readOptionalJson(GOVERNANCE_INVENTORY_PATH);
const institutionalGovernanceReviewStatus = readOptionalJson(INSTITUTIONAL_GOVERNANCE_REVIEW_STATUS_PATH);
const institutionalGovernanceReviewPackets = readOptionalJson(INSTITUTIONAL_GOVERNANCE_REVIEW_PACKETS_PATH);
const scaleBundleReport = readOptionalJson(SCALE_BUNDLE_REPORT_PATH);
const scaleOperationsRuntimeReport = readOptionalJson(SCALE_OPERATIONS_RUNTIME_REPORT_PATH);
const routeReachabilityReport = readOptionalJson(ROUTE_REACHABILITY_REPORT_PATH);
const accessibilityReadinessReport = readOptionalJson(ACCESSIBILITY_READINESS_REPORT_PATH);
const evidenceReviewBacklog = readOptionalJson(EVIDENCE_REVIEW_BACKLOG_PATH);
const openEvidenceGroundingReviewPackets = readOptionalJson(OPEN_EVIDENCE_GROUNDING_REVIEW_PACKETS_PATH);
const openEvidenceGroundingReviewStatus = readOptionalJson(OPEN_EVIDENCE_GROUNDING_REVIEW_STATUS_PATH);
const clinicalReviewAdjudicationStatus = readOptionalJson(CLINICAL_ADJUDICATION_STATUS_PATH);
const feedbackTraceabilityMatrix = readOptionalJson(FEEDBACK_TRACEABILITY_MATRIX_PATH);
const feedbackIntegrityRuntimeReport = readOptionalJson(FEEDBACK_INTEGRITY_RUNTIME_REPORT_PATH);
const feedbackCaseDomainReviewPackets = readOptionalJson(FEEDBACK_CASE_DOMAIN_REVIEW_PACKETS_PATH);
const feedbackCaseDomainCalibrationReviewStatus = readOptionalJson(FEEDBACK_CASE_DOMAIN_CALIBRATION_REVIEW_STATUS_PATH);
const optionalAiGuardrailRuntimeReport = readOptionalJson(OPTIONAL_AI_GUARDRAIL_RUNTIME_REPORT_PATH);
const feedbackClaimReferenceAlignmentReport = readOptionalJson(FEEDBACK_CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH);
const claimReferenceGapReviewPackets = readOptionalJson(CLAIM_REFERENCE_GAP_REVIEW_PACKETS_PATH);
const claimReferenceGapReviewStatus = readOptionalJson(CLAIM_REFERENCE_GAP_REVIEW_STATUS_PATH);
const openEvidenceRuntimeReport = readOptionalJson(OPEN_EVIDENCE_POLICY_RUNTIME_REPORT_PATH);
const openEvidenceRetrievalRuntimeReport = readOptionalJson(OPEN_EVIDENCE_RETRIEVAL_RUNTIME_REPORT_PATH);
const sourceLinkQuoteVerificationReport = readOptionalJson(SOURCE_LINK_QUOTE_VERIFICATION_REPORT_PATH);
const sourceFreshnessReport = readOptionalJson(SOURCE_FRESHNESS_REPORT_PATH);
const sourceFreshnessReviewPackets = readOptionalJson(SOURCE_FRESHNESS_REVIEW_PACKETS_PATH);
const sourceFreshnessAdjudicationStatus = readOptionalJson(SOURCE_FRESHNESS_ADJUDICATION_STATUS_PATH);
const highRiskQuoteCoverageDepthReport = readOptionalJson(HIGH_RISK_QUOTE_COVERAGE_DEPTH_REPORT_PATH);
const highRiskClinicalClassificationReport = readOptionalJson(HIGH_RISK_CLINICAL_CLASSIFICATION_REPORT_PATH);
const openEvidenceTopicRetrievalBenchmark = readOptionalJson(OPEN_EVIDENCE_TOPIC_RETRIEVAL_BENCHMARK_PATH);
const learnerFacingEvidenceCoverageReport = readOptionalJson(LEARNER_FACING_EVIDENCE_COVERAGE_REPORT_PATH);
const evidenceQualityDashboard = readOptionalJson(EVIDENCE_QUALITY_DASHBOARD_PATH);
const feedbackClaimEntailmentReviewPackets = readOptionalJson(FEEDBACK_CLAIM_ENTAILMENT_REVIEW_PACKETS_PATH);
const feedbackClaimEntailmentAdjudicationStatus = readOptionalJson(FEEDBACK_CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH);
const equityBiasAudit = readOptionalJson(EQUITY_BIAS_AUDIT_PATH);
const equityCaseReviewStatus = readOptionalJson(EQUITY_CASE_REVIEW_STATUS_PATH);
const equityCaseReviewPackets = readOptionalJson(EQUITY_CASE_REVIEW_PACKETS_PATH);
const medicalEducationRubric = readOptionalJson(MEDICAL_EDUCATION_RUBRIC_PATH);
const learnerSafetyRedTeam = readOptionalJson(LEARNER_SAFETY_RED_TEAM_PATH);
const learnerSafetyRuntimeReport = readOptionalJson(LEARNER_SAFETY_RED_TEAM_RUNTIME_REPORT_PATH);
const learnerSafetyReviewStatus = readOptionalJson(LEARNER_SAFETY_REVIEW_STATUS_PATH);
const learnerSafetyReviewPackets = readOptionalJson(LEARNER_SAFETY_REVIEW_PACKETS_PATH);
const feedbackSource = readFileSync(FEEDBACK_PATH, 'utf8');
const staticEngineSource = readFileSync(STATIC_ENGINE_PATH, 'utf8');
const feedbackLoadEffect = feedbackSource.slice(
  feedbackSource.indexOf('useEffect(() => {'),
  feedbackSource.indexOf('const requestReasoningReview')
);
const caseIds = new Set(cases.map((caseRecord) => caseRecord.id));
const objectiveMatrixCaseIds = new Set((objectiveMatrix?.cases || []).map((entry) => entry.case_id).filter(Boolean));
const objectiveMatrixMissingCaseIds = [...caseIds].filter((caseId) => !objectiveMatrixCaseIds.has(caseId));
const objectiveMatrixExtraCaseIds = [...objectiveMatrixCaseIds].filter((caseId) => !caseIds.has(caseId));

const caseMetrics = {
  total_cases: cases.length,
  esi_distribution: countBy(cases, (caseRecord) => `ESI_${caseRecord.acuity}`),
  reviewed_augmentation_cases: cases.filter((caseRecord) => caseRecord.augmentation?.review_status === 'reviewed').length,
  missing_source_record_diagnosis: cases.filter((caseRecord) => !caseHasSourceRecordDiagnosis(caseRecord)).length,
  missing_clinician_approved_referral: cases.filter((caseRecord) => !caseHasClinicianApprovedReferral(caseRecord)).length,
  missing_retrospective_truth: cases.filter((caseRecord) => !caseHasRetrospectiveTruth(caseRecord)).length,
  missing_optional_objective_data: cases.filter((caseRecord) => !caseHasOptionalObjectiveData(caseRecord)).length,
  missing_learning_objectives: cases.filter((caseRecord) => !caseHasLearningObjectives(caseRecord)).length,
  case_truth_review_queue_present: Boolean(caseTruthReviewPackets),
  case_truth_review_status: caseTruthReviewPackets?.review_status || 'missing',
  case_truth_review_packets: caseTruthReviewPackets?.summary?.total_packets || caseTruthReviewPackets?.case_review_packets?.length || 0,
  case_truth_reviewed_cases: caseTruthReviewPackets?.summary?.reviewed_case_truth_packets || 0,
  case_truth_pending_cases: caseTruthReviewPackets?.summary?.pending_case_truth_packets || 0,
  case_truth_source_limitations_packeted: caseTruthReviewPackets?.summary?.source_limitations_packeted || 0,
  case_truth_simulation_reveal_scaffolds_packeted: caseTruthReviewPackets?.summary?.simulation_reveal_scaffolds_packeted || 0,
  case_truth_packets_with_all_source_limitations_scaffolded:
    caseTruthReviewPackets?.summary?.packets_with_all_source_limitations_scaffolded || 0,
  case_truth_packets_with_unscaffolded_source_limitations:
    caseTruthReviewPackets?.summary?.packets_with_unscaffolded_source_limitations || 0,
  case_truth_packets_with_source_narrative_age_mismatch:
    caseTruthReviewPackets?.summary?.packets_with_source_narrative_age_mismatch || 0,
  case_truth_packets_with_source_esi_reviewer_disagreement:
    caseTruthReviewPackets?.summary?.packets_with_source_esi_reviewer_disagreement || 0,
  case_truth_review_packet_scaffold_completeness_ready:
    Boolean(caseTruthReviewPackets?.summary?.review_packet_scaffold_completeness_ready),
  case_truth_required_clinician_fields: caseTruthReviewPackets?.review_template?.required_clinician_fields || [],
  case_truth_adjudication_worklist_present: Boolean(caseTruthAdjudicationWorklist),
  case_truth_adjudication_worklist_status: caseTruthAdjudicationWorklist?.review_status || 'missing',
  case_truth_adjudication_work_items: caseTruthAdjudicationWorklist?.summary?.total_work_items || 0,
  case_truth_adjudication_worklist_pending:
    caseTruthAdjudicationWorklist?.summary?.pending_case_truth_adjudications || 0,
  case_truth_adjudication_worklist_high_priority_items:
    caseTruthAdjudicationWorklist?.summary?.high_priority_work_items || 0,
  case_truth_adjudication_worklist_release_blockers:
    caseTruthAdjudicationWorklist?.summary?.total_release_blockers || 0,
  case_truth_adjudication_worklist_all_cases_have_work_item:
    Boolean(caseTruthAdjudicationWorklist?.summary?.all_current_cases_have_work_item),
  case_truth_adjudication_worklist_starter_templates_present:
    Boolean(caseTruthAdjudicationWorklist?.summary?.all_work_items_include_starter_adjudication),
  case_truth_adjudication_worklist_ready_for_national_release:
    Boolean(caseTruthAdjudicationWorklist?.summary?.ready_for_national_case_truth_release_from_worklist),
  clinical_review_adjudication_contract_present: Boolean(clinicalReviewAdjudicationStatus?.contract?.contract_document_present),
  clinical_review_adjudication_status: clinicalReviewAdjudicationStatus?.review_status || 'missing',
  case_truth_adjudication_file_present: Boolean(clinicalReviewAdjudicationStatus?.case_truth?.file_present),
  case_truth_adjudication_ready_cases: clinicalReviewAdjudicationStatus?.case_truth?.ready_case_truth_adjudications || 0,
  clinical_review_adjudication_issue_count: clinicalReviewAdjudicationStatus?.readiness_effect?.invalid_review_input_count || 0,
  age_bands: countBy(cases, (caseRecord) => {
    const age = Number(caseRecord.demographics?.age ?? caseRecord.source?.age);
    if (!Number.isFinite(age)) return 'unknown';
    if (age < 18) return 'pediatric';
    if (age < 40) return 'adult_18_39';
    if (age < 65) return 'adult_40_64';
    return 'older_adult_65_plus';
  }),
  sex_distribution: countBy(cases, (caseRecord) => caseRecord.demographics?.sex || caseRecord.source?.sex || 'unknown')
};

const caseGenerationQualityMetrics = {
  case_generation_quality_report_present: Boolean(caseGenerationQualityReport),
  case_generation_quality_report_status: caseGenerationQualityReport?.review_status || 'missing',
  case_generation_quality_total_cases: caseGenerationQualityReport?.summary?.total_cases || 0,
  case_generation_quality_national_case_count_minimum: caseGenerationQualityReport?.summary?.national_case_count_minimum || 0,
  case_generation_quality_case_count_shortfall: caseGenerationQualityReport?.summary?.case_count_shortfall_for_national_bank || 0,
  draft_practice_scaffold_eligible_cases: caseGenerationQualityReport?.summary?.draft_practice_scaffold_eligible_cases || 0,
  national_release_eligible_cases: caseGenerationQualityReport?.summary?.national_release_eligible_cases || 0,
  national_release_ready: Boolean(caseGenerationQualityReport?.summary?.national_release_ready),
  cases_with_source_scaffold_issues: caseGenerationQualityReport?.summary?.cases_with_source_scaffold_issues ?? null,
  cases_with_augmentation_issues: caseGenerationQualityReport?.summary?.cases_with_augmentation_issues ?? null,
  cases_missing_any_truth_field: caseGenerationQualityReport?.summary?.cases_missing_any_truth_field ?? null,
  cases_with_simulation_structuring_gaps: caseGenerationQualityReport?.summary?.cases_with_simulation_structuring_gaps ?? null,
  augmented_grading_reference_fact_count: caseGenerationQualityReport?.summary?.augmented_grading_reference_fact_count ?? null,
  case_bank_expansion_status_present: Boolean(caseBankExpansionStatus),
  case_bank_expansion_status: caseBankExpansionStatus?.review_status || 'missing',
  case_bank_current_cases: caseBankExpansionStatus?.summary?.current_cases || 0,
  case_bank_national_case_count_minimum:
    caseBankExpansionStatus?.summary?.national_case_count_minimum || 0,
  case_bank_case_count_shortfall: caseBankExpansionStatus?.summary?.case_count_shortfall || 0,
  case_bank_target_gap_count: caseBankExpansionStatus?.summary?.target_gap_count || 0,
  case_bank_acuity_target_gaps: caseBankExpansionStatus?.summary?.acuity_target_gaps || 0,
  case_bank_age_band_target_gaps: caseBankExpansionStatus?.summary?.age_band_target_gaps || 0,
  case_bank_special_population_target_gaps:
    caseBankExpansionStatus?.summary?.special_population_target_gaps || 0,
  case_bank_presentation_target_gaps:
    caseBankExpansionStatus?.summary?.presentation_target_gaps || 0,
  case_bank_recommended_minimum_new_cases:
    caseBankExpansionStatus?.summary?.recommended_minimum_new_cases || 0,
  case_bank_ready_for_national_release:
    Boolean(caseBankExpansionStatus?.summary?.ready_for_national_case_bank_release),
  case_bank_expansion_packets_present: Boolean(caseBankExpansionPackets),
  case_bank_expansion_packets_status:
    caseBankExpansionPackets?.review_status || 'missing',
  case_bank_expansion_target_gap_packets:
    caseBankExpansionPackets?.summary?.target_gap_packets || 0,
  case_bank_expansion_blueprint_slots:
    caseBankExpansionPackets?.summary?.blueprint_slots || 0,
  case_bank_expansion_blueprint_slots_match_recommended_minimum_new_cases:
    Boolean(caseBankExpansionPackets?.summary?.blueprint_slots_match_recommended_minimum_new_cases),
  case_bank_expansion_all_target_shortfalls_have_blueprint_coverage:
    Boolean(caseBankExpansionPackets?.summary?.all_target_shortfalls_have_blueprint_coverage),
  case_bank_expansion_pending_blueprint_slots:
    caseBankExpansionPackets?.summary?.pending_blueprint_slots || 0,
  case_bank_expansion_packets_ready_for_national_release:
    Boolean(caseBankExpansionPackets?.summary?.ready_for_national_case_bank_release_from_expansion_packets),
  case_bank_expansion_review_status_present: Boolean(caseBankExpansionReviewStatus),
  case_bank_expansion_review_status:
    caseBankExpansionReviewStatus?.review_status || 'missing',
  case_bank_expansion_review_total_blueprint_slots:
    caseBankExpansionReviewStatus?.summary?.blueprint_slots || 0,
  case_bank_expansion_submitted_blueprint_reviews:
    caseBankExpansionReviewStatus?.summary?.submitted_blueprint_reviews || 0,
  case_bank_expansion_valid_blueprint_reviews:
    caseBankExpansionReviewStatus?.summary?.valid_blueprint_reviews || 0,
  case_bank_expansion_national_countable_blueprint_reviews:
    caseBankExpansionReviewStatus?.summary?.national_countable_blueprint_reviews || 0,
  case_bank_expansion_pending_blueprint_reviews:
    caseBankExpansionReviewStatus?.summary?.pending_blueprint_reviews || 0,
  case_bank_expansion_invalid_review_inputs:
    caseBankExpansionReviewStatus?.summary?.invalid_review_input_count || 0,
  case_bank_expansion_review_ready_for_national_release:
    Boolean(caseBankExpansionReviewStatus?.summary?.ready_for_national_case_bank_release_from_reviews),
  case_quality_criteria_status_counts: countBy(caseGenerationQualityReport?.criteria || [], (criterion) => criterion.status)
};

const caseGenerationQualityStatus = caseGenerationQualityMetrics.national_release_ready
  && caseGenerationQualityMetrics.case_bank_ready_for_national_release
  && caseGenerationQualityMetrics.case_bank_expansion_review_ready_for_national_release
  ? 'pass'
  : caseGenerationQualityMetrics.case_generation_quality_report_present
    && caseGenerationQualityMetrics.case_generation_quality_total_cases === caseMetrics.total_cases
    && caseGenerationQualityMetrics.cases_with_source_scaffold_issues === 0
    && caseGenerationQualityMetrics.cases_with_augmentation_issues === 0
    && caseGenerationQualityMetrics.case_bank_expansion_status_present
    && caseGenerationQualityMetrics.case_bank_expansion_review_status_present
    && caseGenerationQualityMetrics.case_bank_expansion_invalid_review_inputs === 0
    && caseGenerationQualityMetrics.draft_practice_scaffold_eligible_cases === caseMetrics.total_cases
      ? 'partial'
      : 'fail';

const evidenceMetrics = {
  total_sources: quality.total_sources,
  total_chunks: quality.total_chunks,
  quote_backed_count: quality.quote_backed_count,
  quote_backed_percentage: quality.total_chunks ? Number(((quality.quote_backed_count / quality.total_chunks) * 100).toFixed(2)) : 0,
  auditable_count: quality.auditable_count,
  auditable_percentage: quality.total_chunks ? Number(((quality.auditable_count / quality.total_chunks) * 100).toFixed(2)) : 0,
  generated_needs_review_count: quality.generated_needs_review_count,
  needs_review_count: quality.needs_review_count,
  missing_locator_chunk_count: Array.isArray(quality.missing_locator_chunk_ids) ? quality.missing_locator_chunk_ids.length : 0,
  high_risk_topics_without_quote_coverage: quality.high_risk_topics_without_quote_coverage || [],
  evidence_quality_dashboard_present: Boolean(evidenceQualityDashboard),
  evidence_quality_dashboard_status: evidenceQualityDashboard?.review_status || 'missing',
  evidence_quality_dashboard_alignment_checks_passed:
    Boolean(evidenceQualityDashboard?.summary?.alignment_checks_passed),
  evidence_quality_dashboard_quote_backed_chunks:
    evidenceQualityDashboard?.summary?.quote_backed_chunks || 0,
  evidence_quality_dashboard_generated_needs_review_chunks:
    evidenceQualityDashboard?.summary?.generated_needs_review_chunks || 0,
  evidence_quality_dashboard_high_risk_missing_topic_facet_pairs:
    evidenceQualityDashboard?.summary?.high_risk_missing_topic_facet_pairs || 0,
  evidence_quality_dashboard_source_link_quote_records_requiring_repair:
    evidenceQualityDashboard?.summary?.source_link_quote_records_requiring_repair || 0,
  evidence_quality_dashboard_source_link_quote_records_without_machine_text_match:
    evidenceQualityDashboard?.summary?.source_link_quote_records_without_machine_text_match || 0,
  evidence_quality_dashboard_open_release_blockers:
    evidenceQualityDashboard?.summary?.open_release_blockers || 0,
  evidence_quality_dashboard_release_ready:
    Boolean(evidenceQualityDashboard?.summary?.dashboard_release_ready),
  evidence_review_backlog_present: Boolean(evidenceReviewBacklog),
  evidence_review_backlog_status: evidenceReviewBacklog?.review_status || 'missing',
  evidence_review_pending_sources: evidenceReviewBacklog?.summary?.pending_source_count || 0,
  evidence_review_batches: evidenceReviewBacklog?.summary?.pending_review_batch_count || 0,
  evidence_review_pending_generated_chunks: evidenceReviewBacklog?.summary?.pending_generated_or_unverified_chunks || 0,
  evidence_reviewed_generated_chunks: evidenceReviewBacklog?.summary?.reviewed_generated_chunks || 0,
  evidence_review_count_alignment: Boolean(evidenceReviewBacklog?.quality_report_alignment?.count_alignment),
  open_evidence_grounding_review_packets_present: Boolean(openEvidenceGroundingReviewPackets),
  open_evidence_grounding_review_packets_status:
    openEvidenceGroundingReviewPackets?.review_status || 'missing',
  open_evidence_grounding_total_review_packets:
    openEvidenceGroundingReviewPackets?.summary?.total_review_packets || 0,
  open_evidence_grounding_generated_backlog_review_packets:
    openEvidenceGroundingReviewPackets?.summary?.generated_backlog_review_packets || 0,
  open_evidence_grounding_release_blocker_packets:
    openEvidenceGroundingReviewPackets?.summary?.release_blocker_packets || 0,
  open_evidence_grounding_pending_review_packets:
    openEvidenceGroundingReviewPackets?.summary?.pending_review_packets || 0,
  open_evidence_grounding_generated_chunks_packeted:
    openEvidenceGroundingReviewPackets?.summary?.generated_needs_review_chunks_packeted || 0,
  open_evidence_grounding_all_review_batches_packeted:
    Boolean(openEvidenceGroundingReviewPackets?.summary?.all_review_batches_packeted),
  open_evidence_grounding_generated_evidence_allowed_for_learner_feedback:
    Boolean(openEvidenceGroundingReviewPackets?.summary?.generated_needs_review_evidence_allowed_for_learner_feedback),
  open_evidence_grounding_ready_for_national_release_from_packets:
    Boolean(openEvidenceGroundingReviewPackets?.summary?.ready_for_national_open_evidence_release_from_packets),
  open_evidence_grounding_review_status_present: Boolean(openEvidenceGroundingReviewStatus),
  open_evidence_grounding_review_status:
    openEvidenceGroundingReviewStatus?.review_status || 'missing',
  open_evidence_grounding_review_total_packets:
    openEvidenceGroundingReviewStatus?.summary?.total_review_packets || 0,
  open_evidence_grounding_review_submitted_reviews:
    openEvidenceGroundingReviewStatus?.summary?.submitted_grounding_reviews || 0,
  open_evidence_grounding_review_valid_reviews:
    openEvidenceGroundingReviewStatus?.summary?.valid_grounding_reviews || 0,
  open_evidence_grounding_review_cleared_packets:
    openEvidenceGroundingReviewStatus?.summary?.cleared_review_packets || 0,
  open_evidence_grounding_review_pending_packets:
    openEvidenceGroundingReviewStatus?.summary?.pending_review_packets || 0,
  open_evidence_grounding_review_invalid_inputs:
    openEvidenceGroundingReviewStatus?.summary?.invalid_review_input_count || 0,
  open_evidence_grounding_review_ready_for_national_release:
    Boolean(openEvidenceGroundingReviewStatus?.summary?.ready_for_national_open_evidence_release_from_reviews),
  clinical_review_adjudication_contract_present: Boolean(clinicalReviewAdjudicationStatus?.contract?.contract_document_present),
  evidence_adjudication_file_present: Boolean(clinicalReviewAdjudicationStatus?.evidence?.file_present),
  evidence_adjudication_approved_chunks: clinicalReviewAdjudicationStatus?.evidence?.approved_chunks || 0,
  evidence_adjudication_learner_feedback_approved_chunks: clinicalReviewAdjudicationStatus?.evidence?.learner_feedback_approved_chunks || 0,
  evidence_adjudication_high_risk_learner_feedback_approved_chunks: clinicalReviewAdjudicationStatus?.evidence?.high_risk_learner_feedback_approved_chunks || 0,
  evidence_adjudication_issue_count: clinicalReviewAdjudicationStatus?.evidence?.issues?.length || 0,
  open_evidence_runtime_policy_report_present: Boolean(openEvidenceRuntimeReport),
  open_evidence_runtime_policy_status: openEvidenceRuntimeReport?.review_status || 'missing',
  open_evidence_policy_probes: openEvidenceRuntimeReport?.summary?.total_probes || 0,
  open_evidence_policy_passed_probes: openEvidenceRuntimeReport?.summary?.passed_policy_probes || 0,
  open_evidence_policy_failed_probes: openEvidenceRuntimeReport?.summary?.failed_policy_probes || 0,
  open_evidence_policy_all_probes_passed: Boolean(openEvidenceRuntimeReport?.summary?.all_policy_probes_passed),
  generated_chunks_quarantined_by_default: Boolean(openEvidenceRuntimeReport?.summary?.generated_chunks_quarantined_by_default),
  generated_references_returned_by_policy_probes: openEvidenceRuntimeReport?.summary?.generated_references_returned || 0,
  open_evidence_retrieval_runtime_report_present: Boolean(openEvidenceRetrievalRuntimeReport),
  open_evidence_retrieval_runtime_status: openEvidenceRetrievalRuntimeReport?.review_status || 'missing',
  open_evidence_retrieval_runtime_probes: openEvidenceRetrievalRuntimeReport?.summary?.total_runtime_probes || 0,
  open_evidence_retrieval_runtime_passed_probes: openEvidenceRetrievalRuntimeReport?.summary?.passed_runtime_probes || 0,
  open_evidence_retrieval_runtime_failed_probes: openEvidenceRetrievalRuntimeReport?.summary?.failed_runtime_probes || 0,
  open_evidence_retrieval_runtime_all_probes_passed:
    Boolean(openEvidenceRetrievalRuntimeReport?.summary?.all_runtime_probes_passed),
  open_evidence_runtime_quote_backed_only_default_enabled:
    Boolean(openEvidenceRetrievalRuntimeReport?.summary?.quote_backed_only_default_enabled),
  open_evidence_runtime_retrieval_reference_count:
    openEvidenceRetrievalRuntimeReport?.summary?.runtime_retrieval_reference_count || 0,
  open_evidence_runtime_retrieval_quote_backed_badges:
    openEvidenceRetrievalRuntimeReport?.summary?.runtime_retrieval_quote_backed_badges || 0,
  open_evidence_runtime_generated_needs_review_badges_rendered:
    openEvidenceRetrievalRuntimeReport?.summary?.generated_needs_review_badges_rendered || 0,
  open_evidence_runtime_needs_review_badges_rendered:
    openEvidenceRetrievalRuntimeReport?.summary?.needs_review_badges_rendered || 0,
  open_evidence_runtime_generated_backlog_quarantine_warning_visible:
    Boolean(openEvidenceRetrievalRuntimeReport?.summary?.generated_backlog_quarantine_warning_visible),
  open_evidence_runtime_smoke_review_items:
    openEvidenceRetrievalRuntimeReport?.summary?.smoke_review_items || 0,
  open_evidence_runtime_retrieval_quality_badge_visible:
    Boolean(openEvidenceRetrievalRuntimeReport?.summary?.retrieval_quality_badge_visible),
  open_evidence_runtime_high_risk_retrieval_quality_threshold_passed:
    Boolean(openEvidenceRetrievalRuntimeReport?.summary?.high_risk_retrieval_quality_threshold_passed),
  open_evidence_runtime_high_risk_retrieval_quality_top_base_score:
    openEvidenceRetrievalRuntimeReport?.summary?.high_risk_retrieval_quality_top_base_score || 0,
  open_evidence_runtime_high_risk_retrieval_quality_minimum_base_score:
    openEvidenceRetrievalRuntimeReport?.summary?.high_risk_retrieval_quality_minimum_base_score || 0,
  open_evidence_runtime_bm25_fallback_badge_visible:
    Boolean(openEvidenceRetrievalRuntimeReport?.summary?.bm25_fallback_badge_visible),
  open_evidence_runtime_nonclinical_scope_guardrail_warning_visible:
    Boolean(openEvidenceRetrievalRuntimeReport?.summary?.nonclinical_scope_guardrail_warning_visible),
  open_evidence_runtime_nonclinical_scope_guardrail_reference_count:
    openEvidenceRetrievalRuntimeReport?.summary?.nonclinical_scope_guardrail_reference_count || 0,
  source_link_quote_verification_report_present: Boolean(sourceLinkQuoteVerificationReport),
  source_link_quote_verification_status: sourceLinkQuoteVerificationReport?.review_status || 'missing',
  source_link_quote_verification_quote_backed_chunks:
    sourceLinkQuoteVerificationReport?.summary?.quote_backed_chunks || 0,
  source_link_quote_verification_quote_records:
    sourceLinkQuoteVerificationReport?.summary?.quote_records || 0,
  source_link_quote_verification_unique_source_urls:
    sourceLinkQuoteVerificationReport?.summary?.unique_source_urls || 0,
  source_link_quote_verification_source_urls_fetch_ok:
    sourceLinkQuoteVerificationReport?.summary?.source_urls_fetch_ok || 0,
  source_link_quote_verification_source_urls_fetch_failed:
    sourceLinkQuoteVerificationReport?.summary?.source_urls_fetch_failed || 0,
  source_link_quote_verification_quote_hash_mismatches:
    sourceLinkQuoteVerificationReport?.summary?.quote_hash_mismatches || 0,
  source_link_quote_verification_quote_records_missing_hash:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_missing_hash || 0,
  source_link_quote_verification_quote_records_missing_locator:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_missing_locator || 0,
  source_link_quote_verification_quote_records_missing_source_url:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_missing_source_url || 0,
  source_link_quote_verification_quote_records_matched_in_fetched_source:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_matched_in_fetched_source || 0,
  source_link_quote_verification_quote_records_unmatched_in_fetched_source:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_unmatched_in_fetched_source || 0,
  source_link_quote_verification_quote_records_pdf_fetch_only:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_pdf_fetch_only || 0,
  source_link_quote_verification_quote_records_without_machine_text_match:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_without_machine_text_match || 0,
  source_link_quote_verification_quote_records_with_any_issue:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_with_any_issue || 0,
  source_link_quote_verification_quote_records_requiring_repair:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_requiring_repair || 0,
  source_link_quote_verification_release_ready:
    Boolean(sourceLinkQuoteVerificationReport?.summary?.quote_verification_release_ready),
  source_link_quote_verification_all_quote_hashes_valid:
    Boolean(sourceLinkQuoteVerificationReport?.summary?.all_quote_hashes_valid),
  source_link_quote_verification_all_quote_records_have_locator:
    Boolean(sourceLinkQuoteVerificationReport?.summary?.all_quote_records_have_locator),
  source_link_quote_verification_all_quote_records_have_source_url:
    Boolean(sourceLinkQuoteVerificationReport?.summary?.all_quote_records_have_source_url),
  source_freshness_report_present: Boolean(sourceFreshnessReport),
  source_freshness_status: sourceFreshnessReport?.review_status || 'missing',
  source_freshness_total_sources: sourceFreshnessReport?.summary?.total_sources || 0,
  source_freshness_sources_with_publication_year:
    sourceFreshnessReport?.summary?.sources_with_publication_year || 0,
  source_freshness_stale_sources: sourceFreshnessReport?.summary?.stale_sources || 0,
  source_freshness_refresh_due_now_sources:
    sourceFreshnessReport?.summary?.refresh_due_now_sources || 0,
  source_freshness_missing_local_review_date_sources:
    sourceFreshnessReport?.summary?.missing_local_review_date_sources || 0,
  source_freshness_learner_facing_quote_backed_sources:
    sourceFreshnessReport?.summary?.learner_facing_quote_backed_sources || 0,
  source_freshness_learner_facing_quote_backed_sources_release_blocked:
    sourceFreshnessReport?.summary?.learner_facing_quote_backed_sources_release_blocked || 0,
  source_freshness_stale_learner_facing_quote_backed_sources:
    sourceFreshnessReport?.summary?.stale_learner_facing_quote_backed_sources || 0,
  source_freshness_learner_facing_release_ready:
    Boolean(sourceFreshnessReport?.summary?.learner_facing_source_freshness_release_ready),
  source_freshness_review_packets_present: Boolean(sourceFreshnessReviewPackets),
  source_freshness_review_packet_status: sourceFreshnessReviewPackets?.review_status || 'missing',
  source_freshness_review_packet_count: sourceFreshnessReviewPackets?.summary?.total_packets || 0,
  source_freshness_review_packets_release_blocked:
    sourceFreshnessReviewPackets?.summary?.release_blocked_packets || 0,
  source_freshness_review_packets_pending:
    sourceFreshnessReviewPackets?.summary?.pending_review_packets || 0,
  source_freshness_review_packets_alignment:
    Boolean(sourceFreshnessReviewPackets?.summary?.all_learner_facing_sources_packeted),
  source_freshness_review_ready_for_national_release:
    Boolean(sourceFreshnessReviewPackets?.summary?.ready_for_national_release_from_freshness_review),
  source_freshness_adjudication_status_present: Boolean(sourceFreshnessAdjudicationStatus),
  source_freshness_adjudication_status:
    sourceFreshnessAdjudicationStatus?.review_status || 'missing',
  source_freshness_adjudication_review_file_present:
    Boolean(sourceFreshnessAdjudicationStatus?.summary?.review_file_present),
  source_freshness_adjudication_submitted_reviews:
    sourceFreshnessAdjudicationStatus?.summary?.submitted_source_reviews || 0,
  source_freshness_adjudication_valid_reviews:
    sourceFreshnessAdjudicationStatus?.summary?.valid_source_reviews || 0,
  source_freshness_adjudication_nationally_approved_reviews:
    sourceFreshnessAdjudicationStatus?.summary?.nationally_approved_source_reviews || 0,
  source_freshness_adjudication_invalid_review_inputs:
    sourceFreshnessAdjudicationStatus?.summary?.invalid_review_input_count || 0,
  source_freshness_adjudication_packets_missing_review:
    sourceFreshnessAdjudicationStatus?.summary?.packets_missing_review || 0,
  source_freshness_adjudication_ready_for_national_release:
    Boolean(sourceFreshnessAdjudicationStatus?.summary?.ready_for_national_source_freshness_release),
  high_risk_quote_coverage_depth_report_present: Boolean(highRiskQuoteCoverageDepthReport),
  high_risk_quote_coverage_depth_status:
    highRiskQuoteCoverageDepthReport?.review_status || 'missing',
  high_risk_quote_coverage_depth_topic_count:
    highRiskQuoteCoverageDepthReport?.summary?.high_risk_topic_count || 0,
  high_risk_quote_coverage_depth_topics_with_any_quote:
    highRiskQuoteCoverageDepthReport?.summary?.topics_with_any_quote_backed_coverage || 0,
  high_risk_quote_coverage_depth_topics_meeting_minimum_quote_chunks:
    highRiskQuoteCoverageDepthReport?.summary?.topics_meeting_minimum_quote_chunks || 0,
  high_risk_quote_coverage_depth_topics_meeting_core_facet_depth:
    highRiskQuoteCoverageDepthReport?.summary?.topics_meeting_core_facet_depth || 0,
  high_risk_quote_coverage_depth_topics_missing_required_core_facets:
    highRiskQuoteCoverageDepthReport?.summary?.topics_missing_required_core_facets || 0,
  high_risk_quote_coverage_depth_missing_required_topic_facet_pairs:
    highRiskQuoteCoverageDepthReport?.summary?.missing_required_topic_facet_pairs || 0,
  high_risk_quote_coverage_depth_generated_needs_review_chunks:
    highRiskQuoteCoverageDepthReport?.summary?.generated_needs_review_chunks_on_high_risk_topics || 0,
  high_risk_quote_coverage_depth_release_ready:
    Boolean(highRiskQuoteCoverageDepthReport?.summary?.quote_coverage_depth_release_ready),
  high_risk_clinical_classification_report_present: Boolean(highRiskClinicalClassificationReport),
  high_risk_clinical_classification_status:
    highRiskClinicalClassificationReport?.review_status || 'missing',
  high_risk_clinical_classification_policy_ready:
    Boolean(highRiskClinicalClassificationReport?.summary?.high_risk_classification_policy_ready),
  high_risk_clinical_classification_topic_count:
    highRiskClinicalClassificationReport?.summary?.structured_topic_policy_rows || 0,
  high_risk_clinical_classification_topics_with_alias_policy:
    highRiskClinicalClassificationReport?.summary?.topics_with_alias_policy || 0,
  high_risk_clinical_classification_topic_alias_probes:
    highRiskClinicalClassificationReport?.summary?.topic_alias_probes || 0,
  high_risk_clinical_classification_topic_alias_probes_passed:
    highRiskClinicalClassificationReport?.summary?.topic_alias_probes_passed || 0,
  high_risk_clinical_classification_retrieval_matrix_rows:
    highRiskClinicalClassificationReport?.summary?.retrieval_matrix_rows || 0,
  high_risk_clinical_classification_retrieval_matrix_rows_passed:
    highRiskClinicalClassificationReport?.summary?.retrieval_matrix_rows_passed || 0,
  high_risk_clinical_classification_case_rows_classified:
    highRiskClinicalClassificationReport?.summary?.case_rows_classified || 0,
  high_risk_clinical_classification_claim_sets_classified:
    highRiskClinicalClassificationReport?.summary?.claim_sets_classified || 0,
  high_risk_clinical_classification_high_risk_claim_sets:
    highRiskClinicalClassificationReport?.summary?.high_risk_claim_sets || 0,
  high_risk_clinical_classification_negative_controls_classified_nonclinical:
    highRiskClinicalClassificationReport?.summary?.negative_controls_classified_nonclinical || 0,
  high_risk_clinical_classification_negative_control_probes:
    highRiskClinicalClassificationReport?.summary?.negative_control_probes || 0,
  high_risk_clinical_classification_regex_fallback_only_high_risk_probes:
    highRiskClinicalClassificationReport?.summary?.regex_fallback_only_high_risk_probes || 0,
  high_risk_clinical_classification_generated_needs_review_approved:
    highRiskClinicalClassificationReport?.summary?.generated_needs_review_approved_by_this_report || 0,
  high_risk_clinical_classification_release_ready:
    Boolean(highRiskClinicalClassificationReport?.summary?.high_risk_classification_release_ready),
  claim_reference_alignment_report_present: Boolean(feedbackClaimReferenceAlignmentReport),
  claim_reference_alignment_status:
    feedbackClaimReferenceAlignmentReport?.review_status || 'missing',
  claim_reference_alignment_claim_sets:
    feedbackClaimReferenceAlignmentReport?.summary?.total_claim_sets || 0,
  claim_reference_alignment_claim_sets_with_candidates:
    feedbackClaimReferenceAlignmentReport?.summary?.claim_sets_with_candidate_quote_backed_references || 0,
  claim_reference_alignment_claim_sets_with_aligned_references:
    feedbackClaimReferenceAlignmentReport?.summary?.claim_sets_with_aligned_quote_backed_references || 0,
  claim_reference_alignment_claim_sets_meeting_threshold:
    feedbackClaimReferenceAlignmentReport?.summary?.claim_sets_meeting_minimum_reference_threshold || 0,
  claim_reference_alignment_claim_sets_below_threshold:
    feedbackClaimReferenceAlignmentReport?.summary?.claim_sets_below_minimum_reference_threshold || 0,
  claim_reference_alignment_claim_sets_requiring_domain_specific_support:
    feedbackClaimReferenceAlignmentReport?.summary?.claim_sets_requiring_domain_specific_quote_support || 0,
  claim_reference_alignment_claim_sets_with_domain_specific_support:
    feedbackClaimReferenceAlignmentReport?.summary?.claim_sets_with_domain_specific_quote_support || 0,
  claim_reference_alignment_claim_sets_missing_domain_specific_support:
    feedbackClaimReferenceAlignmentReport?.summary?.claim_sets_missing_domain_specific_quote_support || 0,
  claim_reference_alignment_domain_specific_release_ready:
    Boolean(feedbackClaimReferenceAlignmentReport?.summary?.domain_specific_quote_support_release_ready),
  claim_reference_gap_packets_present: Boolean(claimReferenceGapReviewPackets),
  claim_reference_gap_packets_status:
    claimReferenceGapReviewPackets?.review_status || 'missing',
  claim_reference_gap_packets_total:
    claimReferenceGapReviewPackets?.summary?.total_gap_packets || 0,
  claim_reference_gap_packets_domain_specific:
    claimReferenceGapReviewPackets?.summary?.domain_specific_gap_packets || 0,
  claim_reference_gap_packets_all_domain_specific_gaps_packeted:
    Boolean(claimReferenceGapReviewPackets?.summary?.all_domain_specific_gaps_packeted),
  claim_reference_gap_packets_generated_candidates:
    claimReferenceGapReviewPackets?.summary?.generated_needs_review_candidate_chunks_packeted || 0,
  claim_reference_gap_packets_pending:
    claimReferenceGapReviewPackets?.summary?.pending_gap_packets || 0,
  claim_reference_gap_packets_ready_for_national_feedback_release:
    Boolean(claimReferenceGapReviewPackets?.summary?.ready_for_national_feedback_release_from_gap_review),
  claim_reference_gap_review_status_present: Boolean(claimReferenceGapReviewStatus),
  claim_reference_gap_review_status:
    claimReferenceGapReviewStatus?.review_status || 'missing',
  claim_reference_gap_review_total_packets:
    claimReferenceGapReviewStatus?.summary?.total_gap_packets || 0,
  claim_reference_gap_submitted_reviews:
    claimReferenceGapReviewStatus?.summary?.submitted_gap_reviews || 0,
  claim_reference_gap_valid_reviews:
    claimReferenceGapReviewStatus?.summary?.valid_gap_reviews || 0,
  claim_reference_gap_cleared_packets:
    claimReferenceGapReviewStatus?.summary?.cleared_gap_packets || 0,
  claim_reference_gap_pending_reviews:
    claimReferenceGapReviewStatus?.summary?.pending_gap_reviews || 0,
  claim_reference_gap_invalid_review_inputs:
    claimReferenceGapReviewStatus?.summary?.invalid_review_input_count || 0,
  claim_reference_gap_ready_for_national_feedback_release_from_reviews:
    Boolean(claimReferenceGapReviewStatus?.summary?.ready_for_national_feedback_release_from_reviews),
  claim_reference_alignment_source_limited_claim_sets_blocked:
    feedbackClaimReferenceAlignmentReport?.summary?.source_limited_claim_sets_blocked || 0,
  claim_reference_alignment_generated_needs_review_references_returned:
    feedbackClaimReferenceAlignmentReport?.summary?.generated_needs_review_references_returned || 0,
  claim_reference_alignment_release_ready:
    Boolean(feedbackClaimReferenceAlignmentReport?.summary?.claim_reference_alignment_release_ready),
  open_evidence_topic_retrieval_benchmark_present: Boolean(openEvidenceTopicRetrievalBenchmark),
  open_evidence_topic_retrieval_benchmark_status:
    openEvidenceTopicRetrievalBenchmark?.review_status || 'missing',
  open_evidence_topic_retrieval_total_probes:
    openEvidenceTopicRetrievalBenchmark?.summary?.total_probes || 0,
  open_evidence_topic_retrieval_topic_probes:
    openEvidenceTopicRetrievalBenchmark?.summary?.topic_probes || 0,
  open_evidence_topic_retrieval_negative_control_probes:
    openEvidenceTopicRetrievalBenchmark?.summary?.negative_control_probes || 0,
  open_evidence_topic_retrieval_all_probes_passed:
    Boolean(openEvidenceTopicRetrievalBenchmark?.summary?.all_probes_passed),
  open_evidence_topic_retrieval_all_high_risk_topics_represented:
    Boolean(openEvidenceTopicRetrievalBenchmark?.summary?.all_high_risk_topics_represented),
  open_evidence_topic_retrieval_expected_topic_reference_probes:
    openEvidenceTopicRetrievalBenchmark?.summary?.topic_probes_with_expected_topic_reference || 0,
  open_evidence_topic_retrieval_top_reference_topic_match_probes:
    openEvidenceTopicRetrievalBenchmark?.summary?.topic_probes_with_top_reference_topic_match || 0,
  open_evidence_topic_retrieval_generated_needs_review_references_returned:
    openEvidenceTopicRetrievalBenchmark?.summary?.generated_needs_review_references_returned || 0,
  open_evidence_topic_retrieval_negative_controls_returning_references:
    openEvidenceTopicRetrievalBenchmark?.summary?.negative_controls_returning_references || 0,
  learner_facing_evidence_coverage_report_present: Boolean(learnerFacingEvidenceCoverageReport),
  learner_facing_evidence_coverage_status: learnerFacingEvidenceCoverageReport?.review_status || 'missing',
  learner_facing_eligible_quote_backed_chunks:
    learnerFacingEvidenceCoverageReport?.summary?.learner_facing_eligible_quote_backed_chunks || 0,
  learner_facing_eligible_percentage:
    learnerFacingEvidenceCoverageReport?.summary?.learner_facing_eligible_percentage || 0,
  learner_facing_high_risk_topic_count:
    learnerFacingEvidenceCoverageReport?.summary?.high_risk_topic_count || 0,
  learner_facing_high_risk_topics_with_quote_backed_coverage:
    learnerFacingEvidenceCoverageReport?.summary?.high_risk_topics_with_quote_backed_coverage || 0,
  learner_facing_high_risk_topics_without_quote_backed_coverage:
    learnerFacingEvidenceCoverageReport?.summary?.high_risk_topics_without_quote_backed_coverage || 0,
  learner_facing_source_limited_formative_feedback_rows:
    learnerFacingEvidenceCoverageReport?.summary?.source_limited_formative_feedback_rows || 0,
  learner_facing_claim_entailment_packet_report_present:
    Boolean(feedbackClaimEntailmentReviewPackets),
  learner_facing_claim_entailment_packet_status:
    feedbackClaimEntailmentReviewPackets?.review_status || 'missing',
  learner_facing_claim_entailment_packet_count:
    feedbackClaimEntailmentReviewPackets?.summary?.total_claim_sets || 0,
  learner_facing_claim_entailment_packet_ready_for_national_release:
    Boolean(feedbackClaimEntailmentReviewPackets?.summary?.ready_for_national_feedback_release),
  learner_facing_claim_entailment_adjudication_status_present:
    Boolean(feedbackClaimEntailmentAdjudicationStatus),
  learner_facing_claim_entailment_adjudication_status:
    feedbackClaimEntailmentAdjudicationStatus?.review_status || 'missing',
  learner_facing_claim_entailment_validated_reviews:
    feedbackClaimEntailmentAdjudicationStatus?.summary?.valid_claim_reviews || 0,
  learner_facing_claim_entailment_invalid_review_input_count:
    feedbackClaimEntailmentAdjudicationStatus?.summary?.invalid_review_input_count || 0,
  learner_facing_claim_entailment_adjudication_ready_for_national_release:
    Boolean(feedbackClaimEntailmentAdjudicationStatus?.summary?.ready_for_national_feedback_release),
  learner_facing_claim_entailment_required_claim_sets:
    learnerFacingEvidenceCoverageReport?.summary?.claim_entailment_required_claim_sets || 0,
  learner_facing_claim_entailment_reviewed_claims:
    learnerFacingEvidenceCoverageReport?.summary?.claim_entailment_reviewed_claims || 0,
  learner_facing_evidence_release_ready:
    Boolean(learnerFacingEvidenceCoverageReport?.summary?.learner_facing_evidence_release_ready)
};

const educationalMetrics = {
  case_record_learning_objectives_missing: cases.filter((caseRecord) => !caseHasLearningObjectives(caseRecord)).length,
  draft_objective_matrix_present: Boolean(objectiveMatrix),
  objective_matrix_review_status: objectiveMatrix?.review_status || 'missing',
  objective_matrix_schema_version: objectiveMatrix?.schema_version || 'missing',
  objective_matrix_cases_mapped: objectiveMatrix?.summary?.mapped_cases || objectiveMatrixCaseIds.size,
  objective_matrix_missing_case_ids: objectiveMatrixMissingCaseIds,
  objective_matrix_extra_case_ids: objectiveMatrixExtraCaseIds,
  draft_objective_cases: objectiveMatrix?.summary?.draft_objective_cases || 0,
  reviewed_objective_cases: objectiveMatrix?.summary?.reviewed_objective_cases || 0,
  outcomes_protocol_present: existsSync(OUTCOMES_PROTOCOL_PATH),
  outcome_protocol_status: existsSync(OUTCOMES_PROTOCOL_PATH)
    ? 'draft_protocol_present_not_validated'
    : 'missing',
  medical_education_validation_rubric_present: Boolean(medicalEducationRubric),
  medical_education_validation_rubric_status: medicalEducationRubric?.review_status || 'missing',
  medical_education_validation_criteria: medicalEducationRubric?.summary?.total_criteria || 0,
  medical_education_validation_status_counts: medicalEducationRubric?.summary?.status_counts || {},
  medical_education_validation_external_review_passes: medicalEducationRubric?.summary?.external_review_passes || 0,
  core_epa_curriculum_map_present: Boolean(coreEpaCurriculumMap),
  core_epa_curriculum_map_status: coreEpaCurriculumMap?.review_status || 'missing',
  core_epa_total: coreEpaCurriculumMap?.summary?.total_core_epas || 0,
  core_epa_workflow_mapped: coreEpaCurriculumMap?.summary?.workflow_mapped_epas || 0,
  core_epa_unsupported: coreEpaCurriculumMap?.summary?.unsupported_epas || 0,
  core_epa_reviewed_case_mappings: coreEpaCurriculumMap?.summary?.reviewed_case_epa_mappings || 0,
  core_epa_draft_case_mappings: coreEpaCurriculumMap?.summary?.draft_case_epa_mappings || 0,
  curriculum_mapping_review_status_present: Boolean(curriculumMappingReviewStatus),
  curriculum_mapping_review_status: curriculumMappingReviewStatus?.review_status || 'missing',
  curriculum_mapping_review_file_present:
    Boolean(curriculumMappingReviewStatus?.summary?.review_file_present),
  curriculum_mapping_submitted_case_reviews:
    curriculumMappingReviewStatus?.summary?.submitted_case_reviews || 0,
  curriculum_mapping_valid_case_reviews:
    curriculumMappingReviewStatus?.summary?.valid_case_reviews || 0,
  curriculum_mapping_nationally_approved_case_mappings:
    curriculumMappingReviewStatus?.summary?.nationally_approved_case_mappings || 0,
  curriculum_mapping_case_mappings_missing_review:
    curriculumMappingReviewStatus?.summary?.case_mappings_missing_review || 0,
  curriculum_mapping_workflow_phases_missing_review:
    curriculumMappingReviewStatus?.summary?.workflow_phases_missing_review || 0,
  curriculum_mapping_unsupported_epa_decisions_missing:
    curriculumMappingReviewStatus?.summary?.unsupported_epa_decisions_missing || 0,
  curriculum_mapping_invalid_review_inputs:
    curriculumMappingReviewStatus?.summary?.invalid_review_input_count || 0,
  curriculum_mapping_ready_for_national_release:
    Boolean(curriculumMappingReviewStatus?.summary?.ready_for_national_curriculum_release),
  educational_outcomes_framework_present: Boolean(educationalOutcomesFramework),
  educational_outcomes_framework_status: educationalOutcomesFramework?.review_status || 'missing',
  educational_outcome_metrics: educationalOutcomesFramework?.summary?.total_metrics || 0,
  educational_outcome_currently_instrumented_metrics: educationalOutcomesFramework?.summary?.currently_instrumented_metrics || 0,
  educational_outcome_source_limited_metrics: educationalOutcomesFramework?.summary?.source_limited_metrics || 0,
  educational_outcome_external_validation_required_metrics: educationalOutcomesFramework?.summary?.requires_external_validation_metrics || 0,
  educational_outcome_cases_mapped: educationalOutcomesFramework?.summary?.cases_mapped || 0,
  educational_outcomes_runtime_report_present: Boolean(educationalOutcomesRuntimeReport),
  educational_outcomes_runtime_report_status: educationalOutcomesRuntimeReport?.review_status || 'missing',
  educational_outcome_runtime_probes: educationalOutcomesRuntimeReport?.summary?.total_probes || 0,
  educational_outcome_runtime_passed_probes: educationalOutcomesRuntimeReport?.summary?.passed_probes || 0,
  educational_outcome_runtime_failed_probes: educationalOutcomesRuntimeReport?.summary?.failed_probes || 0,
  educational_outcome_runtime_all_probes_passed: Boolean(educationalOutcomesRuntimeReport?.summary?.all_probes_passed),
  educational_outcome_runtime_export_rows: educationalOutcomesRuntimeReport?.summary?.export_row_count || 0,
  educational_outcome_runtime_high_risk_undertriage_rows: educationalOutcomesRuntimeReport?.summary?.high_risk_undertriage_rows || 0,
  educational_outcome_runtime_source_limited_feedback_rows: educationalOutcomesRuntimeReport?.summary?.source_limited_feedback_rows || 0,
  educational_outcome_runtime_privacy_disallowed_key_count: educationalOutcomesRuntimeReport?.summary?.privacy_disallowed_key_count ?? null,
  educational_outcome_runtime_direct_identifier_value_count: educationalOutcomesRuntimeReport?.summary?.direct_identifier_value_count ?? null,
  educational_outcomes_validation_status_present: Boolean(educationalOutcomesValidationStatus),
  educational_outcomes_validation_status:
    educationalOutcomesValidationStatus?.review_status || 'missing',
  educational_outcome_study_file_present:
    Boolean(educationalOutcomesValidationStatus?.summary?.study_file_present),
  educational_outcome_submitted_studies:
    educationalOutcomesValidationStatus?.summary?.submitted_studies || 0,
  educational_outcome_valid_studies:
    educationalOutcomesValidationStatus?.summary?.valid_studies || 0,
  educational_outcome_validation_invalid_study_inputs:
    educationalOutcomesValidationStatus?.summary?.invalid_study_input_count || 0,
  educational_outcome_validation_ready_for_claims:
    Boolean(educationalOutcomesValidationStatus?.summary?.ready_for_educational_validity_claims),
  educational_outcome_reviewed_studies: educationalOutcomesFramework?.summary?.reviewed_outcome_studies || 0,
  educational_outcome_pilot_studies_completed:
    educationalOutcomesValidationStatus?.summary?.completed_pilot_studies
    ?? educationalOutcomesFramework?.summary?.pilot_studies_completed
    ?? 0,
  educational_outcome_multi_site_studies_completed:
    educationalOutcomesValidationStatus?.summary?.completed_multi_site_studies
    ?? educationalOutcomesFramework?.summary?.multi_site_studies_completed
    ?? 0,
  educational_validity_review_packets_present: Boolean(educationalValidityReviewPackets),
  educational_validity_review_packets_status:
    educationalValidityReviewPackets?.review_status || 'missing',
  educational_validity_total_review_packets:
    educationalValidityReviewPackets?.summary?.total_review_packets || 0,
  educational_validity_case_curriculum_mapping_packets:
    educationalValidityReviewPackets?.summary?.case_curriculum_mapping_packets || 0,
  educational_validity_workflow_phase_review_packets:
    educationalValidityReviewPackets?.summary?.workflow_phase_review_packets || 0,
  educational_validity_unsupported_epa_decision_packets:
    educationalValidityReviewPackets?.summary?.unsupported_epa_decision_packets || 0,
  educational_validity_case_outcome_measurement_packets:
    educationalValidityReviewPackets?.summary?.case_outcome_measurement_packets || 0,
  educational_validity_outcome_metric_review_packets:
    educationalValidityReviewPackets?.summary?.outcome_metric_review_packets || 0,
  educational_validity_outcome_study_packets:
    educationalValidityReviewPackets?.summary?.outcome_study_packets || 0,
  educational_validity_source_limited_metric_packets:
    educationalValidityReviewPackets?.summary?.source_limited_metric_packets || 0,
  educational_validity_external_validation_metric_packets:
    educationalValidityReviewPackets?.summary?.external_validation_metric_packets || 0,
  educational_validity_pending_review_packets:
    educationalValidityReviewPackets?.summary?.pending_review_packets || 0,
  educational_validity_all_curriculum_outcome_gaps_packeted:
    Boolean(educationalValidityReviewPackets?.summary?.all_curriculum_outcome_gaps_packeted),
  educational_validity_ready_for_national_release_from_packets:
    Boolean(educationalValidityReviewPackets?.summary?.ready_for_national_educational_release_from_packets),
  educational_validity_review_status_present: Boolean(educationalValidityReviewStatus),
  educational_validity_review_status:
    educationalValidityReviewStatus?.review_status || 'missing',
  educational_validity_review_total_packets:
    educationalValidityReviewStatus?.summary?.total_review_packets || 0,
  educational_validity_submitted_reviews:
    educationalValidityReviewStatus?.summary?.submitted_educational_validity_reviews || 0,
  educational_validity_valid_reviews:
    educationalValidityReviewStatus?.summary?.valid_educational_validity_reviews || 0,
  educational_validity_nationally_approved_review_packets:
    educationalValidityReviewStatus?.summary?.nationally_approved_review_packets || 0,
  educational_validity_review_pending_packets:
    educationalValidityReviewStatus?.summary?.pending_review_packets || 0,
  educational_validity_review_invalid_inputs:
    educationalValidityReviewStatus?.summary?.invalid_review_input_count || 0,
  educational_validity_review_ready_for_national_release:
    Boolean(educationalValidityReviewStatus?.summary?.ready_for_national_educational_release_from_reviews)
};

const educationalStatus = educationalMetrics.curriculum_mapping_review_status_present
  && educationalMetrics.curriculum_mapping_ready_for_national_release
  && educationalMetrics.curriculum_mapping_nationally_approved_case_mappings >= cases.length
  && educationalMetrics.curriculum_mapping_case_mappings_missing_review === 0
  && educationalMetrics.curriculum_mapping_workflow_phases_missing_review === 0
  && educationalMetrics.curriculum_mapping_unsupported_epa_decisions_missing === 0
  && educationalMetrics.curriculum_mapping_invalid_review_inputs === 0
  && educationalMetrics.outcome_protocol_status === 'validated_multi_site_or_pilot_ready'
  && educationalMetrics.educational_outcomes_validation_status_present
  && educationalMetrics.educational_outcome_validation_ready_for_claims
  && educationalMetrics.educational_outcome_validation_invalid_study_inputs === 0
  && educationalMetrics.educational_outcome_pilot_studies_completed > 0
  && educationalMetrics.educational_outcome_multi_site_studies_completed > 0
  && educationalMetrics.educational_validity_review_status_present
  && educationalMetrics.educational_validity_review_total_packets === educationalMetrics.educational_validity_total_review_packets
  && educationalMetrics.educational_validity_review_pending_packets === 0
  && educationalMetrics.educational_validity_review_invalid_inputs === 0
  && educationalMetrics.educational_validity_review_ready_for_national_release
  ? 'pass'
  : educationalMetrics.draft_objective_matrix_present
    && educationalMetrics.objective_matrix_schema_version === 'case_objective_matrix_v1'
    && educationalMetrics.objective_matrix_missing_case_ids.length === 0
    && educationalMetrics.outcomes_protocol_present
    && educationalMetrics.educational_outcomes_framework_present
    && educationalMetrics.educational_outcome_currently_instrumented_metrics >= 10
    && educationalMetrics.educational_outcomes_runtime_report_present
    && educationalMetrics.educational_outcome_runtime_all_probes_passed
    && educationalMetrics.educational_outcome_runtime_privacy_disallowed_key_count === 0
    && educationalMetrics.educational_outcome_runtime_direct_identifier_value_count === 0
    && educationalMetrics.educational_outcomes_validation_status_present
    && educationalMetrics.educational_outcome_validation_invalid_study_inputs === 0
    && educationalMetrics.medical_education_validation_rubric_present
    && educationalMetrics.core_epa_curriculum_map_present
    && educationalMetrics.curriculum_mapping_review_status_present
    && educationalMetrics.curriculum_mapping_invalid_review_inputs === 0
    && educationalMetrics.educational_validity_review_packets_present
    && educationalMetrics.educational_validity_all_curriculum_outcome_gaps_packeted
    && educationalMetrics.educational_validity_review_status_present
    && educationalMetrics.educational_validity_review_invalid_inputs === 0
      ? 'partial'
      : 'fail';

const governanceMetrics = {
  draft_data_inventory_present: Boolean(governanceInventory),
  data_inventory_schema_version: governanceInventory?.schema_version || 'missing',
  data_inventory_review_status: governanceInventory?.review_status || 'missing',
  browser_storage_key_count: governanceInventory?.browser_storage_keys?.length || 0,
  optional_external_provider_count: governanceInventory?.optional_external_providers?.length || 0,
  default_workflow_network_requests: Boolean(governanceInventory?.deployment_model?.default_workflow_network_requests),
  default_public_app_backend_required: Boolean(governanceInventory?.deployment_model?.backend_server_required),
  privacy_governance_plan_present: existsSync(GOVERNANCE_PLAN_PATH),
  institutional_governance_review_status_present: Boolean(institutionalGovernanceReviewStatus),
  institutional_governance_review_status: institutionalGovernanceReviewStatus?.review_status || 'missing',
  institutional_governance_review_file_present:
    Boolean(institutionalGovernanceReviewStatus?.summary?.review_file_present),
  institutional_governance_required_domains:
    institutionalGovernanceReviewStatus?.summary?.required_domains || 0,
  institutional_governance_submitted_reviews:
    institutionalGovernanceReviewStatus?.summary?.submitted_reviews || 0,
  institutional_governance_valid_reviews:
    institutionalGovernanceReviewStatus?.summary?.valid_reviews || 0,
  institutional_governance_nationally_approved_domains:
    institutionalGovernanceReviewStatus?.summary?.nationally_approved_domains || 0,
  institutional_governance_supervised_pilot_approved_domains:
    institutionalGovernanceReviewStatus?.summary?.supervised_pilot_approved_domains || 0,
  institutional_governance_domains_missing_review:
    institutionalGovernanceReviewStatus?.summary?.domains_missing_review || 0,
  institutional_governance_invalid_review_inputs:
    institutionalGovernanceReviewStatus?.summary?.invalid_review_input_count || 0,
  institutional_governance_ready_for_national_release:
    Boolean(institutionalGovernanceReviewStatus?.summary?.ready_for_national_institutional_release),
  institutional_governance_review_packets_present: Boolean(institutionalGovernanceReviewPackets),
  institutional_governance_review_packets_status:
    institutionalGovernanceReviewPackets?.review_status || 'missing',
  institutional_governance_total_review_packets:
    institutionalGovernanceReviewPackets?.summary?.total_review_packets || 0,
  institutional_governance_domain_review_packets:
    institutionalGovernanceReviewPackets?.summary?.domain_review_packets || 0,
  institutional_governance_release_evidence_packets:
    institutionalGovernanceReviewPackets?.summary?.release_evidence_packets || 0,
  institutional_governance_pending_review_packets:
    institutionalGovernanceReviewPackets?.summary?.pending_review_packets || 0,
  institutional_governance_all_required_domains_packeted:
    Boolean(institutionalGovernanceReviewPackets?.summary?.all_required_domains_packeted),
  institutional_governance_all_release_evidence_packeted:
    Boolean(institutionalGovernanceReviewPackets?.summary?.all_release_evidence_packeted),
  institutional_governance_ready_for_national_release_from_packets:
    Boolean(institutionalGovernanceReviewPackets?.summary?.ready_for_national_governance_release_from_packets),
  scale_accessibility_plan_present: existsSync(SCALE_ACCESSIBILITY_PLAN_PATH),
  scale_bundle_report_present: Boolean(scaleBundleReport),
  scale_bundle_report_status: scaleBundleReport?.review_status || 'missing',
  scale_operations_runtime_report_present: Boolean(scaleOperationsRuntimeReport),
  scale_operations_runtime_report_status: scaleOperationsRuntimeReport?.review_status || 'missing',
  scale_operations_runtime_probes: scaleOperationsRuntimeReport?.summary?.total_probes || 0,
  scale_operations_runtime_passed_probes: scaleOperationsRuntimeReport?.summary?.passed_probes || 0,
  scale_operations_runtime_failed_probes: scaleOperationsRuntimeReport?.summary?.failed_probes || 0,
  scale_operations_runtime_all_probes_passed: Boolean(scaleOperationsRuntimeReport?.summary?.all_probes_passed),
  scale_operations_concurrent_smoke_requests: scaleOperationsRuntimeReport?.summary?.concurrent_smoke_requests || 0,
  scale_operations_concurrent_smoke_p95_ms: scaleOperationsRuntimeReport?.summary?.concurrent_smoke_p95_ms || null,
  scale_operations_spa_fallback_present: Boolean(scaleOperationsRuntimeReport?.summary?.spa_fallback_present),
  scale_operations_legacy_route_bootstrap_ok: Boolean(scaleOperationsRuntimeReport?.summary?.legacy_route_bootstrap_ok),
  scale_operations_production_load_test_completed: Boolean(scaleOperationsRuntimeReport?.summary?.production_load_test_completed),
  scale_operations_monitoring_dashboard_operational: Boolean(scaleOperationsRuntimeReport?.summary?.production_monitoring_dashboard_operational),
  scale_operations_incident_response_drill_completed: Boolean(scaleOperationsRuntimeReport?.summary?.incident_response_drill_completed),
  route_reachability_report_present: Boolean(routeReachabilityReport),
  route_reachability_report_status: routeReachabilityReport?.review_status || 'missing',
  route_reachability_total_probes: routeReachabilityReport?.summary?.total_route_probes || 0,
  route_reachability_passed_probes: routeReachabilityReport?.summary?.passed_route_probes || 0,
  route_reachability_failed_probes: routeReachabilityReport?.summary?.failed_route_probes || 0,
  route_reachability_all_probes_passed: Boolean(routeReachabilityReport?.summary?.all_route_probes_passed),
  route_reachability_default_flowboard_rendered: Boolean(routeReachabilityReport?.summary?.default_flowboard_route_rendered),
  route_reachability_legacy_path_rendered: Boolean(routeReachabilityReport?.summary?.legacy_path_route_rendered),
  route_reachability_legacy_query_rendered: Boolean(routeReachabilityReport?.summary?.legacy_query_route_rendered),
  route_reachability_wrong_app_shell_findings: routeReachabilityReport?.summary?.wrong_app_shell_findings ?? null,
  accessibility_readiness_report_present: Boolean(accessibilityReadinessReport),
  accessibility_readiness_report_status: accessibilityReadinessReport?.review_status || 'missing',
  accessibility_default_route_static_accessibility_ready: Boolean(accessibilityReadinessReport?.summary?.default_route_static_accessibility_ready),
  accessibility_critical_static_issue_count: accessibilityReadinessReport?.summary?.critical_static_issue_count ?? null,
  accessibility_unnamed_button_count: accessibilityReadinessReport?.summary?.unnamed_button_count ?? null,
  accessibility_unnamed_form_control_count: accessibilityReadinessReport?.summary?.unnamed_form_control_count ?? null,
  accessibility_focus_visible_present: Boolean(accessibilityReadinessReport?.summary?.focus_visible_present),
  accessibility_automated_keyboard_smoke_present: Boolean(accessibilityReadinessReport?.summary?.automated_keyboard_smoke_present),
  accessibility_default_landmarks_present: Boolean(accessibilityReadinessReport?.summary?.default_landmarks_present),
  accessibility_manual_wcag_required: Boolean(accessibilityReadinessReport?.summary?.manual_wcag_required),
  default_route_code_split_present: Boolean(scaleBundleReport?.source_contract?.legacy_simulator_lazy_loaded)
    && !scaleBundleReport?.source_contract?.legacy_simulator_static_import_present,
  default_route_initial_js_kb: scaleBundleReport?.summary?.initial_js_kb || null,
  default_route_initial_css_kb: scaleBundleReport?.summary?.initial_css_kb || null,
  default_route_initial_budget_passed: Boolean(scaleBundleReport?.summary?.default_route_initial_budget_passed),
  optional_large_asset_count: scaleBundleReport?.summary?.optional_large_asset_count || 0,
  restricted_privacy_check_script_present: existsSync(RESTRICTED_PRIVACY_CHECK_PATH),
  load_test_report_status: scaleOperationsRuntimeReport?.review_status
    || (existsSync(SCALE_ACCESSIBILITY_PLAN_PATH)
      ? 'draft_plan_present_not_executed'
      : 'missing'),
  wcag_audit_status: accessibilityReadinessReport?.review_status
    || (existsSync(SCALE_ACCESSIBILITY_PLAN_PATH)
      ? 'draft_plan_present_not_executed'
      : 'missing'),
  monitoring_plan_status: existsSync(SCALE_ACCESSIBILITY_PLAN_PATH)
    ? scaleOperationsRuntimeReport?.summary?.production_monitoring_dashboard_operational
      ? 'operational'
      : 'draft_plan_present_not_operational'
    : 'missing',
  institutional_review_ready:
    Boolean(institutionalGovernanceReviewStatus?.summary?.ready_for_national_institutional_release)
};

const governanceStatus = governanceMetrics.data_inventory_review_status === 'approved'
  && governanceMetrics.load_test_report_status === 'complete'
  && governanceMetrics.wcag_audit_status === 'complete'
  && governanceMetrics.institutional_review_ready
  && governanceMetrics.institutional_governance_review_packets_present
  && governanceMetrics.institutional_governance_pending_review_packets === 0
  && governanceMetrics.institutional_governance_ready_for_national_release_from_packets
  ? 'pass'
  : governanceMetrics.draft_data_inventory_present
    && governanceMetrics.data_inventory_schema_version === 'governance_data_inventory_v1'
    && governanceMetrics.privacy_governance_plan_present
    && governanceMetrics.institutional_governance_review_status_present
    && governanceMetrics.institutional_governance_invalid_review_inputs === 0
    && governanceMetrics.institutional_governance_review_packets_present
    && governanceMetrics.institutional_governance_all_required_domains_packeted
    && governanceMetrics.institutional_governance_all_release_evidence_packeted
    && governanceMetrics.scale_accessibility_plan_present
    && governanceMetrics.scale_bundle_report_present
    && governanceMetrics.default_route_initial_budget_passed
    && governanceMetrics.scale_operations_runtime_report_present
    && governanceMetrics.scale_operations_runtime_all_probes_passed
    && governanceMetrics.scale_operations_spa_fallback_present
    && governanceMetrics.scale_operations_legacy_route_bootstrap_ok
    && governanceMetrics.route_reachability_report_present
    && governanceMetrics.route_reachability_all_probes_passed
    && governanceMetrics.route_reachability_default_flowboard_rendered
    && governanceMetrics.route_reachability_legacy_path_rendered
    && governanceMetrics.route_reachability_legacy_query_rendered
    && governanceMetrics.route_reachability_wrong_app_shell_findings === 0
    && governanceMetrics.accessibility_readiness_report_present
    && governanceMetrics.accessibility_default_route_static_accessibility_ready
    && governanceMetrics.accessibility_critical_static_issue_count === 0
    && governanceMetrics.restricted_privacy_check_script_present
      ? 'partial'
      : 'fail';

const feedbackIntegrity = {
  ai_debrief_auto_loads_in_feedback_effect: feedbackLoadEffect.includes('getAiDebrief(sessionId)'),
  ai_debrief_mutates_feedback_state: feedbackSource.includes('setFeedback(prev'),
  legacy_ai_debrief_grounding_fields_present: feedbackSource.includes('ai_debrief_grounding') || feedbackSource.includes('ai_debrief_citations'),
  optional_ai_draft_panel_present: feedbackSource.includes('AI Debrief Draft') && feedbackSource.includes('AI draft text is not used for scoring'),
  source_limited_diagnosis_status_present: staticEngineSource.includes('source_record_diagnosis_unavailable')
    && feedbackSource.includes('Source-record diagnosis unavailable; formative reasoning review'),
  source_limited_consult_status_present: staticEngineSource.includes('clinician_approved_consult_unavailable')
    && feedbackSource.includes('Clinician-approved consult reference unavailable; formative consult review'),
  source_limited_reassessment_status_present: staticEngineSource.includes('reassessment_truth_unavailable')
    && staticEngineSource.includes('Reassessment reasoning is formative only'),
  source_limited_diagnosis_excluded_from_numeric_score: staticEngineSource.includes('diagnosis reasoning is excluded from the numeric score')
    && staticEngineSource.includes('source_limited_formative_domains')
    && staticEngineSource.includes('formative_score'),
  source_limited_reassessment_excluded_from_numeric_score: staticEngineSource.includes('reassessment reasoning is excluded from the numeric score')
    && staticEngineSource.includes('unscored_formative_reassessment_reasoning')
    && staticEngineSource.includes('formative_score'),
  source_limited_domain_label_present: feedbackSource.includes('Formative only; excluded from numeric score until case truth is reviewed.'),
  feedback_integrity_runtime_report_present: Boolean(feedbackIntegrityRuntimeReport),
  feedback_integrity_runtime_status: feedbackIntegrityRuntimeReport?.review_status || 'missing',
  feedback_integrity_runtime_total_probes: feedbackIntegrityRuntimeReport?.summary?.total_runtime_probes || 0,
  feedback_integrity_runtime_passed_probes: feedbackIntegrityRuntimeReport?.summary?.passed_runtime_probes || 0,
  feedback_integrity_runtime_failed_probes: feedbackIntegrityRuntimeReport?.summary?.failed_runtime_probes || 0,
  feedback_integrity_runtime_all_probes_passed:
    Boolean(feedbackIntegrityRuntimeReport?.summary?.all_runtime_probes_passed),
  feedback_integrity_runtime_openrouter_calls_before_optional_ai:
    feedbackIntegrityRuntimeReport?.summary?.openrouter_calls_before_optional_ai ?? null,
  feedback_integrity_runtime_source_limited_domains_rendered_formative_only:
    Boolean(feedbackIntegrityRuntimeReport?.summary?.source_limited_domains_rendered_formative_only),
  feedback_integrity_runtime_optional_ai_draft_separate_surface:
    Boolean(feedbackIntegrityRuntimeReport?.summary?.optional_ai_draft_separate_surface),
  optional_ai_guardrail_runtime_report_present: Boolean(optionalAiGuardrailRuntimeReport),
  optional_ai_guardrail_runtime_status: optionalAiGuardrailRuntimeReport?.review_status || 'missing',
  optional_ai_guardrail_runtime_total_probes: optionalAiGuardrailRuntimeReport?.summary?.total_runtime_probes || 0,
  optional_ai_guardrail_runtime_passed_probes: optionalAiGuardrailRuntimeReport?.summary?.passed_runtime_probes || 0,
  optional_ai_guardrail_runtime_failed_probes: optionalAiGuardrailRuntimeReport?.summary?.failed_runtime_probes || 0,
  optional_ai_guardrail_runtime_all_probes_passed:
    Boolean(optionalAiGuardrailRuntimeReport?.summary?.all_runtime_probes_passed),
  optional_ai_guardrail_openrouter_calls_before_optional_ai:
    optionalAiGuardrailRuntimeReport?.summary?.openrouter_calls_before_optional_ai ?? null,
  optional_ai_guardrail_openrouter_calls_after_bad_ai_debrief:
    optionalAiGuardrailRuntimeReport?.summary?.openrouter_calls_after_bad_ai_debrief ?? null,
  optional_ai_guardrail_openrouter_calls_after_unsafe_tutor:
    optionalAiGuardrailRuntimeReport?.summary?.openrouter_calls_after_unsafe_tutor ?? null,
  optional_ai_guardrail_bad_ai_debrief_blocked:
    Boolean(optionalAiGuardrailRuntimeReport?.summary?.bad_ai_debrief_blocked),
  optional_ai_guardrail_bad_ai_support_quality_issue_visible:
    Boolean(optionalAiGuardrailRuntimeReport?.summary?.bad_ai_debrief_support_quality_issue_visible),
  optional_ai_guardrail_bad_ai_debrief_content_not_rendered:
    Boolean(optionalAiGuardrailRuntimeReport?.summary?.bad_ai_debrief_content_not_rendered),
  optional_ai_guardrail_unsafe_tutor_blocked_before_external_ai:
    Boolean(optionalAiGuardrailRuntimeReport?.summary?.unsafe_tutor_blocked_before_external_ai),
  optional_ai_guardrail_deterministic_debrief_preserved:
    Boolean(optionalAiGuardrailRuntimeReport?.summary?.deterministic_debrief_preserved_after_optional_ai_guardrails),
  feedback_traceability_matrix_present: Boolean(feedbackTraceabilityMatrix),
  feedback_traceability_status: feedbackTraceabilityMatrix?.review_status || 'missing',
  feedback_traceability_cases: feedbackTraceabilityMatrix?.summary?.total_cases || 0,
  feedback_traceability_domains: feedbackTraceabilityMatrix?.summary?.domains_tracked || 0,
  feedback_traceability_case_domain_rows: feedbackTraceabilityMatrix?.summary?.total_case_domain_rows || 0,
  feedback_traceability_source_limited_formative_rows: feedbackTraceabilityMatrix?.summary?.source_limited_formative_rows || 0,
  feedback_traceability_numeric_rows_missing_required_case_evidence: feedbackTraceabilityMatrix?.summary?.numeric_rows_missing_required_case_evidence || 0,
  feedback_traceability_ready_for_national_feedback_release: Boolean(feedbackTraceabilityMatrix?.summary?.ready_for_national_feedback_release),
  feedback_case_domain_review_packets_present: Boolean(feedbackCaseDomainReviewPackets),
  feedback_case_domain_review_packets_status: feedbackCaseDomainReviewPackets?.review_status || 'missing',
  feedback_case_domain_total_review_packets: feedbackCaseDomainReviewPackets?.summary?.total_review_packets || 0,
  feedback_case_domain_case_domain_packets: feedbackCaseDomainReviewPackets?.summary?.case_domain_review_packets || 0,
  feedback_case_domain_source_limited_packets: feedbackCaseDomainReviewPackets?.summary?.source_limited_packets || 0,
  feedback_case_domain_all_rows_packeted: Boolean(feedbackCaseDomainReviewPackets?.summary?.all_case_domain_rows_packeted),
  feedback_case_domain_pending_review_packets: feedbackCaseDomainReviewPackets?.summary?.pending_review_packets || 0,
  feedback_case_domain_runtime_integrity_probe_passed:
    Boolean(feedbackCaseDomainReviewPackets?.summary?.runtime_integrity_probe_passed),
  feedback_case_domain_ready_for_national_release_from_packets:
    Boolean(feedbackCaseDomainReviewPackets?.summary?.ready_for_national_feedback_release_from_packets),
  feedback_case_domain_calibration_status_present: Boolean(feedbackCaseDomainCalibrationReviewStatus),
  feedback_case_domain_calibration_status: feedbackCaseDomainCalibrationReviewStatus?.review_status || 'missing',
  feedback_case_domain_calibration_total_review_packets:
    feedbackCaseDomainCalibrationReviewStatus?.summary?.total_review_packets || 0,
  feedback_case_domain_calibration_submitted_reviews:
    feedbackCaseDomainCalibrationReviewStatus?.summary?.submitted_case_domain_reviews || 0,
  feedback_case_domain_calibration_valid_reviews:
    feedbackCaseDomainCalibrationReviewStatus?.summary?.valid_case_domain_reviews || 0,
  feedback_case_domain_calibration_pending_reviews:
    feedbackCaseDomainCalibrationReviewStatus?.summary?.pending_case_domain_reviews || 0,
  feedback_case_domain_calibration_invalid_review_input_count:
    feedbackCaseDomainCalibrationReviewStatus?.summary?.invalid_review_input_count || 0,
  feedback_case_domain_calibration_ready_for_national_release:
    Boolean(feedbackCaseDomainCalibrationReviewStatus?.summary?.ready_for_national_feedback_release),
  feedback_claim_entailment_packets_present: Boolean(feedbackClaimEntailmentReviewPackets),
  feedback_claim_entailment_packets_status: feedbackClaimEntailmentReviewPackets?.review_status || 'missing',
  feedback_claim_entailment_total_claim_sets: feedbackClaimEntailmentReviewPackets?.summary?.total_claim_sets || 0,
  feedback_claim_entailment_reviewed_claim_sets: feedbackClaimEntailmentAdjudicationStatus?.summary?.valid_claim_reviews || 0,
  feedback_claim_entailment_adjudication_status_present: Boolean(feedbackClaimEntailmentAdjudicationStatus),
  feedback_claim_entailment_adjudication_status: feedbackClaimEntailmentAdjudicationStatus?.review_status || 'missing',
  feedback_claim_entailment_invalid_review_input_count:
    feedbackClaimEntailmentAdjudicationStatus?.summary?.invalid_review_input_count || 0,
  feedback_claim_entailment_nationally_approved_claim_sets:
    feedbackClaimEntailmentAdjudicationStatus?.summary?.nationally_approved_claim_sets || 0,
  feedback_claim_entailment_ready_for_national_release:
    Boolean(feedbackClaimEntailmentAdjudicationStatus?.summary?.ready_for_national_feedback_release)
};

const feedbackIsolationReady = !feedbackIntegrity.ai_debrief_auto_loads_in_feedback_effect
  && !feedbackIntegrity.ai_debrief_mutates_feedback_state
  && !feedbackIntegrity.legacy_ai_debrief_grounding_fields_present
  && feedbackIntegrity.optional_ai_draft_panel_present
  && feedbackIntegrity.source_limited_diagnosis_status_present
  && feedbackIntegrity.source_limited_consult_status_present
  && feedbackIntegrity.source_limited_reassessment_status_present
  && feedbackIntegrity.source_limited_diagnosis_excluded_from_numeric_score
  && feedbackIntegrity.source_limited_reassessment_excluded_from_numeric_score
  && feedbackIntegrity.source_limited_domain_label_present
  && feedbackIntegrity.feedback_integrity_runtime_report_present
  && feedbackIntegrity.feedback_integrity_runtime_all_probes_passed
  && feedbackIntegrity.feedback_integrity_runtime_openrouter_calls_before_optional_ai === 0
  && feedbackIntegrity.feedback_integrity_runtime_source_limited_domains_rendered_formative_only
  && feedbackIntegrity.feedback_integrity_runtime_optional_ai_draft_separate_surface
  && feedbackIntegrity.optional_ai_guardrail_runtime_report_present
  && feedbackIntegrity.optional_ai_guardrail_runtime_all_probes_passed
  && feedbackIntegrity.optional_ai_guardrail_openrouter_calls_before_optional_ai === 0
  && feedbackIntegrity.optional_ai_guardrail_bad_ai_debrief_blocked
  && feedbackIntegrity.optional_ai_guardrail_bad_ai_support_quality_issue_visible
  && feedbackIntegrity.optional_ai_guardrail_bad_ai_debrief_content_not_rendered
  && feedbackIntegrity.optional_ai_guardrail_unsafe_tutor_blocked_before_external_ai
  && feedbackIntegrity.optional_ai_guardrail_deterministic_debrief_preserved;

const feedbackTraceabilityPresent = feedbackIntegrity.feedback_traceability_matrix_present
  && feedbackIntegrity.feedback_traceability_cases === caseMetrics.total_cases
  && feedbackIntegrity.feedback_traceability_domains >= 8;

const feedbackClaimEntailmentPacketsPresent = feedbackIntegrity.feedback_claim_entailment_packets_present
  && feedbackIntegrity.feedback_claim_entailment_total_claim_sets >= feedbackIntegrity.feedback_traceability_domains;
const feedbackClaimEntailmentAdjudicationPresent = feedbackIntegrity.feedback_claim_entailment_adjudication_status_present
  && feedbackIntegrity.feedback_claim_entailment_invalid_review_input_count === 0;
const feedbackCaseDomainReviewPacketsPresent = feedbackIntegrity.feedback_case_domain_review_packets_present
  && feedbackIntegrity.feedback_case_domain_all_rows_packeted
  && feedbackIntegrity.feedback_case_domain_case_domain_packets === feedbackIntegrity.feedback_traceability_case_domain_rows
  && feedbackIntegrity.feedback_case_domain_total_review_packets === feedbackIntegrity.feedback_traceability_case_domain_rows;
const feedbackCaseDomainCalibrationStatusPresent = feedbackIntegrity.feedback_case_domain_calibration_status_present
  && feedbackIntegrity.feedback_case_domain_calibration_total_review_packets === feedbackIntegrity.feedback_traceability_case_domain_rows
  && feedbackIntegrity.feedback_case_domain_calibration_invalid_review_input_count === 0;

const feedbackIntegrityStatus = feedbackIsolationReady && feedbackTraceabilityPresent && feedbackClaimEntailmentPacketsPresent && feedbackClaimEntailmentAdjudicationPresent && feedbackCaseDomainReviewPacketsPresent && feedbackCaseDomainCalibrationStatusPresent
  ? feedbackIntegrity.feedback_traceability_ready_for_national_feedback_release
    && feedbackIntegrity.feedback_traceability_numeric_rows_missing_required_case_evidence === 0
    && feedbackIntegrity.feedback_claim_entailment_ready_for_national_release
    && feedbackIntegrity.feedback_case_domain_pending_review_packets === 0
    && feedbackIntegrity.feedback_case_domain_ready_for_national_release_from_packets
    && feedbackIntegrity.feedback_case_domain_calibration_pending_reviews === 0
    && feedbackIntegrity.feedback_case_domain_calibration_ready_for_national_release
      ? 'pass'
      : 'partial'
  : 'fail';

const learnerSafetyMetrics = {
  red_team_suite_present: Boolean(learnerSafetyRedTeam),
  red_team_suite_status: learnerSafetyRedTeam?.review_status || 'missing',
  red_team_total_tests: learnerSafetyRedTeam?.summary?.total_tests || 0,
  red_team_required_categories: learnerSafetyRedTeam?.summary?.required_categories || 0,
  red_team_covered_required_categories: learnerSafetyRedTeam?.summary?.covered_required_categories || 0,
  red_team_runtime_report_present: Boolean(learnerSafetyRuntimeReport),
  red_team_runtime_report_status: learnerSafetyRuntimeReport?.review_status || 'missing',
  red_team_runtime_passed_tests: learnerSafetyRuntimeReport?.summary?.passed_policy_tests || 0,
  red_team_runtime_failed_tests: learnerSafetyRuntimeReport?.summary?.failed_policy_tests || 0,
  red_team_runtime_covered_categories: learnerSafetyRuntimeReport?.summary?.runtime_covered_categories || 0,
  red_team_review_status_present: Boolean(learnerSafetyReviewStatus),
  red_team_review_status: learnerSafetyReviewStatus?.review_status || 'missing',
  red_team_review_file_present: Boolean(learnerSafetyReviewStatus?.summary?.review_file_present),
  red_team_submitted_reviews: learnerSafetyReviewStatus?.summary?.submitted_reviews || 0,
  red_team_valid_reviews: learnerSafetyReviewStatus?.summary?.valid_reviews || 0,
  red_team_nationally_approved_tests: learnerSafetyReviewStatus?.summary?.nationally_approved_tests || 0,
  red_team_supervised_pilot_approved_tests: learnerSafetyReviewStatus?.summary?.supervised_pilot_approved_tests || 0,
  red_team_tests_missing_review: learnerSafetyReviewStatus?.summary?.tests_missing_review ?? (
    learnerSafetyRuntimeReport?.summary?.total_tests || learnerSafetyRedTeam?.summary?.total_tests || 0
  ),
  red_team_invalid_review_inputs: learnerSafetyReviewStatus?.summary?.invalid_review_input_count || 0,
  red_team_review_ready_for_national_release:
    Boolean(learnerSafetyReviewStatus?.summary?.ready_for_national_learner_safety_release),
  red_team_clinician_reviewed_tests: learnerSafetyReviewStatus?.summary?.valid_reviews || 0,
  red_team_validator_present: existsSync(LEARNER_SAFETY_RED_TEAM_VALIDATOR_PATH),
  optional_ai_guardrail_runtime_report_present: Boolean(optionalAiGuardrailRuntimeReport),
  optional_ai_guardrail_runtime_status: optionalAiGuardrailRuntimeReport?.review_status || 'missing',
  optional_ai_guardrail_runtime_all_probes_passed:
    Boolean(optionalAiGuardrailRuntimeReport?.summary?.all_runtime_probes_passed),
  optional_ai_guardrail_openrouter_calls_before_optional_ai:
    optionalAiGuardrailRuntimeReport?.summary?.openrouter_calls_before_optional_ai ?? null,
  optional_ai_guardrail_bad_ai_debrief_blocked:
    Boolean(optionalAiGuardrailRuntimeReport?.summary?.bad_ai_debrief_blocked),
  optional_ai_guardrail_bad_ai_support_quality_issue_visible:
    Boolean(optionalAiGuardrailRuntimeReport?.summary?.bad_ai_debrief_support_quality_issue_visible),
  optional_ai_guardrail_bad_ai_debrief_content_not_rendered:
    Boolean(optionalAiGuardrailRuntimeReport?.summary?.bad_ai_debrief_content_not_rendered),
  optional_ai_guardrail_unsafe_tutor_blocked_before_external_ai:
    Boolean(optionalAiGuardrailRuntimeReport?.summary?.unsafe_tutor_blocked_before_external_ai),
  optional_ai_guardrail_deterministic_debrief_preserved:
    Boolean(optionalAiGuardrailRuntimeReport?.summary?.deterministic_debrief_preserved_after_optional_ai_guardrails),
  red_team_all_required_categories_covered: Boolean(
    learnerSafetyRedTeam?.summary?.required_categories
      && learnerSafetyRedTeam?.summary?.covered_required_categories >= learnerSafetyRedTeam?.summary?.required_categories
  ),
  red_team_policy_runtime_passed: Boolean(learnerSafetyRuntimeReport?.summary?.all_policy_tests_passed),
  red_team_all_required_categories_runtime_passed: Boolean(learnerSafetyRuntimeReport?.summary?.all_required_categories_passed),
  learner_safety_review_packets_present: Boolean(learnerSafetyReviewPackets),
  learner_safety_review_packets_status: learnerSafetyReviewPackets?.review_status || 'missing',
  learner_safety_total_review_packets:
    learnerSafetyReviewPackets?.summary?.total_review_packets || 0,
  learner_safety_red_team_test_review_packets:
    learnerSafetyReviewPackets?.summary?.red_team_test_review_packets || 0,
  learner_safety_optional_ai_guardrail_review_packets:
    learnerSafetyReviewPackets?.summary?.optional_ai_guardrail_review_packets || 0,
  learner_safety_required_categories_packeted:
    learnerSafetyReviewPackets?.summary?.required_categories_packeted || 0,
  learner_safety_all_required_categories_packeted:
    Boolean(learnerSafetyReviewPackets?.summary?.all_required_categories_packeted),
  learner_safety_runtime_passed_red_team_packets:
    learnerSafetyReviewPackets?.summary?.runtime_passed_red_team_packets || 0,
  learner_safety_pending_review_packets:
    learnerSafetyReviewPackets?.summary?.pending_review_packets || 0,
  learner_safety_optional_ai_guardrail_runtime_passed:
    Boolean(learnerSafetyReviewPackets?.summary?.optional_ai_guardrail_runtime_passed),
  learner_safety_ready_for_national_release_from_packets:
    Boolean(learnerSafetyReviewPackets?.summary?.ready_for_national_learner_safety_release_from_packets)
};

const learnerSafetyStatus = learnerSafetyMetrics.red_team_total_tests > 0
  && learnerSafetyMetrics.red_team_runtime_passed_tests >= learnerSafetyMetrics.red_team_total_tests
  && learnerSafetyMetrics.red_team_review_status_present
  && learnerSafetyMetrics.red_team_review_ready_for_national_release
  && learnerSafetyMetrics.red_team_nationally_approved_tests >= learnerSafetyMetrics.red_team_total_tests
  && learnerSafetyMetrics.red_team_tests_missing_review === 0
  && learnerSafetyMetrics.red_team_invalid_review_inputs === 0
  && learnerSafetyMetrics.learner_safety_review_packets_present
  && learnerSafetyMetrics.learner_safety_pending_review_packets === 0
  && learnerSafetyMetrics.learner_safety_ready_for_national_release_from_packets
  && learnerSafetyMetrics.optional_ai_guardrail_runtime_report_present
  && learnerSafetyMetrics.optional_ai_guardrail_runtime_all_probes_passed
  && learnerSafetyMetrics.optional_ai_guardrail_openrouter_calls_before_optional_ai === 0
  && learnerSafetyMetrics.optional_ai_guardrail_bad_ai_debrief_blocked
  && learnerSafetyMetrics.optional_ai_guardrail_bad_ai_support_quality_issue_visible
  && learnerSafetyMetrics.optional_ai_guardrail_bad_ai_debrief_content_not_rendered
  && learnerSafetyMetrics.optional_ai_guardrail_unsafe_tutor_blocked_before_external_ai
  && learnerSafetyMetrics.optional_ai_guardrail_deterministic_debrief_preserved
  ? 'pass'
  : learnerSafetyMetrics.red_team_suite_present
    && learnerSafetyMetrics.red_team_validator_present
    && learnerSafetyMetrics.red_team_all_required_categories_covered
    && learnerSafetyMetrics.red_team_policy_runtime_passed
    && learnerSafetyMetrics.red_team_review_status_present
    && learnerSafetyMetrics.red_team_invalid_review_inputs === 0
    && learnerSafetyMetrics.learner_safety_review_packets_present
    && learnerSafetyMetrics.learner_safety_all_required_categories_packeted
    && learnerSafetyMetrics.learner_safety_optional_ai_guardrail_runtime_passed
    && learnerSafetyMetrics.optional_ai_guardrail_runtime_report_present
    && learnerSafetyMetrics.optional_ai_guardrail_runtime_all_probes_passed
    && learnerSafetyMetrics.optional_ai_guardrail_openrouter_calls_before_optional_ai === 0
    && learnerSafetyMetrics.optional_ai_guardrail_bad_ai_debrief_blocked
    && learnerSafetyMetrics.optional_ai_guardrail_bad_ai_support_quality_issue_visible
    && learnerSafetyMetrics.optional_ai_guardrail_bad_ai_debrief_content_not_rendered
    && learnerSafetyMetrics.optional_ai_guardrail_unsafe_tutor_blocked_before_external_ai
    && learnerSafetyMetrics.optional_ai_guardrail_deterministic_debrief_preserved
      ? 'partial'
      : 'fail';

const equityBiasMetrics = {
  equity_bias_audit_present: Boolean(equityBiasAudit),
  equity_bias_audit_status: equityBiasAudit?.review_status || 'missing',
  equity_bias_total_cases: equityBiasAudit?.summary?.total_cases || 0,
  equity_reviewed_cases: equityBiasAudit?.summary?.equity_reviewed_cases || 0,
  pending_equity_review_cases: equityBiasAudit?.summary?.pending_equity_review_cases || 0,
  bias_policy_probes: equityBiasAudit?.summary?.bias_policy_probes || 0,
  bias_policy_probes_passed: equityBiasAudit?.summary?.bias_policy_probes_passed || 0,
  bias_policy_probes_failed: equityBiasAudit?.summary?.bias_policy_probes_failed || 0,
  all_bias_policy_probes_passed: Boolean(equityBiasAudit?.summary?.all_bias_policy_probes_passed),
  learner_safety_bias_probe_present: Boolean(equityBiasAudit?.summary?.learner_safety_bias_probe_present),
  pediatric_cases: equityBiasAudit?.summary?.pediatric_cases || 0,
  older_adult_cases: equityBiasAudit?.summary?.older_adult_cases || 0,
  language_access_documented_cases: equityBiasAudit?.summary?.language_access_documented_cases || 0,
  disability_or_accommodation_documented_cases: equityBiasAudit?.summary?.disability_or_accommodation_documented_cases || 0,
  pregnancy_status_documented_cases: equityBiasAudit?.summary?.pregnancy_status_documented_cases || 0,
  race_ethnicity_documented_in_public_cases: equityBiasAudit?.summary?.race_ethnicity_documented_in_public_cases || 0,
  equity_case_review_status_present: Boolean(equityCaseReviewStatus),
  equity_case_review_status: equityCaseReviewStatus?.review_status || 'missing',
  equity_case_review_file_present: Boolean(equityCaseReviewStatus?.summary?.review_file_present),
  equity_case_submitted_reviews: equityCaseReviewStatus?.summary?.submitted_reviews || 0,
  equity_case_valid_reviews: equityCaseReviewStatus?.summary?.valid_reviews || 0,
  equity_case_nationally_approved_cases: equityCaseReviewStatus?.summary?.nationally_approved_cases || 0,
  equity_case_supervised_pilot_approved_cases: equityCaseReviewStatus?.summary?.supervised_pilot_approved_cases || 0,
  equity_case_cases_missing_review: equityCaseReviewStatus?.summary?.cases_missing_review || 0,
  equity_case_invalid_review_inputs: equityCaseReviewStatus?.summary?.invalid_review_input_count || 0,
  equity_case_ready_for_national_release: Boolean(equityCaseReviewStatus?.summary?.ready_for_national_equity_release),
  equity_case_review_packets_present: Boolean(equityCaseReviewPackets),
  equity_case_review_packets_status: equityCaseReviewPackets?.review_status || 'missing',
  equity_case_total_review_packets: equityCaseReviewPackets?.summary?.total_review_packets || 0,
  equity_case_review_packet_cases: equityCaseReviewPackets?.summary?.case_review_packets || 0,
  equity_bias_policy_probe_review_packets:
    equityCaseReviewPackets?.summary?.bias_policy_probe_review_packets || 0,
  equity_case_bank_coverage_gap_packets:
    equityCaseReviewPackets?.summary?.case_bank_coverage_gap_packets || 0,
  equity_case_all_cases_packeted: Boolean(equityCaseReviewPackets?.summary?.all_cases_packeted),
  equity_bias_policy_all_probes_packeted:
    Boolean(equityCaseReviewPackets?.summary?.all_bias_policy_probes_packeted),
  equity_case_pending_review_packets:
    equityCaseReviewPackets?.summary?.pending_review_packets || 0,
  equity_case_ready_for_national_release_from_packets:
    Boolean(equityCaseReviewPackets?.summary?.ready_for_national_equity_release_from_packets),
  age_band_counts: equityBiasAudit?.summary?.age_band_counts || {},
  sex_distribution: equityBiasAudit?.summary?.sex_distribution || {}
};

const equityBiasStatus = equityBiasMetrics.equity_case_ready_for_national_release
  && equityBiasMetrics.equity_case_nationally_approved_cases >= caseMetrics.total_cases
  && equityBiasMetrics.equity_case_cases_missing_review === 0
  && equityBiasMetrics.equity_case_invalid_review_inputs === 0
  && equityBiasMetrics.equity_case_review_packets_present
  && equityBiasMetrics.equity_case_pending_review_packets === 0
  && equityBiasMetrics.equity_case_ready_for_national_release_from_packets
  && equityBiasMetrics.all_bias_policy_probes_passed
  && equityBiasMetrics.language_access_documented_cases > 0
  && equityBiasMetrics.disability_or_accommodation_documented_cases > 0
  ? 'pass'
  : equityBiasMetrics.equity_bias_audit_present
    && equityBiasMetrics.all_bias_policy_probes_passed
    && equityBiasMetrics.equity_case_review_status_present
    && equityBiasMetrics.equity_case_invalid_review_inputs === 0
    && equityBiasMetrics.equity_case_review_packets_present
    && equityBiasMetrics.equity_case_all_cases_packeted
    && equityBiasMetrics.equity_bias_policy_all_probes_packeted
    && equityBiasMetrics.pending_equity_review_cases >= caseMetrics.total_cases
      ? 'partial'
      : 'fail';

const gates = [
  gate(
    'case_truth',
    'Every public case has reviewed diagnosis, referral, retrospective truth, and objective data.',
    caseMetrics.total_cases >= 100
      && caseMetrics.missing_source_record_diagnosis === 0
      && caseMetrics.missing_clinician_approved_referral === 0
      && caseMetrics.missing_retrospective_truth === 0
      && caseMetrics.missing_optional_objective_data === 0
      && caseMetrics.case_truth_reviewed_cases >= caseMetrics.total_cases
      && caseMetrics.case_truth_adjudication_ready_cases >= caseMetrics.total_cases
      && caseMetrics.case_truth_adjudication_worklist_ready_for_national_release
      && caseMetrics.clinical_review_adjudication_issue_count === 0
      ? 'pass'
      : 'fail',
    {
      total_cases: caseMetrics.total_cases,
      missing_source_record_diagnosis: caseMetrics.missing_source_record_diagnosis,
      missing_clinician_approved_referral: caseMetrics.missing_clinician_approved_referral,
      missing_retrospective_truth: caseMetrics.missing_retrospective_truth,
      missing_optional_objective_data: caseMetrics.missing_optional_objective_data,
      case_truth_review_queue_present: caseMetrics.case_truth_review_queue_present,
      case_truth_review_status: caseMetrics.case_truth_review_status,
      case_truth_review_packets: caseMetrics.case_truth_review_packets,
      case_truth_reviewed_cases: caseMetrics.case_truth_reviewed_cases,
      case_truth_pending_cases: caseMetrics.case_truth_pending_cases,
      case_truth_source_limitations_packeted: caseMetrics.case_truth_source_limitations_packeted,
      case_truth_simulation_reveal_scaffolds_packeted: caseMetrics.case_truth_simulation_reveal_scaffolds_packeted,
      case_truth_packets_with_all_source_limitations_scaffolded:
        caseMetrics.case_truth_packets_with_all_source_limitations_scaffolded,
      case_truth_packets_with_unscaffolded_source_limitations:
        caseMetrics.case_truth_packets_with_unscaffolded_source_limitations,
      case_truth_packets_with_source_narrative_age_mismatch:
        caseMetrics.case_truth_packets_with_source_narrative_age_mismatch,
      case_truth_packets_with_source_esi_reviewer_disagreement:
        caseMetrics.case_truth_packets_with_source_esi_reviewer_disagreement,
      case_truth_review_packet_scaffold_completeness_ready:
        caseMetrics.case_truth_review_packet_scaffold_completeness_ready,
      case_truth_adjudication_worklist_present: caseMetrics.case_truth_adjudication_worklist_present,
      case_truth_adjudication_worklist_status: caseMetrics.case_truth_adjudication_worklist_status,
      case_truth_adjudication_work_items: caseMetrics.case_truth_adjudication_work_items,
      case_truth_adjudication_worklist_pending: caseMetrics.case_truth_adjudication_worklist_pending,
      case_truth_adjudication_worklist_high_priority_items:
        caseMetrics.case_truth_adjudication_worklist_high_priority_items,
      case_truth_adjudication_worklist_release_blockers:
        caseMetrics.case_truth_adjudication_worklist_release_blockers,
      case_truth_adjudication_worklist_all_cases_have_work_item:
        caseMetrics.case_truth_adjudication_worklist_all_cases_have_work_item,
      case_truth_adjudication_worklist_starter_templates_present:
        caseMetrics.case_truth_adjudication_worklist_starter_templates_present,
      case_truth_adjudication_worklist_ready_for_national_release:
        caseMetrics.case_truth_adjudication_worklist_ready_for_national_release,
      clinical_review_adjudication_contract_present: caseMetrics.clinical_review_adjudication_contract_present,
      clinical_review_adjudication_status: caseMetrics.clinical_review_adjudication_status,
      case_truth_adjudication_ready_cases: caseMetrics.case_truth_adjudication_ready_cases,
      clinical_review_adjudication_issue_count: caseMetrics.clinical_review_adjudication_issue_count
    },
    {
      total_cases_minimum: 100,
      missing_required_truth_fields: 0,
      case_truth_reviewed_cases: 'all_cases',
      case_truth_adjudication_worklist_present: true,
      case_truth_adjudication_work_items: 'all_cases',
      case_truth_adjudication_worklist_pending: 0,
      case_truth_adjudication_worklist_release_blockers: 0,
      case_truth_adjudication_worklist_all_cases_have_work_item: true,
      case_truth_adjudication_worklist_starter_templates_present: true,
      case_truth_adjudication_worklist_ready_for_national_release: true,
      case_truth_adjudication_ready_cases: 'all_cases',
      clinical_review_adjudication_issue_count: 0
    }
  ),
  gate(
    'case_generation_quality',
    'Public simulation cases have source-record provenance, reviewed teaching scaffolds, adequate differential/reveal structure, and release-blocker flags before national use.',
    caseGenerationQualityStatus,
    caseGenerationQualityMetrics,
    {
      case_generation_quality_report_present: true,
      case_generation_quality_total_cases: caseMetrics.total_cases,
      cases_with_source_scaffold_issues: 0,
      cases_with_augmentation_issues: 0,
      cases_missing_any_truth_field: 0,
      cases_with_simulation_structuring_gaps: 0,
      augmented_grading_reference_fact_count: 0,
      case_bank_expansion_status_present: true,
      case_bank_expansion_packets_present: true,
      case_bank_expansion_blueprint_slots: 'recommended_minimum_new_cases',
      case_bank_expansion_all_target_shortfalls_have_blueprint_coverage: true,
      case_bank_expansion_pending_blueprint_slots: 0,
      case_bank_expansion_review_status_present: true,
      case_bank_expansion_valid_blueprint_reviews: 'all_blueprint_slots',
      case_bank_expansion_national_countable_blueprint_reviews: 'recommended_minimum_new_cases',
      case_bank_expansion_pending_blueprint_reviews: 0,
      case_bank_expansion_invalid_review_inputs: 0,
      case_bank_expansion_review_ready_for_national_release: true,
      case_bank_ready_for_national_release: true,
      case_bank_case_count_shortfall: 0,
      case_bank_target_gap_count: 0,
      case_bank_recommended_minimum_new_cases: 0,
      draft_practice_scaffold_eligible_cases: caseMetrics.total_cases,
      national_release_eligible_cases: caseMetrics.total_cases,
      national_release_ready: true
    }
  ),
  gate(
    'open_evidence_grounding',
    'High-risk public feedback can rely on quote-backed or clinician-approved evidence, with generated-needs-review chunks removed or reviewed.',
    evidenceMetrics.generated_needs_review_count === 0
      && evidenceMetrics.needs_review_count === 0
      && evidenceMetrics.missing_locator_chunk_count === 0
      && evidenceMetrics.high_risk_topics_without_quote_coverage.length === 0
      && evidenceMetrics.evidence_quality_dashboard_present
      && evidenceMetrics.evidence_quality_dashboard_alignment_checks_passed
      && evidenceMetrics.evidence_quality_dashboard_release_ready
      && evidenceMetrics.evidence_quality_dashboard_open_release_blockers === 0
      && evidenceMetrics.evidence_review_pending_generated_chunks === 0
      && evidenceMetrics.open_evidence_grounding_review_packets_present
      && evidenceMetrics.open_evidence_grounding_pending_review_packets === 0
      && evidenceMetrics.open_evidence_grounding_generated_chunks_packeted === 0
      && evidenceMetrics.open_evidence_grounding_generated_evidence_allowed_for_learner_feedback === false
      && evidenceMetrics.open_evidence_grounding_ready_for_national_release_from_packets
      && evidenceMetrics.open_evidence_grounding_review_status_present
      && evidenceMetrics.open_evidence_grounding_review_total_packets === evidenceMetrics.open_evidence_grounding_total_review_packets
      && evidenceMetrics.open_evidence_grounding_review_pending_packets === 0
      && evidenceMetrics.open_evidence_grounding_review_invalid_inputs === 0
      && evidenceMetrics.open_evidence_grounding_review_ready_for_national_release
      && evidenceMetrics.open_evidence_policy_all_probes_passed
      && evidenceMetrics.open_evidence_retrieval_runtime_all_probes_passed
      && evidenceMetrics.open_evidence_runtime_quote_backed_only_default_enabled
      && evidenceMetrics.open_evidence_runtime_retrieval_reference_count > 0
      && evidenceMetrics.open_evidence_runtime_generated_needs_review_badges_rendered === 0
      && evidenceMetrics.open_evidence_runtime_needs_review_badges_rendered === 0
      && evidenceMetrics.open_evidence_runtime_generated_backlog_quarantine_warning_visible
      && evidenceMetrics.open_evidence_runtime_smoke_review_items === 0
      && evidenceMetrics.open_evidence_runtime_retrieval_quality_badge_visible
      && evidenceMetrics.open_evidence_runtime_high_risk_retrieval_quality_threshold_passed
      && evidenceMetrics.open_evidence_runtime_high_risk_retrieval_quality_minimum_base_score >= 0.08
      && evidenceMetrics.open_evidence_runtime_high_risk_retrieval_quality_top_base_score >= evidenceMetrics.open_evidence_runtime_high_risk_retrieval_quality_minimum_base_score
      && evidenceMetrics.open_evidence_runtime_bm25_fallback_badge_visible
      && evidenceMetrics.open_evidence_runtime_nonclinical_scope_guardrail_warning_visible
      && evidenceMetrics.open_evidence_runtime_nonclinical_scope_guardrail_reference_count === 0
      && evidenceMetrics.source_link_quote_verification_report_present
      && evidenceMetrics.source_link_quote_verification_quote_backed_chunks === evidenceMetrics.quote_backed_count
      && evidenceMetrics.source_link_quote_verification_all_quote_hashes_valid
      && evidenceMetrics.source_link_quote_verification_all_quote_records_have_locator
      && evidenceMetrics.source_link_quote_verification_all_quote_records_have_source_url
      && evidenceMetrics.source_link_quote_verification_source_urls_fetch_failed === 0
      && evidenceMetrics.source_link_quote_verification_quote_records_unmatched_in_fetched_source === 0
      && evidenceMetrics.source_link_quote_verification_quote_records_without_machine_text_match === 0
      && evidenceMetrics.source_link_quote_verification_quote_records_requiring_repair === 0
      && evidenceMetrics.source_link_quote_verification_release_ready
      && evidenceMetrics.source_freshness_report_present
      && evidenceMetrics.source_freshness_review_packets_present
      && evidenceMetrics.source_freshness_review_packets_alignment
      && evidenceMetrics.source_freshness_review_ready_for_national_release
      && evidenceMetrics.source_freshness_adjudication_status_present
      && evidenceMetrics.source_freshness_adjudication_ready_for_national_release
      && evidenceMetrics.source_freshness_adjudication_invalid_review_inputs === 0
      && evidenceMetrics.source_freshness_adjudication_packets_missing_review === 0
      && evidenceMetrics.source_freshness_learner_facing_release_ready
      && evidenceMetrics.source_freshness_learner_facing_quote_backed_sources_release_blocked === 0
      && evidenceMetrics.source_freshness_stale_learner_facing_quote_backed_sources === 0
      && evidenceMetrics.high_risk_quote_coverage_depth_report_present
      && evidenceMetrics.high_risk_quote_coverage_depth_release_ready
      && evidenceMetrics.high_risk_quote_coverage_depth_topic_count === evidenceMetrics.learner_facing_high_risk_topic_count
      && evidenceMetrics.high_risk_quote_coverage_depth_topics_meeting_core_facet_depth === evidenceMetrics.high_risk_quote_coverage_depth_topic_count
      && evidenceMetrics.high_risk_quote_coverage_depth_missing_required_topic_facet_pairs === 0
      && evidenceMetrics.high_risk_quote_coverage_depth_generated_needs_review_chunks === 0
      && evidenceMetrics.high_risk_clinical_classification_report_present
      && evidenceMetrics.high_risk_clinical_classification_policy_ready
      && evidenceMetrics.high_risk_clinical_classification_topic_count === evidenceMetrics.learner_facing_high_risk_topic_count
      && evidenceMetrics.high_risk_clinical_classification_topics_with_alias_policy === evidenceMetrics.high_risk_clinical_classification_topic_count
      && evidenceMetrics.high_risk_clinical_classification_topic_alias_probes_passed === evidenceMetrics.high_risk_clinical_classification_topic_alias_probes
      && evidenceMetrics.high_risk_clinical_classification_retrieval_matrix_rows_passed === evidenceMetrics.high_risk_clinical_classification_retrieval_matrix_rows
      && evidenceMetrics.high_risk_clinical_classification_case_rows_classified === caseMetrics.total_cases
      && evidenceMetrics.high_risk_clinical_classification_claim_sets_classified === evidenceMetrics.learner_facing_claim_entailment_packet_count
      && evidenceMetrics.high_risk_clinical_classification_negative_controls_classified_nonclinical === evidenceMetrics.high_risk_clinical_classification_negative_control_probes
      && evidenceMetrics.high_risk_clinical_classification_regex_fallback_only_high_risk_probes === 0
      && evidenceMetrics.high_risk_clinical_classification_generated_needs_review_approved === 0
      && evidenceMetrics.claim_reference_alignment_report_present
      && evidenceMetrics.claim_reference_alignment_claim_sets === evidenceMetrics.learner_facing_claim_entailment_packet_count
      && evidenceMetrics.claim_reference_alignment_claim_sets_meeting_threshold === evidenceMetrics.claim_reference_alignment_claim_sets
      && evidenceMetrics.claim_reference_alignment_claim_sets_missing_domain_specific_support === 0
      && evidenceMetrics.claim_reference_alignment_domain_specific_release_ready
      && evidenceMetrics.claim_reference_gap_packets_present
      && evidenceMetrics.claim_reference_gap_packets_total === 0
      && evidenceMetrics.claim_reference_gap_packets_pending === 0
      && evidenceMetrics.claim_reference_gap_review_status_present
      && evidenceMetrics.claim_reference_gap_review_total_packets === evidenceMetrics.claim_reference_gap_packets_total
      && evidenceMetrics.claim_reference_gap_pending_reviews === 0
      && evidenceMetrics.claim_reference_gap_invalid_review_inputs === 0
      && evidenceMetrics.claim_reference_gap_ready_for_national_feedback_release_from_reviews
      && evidenceMetrics.claim_reference_alignment_generated_needs_review_references_returned === 0
      && evidenceMetrics.claim_reference_alignment_release_ready
      && evidenceMetrics.open_evidence_topic_retrieval_benchmark_present
      && evidenceMetrics.open_evidence_topic_retrieval_all_probes_passed
      && evidenceMetrics.open_evidence_topic_retrieval_all_high_risk_topics_represented
      && evidenceMetrics.open_evidence_topic_retrieval_expected_topic_reference_probes === evidenceMetrics.open_evidence_topic_retrieval_topic_probes
      && evidenceMetrics.open_evidence_topic_retrieval_top_reference_topic_match_probes === evidenceMetrics.open_evidence_topic_retrieval_topic_probes
      && evidenceMetrics.open_evidence_topic_retrieval_generated_needs_review_references_returned === 0
      && evidenceMetrics.open_evidence_topic_retrieval_negative_controls_returning_references === 0
      && evidenceMetrics.generated_chunks_quarantined_by_default
      && evidenceMetrics.generated_references_returned_by_policy_probes === 0
      && evidenceMetrics.learner_facing_evidence_coverage_report_present
      && evidenceMetrics.learner_facing_claim_entailment_packet_report_present
      && evidenceMetrics.learner_facing_claim_entailment_adjudication_status_present
      && evidenceMetrics.learner_facing_claim_entailment_invalid_review_input_count === 0
      && evidenceMetrics.learner_facing_claim_entailment_adjudication_ready_for_national_release
      && evidenceMetrics.learner_facing_evidence_release_ready
      ? 'pass'
      : 'fail',
    evidenceMetrics,
    {
      generated_needs_review_count: 0,
      needs_review_count: 0,
      missing_locator_chunk_count: 0,
      high_risk_topics_without_quote_coverage: 0,
      evidence_quality_dashboard_present: true,
      evidence_quality_dashboard_alignment_checks_passed: true,
      evidence_quality_dashboard_release_ready: true,
      evidence_quality_dashboard_open_release_blockers: 0,
      evidence_review_pending_generated_chunks: 0,
      open_evidence_grounding_review_packets_present: true,
      open_evidence_grounding_pending_review_packets: 0,
      open_evidence_grounding_generated_chunks_packeted: 0,
      open_evidence_grounding_generated_evidence_allowed_for_learner_feedback: false,
      open_evidence_grounding_ready_for_national_release_from_packets: true,
      open_evidence_grounding_review_status_present: true,
      open_evidence_grounding_review_total_packets: 'matches open_evidence_grounding_total_review_packets',
      open_evidence_grounding_review_pending_packets: 0,
      open_evidence_grounding_review_invalid_inputs: 0,
      open_evidence_grounding_review_ready_for_national_release: true,
      open_evidence_policy_all_probes_passed: true,
      open_evidence_retrieval_runtime_all_probes_passed: true,
      open_evidence_runtime_quote_backed_only_default_enabled: true,
      open_evidence_runtime_retrieval_reference_count: 'positive_runtime_quote_backed_subset',
      open_evidence_runtime_generated_needs_review_badges_rendered: 0,
      open_evidence_runtime_needs_review_badges_rendered: 0,
      open_evidence_runtime_generated_backlog_quarantine_warning_visible: true,
      open_evidence_runtime_smoke_review_items: 0,
      open_evidence_runtime_retrieval_quality_badge_visible: true,
      open_evidence_runtime_high_risk_retrieval_quality_threshold_passed: true,
      open_evidence_runtime_high_risk_retrieval_quality_minimum_base_score: '>= 0.08',
      open_evidence_runtime_high_risk_retrieval_quality_top_base_score: '>= minimum_high_risk_score',
      open_evidence_runtime_bm25_fallback_badge_visible: true,
      open_evidence_runtime_nonclinical_scope_guardrail_warning_visible: true,
      open_evidence_runtime_nonclinical_scope_guardrail_reference_count: 0,
      source_link_quote_verification_report_present: true,
      source_link_quote_verification_quote_backed_chunks: 'all_quote_backed_chunks',
      source_link_quote_verification_all_quote_hashes_valid: true,
      source_link_quote_verification_all_quote_records_have_locator: true,
      source_link_quote_verification_all_quote_records_have_source_url: true,
      source_link_quote_verification_source_urls_fetch_failed: 0,
      source_link_quote_verification_quote_records_unmatched_in_fetched_source: 0,
      source_link_quote_verification_quote_records_without_machine_text_match: 0,
      source_link_quote_verification_quote_records_requiring_repair: 0,
      source_link_quote_verification_release_ready: true,
      source_freshness_report_present: true,
      source_freshness_review_packets_present: true,
      source_freshness_review_packets_alignment: true,
      source_freshness_review_ready_for_national_release: true,
      source_freshness_adjudication_status_present: true,
      source_freshness_adjudication_ready_for_national_release: true,
      source_freshness_adjudication_invalid_review_inputs: 0,
      source_freshness_adjudication_packets_missing_review: 0,
      source_freshness_learner_facing_release_ready: true,
      source_freshness_learner_facing_quote_backed_sources_release_blocked: 0,
      source_freshness_stale_learner_facing_quote_backed_sources: 0,
      high_risk_quote_coverage_depth_report_present: true,
      high_risk_quote_coverage_depth_release_ready: true,
      high_risk_quote_coverage_depth_topic_count: 'all_high_risk_topics',
      high_risk_quote_coverage_depth_topics_meeting_core_facet_depth: 'all_high_risk_topics',
      high_risk_quote_coverage_depth_missing_required_topic_facet_pairs: 0,
      high_risk_quote_coverage_depth_generated_needs_review_chunks: 0,
      high_risk_clinical_classification_report_present: true,
      high_risk_clinical_classification_policy_ready: true,
      high_risk_clinical_classification_topic_count: 'all_high_risk_topics',
      high_risk_clinical_classification_topics_with_alias_policy: 'all_high_risk_topics',
      high_risk_clinical_classification_topic_alias_probes_passed: 'all_topic_alias_probes',
      high_risk_clinical_classification_retrieval_matrix_rows_passed: 'all_retrieval_matrix_rows',
      high_risk_clinical_classification_case_rows_classified: 'all_current_cases',
      high_risk_clinical_classification_claim_sets_classified: 'all_feedback_claim_sets',
      high_risk_clinical_classification_negative_controls_classified_nonclinical: 'all_negative_controls',
      high_risk_clinical_classification_regex_fallback_only_high_risk_probes: 0,
      high_risk_clinical_classification_generated_needs_review_approved: 0,
      claim_reference_alignment_report_present: true,
      claim_reference_alignment_claim_sets: 'all_feedback_claim_sets',
      claim_reference_alignment_claim_sets_meeting_threshold: 'all_feedback_claim_sets',
      claim_reference_alignment_claim_sets_missing_domain_specific_support: 0,
      claim_reference_alignment_domain_specific_release_ready: true,
      claim_reference_gap_packets_present: true,
      claim_reference_gap_packets_total: 0,
      claim_reference_gap_packets_pending: 0,
      claim_reference_gap_review_status_present: true,
      claim_reference_gap_review_total_packets: 'matches claim_reference_gap_packets_total',
      claim_reference_gap_pending_reviews: 0,
      claim_reference_gap_invalid_review_inputs: 0,
      claim_reference_gap_ready_for_national_feedback_release_from_reviews: true,
      claim_reference_alignment_generated_needs_review_references_returned: 0,
      claim_reference_alignment_release_ready: true,
      open_evidence_topic_retrieval_benchmark_present: true,
      open_evidence_topic_retrieval_all_probes_passed: true,
      open_evidence_topic_retrieval_all_high_risk_topics_represented: true,
      open_evidence_topic_retrieval_expected_topic_reference_probes: 'all_high_risk_topic_probes',
      open_evidence_topic_retrieval_top_reference_topic_match_probes: 'all_high_risk_topic_probes',
      open_evidence_topic_retrieval_generated_needs_review_references_returned: 0,
      open_evidence_topic_retrieval_negative_controls_returning_references: 0,
      generated_chunks_quarantined_by_default: true,
      generated_references_returned_by_policy_probes: 0,
      learner_facing_evidence_coverage_report_present: true,
      learner_facing_eligible_quote_backed_chunks: 'positive_quote_backed_subset',
      learner_facing_high_risk_topics_without_quote_backed_coverage: 0,
      learner_facing_claim_entailment_packet_report_present: true,
      learner_facing_claim_entailment_packet_count: 'all_feedback_claim_sets',
      learner_facing_claim_entailment_adjudication_status_present: true,
      learner_facing_claim_entailment_invalid_review_input_count: 0,
      learner_facing_claim_entailment_adjudication_ready_for_national_release: true,
      learner_facing_claim_entailment_reviewed_claims: 'all_feedback_claim_sets',
      learner_facing_evidence_release_ready: true
    }
  ),
  gate(
    'feedback_integrity',
    'LLM debrief material is optional draft support and cannot automatically mutate deterministic scoring, SOAP, or checklist feedback.',
    feedbackIntegrityStatus,
    feedbackIntegrity,
    {
      ai_debrief_auto_loads_in_feedback_effect: false,
      ai_debrief_mutates_feedback_state: false,
      optional_ai_draft_panel_present: true,
      source_limited_diagnosis_status_present: true,
      source_limited_consult_status_present: true,
      source_limited_reassessment_status_present: true,
      source_limited_diagnosis_excluded_from_numeric_score: true,
      source_limited_reassessment_excluded_from_numeric_score: true,
      source_limited_domain_label_present: true,
      feedback_integrity_runtime_report_present: true,
      feedback_integrity_runtime_all_probes_passed: true,
      feedback_integrity_runtime_openrouter_calls_before_optional_ai: 0,
      feedback_integrity_runtime_source_limited_domains_rendered_formative_only: true,
      feedback_integrity_runtime_optional_ai_draft_separate_surface: true,
      optional_ai_guardrail_runtime_report_present: true,
      optional_ai_guardrail_runtime_all_probes_passed: true,
      optional_ai_guardrail_openrouter_calls_before_optional_ai: 0,
      optional_ai_guardrail_bad_ai_debrief_blocked: true,
      optional_ai_guardrail_bad_ai_support_quality_issue_visible: true,
      optional_ai_guardrail_bad_ai_debrief_content_not_rendered: true,
      optional_ai_guardrail_unsafe_tutor_blocked_before_external_ai: true,
      optional_ai_guardrail_deterministic_debrief_preserved: true,
      feedback_traceability_matrix_present: true,
      feedback_traceability_cases: caseMetrics.total_cases,
      feedback_traceability_domains: 'all_scorecard_domains',
      feedback_traceability_numeric_rows_missing_required_case_evidence: 0,
      feedback_case_domain_review_packets_present: true,
      feedback_case_domain_total_review_packets: 'all_case_domain_rows',
      feedback_case_domain_all_rows_packeted: true,
      feedback_case_domain_pending_review_packets: 0,
      feedback_case_domain_ready_for_national_release_from_packets: true,
      feedback_case_domain_calibration_status_present: true,
      feedback_case_domain_calibration_total_review_packets: 'all_case_domain_rows',
      feedback_case_domain_calibration_invalid_review_input_count: 0,
      feedback_case_domain_calibration_pending_reviews: 0,
      feedback_case_domain_calibration_ready_for_national_release: true,
      feedback_claim_entailment_packets_present: true,
      feedback_claim_entailment_total_claim_sets: 'all_scorecard_domains',
      feedback_claim_entailment_adjudication_status_present: true,
      feedback_claim_entailment_invalid_review_input_count: 0,
      feedback_claim_entailment_reviewed_claim_sets: 'all_scorecard_domains',
      feedback_traceability_ready_for_national_feedback_release: true
    }
  ),
  gate(
    'educational_validity',
    'Cases and feedback are mapped to clinical reasoning objectives with measurable pre/post or performance outcomes.',
    educationalStatus,
    educationalMetrics,
    {
      curriculum_mapping_review_status_present: true,
      curriculum_mapping_ready_for_national_release: true,
      curriculum_mapping_nationally_approved_case_mappings: cases.length,
      curriculum_mapping_case_mappings_missing_review: 0,
      curriculum_mapping_workflow_phases_missing_review: 0,
      curriculum_mapping_unsupported_epa_decisions_missing: 0,
      curriculum_mapping_invalid_review_inputs: 0,
      outcome_protocol_status: 'validated_multi_site_or_pilot_ready',
      educational_outcomes_framework_status: 'validated_or_pilot_complete',
      educational_outcomes_runtime_report_present: true,
      educational_outcome_runtime_all_probes_passed: true,
      educational_outcome_runtime_privacy_disallowed_key_count: 0,
      educational_outcome_runtime_direct_identifier_value_count: 0,
      educational_outcomes_validation_status_present: true,
      educational_outcome_validation_ready_for_claims: true,
      educational_outcome_validation_invalid_study_inputs: 0,
      educational_outcome_pilot_studies_completed: 'at_least_one_valid_pilot',
      educational_outcome_multi_site_studies_completed: 'at_least_one_valid_multi_site_or_external_transfer_study',
      educational_validity_review_packets_present: true,
      educational_validity_all_curriculum_outcome_gaps_packeted: true,
      educational_validity_pending_review_packets: 0,
      educational_validity_ready_for_national_release_from_packets: true,
      educational_validity_review_status_present: true,
      educational_validity_review_total_packets: 'matches educational_validity_total_review_packets',
      educational_validity_review_pending_packets: 0,
      educational_validity_review_invalid_inputs: 0,
      educational_validity_review_ready_for_national_release: true,
      medical_education_validation_external_review_passes: 'all_external_review_criteria'
    }
  ),
  gate(
    'learner_safety',
    'High-risk feedback, tutor, AI draft, patient voice, and handoff behavior are red-team tested and clinician-reviewed.',
    learnerSafetyStatus,
    learnerSafetyMetrics,
    {
      red_team_all_required_categories_covered: true,
      red_team_runtime_passed_tests: 'all_tests',
      red_team_review_status_present: true,
      red_team_review_ready_for_national_release: true,
      red_team_nationally_approved_tests: 'all_tests',
      red_team_tests_missing_review: 0,
      red_team_invalid_review_inputs: 0,
      learner_safety_review_packets_present: true,
      learner_safety_all_required_categories_packeted: true,
      learner_safety_pending_review_packets: 0,
      learner_safety_ready_for_national_release_from_packets: true,
      optional_ai_guardrail_runtime_report_present: true,
      optional_ai_guardrail_runtime_all_probes_passed: true,
      optional_ai_guardrail_openrouter_calls_before_optional_ai: 0,
      optional_ai_guardrail_bad_ai_debrief_blocked: true,
      optional_ai_guardrail_bad_ai_support_quality_issue_visible: true,
      optional_ai_guardrail_bad_ai_debrief_content_not_rendered: true,
      optional_ai_guardrail_unsafe_tutor_blocked_before_external_ai: true,
      optional_ai_guardrail_deterministic_debrief_preserved: true
    }
  ),
  gate(
    'equity_bias_readiness',
    'Cases, feedback, patient voice, and optional AI safeguards are reviewed for bias, equitable access, and stereotype-sensitive clinical reasoning.',
    equityBiasStatus,
    equityBiasMetrics,
    {
      equity_reviewed_cases: cases.length,
      all_bias_policy_probes_passed: true,
      equity_case_review_status_present: true,
      equity_case_ready_for_national_release: true,
      equity_case_nationally_approved_cases: 'all_cases',
      equity_case_cases_missing_review: 0,
      equity_case_invalid_review_inputs: 0,
      equity_case_review_packets_present: true,
      equity_case_all_cases_packeted: true,
      equity_bias_policy_all_probes_packeted: true,
      equity_case_pending_review_packets: 0,
      equity_case_ready_for_national_release_from_packets: true,
      learner_safety_bias_probe_present: true,
      language_access_documented_cases: 'reviewed_case_bank_coverage',
      disability_or_accommodation_documented_cases: 'reviewed_case_bank_coverage',
      pregnancy_status_documented_cases: 'reviewed_when_relevant',
      pediatric_cases: 'reviewed_case_bank_coverage'
    }
  ),
  gate(
    'scale_governance_accessibility',
    'Deployment, privacy/governance, monitoring, accessibility, and institutional review evidence are ready for multi-school cohorts.',
    governanceStatus,
    governanceMetrics,
    {
      data_inventory_review_status: 'approved',
      load_test_report_status: 'complete',
      wcag_audit_status: 'complete',
      monitoring_plan_status: 'operational',
      default_route_initial_budget_passed: true,
      scale_operations_runtime_all_probes_passed: true,
      scale_operations_spa_fallback_present: true,
      scale_operations_legacy_route_bootstrap_ok: true,
      route_reachability_report_present: true,
      route_reachability_all_probes_passed: true,
      route_reachability_default_flowboard_rendered: true,
      route_reachability_legacy_path_rendered: true,
      route_reachability_legacy_query_rendered: true,
      route_reachability_wrong_app_shell_findings: 0,
      scale_operations_production_load_test_completed: true,
      scale_operations_monitoring_dashboard_operational: true,
      scale_operations_incident_response_drill_completed: true,
      accessibility_readiness_report_present: true,
      accessibility_default_route_static_accessibility_ready: true,
      accessibility_critical_static_issue_count: 0,
      optional_large_asset_count: 'monitored_or_code_split_for_required_routes',
      institutional_governance_review_status_present: true,
      institutional_governance_ready_for_national_release: true,
      institutional_governance_nationally_approved_domains: 'all_required_domains',
      institutional_governance_domains_missing_review: 0,
      institutional_governance_invalid_review_inputs: 0,
      institutional_governance_review_packets_present: true,
      institutional_governance_all_required_domains_packeted: true,
      institutional_governance_all_release_evidence_packeted: true,
      institutional_governance_pending_review_packets: 0,
      institutional_governance_ready_for_national_release_from_packets: true,
      institutional_review_ready: true
    }
  )
];

const report = {
  schema_version: 'national_scale_readiness_report_v1',
  generated_at: new Date().toISOString(),
  verdict: gates.every((item) => item.status === 'pass') ? 'ready' : 'not_ready',
  metrics: {
    cases: caseMetrics,
    case_generation_quality: caseGenerationQualityMetrics,
    evidence: evidenceMetrics,
    feedback_integrity: feedbackIntegrity,
    educational_validity: educationalMetrics,
    learner_safety: learnerSafetyMetrics,
    equity_bias_readiness: equityBiasMetrics,
    scale_governance_accessibility: governanceMetrics,
    medical_education_validation: medicalEducationRubric?.summary || null
  },
  gates,
  next_required_actions: [
    'Use docs/case_truth_review_packets.json to complete clinician-reviewed truth records for diagnosis, referral, disposition, stabilization priorities, reassessment triggers, and objective data.',
    'Record completed clinician and educator attestations in docs/case_truth_adjudications.json using docs/clinical_review_adjudication_contract.md, then keep docs/clinical_review_adjudication_status.json valid.',
    'Use docs/case_generation_quality_report.json to repair case-construction gaps, close simulation reveal-data gaps, and separate draft teaching scaffolds from national-release cases.',
    'Use docs/case_bank_expansion_status.json to close acuity, age, special-population, and presentation coverage gaps before national case-bank release.',
    'Use docs/case_bank_expansion_packets.json to source and review balanced case-bank expansion batches without counting generated or unreviewed cases toward national release.',
    'Record completed case-bank expansion blueprint reviews in docs/case_bank_expansion_reviews.json and keep docs/case_bank_expansion_review_status.json valid before counting new cases toward national release.',
    'Expand the public case bank to at least 100 reviewed cases with balanced acuity and demographic coverage.',
    'Use docs/evidence_review_backlog.json to replace or review generated-needs-review clinical chunks before using them as source-of-truth feedback.',
    'Use docs/open_evidence_grounding_review_packets.json to assign every generated-needs-review batch and evidence release blocker to clinician, librarian/source, and simulation educator review before learner-facing national release.',
    'Record completed open-evidence grounding reviews in docs/open_evidence_grounding_reviews.json and keep docs/open_evidence_grounding_review_status.json valid before clearing generated evidence or source-release blockers.',
    'Use docs/evidence_quality_dashboard.md as the maintainer-facing evidence triage page for quote-backed coverage, source freshness, high-risk quote-depth gaps, and review backlog.',
    'Use docs/source_freshness_review_packets.json to complete librarian, clinician, and simulation educator source-currency review for every learner-facing quote-backed source.',
    'Record completed source-freshness reviews in docs/source_freshness_reviews.json and keep docs/source_freshness_adjudication_status.json valid before adding local review dates or clearing source-freshness blockers.',
    'Record completed source and clinical evidence attestations in docs/evidence_chunk_adjudications.json before generated chunks can be promoted to learner-facing use.',
    'Use docs/learner_facing_evidence_coverage_report.json to preserve quote-backed high-risk coverage before learner-facing national release.',
    'Use docs/source_link_quote_verification_report.json to repair source URLs, direct locators, and quote/search phrase mismatches for every quote-backed learner-facing chunk.',
    'Use docs/open_evidence_topic_retrieval_benchmark.json to keep every high-risk topic returning topic-aligned quote-backed references while negative controls return no clinical references.',
    'Use docs/claim_reference_gap_review_packets.json to assign named-standard claim-reference evidence acquisition when generic quote-backed references are insufficient.',
    'Record completed named-standard claim-reference gap reviews in docs/claim_reference_gap_reviews.json and keep docs/claim_reference_gap_review_status.json valid before clearing ESI or other standard-specific feedback blockers.',
    'Use docs/feedback_claim_entailment_review_packets.json to assign clinician, evidence, and simulation educator review of every learner-facing feedback claim set, record completed reviews in docs/learner_facing_claim_entailment_reviews.json, and keep docs/feedback_claim_entailment_adjudication_status.json valid.',
    'Use docs/feedback_case_domain_review_packets.json to assign clinician, evidence, and simulation educator calibration review for every current case-domain feedback row before national learner-facing release.',
    'Record completed feedback case-domain calibration reviews in docs/feedback_case_domain_calibration_reviews.json and keep docs/feedback_case_domain_calibration_review_status.json valid before claiming deterministic feedback calibration readiness.',
    'Use docs/feedback_traceability_matrix.json to review every scoring domain and close source-limited, heuristic, or faculty-calibration gaps before national learner-facing release.',
    'Use docs/feedback_integrity_runtime_report.json to keep deterministic scoring and source-limited feedback behavior separated from optional AI debrief drafts in the production build.',
    'Use docs/optional_ai_guardrail_runtime_report.json to keep optional AI debrief and tutor output blocked when grounding, safety, or real-patient-use guardrails fail.',
    'Keep docs/open_evidence_runtime_policy_report.json passing so unresolved generated evidence remains quarantined from learner-facing retrieval.',
    'Use docs/core_epa_curriculum_map.json to complete faculty-reviewed Core EPA and curriculum integration mapping.',
    'Record completed curriculum mapping reviews in docs/curriculum_mapping_reviews.json and keep docs/curriculum_mapping_review_status.json valid before claiming Core EPA or curriculum readiness.',
    'Use docs/educational_outcomes_measurement_framework.json to export reproducible, privacy-safe pilot metrics and complete learner outcome validation studies.',
    'Use docs/educational_outcomes_runtime_report.json to keep deterministic outcome export probes passing before any learner cohort study.',
    'Record completed response-process, pilot, and multi-site educational outcome studies in docs/educational_outcome_studies.json and keep docs/educational_outcomes_validation_status.json valid before claiming clinical-judgment improvement.',
    'Use docs/educational_validity_review_packets.json to assign curriculum case-mapping, workflow/EPA scope, metric, case outcome, and study-evidence review work before national educational claims.',
    'Record completed educational-validity packet reviews in docs/educational_validity_reviews.json and keep docs/educational_validity_review_status.json valid before clearing curriculum, metric, case-outcome, or study-evidence release blockers.',
    'Use docs/learner_safety_red_team_suite.json to run and review learner-safety probes before assessment use.',
    'Use docs/learner_safety_review_packets.json to assign red-team and optional-AI guardrail safety reviews before national learner-facing release.',
    'Record completed learner-safety red-team reviews in docs/learner_safety_red_team_reviews.json and keep docs/learner_safety_review_status.json valid before national learner-facing release.',
    'Use docs/equity_bias_readiness_audit.json to complete case-level equity, language-access, disability/accommodation, pregnancy/reproductive-health, and stereotype-risk review.',
    'Use docs/equity_case_review_packets.json to assign case-level equity, automated bias-policy, and case-bank equity coverage gap reviews before national learner-facing release.',
    'Record completed equity case reviews in docs/equity_case_reviews.json and keep docs/equity_case_review_status.json valid before national learner-facing release.',
    'Use docs/medical_education_validation_rubric.json to complete the paper-informed clinical education, AI simulation, virtual patient, ESI, and governance validation criteria.',
    'Use docs/scale_bundle_readiness_report.json to keep the default route within first-load budgets and monitor optional PDF, embedding, and TTS assets.',
    'Use docs/scale_operations_runtime_report.json to keep static route, SPA fallback, initial-asset, and bounded concurrency smoke probes passing.',
    'Use docs/route_reachability_report.json to verify the production build renders the default flowboard and legacy simulator routes, not a stale or wrong local app shell.',
    'Use docs/accessibility_readiness_report.json to keep default-route static accessibility release blockers cleared before full WCAG review.',
    'Use docs/institutional_governance_review_packets.json to assign privacy/security, FERPA/HIPAA, accessibility, AI-provider, operations, IRB/QI, and multi-institution release reviews plus required production evidence.',
    'Record completed institutional governance approvals in docs/institutional_governance_reviews.json and keep docs/institutional_governance_review_status.json valid before national multi-school release.',
    'Complete privacy, governance, accessibility, load-test, monitoring, and incident-response evidence with institutional approval.'
  ]
};

writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const failing = gates.filter((item) => item.status !== 'pass');
console.log(`National readiness verdict: ${report.verdict}`);
console.log(`Cases: ${caseMetrics.total_cases}; quote-backed chunks: ${evidenceMetrics.quote_backed_count}/${evidenceMetrics.total_chunks} (${evidenceMetrics.quote_backed_percentage}%).`);
console.log(`Gates passing: ${gates.length - failing.length}/${gates.length}. Report written to ${REPORT_PATH}.`);
if (failing.length) {
  console.log(`Failing or partial gates: ${failing.map((item) => `${item.id}:${item.status}`).join(', ')}`);
}
