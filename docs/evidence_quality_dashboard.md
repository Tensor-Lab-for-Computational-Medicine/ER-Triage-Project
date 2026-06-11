# Evidence Quality Dashboard

Generated: 2026-06-09T22:33:54.996Z

This dashboard is a maintainer-facing triage view. It summarizes source coverage and review work but does not replace clinician, librarian, or institutional approval.

## At A Glance

| Signal | Current State | Release Target |
|---|---:|---:|
| Quote-backed chunks | 89/2489 (3.58%) | All learner-facing claims backed by reviewed evidence |
| Generated-needs-review chunks | 2400 (96.42%) | 0 learner-facing unresolved chunks |
| Missing locator chunks | 2400 | 0 |
| Source-link quote records requiring repair | 0 | 0 |
| Quote records without machine text match | 0 | 0 or manually verified |
| High-risk topic/facet gaps | 0 | 0 |
| Claim sets missing domain-specific quote support | 1/1 | 0 |
| Claim-reference gap packets | 1 | 0 |
| Claim-entailment reviews | 0/10 | All feedback claim sets reviewed |
| Evidence adjudication approvals | 0/2489 | All learner-facing chunks approved |
| Runtime retrieval quality badge | true | true |
| Learner-facing evidence release ready | false | true |

## High-Risk Quote Depth

Required core facets: recognition, focused_assessment, diagnostic_strategy, initial_management, disposition_reassessment

| Topic | Quote-Backed | Missing Core Facets | Release Ready |
|---|---:|---|---|

## Release Blockers

| Blocker | Status | Current | Target | Owner | Action |
|---|---|---:|---:|---|---|
| generated_backlog_unreviewed | blocked | 2400 | 0 | clinical evidence reviewer | Review, replace, remove, or formally adjudicate generated-needs-review chunks before learner-facing use. |
| source_link_quote_verification_not_ready | cleared | 0 | 0 | medical librarian and evidence engineer | Repair failed source URLs, update quote/search phrases, or record manual PDF/source-location verification for every learner-facing quote. |
| source_freshness_not_ready | blocked | 16 | 0 | medical librarian or evidence lead | Record local review dates and replace stale learner-facing quote-backed sources. |
| high_risk_quote_depth_not_ready | blocked | 0 | 0 | clinical evidence reviewer | Fill missing high-risk topic/facet quote-backed evidence for recognition, assessment, diagnostics, management, and reassessment. |
| claim_entailment_not_reviewed | blocked | 0 | 10 | emergency clinician and simulation educator | Complete claim-entailment reviews for every learner-facing feedback domain. |
| domain_specific_claim_reference_support_not_ready | blocked | 1 | 0 | clinical evidence reviewer | Add quote-backed ESI/triage-standard references or record a clinician-approved local standard before named-standard feedback is learner-facing. |
| claim_reference_gap_packets_not_clear | blocked | 1 | 0 | clinical evidence reviewer | Use claim-reference gap packets to close named-standard evidence gaps and rerun alignment before national feedback release. |
| evidence_adjudication_not_complete | blocked | 0 | 2489 | clinical evidence adjudication lead | Record approved evidence chunks in the adjudication file before national release. |

## Reviewer Queue

- Pending generated or unverified chunks: 2400
- Pending source count: 94
- Pending review batches: 944
- Claim reference-alignment sets: 10
- Claim reference-alignment domain-specific gaps: 1
- Claim reference-gap packets: 1
- Claim reference-gap generated candidates: 160
- Valid claim-entailment reviews: 0

## Next Actions

- Use docs/evidence_review_backlog.json to prioritize generated-needs-review chunks for replacement or formal review.
- Use docs/source_link_quote_verification_report.json to repair failed URLs, unmatched quote/search phrases, and PDF-only quote verification gaps.
- Use docs/high_risk_quote_coverage_depth_report.json to fill missing core facets for high-risk ED topics.
- Use docs/feedback_claim_reference_alignment_report.json to close named-standard quote support gaps such as ESI before learner-facing release.
- Use docs/claim_reference_gap_review_packets.json to assign evidence acquisition work for named-standard feedback gaps.
- Use docs/source_freshness_report.json to record local review dates and replace stale learner-facing sources.
- Use docs/feedback_claim_entailment_review_packets.json to assign clinical and simulation educator claim review.
- Keep docs/open_evidence_retrieval_runtime_report.json passing so learner-facing retrieval remains quote-backed and visibly quality-badged.
