# ED Clinical Reasoning Simulator

A local-first emergency department simulation workspace for practicing triage, workup, reassessment, documentation, and debrief.

The repo now has two runnable surfaces:

- `frontend/`: React/Vite public Flowboard demo and the backend-driven simulator UI.
- `backend/`: FastAPI pilot backend with deterministic encounter state, structured orders, role-scoped persona contexts, and a separate grader path.

Credentialed MIMIC-derived data must stay local. Prepared pilot cases belong in `data/cases/`, which is ignored by git.

## Architecture

```text
backend/
  api/        FastAPI health, session, action, package, and grading endpoints
  cases/      prepared-case schemas, loaders, and local preparation helpers
  state/      deterministic vitals, clock, order, intervention, ESI, SOAP state
  orders/     fixed superset order catalog and source-only resolver
  router/     free-text routing for patient, nurse, consult, and commitment turns
  personas/   role prompts and persona response service
  grader/     post-encounter package assembly, grading, and validation harness
  llm/        swappable model-provider boundary

frontend/
  src/components/  existing Flowboard UI
  src/screens/     backend-driven clinical reasoning simulator
  src/store/       simulator state store
  src/services/    public demo services
```

## Local Development

Install Python and frontend dependencies:

```powershell
python -m pip install -r requirements.txt
cd frontend
npm install
```

Run the backend:

```powershell
python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

Run the frontend:

```powershell
cd frontend
npm run dev
```

Open:

- Public Flowboard: `http://127.0.0.1:5173/`
- Backend simulator: `http://127.0.0.1:5173/ai-simulator`

## Build And Test

```powershell
python -m pytest
cd frontend
npm run build
```

Optional browser workflow tests:

```powershell
cd frontend
npm run test:e2e
```

## Data Rules

- Do not commit credentialed PhysioNet/MIMIC data.
- Do not commit prepared local pilot cases from `data/cases/`.
- Do not commit build outputs, reports, scratch files, PDFs, or temporary logs.
- Hidden case truth may enter only the grader package after encounter completion.

## Core Scripts

The remaining `scripts/` files are for active data prep, public clinical knowledge assets, privacy checks, and Vite static fallback generation. Historical readiness audits, dated reports, screenshots, scratch probes, and archived redesign artifacts were removed to keep the repository readable.
