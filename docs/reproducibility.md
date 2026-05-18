# Reproducibility

This repository is organized around a static browser app plus the small set of scripts needed to recreate its bundled case data.

## Source Data

Raw MIETIC validation data is stored at:

```text
data/raw/mietic_validate_samples.csv
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
