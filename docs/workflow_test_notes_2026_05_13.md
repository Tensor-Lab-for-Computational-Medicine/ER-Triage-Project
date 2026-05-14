# ED Triage Trainer Workflow Test Notes

Date: 2026-05-13  
Application URL: `http://127.0.0.1:5173/`  
Build target: static React/Vite application

## Checks Run

| Area | Result | Notes |
|---|---:|---|
| Production build | Pass | `npm run build` completed successfully. Vite emitted a large chunk warning from optional browser embedding support. |
| Static bundle validation | Pass | `python scripts\validate_static_bundle.py` validated 31 static cases. |
| Production dependency audit | Pass | `npm audit --omit=dev --json` reported 0 vulnerabilities. |
| Secret scan | Pass | No OpenRouter or OpenAI keys were found outside ignored local environment files. The only matches were detector patterns inside the pre-commit hook. |
| Whitespace check | Pass | `git diff --check` found no whitespace errors in the checked frontend and hook files. |
| Browser console | Pass | No console errors appeared during the tested workflow paths. |

## Browser Workflow Observations

The app loaded at `http://127.0.0.1:5173/` and completed a full triage simulation through the debrief screen. The debrief rendered the action scoring ledger, priority feedback, simulation realism section, and four free-text reasoning rubric cards. The deterministic scoring path remained available when the AI review failed.

The OpenRouter reasoning review was intermittently unreliable with the default free model. One browser run produced the full AI reasoning critique with four rubric sections and a score of 27 / 65. A later run reached the debrief screen but showed `OpenRouter returned no response content.` The workflow did not crash, but the student lost the highest-value feedback section for that attempt.

The semantic cache worked for paraphrased patient questions after the browser-local embedding and synonym layer were active. The question “Are you having trouble breathing right now?” generated an OpenRouter response. The follow-up “Do you feel short of air?” reused the prior answer from semantic cache with 92% similarity and did not make a second model call.

The AI patient response text needs post-processing. One response rendered as `No,I’m not having any trouble breathing right now.` The content was clinically appropriate, but spacing and punctuation errors reduce realism.

## Findings

### Priority 1

**LLM feedback needs a reliable fallback.**  
The reasoning review is central to the learning experience, but `openrouter/free` can return empty content. The debrief should always provide meaningful rubric feedback, even when the provider fails. A retry control, fallback model option, and deterministic rubric-based feedback should be available without requiring a new simulation attempt.

**Automated workflow tests are missing.**  
The frontend package has `dev`, `start`, `build`, and `preview` scripts, but no unit, integration, or browser workflow tests. Core behaviors currently depend on manual browser testing. Playwright coverage should verify the no-key static path, patient interview path, provisional ESI rationale, escalation rationale, SBAR submission, debrief rendering, OpenRouter failure handling, and semantic cache reuse.

### Priority 2

**The debrief is information dense.**  
The debrief contains the action ledger, priority feedback, score domains, free-text rubrics, simulation realism notes, evidence references, and AI tutor. The content is useful, but the current stack can overwhelm students. A tabbed or accordion layout should separate priority feedback, rubric feedback, action scoring, and tutor review.

**AI status should be more transparent.**  
The workflow can wait on embedding model loading, semantic cache lookup, and OpenRouter calls. The interface should show short status labels such as “checking cache,” “loading local similarity model,” and “requesting AI patient response.”

**Patient response cleanup is needed.**  
AI-generated patient answers should pass through a small formatter that collapses whitespace, adds missing spaces after punctuation, removes leading labels such as `Patient:`, strips unmatched quotes, and keeps responses in first person.

**The optional embedding model has a noticeable payload.**  
The production build includes a large ONNX WebAssembly asset for browser-local semantic matching. This is acceptable for optional cost-saving behavior, but first use can be slow. The app should prewarm the embedding model after AI is enabled and the browser is idle.

### Priority 3

**AI settings can remain visually open after saving.**  
The key/model panel stayed open during testing after settings were saved. Closing the panel after save and supporting click-outside dismissal would reduce header clutter.

**Local verification commands should be documented precisely.**  
`curl.exe -i http://127.0.0.1:5173/` returned HTTP 200, while one PowerShell `Invoke-WebRequest` check reported 404 despite the browser loading correctly. The README should document the preferred local run and verification path.

## Recommended Modifications

1. Add Playwright tests for the complete static workflow, AI-enabled interview, semantic cache reuse, debrief rubric rendering, and OpenRouter failure recovery.
2. Add deterministic fallback feedback for SBAR and rationale rubrics so section-level reasoning critique is always present.
3. Add a retry button and fallback model selector when OpenRouter returns empty content or a provider error.
4. Add patient response post-processing before interview answers are rendered or cached.
5. Reorganize the debrief into clear sections: priority feedback, reasoning rubrics, action scoring, and AI tutor.
6. Prewarm the browser embedding model after AI is enabled, with visible status during first use.
7. Close the AI settings panel after save and support click-outside dismissal.
8. Document the static app run path, preview command, and recommended local health check command in the README.
