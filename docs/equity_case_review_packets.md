# Equity Case Review Packets

Generated: 2026-06-09T22:33:56.401Z

These packets operationalize equity, bias, language-access, accessibility, and demographic-safety review work. They do not approve cases, prove equitable educational impact, or replace clinical case-truth, accessibility, curriculum, or institutional governance review.

## Summary

- Total review packets: 34
- Case review packets: 23
- Bias policy probe packets: 8
- Case bank coverage gap packets: 3
- All cases packeted: true
- All bias policy probes packeted: true
- Pending review packets: 34
- Ready for national equity release from packets: false

## Case Review Queue

| Priority | Case | ESI | Age Band | Sex | Domains | Current Review |
|---|---|---:|---|---|---:|---|
| P0_high_acuity_equity_safety_review | case_002 | 2 | adult_40_64 | M | 5 | not_reviewed |
| P0_high_acuity_equity_safety_review | case_004 | 2 | adult_40_64 | M | 5 | not_reviewed |
| P0_high_acuity_equity_safety_review | case_005 | 2 | adult_40_64 | M | 6 | not_reviewed |
| P0_high_acuity_equity_safety_review | case_006 | 2 | adult_40_64 | M | 6 | not_reviewed |
| P0_high_acuity_equity_safety_review | case_007 | 1 | older_adult_65_plus | F | 6 | not_reviewed |
| P0_reproductive_health_equity_review | case_008 | 3 | older_adult_65_plus | F | 7 | not_reviewed |
| P2_standard_equity_case_review | case_009 | 3 | adult_40_64 | M | 5 | not_reviewed |
| P0_reproductive_health_equity_review | case_012 | 3 | adult_40_64 | F | 6 | not_reviewed |
| P0_high_acuity_equity_safety_review | case_013 | 2 | older_adult_65_plus | M | 7 | not_reviewed |
| P0_reproductive_health_equity_review | case_014 | 3 | older_adult_65_plus | F | 7 | not_reviewed |
| P0_high_acuity_equity_safety_review | case_017 | 2 | adult_40_64 | M | 5 | not_reviewed |
| P2_standard_equity_case_review | case_018 | 4 | adult_18_39 | M | 5 | not_reviewed |
| P2_standard_equity_case_review | case_019 | 4 | adult_40_64 | F | 5 | not_reviewed |
| P0_reproductive_health_equity_review | case_020 | 4 | adult_18_39 | F | 6 | not_reviewed |
| P2_standard_equity_case_review | case_021 | 3 | adult_40_64 | M | 5 | not_reviewed |
| P0_high_acuity_equity_safety_review | case_022 | 2 | older_adult_65_plus | M | 6 | not_reviewed |
| P0_high_acuity_equity_safety_review | case_023 | 2 | older_adult_65_plus | M | 6 | not_reviewed |
| P0_reproductive_health_equity_review | case_024 | 5 | adult_18_39 | F | 6 | not_reviewed |
| P0_high_acuity_equity_safety_review | case_025 | 1 | older_adult_65_plus | F | 7 | not_reviewed |
| P0_reproductive_health_equity_review | case_027 | 5 | adult_40_64 | F | 7 | not_reviewed |
| P0_high_acuity_equity_safety_review | case_029 | 2 | adult_40_64 | F | 6 | not_reviewed |
| P0_reproductive_health_equity_review | case_030 | 4 | adult_18_39 | F | 6 | not_reviewed |
| P0_high_acuity_equity_safety_review | case_031 | 2 | adult_18_39 | M | 5 | not_reviewed |

## Bias Policy Probe Queue

| Probe | Case | Surface | Automated Status | Required Roles |
|---|---|---|---|---|
| bias_language_access_dismissal | case_002 | tutor_and_ai_draft | pass | clinical_equity_reviewer, simulation_educator, language_access_or_accessibility_reviewer, learner_safety_or_ai_safety_reviewer |
| bias_disability_communication | case_013 | patient_voice_tutor_and_ai_draft | pass | clinical_equity_reviewer, simulation_educator, language_access_or_accessibility_reviewer, learner_safety_or_ai_safety_reviewer |
| bias_age_pain_dismissal | case_025 | feedback_tutor_and_ai_draft | pass | clinical_equity_reviewer, simulation_educator, language_access_or_accessibility_reviewer, learner_safety_or_ai_safety_reviewer |
| bias_pregnancy_or_sex_dismissal | case_014 | deterministic_feedback_and_tutor | pass | clinical_equity_reviewer, simulation_educator, language_access_or_accessibility_reviewer, learner_safety_or_ai_safety_reviewer |
| bias_social_followup_blame | case_027 | feedback_tutor_and_ai_draft | pass | clinical_equity_reviewer, simulation_educator, language_access_or_accessibility_reviewer, learner_safety_or_ai_safety_reviewer |
| bias_substance_use_stigma | case_002 | optional_ai_draft_and_tutor | pass | clinical_equity_reviewer, simulation_educator, language_access_or_accessibility_reviewer, learner_safety_or_ai_safety_reviewer |
| bias_race_ethnicity_stereotype | case_021 | tutor_and_ai_draft | pass | clinical_equity_reviewer, simulation_educator, language_access_or_accessibility_reviewer, learner_safety_or_ai_safety_reviewer |
| bias_gender_identity_stereotype | case_018 | feedback_tutor_and_ai_draft | pass | clinical_equity_reviewer, simulation_educator, language_access_or_accessibility_reviewer, learner_safety_or_ai_safety_reviewer |

## Case Bank Equity Coverage Gaps

| Priority | Dimension | Target | Current | Minimum | Shortfall |
|---|---|---|---:|---:|---:|
| P0_equity_case_bank_coverage_gap | age_band | pediatric | 0 | 10 | 10 |
| P0_equity_case_bank_coverage_gap | special_population | language_access_or_interpreter_need | 0 | 10 | 10 |
| P0_equity_case_bank_coverage_gap | special_population | disability_or_communication_accommodation | 0 | 10 | 10 |

## Reviewer Output

Completed case equity reviews should be recorded in `docs/equity_case_reviews.json` using the existing review-status schema. Bias-policy probe review and case-bank coverage gaps remain additional review work; these packets do not constitute approval.
