# Medical Education Validation Rubric

Generated: 2026-06-09T22:34:00.206Z

This rubric translates the supplied guide, supplied papers, current repo artifacts, and selected public standards into validation criteria. It is not clinician, educator, privacy, accessibility, or institutional approval.

## Summary

- Criteria: 32
- Status counts: pass=2, fail=13, partial=17
- External-review criteria: 29

## Sources

- codex_goal_guide: Using Goals in Codex: Persistent Objectives for Long-Running Work (C:/Users/Aaron Ge/Documents/using_goals_in_codex.ipynb.txt)
- cheng_mcgregor_2025_ai_simulation: Applications of artificial intelligence in healthcare simulation: a model of thinking (papers/Applications of artificial intelligence in healthcare simulation - a model of thinking.pdf)
- hawks_2023_clinical_reasoning_curricula: Clinical Reasoning Curricula in Preclinical Undergraduate Medical Education: A Scoping Review (papers/Clinical Reasoning Curriculua.pdf)
- ivanov_2021_esi_ml: Improving ED Emergency Severity Index Acuity Assignment Using Machine Learning and Clinical NLP (papers/IMPROVING ED EMERGENCY SEVERITY INDEX.pdf)
- jo_2025_llm_virtual_patients: Large Language Model-Based Virtual Patient Simulations in Medical and Nursing Education: A Review (papers/LLM Virtual Patients.pdf)
- aamc_core_epas: AAMC Core Entrustable Professional Activities for Entering Residency (https://www.aamc.org/about-us/mission-areas/medical-education/cbme/core-epas)
- aamc_epa_guiding_principles: AAMC Core EPAs Guiding Principles (https://www.aamc.org/what-we-do/mission-areas/medical-education/cbme/core-epas/guiding-principles)
- ena_triage_portfolio: Emergency Nurses Association Triage Portfolio (https://www.ena.org/education/search-courses/triage-portfolio)
- acep_ena_triage_policy_2025: ACEP/ENA Emergency Department Triage Joint Policy Statement (https://www.ena.org/sites/default/files/2025-08/Emergency%20Department%20Triage.pdf)
- ssh_accreditation: Society for Simulation in Healthcare Full Accreditation (https://ssih.org/full-accreditation)
- educational_outcomes_measurement_framework: Educational Outcomes Measurement Framework (docs/educational_outcomes_measurement_framework.json)
- educational_outcomes_runtime_report: Educational Outcomes Runtime Report (docs/educational_outcomes_runtime_report.json)
- open_evidence_runtime_policy_report: Open Evidence Runtime Policy Report (docs/open_evidence_runtime_policy_report.json)
- equity_bias_readiness_audit: Equity and Bias Readiness Audit (docs/equity_bias_readiness_audit.json)

## Criteria

| ID | Domain | Status | Current Evidence | Required Next Evidence |
|---|---|---|---|---|
| goal_contract_auditable_completion | goal_governance | Pass | Readiness report exists at docs/national_scale_readiness_report.json with verdict not_ready. | Keep readiness completion tied to gate evidence rather than narrative progress. |
| deterministic_feedback_primary | feedback_reliability | Fail | Feedback integrity gate is partial; optional AI draft panel present: true. | Maintain tests proving optional AI drafts cannot mutate deterministic scoring, SOAP, or checklist feedback. |
| complete_case_truth_records | clinical_accuracy | Fail | 0/23 case truth packets are reviewed; 23 remain pending. | Clinician-adjudicated truth record for every case: diagnosis, differential, consult/referral, stabilization, resources, objective data, reassessment, and disposition. |
| minimum_public_case_bank | clinical_coverage | Fail | Public case count is 23; ESI distribution is {"ESI_2":10,"ESI_1":2,"ESI_3":5,"ESI_4":4,"ESI_5":2}. | At least 100 clinician-reviewed public-safe cases with balanced acuity, complaint, demographic, and special-population coverage. |
| esi_expert_consensus_benchmark | triage_validity | Fail | The app has source ESI labels and draft packets, but no public benchmark report comparing learners or the simulator against expert consensus. | Gold-standard ESI review set, expert agreement report, learner ESI accuracy, undertriage rate, overtriage rate, and ESI 2/3 boundary analysis. |
| validated_triage_standard_alignment | triage_validity | Partial | The evidence bundle includes ENA ESI sources and the cases include reference ESI values, but case-level ESI rationale has not been fully clinician-reviewed. | Case-by-case ESI decision-point rationales reviewed against the current ENA ESI Handbook and institutional triage education expectations. |
| clinical_reasoning_definition | educational_validity | Partial | Draft outcomes protocol present: true. | Faculty-approved definition of clinical reasoning used consistently in learner-facing curriculum, scoring, and research protocol. |
| clinical_reasoning_theory_domains | educational_validity | Partial | Objective matrix maps 23/23 cases across draft domains. | Educator-reviewed mapping from noticing, interpreting, responding, and reflecting to each debrief and scored action. |
| assessment_validity_argument | educational_validity | Partial | Reviewed objective cases: 0; outcome protocol status: draft_protocol_present_not_validated; outcome metrics framework: draft_instrumentation_framework_needs_pilot_validation. | Validity argument covering content validity, response process, internal structure/reliability, relation to other measures, and consequence monitoring. |
| educational_outcome_metric_instrumentation | educational_outcomes | Partial | Draft framework defines 20 metrics, including 13 currently instrumented metrics and 4 metrics requiring external validation. Runtime outcome probes passed 7/7; privacy export findings: keys=0, identifiers=0. | Privacy-approved cohort exports, pre/post pilot analysis, delayed retention cases, and external transfer measures. |
| curricular_fit_and_epa_mapping | educational_validity | Partial | Draft Core EPA map present: 11/13 EPAs touched by workflow; 0 reviewed case mappings. | Faculty-approved Core EPA map, intended learner level, supervision assumptions, scoring use, and curriculum placement. |
| longitudinal_multimodal_performance_evidence | educational_validity | Fail | The app has draft learner progression concepts but no multi-assessor longitudinal implementation or institutional entrustment process. | Learner progression dataset, faculty observation hooks, coaching/remediation workflows, and multi-modal performance review protocol. |
| simulation_program_standard_mapping | scale_governance | Fail | The readiness docs include governance and scale plans but no SSH-style program evidence map. | Institution-specific simulation program evidence map for teaching/education, assessment, governance, faculty roles, content ownership, and quality improvement. |
| ai_simulation_use_case_boundaries | ai_governance | Partial | The readiness goal distinguishes education, assessment, governance, and research needs, but app settings do not yet expose all use-case boundaries or approvals. | Mode-specific policy for practice, assessment, faculty review, translational research, and scholarship workflows. |
| ai_ethics_literacy_cybersecurity_governance | ai_governance | Partial | Governance inventory status is draft_needs_institutional_privacy_security_review; governance plan present: true. | Institution-approved AI disclosure, learner consent, bias review, API-key policy, cybersecurity review, and incident-response owner. |
| data_governance_and_privacy_review | privacy_governance | Partial | Data inventory status is draft_needs_institutional_privacy_security_review; default public workflow network requests: false. | Approved FERPA/HIPAA-adjacent deployment review, retention policy, DPA/vendor review, and restricted-data prohibition for public cohorts. |
| llm_virtual_patient_factual_accuracy | virtual_patient_quality | Fail | Optional LLM patient/tutor paths exist, but there is no automated factual consistency suite across cases. | Case-fact consistency tests for patient voice, tutor, debrief draft, and written critique outputs. |
| llm_virtual_patient_role_consistency | virtual_patient_quality | Fail | No role-consistency benchmark or scenario drift report is present. | Dialogue regression suite checking patient persona, timeline, symptom boundaries, vitals, and refusal to invent unavailable objective data. |
| llm_virtual_patient_emotional_realism | virtual_patient_quality | Fail | No emotional realism rubric or student/faculty evaluation data is present. | Standardized patient-style realism rubric, learner survey, and faculty review across common ED scenarios. |
| model_prompt_source_transparency | ai_governance | Partial | Draft augmentation metadata and evidence bundle versions exist; optional AI session reporting is not yet complete across all workflows. | Per-session model/provider/prompt/source-bundle/version metadata surfaced to instructors and exportable for review. |
| multi_site_controlled_outcomes | educational_outcomes | Fail | Outcome protocol present: true; outcome framework present: true; reviewed outcome studies: 0; status remains draft_protocol_present_not_validated. | Pilot and multi-site controlled evaluation measuring ESI accuracy, undertriage reduction, rationale quality, OSCE/simulation transfer, and hospital-performance proxies. |
| standardized_virtual_patient_metrics | educational_outcomes | Fail | Educational outcome metrics are instrumented, but no full VP quality suite is implemented for factuality, role consistency, realism, latency, learner satisfaction, and learning impact. | Metric definitions, evaluator rubrics, automated probes, and threshold reports per release. |
| quote_backed_feedback_coverage | open_evidence_grounding | Fail | 89/2489 chunks are quote-backed; 2400 generated chunks need review; runtime policy probes passed: true. | Replace or approve generated summaries with quote-backed or clinician-approved chunks before source-of-truth learner feedback. |
| evidence_review_queue_operational | open_evidence_grounding | Partial | Evidence backlog has 944 batches and 2400 pending chunks; runtime quarantine returned 0 generated references in policy probes. | Reviewer assignments, completed reviews, promotion/removal decisions, and regenerated source-quality report showing no unresolved generated-needs-review chunks in learner-facing content. |
| claim_to_source_entailment | open_evidence_grounding | Fail | The project has citation contracts and source IDs, but no public claim-entailment audit across deterministic feedback categories. | Claim-level entailment review for diagnosis, ESI, management, consult/referral, reassessment, disposition, and safety advice. |
| faculty_case_review_workflow | clinical_accuracy | Partial | Case truth review queue exists with 23 packets and 2 minimum reviewers per case. | Completed clinician and educator review packets, disagreement adjudication, and reviewer identity/role audit trail. |
| unsafe_feedback_red_team_suite | learner_safety | Partial | Draft safety suite present with 10 tests across 10/10 required categories; runtime passed 10. | Run automated probes and complete clinician/educator review for high-risk ED presentations, bias, unsafe disposition, and misleading reassurance. |
| equity_bias_case_review_and_policy | equity_bias_readiness | Partial | Draft equity audit queues 23 cases, has 0 reviewed cases, and passed 8/8 automated bias probes. | Case-level equity notes, language-access review, disability/accommodation review, pregnancy/reproductive-health review where relevant, and clinician-educator approval of bias safeguards. |
| accessibility_and_accommodation | scale_accessibility | Partial | Scale/accessibility plan present: true; WCAG audit status: automated_static_audit_complete_manual_wcag_required. | Completed WCAG audit, keyboard and screen-reader test pass, accommodation plan, and learner usability study. |
| scale_reliability_monitoring | scale_accessibility | Partial | Load-test status: runtime_scale_smoke_passed_load_monitoring_required; monitoring status: draft_plan_present_not_operational. | Load test, uptime/error budget, monitoring dashboard, incident drill, content rollback plan, and release checklist. |
| institutional_content_governance | scale_governance | Partial | Governance plan present: true; institutional review ready: false. | Signed institutional clinical content governance SOP, source update cadence, case retirement process, and incident escalation/rollback plan. |
| readiness_gate_integrity | goal_governance | Pass | Verdict is not_ready; case truth gate is fail; evidence gate is fail. | Keep the gate fail conditions strict until real clinical review and evidence review are complete. |
