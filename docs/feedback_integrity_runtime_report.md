# Feedback Integrity Runtime Report

Generated at: 2026-06-09T22:33:37.202Z

This runtime report exercises the production build in Chromium. It verifies deterministic feedback isolation and source-limited labels, but it does not replace clinician review of the feedback content.

## Summary

- Probes passed: 7/7
- OpenRouter calls before optional AI request: 0
- Source-limited domains rendered formative-only: true
- Optional AI draft kept separate: true

## Probes

| Probe | Status |
|---|---|
| no_ai_debrief_auto_request | pass |
| source_limited_diagnosis_runtime_label | pass |
| source_limited_consult_runtime_label | pass |
| source_limited_domains_marked_formative | pass |
| deterministic_score_ledger_present | pass |
| optional_ai_draft_separate_surface | pass |
| source_limited_reassessment_runtime_label | pass |
