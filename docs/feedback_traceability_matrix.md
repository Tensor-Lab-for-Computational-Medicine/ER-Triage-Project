# Feedback Traceability Matrix

Generated at: 2026-06-09T22:33:33.410Z

Readiness status: draft_feedback_traceability_requires_clinician_educator_review

This matrix audits whether deterministic learner-facing feedback domains are tied to case source fields, clinician-adjudicated truth, evidence review, or formative-only source-limited logic.

## Summary

- Cases: 23
- Domain rows: 230
- Source-limited formative rows: 69
- Numeric rows missing required case evidence: 0
- Cases with source-limited diagnosis: 23
- Cases with source-limited consult/referral: 23
- Cases with source-limited reassessment: 23
- Case truth adjudications ready: 0

## Domain Coverage

| Domain | Mode | Missing Evidence Cases | Source-Limited Formative Cases | Review Need |
|---|---:|---:|---:|---|
| Final ESI accuracy | numeric | 0 | 0 | Clinician confirmation that the retained reference ESI and source-derived resource signals remain appropriate for learner scoring. |
| Objective safety reasoning | numeric | 0 | 0 | Clinician calibration of vital-sign threshold messaging, pain/distress interpretation, and risk escalation language. |
| Interview coverage | numeric | 0 | 0 | Educator review of expected question domains for each complaint and learner level. |
| Focused exam selection | numeric | 0 | 0 | Case-level exam truth and faculty calibration of expected focused exam systems. |
| Working diagnosis | formative_when_truth_missing | 23 | 23 | Clinician-adjudicated diagnosis and acceptable differential diagnoses before any numeric diagnosis score. |
| Consult judgment | formative_when_truth_missing | 23 | 23 | Clinician-approved consult/referral truth and urgency criteria before any numeric consult score. |
| Initial management priorities | numeric | 0 | 0 | Emergency clinician review of immediate stabilization priorities, unsafe omissions, and local-practice variation. |
| Reassessment targets | formative_when_truth_missing | 23 | 23 | Clinician validation of required reassessment triggers and course-correction thresholds. |
| SOAP note | numeric_structure_score | 0 | 0 | Faculty calibration of note-quality anchors, minimum evidence use, and documentation expectations. |
| SBAR handoff | conditional_numeric_structure_score | 0 | 0 | Simulation educator review of handoff triggers, expected receiver, and handoff quality anchors. |

## Required Next Action

Complete `docs/case_truth_adjudications.json` and `docs/evidence_chunk_adjudications.json` under the clinical review adjudication contract before promoting source-limited domains or generated evidence to national-scale learner-facing scoring.
