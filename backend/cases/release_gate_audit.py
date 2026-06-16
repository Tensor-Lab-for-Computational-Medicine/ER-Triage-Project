from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Literal

from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

import backend.api.main as api_main
from backend.cases.schemas import PreparedCase


class ReleaseGateEndpointCheck(BaseModel):
    name: str
    method: str
    path: str
    expected_status: int
    actual_status: int
    passed: bool
    leaked_term_labels: list[str] = Field(default_factory=list)
    response_detail: str | None = None


class ReleaseGateAudit(BaseModel):
    case_id: str
    passed: bool
    source_case_grader_validated: bool
    unvalidated_copy_used: Literal[True] = True
    runtime_unvalidated_grader_override_active: bool = False
    runtime_override_safe_for_learner: bool = True
    package_assembly_attempted_before_validation: bool
    token_usage_recorded_before_validation: bool
    checks: list[ReleaseGateEndpointCheck] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


def build_release_gate_audit(case: PreparedCase, *, require_runtime_override_safe: bool = True) -> ReleaseGateAudit:
    """Exercise learner-facing API gates without exposing hidden-truth package data."""

    audit_case = case.model_copy(deep=True)
    audit_case.review_status.grader_clinician_validated = False
    audit_case.review_status.grader_validation_review = {}

    original_cases = api_main.CASES
    original_sessions = api_main.SESSIONS
    original_allow_unvalidated = api_main.ALLOW_UNVALIDATED_GRADER
    original_assemble = api_main.assemble_case_package
    assemble_attempts: list[str] = []

    def fail_if_package_assembled_before_validation(*_args, **_kwargs):
        assemble_attempts.append("called")
        raise AssertionError("hidden package assembly attempted before grader validation")

    checks: list[ReleaseGateEndpointCheck] = []
    token_usage_recorded = False
    notes: list[str] = []

    try:
        api_main.CASES = {audit_case.case_id: audit_case}
        api_main.SESSIONS = {}
        api_main.ALLOW_UNVALIDATED_GRADER = False
        api_main.assemble_case_package = fail_if_package_assembled_before_validation

        client = TestClient(api_main.app, raise_server_exceptions=False)
        start_response = client.post("/api/sessions", json={"case_id": audit_case.case_id})
        _record_check(checks, audit_case, "start session", "POST", "/api/sessions", 200, start_response)
        session_id = _session_id(start_response)

        if not session_id:
            notes.append("Session creation failed; release-gate audit could not exercise completion endpoints.")
        else:
            package_path = f"/api/sessions/{session_id}/package"
            grade_path = f"/api/sessions/{session_id}/grade"
            action_path = f"/api/sessions/{session_id}/actions"

            premature_package = client.get(package_path)
            _record_check(checks, audit_case, "package before completion", "GET", package_path, 400, premature_package)

            soap_response = client.post(
                action_path,
                json={
                    "type": "commit_soap",
                    "payload": {
                        "assessment": "Undifferentiated abdominal pain requiring continued evaluation.",
                        "plan": "Continue structured workup, reassessment, and disposition planning.",
                    },
                    "dt_minutes": 0,
                },
            )
            _record_check(checks, audit_case, "commit SOAP gate input", "POST", action_path, 200, soap_response)

            complete_response = client.post(action_path, json={"type": "complete", "dt_minutes": 0})
            _record_check(checks, audit_case, "complete encounter", "POST", action_path, 200, complete_response)

            grade_response = client.post(grade_path, json={"rubric": {"esi_tolerance": 0}})
            _record_check(checks, audit_case, "grade before validation", "POST", grade_path, 403, grade_response)

            post_completion_package = client.get(package_path)
            _record_check(checks, audit_case, "package before validation", "GET", package_path, 403, post_completion_package)

            session_response = client.get(f"/api/sessions/{session_id}")
            _record_check(checks, audit_case, "session after blocked feedback", "GET", f"/api/sessions/{session_id}", 200, session_response)
            token_usage_recorded = bool((_json_payload(session_response).get("state") or {}).get("token_usage"))
    finally:
        api_main.CASES = original_cases
        api_main.SESSIONS = original_sessions
        api_main.ALLOW_UNVALIDATED_GRADER = original_allow_unvalidated
        api_main.assemble_case_package = original_assemble

    if assemble_attempts:
        notes.append("Package assembly was attempted before grader validation; this would expose hidden truth if not blocked.")
    if token_usage_recorded:
        notes.append("Token usage was recorded before validation; grader/persona calls should not run in this audit.")
    if original_allow_unvalidated:
        notes.append(
            "The runtime unvalidated-grader override was active before this audit forced it off; disable "
            "ED_SIM_ALLOW_UNVALIDATED_GRADER for learner-facing runs."
        )

    endpoint_checks_passed = (
        bool(checks)
        and all(check.passed and not check.leaked_term_labels for check in checks)
        and not assemble_attempts
        and not token_usage_recorded
    )
    passed = endpoint_checks_passed and (not original_allow_unvalidated or not require_runtime_override_safe)
    return ReleaseGateAudit(
        case_id=case.case_id,
        passed=passed,
        source_case_grader_validated=bool(case.review_status.grader_clinician_validated),
        runtime_unvalidated_grader_override_active=bool(original_allow_unvalidated),
        runtime_override_safe_for_learner=not bool(original_allow_unvalidated),
        package_assembly_attempted_before_validation=bool(assemble_attempts),
        token_usage_recorded_before_validation=token_usage_recorded,
        checks=checks,
        notes=notes,
    )


