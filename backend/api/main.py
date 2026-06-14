from __future__ import annotations

import os
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.cases.loaders import load_local_cases
from backend.grader.grade import ClinicianRubric, EvidencePassage, grade_case_package_with_model
from backend.grader.package import CasePackage, assemble_case_package
from backend.grader.retrieval import retrieve_evidence_passages
from backend.llm.client import LLMClient
from backend.orders.catalog import get_order, search, serialize_order
from backend.personas.service import answer_persona
from backend.router.route import Intent, route_turn
from backend.state.context import consult_context, nurse_context, patient_context
from backend.state.engine import IMMEDIATE_ORDER_TYPES, EncounterEngine, SOAPNote, TokenUsageRecord, start_case


DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://tensor-lab-for-computational-medicine.github.io",
]


def configured_cors_origins() -> list[str]:
    extra = [origin.strip() for origin in os.getenv("ED_SIM_CORS_ORIGINS", "").split(",") if origin.strip()]
    return [*DEFAULT_CORS_ORIGINS, *extra]


app = FastAPI(title="ED Clinical Reasoning Simulator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_private_network=True,
)


@app.middleware("http")
async def allow_pages_private_network_response(request: Request, call_next):
    response = await call_next(request)
    if request.headers.get("origin") == "https://tensor-lab-for-computational-medicine.github.io":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


CASES = load_local_cases()
SESSIONS: dict[str, EncounterEngine] = {}
LLM = LLMClient()


class StartSessionRequest(BaseModel):
    case_id: str | None = None


class StudentAction(BaseModel):
    type: Literal[
        "free_text",
        "order",
        "intervention",
        "advance_time",
        "commit_esi",
        "commit_differential",
        "commit_soap",
        "complete",
    ]
    text: str | None = None
    order_id: str | None = None
    intervention_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    dt_minutes: float = 1


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ed-clinical-reasoning-simulator"}


@app.get("/api/cases")
async def cases() -> list[dict[str, Any]]:
    return [
        {
            "case_id": case.case_id,
            "title": case.title,
            "chief_complaint": case.visible_start.chief_complaint,
            "demographics": case.visible_start.demographics,
        }
        for case in CASES.values()
    ]


@app.post("/api/sessions")
async def start_session(request: StartSessionRequest) -> dict[str, Any]:
    case_id = request.case_id or next(iter(CASES))
    case = CASES.get(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    engine = start_case(case)
    SESSIONS[engine.state.session_id] = engine
    return _session_payload(engine)


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str) -> dict[str, Any]:
    return _session_payload(_get_engine(session_id))


@app.get("/api/orders/search")
async def search_orders(q: str = "") -> list[dict[str, Any]]:
    return [serialize_order(item) for item in search(q)]


@app.post("/api/sessions/{session_id}/actions")
async def handle_action(session_id: str, action: StudentAction) -> dict[str, Any]:
    engine = _get_engine(session_id)
    try:
        if engine.state.ended:
            raise HTTPException(status_code=400, detail="Encounter has ended; no further in-encounter actions are accepted.")

        _validate_action_before_advance(action)
        engine.advance(dt=action.dt_minutes)

        if action.type == "order":
            record = engine.apply_order(action.order_id)
            return _session_payload(engine, {"order": record.model_dump(mode="json")})

        if action.type == "intervention":
            record = engine.apply_intervention(action.intervention_id)
            return _session_payload(engine, {"order": record.model_dump(mode="json")})

        if action.type == "advance_time":
            return _session_payload(engine)

        if action.type == "commit_esi":
            commitment = engine.commit_esi(int(action.payload["level"]), action.payload.get("rationale", ""))
            return _session_payload(engine, {"esi_commitment": commitment.model_dump(mode="json")})

        if action.type == "commit_differential":
            differential = engine.commit_differential(_validated_differential_diagnoses(action.payload))
            return _session_payload(engine, {"differential": differential})

        if action.type == "commit_soap":
            soap = SOAPNote.model_validate(action.payload)
            engine.commit_soap(soap)
            return _session_payload(engine)

        if action.type == "complete":
            engine.complete_encounter()
            return _session_payload(engine, {"package_available": True})

        if action.type == "free_text":
            return await _handle_free_text(engine, action.text or "")
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    raise HTTPException(status_code=400, detail="unsupported action")


def _validate_action_before_advance(action: StudentAction) -> None:
    if action.dt_minutes < 0:
        raise HTTPException(status_code=400, detail="dt_minutes must be non-negative")

    if action.type == "order":
        if not action.order_id:
            raise HTTPException(status_code=400, detail="order_id is required")
        if get_order(action.order_id) is None:
            raise HTTPException(status_code=404, detail="unknown order")

    if action.type == "intervention":
        if not action.intervention_id:
            raise HTTPException(status_code=400, detail="intervention_id is required")
        order = get_order(action.intervention_id.strip().lower().replace(" ", "_"))
        if order is None:
            raise HTTPException(status_code=400, detail=f"unknown structured intervention: {action.intervention_id}")
        if order.type not in IMMEDIATE_ORDER_TYPES:
            raise HTTPException(status_code=400, detail=f"{order.id} is not a structured intervention, medication, or procedure.")

    if action.type == "commit_esi":
        if "level" not in action.payload:
            raise HTTPException(status_code=400, detail="ESI level is required")
        try:
            level = int(action.payload["level"])
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="ESI level must be an integer from 1 to 5") from exc
        if level < 1 or level > 5:
            raise HTTPException(status_code=400, detail="ESI level must be an integer from 1 to 5")

    if action.type == "commit_differential":
        _validated_differential_diagnoses(action.payload)

    if action.type == "commit_soap":
        try:
            SOAPNote.model_validate(action.payload)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


