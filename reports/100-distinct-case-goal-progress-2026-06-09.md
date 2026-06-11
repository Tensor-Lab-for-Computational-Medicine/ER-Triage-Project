# 100 Distinct Case Goal Progress

Date: 2026-06-09

## Current Evidence

- Public playable cases: 23.
- Restricted local MIETIC-linked ED-enriched cases: 50.
- Restricted local MIMIC-IV-ED supplemental cases generated for this audit: 27.
- Restricted main-enriched cases: 50, but all 50 duplicate the ED-enriched restricted case IDs and are duplicate-check-only.
- Total distinct auditable case IDs now available: 100.
- Distinct-case target: 100.
- Current shortfall: 0 distinct cases.

## Problems Found And Addressed

1. Generated restricted bundles contain non-finite JSON tokens (`NaN`), so the browser upload path could reject the local case bank before learner testing. Fixed in `frontend/src/services/staticEngine.js` by sanitizing `NaN`, `Infinity`, and `-Infinity` to `null` for local JSON payloads.
2. The case-source drawer pointed learners to an unavailable/outdated restricted bundle path. Fixed in `frontend/src/components/CaseSourceControls.jsx` to reference the available MIETIC-linked restricted bundle and the new supplemental MIMIC-IV-ED restricted bundle.
3. Public learner-facing text could show corrupted temperature-unit mojibake. Fixed in `frontend/src/services/staticEngine.js` with runtime display normalization.
4. Restricted cases with partial BP data could display misleading zero-like values. Fixed the vitals formatter to show unavailable components rather than inventing `0`.
5. Restricted cases with missing or corrupted complaints could start with an invalid learner-facing chief concern. Fixed case normalization to derive a safe display complaint from the triage history.
6. The repository previously had only 73 distinct auditable cases. Added `scripts/generate_mimic_ed_supplemental_cases.py` and generated `data/restricted/mimic_iv_ed_supplemental_cases.restricted.json` with 27 pseudonymous, local-only MIMIC-IV-ED supplemental cases.
7. The runtime case-start filter still excluded one restricted case with a corrupted raw complaint before the normalization fallback could repair it. Fixed `startStaticSimulation()` so local restricted cases remain playable when a triage history can provide the safe display complaint.

## Audit Artifacts

- `reports/distinct-case-workflow-audit-2026-06-09.json`
- `reports/distinct-case-workflow-audit-2026-06-09.md`
- `scripts/generate_mimic_ed_supplemental_cases.py`
- `scripts/smoke_100_case_workflows.mjs`
- `data/restricted/mimic_iv_ed_supplemental_cases.restricted.json`
- `reports/100-case-workflow-smoke-2026-06-09.json`
- `reports/100-case-workflow-smoke-2026-06-09.md`

## Verification

- `node scripts/audit_distinct_case_workflows.mjs` completed and audited 100 distinct cases.
- Requirement check from the audit: 100 distinct cases available, 100 audited, shortfall 0, meets target true.
- `npm.cmd run build` passed from `frontend/`.
- `npx.cmd playwright test static-workflow.spec.js -g "local restricted|non-finite|mojibake|MIMIC-IV-ED supplemental"` passed: 4/4.
- `npx.cmd playwright test` passed: 71 passed, 1 skipped.
- `python scripts/check_restricted_data_privacy.py` passed using the bundled Codex Python runtime.
- `node scripts/smoke_100_case_workflows.mjs` passed: 100 workflow-smoked cases, 100 distinct case IDs, meets target true.

## Completion Status

The corrected 100-distinct-case objective is satisfied by the current case inventory and audit ledger. The build, targeted browser workflow checks, full Playwright regression suite, and restricted-data privacy check passed after the supplemental restricted bundle and loader allow-list changes.
