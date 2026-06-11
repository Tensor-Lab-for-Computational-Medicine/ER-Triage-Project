# Optional AI Guardrail Runtime Report

Generated at: 2026-06-09T22:33:40.380Z

This runtime report exercises optional AI guardrails in the production build. It proves selected bad-output and unsafe-prompt controls, but it does not replace clinician safety review or full adversarial model evaluation.

## Summary

- Probes passed: 6/6
- OpenRouter calls before optional AI: 0
- OpenRouter calls after bad AI debrief request: 1
- OpenRouter calls after unsafe tutor prompt: 1
- Bad AI debrief blocked: true
- Bad AI support-quality issue visible: true
- Unsafe tutor blocked before external AI: true

## Probes

| Probe | Status |
|---|---|
| no_optional_ai_auto_request_with_saved_key | pass |
| bad_ai_debrief_invoked_only_after_click | pass |
| bad_ai_debrief_blocked_by_grounding_guardrails | pass |
| bad_ai_debrief_content_not_rendered_as_guidance | pass |
| unsafe_tutor_prompt_blocks_before_external_ai | pass |
| unsafe_tutor_preserves_deterministic_debrief | pass |
