from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.cases.schemas import PreparedCase, VitalSigns
from backend.cases.source_gaps import build_source_gap_report
from backend.grader.package import CasePackage, assemble_case_package
from backend.state.context import consult_context, exam_context, nurse_context, patient_context, results_context
from backend.state.engine import IMMEDIATE_ORDER_TYPES, SOAPNote, TranscriptMessage, start_case


class PlaythroughAction(BaseModel):
    type: Literal[
        "ask_patient",
        "nurse_context",
        "call_consult",
        "exam_context",
        "result_context",
        "order",
        "intervention",
        "exam",
        "advance_time",
        "commit_esi",
        "commit_differential",
        "commit_soap",
        "complete",
    ]
    dt_minutes: float = 0
    text: str | None = None
    specialty: str | None = None
    order_id: str | None = None
    intervention_id: str | None = None
    exam_maneuver_id: str | None = None
    level: int | None = None
    rationale: str = ""
    diagnoses: list[str] = Field(default_factory=list)
    soap: dict[str, Any] = Field(default_factory=dict)


class PlaythroughStepResult(BaseModel):
    index: int
    type: str
    elapsed_minutes: float
    vitals: VitalSigns
    details: dict[str, Any] = Field(default_factory=dict)
    hidden_leakage: list[str] = Field(default_factory=list)


class PlaythroughSuccessChecklist(BaseModel):
    patient_question_asked: bool = False
    physical_exam_performed: bool = False
    consult_called: bool = False
    structured_order_placed: bool = False
    result_path_exercised: bool = False
    intervention_applied: bool = False
    vitals_changed_during_run: bool = False
    stabilization_addressed: bool = False
    esi_committed: bool = False
    esi_revised: bool = False
    differential_committed: bool = False
    assessment_and_plan_committed: bool = False
    completed: bool = False
    package_after_completion_only: bool = False
    no_hidden_leakage: bool = False
    no_fabricated_results: bool = False
    no_release_blocking_unavailable_orders: bool = False

    @property
    def passed(self) -> bool:
        return all(self.model_dump(mode="json").values())


class PlaythroughReport(BaseModel):
    case_id: str
    completed: bool
    can_complete: bool
    package_assembled: bool
    package_after_completion_only: bool
    elapsed_minutes: float
    steps: list[PlaythroughStepResult] = Field(default_factory=list)
    hidden_leakage: list[str] = Field(default_factory=list)
    fabricated_result_violations: list[str] = Field(default_factory=list)
    unavailable_orders: list[str] = Field(default_factory=list)
    pending_orders: list[str] = Field(default_factory=list)
    esi_revision_count: int = 0
    completeness_flags: dict[str, Any] = Field(default_factory=dict)
    success_checklist: PlaythroughSuccessChecklist = Field(default_factory=PlaythroughSuccessChecklist)
    objective_ready: bool = False

    @property
    def passed(self) -> bool:
        return (
            self.completed
            and self.package_assembled
            and self.package_after_completion_only
            and not self.hidden_leakage
            and not self.fabricated_result_violations
        )


