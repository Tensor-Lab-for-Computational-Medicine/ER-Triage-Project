# Educational Validity Review Packets

Generated: 2026-06-09T22:33:59.404Z

These packets operationalize curriculum, Core EPA, measurement, and outcomes-validation review work. They do not prove educational effectiveness, approve national curriculum use, or support claims that the simulator improves clinical judgment or hospital performance.

## Summary

- Total review packets: 77
- Case curriculum mapping packets: 23
- Workflow phase packets: 5
- Unsupported EPA decision packets: 2
- Case outcome measurement packets: 23
- Outcome metric packets: 20
- Outcome study packets: 4
- All curriculum and outcome gaps packeted: true
- Ready for national educational release from packets: false

## Curriculum Case Queue

| Priority | Case | ESI | EPAs | Review Decision |
|---|---|---:|---:|---|
| P0_high_acuity_curriculum_mapping_review | case_002 | 2 | 11 | not_reviewed |
| P0_high_acuity_curriculum_mapping_review | case_004 | 2 | 11 | not_reviewed |
| P0_high_acuity_curriculum_mapping_review | case_005 | 2 | 11 | not_reviewed |
| P0_high_acuity_curriculum_mapping_review | case_006 | 2 | 11 | not_reviewed |
| P0_high_acuity_curriculum_mapping_review | case_007 | 1 | 11 | not_reviewed |
| P1_urgent_care_epa_mapping_review | case_008 | 3 | 11 | not_reviewed |
| P1_urgent_care_epa_mapping_review | case_009 | 3 | 11 | not_reviewed |
| P1_urgent_care_epa_mapping_review | case_012 | 3 | 11 | not_reviewed |
| P0_high_acuity_curriculum_mapping_review | case_013 | 2 | 11 | not_reviewed |
| P1_urgent_care_epa_mapping_review | case_014 | 3 | 11 | not_reviewed |
| P0_high_acuity_curriculum_mapping_review | case_017 | 2 | 11 | not_reviewed |
| P1_urgent_care_epa_mapping_review | case_018 | 4 | 11 | not_reviewed |
| P1_urgent_care_epa_mapping_review | case_019 | 4 | 11 | not_reviewed |
| P1_urgent_care_epa_mapping_review | case_020 | 4 | 11 | not_reviewed |
| P1_urgent_care_epa_mapping_review | case_021 | 3 | 11 | not_reviewed |
| P0_high_acuity_curriculum_mapping_review | case_022 | 2 | 11 | not_reviewed |
| P0_high_acuity_curriculum_mapping_review | case_023 | 2 | 11 | not_reviewed |
| P1_urgent_care_epa_mapping_review | case_024 | 5 | 11 | not_reviewed |
| P0_high_acuity_curriculum_mapping_review | case_025 | 1 | 11 | not_reviewed |
| P1_urgent_care_epa_mapping_review | case_027 | 5 | 11 | not_reviewed |
| P0_high_acuity_curriculum_mapping_review | case_029 | 2 | 11 | not_reviewed |
| P1_urgent_care_epa_mapping_review | case_030 | 4 | 11 | not_reviewed |
| P0_high_acuity_curriculum_mapping_review | case_031 | 2 | 11 | not_reviewed |

## Workflow And EPA Scope Queue

| Packet | Type | Priority | Current Status | Required Roles |
|---|---|---|---|---|
| curriculum_workflow_phase_encounter | workflow_phase_curriculum_review | P0_urgent_care_workflow_scope_review | not_reviewed | clinical_educator, assessment_or_curriculum_reviewer, simulation_educator |
| curriculum_workflow_phase_impression | workflow_phase_curriculum_review | P0_urgent_care_workflow_scope_review | not_reviewed | clinical_educator, assessment_or_curriculum_reviewer, simulation_educator |
| curriculum_workflow_phase_plan | workflow_phase_curriculum_review | P0_urgent_care_workflow_scope_review | not_reviewed | clinical_educator, assessment_or_curriculum_reviewer, simulation_educator |
| curriculum_workflow_phase_reassessment | workflow_phase_curriculum_review | P0_urgent_care_workflow_scope_review | not_reviewed | clinical_educator, assessment_or_curriculum_reviewer, simulation_educator |
| curriculum_workflow_phase_debrief | workflow_phase_curriculum_review | P1_workflow_scope_review | not_reviewed | clinical_educator, assessment_or_curriculum_reviewer, simulation_educator |
| unsupported_epa_scope_EPA_11 | unsupported_epa_scope_decision | P1_scope_or_feature_decision_required | not_reviewed | clinical_educator, assessment_or_curriculum_reviewer, simulation_educator |
| unsupported_epa_scope_EPA_12 | unsupported_epa_scope_decision | P1_scope_or_feature_decision_required | not_reviewed | clinical_educator, assessment_or_curriculum_reviewer, simulation_educator |

