# Distinct Case Workflow Audit

Generated: 2026-06-10T01:25:21.166Z

## Requirement Check

- Target distinct cases: 100
- Distinct cases available: 100
- Distinct cases audited: 100
- Shortfall: 0
- Meets target: true

## Source Findings

- public_demo: 23 cases, 0 non-finite JSON tokens, duplicate-check-only=false.
- restricted_main_ed: 50 cases, 115 non-finite JSON tokens, duplicate-check-only=false.
- restricted_ed_supplemental: 27 cases, 0 non-finite JSON tokens, duplicate-check-only=false.
- restricted_main_duplicate_check: 50 cases, 115 non-finite JSON tokens, duplicate-check-only=true.
- Duplicate case IDs across sources: 50

## Fixes Applied From This Audit Pass

- Local restricted bundle loading now sanitizes generated `NaN`, `Infinity`, and `-Infinity` tokens to `null` before validation.
- Local case bundle upload copy now points to `data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json`, the bundle actually present in this workspace.
- Local restricted bundle loading now accepts the generated MIMIC-IV-ED supplemental bundle used to complete the 100 distinct case audit.
- Runtime learner-display normalization now removes known corrupted temperature-unit artifacts.
- Runtime case normalization now derives a safe display complaint when a restricted source complaint is missing or corrupted.
- Runtime vital display now shows unavailable BP components instead of inventing zero-like values.

## Per-Case Ledger

