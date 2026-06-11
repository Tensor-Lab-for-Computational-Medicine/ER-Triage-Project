# Scale, Accessibility, And Monitoring Plan

## Status

Status: draft engineering readiness plan, not completed WCAG audit, load-test report, uptime commitment, security approval, or production monitoring evidence.

This plan defines what must be verified before the simulator is used by medical students across multiple institutions or large cohorts.

## Scale Targets

Minimum cohort target before national pilot:

- 3 or more institutions.
- 300 concurrent learner sessions for scheduled simulation blocks.
- 2,000 learner sessions per week.
- Static app load time under 3 seconds on typical campus broadband after cache warmup.
- No required backend dependency for default workflow.
- Optional AI paths degraded gracefully when provider calls fail or are disabled.

## Load And Performance Checks

Required checks:

- Production build size and chunk report.
- Cold-load and warm-load timings on desktop and tablet viewports.
- Browser memory profile during a full case and debrief.
- Local clinical knowledge import stress test.
- Optional semantic vector loading test.
- Long-session test with repeated cases.
- Failure-mode test for unavailable AI provider.

Current status:

- Production build passes.
- Large bundle warnings remain and should be addressed before national deployment.
- No formal load-test report is complete.
- No browser memory profile is complete.
- No production telemetry or monitoring dashboard is complete.

## Accessibility Checks

Required WCAG-oriented checks:

- Keyboard-only completion of the full simulation.
- Screen-reader heading, landmark, form-label, and status-message review.
- Color contrast review for score states, provenance tags, warning states, and buttons.
- Focus-visible behavior for workflow controls, accordions, modals, and drawer panels.
- Error message association for required fields.
- Reduced-motion and voice/audio control review.
- Mobile and tablet viewport review.

Current status:

- Some tests exercise labels and accessible names.
- No completed WCAG audit is present.
- No student accommodation workflow is approved.
- No assistive-technology user testing is complete.

## Monitoring And Incident Response

Required production signals:

- Build version and case-bundle version.
- Content bundle version and source-quality report version.
- Client-side error rate.
- Case completion rate.
- Optional AI request failure rate, without logging secrets or clinical text unless approved.
- Source-limited feedback exposure counts.
- Unsafe-feedback reports and resolution status.
- Accessibility issue reports.

Incident response should include:

- Remove or disable a case.
- Revert a content bundle.
- Disable optional AI draft features.
- Add source-limited warning copy.
- Publish educator-facing correction notes.
- Document reviewer and date for any clinical content change.

Current status:

- No production monitoring dashboard is complete.
- No incident-response drill is complete.
- No case/content rollback drill is complete.

## Release Gate

Before national deployment, require:

- Passing production build.
- Passing static case-bundle validation.
- Passing national readiness audit with approved evidence, not only draft plans.
- Completed WCAG audit with remediated critical issues.
- Completed load and memory test report.
- Approved privacy/governance plan.
- Approved clinical content governance process.
- Educator review of cases, feedback, and learning objectives.
- Rollback and incident-response drill.

Until these are complete, scale readiness remains draft-only.