## Outcome Measurement Queue

| Packet | Type | Priority | Status | Validation Need |
|---|---|---|---|---|
| esi_accuracy | metric | P2_metric_calibration_review | currently_instrumented | Expert consensus benchmark for every case and learner level. |
| esi_error_direction | metric | P2_metric_calibration_review | currently_instrumented | Faculty review of undertriage and overtriage consequence thresholds. |
| high_risk_undertriage | metric | P0_patient_safety_outcome_metric | currently_instrumented | Clinician adjudication of ESI 1 and ESI 2 case truth. |
| lower_acuity_overtriage | metric | P2_metric_calibration_review | currently_instrumented | Triage educator review of resource-calibration cases. |
| score_percent | metric | P2_metric_calibration_review | currently_instrumented | Internal consistency and relation to external assessments. |
| score_domain_percentages | metric | P2_metric_calibration_review | currently_instrumented | Faculty calibration and domain weighting review. |
| interview_domain_coverage | metric | P2_metric_calibration_review | currently_instrumented | Expert review of expected question domains by complaint. |
| focused_exam_selection | metric | P2_metric_calibration_review | currently_instrumented | Case-level exam truth and source-boundary review. |
| diagnostic_reasoning_score | metric | P0_source_limited_metric_review | source_limited | Clinician-reviewed diagnosis and differential truth records. |
| consult_judgment_score | metric | P0_source_limited_metric_review | source_limited | Clinician-approved consult/referral references. |
| escalation_action_alignment | metric | P1_safety_or_transfer_metric_review | currently_instrumented | Clinician review of expected placement and stabilization actions. |
| reassessment_target_score | metric | P0_source_limited_metric_review | source_limited | Clinician-adjudicated reassessment triggers or optional objective follow-up data. |
| soap_note_score | metric | P2_metric_calibration_review | currently_instrumented | Faculty calibration of note-quality anchors. |
| sbar_handoff_score | metric | P2_metric_calibration_review | currently_instrumented | Simulation educator review of handoff triggers and SBAR scoring. |
| source_limited_feedback_exposure | metric | P2_metric_calibration_review | currently_instrumented | Learner response-process study showing source limitation labels are understood. |
| learner_profile_gap_delta | metric | P2_metric_calibration_review | currently_instrumented | Privacy-reviewed cohort export and longitudinal validity evidence. |
| optional_ai_draft_use | metric | P1_external_validation_required | requires_external_validation | Institutional policy for collecting AI-use telemetry. |
| delayed_retention_case_performance | metric | P1_external_validation_required | requires_external_validation | Pilot or multi-site study with delayed follow-up cases. |
| osce_or_sim_lab_transfer | metric | P1_external_validation_required | requires_external_validation | IRB or institutional approval and external assessment data. |
| workplace_supervisor_rating | metric | P1_external_validation_required | requires_external_validation | Institutional governance, consent, and multi-assessor evidence. |

## Study Evidence Queue

| Packet | Acceptable Phases | Minimum N | Required Before | Current Valid Studies |
|---|---|---:|---|---:|
| outcome_study_response_process_usability | response_process_usability | 10 | single_site_pilot_claims | 0 |
| outcome_study_single_site_pre_post_pilot | single_site_pilot | 40 | local_effectiveness_claims | 0 |
| outcome_study_multi_site_effectiveness_study | multi_site_controlled, multi_site_stepped_wedge | 120 | national_effectiveness_claims | 0 |
| outcome_study_external_transfer_validation | external_transfer_validation | 40 | hospital_performance_or_transfer_claims | 0 |

## Reviewer Output

Completed reviews should be recorded in `docs/curriculum_mapping_reviews.json` and `docs/educational_outcome_studies.json` using the status artifacts templates. These packets are work assignments and do not constitute curriculum approval, educational effectiveness evidence, or national-readiness approval.
