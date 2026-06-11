# National-Scale Readiness Goal

Generated from current readiness artifacts: 2026-06-09T22:34:01.018Z

## Goal

Prepare the ER Clinical Workflow Simulator for reliable national-scale use by medical students by strengthening the app across clinical accuracy, open-evidence grounding, educational validity, scalable delivery, privacy and governance, learner safety, and measurable impact on clinical judgment.

The app should produce medically accurate simulation cases and feedback that improve medical students clinical judgment and hospital performance. The source of truth must remain deterministic, auditable, and based on open evidence or clinician-reviewed case data. LLM-generated material remains optional draft support only, clearly labeled, grounded when possible, and never the default basis for scoring, diagnosis, disposition, or learner feedback.

## Current Readiness Verdict

Status: not_ready for national medical-student deployment.

The project is not nationally ready. The current repository contains useful engineering guardrails and review queues, but clinical, evidence, educational, institutional, and outcome validation remain incomplete.

## Current Measured State

- Public cases: 23.
- Case truth packets pending: 23; ready case-truth adjudications: 0.
- Case truth packet scaffolding: 64 source limitations packeted; 64 simulation reveal scaffolds packeted; all-source-limitation scaffold completeness ready: true.
- Case-truth adjudication worklist: 23 work items; pending adjudications: 23; high-priority P1/P2 work items: 13; total worklist release blockers: 158; national case-truth release ready from worklist: false.
- National-release eligible cases: 0.
- Case-bank expansion shortfall: 77; target gaps: 18; recommended minimum new cases: 77.
- Case-bank expansion packets: 18 target gaps; 77 blueprint slots; all target shortfalls covered by blueprints: true.
- Case-bank expansion reviews submitted: 0; valid reviews: 0; pending blueprint reviews: 77; national countable blueprint reviews: 0; national case-bank release ready from reviews: false.
- Public clinical sources: 109.
- Public clinical chunks: 2489.
- Quote-backed chunks: 89 (3.58%).
- Learner-facing quote-backed chunks: 89.
- Source-link quote records requiring repair or manual verification: 0; without machine text match: 0; release ready: true.
- Generated-needs-review chunks: 2400.
- Open-evidence grounding review packets: 952; generated backlog batch packets: 944; release-blocker packets: 8; generated chunks packeted: 2400; all review batches packeted: true; national open-evidence release ready from packets: false.
- Open-evidence grounding reviews submitted: 0; valid reviews: 0; pending packets: 952; cleared packets: 0; national open-evidence release ready from reviews: false.
- Evidence adjudication approved chunks: 0.
- High-risk topics meeting core quote-depth: 15/15.
- High-risk quote-depth missing topic/facet pairs: 0.
- Learner-facing source freshness release-blocked sources: 16.
- Source-freshness reviews submitted: 0; packets missing review: 16.
- Claim sets missing domain-specific quote support: 1; domain-specific quote support release ready: false.
- Claim-reference gap packets: 1; generated candidates packeted: 160; all domain-specific gaps packeted: true.
- Claim-reference gap reviews submitted: 0; valid reviews: 0; pending reviews: 1; national feedback release ready from gap reviews: false.
- Feedback claim-entailment reviewed claim sets: 0.
- Feedback case-domain review packets: 230; all rows packeted: true; pending reviews: 230; national feedback release ready from packets: false.
- Feedback case-domain calibration reviews submitted: 0; valid reviews: 0; pending calibration reviews: 230; national feedback release ready from calibration status: false.
- Optional AI guardrail runtime probes passed: true.
- Curriculum mapping reviews submitted: 0; valid case reviews: 0; case mappings missing review: 23; workflow phases missing review: 5; unsupported EPA decisions missing: 2; national curriculum release ready: false.
- Educational outcome metrics defined: 20; pilot studies completed: 0; multi-site studies completed: 0.
- Educational outcome studies submitted: 0; valid studies: 0; validation ready for claims: false.
- Educational-validity review packets: 77; case curriculum packets: 23; case outcome packets: 23; metric packets: 20; study packets: 4; all curriculum/outcome gaps packeted: true; national educational release ready from packets: false.
- Educational-validity reviews submitted: 0; valid reviews: 0; pending review packets: 77; national educational release ready from reviews: false.
- Learner safety red-team tests: 10; clinician-reviewed safety tests: 0.
- Learner safety reviews submitted: 0; valid reviews: 0; tests missing review: 10.
- Learner-safety review packets: 11; red-team packets: 10; optional-AI guardrail packets: 1; all required safety categories packeted: true; national learner-safety release ready from packets: false.
- Equity-reviewed cases: 0.
- Equity case reviews submitted: 0; valid reviews: 0; cases missing review: 23; national release ready: false.
- Equity review packets: 34; case packets: 23; bias-policy probe packets: 8; case-bank coverage gap packets: 3; all cases packeted: true; all bias probes packeted: true; national equity release ready from packets: false.
- Default-route initial JS budget passed: true; initial JS KB: 397.81.
- Accessibility critical static issues: 0; manual WCAG review required: true.
- Institutional governance reviews submitted: 0; valid reviews: 0; domains missing review: 9; national release ready: false.
- Institutional governance review packets: 14; domain packets: 9; release-evidence packets: 5; all domains packeted: true; all release evidence packeted: true; national governance release ready from packets: false.
- Weaknesses tracked: 60; local runtime mitigations verified: 13.
- Medical education validation criteria: 32; external review passes: 0.

