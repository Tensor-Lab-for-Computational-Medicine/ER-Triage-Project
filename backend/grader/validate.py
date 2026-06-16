from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from backend.grader.grade import ClinicianRubric, EvidencePassage, grade_case_package
from backend.grader.package import CasePackage
from backend.grader.retrieval import retrieve_evidence_passages


class ClinicianAnswerKey(BaseModel):
    case_id: str
    acceptable_diagnoses: list[str] = Field(default_factory=list)
    expected_esi: int | None = Field(default=None, ge=1, le=5)
    expected_disposition: str | None = None
    critical_actions: list[str] = Field(default_factory=list)


class ValidationCaseResult(BaseModel):
    case_id: str
    diagnostic_match: bool
    esi_match: bool
    disposition_present: bool
    critical_actions_complete: bool
    feedback_grounding_complete: bool
    clinician_key_present: bool = False
    clinician_diagnostic_match: bool | None = None
    clinician_esi_match: bool | None = None
    clinician_disposition_match: bool | None = None
    clinician_critical_actions_complete: bool | None = None


class ValidationReport(BaseModel):
    cases: list[ValidationCaseResult] = Field(default_factory=list)
    diagnostic_agreement: float
    esi_agreement: float
    disposition_documentation_rate: float
    critical_action_agreement: float
    feedback_grounding_rate: float
    clinician_answer_key_coverage: float = 0
    clinician_diagnostic_agreement: float | None = None
    clinician_esi_agreement: float | None = None
    clinician_disposition_agreement: float | None = None
    clinician_critical_action_agreement: float | None = None
    release_blocked: bool
    failure_modes: list[str] = Field(default_factory=list)


def run_validation(
    packages: list[CasePackage],
    rubric: ClinicianRubric,
    evidence_passages: list[EvidencePassage],
    threshold: float = 0.8,
    clinician_answer_key: dict[str, ClinicianAnswerKey] | list[ClinicianAnswerKey] | None = None,
) -> ValidationReport:
    answer_keys = _normalize_answer_key(clinician_answer_key)
    answer_key_supplied = clinician_answer_key is not None
    rows: list[ValidationCaseResult] = []
    for package in packages:
        retrieved_passages = retrieve_evidence_passages(package, evidence_passages)
        feedback = grade_case_package(package, rubric, retrieved_passages)
        answer_key = answer_keys.get(package.case_id)
        ordered_ids = [order.order_id for order in package.orders]
        student_diagnosis_text = " ".join([*package.differential, package.soap.assessment])
        last_esi = package.esi_history[-1].level if package.esi_history else None
        rows.append(
            ValidationCaseResult(
                case_id=package.case_id,
                diagnostic_match=bool(feedback.diagnostic_accuracy["matched"]),
                esi_match=last_esi == package.hidden_truth.validated_esi,
                disposition_present=_disposition_matches(package.soap.plan, package.hidden_truth.actual_disposition),
                critical_actions_complete=not feedback.completeness["critical_actions"]["missed"],
                feedback_grounding_complete=_feedback_grounding_complete(feedback),
                clinician_key_present=answer_key is not None,
                clinician_diagnostic_match=(
                    _diagnosis_matches(student_diagnosis_text, answer_key.acceptable_diagnoses)
                    if answer_key and answer_key.acceptable_diagnoses
                    else None
                ),
                clinician_esi_match=(
                    last_esi == answer_key.expected_esi
                    if answer_key and answer_key.expected_esi is not None
                    else None
                ),
                clinician_disposition_match=(
                    _disposition_matches(package.soap.plan, answer_key.expected_disposition)
                    if answer_key and answer_key.expected_disposition
                    else None
                ),
                clinician_critical_actions_complete=(
                    all(action_id in ordered_ids for action_id in answer_key.critical_actions)
                    if answer_key and answer_key.critical_actions
                    else None
                ),
            )
        )

    total = max(1, len(rows))
    diagnostic_agreement = sum(row.diagnostic_match for row in rows) / total
    esi_agreement = sum(row.esi_match for row in rows) / total
    disposition_rate = sum(row.disposition_present for row in rows) / total
    critical_action_agreement = sum(row.critical_actions_complete for row in rows) / total
    feedback_grounding_rate = sum(row.feedback_grounding_complete for row in rows) / total
    key_coverage = sum(row.clinician_key_present for row in rows) / total if answer_key_supplied else 0
    clinician_diagnostic_agreement = _optional_agreement(rows, "clinician_diagnostic_match")
    clinician_esi_agreement = _optional_agreement(rows, "clinician_esi_match")
    clinician_disposition_agreement = _optional_agreement(rows, "clinician_disposition_match")
    clinician_critical_action_agreement = _optional_agreement(rows, "clinician_critical_actions_complete")
    failure_modes = []
    if diagnostic_agreement < threshold:
        failure_modes.append("diagnostic agreement below clinician threshold")
    if esi_agreement < threshold:
        failure_modes.append("ESI agreement below clinician threshold")
    if disposition_rate < threshold:
        failure_modes.append("disposition documentation below clinician threshold")
    if critical_action_agreement < threshold:
        failure_modes.append("critical action agreement below clinician threshold")
    if feedback_grounding_rate < threshold:
        failure_modes.append("feedback grounding contract below clinician threshold")
    if not answer_key_supplied:
        failure_modes.append("clinician answer key required for release validation")
    if answer_key_supplied:
        if key_coverage < 1:
            failure_modes.append("clinician answer key missing for held-out cases")
        if clinician_diagnostic_agreement is None:
            failure_modes.append("clinician diagnostic answer key missing scored diagnoses")
        elif clinician_diagnostic_agreement < threshold:
            failure_modes.append("clinician diagnostic agreement below clinician threshold")
        if clinician_esi_agreement is None:
            failure_modes.append("clinician ESI answer key missing scored levels")
        elif clinician_esi_agreement < threshold:
            failure_modes.append("clinician ESI agreement below clinician threshold")
        if clinician_disposition_agreement is None:
            failure_modes.append("clinician disposition answer key missing scored dispositions")
        elif clinician_disposition_agreement < threshold:
            failure_modes.append("clinician disposition agreement below clinician threshold")
        if clinician_critical_action_agreement is not None and clinician_critical_action_agreement < threshold:
            failure_modes.append("clinician critical action agreement below clinician threshold")

    return ValidationReport(
        cases=rows,
        diagnostic_agreement=diagnostic_agreement,
        esi_agreement=esi_agreement,
        disposition_documentation_rate=disposition_rate,
        critical_action_agreement=critical_action_agreement,
        feedback_grounding_rate=feedback_grounding_rate,
        clinician_answer_key_coverage=key_coverage,
        clinician_diagnostic_agreement=clinician_diagnostic_agreement,
        clinician_esi_agreement=clinician_esi_agreement,
        clinician_disposition_agreement=clinician_disposition_agreement,
        clinician_critical_action_agreement=clinician_critical_action_agreement,
        release_blocked=bool(failure_modes),
        failure_modes=failure_modes,
    )


