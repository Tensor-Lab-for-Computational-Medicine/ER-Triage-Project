# Source Freshness Report

Generated at: 2026-06-09T22:33:52.840Z
As of: 2026-06-09

This report checks source metadata age, local review-date presence, and refresh policy conformance. It does not prove that a source is the latest guideline or that the quoted claim is clinically correct.

## Summary

- Sources: 109
- Sources with publication year: 109
- Missing publication year sources: 0
- Stale sources: 13
- Refresh due now sources: 11
- Missing local review-date sources: 109
- Learner-facing quote-backed sources: 16
- Learner-facing quote-backed sources release-blocked: 16
- Stale learner-facing quote-backed sources: 0
- Learner-facing source freshness release ready: false

## Policy

| Source tier | Max age years | Warning age years | Local review interval months |
|---|---:|---:|---:|
| ed_specific_guideline | 5 | 4 | 12 |
| society_guideline | 5 | 4 | 12 |
| systematic_review | 5 | 4 | 18 |
| primary_study | 7 | 6 | 24 |
| textbook | 5 | 4 | 12 |
| local_teaching_note | 1 | 1 | 6 |
| unknown | 5 | 4 | 12 |

## Learner-Facing Quote-Backed Sources

| Source | Status | Age | Quote-backed chunks | High-risk quote-backed chunks | Issue |
|---|---|---:|---:|---:|---|
| 2021 AHA/ACC Chest Pain Guideline Slide Set | refresh_due_now | 5 | 16 | 16 | missing_local_review_date |
| Evaluation and Management of Well-Appearing Febrile Infants 8 to 60 Days Old | refresh_due_now | 5 | 7 | 7 | missing_local_review_date |
| Common Diagnosis Methods | local_review_date_missing | 3 | 2 | 2 | missing_local_review_date |
| Severe Agitation | local_review_date_missing | 3 | 12 | 12 | missing_local_review_date |
| What to Do If You Think Someone Is Overdosing | local_review_date_missing | 2 | 8 | 8 | missing_local_review_date |
| Hyperglycemic Crises in Adults With Diabetes | local_review_date_missing | 2 | 5 | 5 | missing_local_review_date |
| Symptoms of Mild TBI and Concussion | local_review_date_missing | 1 | 1 | 1 | missing_local_review_date |
| Managing Return to Activities | local_review_date_missing | 1 | 1 | 1 | missing_local_review_date |
| Opioid Overdose Reversal Medications | local_review_date_missing | 1 | 4 | 4 | missing_local_review_date |
| Hyperglycemic crises in adults: A look at the 2024 consensus report | local_review_date_missing | 1 | 1 | 1 | missing_local_review_date |
| Stroke Symptoms and Warning Signs | local_review_date_missing | 0 | 5 | 5 | missing_local_review_date |
| Quick Stroke Treatment Can Save Lives | local_review_date_missing | 0 | 5 | 5 | missing_local_review_date |
| Surviving Sepsis Campaign Adult Guidelines | local_review_date_missing | 0 | 9 | 9 | missing_local_review_date |
| Surviving Sepsis Campaign Adult Recommendations | local_review_date_missing | 0 | 2 | 2 | missing_local_review_date |
| ACR Appropriateness Criteria: Head Trauma | local_review_date_missing | 0 | 5 | 5 | missing_local_review_date |
| Ectopic Pregnancy | local_review_date_missing | 0 | 6 | 6 | missing_local_review_date |

## Next Actions

- Add last_local_reviewed_at after clinician/librarian review of each source used for learner-facing feedback.
- Replace or re-review stale learner-facing sources before national release.
- Verify whether broad source indexes still point to the newest guideline version before using them for summative learner feedback.
- Keep this report in the readiness chain so source-age regressions are visible before deployment.
