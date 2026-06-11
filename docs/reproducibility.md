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

The generator keeps only retained MIETIC validation rows, applies the MIETIC adjudication rule, emits sanitized `public_case_v2` records, preserves source provenance under `source`, attaches documented and missing evidence lists, and includes reviewed inferred facts when available. Public records must not contain `subject_id`, `stay_id`, `hadm_id`, ICD fields, linked lab/microbiology context, raw row indexes, or source arrival/departure timestamps. Draft and rejected augmentations are excluded from the browser bundle.

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

The same ignored bundle can be loaded through the app's case-source banner for local research demos. The browser loader validates `clinical_case_v2` or `clinical_case_v3`, `MIMIC-IV-Ext-CDS`, and `credentialed_local_only` before starting a restricted local case.

## Restricted MIETIC-MIMIC Linkage

MIMIC-IV v3.1, MIMIC-IV-ED v2.2, and any optional Note/CXR/ECG modules should be downloaded outside the repository, preferably on the larger `D:` drive. This Windows environment needs a real GNU `wget.exe`; PowerShell `wget` is an alias and will not provide the same recursive behavior.

```powershell
New-Item -ItemType Directory -Force D:\physionet\mimiciv | Out-Null
wget.exe -r -N -c -np -nH --cut-dirs=2 --directory-prefix=D:\physionet\mimiciv --user age1 --ask-password https://physionet.org/files/mimiciv/3.1/
```

After credentialed data is present locally, build ignored linkage context with DuckDB:

```powershell
python scripts/link_mimic_restricted_context.py `
  --mimiciv-dir D:\physionet\mimiciv `
  --mimic-ed-dir D:\physionet\mimic-iv-ed `
  --mimic-note-dir D:\physionet\mimic-iv-note `
  --mimic-cxr-dir D:\physionet\mimic-cxr `
  --mimic-ecg-dir D:\physionet\mimic-iv-ecg
```

The linker emits `data/restricted/mietic_mimic_enriched_cases.restricted.json`. It is meant for local validation of `clinical_case_v3` enriched cases, including a per-case module availability matrix, linked ED/hospital/ICU/note/CXR/ECG context, time-gated optional objective data, and debrief-only retrospective ground truth. Missing modules are skipped with explicit availability notes. The output must not be imported by the public app.
