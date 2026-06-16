# ED Clinical Reasoning Simulator

A local-first emergency department simulation workspace for practicing triage, workup, reassessment, documentation, and debrief.

The repo now has one runnable frontend surface:

- `frontend/`: React/Vite clinical reasoning simulator UI at `/ai-simulator`. The root route redirects there.
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
  src/screens/     backend-driven clinical reasoning simulator
  src/store/       simulator state store
  src/styles/      simulator styling
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

- Simulator: `http://127.0.0.1:5173/ai-simulator`
- Root redirect: `http://127.0.0.1:5173/`

## Build And Test

```powershell
python -m pytest
cd frontend
npm run build
```

Browser workflow tests:

```powershell
cd frontend
npm run test:e2e:simulator
npm run test:e2e
```

`npm run test:e2e:simulator` starts or reuses the FastAPI backend on `127.0.0.1:8000`, serves the production frontend preview, and runs a structured encounter smoke test through `/ai-simulator`. The test server explicitly enables the mock LLM so browser QA remains deterministic; the live app does not silently fall back to canned patient dialogue.

If you already have a backend on another port, build the frontend with `VITE_ED_SIM_API` pointing to it and run Playwright with the same value:

```powershell
cd frontend
$env:VITE_ED_SIM_API="http://127.0.0.1:8001"
$env:PLAYWRIGHT_BACKEND_PORT="8001"
npm run build
npm run test:e2e:simulator
```

Set `ED_SIM_CASE_DIR` to point the backend at a specific local prepared-case directory. The Playwright config sets this to an empty fixture path by default so e2e tests use the deterministic sample case instead of whichever restricted cases are present in `data/cases/`.

Set `ED_SIM_DEFAULT_CASE_ID` when a deployment should open one specific local case by default. For direct QA links, `/ai-simulator?case_id=restricted_mietic_validate_public_039` starts that case explicitly if the backend loaded it from `ED_SIM_CASE_DIR`.

## Grader Validation Gate

Before learner pilot use, run the grader validation harness against completed `CasePackage` JSON files reviewed for the held-out set:

```powershell
python -m backend.grader.validate data/validation/packages/*.json `
  --rubric data/validation/rubric.json `
  --evidence data/validation/evidence.json `
  --answer-key data/validation/clinician-answer-key.json `
  --threshold 0.8 `
  --output reports/grader-validation.json