def _validated_differential_diagnoses(payload: dict[str, Any]) -> list[str]:
    raw_diagnoses = payload.get("diagnoses")
    if not isinstance(raw_diagnoses, list):
        raise HTTPException(status_code=400, detail="Differential diagnoses are required")
    if not all(isinstance(item, str) for item in raw_diagnoses):
        raise HTTPException(status_code=400, detail="Differential diagnoses must be text entries")

    diagnoses = [item.strip() for item in raw_diagnoses if item.strip()]
    if not diagnoses:
        raise HTTPException(status_code=400, detail="At least one differential diagnosis is required")
    return diagnoses


@app.get("/api/sessions/{session_id}/package")
async def get_package(session_id: str) -> dict[str, Any]:
    engine = _get_engine(session_id)
    try:
        package = assemble_case_package(engine.case, engine.state)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return package.model_dump(mode="json")


@app.post("/api/sessions/{session_id}/grade")
async def grade_session(session_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    engine = _get_engine(session_id)
    try:
        package = assemble_case_package(engine.case, engine.state)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    payload = payload or {}
    rubric = ClinicianRubric.model_validate(payload.get("rubric") or {})
    evidence = _grade_evidence(package, payload)
    feedback, usage = await grade_case_package_with_model(package, rubric, evidence, LLM)
    engine.record_usage(
        TokenUsageRecord(
            tier=usage.tier,
            model=usage.model,
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            estimated_cost_usd=usage.estimated_cost_usd,
            purpose=usage.purpose,
        )
    )
    return feedback.model_dump(mode="json")


def _grade_evidence(package: CasePackage, payload: dict[str, Any]) -> list[EvidencePassage]:
    supplied = [EvidencePassage.model_validate(item) for item in payload.get("evidence_passages", [])]
    if supplied:
        return supplied

    corpus_payload = payload.get("evidence_corpus", [])
    if isinstance(corpus_payload, dict):
        corpus_payload = corpus_payload.get("passages", [])
    corpus = [EvidencePassage.model_validate(item) for item in corpus_payload]
    try:
        limit = int(payload.get("evidence_limit", 3))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="evidence_limit must be an integer") from exc
    return retrieve_evidence_passages(package, corpus, limit=max(0, min(limit, 10)))


async def _handle_free_text(engine: EncounterEngine, text: str) -> dict[str, Any]:
    route = route_turn(text)
    engine.state.transcript.append(
        {
            "speaker": "student",
            "text": text,
            "elapsed_minutes": engine.state.elapsed_minutes,
            "metadata": {"type": "free_text", "route": route.model_dump(mode="json")},
        }
    )

    if route.intent == Intent.TYPED_ORDER_REDIRECT:
        message = "Use the order panel for labs, imaging, ECGs, medications, and procedures so the simulator can release source-recorded results."
        engine.state.transcript.append(
            {
                "speaker": "system",
                "text": message,
                "elapsed_minutes": engine.state.elapsed_minutes,
                "metadata": {"type": "order_redirect"},
            }
        )
        return _session_payload(engine, {"route": route.model_dump(mode="json"), "response": message})

    if route.handler == "commit":
        message = "I captured that as a commitment channel. Use the ESI, differential, or SOAP controls to save it structurally."
        engine.state.transcript.append(
            {
                "speaker": "system",
                "text": message,
                "elapsed_minutes": engine.state.elapsed_minutes,
                "metadata": {"type": "commit_redirect"},
            }
        )
        return _session_payload(engine, {"route": route.model_dump(mode="json"), "response": message})

    if route.persona == "nurse":
        context = nurse_context(engine.case, engine.state)
    elif route.persona == "consultant":
        context = consult_context(engine.case, engine.state, route.specialty or "consultant")
    else:
        context = patient_context(engine.case, engine.state, text)

    result = await answer_persona(route.persona or "patient", context, text, LLM)
    engine.record_usage(
        TokenUsageRecord(
            tier=result.tier,
            model=result.model,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            estimated_cost_usd=result.estimated_cost_usd,
            purpose=result.purpose,
        )
    )
    speaker = route.persona or "patient"
    engine.state.transcript.append(
        {
            "speaker": speaker,
            "text": result.text,
            "elapsed_minutes": engine.state.elapsed_minutes,
            "metadata": {"type": "persona_response", "route": route.model_dump(mode="json")},
        }
    )
    return _session_payload(engine, {"route": route.model_dump(mode="json"), "response": result.text})


def _get_engine(session_id: str) -> EncounterEngine:
    engine = SESSIONS.get(session_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="session not found")
    return engine


def _session_payload(engine: EncounterEngine, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = {
        "session_id": engine.state.session_id,
        "snapshot": engine.visible_snapshot().model_dump(mode="json"),
        "state": {
            "esi_history": [item.model_dump(mode="json") for item in engine.state.esi_history],
            "differential": list(engine.state.differential),
            "soap": engine.state.soap.model_dump(mode="json"),
            "completeness_flags": engine.state.completeness_flags.model_dump(mode="json"),
            "can_complete": engine.can_complete(),
            "ended": engine.state.ended,
            "transcript": [item.model_dump(mode="json") if hasattr(item, "model_dump") else item for item in engine.state.transcript],
            "token_usage": [item.model_dump(mode="json") for item in engine.state.token_usage],
        },
    }
    if extra:
        payload.update(extra)
    return payload
