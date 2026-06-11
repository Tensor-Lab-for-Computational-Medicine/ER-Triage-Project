# Feedback Claim Reference Alignment Report

Generated at: 2026-06-09T22:33:34.277Z

This report supplies deterministic quote-backed retrieval candidates for domain-level feedback claim sets. It does not prove claim entailment, clinical accuracy, faculty acceptance, or national release readiness.

## Summary

- Claim sets: 10
- Claim sets with aligned quote-backed references: 9
- Claim sets meeting minimum reference threshold: 9
- Claim sets requiring domain-specific quote support: 1
- Claim sets missing domain-specific quote support: 1
- Source-limited claim sets blocked: 3
- Generated-needs-review references returned: 0
- Claim reference alignment release ready: false

## Claim Set Alignment

| Packet | Domain | Status | Aligned refs | Domain-specific refs | Minimum met | Source-limited | Blockers |
|---|---|---|---:|---:|---|---|---|
| domain_esi_claim_entailment | esi | domain_specific_quote_support_gap_review_required | 0/2 | 0/2 | false | false | minimum_aligned_quote_backed_references_not_met, domain_specific_quote_support_gap, clinician_educator_claim_entailment_review_missing |
| domain_safety_claim_entailment | safety | candidate_quote_alignment_available_review_required | 12/2 | 0/0 | true | false | clinician_educator_claim_entailment_review_missing |
| domain_interview_claim_entailment | interview | candidate_quote_alignment_available_review_required | 12/1 | 0/0 | true | false | clinician_educator_claim_entailment_review_missing |
| domain_focused_exam_claim_entailment | focused_exam | candidate_quote_alignment_available_review_required | 12/1 | 0/0 | true | false | clinician_educator_claim_entailment_review_missing |
| domain_diagnosis_claim_entailment | diagnosis | candidate_quote_alignment_available_review_required | 10/2 | 0/0 | true | true | source_limited_truth_gap_blocks_release, clinician_educator_claim_entailment_review_missing |
| domain_referral_claim_entailment | referral | candidate_quote_alignment_available_review_required | 12/2 | 0/0 | true | true | source_limited_truth_gap_blocks_release, clinician_educator_claim_entailment_review_missing |
| domain_escalation_claim_entailment | escalation | candidate_quote_alignment_available_review_required | 11/2 | 0/0 | true | false | clinician_educator_claim_entailment_review_missing |
| domain_reassessment_claim_entailment | reassessment | candidate_quote_alignment_available_review_required | 12/2 | 0/0 | true | true | source_limited_truth_gap_blocks_release, clinician_educator_claim_entailment_review_missing |
| domain_soap_claim_entailment | soap | candidate_quote_alignment_available_review_required | 12/1 | 0/0 | true | false | clinician_educator_claim_entailment_review_missing |
| domain_sbar_claim_entailment | sbar | candidate_quote_alignment_available_review_required | 10/1 | 0/0 | true | false | clinician_educator_claim_entailment_review_missing |

## Next Actions

- Use aligned references as reviewer starting points, not as automatic proof of entailment.
- Replace generated-needs-review ESI summaries with quote-backed ESI/triage-standard evidence or record a clinician-approved local standard before ESI feedback is learner-facing at national scale.
- Add sentence-level feedback claims to the packet format so future checks can move from domain-level retrieval alignment to exact claim-level support.
- Complete clinician and educator reviews in docs/learner_facing_claim_entailment_reviews.json before national learner feedback release.
- Keep source-limited diagnosis, referral, and reassessment feedback formative-only until case truth adjudication is complete.