```

The command writes an agreement report and exits with a non-zero status when `release_blocked` is true. The release-critical answer key is clinician-authored and scored separately from MIMIC ground truth; omitting `--answer-key`, missing scored fields, or low agreement against either source blocks learner use. The validation report also scores the feedback grounding contract: grounded items require evidence IDs, and ungrounded items must explicitly say no evidence was found. Keep package, rubric, evidence, answer key, and report files local unless they are explicitly de-identified and approved for the repo.

Learner-facing feedback fails closed until that validation review is applied. Both `/api/sessions/{session_id}/grade` and `/api/sessions/{session_id}/package` return `403` for completed but unvalidated cases, so hidden-truth package data is not exposed through the debrief API before clinician-approved grader validation. Tests may opt into local bypass behavior with `ED_SIM_ALLOW_UNVALIDATED_GRADER=true`; do not use that for learner-facing runs.

To prepare a fail-closed clinician answer-key template from completed packages:

```powershell
python -m backend.grader.validation_prep data/validation/packages/*.json `
  --release-case-id restricted_mietic_validate_public_039 `
  --output reports/restricted/grader-validation-prep.json `
  --answer-key-output data/restricted/clinician-answer-key.template.json `
  --evidence-output data/restricted/evidence.template.json
```

The prep command reads package IDs only for the blank answer-key template. It intentionally does not copy ground truth, suggest a diagnosis, choose an ESI, or set disposition; the completed answer key must be clinician-authored before `backend.grader.validate` can pass. Pass `--release-case-id` so the prep step rejects the release case if it is accidentally included in the held-out validation package set.

If you do not yet have held-out packages, generate local validation packages from non-release MIMIC-IV-Ext-CDS cases first:

```powershell
python -m backend.grader.heldout_packages data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json `
  --release-case-id restricted_mietic_validate_public_039 `
  --max-cases 3 `
  --output-dir data/restricted/heldout-validation-packages `
  --manifest-output data/restricted/heldout-validation-packages.manifest.local.json
```

The generator excludes the release case, runs a deterministic hidden-safe playthrough for each held-out case, writes only objective-ready completed `CasePackage` files, and emits blank clinician answer-key/evidence templates. The package files include grader-only hidden truth and must remain local.

The backend grading endpoint accepts either pre-selected `evidence_passages` or a broader
`evidence_corpus`/`passages` object. When given a corpus, the grader uses a deterministic
lexical retrieval step to choose grounding passages per completed case; retrieval supplies
evidence only and does not decide diagnostic, ESI, disposition, or workup correctness.

## Local MIMIC Case Preparation

Prepare one credentialed MIMIC-IV-Ext enriched encounter into the simulator's local `PreparedCase` format:

```powershell
python -m backend.cases.mimic_ext data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json `
  --case-id restricted_mietic_validate_public_039 `
  --cxr-reports-dir D:\Downloads\mimic-cxr-reports `
  --output data/cases/restricted_mietic_validate_public_039.json
```

If the local enrichment has an imaging or ECG order but not the linked report text, attach a local source-backed supplemental result JSON. Use `docs/supplemental_results.template.json` as the shape, save the filled file under ignored local storage such as `data/restricted/`, and rerun preparation:

```powershell
python -m backend.cases.mimic_ext data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json `
  --case-id restricted_mietic_validate_public_039 `
  --supplemental-results data/restricted/restricted_mietic_validate_public_039.results.local.json `
  --output data/cases/restricted_mietic_validate_public_039.json
```

Supplemental results are accepted only when they name a MIMIC source, include a concrete `source_reference`, match a catalog `order_id`, contain source-recorded narrative text or structured values, and match the case provenance. Native source-generated bundles also carry `source_reference` metadata with compact row-level provenance. The reference must include at least one matching case identifier (`subject_id`, `hadm_id`, or `stay_id`), must not conflict with any case identifier it provides, and any `poe_id`/`poe_seq` supplied for a documented order must match that source order. They still release only after the student orders the matching study.

To preserve the case-selection rationale, generate a hidden-safe audit of the local enriched case pool. This ranks abdominal-pain candidates, records whether the selected case is still the best available fit after supplemental source results, and keeps the decisive-result blocker visible until a linked CT/US/ECG report is attached:

```powershell
python -m backend.cases.case_pool_audit data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json `
  --selected-case-id restricted_mietic_validate_public_039 `
  --selected-supplemental-results data/restricted/restricted_mietic_validate_public_039.results.local.applied.json `
  --source-root D:\physionet `
  --ecg-index-report data/restricted/restricted_mietic_validate_public_039.ecg-index.local.json `
  --top-n 50 `
  --output data/restricted/restricted_mietic_validate_public_039.case-pool-audit.local.json
```

When `--source-root` is supplied, the pool audit runs a hidden-safe source probe for each abdominal candidate and records only source availability summaries: detected source dirs, checked paths, auto-applyable order IDs, auto-applyable decisive order IDs, unresolved release-blocking signals, and probe notes. It does not copy report narratives into the pool audit. Pass `--ecg-index-report` to reuse the compact `source_ecg_index` artifact instead of streaming the large MIMIC-IV-ECG zip again; otherwise the audit builds that same shared subject index in memory from `--source-root` or `--mimic-ecg-dir`. `candidates_with_decisive_result` counts results already attached to prepared cases; `candidates_with_auto_applyable_decisive_result` counts candidates where the currently mounted local sources can add a decisive result in memory. `recommended_case_id` is the highest-ranked abdominal candidate, while `recommended_source_evidence_case_id` is populated when a candidate has attached or auto-applyable decisive source evidence, even if another documented release-blocking result is still unresolved. `recommended_unblocked_source_evidence_case_id` is the safer pivot signal: it is populated only when the source-evidence path has no unresolved release-blocking source-result signals. If that field is empty, no pool candidate is a safe pivot target yet.

To generate one hidden-safe pilot-readiness bundle with current blockers, source-result tasks, trajectory-review materials, and next commands, run:

```powershell
python -m backend.cases.pilot_readiness_bundle data/cases/restricted_mietic_validate_public_039.json `
  --playthrough-script data/restricted/restricted_mietic_validate_public_039.playthrough.local.json `
  --source-probe-report data/restricted/restricted_mietic_validate_public_039.source-probe.local.json `
  --source-acquisition-report data/restricted/restricted_mietic_validate_public_039.source-acquisition.local.json `
  --source-acquisition-preflight-report data/restricted/restricted_mietic_validate_public_039.source-acquisition-preflight.local.json `
  --case-pool-audit-report data/restricted/restricted_mietic_validate_public_039.case-pool-audit.local.json `
  --output reports/restricted/restricted_mietic_validate_public_039.pilot-readiness.json `
  --artifact-dir reports/restricted/restricted_mietic_validate_public_039-readiness
```

If you already have completed held-out `CasePackage` files, pass each one with `--package` so the bundle also emits grader validation prep templates. The command exits non-zero while learner-readiness blockers remain. Without `--playthrough-script`, the bundle still writes the hidden-safe audits and next steps, but its top-level learner-ready flag stays false because the objective clinician-style run has not been proven. `--source-probe-report`, `--source-acquisition-report`, `--source-acquisition-preflight-report`, and `--case-pool-audit-report` are optional, but including them keeps source-result blockers, missing-source acquisition tasks, supplemental-payload preflight status, and case-selection evidence in the single readiness packet.

If the case-pool audit recommends a different abdominal candidate, produce a compact fail-closed pivot plan before changing the selected pilot case:

```powershell
python -m backend.cases.case_pivot_plan data/restricted/restricted_mietic_validate_public_039.case-pool-audit.local.json `
  --source-refresh-report data/restricted/restricted_mietic_validate_public_040.source-refresh.local.json `
  --source-root D:\physionet `
  --enriched-source-file data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json `
  --output data/restricted/restricted_mietic_validate_public_040.pivot-plan.local.json
```

The pivot plan includes only hidden-safe identifiers, blocker codes, supplemental result order IDs, manual-verification candidate order IDs, unresolved release-blocking order IDs, preview bundle IDs, and rerun commands. It exits non-zero until the recommended case has a written refreshed case and no release-blocking source gaps, so a better-ranked candidate still cannot become the learner case merely because partial evidence exists.

To hand the remaining signoff work to a clinician in one hidden-safe packet, build the clinician review dossier after source-probe, playthrough, and held-out package prep artifacts exist:

```powershell
python -m backend.cases.clinician_review_dossier data/cases/restricted_mietic_validate_public_039.json `
  --playthrough-script data/restricted/restricted_mietic_validate_public_039.playthrough.local.json `
  --source-probe-report data/restricted/restricted_mietic_validate_public_039.source-probe.local.json `
  --source-acquisition-report data/restricted/restricted_mietic_validate_public_039.source-acquisition.local.json `
  --source-acquisition-preflight-report data/restricted/restricted_mietic_validate_public_039.source-acquisition-preflight.local.json `
  --package data/restricted/heldout-validation-packages/restricted_mietic_validate_public_002.package.json `
  --package data/restricted/heldout-validation-packages/restricted_mietic_validate_public_006.package.json `
  --package data/restricted/heldout-validation-packages/restricted_mietic_validate_public_009.package.json `
  --output data/restricted/restricted_mietic_validate_public_039.clinician-review-dossier.local.json `
  --review-template-output data/restricted/restricted_mietic_validate_public_039.review.local.template.json
```

The dossier combines source blockers, trajectory scenarios, objective playthrough proof, grader validation prep, and one fail-closed case-review template. It excludes grader-only truth and leaves all clinician approval booleans false until the clinician has actually reviewed the evidence and debrief.

To produce a compact requirement-by-requirement completion audit:

```powershell
python -m backend.cases.goal_audit data/cases/restricted_mietic_validate_public_039.json `
  --playthrough-script data/restricted/restricted_mietic_validate_public_039.playthrough.local.json `
  --source-acquisition-report data/restricted/restricted_mietic_validate_public_039.source-acquisition.local.json `
  --source-acquisition-preflight-report data/restricted/restricted_mietic_validate_public_039.source-acquisition-preflight.local.json `
  --output reports/restricted/restricted_mietic_validate_public_039.goal-audit.json
```

The goal audit is hidden-safe and labels each explicit objective requirement as `proven`, `blocked`, `warning`, or `missing`, with the evidence artifact or blocker code that supports the status. Passing `--source-acquisition-report` makes the audit call out unresolved acquisition tasks and missing source modules directly; passing `--source-acquisition-preflight-report` also records whether the current supplemental-results payload would clear those blockers in memory.

To generate a hidden-safe local task list for missing linked reports/results, run:

```powershell
python -m backend.cases.source_gaps data/cases/restricted_mietic_validate_public_039.json `
  --output reports/restricted/restricted_mietic_validate_public_039.source-gaps.json `
  --template-output data/restricted/restricted_mietic_validate_public_039.results.local.template.json
```

The source-gap report names documented order signals without attached results and emits a supplemental-results template. When the prepared case contains local source order metadata, the report also includes the exact source identifiers, POE order rows, candidate canonical order IDs, lookup hints, copy-pasteable `operator_queries` for local MIMIC-IV-Note/MIMIC-CXR/MIMIC-IV-ECG files, and an acquisition checklist. Gaps marked `decisive_for_release` are the ones that keep the learner case fail-closed until an encounter-linked CT/US/ECG row is attached. The source probe accepts either extracted MIMIC-IV-Note `note/radiology.csv(.gz)` or a MIMIC-IV-Note zip containing that file. It intentionally does not include final diagnosis, validated ESI, actual disposition, or any guessed result values.
Unfilled supplemental-result templates are rejected by preparation; remove every `replace-with...` field and placeholder narrative before rerunning `backend.cases.mimic_ext` with `--supplemental-results`.

When credentialed MIMIC-IV hosp, MIMIC-IV-Note, MIMIC-CXR, or MIMIC-IV-ECG files are available locally, probe them for candidate source-backed lab values, report text, or ECG machine measurements before filling the supplemental result by hand:

For the large MIMIC-IV-ECG matched-subset zip, build a compact local subject index once and reuse it in later probes:

```powershell
python -m backend.cases.source_ecg_index data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json `
  --case-id restricted_mietic_validate_public_039 `
  --mimic-ecg-dir "D:\Projects\EHR Triage\mimic-iv-ecg-diagnostic-electrocardiogram-matched-subset-1.0.zip" `
  --limit-per-subject 10 `
  --output data/restricted/restricted_mietic_validate_public_039.ecg-index.local.json
```

The ECG index stores only source-linked machine-measurement rows for requested subject IDs plus row provenance. It is still restricted local data, but it avoids repeatedly streaming the huge ECG zip during source-probe and source-refresh runs.

```powershell
python -m backend.cases.source_probe data/cases/restricted_mietic_validate_public_039.json `
  --source-root D:\physionet `
  --mimic-cxr-dir "D:\Projects\EHR Triage\mimic-cxr-reports" `
  --ecg-index-report data/restricted/restricted_mietic_validate_public_039.ecg-index.local.json `
  --skip-lab-probe `
  --output data/restricted/restricted_mietic_validate_public_039.source-probe.local.json `
  --supplemental-output data/restricted/restricted_mietic_validate_public_039.results.local.candidates.json
```

The probe is deliberately conservative: it auto-detects common MIMIC source folders or ZIPs under `--source-root`, and `--mimic-hosp-dir`, `--mimic-note-dir`, `--mimic-cxr-dir`, and `--mimic-ecg-dir` may point at separate extracted folders, CSVs, or supported ZIPs when the credentialed downloads are not co-located. It matches local MIMIC hosp lab rows by subject plus ED-stay charttime, local MIMIC report text by case identifiers, imaging signal terms, and documented POE order time proximity, or local MIMIC-IV-ECG machine measurements by subject/study/time provenance. MIMIC-IV-Note may be provided as an extracted folder or as a zip containing `note/radiology.csv(.gz)`; zip-contained radiology rows are streamed and must still match case identifiers and imaging terms before they become candidates. MIMIC-IV-ECG may likewise be provided as an extracted folder or as the matched-subset zip containing `machine_measurements.csv`; zip-contained machine measurements are streamed and only auto-apply when the ECG time is plausible for the ED encounter. Use `--skip-lab-probe` when auditing the decisive CT/US/ECG release blocker without scanning large compressed hosp lab tables; remove it when you are specifically trying to recover missing source-backed lab candidates. Use `--skip-ecg-probe` for imaging-only probes or when a case-pool shared ECG index has already summarized ECG availability. It preserves source references and writes at most one auto-applyable supplemental entry per canonical order, using the nearest/first source candidate and leaving alternates visible in the audit candidates. Each report includes a hidden-safe `source_inventory` that records whether MIMIC-IV hosp labs, MIMIC-IV-Note radiology, MIMIC-CXR reports, MIMIC-CXR metadata, MIMIC-IV-ECG machine measurements, ECG record-list, and ECG waveform headers were present, missing, or skipped. Missing inventory entries include `expected_paths` under the mounted source root, and unresolved release blockers copy those into `missing_local_source_modules`, so a CT blocker can explicitly say that `mimic_iv_note_radiology` is absent and point at the local `note/radiology.csv(.gz)` or MIMIC-IV-Note zip targets even when ECG or raw CXR files are mounted. Release blockers keep generic `operator_queries` and add `localized_operator_queries` when a mounted source root lets the query be rewritten to local paths. Subject-only CXR report candidates, whether from a report table or raw text file, remain visible in the probe report but are excluded from the supplemental payload until MIMIC-CXR metadata/study-list timing or another encounter link is verified. When CXR report text joins to metadata with `StudyDate`/`StudyTime` near the documented ED CXR order, it can become an auto-applyable CXR result. ECG waveform `.hea` headers are also surfaced when present, including ZIP archives, but are excluded from the supplemental payload because a waveform header alone is not a machine interpretation or clinician-read ECG result. ECG machine interpretations outside the encounter window are surfaced as manual-only candidates and excluded from the supplemental payload. The source-gap report also includes `release_blocking_missing_results` so the decisive CT/abdominal-imaging blocker is separated from non-decisive context gaps. It does not mark the case ready, sign off the trajectory, validate the grader, or invent absent report findings.

The MIMIC-IV-Ext adapter keeps starting vitals source-backed when triage rows are sparse: missing triage vital fields may be filled only from same-encounter `MIMIC-IV-ED ed.vitalsign` rows, and the visible triage context records which fields were filled. This can make otherwise useful cases, such as epigastric-pain records with one absent triage DBP, auditable without inventing a presenting vital. Generic POE ultrasound signals are mapped to the canonical `ultrasound_ruq` order for source-gap and source-probe purposes, so missing RUQ/gallbladder ultrasound reports remain release-blocking until MIMIC-IV-Note radiology supplies an encounter-linked row.

Once the decisive source row is present, use the guarded source-refresh bridge to probe and rerun preparation in one fail-closed step:

```powershell
python -m backend.cases.source_refresh data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json `
  --case-id restricted_mietic_validate_public_039 `
  --source-root D:\physionet `
  --mimic-cxr-dir "D:\Projects\EHR Triage\mimic-cxr-reports" `
  --ecg-index-report data/restricted/restricted_mietic_validate_public_039.ecg-index.local.json `
  --output data/cases/restricted_mietic_validate_public_039.json `
  --report-output data/restricted/restricted_mietic_validate_public_039.source-refresh.local.json
```

`source_refresh` accepts the same explicit source-dir overrides as `source_probe`, including `--ecg-index-report`, then writes the prepared case only after the probe resolves all release-blocking source-result gaps and a second source-gap validation pass confirms no decisive CT/US/ECG gap remains. If the mounted sources only contain subject-level CXR text, ECG waveform headers, indexed ECG rows without the decisive imaging blocker, or otherwise unresolved source blockers, it writes the report but not the prepared case. When the probe finds some valid supplemental results but not enough to clear all blockers, the report includes `supplemental_result_order_ids`, `manual_verification_candidate_order_ids`, `unresolved_release_blocking_order_ids`, `source_acquisition_tasks`, `preview_result_bundle_ids`, `preview_source_gaps_after_payload`, and `preview_readiness_after_payload` so you can see exactly what would improve after applying the payload in memory without creating a learner case. `source_acquisition_tasks` is the compact operator checklist: missing source module names, expected local paths, localized lookup queries, acceptance criteria, and the supplemental-result template for the unresolved release blocker.

To split that checklist into a smaller hidden-safe handoff artifact:

```powershell
python -m backend.cases.source_acquisition data/restricted/restricted_mietic_validate_public_040.source-refresh.local.json `
  --output data/restricted/restricted_mietic_validate_public_040.source-acquisition.local.json
```

The command exits non-zero while source tasks remain and exits zero only when the source refresh report has written a prepared case with no unresolved acquisition task.

Before writing a learner case from hand-filled source results, preflight the candidate supplemental JSON against the current checklist:

```powershell
python -m backend.cases.source_acquisition_preflight data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json `
  --case-id restricted_mietic_validate_public_039 `
  --source-acquisition-report data/restricted/restricted_mietic_validate_public_039.source-acquisition.local.json `
  --supplemental-results data/restricted/restricted_mietic_validate_public_039.results.local.json `
  --output data/restricted/restricted_mietic_validate_public_039.source-acquisition-preflight.local.json
```

The preflight command reuses the same guarded `prepare_mimic_ext_case` validation in memory, writes no `PreparedCase`, and exits zero only when the supplemental payload clears all release-blocking source-result gaps. Its report intentionally records order IDs, remaining blocker signals, and readiness status without echoing source report narratives.

To produce the explicit ground-truth-wall proof, dump every start-of-encounter in-loop context/persona payload and run the built-in hidden-term scan:

```powershell
python -m backend.cases.hidden_wall data/cases/restricted_mietic_validate_public_039.json `
  --output reports/restricted/restricted_mietic_validate_public_039.hidden-wall.json `
  --payload-output reports/restricted/restricted_mietic_validate_public_039.hidden-wall.payload.json
```

The payload dump is the artifact to grep during review: it includes visible encounter context, patient/nurse/consult/exam contexts, unordered result contexts, and persona messages, but not `HiddenTruth`. The audit command uses the case's hidden fields internally for scanning and emits only hidden-safe term labels and finding locations.

To produce the live-state proof, run deterministic trajectory scenarios and persona guard probes:

```powershell
python -m backend.cases.live_state_audit data/cases/restricted_mietic_validate_public_039.json `
  --output reports/restricted/restricted_mietic_validate_public_039.live-state.json
```

The live-state audit reruns the same trajectory scenarios twice, records whether every scenario is deterministic, then sends patient/nurse/consultant personas a mocked model response that falsely says the patient is stable and gives wrong vitals. Passing means the response returned to the learner is anchored to the code-held vitals instead of the model's invented state.

To prove the learner-facing API fails closed before grader validation, run:

```powershell
python -m backend.cases.release_gate_audit data/cases/restricted_mietic_validate_public_039.json `
  --output reports/restricted/restricted_mietic_validate_public_039.release-gate.json
```

The release-gate audit uses an unvalidated copy of the case, completes only the minimum SOAP gate, then verifies `/grade` and `/package` return `403` without assembling the hidden-truth package, recording grader token usage, or emitting hidden terms in the API response summaries.

Run the abdominal learner-readiness gate before treating a prepared case as pilot-ready:

```powershell
python -m backend.cases.readiness data/cases/restricted_mietic_validate_public_039.json `
  --require-playthrough `
  --playthrough-script data/restricted/restricted_mietic_validate_public_039.playthrough.local.json
```

This gate checks the source/provenance, abdominal complaint fit, fixed order catalog coverage, hidden-truth wall, source-recorded decisive results, deterministic trajectory eligibility, clinician trajectory signoff, grader validation status, and the objective clinician-style playthrough proof when `--require-playthrough` is set. It also fails closed when `source_gaps.release_blocking_missing_results` is non-empty, even if another ECG or imaging result is present, so a documented CT/US order without its linked report cannot be hidden by an unrelated decisive-looking result. A prepared case may load locally for development while still being blocked for learner use.

To write the final learner-ready case, use the fail-closed finalizer after the source-backed supplemental results and clinician review artifact are complete:

```powershell
python -m backend.cases.finalize data/cases/restricted_mietic_validate_public_039.json `
  --review data/restricted/restricted_mietic_validate_public_039.review.local.json `
  --playthrough-script data/restricted/restricted_mietic_validate_public_039.playthrough.local.json `
  --output data/cases/restricted_mietic_validate_public_039.learner-ready.local.json `
  --report-output reports/restricted/restricted_mietic_validate_public_039.finalization.json
```

The finalizer applies the review artifact, reruns the objective playthrough against the reviewed case, reruns hidden-wall, live-state, release-gate, source-gap, readiness, and goal-completion audits, and writes the output case only when every learner-release gate passes. Its finalization report includes those hidden-safe audit objects so the release decision is reviewable from one file.

After a clinician reviews the trajectory and the grader validation report, apply the local review artifact to the prepared case. Use `docs/case_review.template.json` as the shape and save the filled artifact under ignored local storage such as `data/restricted/`:

```powershell
python -m backend.cases.review data/cases/restricted_mietic_validate_public_039.json `
  --review data/restricted/restricted_mietic_validate_public_039.review.local.json `
  --output data/cases/restricted_mietic_validate_public_039.json
```

The review command is strict: each review section must include a concrete reviewer name and valid ISO timestamp, not template placeholders. Trajectory signoff requires explicit clinician confirmation of source vitals, deterministic behavior, intervention effects, clinically defensible rules, and no model-generated trajectory. Grader signoff requires a non-blocked validation report with at least one held-out case, no validation case matching the release case ID, full clinician answer-key coverage, per-case clinician scoring for diagnosis/ESI/disposition, a passing feedback grounding rate, and aggregate diagnostic, ESI, and disposition agreement at or above the declared threshold. Playthrough signoff requires the hidden-safe playthrough report to be `objective_ready=true` plus clinician confirmation that the start-to-debrief run felt realistic, state/vitals behaved correctly, feedback was clinically sound, feedback identified strengths and misses, values were not fabricated, and hidden truth did not leak. Bare `review_status` booleans without stored review artifacts are rejected by the learner-readiness gate.

To prepare the trajectory signoff, generate a hidden-safe packet for clinician review:

```powershell
python -m backend.cases.trajectory_review data/cases/restricted_mietic_validate_public_039.json `
  --output reports/restricted/restricted_mietic_validate_public_039.trajectory-review.json `
  --review-template-output data/restricted/restricted_mietic_validate_public_039.trajectory-review.local.json
```

The packet contains visible-start facts, the deterministic rule table, and repeated simulator runs for no intervention, analgesia, oxygen, and fluids. It intentionally excludes grader-only truth and leaves every review checkbox false until the clinician fills it.

To rehearse a full local playthrough and produce a completed `CasePackage` for grader validation prep, use a local script based on `docs/playthrough.template.json`:

```powershell
python -m backend.cases.playthrough data/cases/restricted_mietic_validate_public_039.json `
  --script data/restricted/restricted_mietic_validate_public_039.playthrough.local.json `
  --output reports/restricted/restricted_mietic_validate_public_039.playthrough-report.json `
  --package-output data/restricted/restricted_mietic_validate_public_039.package.local.json
```

The playthrough report is hidden-safe and fails if an in-loop context leaks grader-only truth, if a structured result appears without source provenance, or if the package can be assembled before the encounter is complete. It also includes `success_checklist` and `objective_ready` fields for the single clinician-style proof run: patient question, exam, consult, structured ordering/result retrieval, intervention-driven vitals, ESI revision, differential, SOAP A/P, completion, and no hidden leakage or fabricated results. The CLI exits nonzero until `objective_ready` is true. The optional `--package-output` contains hidden truth by design and must stay in ignored local storage.

To prepare the clinician playthrough signoff packet from that same hidden-safe script:

```powershell
python -m backend.cases.playthrough_review data/cases/restricted_mietic_validate_public_039.json `
  --script data/restricted/restricted_mietic_validate_public_039.playthrough.local.json `
  --output reports/restricted/restricted_mietic_validate_public_039.playthrough-review.json `
  --review-template-output data/restricted/restricted_mietic_validate_public_039.playthrough-review.local.json
```

The packet includes the hidden-safe playthrough report, objective checklist status, debrief review requirements, and a fail-closed `playthrough` review artifact template. It refuses to build if the playthrough report itself contains hidden-truth terms.

## Deployment Notes

GitHub Pages deploys only the static React bundle. `/ai-simulator` can render the clinical workspace shell, but the simulator actions require a reachable FastAPI backend. A public learner pilot therefore needs an HTTPS-hosted backend configured via `VITE_ED_SIM_API`; a static Pages deployment alone cannot run sessions, structured orders, deterministic vitals, package assembly, AI dialogue, or grading.

## LLM Configuration

The simulator fails closed when no AI provider is configured. Patient, nurse, consultant, and grader calls require a real provider through environment variables or the in-app AI connection panel. The connection panel validates the provider with a small model call before enabling chat; a rejected key stays disconnected instead of failing later in the encounter.

For the default OpenAI Responses API path:

```powershell
$env:OPENAI_API_KEY="..."
$env:ED_SIM_CHEAP_MODEL="gpt-5.4-mini"
$env:ED_SIM_STRONG_MODEL="gpt-5.5"
```

For a chat-completions-compatible provider, set:

```powershell
$env:ED_SIM_LLM_PROVIDER="openai_compatible"
$env:ED_SIM_LLM_BASE_URL="https://your-provider.example/v1/chat/completions"
$env:ED_SIM_LLM_API_KEY="..."
$env:ED_SIM_CHEAP_MODEL="cheap-dialogue-model"
$env:ED_SIM_STRONG_MODEL="strong-consult-grader-model"
```

Routine patient/nurse dialogue uses the cheap tier. Consultant and grader calls use the strong tier.

For OpenRouter in the in-app panel, choose `OpenRouter`; the app uses `https://openrouter.ai/api/v1/chat/completions` and OpenRouter model IDs such as `openai/gpt-4o-mini`.

Tests may opt into deterministic mock behavior with `ED_SIM_LLM_PROVIDER=mock` and `ED_SIM_ALLOW_MOCK_LLM=true`. Do not use that pair for learner-facing runs.

## Data Rules

- Do not commit credentialed PhysioNet/MIMIC data.
- Do not commit prepared local pilot cases from `data/cases/`.
- Do not commit build outputs, reports, scratch files, PDFs, or temporary logs.
- Hidden case truth may enter only the grader package after encounter completion, and the learner-facing package endpoint stays blocked until the grader validation review passes.
- Keep `backend/orders/catalog.json` as a broad fixed superset across cases. Do not filter it to a case's expected workup.

## Core Scripts

The remaining `scripts/` files are for Vite static fallback generation, local restricted MIMIC preparation, and privacy checks. The old static browser-case generators, public knowledge/vector bundle scripts, archived UI assets, and Flowboard files were removed so the repository centers on the backend-driven `/ai-simulator` workflow.