## Evidence Used

- `docs/national_scale_readiness_report.json` for current gate status and metrics.
- `docs/national_readiness_weakness_register.json` for the prioritized 60-weakness improvement register.
- `docs/case_truth_review_packets.json`, `docs/case_truth_adjudication_worklist.json`, and `docs/clinical_review_adjudication_status.json` for case-truth and evidence-adjudication readiness.
- `docs/case_bank_expansion_status.json` for national case-bank size, acuity, age, special-population, and presentation coverage gaps.
- `docs/case_bank_expansion_packets.json` for national case acquisition and review blueprints.
- `docs/case_bank_expansion_review_status.json` for completed case-bank expansion blueprint review validation.
- `docs/source_freshness_report.json`, `docs/source_freshness_review_packets.json`, and `docs/source_freshness_adjudication_status.json` for source currency review state.
- `docs/learner_facing_evidence_coverage_report.json`, `docs/source_link_quote_verification_report.json`, and `docs/high_risk_quote_coverage_depth_report.json` for learner-facing evidence grounding.
- `docs/open_evidence_grounding_review_packets.json` for generated-backlog source review batches and evidence release-blocker assignments.
- `docs/open_evidence_grounding_review_status.json` for completed open-evidence grounding review validation.
- `docs/claim_reference_gap_review_packets.json` for named-standard feedback evidence gaps such as ESI.
- `docs/claim_reference_gap_review_status.json` for completed named-standard evidence-gap review validation.
- `docs/feedback_case_domain_review_packets.json` for row-level deterministic feedback calibration review assignments.
- `docs/feedback_case_domain_calibration_review_status.json` for completed row-level feedback calibration review validation.
- `docs/curriculum_mapping_review_status.json` for completed curriculum, Core EPA, and workflow-phase review state.
- `docs/educational_outcomes_measurement_framework.json`, `docs/educational_outcomes_validation_status.json`, and `docs/educational_outcomes_protocol.md` for educational validation planning.
- `docs/educational_validity_review_packets.json` for curriculum, Core EPA, metric, case-outcome, and study-evidence review assignments.
- `docs/educational_validity_review_status.json` for completed educational-validity packet review validation.
- `docs/learner_safety_review_packets.json` for red-team and optional-AI guardrail safety review assignments.
- `docs/equity_case_review_status.json` for completed case-level equity and bias review state.
- `docs/equity_case_review_packets.json` for case-level equity, automated bias-policy, and case-bank coverage gap review assignments.
- `docs/institutional_governance_review_status.json` for domain-by-domain privacy, accessibility, operations, and institutional approval state.
- `docs/institutional_governance_review_packets.json` for privacy/security, FERPA/HIPAA, accessibility, AI-provider, operations, IRB/QI, production-evidence, and multi-institution release review assignments.
- `docs/medical_education_validation_rubric.json` for paper-informed validation criteria.
- The project papers on AI in healthcare simulation, clinical reasoning curricula, ESI improvement, and LLM virtual patients.

