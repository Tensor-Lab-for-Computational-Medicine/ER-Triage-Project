import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_PATH = join(ROOT, 'docs', 'national_scale_readiness_report.json');
const TRUTH_PACKETS_PATH = join(ROOT, 'docs', 'case_truth_review_packets.json');
const EVIDENCE_BACKLOG_PATH = join(ROOT, 'docs', 'evidence_review_backlog.json');
const OPEN_EVIDENCE_POLICY_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'open_evidence_runtime_policy_report.json');
const EQUITY_BIAS_AUDIT_PATH = join(ROOT, 'docs', 'equity_bias_readiness_audit.json');
const OBJECTIVE_MATRIX_PATH = join(ROOT, 'docs', 'case_objective_matrix.json');
const CORE_EPA_CURRICULUM_MAP_PATH = join(ROOT, 'docs', 'core_epa_curriculum_map.json');
const GOVERNANCE_INVENTORY_PATH = join(ROOT, 'docs', 'governance_data_inventory.json');
const OUTCOMES_PROTOCOL_PATH = join(ROOT, 'docs', 'educational_outcomes_protocol.md');
const EDUCATIONAL_OUTCOMES_FRAMEWORK_PATH = join(ROOT, 'docs', 'educational_outcomes_measurement_framework.json');
const EDUCATIONAL_OUTCOMES_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'educational_outcomes_runtime_report.json');
const GOVERNANCE_PLAN_PATH = join(ROOT, 'docs', 'institutional_governance_privacy_plan.md');
const SCALE_PLAN_PATH = join(ROOT, 'docs', 'scale_accessibility_monitoring_plan.md');
const LEARNER_SAFETY_RED_TEAM_PATH = join(ROOT, 'docs', 'learner_safety_red_team_suite.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'medical_education_validation_rubric.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'medical_education_validation_rubric.md');

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function readOptionalJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function gateStatus(report, id) {
  return report?.gates?.find((gate) => gate.id === id)?.status || 'missing';
}

function evidencePath(path) {
  return path.replace(`${ROOT}\\`, '').replaceAll('\\', '/');
}

function criterion({
  id,
  domain,
  status,
  evidence_basis,
  current_evidence,
  required_next_evidence,
  source_refs,
  reviewer_role,
  readiness_gate,
  requires_external_review = true
}) {
  return {
    id,
    domain,
    status,
    evidence_basis,
    current_evidence,
    required_next_evidence,
    source_refs,
    reviewer_role,
    readiness_gate,
    requires_external_review
  };
}

const report = readOptionalJson(REPORT_PATH);
const truthPackets = readOptionalJson(TRUTH_PACKETS_PATH);
const evidenceBacklog = readOptionalJson(EVIDENCE_BACKLOG_PATH);
const openEvidenceRuntimeReport = readOptionalJson(OPEN_EVIDENCE_POLICY_RUNTIME_REPORT_PATH);
const equityBiasAudit = readOptionalJson(EQUITY_BIAS_AUDIT_PATH);
const objectiveMatrix = readOptionalJson(OBJECTIVE_MATRIX_PATH);
const coreEpaCurriculumMap = readOptionalJson(CORE_EPA_CURRICULUM_MAP_PATH);
const educationalOutcomesFramework = readOptionalJson(EDUCATIONAL_OUTCOMES_FRAMEWORK_PATH);
const educationalOutcomesRuntimeReport = readOptionalJson(EDUCATIONAL_OUTCOMES_RUNTIME_REPORT_PATH);
const governanceInventory = readOptionalJson(GOVERNANCE_INVENTORY_PATH);
const learnerSafetyRedTeam = readOptionalJson(LEARNER_SAFETY_RED_TEAM_PATH);
const outcomesProtocol = readText(OUTCOMES_PROTOCOL_PATH);
const caseMetrics = report?.metrics?.cases || {};
const evidenceMetrics = report?.metrics?.evidence || {};
const educationMetrics = report?.metrics?.educational_validity || {};
const governanceMetrics = report?.metrics?.scale_governance_accessibility || {};
const feedbackMetrics = report?.metrics?.feedback_integrity || {};
const learnerSafetyMetrics = report?.metrics?.learner_safety || {};
const outcomeFrameworkMetrics = educationalOutcomesFramework?.summary || {};
const outcomeRuntimeMetrics = educationalOutcomesRuntimeReport?.summary || {};

