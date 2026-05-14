# Public Deployment

ED Triage Trainer deploys as a static React/Vite application on GitHub Pages. The public app does not require Flask, a backend server, environment variables, hosted API keys, or paid services for the default learning workflow.

## Runtime Model

- MIETIC validation cases are bundled as static JSON at `frontend/src/data/cases.json`.
- Case simulation, patient responses, ESI scoring, escalation scoring, SBAR scoring, and debrief generation run in the browser.
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
