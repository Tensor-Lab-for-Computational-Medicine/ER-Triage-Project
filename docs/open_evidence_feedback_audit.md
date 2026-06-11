# Open Evidence Feedback Audit

Date: 2026-06-09

## Goal Contract

Strengthen the ER Triage project by moving learner feedback toward open, auditable clinical evidence as the primary feedback source, while keeping the current custom LLM feedback path as a fallback or optional enrichment. Success is verified by a documented audit of the current app, at least 40 concrete weaknesses or improvement areas, and a prioritized roadmap that preserves deterministic scoring, public deployment safety, and restricted-data boundaries.

This goal follows the Codex goal guide's structure:

- Outcome: identify the highest-value changes needed to strengthen the app.
- Verification surface: this audit artifact, code/document inspection, paper-derived criteria, and current bundle metrics.
- Constraints: do not weaken deterministic scoring, do not expose restricted MIMIC-derived data, and do not make external LLM output the default source of clinical truth.
- Boundaries: use the current repository, the supplied guide, and the four supplied papers.
- Iteration policy: compare app behavior against evidence standards, then prioritize the next changes by safety, educational validity, and implementation leverage.
- Blocked condition: if a claim cannot be grounded in current files or supplied literature, label it as an inference rather than a fact.

## Evidence Inputs

Local sources reviewed:

- `C:\Users\Aaron Ge\Documents\using_goals_in_codex.ipynb.txt`
- `papers/Applications of artificial intelligence in healthcare simulation - a model of thinking.pdf`
- `papers/Clinical Reasoning Curriculua.pdf`
- `papers/IMPROVING ED EMERGENCY SEVERITY INDEX.pdf`
- `papers/LLM Virtual Patients.pdf`
- Current app code, data, tests, and docs in this repository.

Evidence themes used for the audit:

- Goals should have a measurable outcome, verification surface, constraints, boundaries, iteration policy, and blocker criteria.
- AI in healthcare simulation should be integrated with ethics, AI literacy, cybersecurity, governance, oversight, accountability, and impact assessment.
- Clinical reasoning curricula should define clinical reasoning, identify theory and reasoning domains, report assessment validity evidence, and fit into a larger curriculum.
- ESI support should be evaluated against expert ESI standards, with attention to undertriage, overtriage, high-risk ESI levels, documentation quality, and real-time feedback impact.
- LLM virtual patient systems need transparent model/prompt reporting, standardized metrics, factual accuracy checks, role consistency, emotional realism, data governance, and educational outcome evidence.

## Current App Snapshot

Code and docs show a strong starting architecture:

- Browser-only deterministic simulation and scoring.
- Static public case bundle with reviewed augmentations.
- Optional external AI for patient responses, tutor, debrief, and written critique.
- Public clinical knowledge bundle plus vector assets.
- Claim-level citation contract for grounded LLM outputs.
- Local PDF ingestion path for private textbook bundles.
- Restricted MIMIC paths kept ignored and local-only.

Measured current state:

- Public cases: 23.
- Public ESI distribution: ESI 1 = 2, ESI 2 = 10, ESI 3 = 5, ESI 4 = 4, ESI 5 = 2.
- Public cases missing source-record diagnosis references: 23/23.
- Public cases missing clinician-approved referral references: 23/23.
- Public cases missing retrospective ground-truth objects: 23/23.
- Public cases missing optional objective-data unlocks: 23/23.
- Public clinical sources: 100.
- Public reference chunks: 2,445.
- Quote-backed/auditable chunks: 45, or 1.84%.
- Generated-needs-review chunks: 2,400, or 98.16%.
- Chunks with missing auditable locator status: 2,400.
- Current high-risk retrieval smoke presets: 9.

## Priority Findings

The biggest strategic issue is not that the project lacks grounding infrastructure. It already has a promising retrieval layer, citation contract, vector bundle, source-quality report, local textbook import, and fail-closed logic. The gap is that the open-evidence layer is not yet strong enough to be the primary feedback engine.

The second strategic issue is that an API-key user can trigger automatic AI debrief generation, and the UI merges AI-generated SOAP and tips into the debrief. That makes the LLM path more than a backup in keyed sessions.

The third strategic issue is educational validity. The app has deterministic workflow scoring, but its public case bundle lacks source-record diagnosis, referral, retrospective outcome, and objective-data references, so several clinical reasoning domains are only partially assessable.

