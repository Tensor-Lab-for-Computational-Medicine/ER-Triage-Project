from __future__ import annotations

import re
from enum import Enum

from pydantic import BaseModel

from backend.orders.catalog import search


class Intent(str, Enum):
    ASSIGN_ESI = "assign_esi"
    COMMIT_DIFFERENTIAL = "commit_differential"
    WRITE_SOAP = "write_soap"
    CALL_CONSULT = "call_consult"
    NURSING_TASK = "nursing_task"
    TYPED_ORDER_REDIRECT = "typed_order_redirect"
    PATIENT = "patient"


class Route(BaseModel):
    intent: Intent
    handler: str
    persona: str | None = None
    context_builder: str | None = None
    specialty: str | None = None
    redirect_to: str | None = None
    rationale: str


_ORDER_VERBS = re.compile(r"\b(order|send|draw|get|obtain|start|give|administer|place)\b", re.I)
_ESI = re.compile(r"\b(esi|emergency severity index|triage level|level\s*[1-5])\b", re.I)
_SOAP = re.compile(r"\b(soap|assessment and plan|a/p|subjective|objective|assessment|plan)\b", re.I)
_DIFFERENTIAL = re.compile(r"\b(differential|ddx|diagnosis list|working diagnosis|rank)\b", re.I)
_CONSULT = re.compile(r"\b(consult|call|page|speak with)\b", re.I)
_NURSE = re.compile(r"\b(nurse|repeat vitals|recheck|bedside|monitor|update|can you)\b", re.I)


def route_turn(text: str) -> Route:
    cleaned = " ".join(str(text or "").strip().split())
    lowered = cleaned.lower()

    if _looks_like_typed_order(cleaned):
        return Route(
            intent=Intent.TYPED_ORDER_REDIRECT,
            handler="structured_order_redirect",
            redirect_to="orders",
            rationale="Free-text contained finite catalog order language.",
        )
    if _ESI.search(cleaned):
        return Route(intent=Intent.ASSIGN_ESI, handler="commit", rationale="ESI commitment language detected.")
    if _SOAP.search(cleaned):
        return Route(intent=Intent.WRITE_SOAP, handler="commit", rationale="SOAP or assessment/plan language detected.")
    if _DIFFERENTIAL.search(cleaned):
        return Route(intent=Intent.COMMIT_DIFFERENTIAL, handler="commit", rationale="Differential commitment language detected.")
    if _CONSULT.search(cleaned):
        specialty = _extract_specialty(lowered)
        return Route(
            intent=Intent.CALL_CONSULT,
            handler="persona",
            persona="consultant",
            context_builder="consult_context",
            specialty=specialty,
            rationale="Consult call language detected.",
        )
    if _NURSE.search(cleaned):
        return Route(
            intent=Intent.NURSING_TASK,
            handler="persona",
            persona="nurse",
            context_builder="nurse_context",
            rationale="Nursing task/update language detected.",
        )
    return Route(
        intent=Intent.PATIENT,
        handler="persona",
        persona="patient",
        context_builder="patient_context",
        rationale="Default free-text channel routes to patient.",
    )


def _looks_like_typed_order(text: str) -> bool:
    if not _ORDER_VERBS.search(text):
        return False
    order_phrase = _ORDER_VERBS.sub("", text, count=1).strip(" :,-")
    matches = search(order_phrase or text, limit=3)
    if matches:
        return True
    lowered = text.lower()
    return any(alias in lowered for alias in ["cbc", "cmp", "troponin", "d-dimer", "ddimer", "ct", "x-ray", "xray", "ecg", "ekg", "oxygen", "iv"])


def _extract_specialty(lowered: str) -> str:
    for specialty in ["cardiology", "pulmonology", "critical care", "surgery", "neurology", "orthopedics", "radiology"]:
        if specialty in lowered:
            return specialty
    if "icu" in lowered:
        return "critical care"
    return "consultant"
