# Institutional Governance And Privacy Plan

## Status

Status: draft engineering and curriculum governance plan, not institutional approval, legal advice, IRB approval, FERPA determination, HIPAA determination, or security sign-off.

The ER Clinical Workflow Simulator should not be deployed nationally until an adopting institution reviews and approves the data flows, clinical content governance, learner-record handling, optional AI provider use, incident response, and accessibility plan.

## Deployment Boundary

Default public workflow:

- Runs as a static browser app.
- Uses sanitized public cases from `frontend/src/data/cases.json`.
- Uses deterministic browser scoring and feedback.
- Requires no backend, hosted database, institutional API key, or external AI call.
- Does not send learner data off-device by default.

Restricted or institution-specific workflow:

- Local MIMIC-derived bundles are credentialed local-only material.
- Local clinical knowledge bundles may contain institution-specific or licensed content.
- Restricted/local content must not be committed, deployed publicly, or sent to an external model without explicit institutional approval.

Optional AI workflow:

- Disabled unless a learner or educator enters a provider key.
- Sends case and learner-context prompts directly from the browser to the selected provider.
- Must remain optional draft support, not scoring or source-of-truth feedback.
- Requires institutional review before school-wide deployment.

## Required Governance Roles

- Clinical content owner: approves case truth, feedback boundaries, source updates, and retirement of unsafe cases.
- Medical education owner: approves learning objectives, rubric interpretation, and outcome study design.
- Privacy/security owner: approves data inventory, browser storage, optional AI provider use, and incident response.
- Accessibility owner: approves WCAG testing and accommodations before required student use.
- Technical owner: controls release process, monitoring, rollback, and build reproducibility.

## Required Institutional Decisions

Before national or school-wide use, decide:

- Whether learner progress data is an education record.
- Whether cohort analytics will be collected and where they will be stored.
- Whether optional AI is allowed, which providers are approved, and what data may be sent.
- Whether students may use their own API keys.
- Whether restricted clinical cases may be used with students.
- Whether local textbook or institutional guidance can be imported.
- Whether the app is formative-only or part of graded assessment.
- How clinical safety incidents, hallucinations, or harmful feedback reports are triaged.

## Minimum Policies Needed

- Data retention policy.
- Learner consent or disclosure language.
- Optional AI provider disclosure.
- Case content review SOP.
- Source update and citation review SOP.
- Incident response and rollback SOP.
- Accessibility accommodation SOP.
- Educator calibration guide.
- Research/IRB determination for outcome studies.

## Current Draft Controls

- Public bundle validation rejects restricted identifiers and forbidden public fields.
- Restricted MIMIC-derived artifacts are ignored by git and local-only.
- Default workflow does not require external AI.
- AI debriefs are optional drafts and cannot mutate deterministic feedback.
- Diagnosis and consult feedback now expose source-limited status when public truth is unavailable.
- Draft objective matrix and outcomes protocol exist but are not clinician-educator validation evidence.

## Remaining Approval Gaps

- No signed institutional privacy/security review.
- No FERPA or student-record determination.
- No HIPAA/privacy determination for restricted local cases.
- No approved AI provider list or data-processing agreement.
- No completed accessibility audit.
- No production monitoring, escalation, or incident-response drill.
- No approved clinical content governance board.
- No multi-institution deployment agreement.

Until these gaps are closed, the app should be used only as a developing formative simulator, not as a nationally approved medical education platform.
