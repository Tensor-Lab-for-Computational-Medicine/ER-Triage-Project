# Educational Outcomes Runtime Report

Generated at: 2026-06-09T22:33:58.916Z

Review status: runtime_outcome_instrumentation_probe_complete_needs_pilot_validation

This report proves the deterministic metrics service can generate a bounded, privacy-safe pilot export from completed feedback-shaped objects. It does not prove educational efficacy or hospital-performance transfer.

## Summary

- Probes passed: 7/7
- Export rows: 3
- High-risk undertriage rows: 1
- Source-limited feedback rows: 3
- Disallowed export keys: 0
- Direct identifier values: 0

## Probe Results

| Probe | Passed |
|---|---:|
| metrics_extract_three_fixture_rows | true |
| high_risk_undertriage_detected | true |
| lower_acuity_overtriage_detected | true |
| source_limited_feedback_exposure_detected | true |
| optional_ai_never_used_for_scoring | true |
| privacy_export_excludes_disallowed_keys | true |
| privacy_export_excludes_direct_identifier_values | true |

## Required Next Actions

- Run the same export against real pilot sessions only after privacy/governance approval.
- Add faculty-reviewed rationale-quality and response-process ratings before making clinical-judgment improvement claims.
- Compare privacy-safe simulator metrics with held-out case performance, OSCE or simulation-lab performance, and delayed retention measures.
- Keep source-limited feedback exposure in every cohort report so formative-only domains are not mistaken for validated summative scores.
