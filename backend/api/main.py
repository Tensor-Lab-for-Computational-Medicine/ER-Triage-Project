from __future__ import annotations

from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.cases.loaders import load_local_cases
from backend.grader.grade import ClinicianRubric, EvidencePassage, grade_case_package_with_model
from backend.grader.package import assemble_case_package
from backend.llm.client import LLMClient
from backend.orders.catalog import get_order, search, serialize_order
from backend.personas.service import answer_persona
from backend.router.route import Intent, route_turn
from backend.state.context import consult_context, nurse_context, patient_context
from backend.state.engine import EncounterEngine, SOAPNote, TokenUsageRecord, start_case


app = FastAPI(title="ED Clinical Reasoning Simulator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://tensor-lab-for-computational-medicine.github.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_private_network=True,
)

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
    case = engine.case
    try:
        engine.advance(dt=action.dt_minutes)

        if action.type == "order":
            if not action.order_id:
                raise HTTPException(status_code=400, detail="order_id is required")
            order = get_order(action.order_id)
            if order is None:
                raise HTTPException(status_code=404, detail="unknown order")
            record = engine.apply_order(action.order_id)
            if order.type in {"intervention", "medication"} and action.order_id in {"oxygen", "cardiac_monitor", "iv_access", "analgesia", "iv_fluids"}:
                engine.apply_intervention(action.order_id)
            return _session_payload(engine, {"order": record.model_dump(mode="json")})

        if action.type == "intervention":
            if not action.intervention_id:
                raise HTTPException(status_code=400, detail="intervention_id is required")
            engine.apply_intervention(action.intervention_id)
            return _session_payload(engine)

        if action.type == "commit_esi":
            commitment = engine.commit_esi(int(action.payload["level"]), action.payload.get("rationale", ""))
            return _session_payload(engine, {"esi_commitment": commitment.model_dump(mode="json")})

        if action.type == "commit_differential":
            differential = engine.commit_differential(list(action.payload.get("diagnoses", [])))
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
    evidence = [EvidencePassage.model_validate(item) for item in payload.get("evidence_passages", [])]
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
        context = patient_context(engine.case, engine.state)

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
