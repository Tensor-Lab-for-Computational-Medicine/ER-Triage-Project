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
    PHYSICAL_EXAM = "physical_exam"
    TYPED_ORDER_REDIRECT = "typed_order_redirect"
    TYPED_INTERVENTION_REDIRECT = "typed_intervention_redirect"
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
_NURSE = re.compile(r"\b(nurse|repeat vitals|recheck vitals|bedside|monitor update|status update)\b", re.I)
_EXAM = re.compile(
    r"\b("
    r"physical exam|examine|exam|inspect|palpate|auscultate|listen to|look at|check pupils?|check pulses?|"
    r"heart sounds?|lung sounds?|breath sounds?|bowel sounds?|tenderness|guarding|rebound|"
    r"distention|distended|skin exam|neuro exam"
    r")\b",
    re.I,
)


def route_turn(text: str) -> Route:
    cleaned = " ".join(str(text or "").strip().split())
    lowered = cleaned.lower()

    typed_catalog_route = _typed_catalog_route(cleaned)
    if typed_catalog_route == "intervention":
        return Route(
            intent=Intent.TYPED_INTERVENTION_REDIRECT,
            handler="structured_intervention_redirect",
            redirect_to="interventions",
            rationale="Free-text contained finite catalog intervention language.",
        )
    if typed_catalog_route == "order":
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
    if _EXAM.search(cleaned):
        return Route(
            intent=Intent.PHYSICAL_EXAM,
            handler="physical_exam",
            context_builder="exam_context",
            redirect_to="exam",
            rationale="Physical exam maneuver detected.",
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


def _typed_catalog_route(text: str) -> str | None:
    if not _ORDER_VERBS.search(text):
        return None
    order_phrase = _ORDER_VERBS.sub("", text, count=1).strip(" :,-")
    matches = search(order_phrase or text, limit=3)
    if matches:
        top = matches[0]
        if top.type in {"intervention", "medication", "procedure"}:
            return "intervention"
        return "order"
    lowered = text.lower()
    if any(alias in lowered for alias in ["oxygen", "o2", "iv", "fluids", "analgesia", "pain medicine", "monitor"]):
        return "intervention"
    if any(alias in lowered for alias in ["cbc", "bmp", "cmp", "troponin", "d-dimer", "ddimer", "ct", "x-ray", "xray", "ecg", "ekg"]):
        return "order"
    return None


def _extract_specialty(lowered: str) -> str:
    for specialty in ["cardiology", "pulmonology", "critical care", "surgery", "neurology", "orthopedics", "radiology"]:
        if specialty in lowered:
            return specialty
    if "icu" in lowered:
        return "critical care"
    return "consultant"