const refs = {
  goal_guide: {
    id: 'codex_goal_guide',
    title: 'Using Goals in Codex: Persistent Objectives for Long-Running Work',
    source: 'C:/Users/Aaron Ge/Documents/using_goals_in_codex.ipynb.txt'
  },
  ai_simulation_model: {
    id: 'cheng_mcgregor_2025_ai_simulation',
    title: 'Applications of artificial intelligence in healthcare simulation: a model of thinking',
    source: 'papers/Applications of artificial intelligence in healthcare simulation - a model of thinking.pdf',
    doi: '10.1186/s41077-025-00379-7'
  },
  clinical_reasoning_review: {
    id: 'hawks_2023_clinical_reasoning_curricula',
    title: 'Clinical Reasoning Curricula in Preclinical Undergraduate Medical Education: A Scoping Review',
    source: 'papers/Clinical Reasoning Curriculua.pdf'
  },
  esi_ml_study: {
    id: 'ivanov_2021_esi_ml',
    title: 'Improving ED Emergency Severity Index Acuity Assignment Using Machine Learning and Clinical NLP',
    source: 'papers/IMPROVING ED EMERGENCY SEVERITY INDEX.pdf',
    doi: '10.1016/j.jen.2020.11.001'
  },
  llm_virtual_patients: {
    id: 'jo_2025_llm_virtual_patients',
    title: 'Large Language Model-Based Virtual Patient Simulations in Medical and Nursing Education: A Review',
    source: 'papers/LLM Virtual Patients.pdf',
    doi: '10.3390/app152211917'
  },
  aamc_core_epas: {
    id: 'aamc_core_epas',
    title: 'AAMC Core Entrustable Professional Activities for Entering Residency',
    url: 'https://www.aamc.org/about-us/mission-areas/medical-education/cbme/core-epas'
  },
  aamc_epa_guiding_principles: {
    id: 'aamc_epa_guiding_principles',
    title: 'AAMC Core EPAs Guiding Principles',
    url: 'https://www.aamc.org/what-we-do/mission-areas/medical-education/cbme/core-epas/guiding-principles'
  },
  ena_triage: {
    id: 'ena_triage_portfolio',
    title: 'Emergency Nurses Association Triage Portfolio',
    url: 'https://www.ena.org/education/search-courses/triage-portfolio'
  },
  acep_ena_triage_policy: {
    id: 'acep_ena_triage_policy_2025',
    title: 'ACEP/ENA Emergency Department Triage Joint Policy Statement',
    url: 'https://www.ena.org/sites/default/files/2025-08/Emergency%20Department%20Triage.pdf'
  },
  ssh_accreditation: {
    id: 'ssh_accreditation',
    title: 'Society for Simulation in Healthcare Full Accreditation',
    url: 'https://ssih.org/full-accreditation'
  },
  outcomes_measurement_framework: {
    id: 'educational_outcomes_measurement_framework',
    title: 'Educational Outcomes Measurement Framework',
    source: 'docs/educational_outcomes_measurement_framework.json'
  },
  outcomes_runtime_report: {
    id: 'educational_outcomes_runtime_report',
    title: 'Educational Outcomes Runtime Report',
    source: 'docs/educational_outcomes_runtime_report.json'
  },
  open_evidence_runtime_policy: {
    id: 'open_evidence_runtime_policy_report',
    title: 'Open Evidence Runtime Policy Report',
    source: 'docs/open_evidence_runtime_policy_report.json'
  },
  equity_bias_audit: {
    id: 'equity_bias_readiness_audit',
    title: 'Equity and Bias Readiness Audit',
    source: 'docs/equity_bias_readiness_audit.json'
  }
};

