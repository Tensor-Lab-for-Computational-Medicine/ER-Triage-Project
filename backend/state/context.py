from __future__ import annotations

from typing import Any

from backend.cases.schemas import PreparedCase, ResultBundle
from backend.state.engine import CaseState


def patient_context(case: PreparedCase, state: CaseState) -> dict[str, Any]:
    return {
        "role": "patient",
        "case_id": case.case_id,
        "chief_complaint": case.visible_start.chief_complaint,
        "demographics": case.visible_start.demographics,
        "current_vitals": state.current_vitals.model_dump(mode="json"),
        "appearance": _appearance(case, state),
        "hpi_facts": [fact.model_dump(mode="json") for fact in case.hpi_facts],
        "running_summary": state.running_summary,
    }


def nurse_context(case: PreparedCase, state: CaseState, scaffold_level: str = "medium") -> dict[str, Any]:
    return {
        "role": "nurse",
        "case_id": case.case_id,
        "chief_complaint": case.visible_start.chief_complaint,
        "current_vitals": state.current_vitals.model_dump(mode="json"),
        "previous_vitals": state.previous_vitals.model_dump(mode="json"),
        "appearance": _appearance(case, state),
        "active_orders": [record.model_dump(mode="json") for record in state.active_orders.values()],
        "interventions": list(state.interventions),
        "scaffold_level": scaffold_level,
        "running_summary": state.running_summary,
    }


def consult_context(case: PreparedCase, state: CaseState, specialty: str) -> dict[str, Any]:
    return {
        "role": "consultant",
        "specialty": specialty,
        "case_id": case.case_id,
        "chief_complaint": case.visible_start.chief_complaint,
        "demographics": case.visible_start.demographics,
        "current_vitals": state.current_vitals.model_dump(mode="json"),
        "resulted_orders": [
            record.result.model_dump(mode="json")
            for record in state.active_orders.values()
            if record.status == "resulted" and record.result is not None
        ],
        "interventions": list(state.interventions),
        "student_differential": list(state.differential),
        "running_summary": state.running_summary,
    }


def results_context(case: PreparedCase, state: CaseState, order_id: str) -> dict[str, Any]:
    record = state.active_orders.get(order_id)
    result: ResultBundle | None = record.result if record else None
    return {
        "role": "results",
        "order_id": order_id,
        "status": record.status if record else "not_ordered",
        "result": result.model_dump(mode="json") if result else None,
        "unavailable_reason": record.unavailable_reason if record else None,
    }


def _appearance(case: PreparedCase, state: CaseState) -> str:
    if state.current_vitals.spo2 < 90:
        return "Worsening dyspnea with visible respiratory distress."
    if "oxygen" in state.interventions and state.current_vitals.spo2 >= 94:
        return "Breathing more comfortably on oxygen."
    return case.visible_start.appearance