def _record_check(
    checks: list[ReleaseGateEndpointCheck],
    case: PreparedCase,
    name: str,
    method: str,
    path: str,
    expected_status: int,
    response,
) -> None:
    payload = _json_payload(response)
    leaked = _hidden_term_labels(case, payload)
    detail = payload.get("detail") if isinstance(payload, dict) else None
    checks.append(
        ReleaseGateEndpointCheck(
            name=name,
            method=method,
            path=_redact_session_path(path),
            expected_status=expected_status,
            actual_status=response.status_code,
            passed=response.status_code == expected_status,
            leaked_term_labels=leaked,
            response_detail=str(detail) if detail is not None else None,
        )
    )


def _json_payload(response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        return {"raw_response": response.text}
    return payload if isinstance(payload, dict) else {"response": payload}


def _session_id(response) -> str | None:
    payload = _json_payload(response)
    value = payload.get("session_id")
    return str(value) if value else None


def _redact_session_path(path: str) -> str:
    parts = path.split("/")
    if len(parts) > 3 and parts[1:3] == ["api", "sessions"]:
        parts[3] = "{session_id}"
    return "/".join(parts)


def _hidden_term_labels(case: PreparedCase, payload: Any) -> list[str]:
    text = json.dumps(payload, default=str).lower()
    terms = {
        "hidden field marker": "hidden_truth",
        "validated acuity field marker": "validated_esi",
        "actual disposition value": case.hidden_truth.actual_disposition,
        "diagnosis value": case.hidden_truth.final_diagnosis,
    }
    return [
        label
        for label, value in terms.items()
        if value and " ".join(str(value).lower().split()) in text
    ]


def _main() -> int:
    parser = argparse.ArgumentParser(description="Audit learner-facing API release gates before grader validation.")
    parser.add_argument("case", type=Path, help="PreparedCase JSON.")
    parser.add_argument("--output", type=Path, help="Optional audit JSON output path.")
    args = parser.parse_args()

    case = PreparedCase.model_validate_json(args.case.read_text(encoding="utf-8"))
    audit = build_release_gate_audit(case)
    rendered = audit.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0 if audit.passed else 1


if __name__ == "__main__":
    raise SystemExit(_main())