def run_scripted_playthrough(case: PreparedCase, actions: list[PlaythroughAction | dict[str, Any]]) -> tuple[PlaythroughReport, CasePackage | None]:
    parsed_actions = [action if isinstance(action, PlaythroughAction) else PlaythroughAction.model_validate(action) for action in actions]
    engine = start_case(case, session_id="scripted-playthrough")
    package_after_completion_only = _package_blocked_before_completion(case, engine.state)
    steps: list[PlaythroughStepResult] = []
    hidden_leakage: list[str] = []
    package: CasePackage | None = None

    for index, action in enumerate(parsed_actions):
        if action.dt_minutes:
            engine.advance(dt=action.dt_minutes)
        details, payloads = _apply_action(case, engine, action)
        step_leaks = []
        for payload in payloads:
            step_leaks.extend(_hidden_terms_in_payload(case, payload))
        hidden_leakage.extend(f"{index}:{item}" for item in step_leaks)
        steps.append(
            PlaythroughStepResult(
                index=index,
                type=action.type,
                elapsed_minutes=engine.state.elapsed_minutes,
                vitals=engine.state.current_vitals.model_copy(deep=True),
                details=details,
                hidden_leakage=step_leaks,
            )
        )
        if action.type == "complete":
            package = assemble_case_package(case, engine.state)

    fabricated_result_violations = _fabricated_result_violations(case, engine.state.active_orders.values())
    esi_revision_count = max(0, len(engine.state.esi_history) - 1)
    completeness_flags = engine.state.completeness_flags.model_dump(mode="json")
    success_checklist = _build_success_checklist(
        parsed_actions=parsed_actions,
        engine=engine,
        steps=steps,
        package_after_completion_only=package_after_completion_only,
        hidden_leakage=hidden_leakage,
        fabricated_result_violations=fabricated_result_violations,
        esi_revision_count=esi_revision_count,
    )
    report = PlaythroughReport(
        case_id=case.case_id,
        completed=engine.state.ended,
        can_complete=engine.can_complete(),
        package_assembled=package is not None,
        package_after_completion_only=package_after_completion_only,
        elapsed_minutes=engine.state.elapsed_minutes,
        steps=steps,
        hidden_leakage=hidden_leakage,
        fabricated_result_violations=fabricated_result_violations,
        unavailable_orders=sorted(record.order_id for record in engine.state.active_orders.values() if record.status == "unavailable"),
        pending_orders=sorted(record.order_id for record in engine.state.active_orders.values() if record.status in {"ordered", "resulting"}),
        esi_revision_count=esi_revision_count,
        completeness_flags=completeness_flags,
        success_checklist=success_checklist,
        objective_ready=success_checklist.passed,
    )
    return report, package


def load_playthrough_actions(path: Path) -> list[PlaythroughAction]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        payload = payload.get("actions", [])
    if not isinstance(payload, list):
        raise ValueError("Playthrough script must be a list or an object with an actions list.")
    return [PlaythroughAction.model_validate(item) for item in payload]


def _apply_action(case: PreparedCase, engine, action: PlaythroughAction) -> tuple[dict[str, Any], list[Any]]:
    if action.type == "ask_patient":
        text = action.text or ""
        _append(engine, "student", text, {"type": "playthrough_patient_question"})
        context = patient_context(case, engine.state, text)
        return {"context_role": "patient", "released_hpi_count": len(context["hpi_facts"])}, [context]
    if action.type == "nurse_context":
        context = nurse_context(case, engine.state)
        return {"context_role": "nurse"}, [context]
    if action.type == "call_consult":
        context = consult_context(case, engine.state, action.specialty or "consultant")
        return {"context_role": "consultant", "specialty": context["specialty"]}, [context]
    if action.type == "exam_context":
        context = exam_context(case, engine.state, action.text or "")
        return {"context_role": "physical_exam", "matched_exam_count": len(context["matched_exam_facts"])}, [context]
    if action.type == "result_context":
        order_id = _required(action.order_id, "order_id")
        context = results_context(case, engine.state, order_id)
        return {"context_role": "results", "order_id": order_id, "status": context["status"]}, [context]
    if action.type == "order":
        record = engine.apply_order(_required(action.order_id, "order_id"))
        return {"order_id": record.order_id, "status": record.status}, []
    if action.type == "intervention":
        record = engine.apply_intervention(_required(action.intervention_id, "intervention_id"))
        return {"intervention_id": record.intervention_id, "effect_summary": record.effect_summary}, []
    if action.type == "exam":
        record = engine.perform_exam(_required(action.exam_maneuver_id, "exam_maneuver_id"))
        return {"exam_maneuver_id": record.maneuver_id, "source": record.source}, []
    if action.type == "advance_time":
        return {"advanced": True}, []
    if action.type == "commit_esi":
        if action.level is None:
            raise ValueError("commit_esi requires level")
        record = engine.commit_esi(action.level, action.rationale)
        return {"level": record.level, "revision_count": max(0, len(engine.state.esi_history) - 1)}, []
    if action.type == "commit_differential":
        diagnoses = engine.commit_differential(action.diagnoses)
        return {"diagnoses": diagnoses}, []
    if action.type == "commit_soap":
        soap = SOAPNote.model_validate(action.soap)
        engine.commit_soap(soap)
        return {"assessment_present": bool(soap.assessment.strip()), "plan_present": bool(soap.plan.strip())}, []
    if action.type == "complete":
        engine.complete_encounter()
        return {"completed": True}, []
    raise ValueError(f"unsupported action type: {action.type}")


