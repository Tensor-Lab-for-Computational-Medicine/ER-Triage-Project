# Learner-Facing Evidence Coverage Report

Generated: 2026-06-09T22:33:54.662Z

This report measures quote-backed coverage and runtime quarantine policy. It does not prove clinical truth, guideline currency, claim-level entailment, or faculty acceptance for national learner feedback.

## Summary

- Eligible quote-backed chunks: 89/2489 (3.58%)
- Generated-needs-review chunks quarantined: 2400
- Generated references returned by policy probes: 0
- Runtime retrieval probes passed: true
- Runtime generated-needs-review badges: 0
- Runtime nonclinical scope guardrail references: 0
- Runtime retrieval quality badge visible: true
- Runtime high-risk retrieval threshold passed: true
- Runtime BM25 fallback badge visible: true
- Learner-facing source freshness release ready: false
- Learner-facing quote-backed sources release-blocked: 16
- High-risk quote-depth release ready: false
- Missing high-risk topic/facet quote pairs: 0
- High-risk classification policy ready: true
- High-risk classification fallback-only probes: 0
- Claim sets meeting reference-alignment threshold: 9/10
- Claim sets missing domain-specific quote support: 1/1
- Claim-reference gap packets pending: 1/1
- Claim-reference alignment release ready: false
- High-risk topics with quote-backed coverage: 15/15
- Source-limited formative feedback rows: 69
- Claim-entailment packet report present: true
- Claim-entailment adjudication status: claim_entailment_review_inputs_pending
- Claim-entailment reviewed claims: 0/10
- Learner-facing evidence release ready: false

## High-Risk Topic Coverage

| Topic | Status | Quote-backed chunks | Generated-needs-review chunks |
|---|---|---:|---:|
| septic_shock_concern | quote_backed_subset_available | 6 | 8 |
| septic_shock_resuscitation | quote_backed_subset_available | 6 | 8 |
| chest_pain_possible_acs | quote_backed_subset_available | 5 | 8 |
| high_sensitivity_troponin_pathway | quote_backed_subset_available | 6 | 8 |
| non_st_elevation_acs | quote_backed_subset_available | 5 | 8 |
| opioid_overdose | quote_backed_subset_available | 7 | 8 |
| naloxone_response_and_recurrence | quote_backed_subset_available | 5 | 8 |
| febrile_infant_8_to_21_days | quote_backed_subset_available | 7 | 8 |
| acute_stroke_symptoms | quote_backed_subset_available | 5 | 8 |
| thrombolytic_eligibility_discussion | quote_backed_subset_available | 7 | 8 |
| ectopic_pregnancy_rupture_concern | quote_backed_subset_available | 6 | 8 |
| minor_head_injury_ct_decision | quote_backed_subset_available | 7 | 8 |
| use_of_restraints | quote_backed_subset_available | 5 | 8 |
| severe_agitation_medication_strategy | quote_backed_subset_available | 7 | 8 |
| dka_or_hhs | quote_backed_subset_available | 6 | 8 |

## Release Blockers

| Blocker | Status | Required to clear |
|---|---|---|
| runtime_retrieval_not_locked | cleared | Keep docs/open_evidence_retrieval_runtime_report.json passing so the built app proves quote-backed-only learner-facing retrieval. |
| high_risk_retrieval_quality_badge_not_ready | cleared | Keep the built grounding lab showing the high-risk retrieval quality badge, BM25 fallback state, and minimum score threshold before learner-facing use. |
| source_freshness_not_ready | blocked | Use docs/source_freshness_report.json to replace stale learner-facing sources and record local review dates before national release. |
| high_risk_quote_depth_not_ready | blocked | Use docs/high_risk_quote_coverage_depth_report.json to fill missing high-risk topic/facet quote-backed evidence before national learner feedback. |
| high_risk_classification_policy_not_ready | cleared | Use docs/high_risk_clinical_classification_report.json to keep high-risk routing topic/facet-based across cases, actions, claims, and negative controls. |
| claim_reference_alignment_not_ready | blocked | Use docs/feedback_claim_reference_alignment_report.json as reviewer input, then complete expert claim-entailment reviews before national feedback release. |
| claim_reference_gap_packets_not_clear | blocked | Use docs/claim_reference_gap_review_packets.json to close named-standard evidence gaps before learner-facing national feedback release. |
| generated_backlog_unreviewed | blocked | Replace, remove, or formally approve generated-needs-review chunks before they can become learner-facing source material. |
| claim_entailment_not_reviewed | blocked | Use docs/feedback_claim_entailment_review_packets.json, then record valid clinician and educator reviews in docs/learner_facing_claim_entailment_reviews.json and keep docs/feedback_claim_entailment_adjudication_status.json valid. |
| evidence_adjudication_not_complete | blocked | Record evidence chunk approvals in docs/evidence_chunk_adjudications.json using the clinical adjudication contract. |

