# Open Evidence Retrieval Runtime Report

Generated at: 2026-06-09T22:33:42.370Z

This runtime report exercises the production build in Chromium. It verifies learner-facing retrieval quarantine behavior, but it does not replace clinician, librarian, or claim-entailment review.

## Summary

- Probes passed: 10/10
- Quote-backed-only default enabled: true
- Runtime retrieval reference cards: 5
- Generated-needs-review badges rendered: 0
- Retrieval quality badge visible: true
- High-risk minimum retrieval score: 0.08
- High-risk retrieval quality threshold passed: true
- BM25 fallback badge visible: true
- Grounding smoke checks: 9/9
- Nonclinical scope guardrail references: 0
- Nonclinical scope guardrail warning visible: true

## Probes

| Probe | Status |
|---|---|
| quote_backed_only_enabled_by_default | pass |
| grounding_lab_exposes_public_source_modes | pass |
| runtime_retrieval_returns_quote_backed_references | pass |
| generated_backlog_quarantine_warning_visible | pass |
| retrieval_quality_badge_visible | pass |
| high_risk_retrieval_quality_threshold_visible | pass |
| bm25_fallback_badged_when_semantic_not_warmed | pass |
| high_risk_grounding_smoke_set_all_pass | pass |
| smoke_set_no_generated_or_needs_review_labels | pass |
| nonclinical_retrieval_scope_guardrail_blocks_clinical_references | pass |
