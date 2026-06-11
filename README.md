# ED Clinical Workflow Simulator

ED Clinical Workflow Simulator is a static emergency department simulation application built with React and Vite. The current public demo uses ED triage as a constrained, high-acuity entry point for practicing clinical workflow reasoning. The default learning workflow runs entirely in the browser, so public deployment does not require a backend server, hosted API key, environment variables, or paid AI service.

## What The App Does

Learners work through an ED case using the public demo bundle by default, or a credentialed local MIMIC-IV-Ext-CDS bundle when loaded in research mode:

1. Focused patient interview
2. Neutral vital-sign review and focused exam unlocks
3. Final ESI assignment with rationale
4. Working diagnosis and differential
5. Priority action plan and consult decision
6. What-if reassessment
7. SOAP note, with SBAR only when consult/escalation/handoff is selected
8. Simulation debrief

Scoring is deterministic and runs in the browser. The debrief compares learner decisions with case-grounded ESI, vital-sign, diagnosis, consult, resource, outcome, intervention, reassessment, SOAP, and reviewed clinical-evidence signals when those signals exist. Diagnosis, consult, and management text is labeled as source record, reviewed teaching inference, or LLM draft awaiting validation. Free-text reasoning receives local rubric feedback by default, with optional OpenRouter critique when a learner saves a browser-local key.

## Public Runtime

- Static React/Vite app in `frontend/`
- Static case bundle at `frontend/src/data/cases.json`
- Browser-side scoring engine at `frontend/src/services/staticEngine.js`
- Optional OpenRouter patient responses and debrief tutor
- Default tutor model: `openrouter/free`

The OpenRouter tutor is disabled until a learner enters a key. The key is stored in browser storage on that device and is sent directly from the learner's browser to OpenRouter.

## Repository Layout

```text
.
|-- .github/workflows/          # GitHub Pages deployment workflow
|-- 2026_05_13_scoring_model_redesign/
|   |-- README.md               # Scoring-model design note
|   |-- code/                   # Reproducible scoring audit
|   `-- data/                   # Scoring audit output
|-- data/raw/                   # Raw MIETIC validation CSV used to build the static bundle
|-- data/restricted/            # Ignored local-only credentialed data derivatives
|-- data/processed/             # Reviewed case-augmentation artifacts
|-- docs/                       # Deployment and reproducibility notes
|-- frontend/                   # Static React/Vite app
`-- scripts/                    # Data-bundle generation and validation scripts
```

## Local Development

Node.js 18 or newer is recommended for the optional browser embedding model and Playwright tests.

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal. The usual local URL is `http://127.0.0.1:5173/`.

## Production Build

```powershell
cd frontend
npm run build
npm run preview
```

The deployable artifact is `frontend/dist`, which is ignored by git.

Preview health check:

```powershell
curl.exe -i http://127.0.0.1:4173/
```

## Tests

The browser workflow tests use Playwright and require Node.js 18 or newer.

```powershell
cd frontend
npm test
```

The test suite builds the static app, starts a local Vite preview server, completes the no-key triage workflow, verifies local rubric feedback on the debrief, and confirms that no OpenRouter calls occur in static mode.

## Reproduce The Static Case Bundle

```powershell
pip install -r requirements.txt
python scripts/generate_static_cases.py
python scripts/validate_static_bundle.py
```

The generator reads `data/raw/mietic_validate_samples.csv`, applies the MIETIC expert adjudication rule, strips MIMIC identifiers, emits sanitized `public_case_v2` records, applies reviewed augmentation facts from `data/processed/case_augmentations.review.json`, and writes `frontend/src/data/cases.json`.

Draft AI augmentations are generated offline and reviewed before they become playable:

```powershell
$env:OPENROUTER_API_KEY = "<your key>"
python scripts/augment_static_cases.py --case-id case_021
```

The draft output is written to `data/processed/case_augmentations.draft.json`. Reviewed facts are promoted into `data/processed/case_augmentations.review.json`; draft and rejected augmentations do not ship in the learner bundle.

## Restricted MIMIC-IV-Ext-CDS Workflow

Credentialed MIMIC-IV-Ext-CDS source data and derived cases must remain local. The repository ignores the downloaded dataset folder, `data/restricted/`, restricted frontend JSON bundles, and `reports/restricted/`.

```powershell
python scripts/check_restricted_data_privacy.py
python scripts/generate_mimic_restricted_cases.py --limit 50
```

The generated MIMIC-derived bundle is for local validation only and is not imported by the public Vite app. Use the grounding audit to check LLM-generated text before clinician or learner review:

```powershell
python scripts/audit_grounding.py --cases data/restricted/mimic_iv_ext_cases.restricted.json --outputs data/restricted/generated_outputs.restricted.json
```

For local research demos, open the app and use **Load Local MIMIC Bundle** in the case-source banner. The selected file stays in browser memory and is never statically imported into the public app.

To link MIETIC rows back to credentialed local MIMIC modules, use the ignored DuckDB linker. It emits app-loadable restricted `clinical_case_v3` cases with a module availability matrix, linked ED/hospital/ICU/note/CXR/ECG context when present, learner-unlockable objective data, and debrief-only retrospective ground truth:

```powershell
python scripts/link_mimic_restricted_context.py `
  --mimiciv-dir D:\physionet\mimiciv `
  --mimic-ed-dir D:\physionet\mimic-iv-ed `
  --mimic-note-dir D:\physionet\mimic-iv-note `
  --mimic-cxr-dir D:\physionet\mimic-cxr `
  --mimic-ecg-dir D:\physionet\mimic-iv-ecg
```

The default output is `data/restricted/mietic_mimic_enriched_cases.restricted.json`. Keep it local only; it contains restricted identifiers and derived clinical facts for credentialed research use.

For the large MIMIC-IV v3.1 download, use a real GNU `wget.exe` from a normal terminal so the PhysioNet password prompt remains local:

```powershell
New-Item -ItemType Directory -Force D:\physionet\mimiciv | Out-Null
wget.exe -r -N -c -np -nH --cut-dirs=2 --directory-prefix=D:\physionet\mimiciv --user age1 --ask-password https://physionet.org/files/mimiciv/3.1/
```

## Documentation

- [Public deployment](docs/deployment.md)
- [Reproducibility](docs/reproducibility.md)
- [Scoring model redesign](2026_05_13_scoring_model_redesign/README.md)
- [Workflow test notes](docs/workflow_test_notes_2026_05_13.md)

## Data Note

The public app uses MIETIC validation samples derived from emergency department records. Restricted MIMIC-derived artifacts are local-only and are not suitable for public deployment. Public-facing feedback is educational and should not be used for patient care decisions.
