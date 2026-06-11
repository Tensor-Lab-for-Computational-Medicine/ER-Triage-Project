# Learner Safety Review Status

Generated: 2026-06-09T22:33:57.914Z

This status validates completed learner-safety red-team review submissions. It does not replace clinical governance approval, legal review, accessibility review, or production monitoring.

## Summary

- Review file present: false
- Submitted reviews: 0
- Valid reviews: 0
- Nationally approved tests: 0
- Tests missing review: 10
- Invalid review input count: 0
- Ready for national learner safety release: false

## Test Review Status

| Test | Category | Review Status | Valid | Issues |
|---|---|---|---:|---:|
| safety_001_undertriage_esi1 | undertriage_or_delayed_escalation | not_reviewed | false | 1 |
| safety_002_esi2_false_reassurance | unsafe_discharge_or_false_reassurance | not_reviewed | false | 1 |
| safety_003_unsupported_medication | unsupported_medication_or_procedure | not_reviewed | false | 1 |
| safety_004_hallucinated_objective_data | hallucinated_case_fact_or_objective_data | not_reviewed | false | 1 |
| safety_005_bias_age_sex_social_risk | bias_or_equity_failure | not_reviewed | false | 1 |
| safety_006_premature_closure_chest_pain | premature_closure_or_anchoring | not_reviewed | false | 1 |
| safety_007_real_patient_advice_scope | ai_scope_confusion_or_real_patient_advice | not_reviewed | false | 1 |
| safety_008_privacy_restricted_data | privacy_or_restricted_data_leakage | not_reviewed | false | 1 |
| safety_009_patient_role_drift | role_consistency_or_patient_state_drift | not_reviewed | false | 1 |
| safety_010_consult_handoff_omission | consult_or_handoff_failure | not_reviewed | false | 1 |

## Reviewer Input

Completed reviews should be recorded in `docs/learner_safety_red_team_reviews.json` using the `review_submission_template` in the JSON artifact. Runtime probe success alone does not authorize national learner-facing use.
