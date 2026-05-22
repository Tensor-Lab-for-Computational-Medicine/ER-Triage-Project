# Reproducibility

This repository is organized around a static browser app plus the small set of scripts needed to recreate its bundled case data.

## Source Data

Raw MIETIC validation data is stored at:

```text
data/raw/mietic_validate_samples.csv
```

Credentialed MIMIC-IV-Ext-CDS data must stay local and ignored by git. The expected local folder name is:

```text
mimic-iv-ext-clinical-decision-support-for-referral-triage-and-diagnosis-1.0.2/
```

The public app reads the generated bundle:

```text
frontend/src/data/cases.json
```

Reviewed inferred teaching details are stored separately from the raw source:

```text
data/processed/case_augmentations.review.json
```

## Regenerate The Static Case Bundle

```powershell
pip install -r requirements.txt
python scripts/generate_static_cases.py
python scripts/validate_static_bundle.py
```

The generator keeps only retained MIETIC validation rows, emits `clinical_case_v1` records, preserves source provenance under `source`, attaches documented and missing evidence lists, and includes reviewed inferred facts when available. Draft and rejected augmentations are excluded from the browser bundle.

## Generate Draft Case Augmentations

```powershell
$env:OPENROUTER_API_KEY = "<your key>"
python scripts/augment_static_cases.py --case-id case_021
```

The augmentation command writes draft JSON to:

```text
data/processed/case_augmentations.draft.json
```

Drafts must be reviewed before use. Reviewed facts live in `data/processed/case_augmentations.review.json` with explicit `review_status`, `source_anchors`, `confidence`, and `use_in` fields. A reviewed fact can affect grading only when `use_in` includes `grading_reference`.

## Recreate The Scoring Audit

```powershell
pip install -r requirements.txt
python 2026_05_13_scoring_model_redesign/code/audit_scoring_signals.py
```

The audit output is saved at:

```text
2026_05_13_scoring_model_redesign/data/scoring_signal_audit.csv
```

## Frontend Build Check

```powershell
cd frontend
npm install
npm run build
```

The deployable artifact is `frontend/dist`, which is intentionally ignored by git.

## Restricted Data Privacy Check

Run this before generating or sharing artifacts:

```powershell
python scripts/check_restricted_data_privacy.py
```

The script fails if restricted MIMIC data, MIMIC-derived case bundles, or restricted reports are tracked or visible to git.

## Local MIMIC-IV-Ext-CDS Case Generation

The MIMIC adapter creates `clinical_case_v2` bundles for local validation only:

```powershell
python scripts/generate_mimic_restricted_cases.py --limit 50
```

The default output is ignored:

```text
data/restricted/mimic_iv_ext_cases.restricted.json
```

Use the grounding audit to classify generated diagnosis, medication, testing, treatment, disposition, and ESI claims as supported, contradicted, or unsupported:

```powershell
python scripts/audit_grounding.py --cases data/restricted/mimic_iv_ext_cases.restricted.json --outputs data/restricted/generated_outputs.restricted.json
```

The same ignored bundle can be loaded through the app's case-source banner for local research demos. The browser loader validates `clinical_case_v2`, `MIMIC-IV-Ext-CDS`, and `credentialed_local_only` before starting a restricted local case.