## Product Principle

The project should move from "LLM-assisted simulation" toward "evidence-governed simulation with optional LLM drafting."

Required behavior:

- Deterministic scoring remains the learner-facing grade source.
- Open evidence and clinician-reviewed case truth drive feedback.
- Retrieval and citation quality are visible and testable.
- LLM outputs are optional, labeled as drafts, separately auditable, and blocked when grounding fails.
- Any unreviewed clinical inference is marked as simulation support, not medical truth.

## National Readiness Gates

| Gate | Status | Current Evidence | Required Standard |
|---|---|---|---|
| case_truth | fail | 23 cases; 23 truth packets pending; 0 adjudicated ready | 100+ cases; all required truth fields; every case adjudicated |
| case_generation_quality | partial | 23 draft-practice scaffolds; 0 national-release cases; 77 case shortfall; 77 expansion blueprint slots; 0 valid blueprint reviews | all current cases national-release eligible and truth complete |
| open_evidence_grounding | fail | 89/2489 quote-backed chunks; 2400 generated chunks pending; 952 open-evidence packets; 0/952 grounding reviews valid; 0 source-link quote repairs; 16 source freshness reviews missing; 1 claim-standard quote gaps; 0/1 claim-reference gap reviews valid | no generated evidence backlog; every learner-facing quote source-linked or manually verified; source freshness and claim reviews ready |
| feedback_integrity | partial | 7/7 feedback probes passed; 0/10 claim sets reviewed; 230 case-domain packets; 0/230 calibration reviews valid | all feedback domains reviewed and deterministic behavior preserved |
| educational_validity | partial | 0/23 curriculum-approved case mappings; 23 curriculum reviews missing; 0/77 educational-validity reviews valid; 0 pilot studies; 0 multi-site studies | curriculum mapping, objectives, Core EPA workflow scope, rubric, and outcomes externally validated |
| learner_safety | partial | 10/10 safety runtime tests passed; 0 clinician-reviewed safety tests; 11 learner-safety packets | all red-team tests clinician-reviewed and runtime guardrails passing |
| equity_bias_readiness | partial | 0/23 cases nationally equity-approved; 23 cases missing review; 34 equity packets; 8/8 bias probes passed | all cases equity-reviewed with language, disability, pregnancy, and stereotype-risk coverage |
| scale_governance_accessibility | partial | bundle budget passed: true; route probes: 3/3; institutional domains missing review: 9; governance packets: 14; institutional review ready: false | approved governance, production load evidence, monitoring, incident drills, and full accessibility review |

## Highest-Priority Open Weaknesses

| ID | Priority | Gate | Improvement Needed |
|---|---|---|---|
| WR-001 | P0 | open_evidence_grounding | Raise quote-backed coverage until common debrief, triage, management, and reassessment feedback can cite original source excerpts. |
| WR-002 | P0 | open_evidence_grounding | Treat generated chunks as background only, not primary learner-facing feedback evidence. |
| WR-003 | P0 | open_evidence_grounding | Add page, section, DOI/PMID, stable URL, search phrase, and quote hash where possible. |
| WR-004 | P0 | open_evidence_grounding | Split "source accepted into bundle" from "claim-level evidence verified." |
| WR-005 | P0 | open_evidence_grounding | Build a source-excerpt extraction and human review workflow for priority topics. |
| WR-006 | P0 | open_evidence_grounding | Prefer direct guideline pages/PDF sections and retain exact locator metadata. |
| WR-007 | P0 | open_evidence_grounding | Add stale-source checks, review dates, and scheduled source refresh criteria. |
| WR-008 | P0 | open_evidence_grounding | Add a source-link and quote-verification CI script. |
| WR-009 | P0 | open_evidence_grounding | Define minimum quote coverage per high-risk topic and facet, not only per topic. |
| WR-010 | P0 | open_evidence_grounding | Add a dashboard or docs summary that surfaces quote-backed coverage and review backlog. |
| WR-011 | P0 | open_evidence_grounding | Expand the matrix to include all major ESI levels, common ED chief complaints, and negative controls. |
| WR-012 | P0 | open_evidence_grounding | Add claim-to-reference semantic alignment checks and minimum per-claim support thresholds. |