def _append(engine, speaker: str, text: str, metadata: dict[str, Any]) -> None:
    engine.state.transcript.append(
        TranscriptMessage(
            speaker=speaker,
            text=text.strip(),
            elapsed_minutes=engine.state.elapsed_minutes,
            metadata=metadata,
        )
    )


def _package_blocked_before_completion(case: PreparedCase, state) -> bool:
    try:
        assemble_case_package(case, state)
    except ValueError:
        return True
    return False


def _fabricated_result_violations(case: PreparedCase, records) -> list[str]:
    violations: list[str] = []
    for record in records:
        if record.status == "resulted":
            if record.order_type in IMMEDIATE_ORDER_TYPES:
                if not record.result or record.result.source != "simulator":
                    violations.append(f"{record.order_id}: immediate structured action missing simulator result marker")
                continue
            if record.order_id not in case.result_bundles:
                if not record.result or record.result.source != "simulator-default":
                    violations.append(f"{record.order_id}: resulted without source-recorded case result or simulator-default marker")
                elif record.result.source_reference.get("fallback_reason") != "no_encounter_linked_source_result":
                    violations.append(f"{record.order_id}: simulator-default result missing fallback provenance")
        if record.status == "unavailable" and record.result is not None:
            violations.append(f"{record.order_id}: unavailable order carried a result")
    return violations


def _build_success_checklist(
    *,
    parsed_actions: list[PlaythroughAction],
    engine,
    steps: list[PlaythroughStepResult],
    package_after_completion_only: bool,
    hidden_leakage: list[str],
    fabricated_result_violations: list[str],
    esi_revision_count: int,
) -> PlaythroughSuccessChecklist:
    flags = engine.state.completeness_flags
    release_blocking_unavailable = _release_blocking_unavailable_orders(engine)
    return PlaythroughSuccessChecklist(
        patient_question_asked=any(action.type == "ask_patient" and bool((action.text or "").strip()) for action in parsed_actions),
        physical_exam_performed=bool(engine.state.performed_exams),
        consult_called=any(action.type == "call_consult" for action in parsed_actions),
        structured_order_placed=any(action.type == "order" for action in parsed_actions),
        result_path_exercised=_result_path_exercised(parsed_actions, engine),
        intervention_applied=bool(engine.state.interventions),
        vitals_changed_during_run=_vitals_changed(engine.case.trajectory.starting_vitals, [step.vitals for step in steps]),
        stabilization_addressed=flags.abcde_addressed,
        esi_committed=flags.esi_committed,
        esi_revised=esi_revision_count > 0,
        differential_committed=bool(engine.state.differential),
        assessment_and_plan_committed=flags.assessment_committed and flags.plan_committed,
        completed=engine.state.ended,
        package_after_completion_only=package_after_completion_only,
        no_hidden_leakage=not hidden_leakage,
        no_fabricated_results=not fabricated_result_violations,
        no_release_blocking_unavailable_orders=not release_blocking_unavailable,
    )


def _result_path_exercised(parsed_actions: list[PlaythroughAction], engine) -> bool:
    requested_result_order_ids = {
        action.order_id
        for action in parsed_actions
        if action.type == "result_context" and action.order_id
    }

    def is_source_backed_result(record) -> bool:
        return (
            record.status == "resulted"
            and record.order_type not in IMMEDIATE_ORDER_TYPES
            and record.order_id in engine.case.result_bundles
            and record.result is not None
        )

    if requested_result_order_ids:
        return any(
            record.order_id in requested_result_order_ids and is_source_backed_result(record)
            for record in engine.state.active_orders.values()
        )
    return any(is_source_backed_result(record) for record in engine.state.active_orders.values())


