# Educational Outcomes And Expert Review Protocol

## Status

Status: draft protocol, not yet IRB/institutionally approved, not yet clinician-educator validated, and not evidence of national readiness.

This protocol defines the evidence required before the ER Clinical Workflow Simulator can claim that it improves medical students' clinical judgment or hospital performance. It is based on the current readiness audit, the case objective matrix, and the reviewed literature summarized in `docs/open_evidence_feedback_audit.md`.

## Construct Model

The simulator teaches emergency department clinical reasoning through four observable domains:

- Noticing: recognizing chief concern, vital-sign risk, high-risk history, objective data, focused exam targets, and hidden deterioration signals.
- Interpreting: assigning ESI, explaining acuity, forming a provisional diagnosis and differential, and naming uncertainty.
- Responding: selecting initial placement, escalation actions, diagnostic/treatment priorities, consult timing, and disposition intent.
- Reflecting: reassessing trajectory, writing SOAP documentation, reviewing provenance, and carrying a focused next-case goal.

This framework is currently a curriculum scaffold. It needs clinician-educator review for content validity and student/faculty response-process evidence before it can support high-stakes claims.

## Required Expert Review

Each public case needs at least two independent reviewers before national use:

- Emergency physician or emergency medicine educator.
- Triage nurse, simulation educator, clerkship director, or another qualified clinical educator.

Reviewers should adjudicate:

- Reference ESI and undertriage/overtriage consequence.
- Primary diagnosis or source-record diagnostic context.
- Differential diagnoses that are acceptable for the learner stage.
- Initial stabilization and placement priorities.
- Expected ED resource categories.
- Consult/referral expectation and timing.
- Reassessment triggers.
- SOAP assessment and plan boundaries.
- Learning objectives across noticing, interpreting, responding, and reflecting.
- Equity/bias concerns, including demographic stereotypes, language access, disability, pregnancy, age, and social context.
- Whether feedback should be scored, formative-only, or hidden because source truth is insufficient.

Minimum acceptance criteria:

- Case-level review status is `clinician_reviewed`.
- Disagreements are adjudicated by a third reviewer or curriculum lead.
- Source-limited domains remain formative-only until adjudicated.
- Reviewer conflicts and dates are logged.

## Learner Outcome Measures

Primary educational outcomes:

- ESI accuracy on held-out cases.
- Undertriage rate on ESI 1 and ESI 2 cases.
- Overtriage rate on lower-acuity cases.
- Written rationale quality using the clinical reasoning rubric.
- Correct escalation/placement selection.
- Reassessment target coverage.
- SOAP note quality.

Secondary outcomes:

- Time to recognize high-risk cues.
- Number and quality of focused interview questions.
- Objective-data review before diagnosis or final ESI.
- Consult rationale quality.
- Learner calibration: ability to identify uncertainty and source limitations.
- Retention on delayed cases 2 to 6 weeks later.
- Transfer to OSCE, simulation lab, or clerkship workplace assessment.

Safety outcomes:

- Dangerous undertriage.
- Missed resuscitation placement.
- Unsupported diagnosis certainty.
- Unsafe discharge/disposition reasoning.
- Medication/procedure claims without source or clinician approval.

## Study Design

Phase 1: formative usability and response-process study.

- Participants: 10 to 20 medical students across at least two training levels.
- Methods: think-aloud sessions, screen recording, post-case interview, and rubric review.
- Evidence target: learners understand the task, provenance labels, source-limited warnings, and feedback categories.

Phase 2: single-site pilot.

- Participants: 40 to 80 medical students.
- Design: pre/post case set with held-out cases.
- Comparison: baseline ESI/rationale performance versus simulator-assisted practice.
- Evidence target: improvement in ESI accuracy, lower undertriage, and better rationale quality without increased unsafe confidence.

Phase 3: multi-site controlled study.

- Participants: at least 3 medical schools or clerkship/simulation programs.
- Design: randomized or stepped-wedge design if feasible.
- Comparison: usual curriculum versus usual curriculum plus simulator.
- Evidence target: transfer to OSCE, simulation lab, or supervised clinical performance measures.

## Instrumentation Requirements

The app should record, with privacy review:

- Case id and content version.
- Learner training level and optional institution cohort code.
- ESI selections and rationale text.
- Interview domains covered and missed.
- Objective review completion.
- Focused exam systems selected.
- Initial actions, consult decisions, and reassessment targets.
- SOAP note fields.
- Score domains and source-limited flags.
- AI draft requests, blocked states, and whether the draft was viewed, without using AI draft text for deterministic grading.

Do not collect identifiable patient information or direct student identifiers in public deployments without institutional approval.

## Analysis Plan

Report:

- Overall and by-ESI accuracy.
- Undertriage and overtriage by case category.
- Rubric score change by domain.
- High-risk miss rate.
- Source-limited feedback exposure and learner interpretation.
- Performance by training level and case type.
- Missing data and dropout.
- Inter-rater reliability for expert review and rubric scoring.

Minimum reporting standards:

- Confidence intervals, not only point estimates.
- Case-level and cohort-level results.
- Pre-registered primary outcomes for pilot and multi-site studies.
- Separate safety analysis for ESI 1 and ESI 2 cases.

## Current Evidence Gap

Current status:

- Draft case objective matrix exists.
- No clinician-educator objective review is complete.
- No learner usability study is complete.
- No pre/post pilot is complete.
- No OSCE, simulation-lab, clerkship, or workplace outcome evidence is complete.
- No multi-site study is complete.

Until those gaps are closed, the simulator can be described as a developing educational tool with formative feedback, not as a validated national medical education platform.
