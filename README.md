# ED Clinical Simulator

Static emergency-department case simulator for collaborator playtesting. The app runs entirely in the browser: case state, orders, exams, grading, package assembly, and debrief all execute locally after a case bundle is loaded.

## What Ships Publicly

- `frontend/`: React + Vite app.
- `.github/workflows/deploy-pages.yml`: GitHub Pages deployment.
- `scripts/create_static_spa_fallback.mjs`: copies `index.html` to `404.html` so Pages deep links work.

Restricted case data is not committed. Keep private cases under `data/cases/` or another ignored local folder, then share only the approved zip with collaborators.

## Local Development

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173/ai-simulator`.

## Build And Test

```powershell
cd frontend
npm run build
npm run test:e2e:simulator
```

The Playwright smoke test builds the static app, serves the Vite preview, creates a small public test case bundle in memory, loads it through the file picker, completes a case, and verifies BYOK request wiring with a mocked provider response.

## Case Bundle Format

Collaborators load one `.case-bundle.zip` in the browser. The zip must include `prepared_case.json`; explicit catalogs are recommended but the app can infer a playable catalog from the prepared case when they are omitted.

```text
prepared_case.json
order_catalog.json  # recommended
exam_catalog.json   # recommended
patient-media/...   # optional
ecg/*.svg           # optional
case_bundle.json    # optional manifest
```

The current private abdominal-pain bundle is local at:

```text
data/cases/restricted_mietic_validate_public_039/restricted_mietic_validate_public_039.case-bundle.zip
```

That folder is ignored by git. Email the zip only to approved collaborators. They can open the GitHub Pages URL, choose `Load`, select the zip, and play immediately without Python, Docker, or a hosted API.

## BYOK AI

The simulator works without any API key using authored/mock responses from the case bundle.

Optional BYOK mode is available in `Settings`:

- OpenAI uses the browser to call `https://api.openai.com/v1/responses`.
- DeepSeek uses `https://api.deepseek.com/chat/completions`.
- OpenRouter uses `https://openrouter.ai/api/v1/chat/completions`.
- OpenAI-compatible lets the user enter a custom chat-completions endpoint.

Keys are stored only in that browser's `localStorage`. If a direct provider call fails, the simulator falls back to the local authored response so the case remains playable.

## GitHub Pages

Push to `main` or run the workflow manually. The workflow installs frontend dependencies, removes `frontend/public/patient-media/` from the public artifact, builds the Vite app, and deploys `frontend/dist`.

No backend service is required for production.

## Privacy

- Do not commit MIMIC-derived or other restricted case bundles.
- Keep `data/cases/`, `data/restricted/`, and `frontend/public/patient-media/` ignored.
- Share private cases as individual zip files with approved collaborators only.
