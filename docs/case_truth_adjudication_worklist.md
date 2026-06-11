# Case Truth Adjudication Worklist

Generated: 2026-06-09T22:33:31.832Z

This worklist creates reviewer starter objects only. It does not approve cases, change scoring truth, or replace emergency clinician and medical educator adjudication.

## Summary

- Work items: 23
- Current public cases: 23
- Ready case-truth adjudications: 0
- Pending case-truth adjudications: 23
- High-priority P1/P2 work items: 13
- Source/narrative age mismatch work items: 14
- Source ESI reviewer disagreement work items: 6
- Total release blockers: 158
- All current cases have a work item: true
- Starter adjudications included in JSON: true
- Ready for national case-truth release from worklist: false

## Review Worklist

| Priority | Case | Complaint | ESI | Review state | Missing truth fields | Source limits | Reveal scaffolds | Risk flags | Blockers |
|---|---|---|---:|---|---:|---:|---:|---:|---:|
| P1_resuscitation_or_time_critical_truth_review | case_005 | Fever / limb infection concern | 2 | pending_clinician_educator_adjudication | 4 | 2 | 2 | 7 | 8 |
| P1_resuscitation_or_time_critical_truth_review | case_007 | Fever, Pneumonia, Transfer | 1 | pending_clinician_educator_adjudication | 4 | 2 | 2 | 5 | 6 |
| P1_resuscitation_or_time_critical_truth_review | case_008 | Dyspnea, Pedal edema | 3 | pending_clinician_educator_adjudication | 4 | 2 | 2 | 5 | 8 |
| P1_resuscitation_or_time_critical_truth_review | case_017 | N/V, Weakness | 2 | pending_clinician_educator_adjudication | 4 | 2 | 2 | 7 | 8 |
| P1_resuscitation_or_time_critical_truth_review | case_022 | Abd pain, Abdominal distention | 2 | pending_clinician_educator_adjudication | 4 | 2 | 2 | 6 | 7 |
| P1_resuscitation_or_time_critical_truth_review | case_025 | Abd pain, Transfer | 1 | pending_clinician_educator_adjudication | 4 | 3 | 3 | 5 | 6 |
| P1_resuscitation_or_time_critical_truth_review | case_031 | ABDOMINAL PAIN | 2 | pending_clinician_educator_adjudication | 4 | 2 | 2 | 6 | 8 |
| P2_high_risk_truth_review | case_002 | Chest pain, Dyspnea | 2 | pending_clinician_educator_adjudication | 4 | 2 | 2 | 5 | 7 |
| P2_high_risk_truth_review | case_004 | Difficulty swallowing, Transfer | 2 | pending_clinician_educator_adjudication | 4 | 4 | 4 | 3 | 6 |
| P2_high_risk_truth_review | case_006 | Chest pain | 2 | pending_clinician_educator_adjudication | 4 | 3 | 3 | 4 | 7 |
| P2_high_risk_truth_review | case_013 | ALTERED LEVEL OF CONSCIOUSNESS | 2 | pending_clinician_educator_adjudication | 4 | 2 | 2 | 5 | 7 |
| P2_high_risk_truth_review | case_023 | Abd pain, Vomiting, Nausea, Dyspnea | 2 | pending_clinician_educator_adjudication | 4 | 1 | 1 | 5 | 7 |
| P2_high_risk_truth_review | case_029 | L Leg injury, Transfer | 2 | pending_clinician_educator_adjudication | 4 | 3 | 3 | 5 | 7 |
| P3_resource_prediction_truth_review | case_009 | RECTAL ABSCESS | 3 | pending_clinician_educator_adjudication | 4 | 1 | 1 | 3 | 7 |
| P3_resource_prediction_truth_review | case_012 | Lower abdominal pain | 3 | pending_clinician_educator_adjudication | 4 | 3 | 3 |  | 6 |
| P3_resource_prediction_truth_review | case_014 | Acute Pelvic pain | 3 | pending_clinician_educator_adjudication | 4 | 3 | 3 | 1 | 7 |
| P3_resource_prediction_truth_review | case_021 | R Foot swelling | 3 | pending_clinician_educator_adjudication | 4 | 5 | 5 | 2 | 7 |
| P4_lower_acuity_truth_review | case_018 | Finger laceration | 4 | pending_clinician_educator_adjudication | 4 | 5 | 5 | 1 | 6 |
| P4_lower_acuity_truth_review | case_019 | Finger laceration | 4 | pending_clinician_educator_adjudication | 4 | 4 | 4 | 2 | 7 |
| P4_lower_acuity_truth_review | case_020 | R Wrist pain | 4 | pending_clinician_educator_adjudication | 4 | 5 | 5 | 1 | 6 |
| P4_lower_acuity_truth_review | case_024 | Suture removal | 5 | pending_clinician_educator_adjudication | 4 | 2 | 2 | 1 | 7 |
| P4_lower_acuity_truth_review | case_027 | Med refill | 5 | pending_clinician_educator_adjudication | 4 | 2 | 2 |  | 6 |
| P4_lower_acuity_truth_review | case_030 | R Foot pain | 4 | pending_clinician_educator_adjudication | 4 | 4 | 4 | 1 | 7 |

## Reviewer Use

- Copy each `starter_adjudication` object from the JSON into `docs/case_truth_adjudications.json` only after reviewers replace placeholders with completed review findings.
- Keep status as `pending_clinician_educator_adjudication` until all required clinician and educator fields are completed.
- Change status to `adjudicated_ready_for_case_truth` only after both reviewer attestations, disagreement resolution when applicable, and release attestation are complete.
- Do not include restricted source identifiers in completed adjudications.