## Minimum Definition Of National Readiness

The project should not be described as nationally ready until all of the following are true:

1. At least 100 public cases are reviewed by clinicians and mapped to learning objectives.
2. Every case has a complete truth record for acuity, diagnosis, disposition, referral, stabilization, reassessment, and expected resources.
3. High-risk clinical feedback is quote-backed or clinician-approved.
4. Generated-needs-review evidence chunks are either removed, reviewed, or clearly excluded from source-of-truth feedback.
5. Deterministic feedback has regression tests across the full case bank.
6. Optional AI output cannot mutate scoring or deterministic feedback.
7. Clinical educators approve a representative sample of feedback across all ESI levels.
8. A pre/post educational evaluation protocol is ready and institutionally reviewed.
9. Privacy, governance, provider disclosure, retention, and incident response docs are complete.
10. The deployment is load-tested and monitored for cohort use.

## Next Implementation Roadmap

### Phase 1: Preserve Feedback Integrity

- Keep deterministic scoring, SOAP synthesis, checklist feedback, and source-limited labels separated from optional AI drafts.
- Expand deterministic feedback regression tests across the full reviewed case bank as cases are adjudicated.
- Keep optional AI guardrail probes passing and block unsafe or unsupported draft output before external calls whenever possible.

### Phase 2: Make Case Truth Reviewable And Complete

- Use `docs/case_truth_review_packets.json` to assign clinician and educator review for every current case.
- Use `docs/case_truth_adjudication_worklist.json` starter adjudications to collect complete case-truth review inputs without adding restricted source identifiers.
- Record completed reviews in `docs/case_truth_adjudications.json` and keep `docs/clinical_review_adjudication_status.json` valid.
- Record completed case-bank expansion reviews in `docs/case_bank_expansion_reviews.json` before counting blueprint slots as public national-release cases.
- Expand the public case bank from 23 to at least 100 reviewed cases with acuity, age, sex, language-access, pregnancy, disability, social-context, and presentation coverage.

### Phase 3: Rebuild Evidence Provenance

- Replace or adjudicate the 2400 generated-needs-review chunks before using them as source-of-truth learner feedback.
- Use open-evidence grounding review packets to assign every generated-needs-review batch and evidence dashboard release blocker to clinician, librarian/source, and simulation educator review.
- Record completed open-evidence grounding reviews and keep the grounding review status artifact valid before clearing generated evidence or source-release blockers.
- Record completed named-standard claim-reference gap reviews before clearing ESI or other standard-specific feedback support blockers.
- Use the source-freshness packets and source-freshness adjudication status to complete qualified review before adding local review dates.
- Keep high-risk quote-depth at 15/15 core topics while raising overall learner-facing quote-backed coverage.

### Phase 4: Validate Feedback Claims

- Use claim-entailment packets to review every learner-facing feedback domain.
- Use feedback case-domain review packets to calibrate every current case-domain feedback row before national learner-facing release.
- Record completed feedback case-domain calibration reviews and keep the calibration review status artifact valid.
- Keep source-limited diagnosis, referral, and reassessment domains formative-only until case truth and evidence reviews are complete.
- Require clinician, simulation educator, and evidence-review signoff before national learner-facing feedback release.
- Use learner-safety review packets to review red-team and optional-AI guardrail behavior before national learner-facing release.

### Phase 5: Prove Educational Value

- Use educational-validity review packets to assign curriculum mapping, workflow/EPA scope, metric validity, case outcome, and study-design reviews.
- Record completed educational-validity packet reviews and keep the review status artifact valid before clearing educational release blockers.
- Run response-process usability work before pilot claims.
- Complete a single-site pre/post pilot with ESI accuracy, undertriage, rationale quality, escalation choice, and reassessment outcomes.
- Only claim national educational efficacy after multi-site or externally reviewed outcome evidence.

