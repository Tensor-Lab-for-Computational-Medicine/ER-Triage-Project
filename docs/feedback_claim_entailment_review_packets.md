# Feedback Claim Entailment Review Packets

Generated: 2026-06-09T22:33:33.675Z

These packets organize claim-review work. They do not constitute clinical approval, national release approval, or proof that feedback improves learner performance.

## Summary

- Claim sets: 10
- Case-domain rows covered: 230
- Source-limited claim sets: 3
- Reviewed claim sets: 0/10
- National-release ready claim sets: 0
- Ready for national feedback release: false

## Packet Queue

| Packet | Domain | Type | Current status | Reviewer roles |
|---|---|---|---|---|
| domain_esi_claim_entailment | Final ESI accuracy | case_grounded_numeric_feedback_claim_set | case_grounded_pending_clinician_educator_calibration | simulation_educator, emergency_clinician |
| domain_safety_claim_entailment | Objective safety reasoning | case_grounded_numeric_feedback_claim_set | case_grounded_pending_clinician_educator_calibration | simulation_educator, emergency_clinician |
| domain_interview_claim_entailment | Interview coverage | case_grounded_numeric_feedback_claim_set | case_grounded_pending_clinician_educator_calibration | simulation_educator, clinical_skills_faculty |
| domain_focused_exam_claim_entailment | Focused exam selection | case_grounded_numeric_feedback_claim_set | case_grounded_pending_clinician_educator_calibration | simulation_educator, emergency_clinician |
| domain_diagnosis_claim_entailment | Working diagnosis | source_limited_formative_claim_set | blocked_truth_unavailable_formative_only | simulation_educator, emergency_clinician, medical_librarian_or_evidence_reviewer |
| domain_referral_claim_entailment | Consult judgment | source_limited_formative_claim_set | blocked_truth_unavailable_formative_only | simulation_educator, emergency_clinician, medical_librarian_or_evidence_reviewer |
| domain_escalation_claim_entailment | Initial management priorities | case_grounded_numeric_feedback_claim_set | case_grounded_pending_clinician_educator_calibration | simulation_educator, emergency_clinician, medical_librarian_or_evidence_reviewer |
| domain_reassessment_claim_entailment | Reassessment targets | source_limited_formative_claim_set | blocked_truth_unavailable_formative_only | simulation_educator, emergency_clinician, medical_librarian_or_evidence_reviewer |
| domain_soap_claim_entailment | SOAP note | rubric_grounded_documentation_claim_set | rubric_grounded_pending_faculty_calibration | simulation_educator, clinical_skills_faculty |
| domain_sbar_claim_entailment | SBAR handoff | rubric_grounded_documentation_claim_set | rubric_grounded_pending_faculty_calibration | simulation_educator, clinical_skills_faculty |

## Reviewer Output File

Completed reviews should be recorded in `docs/learner_facing_claim_entailment_reviews.json` using the `review_submission_template` in the JSON artifact. Do not mark a claim set ready for national release unless the reviewer evidence is complete and source-limited case truth gaps are closed.