def run_validation_from_files(
    package_paths: list[Path],
    rubric_path: Path | None = None,
    evidence_path: Path | None = None,
    threshold: float = 0.8,
    answer_key_path: Path | None = None,
) -> ValidationReport:
    packages = [CasePackage.model_validate_json(path.read_text(encoding="utf-8")) for path in package_paths]
    rubric_payload = _read_json(rubric_path) if rubric_path else {}
    evidence_payload = _read_json(evidence_path) if evidence_path else []
    if isinstance(evidence_payload, dict):
        evidence_payload = evidence_payload.get("passages", [])
    answer_key = _read_answer_key(answer_key_path) if answer_key_path else None

    return run_validation(
        packages,
        ClinicianRubric.model_validate(rubric_payload),
        [EvidencePassage.model_validate(item) for item in evidence_payload],
        threshold=threshold,
        clinician_answer_key=answer_key,
    )


def _diagnosis_matches(student_text: str, acceptable_diagnoses: list[str]) -> bool:
    normalized_student_text = " ".join(str(student_text or "").lower().split())
    return any(
        " ".join(diagnosis.lower().split()) in normalized_student_text
        for diagnosis in acceptable_diagnoses
        if diagnosis.strip()
    )


def _disposition_matches(student_plan: str, actual_disposition: str) -> bool:
    plan = _normalize_disposition_text(student_plan)
    truth = _normalize_disposition_text(actual_disposition)
    if not plan or not truth:
        return False

    categories = {
        "admit": ["admit", "admitted", "admission", "inpatient", "monitored bed", "telemetry"],
        "discharge": ["discharge", "discharged", "home"],
        "observe": ["observation", "observe", "obs"],
        "transfer": ["transfer", "transferred"],
        "icu": ["icu", "intensive care", "critical care"],
    }
    truth_categories = {
        category
        for category, aliases in categories.items()
        if any(alias in truth for alias in aliases)
    }
    if truth_categories:
        return any(
            any(alias in plan for alias in categories[category])
            for category in truth_categories
        )
    return truth in plan