## Weaknesses and Improvement Areas

| # | Area | Weakness | Improvement |
|---:|---|---|---|
| 1 | Evidence quality | Only 45 of 2,445 public chunks are quote-backed and auditable. | Raise quote-backed coverage until common debrief, triage, management, and reassessment feedback can cite original source excerpts. |
| 2 | Evidence quality | 98.16% of chunks are generated summaries marked as needing review. | Treat generated chunks as background only, not primary learner-facing feedback evidence. |
| 3 | Evidence quality | 2,400 chunks lack auditable locator support. | Add page, section, DOI/PMID, stable URL, search phrase, and quote hash where possible. |
| 4 | Evidence quality | `review_status: reviewed` coexists with `evidence_status: generated_needs_review`, which can confuse source governance. | Split "source accepted into bundle" from "claim-level evidence verified." |
| 5 | Evidence quality | Many chunks are template-derived rather than extracted from source text. | Build a source-excerpt extraction and human review workflow for priority topics. |
| 6 | Evidence quality | Source URLs are often broad guideline indexes rather than exact recommendations. | Prefer direct guideline pages/PDF sections and retain exact locator metadata. |
| 7 | Evidence quality | The source freshness/update policy is implicit. | Add stale-source checks, review dates, and scheduled source refresh criteria. |
| 8 | Evidence quality | The bundle does not prove source URLs still resolve or that search phrases still match. | Add a source-link and quote-verification CI script. |
| 9 | Evidence quality | High-risk topics have at least one quote-backed chunk, but not enough depth for nuanced feedback. | Define minimum quote coverage per high-risk topic and facet, not only per topic. |
| 10 | Evidence quality | The quality report is JSON-only and easy for maintainers to miss. | Add a dashboard or docs summary that surfaces quote-backed coverage and review backlog. |
| 11 | Retrieval | Runtime retrieval is tested by a small preset matrix of 9 queries. | Expand the matrix to include all major ESI levels, common ED chief complaints, and negative controls. |
| 12 | Retrieval | Retrieval scoring can select valid sources that are weakly aligned with the exact learner mistake. | Add claim-to-reference semantic alignment checks and minimum per-claim support thresholds. |
| 13 | Retrieval | High-risk detection relies on a regex query classifier. | Add topic/facet-based risk classification from cases, actions, and claims. |
| 14 | Retrieval | If semantic vectors are not warmed, BM25 fallback may be used silently for important feedback. | Require a retrieval-quality badge and fail-closed threshold for high-risk feedback. |
| 15 | Retrieval | Generated background chunks can still appear in retrieval results for non-high-risk feedback. | Make learner-facing feedback prefer quote-backed references by default, with generated background hidden or clearly labeled. |
| 16 | Retrieval | The browser validator checks citation IDs and high-risk quote requirements, not actual textual entailment. | Add deterministic contradiction and relevance checks in the browser path, modeled after `scripts/audit_grounding.py`. |
| 17 | Retrieval | The grounding audit is mainly an offline/restricted script. | Create a public-safe grounding regression fixture for every feedback category. |
| 18 | Retrieval | The current citation contract requires citations but not enough citation quality. | Add citation status tiers: exact quote-backed, anchored source-level, generated background, invalid. |
| 19 | Feedback architecture | With an API key, the debrief automatically calls the AI debrief path. | Make open-evidence deterministic feedback the default and require explicit user action for LLM enrichment. |
| 20 | Feedback architecture | AI-generated SOAP and tips are merged into the main debrief when available. | Keep LLM output in a separate "AI draft" panel unless it passes strict evidence and review gates. |
| 21 | Feedback architecture | Current LLM feedback is an optional enhancement, but not consistently framed as fallback. | Rename and reorganize settings around "Evidence feedback" first and "AI draft support" second. |
| 22 | Feedback architecture | The no-key tutor is locked instead of offering a browser-only evidence tutor. | Add a no-key evidence tutor that answers from deterministic feedback plus retrieved open references. |
| 23 | Feedback architecture | Local reasoning review is keyword/rubric based and not source-cited. | Attach open-evidence references to each rubric criterion and learner gap. |
| 24 | Feedback architecture | Deterministic priority feedback does not display citations. | Add source-backed citations to ESI rules, resource logic, red flags, and reassessment guidance. |
| 25 | Feedback architecture | Fail-closed LLM grounding returns generic fallback guidance. | Generate richer browser-only feedback from retrieved references and case atoms when LLM use is blocked. |
| 26 | Feedback architecture | AI debrief parse failure can return `null`, leaving little learner-facing explanation. | Render an explicit "AI draft unavailable; evidence feedback preserved" state. |
| 27 | Feedback architecture | External AI settings are prominent compared with evidence settings. | Rebalance UI so evidence quality, source provenance, and local deterministic feedback are the default mental model. |
| 28 | Feedback architecture | Clinical tips from AI can overwrite or replace `next_case_checklist`. | Preserve deterministic checklist and append AI suggestions only as draft additions. |
| 29 | Feedback architecture | Case evidence atoms are capped at 24, which may omit relevant evidence in richer local cases. | Add task-specific atom selection and show omitted evidence counts. |
| 30 | Feedback architecture | Claim citations can cite case facts or references, but feedback does not show why those citations support the claim. | Display claim, case fact, reference quote, and reasoning link together for important feedback. |
| 31 | Case data | The public bundle has only 23 cases. | Expand open/public-safe case coverage or create authored open cases with expert-reviewed answers. |
| 32 | Case data | The public case mix is skewed toward high acuity: 12/23 are ESI 1 or 2. | Balance ESI levels, especially ESI 4 and 5, to train resource prediction and low-acuity discrimination. |
| 33 | Case data | All public cases lack source-record diagnosis references. | Add reviewed diagnosis references or clearly limit diagnosis scoring to structure and evidence use. |
| 34 | Case data | All public cases lack clinician-approved referral references. | Add expert-reviewed consult/reference decisions or move referral scoring to formative-only until validated. |
| 35 | Case data | All public cases lack retrospective ground-truth objects. | Add public-safe outcome summaries or remove outcome-dependent claims from public feedback. |
| 36 | Case data | All public cases lack optional objective-data unlocks. | Add reviewed public objective data such as simulated ECG/lab/imaging snippets, with provenance labels. |
| 37 | Case data | Reviewed inferred physical exam facts enrich realism but are not source-record findings. | Keep them clearly labeled and avoid using them as patient-specific truth beyond their reviewed use cases. |
| 38 | Case data | The app has no public case-level diagnosis/referral validation set. | Create a clinician-reviewed public gold set for diagnosis, differential, referral, and initial plan. |
| 39 | Case data | Public cases cannot support robust learner-outcome or fairness analysis. | Track ESI accuracy, undertriage, overtriage, and gap patterns by case type, acuity, age, sex, and complaint where safe. |
| 40 | Case data | Restricted MIMIC local mode is powerful, but public feedback quality cannot depend on restricted data. | Build a public evidence and case layer strong enough to stand alone. |
| 41 | Scoring | ESI scoring is deterministic, but public diagnosis and referral scoring are source-limited. | Separate scored, formative, and unscored domains visibly in the debrief. |
| 42 | Scoring | `handoffNeeded` is hard-coded false in feedback generation. | Re-enable conditional SBAR/handoff scoring when consult, escalation, or handoff communication is selected. |
| 43 | Scoring | Undertriage/overtriage consequences are not tracked longitudinally as educational outcomes. | Add learner-level and aggregate metrics for undertriage, overtriage, and high-risk misses. |
| 44 | Scoring | Rationale scoring uses keyword heuristics for several criteria. | Add evidence-linked rubric checks and expert-reviewed examples for each criterion. |
| 45 | Scoring | The app lacks calibrated benchmarks against expert clinicians or validated instruments. | Build an expert review set and report agreement, accuracy, and reliability. |
| 46 | Scoring | Current tests verify many metadata properties but not educational validity. | Add tests that assert feedback domains map to clinical reasoning constructs and evidence citations. |
| 47 | Curriculum | The app does not explicitly define the clinical reasoning model it teaches. | Publish a curriculum map using noticing, interpreting, responding, reflecting, ESI logic, and ED workflow domains. |
| 48 | Curriculum | Clinical reasoning theory is implicit rather than documented. | Tie feedback to dual process reasoning, illness scripts, cognitive forcing, or another explicit theory. |
| 49 | Curriculum | Assessment validity evidence is not yet reported. | Document content validity, response process evidence, reliability, and relation to outcomes as the app matures. |
| 50 | Curriculum | The app lacks learner-level outcome studies. | Measure behavior or performance changes, not only completion and app correctness. |
| 51 | Virtual patient | Optional LLM patient responses risk factual drift and role inconsistency. | Keep static patient dialogue as default and add role-consistency checks for LLM patient responses. |
| 52 | Virtual patient | Text-only interaction has limited emotional realism and no nonverbal cues. | Add concise behavioral affect cues or standardized patient-style context without overwhelming triage workflow. |
| 53 | Virtual patient | Model, prompt, and response metadata are not learner-session transparent enough. | Log model, prompt version, retrieval bundle version, and grounding status for every AI draft. |
| 54 | Virtual patient | There is no standardized metric suite for patient realism, factuality, and learning impact. | Add VP metrics: factual consistency, patient voice, role consistency, response latency, and learner satisfaction. |
| 55 | Governance | AI governance is partly documented through privacy notes, but not as a complete policy. | Add an AI governance page covering consent, external AI use, local keys, source licensing, bias, oversight, and incident handling. |
| 56 | Governance | Local textbook import sets source-level external AI permission true, relying on a separate session opt-in. | Default local/private sources to external AI disallowed at source level unless explicitly changed by the user. |
| 57 | Governance | There is no formal human review queue for generated evidence chunks. | Add a review workflow that promotes chunks from generated to quote-backed/human-verified. |
| 58 | Governance | Bias and equity monitoring are not visible in the current feedback loop. | Track and review error patterns across demographics and complaint categories where data permits. |
| 59 | Governance | Cybersecurity and credential risk are mentioned but not operationalized in app tests. | Add tests and docs for key storage, local source handling, and external provider boundaries. |
| 60 | Product | The debrief can still become dense for learners. | Make the first screen show one priority learning action, with evidence and scoring details progressively disclosed. |

