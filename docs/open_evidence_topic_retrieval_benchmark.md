# Open Evidence Topic Retrieval Benchmark

Generated: 2026-06-09T22:33:54.339Z

This benchmark verifies public quote-backed retrieval coverage for high-risk topics and negative controls. It does not prove claim-level entailment, guideline currency, or clinician approval.

## Summary

- Probes passed: 17/17
- High-risk topics represented: 15/15
- Generated-needs-review references returned: 0
- Negative controls returning references: 0

## Topic Probes

| Topic | Status | References | Expected Topic References | Top Match | Generated Returned | Quarantined Candidates |
|---|---|---:|---:|---|---:|---:|
| septic_shock_concern | pass | 5 | 4 | true | 0 | 8 |
| septic_shock_resuscitation | pass | 5 | 4 | true | 0 | 8 |
| chest_pain_possible_acs | pass | 5 | 2 | true | 0 | 8 |
| high_sensitivity_troponin_pathway | pass | 5 | 4 | true | 0 | 8 |
| non_st_elevation_acs | pass | 5 | 5 | true | 0 | 8 |
| opioid_overdose | pass | 5 | 2 | true | 0 | 8 |
| naloxone_response_and_recurrence | pass | 5 | 4 | true | 0 | 8 |
| febrile_infant_8_to_21_days | pass | 5 | 5 | true | 0 | 8 |
| acute_stroke_symptoms | pass | 5 | 2 | true | 0 | 8 |
| thrombolytic_eligibility_discussion | pass | 5 | 5 | true | 0 | 8 |
| ectopic_pregnancy_rupture_concern | pass | 5 | 5 | true | 0 | 8 |
| minor_head_injury_ct_decision | pass | 5 | 5 | true | 0 | 8 |
| use_of_restraints | pass | 5 | 4 | true | 0 | 8 |
| severe_agitation_medication_strategy | pass | 5 | 5 | true | 0 | 8 |
| dka_or_hhs | pass | 5 | 5 | true | 0 | 8 |

## Negative Controls

| Probe | Status | References Returned |
|---|---|---:|
| negative_nonclinical_campus_parking | pass | 0 |
| negative_administrative_scheduling | pass | 0 |
