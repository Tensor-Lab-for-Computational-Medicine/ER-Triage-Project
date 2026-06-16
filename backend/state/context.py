from __future__ import annotations

import hashlib
import re
from typing import Any

from backend.cases.schemas import PreparedCase, ResultBundle
from backend.state.engine import CaseState


def patient_context(case: PreparedCase, state: CaseState, student_text: str | None = None) -> dict[str, Any]:
    return {
        "role": "patient",
        "case_id": case.case_id,
        "chief_complaint": case.visible_start.chief_complaint,
        "demographics": case.visible_start.demographics,
        "patient_identity": _patient_identity(case),
        "mental_status": "Awake, anxious, and oriented unless the live state or appearance says otherwise.",
        "communication_style": "Sick ED patient; brief lay-language answers, shorter when dyspneic.",
        "current_vitals": state.current_vitals.model_dump(mode="json"),
        "appearance": _appearance(case, state),
        "hpi_facts": _released_hpi_facts(case, student_text),
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


def exam_context(case: PreparedCase, state: CaseState, student_text: str | None = None) -> dict[str, Any]:
    return {
        "role": "physical_exam",
        "case_id": case.case_id,
        "chief_complaint": case.visible_start.chief_complaint,
        "current_vitals": state.current_vitals.model_dump(mode="json"),
        "appearance": _appearance(case, state),
        "matched_exam_facts": _matched_exam_facts(case, student_text),
        "running_summary": state.running_summary,
    }


def results_context(case: PreparedCase, state: CaseState, order_id: str) -> dict[str, Any]:
    record = state.active_orders.get(order_id)
    result: ResultBundle | None = record.result if record else None
    return {
        "role": "results",
        "order_id": order_id,
        "status": record.status if record else "not_ordered",
        "result": _learner_result_payload(record, result) if result else None,
        "unavailable_reason": record.unavailable_reason if record else None,
    }


def _appearance(case: PreparedCase, state: CaseState) -> str:
    if state.current_vitals.spo2 < 90:
        return "Worsening dyspnea with visible respiratory distress."
    if "oxygen" in state.interventions and state.current_vitals.spo2 >= 94:
        return "Breathing more comfortably on oxygen."
    if "analgesia" in state.interventions and state.current_vitals.pain is not None and state.current_vitals.pain <= 4:
        return "More comfortable after analgesia, still requiring focused reassessment."
    return case.visible_start.appearance


def _learner_result_payload(record: Any, result: ResultBundle) -> dict[str, Any]:
    payload = result.model_dump(mode="json")
    if record and result.source == "simulator-default":
        display_name = getattr(record, "display_name", "").lower()
        if "ecg" in display_name or "ekg" in display_name or "12-lead" in display_name:
            payload["values"] = []
            payload["narrative"] = None
    return payload


def _patient_identity(case: PreparedCase) -> dict[str, Any]:
    demographics = case.visible_start.demographics
    explicit_name = str(demographics.get("name") or demographics.get("display_name") or "").strip()
    if explicit_name:
        name = explicit_name
    else:
        digest = hashlib.sha256(case.case_id.encode("utf-8")).digest()
        sex = str(demographics.get("sex") or "").lower()
        feminine = ["Maria Carter", "Denise Harris", "Angela Brooks", "Laura Simmons", "Karen Mitchell"]
        masculine = ["James Carter", "Robert Harris", "Daniel Brooks", "Michael Simmons", "Anthony Mitchell"]
        neutral = ["Alex Carter", "Jordan Harris", "Taylor Brooks", "Morgan Simmons", "Casey Mitchell"]
        names = feminine if sex.startswith("f") else masculine if sex.startswith("m") else neutral
        name = names[digest[0] % len(names)]
    return {
        "name": name,
        "age": demographics.get("age"),
        "sex": demographics.get("sex"),
    }


def _released_hpi_facts(case: PreparedCase, student_text: str | None) -> list[dict[str, Any]]:
    asked = " ".join(str(student_text or "").lower().split())
    if not asked:
        return []
    return [
        {
            "id": fact.id,
            "topic": fact.topic,
            "triggers": list(fact.triggers),
            "lay_response": fact.lay_response,
        }
        for fact in case.hpi_facts
        if any(trigger.lower() in asked for trigger in fact.triggers)
    ]


def _matched_exam_facts(case: PreparedCase, student_text: str | None) -> list[dict[str, Any]]:
    asked = " ".join(str(student_text or "").lower().split())
    if not asked:
        return []
    return [
        {
            "id": fact.id,
            "system": fact.system,
            "finding": fact.finding,
            "source": fact.source,
        }
        for fact in case.exam_facts
        if any(_contains_trigger(asked, trigger) for trigger in fact.triggers)
    ]


def _contains_trigger(text: str, trigger: str) -> bool:
    normalized = " ".join(str(trigger or "").lower().split())
    if not normalized:
        return False
    return re.search(rf"(?<!\w){re.escape(normalized)}(?!\w)", text) is not None