def _normalize_disposition_text(text: str) -> str:
    return " ".join(str(text or "").lower().replace("-", " ").split())


def _feedback_grounding_complete(feedback) -> bool:
    teaching_ok = all(
        _grounding_item_ok(
            grounded=bool(point.grounded),
            evidence_id=point.evidence_id,
            text=point.claim,
            note=point.claim,
        )
        for point in feedback.teaching_points
    )
    action_items = _flatten_action_feedback_items(feedback.action_feedback)
    action_ok = all(
        _grounding_item_ok(
            grounded=bool(item.get("grounded")),
            evidence_id=item.get("evidence_id"),
            text=item.get("message"),
            note=item.get("evidence_note"),
        )
        for item in action_items
    )
    workup_items = _flatten_action_feedback_items(feedback.workup_judgment.get("items", []))
    workup_ok = all(
        _grounding_item_ok(
            grounded=bool(item.get("grounded")),
            evidence_id=item.get("evidence_id"),
            text=item.get("message"),
            note=item.get("evidence_note"),
        )
        for item in workup_items
    )
    return teaching_ok and action_ok and workup_ok


def _flatten_action_feedback_items(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        if {"grounded", "message", "evidence_note"} <= set(value):
            return [value]
        items: list[dict[str, Any]] = []
        for nested in value.values():
            items.extend(_flatten_action_feedback_items(nested))
        return items
    if isinstance(value, list):
        items: list[dict[str, Any]] = []
        for nested in value:
            items.extend(_flatten_action_feedback_items(nested))
        return items
    return []


def _grounding_item_ok(*, grounded: bool, evidence_id: Any, text: Any, note: Any) -> bool:
    text_blob = f"{text or ''} {note or ''}".lower()
    if grounded:
        return bool(evidence_id) and "no evidence found" not in text_blob
    return not evidence_id and "no evidence found" in text_blob


def _read_json(path: Path | None) -> Any:
    if path is None:
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _read_answer_key(path: Path) -> dict[str, ClinicianAnswerKey]:
    payload = _read_json(path)
    if isinstance(payload, dict) and "cases" in payload:
        items = payload["cases"]
    elif isinstance(payload, dict) and all(isinstance(value, dict) for value in payload.values()):
        items = [{"case_id": case_id, **value} for case_id, value in payload.items()]
    elif isinstance(payload, list):
        items = payload
    else:
        items = [payload]
    return _normalize_answer_key([ClinicianAnswerKey.model_validate(item) for item in items])


def _normalize_answer_key(
    answer_key: dict[str, ClinicianAnswerKey] | list[ClinicianAnswerKey] | None,
) -> dict[str, ClinicianAnswerKey]:
    if answer_key is None:
        return {}
    if isinstance(answer_key, dict):
        if "cases" in answer_key:
            return _normalize_answer_key([ClinicianAnswerKey.model_validate(item) for item in answer_key.get("cases") or []])
        return {
            case_id: value if isinstance(value, ClinicianAnswerKey) else ClinicianAnswerKey.model_validate(value)
            for case_id, value in answer_key.items()
        }
    return {item.case_id: item for item in answer_key}


def _optional_agreement(rows: list[ValidationCaseResult], field: str) -> float | None:
    values = [getattr(row, field) for row in rows if getattr(row, field) is not None]
    if not values:
        return None
    return sum(values) / len(values)


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the grader validation release gate over completed case packages.")
    parser.add_argument("packages", nargs="+", type=Path, help="Completed CasePackage JSON file(s).")
    parser.add_argument("--rubric", type=Path, help="ClinicianRubric JSON file.")
    parser.add_argument("--evidence", type=Path, help="Evidence passages JSON file or {'passages': [...]} object.")
    parser.add_argument(
        "--answer-key",
        type=Path,
        help="Clinician answer key JSON file or {'cases': [...]} object; required for release validation to pass.",
    )
    parser.add_argument("--threshold", type=float, default=0.8, help="Minimum agreement required for each validation metric.")
    parser.add_argument("--output", type=Path, help="Optional path to write the JSON validation report.")
    args = parser.parse_args(argv)

    report = run_validation_from_files(
        args.packages,
        rubric_path=args.rubric,
        evidence_path=args.evidence,
        threshold=args.threshold,
        answer_key_path=args.answer_key,
    )
    rendered = report.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 1 if report.release_blocked else 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
