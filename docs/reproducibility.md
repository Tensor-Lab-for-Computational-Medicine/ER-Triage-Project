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

## Regenerate The Static Case Bundle

```powershell
pip install -r requirements.txt
python scripts/generate_static_cases.py
python scripts/validate_static_bundle.py
```

The generator removes expert adjudication fields from the browser bundle and assigns stable public case IDs such as `case_001`.

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