## Recommended Roadmap

### Phase 1: Make Open Evidence Primary

1. Stop automatic AI debrief calls in keyed sessions.
2. Keep deterministic feedback and open-evidence feedback as the main debrief.
3. Add a no-key evidence tutor that answers from case atoms plus retrieved quote-backed references.
4. Add source citations to deterministic ESI, action, reassessment, and rationale feedback.
5. Separate any LLM response into an "AI draft" panel with grounding status and explicit fallback behavior.

### Phase 2: Build The Evidence Review System

1. Promote high-value generated chunks into quote-backed chunks.
2. Require source locators and short quote excerpts for learner-facing clinical guidance.
3. Add CI checks for URL health, quote hashes, stale sources, source-topic allowlists, and retrieval precision.
4. Expand the retrieval matrix from 9 smoke cases to a broad ED evidence benchmark.
5. Add claim-reference relevance checks, not just ID validation.

### Phase 3: Strengthen Case Validity

1. Add public-safe expert-reviewed diagnosis, referral, objective-data, and reassessment references.
2. Balance the public case set across ESI levels and common ED complaints.
3. Track undertriage and overtriage trends, especially high-risk ESI 1-2 misses.
4. Re-enable conditional SBAR scoring when the learner selects consult, escalation, or handoff.
5. Add expert review and inter-rater reliability for scoring rubrics.

### Phase 4: Prove Educational Value

1. Publish the clinical reasoning curriculum map.
2. Define the reasoning theory and domains behind each feedback section.
3. Report validation evidence for assessments.
4. Add learner outcome metrics, such as improvement in ESI accuracy, reduced undertriage, better rationale quality, and transfer to new cases.
5. Maintain model/prompt/source bundle version transparency for every optional AI workflow.

## Best Next Implementation Target

The best first code change is to make the debrief open-evidence-first:

1. Remove automatic `getAiDebrief(sessionId)` execution from `Feedback.jsx`.
2. Add an explicit "Request AI draft" action.
3. Preserve deterministic SOAP/checklist output unless the AI draft is manually requested and passes grounding.
4. Add source-backed citation display to deterministic priority feedback.
5. Add a no-key evidence tutor that uses `retrieveClinicalReferences` plus case evidence atoms.

This directly aligns the app with your stated plan: open evidence becomes the default feedback engine, while the current LLM feedback implementation remains available as a backup or optional draft.
