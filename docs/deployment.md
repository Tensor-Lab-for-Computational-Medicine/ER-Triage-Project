# Public Deployment

ED Clinical Workflow Simulator deploys as a static React/Vite application on GitHub Pages. The public app does not require Flask, a backend server, environment variables, hosted API keys, or paid services for the default learning workflow.

Do not deploy credentialed MIMIC-IV-Ext-CDS source files or generated restricted bundles. Public deployment should use only the nonrestricted static bundle at `frontend/src/data/cases.json`.

## Runtime Model

- MIETIC validation cases are bundled as static JSON at `frontend/src/data/cases.json`.
- Public cases use `public_case_v2`; the validator rejects MIMIC identifiers, ICD fields, restricted linkage context, and raw source row indexes.
- The app displays a case-source banner so public demo mode is not confused with local restricted MIMIC validation mode.
- Local restricted MIMIC bundles, including enriched `clinical_case_v3` files with optional objective data, can be selected in the browser for research demos, but they are held only in browser memory and are not part of the deployable artifact.
- Reviewed case augmentations are compiled into the static bundle before deployment; no augmentation model runs in the learner browser.
- Case simulation, patient responses, ESI scoring, diagnosis/consult capture, escalation scoring, reassessment scoring, SOAP scoring, conditional SBAR scoring, and debrief generation run in the browser.
- The default workflow makes no network request.
- No OpenRouter key is required for the default workflow.
- No application-owned AI cost is possible.

## Optional AI Tutor

The post-case AI tutor is disabled until a learner enters an OpenRouter API key in the browser. The key is stored only in `sessionStorage` by default. Learners may choose local storage if they want the key remembered on the same device.

When enabled, tutor requests go directly from the learner's browser to OpenRouter:

- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Default model: `openrouter/free`
- Key transport: `Authorization: Bearer <learner key>`
- Attribution headers: `HTTP-Referer` and `X-Title`

The application does not proxy, log, commit, or ship an OpenRouter key.

## GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`. On pushes to `main`, it installs frontend dependencies, builds the Vite app, uploads `frontend/dist`, and deploys the artifact to GitHub Pages.

```powershell
cd frontend
npm install
npm run build
```

For project pages, `frontend/vite.config.js` infers the repository name from `GITHUB_REPOSITORY` during GitHub Actions and sets the correct base path automatically. `VITE_BASE_PATH` can override the base path when needed.

The production build also creates `frontend/dist/404.html` from `index.html`. GitHub Pages serves this fallback for direct client routes such as `/legacy`, allowing the React app shell to bootstrap on refresh or shared links.

Before a cohort release, run:

```powershell
cd frontend
npm run build
npm run readiness:bundle
npm run readiness:scale-run
```

`readiness:scale-run` serves the built static artifact locally and checks the default route, direct legacy route fallback, initial assets, and bounded concurrent static requests. It is a smoke check only; it does not replace representative campus-network load testing, production monitoring, or an incident-response drill.