const criteria = [
  criterion({
    id: 'goal_contract_auditable_completion',
    domain: 'goal_governance',
    status: report?.verdict === 'not_ready' ? 'pass' : 'fail',
    evidence_basis: 'The goal guide emphasizes measurable outcomes, verification surfaces, constraints, boundaries, iteration policy, and evidence-based completion.',
    current_evidence: `Readiness report exists at ${evidencePath(REPORT_PATH)} with verdict ${report?.verdict || 'missing'}.`,
    required_next_evidence: 'Keep readiness completion tied to gate evidence rather than narrative progress.',
    source_refs: [refs.goal_guide.id],
    reviewer_role: 'project_owner',
    readiness_gate: 'all',
    requires_external_review: false
  }),
  criterion({
    id: 'deterministic_feedback_primary',
    domain: 'feedback_reliability',
    status: gateStatus(report, 'feedback_integrity') === 'pass' ? 'pass' : 'fail',
    evidence_basis: 'LLM output in medical simulation must be controlled, transparent, and secondary to reviewed evidence when used for learner feedback.',
    current_evidence: `Feedback integrity gate is ${gateStatus(report, 'feedback_integrity')}; optional AI draft panel present: ${Boolean(feedbackMetrics.optional_ai_draft_panel_present)}.`,
    required_next_evidence: 'Maintain tests proving optional AI drafts cannot mutate deterministic scoring, SOAP, or checklist feedback.',
    source_refs: [refs.ai_simulation_model.id, refs.llm_virtual_patients.id],
    reviewer_role: 'engineering_lead',
    readiness_gate: 'feedback_integrity',
    requires_external_review: false
  }),
  criterion({
    id: 'complete_case_truth_records',
    domain: 'clinical_accuracy',
    status: caseMetrics.case_truth_reviewed_cases >= caseMetrics.total_cases && caseMetrics.total_cases >= 100 ? 'pass' : 'fail',
    evidence_basis: 'National-scale simulation cases require adjudicated patient truth, not inferred teaching support.',
    current_evidence: `${caseMetrics.case_truth_reviewed_cases || 0}/${caseMetrics.total_cases || 0} case truth packets are reviewed; ${caseMetrics.case_truth_pending_cases || 0} remain pending.`,
    required_next_evidence: 'Clinician-adjudicated truth record for every case: diagnosis, differential, consult/referral, stabilization, resources, objective data, reassessment, and disposition.',
    source_refs: [refs.clinical_reasoning_review.id, refs.esi_ml_study.id],
    reviewer_role: 'emergency_medicine_clinician',
    readiness_gate: 'case_truth'
  }),
  criterion({
    id: 'minimum_public_case_bank',
    domain: 'clinical_coverage',
    status: caseMetrics.total_cases >= 100 ? 'pass' : 'fail',
    evidence_basis: 'Broad national use needs enough cases for repeat practice, acuity coverage, and subgroup review.',
    current_evidence: `Public case count is ${caseMetrics.total_cases || 0}; ESI distribution is ${JSON.stringify(caseMetrics.esi_distribution || {})}.`,
    required_next_evidence: 'At least 100 clinician-reviewed public-safe cases with balanced acuity, complaint, demographic, and special-population coverage.',
    source_refs: [refs.goal_guide.id, refs.clinical_reasoning_review.id],
    reviewer_role: 'clinical_content_committee',
    readiness_gate: 'case_truth'
  }),
  criterion({
    id: 'esi_expert_consensus_benchmark',
    domain: 'triage_validity',
    status: 'fail',
    evidence_basis: 'The ESI ML paper evaluated acuity against clinician consensus and reported undertriage/overtriage, including the ESI 2 versus 3 boundary.',
    current_evidence: 'The app has source ESI labels and draft packets, but no public benchmark report comparing learners or the simulator against expert consensus.',
    required_next_evidence: 'Gold-standard ESI review set, expert agreement report, learner ESI accuracy, undertriage rate, overtriage rate, and ESI 2/3 boundary analysis.',
    source_refs: [refs.esi_ml_study.id, refs.ena_triage.id, refs.acep_ena_triage_policy.id],
    reviewer_role: 'triage_expert_panel',
    readiness_gate: 'case_truth'
  }),
  criterion({
    id: 'validated_triage_standard_alignment',
    domain: 'triage_validity',
    status: 'partial',
    evidence_basis: 'ACEP/ENA support a scientifically validated ED triage scale such as ESI; ENA frames ESI training around decision points, case examples, and post-course assessment.',
    current_evidence: 'The evidence bundle includes ENA ESI sources and the cases include reference ESI values, but case-level ESI rationale has not been fully clinician-reviewed.',
    required_next_evidence: 'Case-by-case ESI decision-point rationales reviewed against the current ENA ESI Handbook and institutional triage education expectations.',
    source_refs: [refs.ena_triage.id, refs.acep_ena_triage_policy.id],
    reviewer_role: 'emergency_nursing_triage_educator',
    readiness_gate: 'case_truth'
  }),
  criterion({
    id: 'clinical_reasoning_definition',
    domain: 'educational_validity',
    status: /clinical reasoning/i.test(outcomesProtocol) ? 'partial' : 'fail',
    evidence_basis: 'The clinical reasoning scoping review recommends explicitly defining clinical reasoning in curricular reports.',
    current_evidence: `Draft outcomes protocol present: ${existsSync(OUTCOMES_PROTOCOL_PATH)}.`,
    required_next_evidence: 'Faculty-approved definition of clinical reasoning used consistently in learner-facing curriculum, scoring, and research protocol.',
    source_refs: [refs.clinical_reasoning_review.id],
    reviewer_role: 'medical_educator',
    readiness_gate: 'educational_validity'
  }),
  criterion({
    id: 'clinical_reasoning_theory_domains',
    domain: 'educational_validity',
    status: objectiveMatrix?.summary?.mapped_cases === caseMetrics.total_cases ? 'partial' : 'fail',
    evidence_basis: 'Clinical reasoning curriculum reports should identify theory and domains addressed.',
    current_evidence: `Objective matrix maps ${objectiveMatrix?.summary?.mapped_cases || 0}/${caseMetrics.total_cases || 0} cases across draft domains.`,
    required_next_evidence: 'Educator-reviewed mapping from noticing, interpreting, responding, and reflecting to each debrief and scored action.',
    source_refs: [refs.clinical_reasoning_review.id],
    reviewer_role: 'medical_educator',
    readiness_gate: 'educational_validity'
  }),
  criterion({
    id: 'assessment_validity_argument',
    domain: 'educational_validity',
    status: educationalOutcomesFramework && existsSync(OUTCOMES_PROTOCOL_PATH) ? 'partial' : 'fail',
    evidence_basis: 'Assessment validity evidence is a stated weakness in clinical reasoning curricula and must be reported when available.',
    current_evidence: `Reviewed objective cases: ${educationMetrics.reviewed_objective_cases || 0}; outcome protocol status: ${educationMetrics.outcome_protocol_status || 'missing'}; outcome metrics framework: ${educationalOutcomesFramework?.review_status || 'missing'}.`,
    required_next_evidence: 'Validity argument covering content validity, response process, internal structure/reliability, relation to other measures, and consequence monitoring.',
    source_refs: [refs.clinical_reasoning_review.id, refs.aamc_epa_guiding_principles.id, refs.outcomes_measurement_framework.id],
    reviewer_role: 'assessment_scientist',
    readiness_gate: 'educational_validity'
  }),
  criterion({
    id: 'educational_outcome_metric_instrumentation',
    domain: 'educational_outcomes',
    status: educationalOutcomesFramework ? 'partial' : 'fail',
    evidence_basis: 'Claims about clinical judgment improvement need standardized, reproducible metrics before pilot or multi-site outcome studies can be interpreted.',
    current_evidence: educationalOutcomesFramework
      ? `Draft framework defines ${outcomeFrameworkMetrics.total_metrics || 0} metrics, including ${outcomeFrameworkMetrics.currently_instrumented_metrics || 0} currently instrumented metrics and ${outcomeFrameworkMetrics.requires_external_validation_metrics || 0} metrics requiring external validation. Runtime outcome probes passed ${outcomeRuntimeMetrics.passed_probes || 0}/${outcomeRuntimeMetrics.total_probes || 0}; privacy export findings: keys=${outcomeRuntimeMetrics.privacy_disallowed_key_count ?? 'missing'}, identifiers=${outcomeRuntimeMetrics.direct_identifier_value_count ?? 'missing'}.`
      : 'No reproducible educational outcome metric framework is present.',
    required_next_evidence: 'Privacy-approved cohort exports, pre/post pilot analysis, delayed retention cases, and external transfer measures.',
    source_refs: [refs.goal_guide.id, refs.clinical_reasoning_review.id, refs.llm_virtual_patients.id, refs.outcomes_measurement_framework.id, refs.outcomes_runtime_report.id],
    reviewer_role: 'education_research_lead',
    readiness_gate: 'educational_validity'
  }),
  criterion({
    id: 'curricular_fit_and_epa_mapping',
    domain: 'educational_validity',
    status: coreEpaCurriculumMap ? 'partial' : 'fail',
    evidence_basis: 'AAMC Core EPAs define entering-residency expectations and recommend mapping educational opportunities and assessments to EPAs.',
    current_evidence: coreEpaCurriculumMap
      ? `Draft Core EPA map present: ${coreEpaCurriculumMap.summary.workflow_mapped_epas}/${coreEpaCurriculumMap.summary.total_core_epas} EPAs touched by workflow; ${coreEpaCurriculumMap.summary.reviewed_case_epa_mappings} reviewed case mappings.`
      : 'No Core EPA mapping artifact is present.',
    required_next_evidence: 'Faculty-approved Core EPA map, intended learner level, supervision assumptions, scoring use, and curriculum placement.',
    source_refs: [refs.aamc_core_epas.id, refs.aamc_epa_guiding_principles.id],
    reviewer_role: 'curriculum_committee',
    readiness_gate: 'educational_validity'
  }),
  criterion({
    id: 'longitudinal_multimodal_performance_evidence',
    domain: 'educational_validity',
    status: 'fail',
    evidence_basis: 'AAMC EPA guidance emphasizes longitudinal aggregated performance evidence, multiple assessors, coaching, and formative feedback.',
    current_evidence: 'The app has draft learner progression concepts but no multi-assessor longitudinal implementation or institutional entrustment process.',
    required_next_evidence: 'Learner progression dataset, faculty observation hooks, coaching/remediation workflows, and multi-modal performance review protocol.',
    source_refs: [refs.aamc_epa_guiding_principles.id],
    reviewer_role: 'curriculum_committee',
    readiness_gate: 'educational_validity'
  }),
  criterion({
    id: 'simulation_program_standard_mapping',
    domain: 'scale_governance',
    status: 'fail',
    evidence_basis: 'SSH accreditation separates core program evidence from optional assessment, research, human simulation, teaching/education, systems integration, and fellowship areas.',
    current_evidence: 'The readiness docs include governance and scale plans but no SSH-style program evidence map.',
    required_next_evidence: 'Institution-specific simulation program evidence map for teaching/education, assessment, governance, faculty roles, content ownership, and quality improvement.',
    source_refs: [refs.ssh_accreditation.id],
    reviewer_role: 'simulation_program_director',
    readiness_gate: 'scale_governance_accessibility'
  }),
  criterion({
    id: 'ai_simulation_use_case_boundaries',
    domain: 'ai_governance',
    status: 'partial',
    evidence_basis: 'The AI simulation model distinguishes education, assessment, faculty development, translational simulation, and research/scholarship use cases.',
    current_evidence: 'The readiness goal distinguishes education, assessment, governance, and research needs, but app settings do not yet expose all use-case boundaries or approvals.',
    required_next_evidence: 'Mode-specific policy for practice, assessment, faculty review, translational research, and scholarship workflows.',
    source_refs: [refs.ai_simulation_model.id],
    reviewer_role: 'simulation_governance_lead',
    readiness_gate: 'scale_governance_accessibility'
  }),
  criterion({
    id: 'ai_ethics_literacy_cybersecurity_governance',
    domain: 'ai_governance',
    status: governanceInventory ? 'partial' : 'fail',
    evidence_basis: 'AI in healthcare simulation requires ethics, AI literacy, cybersecurity, and governance foundations.',
    current_evidence: `Governance inventory status is ${governanceInventory?.review_status || 'missing'}; governance plan present: ${existsSync(GOVERNANCE_PLAN_PATH)}.`,
    required_next_evidence: 'Institution-approved AI disclosure, learner consent, bias review, API-key policy, cybersecurity review, and incident-response owner.',
    source_refs: [refs.ai_simulation_model.id],
    reviewer_role: 'institutional_governance_officer',
    readiness_gate: 'scale_governance_accessibility'
  }),
  criterion({
    id: 'data_governance_and_privacy_review',
    domain: 'privacy_governance',
    status: governanceMetrics.data_inventory_review_status === 'approved' ? 'pass' : 'partial',
    evidence_basis: 'LLM virtual patient reviews call for robust data governance and ethical/legal accountability.',
    current_evidence: `Data inventory status is ${governanceMetrics.data_inventory_review_status || 'missing'}; default public workflow network requests: ${Boolean(governanceMetrics.default_workflow_network_requests)}.`,
    required_next_evidence: 'Approved FERPA/HIPAA-adjacent deployment review, retention policy, DPA/vendor review, and restricted-data prohibition for public cohorts.',
    source_refs: [refs.llm_virtual_patients.id, refs.ai_simulation_model.id],
    reviewer_role: 'privacy_security_review',
    readiness_gate: 'scale_governance_accessibility'
  }),
  criterion({
    id: 'llm_virtual_patient_factual_accuracy',
    domain: 'virtual_patient_quality',
    status: 'fail',
    evidence_basis: 'LLM VP systems need factual accuracy checks and expert oversight because hallucination can affect learning.',
    current_evidence: 'Optional LLM patient/tutor paths exist, but there is no automated factual consistency suite across cases.',
    required_next_evidence: 'Case-fact consistency tests for patient voice, tutor, debrief draft, and written critique outputs.',
    source_refs: [refs.llm_virtual_patients.id],
    reviewer_role: 'clinical_ai_reviewer',
    readiness_gate: 'feedback_integrity'
  }),
  criterion({
    id: 'llm_virtual_patient_role_consistency',
    domain: 'virtual_patient_quality',
    status: 'fail',
    evidence_basis: 'LLM VP systems require role consistency and patient-state consistency across dynamic dialogue.',
    current_evidence: 'No role-consistency benchmark or scenario drift report is present.',
    required_next_evidence: 'Dialogue regression suite checking patient persona, timeline, symptom boundaries, vitals, and refusal to invent unavailable objective data.',
    source_refs: [refs.llm_virtual_patients.id],
    reviewer_role: 'standardized_patient_educator',
    readiness_gate: 'feedback_integrity'
  }),
  criterion({
    id: 'llm_virtual_patient_emotional_realism',
    domain: 'virtual_patient_quality',
    status: 'fail',
    evidence_basis: 'LLM VP reviews identify emotional realism as a persistent challenge for educational authenticity.',
    current_evidence: 'No emotional realism rubric or student/faculty evaluation data is present.',
    required_next_evidence: 'Standardized patient-style realism rubric, learner survey, and faculty review across common ED scenarios.',
    source_refs: [refs.llm_virtual_patients.id],
    reviewer_role: 'standardized_patient_educator',
    readiness_gate: 'educational_validity'
  }),
  criterion({
    id: 'model_prompt_source_transparency',
    domain: 'ai_governance',
    status: 'partial',
    evidence_basis: 'LLM VP systems need transparent reporting of model versions, prompts, knowledge sources, and evaluation methods.',
    current_evidence: 'Draft augmentation metadata and evidence bundle versions exist; optional AI session reporting is not yet complete across all workflows.',
    required_next_evidence: 'Per-session model/provider/prompt/source-bundle/version metadata surfaced to instructors and exportable for review.',
    source_refs: [refs.llm_virtual_patients.id],
    reviewer_role: 'clinical_ai_reviewer',
    readiness_gate: 'scale_governance_accessibility'
  }),
  criterion({
    id: 'multi_site_controlled_outcomes',
    domain: 'educational_outcomes',
    status: 'fail',
    evidence_basis: 'LLM VP reviews call for stronger multi-site controlled studies and standardized metrics before generalizable claims.',
    current_evidence: `Outcome protocol present: ${existsSync(OUTCOMES_PROTOCOL_PATH)}; outcome framework present: ${Boolean(educationalOutcomesFramework)}; reviewed outcome studies: ${outcomeFrameworkMetrics.reviewed_outcome_studies || 0}; status remains ${educationMetrics.outcome_protocol_status || 'missing'}.`,
    required_next_evidence: 'Pilot and multi-site controlled evaluation measuring ESI accuracy, undertriage reduction, rationale quality, OSCE/simulation transfer, and hospital-performance proxies.',
    source_refs: [refs.llm_virtual_patients.id, refs.clinical_reasoning_review.id, refs.outcomes_measurement_framework.id],
    reviewer_role: 'education_research_lead',
    readiness_gate: 'educational_validity'
  }),
  criterion({
    id: 'standardized_virtual_patient_metrics',
    domain: 'educational_outcomes',
    status: 'fail',
    evidence_basis: 'The LLM VP review highlights standardized metrics for reproducible evaluation.',
    current_evidence: educationalOutcomesFramework
      ? 'Educational outcome metrics are instrumented, but no full VP quality suite is implemented for factuality, role consistency, realism, latency, learner satisfaction, and learning impact.'
      : 'No VP metric suite is implemented for factuality, role consistency, realism, latency, learner satisfaction, and learning impact.',
    required_next_evidence: 'Metric definitions, evaluator rubrics, automated probes, and threshold reports per release.',
    source_refs: [refs.llm_virtual_patients.id],
    reviewer_role: 'education_research_lead',
    readiness_gate: 'educational_validity'
  }),
  criterion({
    id: 'quote_backed_feedback_coverage',
    domain: 'open_evidence_grounding',
    status: evidenceMetrics.generated_needs_review_count === 0 ? 'pass' : 'fail',
    evidence_basis: 'Open-evidence-first feedback requires clinical teaching claims to be auditable and traceable.',
    current_evidence: `${evidenceMetrics.quote_backed_count || 0}/${evidenceMetrics.total_chunks || 0} chunks are quote-backed; ${evidenceMetrics.generated_needs_review_count || 0} generated chunks need review; runtime policy probes passed: ${Boolean(openEvidenceRuntimeReport?.summary?.all_policy_probes_passed)}.`,
    required_next_evidence: 'Replace or approve generated summaries with quote-backed or clinician-approved chunks before source-of-truth learner feedback.',
    source_refs: [refs.goal_guide.id, refs.ai_simulation_model.id, refs.open_evidence_runtime_policy.id],
    reviewer_role: 'clinical_librarian_and_clinician',
    readiness_gate: 'open_evidence_grounding'
  }),
  criterion({
    id: 'evidence_review_queue_operational',
    domain: 'open_evidence_grounding',
    status: evidenceBacklog?.summary?.pending_generated_or_unverified_chunks > 0 ? 'partial' : 'fail',
    evidence_basis: 'Generated evidence needs a human review workflow before it can become authoritative clinical feedback.',
    current_evidence: `Evidence backlog has ${evidenceBacklog?.summary?.pending_review_batch_count || 0} batches and ${evidenceBacklog?.summary?.pending_generated_or_unverified_chunks || 0} pending chunks; runtime quarantine returned ${openEvidenceRuntimeReport?.summary?.generated_references_returned || 0} generated references in policy probes.`,
    required_next_evidence: 'Reviewer assignments, completed reviews, promotion/removal decisions, and regenerated source-quality report showing no unresolved generated-needs-review chunks in learner-facing content.',
    source_refs: [refs.ai_simulation_model.id, refs.open_evidence_runtime_policy.id],
    reviewer_role: 'clinical_librarian_and_clinician',
    readiness_gate: 'open_evidence_grounding'
  }),
  criterion({
    id: 'claim_to_source_entailment',
    domain: 'open_evidence_grounding',
    status: 'fail',
    evidence_basis: 'A citation is not enough; the cited source must support the exact clinical claim and its context.',
    current_evidence: 'The project has citation contracts and source IDs, but no public claim-entailment audit across deterministic feedback categories.',
    required_next_evidence: 'Claim-level entailment review for diagnosis, ESI, management, consult/referral, reassessment, disposition, and safety advice.',
    source_refs: [refs.goal_guide.id, refs.ai_simulation_model.id],
    reviewer_role: 'clinical_ai_reviewer',
    readiness_gate: 'open_evidence_grounding'
  }),
  criterion({
    id: 'faculty_case_review_workflow',
    domain: 'clinical_accuracy',
    status: truthPackets?.summary?.pending_case_truth_packets > 0 ? 'partial' : 'fail',
    evidence_basis: 'Simulation education and assessment require human review of clinical truth and teaching objectives.',
    current_evidence: `Case truth review queue exists with ${truthPackets?.summary?.total_packets || 0} packets and ${truthPackets?.review_template?.minimum_reviewers_per_case || 0} minimum reviewers per case.`,
    required_next_evidence: 'Completed clinician and educator review packets, disagreement adjudication, and reviewer identity/role audit trail.',
    source_refs: [refs.clinical_reasoning_review.id, refs.ssh_accreditation.id],
    reviewer_role: 'clinical_content_committee',
    readiness_gate: 'case_truth'
  }),
  criterion({
    id: 'unsafe_feedback_red_team_suite',
    domain: 'learner_safety',
    status: learnerSafetyRedTeam ? 'partial' : 'fail',
    evidence_basis: 'AI hallucinations, unsafe simplifications, and bias in educational simulation can harm learning outcomes.',
    current_evidence: learnerSafetyRedTeam
      ? `Draft safety suite present with ${learnerSafetyRedTeam.summary.total_tests} tests across ${learnerSafetyRedTeam.summary.covered_required_categories}/${learnerSafetyRedTeam.summary.required_categories} required categories; runtime passed ${learnerSafetyMetrics.red_team_runtime_passed_tests || 0}.`
      : 'No dangerous-advice red-team suite is present for premature closure, undertriage, unsafe discharge, or unsupported treatment recommendations.',
    required_next_evidence: 'Run automated probes and complete clinician/educator review for high-risk ED presentations, bias, unsafe disposition, and misleading reassurance.',
    source_refs: [refs.ai_simulation_model.id, refs.llm_virtual_patients.id],
    reviewer_role: 'patient_safety_reviewer',
    readiness_gate: 'learner_safety'
  }),
  criterion({
    id: 'equity_bias_case_review_and_policy',
    domain: 'equity_bias_readiness',
    status: equityBiasAudit?.summary?.all_bias_policy_probes_passed ? 'partial' : 'fail',
    evidence_basis: 'National clinical education tools must avoid demographic stereotyping, preserve language access and accommodation needs, and review whether feedback teaches equitable clinical reasoning.',
    current_evidence: equityBiasAudit
      ? `Draft equity audit queues ${equityBiasAudit.summary.pending_equity_review_cases} cases, has ${equityBiasAudit.summary.equity_reviewed_cases} reviewed cases, and passed ${equityBiasAudit.summary.bias_policy_probes_passed}/${equityBiasAudit.summary.bias_policy_probes} automated bias probes.`
      : 'No equity/bias readiness audit is present.',
    required_next_evidence: 'Case-level equity notes, language-access review, disability/accommodation review, pregnancy/reproductive-health review where relevant, and clinician-educator approval of bias safeguards.',
    source_refs: [refs.ai_simulation_model.id, refs.llm_virtual_patients.id, refs.equity_bias_audit.id],
    reviewer_role: 'equity_and_patient_safety_reviewer',
    readiness_gate: 'equity_bias_readiness'
  }),
  criterion({
    id: 'accessibility_and_accommodation',
    domain: 'scale_accessibility',
    status: existsSync(SCALE_PLAN_PATH) ? 'partial' : 'fail',
    evidence_basis: 'National curricular deployment must be accessible and usable across learners and institutions.',
    current_evidence: `Scale/accessibility plan present: ${existsSync(SCALE_PLAN_PATH)}; WCAG audit status: ${governanceMetrics.wcag_audit_status || 'missing'}.`,
    required_next_evidence: 'Completed WCAG audit, keyboard and screen-reader test pass, accommodation plan, and learner usability study.',
    source_refs: [refs.ssh_accreditation.id, refs.aamc_epa_guiding_principles.id],
    reviewer_role: 'accessibility_reviewer',
    readiness_gate: 'scale_governance_accessibility'
  }),
  criterion({
    id: 'scale_reliability_monitoring',
    domain: 'scale_accessibility',
    status: existsSync(SCALE_PLAN_PATH) ? 'partial' : 'fail',
    evidence_basis: 'Multi-institution use needs operational reliability, monitoring, and reproducible release controls.',
    current_evidence: `Load-test status: ${governanceMetrics.load_test_report_status || 'missing'}; monitoring status: ${governanceMetrics.monitoring_plan_status || 'missing'}.`,
    required_next_evidence: 'Load test, uptime/error budget, monitoring dashboard, incident drill, content rollback plan, and release checklist.',
    source_refs: [refs.ssh_accreditation.id],
    reviewer_role: 'platform_operations_lead',
    readiness_gate: 'scale_governance_accessibility'
  }),
  criterion({
    id: 'institutional_content_governance',
    domain: 'scale_governance',
    status: existsSync(GOVERNANCE_PLAN_PATH) ? 'partial' : 'fail',
    evidence_basis: 'National simulation deployment needs named accountability for content ownership, updates, incidents, and learner-facing claims.',
    current_evidence: `Governance plan present: ${existsSync(GOVERNANCE_PLAN_PATH)}; institutional review ready: ${Boolean(governanceMetrics.institutional_review_ready)}.`,
    required_next_evidence: 'Signed institutional clinical content governance SOP, source update cadence, case retirement process, and incident escalation/rollback plan.',
    source_refs: [refs.ai_simulation_model.id, refs.ssh_accreditation.id],
    reviewer_role: 'institutional_governance_officer',
    readiness_gate: 'scale_governance_accessibility'
  }),
  criterion({
    id: 'readiness_gate_integrity',
    domain: 'goal_governance',
    status: report?.verdict === 'not_ready'
      && ['case_truth', 'open_evidence_grounding'].every((id) => gateStatus(report, id) === 'fail')
      ? 'pass'
      : 'fail',
    evidence_basis: 'A readiness process is only trustworthy if draft review queues do not pass readiness gates.',
    current_evidence: `Verdict is ${report?.verdict || 'missing'}; case truth gate is ${gateStatus(report, 'case_truth')}; evidence gate is ${gateStatus(report, 'open_evidence_grounding')}.`,
    required_next_evidence: 'Keep the gate fail conditions strict until real clinical review and evidence review are complete.',
    source_refs: [refs.goal_guide.id],
    reviewer_role: 'project_owner',
    readiness_gate: 'all',
    requires_external_review: false
  })
];