| # | Case ID | Source | ESI | Issues / Peculiarities | Fix Applied |
|---:|---|---|---:|---|---|
| 1 | case_002 | public_demo | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 2 | case_004 | public_demo | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 3 | case_005 | public_demo | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 4 | case_006 | public_demo | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 5 | case_007 | public_demo | 1 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 6 | case_008 | public_demo | 3 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 7 | case_009 | public_demo | 3 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 8 | case_012 | public_demo | 3 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 9 | case_013 | public_demo | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 10 | case_014 | public_demo | 3 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 11 | case_017 | public_demo | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 12 | case_018 | public_demo | 4 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 13 | case_019 | public_demo | 4 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 14 | case_020 | public_demo | 4 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 15 | case_021 | public_demo | 3 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 16 | case_022 | public_demo | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 17 | case_023 | public_demo | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 18 | case_024 | public_demo | 5 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 19 | case_025 | public_demo | 1 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 20 | case_027 | public_demo | 5 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 21 | case_029 | public_demo | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 22 | case_030 | public_demo | 4 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 23 | case_031 | public_demo | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 24 | restricted_mietic_validate_public_001 | restricted_main_ed | 1 | Structured vitals incomplete: temp.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 25 | restricted_mietic_validate_public_002 | restricted_main_ed | 2 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 26 | restricted_mietic_validate_public_003 | restricted_main_ed | 2 | Structured vitals incomplete: dbp.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 27 | restricted_mietic_validate_public_004 | restricted_main_ed | 1 | Structured vitals incomplete: temp, hr, rr, o2, sbp, dbp, pain.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 28 | restricted_mietic_validate_public_005 | restricted_main_ed | 1 | Structured vitals incomplete: temp, hr, rr, o2, sbp, dbp, pain.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 29 | restricted_mietic_validate_public_006 | restricted_main_ed | 2 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 30 | restricted_mietic_validate_public_007 | restricted_main_ed | 1 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 31 | restricted_mietic_validate_public_008 | restricted_main_ed | 1 | Structured vitals incomplete: temp, hr, rr, o2, sbp, dbp, pain.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 32 | restricted_mietic_validate_public_009 | restricted_main_ed | 2 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 33 | restricted_mietic_validate_public_010 | restricted_main_ed | 2 | Learner-facing complaint is missing or invalid.<br>Duplicate case id appears in 2 source bundles. | Runtime case normalization now derives a safe display complaint from the triage history when the source complaint is missing or corrupted. |
| 34 | restricted_mietic_validate_public_011 | restricted_main_ed | 2 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 35 | restricted_mietic_validate_public_012 | restricted_main_ed | 1 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 36 | restricted_mietic_validate_public_013 | restricted_main_ed | 1 | Structured vitals incomplete: temp, rr.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 37 | restricted_mietic_validate_public_014 | restricted_main_ed | 1 | Structured vitals incomplete: temp.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 38 | restricted_mietic_validate_public_015 | restricted_main_ed | 3 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 39 | restricted_mietic_validate_public_016 | restricted_main_ed | 3 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 40 | restricted_mietic_validate_public_017 | restricted_main_ed | 3 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 41 | restricted_mietic_validate_public_018 | restricted_main_ed | 1 | Structured vitals incomplete: temp, hr, rr, o2, sbp, dbp, pain.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 42 | restricted_mietic_validate_public_019 | restricted_main_ed | 1 | Structured vitals incomplete: temp, hr, rr, o2, sbp, dbp, pain.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 43 | restricted_mietic_validate_public_020 | restricted_main_ed | 1 | Structured vitals incomplete: temp, hr, o2, sbp, dbp, pain.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 44 | restricted_mietic_validate_public_021 | restricted_main_ed | 1 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 45 | restricted_mietic_validate_public_022 | restricted_main_ed | 3 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 46 | restricted_mietic_validate_public_023 | restricted_main_ed | 2 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 47 | restricted_mietic_validate_public_024 | restricted_main_ed | 3 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 48 | restricted_mietic_validate_public_025 | restricted_main_ed | 2 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 49 | restricted_mietic_validate_public_026 | restricted_main_ed | 1 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 50 | restricted_mietic_validate_public_027 | restricted_main_ed | 1 | Structured vitals incomplete: temp, hr, rr, o2, sbp, dbp, pain.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 51 | restricted_mietic_validate_public_028 | restricted_main_ed | 1 | Structured vitals incomplete: temp, rr, o2, pain.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 52 | restricted_mietic_validate_public_029 | restricted_main_ed | 2 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 53 | restricted_mietic_validate_public_030 | restricted_main_ed | 4 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 54 | restricted_mietic_validate_public_031 | restricted_main_ed | 1 | Structured vitals incomplete: temp, hr, rr, o2, sbp, dbp, pain.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 55 | restricted_mietic_validate_public_032 | restricted_main_ed | 4 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 56 | restricted_mietic_validate_public_033 | restricted_main_ed | 1 | Structured vitals incomplete: temp, hr, rr, o2, sbp, dbp, pain.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 57 | restricted_mietic_validate_public_034 | restricted_main_ed | 1 | Structured vitals incomplete: temp, hr, rr, o2, sbp, dbp, pain.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 58 | restricted_mietic_validate_public_035 | restricted_main_ed | 4 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 59 | restricted_mietic_validate_public_036 | restricted_main_ed | 3 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 60 | restricted_mietic_validate_public_037 | restricted_main_ed | 1 | Structured vitals incomplete: temp, hr, rr, o2, sbp, dbp, pain.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 61 | restricted_mietic_validate_public_038 | restricted_main_ed | 1 | Structured vitals incomplete: temp, hr, rr, o2, sbp, dbp.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 62 | restricted_mietic_validate_public_039 | restricted_main_ed | 2 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 63 | restricted_mietic_validate_public_040 | restricted_main_ed | 2 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 64 | restricted_mietic_validate_public_041 | restricted_main_ed | 5 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 65 | restricted_mietic_validate_public_042 | restricted_main_ed | 4 | Structured vitals incomplete: rr.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 66 | restricted_mietic_validate_public_043 | restricted_main_ed | 1 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 67 | restricted_mietic_validate_public_044 | restricted_main_ed | 2 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 68 | restricted_mietic_validate_public_045 | restricted_main_ed | 1 | Structured vitals incomplete: temp, sbp, dbp.<br>Duplicate case id appears in 2 source bundles. | Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components. |
| 69 | restricted_mietic_validate_public_046 | restricted_main_ed | 5 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 70 | restricted_mietic_validate_public_047 | restricted_main_ed | 3 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 71 | restricted_mietic_validate_public_048 | restricted_main_ed | 2 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 72 | restricted_mietic_validate_public_049 | restricted_main_ed | 4 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 73 | restricted_mietic_validate_public_050 | restricted_main_ed | 2 | Duplicate case id appears in 2 source bundles.<br>No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 74 | restricted_ed_supplemental_001 | restricted_ed_supplemental | 1 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 75 | restricted_ed_supplemental_002 | restricted_ed_supplemental | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 76 | restricted_ed_supplemental_003 | restricted_ed_supplemental | 3 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 77 | restricted_ed_supplemental_004 | restricted_ed_supplemental | 4 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 78 | restricted_ed_supplemental_005 | restricted_ed_supplemental | 5 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 79 | restricted_ed_supplemental_006 | restricted_ed_supplemental | 1 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 80 | restricted_ed_supplemental_007 | restricted_ed_supplemental | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 81 | restricted_ed_supplemental_008 | restricted_ed_supplemental | 3 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 82 | restricted_ed_supplemental_009 | restricted_ed_supplemental | 4 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 83 | restricted_ed_supplemental_010 | restricted_ed_supplemental | 5 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 84 | restricted_ed_supplemental_011 | restricted_ed_supplemental | 1 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 85 | restricted_ed_supplemental_012 | restricted_ed_supplemental | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 86 | restricted_ed_supplemental_013 | restricted_ed_supplemental | 3 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 87 | restricted_ed_supplemental_014 | restricted_ed_supplemental | 4 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 88 | restricted_ed_supplemental_015 | restricted_ed_supplemental | 5 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 89 | restricted_ed_supplemental_016 | restricted_ed_supplemental | 1 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 90 | restricted_ed_supplemental_017 | restricted_ed_supplemental | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 91 | restricted_ed_supplemental_018 | restricted_ed_supplemental | 3 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 92 | restricted_ed_supplemental_019 | restricted_ed_supplemental | 4 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 93 | restricted_ed_supplemental_020 | restricted_ed_supplemental | 5 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 94 | restricted_ed_supplemental_021 | restricted_ed_supplemental | 1 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 95 | restricted_ed_supplemental_022 | restricted_ed_supplemental | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 96 | restricted_ed_supplemental_023 | restricted_ed_supplemental | 3 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 97 | restricted_ed_supplemental_024 | restricted_ed_supplemental | 4 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 98 | restricted_ed_supplemental_025 | restricted_ed_supplemental | 5 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 99 | restricted_ed_supplemental_026 | restricted_ed_supplemental | 1 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |
| 100 | restricted_ed_supplemental_027 | restricted_ed_supplemental | 2 | No case-specific defect found by automated structural workflow audit. | None needed or not fixable from available source data. |

## Completion Status

The repository contains at least 100 distinct auditable cases.
