# ED Triage Trainer

ED Triage Trainer is a static emergency department triage training application built with React and Vite. The default learning workflow runs entirely in the browser, so public deployment does not require a backend server, hosted API key, environment variables, or paid AI service.

## What The App Does

Learners work through an ED triage case using MIETIC-derived validation cases:

1. First-look safety assessment
2. Focused patient interview
3. Provisional ESI assignment
4. Baseline vital-sign review
5. Final ESI assignment with rationale
6. Triage escalation priorities
7. SBAR handoff
8. Compact data-grounded debrief

Scoring is deterministic and runs in the browser. The debrief compares learner decisions with case-grounded ESI, vital-sign, resource, outcome, and intervention signals. Free-text reasoning receives local rubric feedback by default, with optional OpenRouter critique when a learner saves a browser-local key.

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

The generator reads `data/raw/mietic_validate_samples.csv` and writes `frontend/src/data/cases.json`.

## Documentation

- [Public deployment](docs/deployment.md)
- [Reproducibility](docs/reproducibility.md)
- [Scoring model redesign](2026_05_13_scoring_model_redesign/README.md)
- [Workflow test notes](docs/workflow_test_notes_2026_05_13.md)

## Data Note

The app uses MIETIC validation samples derived from emergency department records. Public-facing feedback is educational and should not be used for patient care decisions.