const summary = {
  total_criteria: criteria.length,
  status_counts: countBy(criteria, (item) => item.status),
  domains: countBy(criteria, (item) => item.domain),
  criteria_requiring_external_review: criteria.filter((item) => item.requires_external_review).length,
  pass_without_external_review: criteria.filter((item) => item.status === 'pass' && !item.requires_external_review).length,
  external_review_passes: criteria.filter((item) => item.status === 'pass' && item.requires_external_review).length
};

const artifact = {
  schema_version: 'medical_education_validation_rubric_v1',
  generated_at: new Date().toISOString(),
  review_status: 'draft_literature_informed_requires_external_review',
  warning: 'This rubric translates the supplied guide, supplied papers, current repo artifacts, and selected public standards into validation criteria. It is not clinician, educator, privacy, accessibility, or institutional approval.',
  summary,
  source_references: Object.values(refs),
  criteria
};

function mdStatus(status) {
  if (status === 'pass') return 'Pass';
  if (status === 'partial') return 'Partial';
  if (status === 'fail') return 'Fail';
  return status;
}

function toMarkdown(data) {
  const lines = [
    '# Medical Education Validation Rubric',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Criteria: ${data.summary.total_criteria}`,
    `- Status counts: ${Object.entries(data.summary.status_counts).map(([key, value]) => `${key}=${value}`).join(', ')}`,
    `- External-review criteria: ${data.summary.criteria_requiring_external_review}`,
    '',
    '## Sources',
    '',
    ...data.source_references.map((source) => `- ${source.id}: ${source.title}${source.url ? ` (${source.url})` : ` (${source.source})`}`),
    '',
    '## Criteria',
    '',
    '| ID | Domain | Status | Current Evidence | Required Next Evidence |',
    '|---|---|---|---|---|',
    ...data.criteria.map((item) => `| ${item.id} | ${item.domain} | ${mdStatus(item.status)} | ${item.current_evidence.replaceAll('|', '/')} | ${item.required_next_evidence.replaceAll('|', '/')} |`)
  ];
  return `${lines.join('\n')}\n`;
}

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, toMarkdown(artifact), 'utf8');

console.log(`Wrote ${criteria.length} medical education validation criteria to ${JSON_OUTPUT_PATH}`);
console.log(`Wrote Markdown summary to ${MD_OUTPUT_PATH}`);
