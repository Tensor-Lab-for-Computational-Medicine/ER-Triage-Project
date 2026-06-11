# Educational Outcomes Measurement Framework

Generated: 2026-06-09T22:33:58.430Z

This framework defines reproducible app signals for educational evaluation. It is not evidence that the simulator improves clinical judgment until usability, expert review, pilot, and multi-site outcome studies are completed.

## Summary

- Review status: draft_instrumentation_framework_needs_pilot_validation
- Metrics: 20
- Currently instrumented: 13
- Source-limited: 3
- Require external validation: 4
- Cases mapped: 23
- Reviewed outcome studies: 0

## Privacy-Safe Export Contract

Default include: case_id, content_version, cohort code if approved, learner training level if approved, ESI selection and direction, score domains, interview and escalation counts, source-limited feedback exposure, safety flags

Default exclude: student name, student email, student id, direct patient identifiers, raw optional AI draft text, free-text learner rationale without institutional approval

## Metrics

| ID | Construct | Status | App Signal | Validation Need |
|---|---|---|---|---|
| esi_accuracy | interpreting | currently instrumented | triage_analysis.user_level, triage_analysis.expert_level | Expert consensus benchmark for every case and learner level. |
| esi_error_direction | interpreting | currently instrumented | triage_analysis.comparison | Faculty review of undertriage and overtriage consequence thresholds. |
| high_risk_undertriage | patient_safety | currently instrumented | reference ESI with learner ESI direction | Clinician adjudication of ESI 1 and ESI 2 case truth. |
| lower_acuity_overtriage | resource_calibration | currently instrumented | reference ESI 4 or 5 with learner ESI direction | Triage educator review of resource-calibration cases. |
| score_percent | overall_formative_performance | currently instrumented | scorecard.percentage | Internal consistency and relation to external assessments. |
| score_domain_percentages | clinical_reasoning_domains | currently instrumented | scorecard.domains | Faculty calibration and domain weighting review. |
| interview_domain_coverage | noticing | currently instrumented | workflow_analysis.interview | Expert review of expected question domains by complaint. |
| focused_exam_selection | noticing | currently instrumented | scorecard domain focused_exam | Case-level exam truth and source-boundary review. |
| diagnostic_reasoning_score | interpreting | source limited | workflow_analysis.diagnosis, scorecard domain diagnosis | Clinician-reviewed diagnosis and differential truth records. |
| consult_judgment_score | responding | source limited | workflow_analysis.referral, scorecard domain referral | Clinician-approved consult/referral references. |
| escalation_action_alignment | responding | currently instrumented | workflow_analysis.escalation | Clinician review of expected placement and stabilization actions. |
| reassessment_target_score | reflecting | source limited | workflow_analysis.reassessment, scorecard domain reassessment | Clinician-adjudicated reassessment triggers or optional objective follow-up data. |
| soap_note_score | reflecting | currently instrumented | workflow_analysis.soap, scorecard domain soap | Faculty calibration of note-quality anchors. |
| sbar_handoff_score | communication | currently instrumented | workflow_analysis.sbar, scorecard domain sbar | Simulation educator review of handoff triggers and SBAR scoring. |
| source_limited_feedback_exposure | learner_calibration | currently instrumented | workflow_analysis diagnosis/referral/reassessment evidence_status and scoring_basis | Learner response-process study showing source limitation labels are understood. |
| learner_profile_gap_delta | longitudinal_formative_progression | currently instrumented | learner_profile_delta | Privacy-reviewed cohort export and longitudinal validity evidence. |
| optional_ai_draft_use | ai_use_monitoring | requires external validation | future optional AI draft viewed/requested event | Institutional policy for collecting AI-use telemetry. |
| delayed_retention_case_performance | learning_transfer | requires external validation | future pre/post and delayed case-set export | Pilot or multi-site study with delayed follow-up cases. |
| osce_or_sim_lab_transfer | clinical_performance_transfer | requires external validation | external OSCE, simulation lab, or clerkship assessment linkage | IRB or institutional approval and external assessment data. |
| workplace_supervisor_rating | hospital_performance_proxy | requires external validation | external supervised clinical performance measure | Institutional governance, consent, and multi-assessor evidence. |

## Validation Study Requirements

- Complete response-process usability study with medical students and faculty observers.
- Complete clinician-educator review of case truth, scoring anchors, source-limited labels, and objective map.
- Run pre/post pilot with held-out cases and report undertriage and rationale-quality change.
- Run multi-site controlled or stepped-wedge study before making national efficacy claims.
- Link any external OSCE, simulation lab, clerkship, or workplace data only after governance approval.

## Source References

- educational_outcomes_protocol: docs/educational_outcomes_protocol.md - Defines construct model, study phases, outcomes, instrumentation requirements, and analysis plan.
- outcome_metrics_service: frontend/src/services/educationalOutcomeMetricsService.js - Extracts deterministic, privacy-safe encounter metrics from completed feedback objects.
- learner_profile_service: frontend/src/services/learnerProfileService.js - Tracks local formative gap patterns for next-case recommendations.
- case_objective_matrix: docs/case_objective_matrix.json - Maps cases to draft learning objectives and evidence limits.
- core_epa_curriculum_map: docs/core_epa_curriculum_map.json - Maps workflow and cases to draft AAMC Core EPA curriculum planning categories.
