# Clinical Review Adjudication Contract

This contract defines the minimum reviewer evidence required before a case, clinical claim, or generated source chunk may be treated as national-scale learner-facing medical truth.

The current readiness artifacts intentionally remain draft. This contract gives clinician educators, emergency clinicians, and source reviewers a structured way to complete review without allowing draft AI augmentation or generated evidence to silently become scoring material.

## Required Files

Completed reviews should be added as separate files, not by editing generated queues directly:

- `docs/case_truth_adjudications.json`
- `docs/evidence_chunk_adjudications.json`

The generated status file is:

- `docs/clinical_review_adjudication_status.json`

Run the validator from `frontend` with:

```powershell
npm run readiness:adjudication
```

The validator permits missing adjudication files while review is pending. If either adjudication file exists, it must be complete and internally consistent.

## Case Truth Review

`docs/case_truth_adjudications.json` must use:

```json
{
  "schema_version": "case_truth_adjudications_v1",
  "adjudications": []
}
```

A case can be counted as reviewed only when its adjudication has:

- `status: "adjudicated_ready_for_case_truth"`
- A `case_id` matching a current public case and review packet.
- At least two distinct attested reviewers.
- Reviewer roles including `emergency_medicine_clinician` and `medical_educator`.
- No restricted source identifiers such as `subject_id`, `stay_id`, `hadm_id`, `patient_id`, `mrn`, `csn`, `encounter_id`, or raw row indexes.
- Completed clinician fields:
  - `reference_esi_confirmation`
  - `source_record_or_best_adjudicated_diagnosis`
  - `acceptable_differential_diagnoses`
  - `consult_or_referral_truth`
  - `immediate_stabilization_priorities`
  - `expected_resource_profile`
  - `objective_data_to_reveal_if_requested`
  - `reassessment_and_escalation_triggers`
  - `disposition_truth_and_rationale`
  - `unsafe_or_misleading_feedback_to_block`
  - `equity_bias_and_language_notes`
- Completed educator fields:
  - `intended_learner_level`
  - `clinical_reasoning_objectives_supported`
  - `common_error_patterns_to_teach`
  - `debrief_feedback_points`
  - `assessment_rubric_alignment`

If reviewers disagree, `disagreement_resolution.resolution_summary` must be completed before the case can be counted as reviewed.

## Evidence Chunk Review

`docs/evidence_chunk_adjudications.json` must use:

```json
{
  "schema_version": "evidence_chunk_adjudications_v1",
  "adjudications": []
}
```

An evidence chunk can be approved only when its adjudication has:

- A `chunk_id` matching a current public evidence chunk.
- `status` set to one of:
  - `approved_for_learner_feedback`
  - `approved_for_background_teaching`
  - `approved_case_specific_only`
- A retrievable `source_locator` with URL, DOI, or PMID plus a section, page, heading, table, or figure.
- Either `quote_backed_excerpt` or `clinician_approved_paraphrase`.
- `applicability_limits`.
- At least two distinct attested reviewers.
- Reviewer roles including `source_or_library_reviewer_for_locator_quality`.
- For high-risk or learner-facing approval, reviewer roles must also include `emergency_medicine_clinician`.
- No restricted source identifiers.

Generated-needs-review chunks must remain quarantined from deterministic scoring and high-risk learner-facing feedback until this review contract is satisfied.

## Readiness Effect

This contract is necessary but not sufficient for national readiness.

It helps prove:

- Case truth is clinician-adjudicated before scoring.
- Evidence chunks are quote-backed or clinician-approved before learner-facing use.
- Reviewer identity, role, scope, and attestation are recorded.
- Draft/generated material remains clearly separated from source-of-truth feedback.

It does not replace institutional privacy/security review, curriculum committee review, accessibility testing, load testing, or educational outcomes validation.