## Feedback Claim Review Queue

| Domain | Scoring mode | Source-limited cases | Review need |
|---|---|---:|---|
| Final ESI accuracy | numeric | 0 | Feedback traceability rows for every current public case in this domain. Clinician or faculty reviewer attestation that the feedback claim is entailed by case facts or a clearly cited standard. Equity and learner-safety check for stereotype-sensitive or overconfident wording. Emergency clinician calibration record for scoring thresholds and unsafe omission handling. Quote-backed open evidence or clinician-approved local standard for any claim that goes beyond case-record facts. |
| Objective safety reasoning | numeric | 0 | Feedback traceability rows for every current public case in this domain. Clinician or faculty reviewer attestation that the feedback claim is entailed by case facts or a clearly cited standard. Equity and learner-safety check for stereotype-sensitive or overconfident wording. Emergency clinician calibration record for scoring thresholds and unsafe omission handling. Quote-backed open evidence or clinician-approved local standard for any claim that goes beyond case-record facts. |
| Interview coverage | numeric | 0 | Feedback traceability rows for every current public case in this domain. Clinician or faculty reviewer attestation that the feedback claim is entailed by case facts or a clearly cited standard. Equity and learner-safety check for stereotype-sensitive or overconfident wording. Emergency clinician calibration record for scoring thresholds and unsafe omission handling. Quote-backed open evidence or clinician-approved local standard for any claim that goes beyond case-record facts. |
| Focused exam selection | numeric | 0 | Feedback traceability rows for every current public case in this domain. Clinician or faculty reviewer attestation that the feedback claim is entailed by case facts or a clearly cited standard. Equity and learner-safety check for stereotype-sensitive or overconfident wording. Emergency clinician calibration record for scoring thresholds and unsafe omission handling. Quote-backed open evidence or clinician-approved local standard for any claim that goes beyond case-record facts. |
| Working diagnosis | formative_when_truth_missing | 23 | Feedback traceability rows for every current public case in this domain. Clinician or faculty reviewer attestation that the feedback claim is entailed by case facts or a clearly cited standard. Equity and learner-safety check for stereotype-sensitive or overconfident wording. Case truth adjudication resolving missing source-record diagnosis, referral, or reassessment fields before numeric use. Emergency clinician calibration record for scoring thresholds and unsafe omission handling. Quote-backed open evidence or clinician-approved local standard for any claim that goes beyond case-record facts. |
| Consult judgment | formative_when_truth_missing | 23 | Feedback traceability rows for every current public case in this domain. Clinician or faculty reviewer attestation that the feedback claim is entailed by case facts or a clearly cited standard. Equity and learner-safety check for stereotype-sensitive or overconfident wording. Case truth adjudication resolving missing source-record diagnosis, referral, or reassessment fields before numeric use. Emergency clinician calibration record for scoring thresholds and unsafe omission handling. Quote-backed open evidence or clinician-approved local standard for any claim that goes beyond case-record facts. |
| Initial management priorities | numeric | 0 | Feedback traceability rows for every current public case in this domain. Clinician or faculty reviewer attestation that the feedback claim is entailed by case facts or a clearly cited standard. Equity and learner-safety check for stereotype-sensitive or overconfident wording. Emergency clinician calibration record for scoring thresholds and unsafe omission handling. Quote-backed open evidence or clinician-approved local standard for any claim that goes beyond case-record facts. |
| Reassessment targets | formative_when_truth_missing | 23 | Feedback traceability rows for every current public case in this domain. Clinician or faculty reviewer attestation that the feedback claim is entailed by case facts or a clearly cited standard. Equity and learner-safety check for stereotype-sensitive or overconfident wording. Case truth adjudication resolving missing source-record diagnosis, referral, or reassessment fields before numeric use. Emergency clinician calibration record for scoring thresholds and unsafe omission handling. Quote-backed open evidence or clinician-approved local standard for any claim that goes beyond case-record facts. |
| SOAP note | numeric_structure_score | 0 | Feedback traceability rows for every current public case in this domain. Clinician or faculty reviewer attestation that the feedback claim is entailed by case facts or a clearly cited standard. Equity and learner-safety check for stereotype-sensitive or overconfident wording. Faculty calibration record for the rubric anchors before summative assessment use. Quote-backed open evidence or clinician-approved local standard for any claim that goes beyond case-record facts. |
| SBAR handoff | conditional_numeric_structure_score | 0 | Feedback traceability rows for every current public case in this domain. Clinician or faculty reviewer attestation that the feedback claim is entailed by case facts or a clearly cited standard. Equity and learner-safety check for stereotype-sensitive or overconfident wording. Faculty calibration record for the rubric anchors before summative assessment use. Quote-backed open evidence or clinician-approved local standard for any claim that goes beyond case-record facts. |