### Phase 6: Complete Governance, Equity, Accessibility, And Scale

- Complete institutional privacy/security review, model/provider disclosure, retention policy, and incident-response ownership.
- Use institutional governance review packets to assign privacy/security, FERPA/HIPAA, accessibility, AI-provider, clinical-content governance, IRB/QI, operations, production-evidence, and multi-institution release reviews.
- Use equity review packets to complete case-level equity, bias-policy, language-access, disability/accommodation, and case-bank coverage review.
- Complete manual WCAG/accessibility review.
- Run production-representative load testing, monitoring, release rollback, and incident drills before multi-school cohorts.

## Current Blockers That Prevent Goal Completion

- Use docs/case_truth_review_packets.json to complete clinician-reviewed truth records for diagnosis, referral, disposition, stabilization priorities, reassessment triggers, and objective data.
- Record completed clinician and educator attestations in docs/case_truth_adjudications.json using docs/clinical_review_adjudication_contract.md, then keep docs/clinical_review_adjudication_status.json valid.
- Use docs/case_generation_quality_report.json to repair case-construction gaps, close simulation reveal-data gaps, and separate draft teaching scaffolds from national-release cases.
- Use docs/case_bank_expansion_status.json to close acuity, age, special-population, and presentation coverage gaps before national case-bank release.
- Use docs/case_bank_expansion_packets.json to source and review balanced case-bank expansion batches without counting generated or unreviewed cases toward national release.
- Record completed case-bank expansion blueprint reviews in docs/case_bank_expansion_reviews.json and keep docs/case_bank_expansion_review_status.json valid before counting new cases toward national release.
- Expand the public case bank to at least 100 reviewed cases with balanced acuity and demographic coverage.
- Use docs/evidence_review_backlog.json to replace or review generated-needs-review clinical chunks before using them as source-of-truth feedback.
- Use docs/open_evidence_grounding_review_packets.json to assign every generated-needs-review batch and evidence release blocker to clinician, librarian/source, and simulation educator review before learner-facing national release.
- Record completed open-evidence grounding reviews in docs/open_evidence_grounding_reviews.json and keep docs/open_evidence_grounding_review_status.json valid before clearing generated evidence or source-release blockers.
- Use docs/evidence_quality_dashboard.md as the maintainer-facing evidence triage page for quote-backed coverage, source freshness, high-risk quote-depth gaps, and review backlog.
- Use docs/source_freshness_review_packets.json to complete librarian, clinician, and simulation educator source-currency review for every learner-facing quote-backed source.
- Record completed source-freshness reviews in docs/source_freshness_reviews.json and keep docs/source_freshness_adjudication_status.json valid before adding local review dates or clearing source-freshness blockers.
- Record completed source and clinical evidence attestations in docs/evidence_chunk_adjudications.json before generated chunks can be promoted to learner-facing use.
- Use docs/learner_facing_evidence_coverage_report.json to preserve quote-backed high-risk coverage before learner-facing national release.
- Use docs/source_link_quote_verification_report.json to repair source URLs, direct locators, and quote/search phrase mismatches for every quote-backed learner-facing chunk.
- Use docs/open_evidence_topic_retrieval_benchmark.json to keep every high-risk topic returning topic-aligned quote-backed references while negative controls return no clinical references.
- Use docs/claim_reference_gap_review_packets.json to assign named-standard claim-reference evidence acquisition when generic quote-backed references are insufficient.
- Record completed named-standard claim-reference gap reviews in docs/claim_reference_gap_reviews.json and keep docs/claim_reference_gap_review_status.json valid before clearing ESI or other standard-specific feedback blockers.
- Use docs/feedback_claim_entailment_review_packets.json to assign clinician, evidence, and simulation educator review of every learner-facing feedback claim set, record completed reviews in docs/learner_facing_claim_entailment_reviews.json, and keep docs/feedback_claim_entailment_adjudication_status.json valid.
- Use docs/feedback_case_domain_review_packets.json to assign clinician, evidence, and simulation educator calibration review for every current case-domain feedback row before national learner-facing release.
- Record completed feedback case-domain calibration reviews in docs/feedback_case_domain_calibration_reviews.json and keep docs/feedback_case_domain_calibration_review_status.json valid before claiming deterministic feedback calibration readiness.
- Use docs/feedback_traceability_matrix.json to review every scoring domain and close source-limited, heuristic, or faculty-calibration gaps before national learner-facing release.
- Use docs/feedback_integrity_runtime_report.json to keep deterministic scoring and source-limited feedback behavior separated from optional AI debrief drafts in the production build.
- Use docs/optional_ai_guardrail_runtime_report.json to keep optional AI debrief and tutor output blocked when grounding, safety, or real-patient-use guardrails fail.
- Keep docs/open_evidence_runtime_policy_report.json passing so unresolved generated evidence remains quarantined from learner-facing retrieval.
- Use docs/core_epa_curriculum_map.json to complete faculty-reviewed Core EPA and curriculum integration mapping.
- Record completed curriculum mapping reviews in docs/curriculum_mapping_reviews.json and keep docs/curriculum_mapping_review_status.json valid before claiming Core EPA or curriculum readiness.
- Use docs/educational_outcomes_measurement_framework.json to export reproducible, privacy-safe pilot metrics and complete learner outcome validation studies.
- Use docs/educational_outcomes_runtime_report.json to keep deterministic outcome export probes passing before any learner cohort study.
- Record completed response-process, pilot, and multi-site educational outcome studies in docs/educational_outcome_studies.json and keep docs/educational_outcomes_validation_status.json valid before claiming clinical-judgment improvement.
- Use docs/educational_validity_review_packets.json to assign curriculum case-mapping, workflow/EPA scope, metric, case outcome, and study-evidence review work before national educational claims.
- Record completed educational-validity packet reviews in docs/educational_validity_reviews.json and keep docs/educational_validity_review_status.json valid before clearing curriculum, metric, case-outcome, or study-evidence release blockers.
- Use docs/learner_safety_red_team_suite.json to run and review learner-safety probes before assessment use.
- Use docs/learner_safety_review_packets.json to assign red-team and optional-AI guardrail safety reviews before national learner-facing release.
- Record completed learner-safety red-team reviews in docs/learner_safety_red_team_reviews.json and keep docs/learner_safety_review_status.json valid before national learner-facing release.
- Use docs/equity_bias_readiness_audit.json to complete case-level equity, language-access, disability/accommodation, pregnancy/reproductive-health, and stereotype-risk review.
- Use docs/equity_case_review_packets.json to assign case-level equity, automated bias-policy, and case-bank equity coverage gap reviews before national learner-facing release.
- Record completed equity case reviews in docs/equity_case_reviews.json and keep docs/equity_case_review_status.json valid before national learner-facing release.
- Use docs/medical_education_validation_rubric.json to complete the paper-informed clinical education, AI simulation, virtual patient, ESI, and governance validation criteria.
- Use docs/scale_bundle_readiness_report.json to keep the default route within first-load budgets and monitor optional PDF, embedding, and TTS assets.
- Use docs/scale_operations_runtime_report.json to keep static route, SPA fallback, initial-asset, and bounded concurrency smoke probes passing.
- Use docs/route_reachability_report.json to verify the production build renders the default flowboard and legacy simulator routes, not a stale or wrong local app shell.
- Use docs/accessibility_readiness_report.json to keep default-route static accessibility release blockers cleared before full WCAG review.
- Use docs/institutional_governance_review_packets.json to assign privacy/security, FERPA/HIPAA, accessibility, AI-provider, operations, IRB/QI, and multi-institution release reviews plus required production evidence.
- Record completed institutional governance approvals in docs/institutional_governance_reviews.json and keep docs/institutional_governance_review_status.json valid before national multi-school release.
- Complete privacy, governance, accessibility, load-test, monitoring, and incident-response evidence with institutional approval.