def _release_blocking_unavailable_orders(engine) -> list[str]:
    blocking_order_ids = _release_blocking_candidate_order_ids(engine.case)
    if not blocking_order_ids:
        return []
    return sorted(
        record.order_id
        for record in engine.state.active_orders.values()
        if record.status == "unavailable" and record.order_id in blocking_order_ids
    )


def _release_blocking_candidate_order_ids(case: PreparedCase) -> set[str]:
    report = build_source_gap_report(case)
    return {
        str(order_id)
        for item in report.release_blocking_missing_results
        for order_id in item.get("candidate_order_ids", [])
        if order_id
    }


def _vitals_changed(starting_vitals: VitalSigns, observed_vitals: list[VitalSigns]) -> bool:
    baseline = _vitals_signature(starting_vitals)
    return any(_vitals_signature(vitals) != baseline for vitals in observed_vitals)


def _vitals_signature(vitals: VitalSigns) -> tuple[float | int | None, ...]:
    return (vitals.temp_c, vitals.hr, vitals.sbp, vitals.dbp, vitals.rr, vitals.spo2, vitals.pain)


def _hidden_terms_in_payload(case: PreparedCase, payload: Any) -> list[str]:
    text = json.dumps(payload, default=str).lower()
    final_diagnosis_scan_payload = _without_allowed_ordered_result_text(payload)
    final_diagnosis_text = json.dumps(final_diagnosis_scan_payload, default=str).lower()
    terms = {
        "hidden_truth": "hidden_truth",
        "validated_esi": "validated_esi",
        "actual_disposition": case.hidden_truth.actual_disposition,
    }
    leaked = []
    for label, value in terms.items():
        normalized = " ".join(str(value or "").lower().split())
        if normalized and normalized in text:
            leaked.append(label)
    final_diagnosis = " ".join(str(case.hidden_truth.final_diagnosis or "").lower().split())
    if final_diagnosis and final_diagnosis in final_diagnosis_text:
        leaked.append("final_diagnosis")
    return leaked


def _without_allowed_ordered_result_text(payload: Any) -> Any:
    if isinstance(payload, dict):
        role = payload.get("role")
        if role == "results":
            return {key: (None if key == "result" else _without_allowed_ordered_result_text(value)) for key, value in payload.items()}
        if role == "consultant":
            return {
                key: ([] if key == "resulted_orders" else _without_allowed_ordered_result_text(value))
                for key, value in payload.items()
            }
        return {key: _without_allowed_ordered_result_text(value) for key, value in payload.items()}
    if isinstance(payload, list):
        return [_without_allowed_ordered_result_text(item) for item in payload]
    return payload


def _required(value: str | None, field: str) -> str:
    if not value:
        raise ValueError(f"{field} is required")
    return value


def _main() -> int:
    parser = argparse.ArgumentParser(description="Run a hidden-safe scripted playthrough against one PreparedCase.")
    parser.add_argument("case", type=Path, help="PreparedCase JSON.")
    parser.add_argument("--script", required=True, type=Path, help="Playthrough JSON action list or {'actions': [...]} object.")
    parser.add_argument("--output", type=Path, help="Optional playthrough report path.")
    parser.add_argument("--package-output", type=Path, help="Optional CasePackage output path; written only after successful completion.")
    args = parser.parse_args()

    case = PreparedCase.model_validate_json(args.case.read_text(encoding="utf-8"))
    report, package = run_scripted_playthrough(case, load_playthrough_actions(args.script))
    rendered = report.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    if args.package_output and package:
        args.package_output.parent.mkdir(parents=True, exist_ok=True)
        args.package_output.write_text(package.model_dump_json(indent=2) + "\n", encoding="utf-8")
    return 0 if report.objective_ready else 1


if __name__ == "__main__":
    raise SystemExit(_main())
