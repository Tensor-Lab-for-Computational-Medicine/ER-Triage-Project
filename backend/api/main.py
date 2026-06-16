from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError

from backend.cases.loaders import load_local_cases
from backend.cases.prepare import CasePreparationError
from backend.cases.review import assert_grader_validation_review_ready
from backend.exams.catalog import get_maneuver, browse_tree, search_exams, serialize_maneuver
from backend.grader.grade import ClinicianRubric, EvidencePassage, grade_case_package_with_model
from backend.grader.package import CasePackage, assemble_case_package
from backend.grader.retrieval import retrieve_evidence_passages
from backend.llm.client import LLMClient, LLMConfig, LLMConfigurationError, LLMMessage
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


CASES = load_local_cases(Path(os.getenv("ED_SIM_CASE_DIR")) if os.getenv("ED_SIM_CASE_DIR") else None)
DEFAULT_CASE_ID = os.getenv("ED_SIM_DEFAULT_CASE_ID", "").strip() or None
SESSIONS: dict[str, EncounterEngine] = {}
LLM = LLMClient()
ALLOW_MOCK_LLM = os.getenv("ED_SIM_ALLOW_MOCK_LLM", "").strip().lower() in {"1", "true", "yes", "on"}
ALLOW_UNVALIDATED_GRADER = os.getenv("ED_SIM_ALLOW_UNVALIDATED_GRADER", "").strip().lower() in {"1", "true", "yes", "on"}


class StartSessionRequest(BaseModel):
    case_id: str | None = None


class StudentAction(BaseModel):
    type: Literal[
        "free_text",
        "add_note",
        "exam",
        "order",
        "intervention",
        "advance_time",
        "commit_esi",
        "commit_differential",
        "commit_soap",
        "complete",
    ]
    text: str | None = None
    exam_maneuver_id: str | None = None
    order_id: str | None = None
    intervention_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    dt_minutes: float = 1


class ConfigureLLMRequest(BaseModel):
    provider: Literal["openai", "openai_responses", "openai_compatible", "chat_completions", "openrouter"] = "openai_responses"
    api_key: str
    base_url: str | None = None
    cheap_model: str | None = None
    strong_model: str | None = None


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ed-clinical-reasoning-simulator"}


@app.get("/api/llm/status")
async def llm_status() -> dict[str, Any]:
    return _llm_status_payload()


@app.post("/api/llm/config")
async def configure_llm(request: ConfigureLLMRequest) -> dict[str, Any]:
    global LLM
    api_key = request.api_key.strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is required.")

    provider = request.provider.strip().lower().replace("-", "_")
    if provider == "openrouter":
        provider = "openai_compatible"
    if provider in {"openai", "openai_responses"}:
        base_url = request.base_url or "https://api.openai.com/v1/responses"
    else:
        base_url = request.base_url or ""
        if not base_url:
            if _looks_like_openrouter_key(api_key):
                base_url = "https://openrouter.ai/api/v1/chat/completions"
            else:
                raise HTTPException(status_code=400, detail="Base URL is required for an OpenAI-compatible provider.")

    cheap_model = request.cheap_model or ("openai/gpt-4o-mini" if _looks_like_openrouter_key(api_key) else "gpt-5.4-mini")
    strong_model = request.strong_model or ("openai/gpt-4o" if _looks_like_openrouter_key(api_key) else "gpt-5.5")
    candidate = LLMClient(
        LLMConfig(
            provider=provider,
            api_key=api_key,
            base_url=base_url,
            cheap_model=cheap_model,
            strong_model=strong_model,
        )
    )
    try:
        await _validate_llm_candidate(candidate)
    except LLMConfigurationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=400, detail=_provider_http_error_message(exc, provider, api_key)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=400, detail=f"AI provider validation failed: {exc.__class__.__name__}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"AI provider validation failed: {exc}") from exc

    LLM = candidate
    return _llm_status_payload()


@app.get("/api/cases")
async def cases() -> list[dict[str, Any]]:
    return [
        {
            "case_id": case.case_id,
            "title": case.title,
            "chief_complaint": case.visible_start.chief_complaint,
            "demographics": case.visible_start.demographics,
            "case_status": _case_status_payload(case),
        }
        for case in CASES.values()
    ]


@app.post("/api/sessions")
async def start_session(request: StartSessionRequest) -> dict[str, Any]:
    case_id = request.case_id or DEFAULT_CASE_ID or next(iter(CASES))
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
async def search_orders(q: str = "", limit: int = 100) -> list[dict[str, Any]]:
    return [serialize_order(item) for item in search(q, limit=max(1, min(limit, 200)))]


@app.get("/api/exams/catalog")
async def exam_catalog() -> dict[str, Any]:
    return {
        "tree": browse_tree(),
        "items": [serialize_maneuver(item) for item in search_exams("", limit=1000)],
    }


@app.get("/api/exams/search")
async def search_exam_maneuvers(q: str = "", limit: int = 12) -> list[dict[str, Any]]:
    return [serialize_maneuver(item) for item in search_exams(q, limit=max(1, min(limit, 100)))]


@app.post("/api/sessions/{session_id}/actions")
async def handle_action(session_id: str, action: StudentAction) -> dict[str, Any]:
    engine = _get_engine(session_id)
    try:
        if engine.state.ended:
            raise HTTPException(status_code=400, detail="Encounter has ended; no further in-encounter actions are accepted.")

        _validate_action_before_advance(action, engine)
        route = route_turn(action.text or "") if action.type == "free_text" else None
        if route and route.handler == "persona":
            _ensure_llm_ready_for_ai_call()
        engine.advance(dt=action.dt_minutes)

        if action.type == "exam":
            record = engine.perform_exam(action.exam_maneuver_id or "")
            return _session_payload(engine, {"exam": record.model_dump(mode="json")})

        if action.type == "order":
            record = engine.apply_order(action.order_id)
            return _session_payload(engine, {"order": record.model_dump(mode="json")})

        if action.type == "intervention":
            record = engine.apply_intervention(action.intervention_id)
            order = engine.state.active_orders.get(record.intervention_id)
            extra: dict[str, Any] = {"intervention": record.model_dump(mode="json")}
            if order:
                extra["order"] = order.model_dump(mode="json")
            return _session_payload(engine, extra)

        if action.type == "advance_time":
            return _session_payload(engine)

        if action.type == "add_note":
            note_text = (action.text or "").strip()
            engine.state.transcript.append(
                {
                    "speaker": "student",
                    "text": note_text,
                    "elapsed_minutes": engine.state.elapsed_minutes,
                    "metadata": {"type": "clinical_note"},
                }
            )
            return _session_payload(engine)

        if action.type == "commit_esi":
            level, rationale = _validated_esi_commitment(action.payload)
            commitment = engine.commit_esi(level, rationale)
            return _session_payload(engine, {"esi_commitment": commitment.model_dump(mode="json")})

        if action.type == "commit_differential":
            differential = engine.commit_differential(_validated_differential_diagnoses(action.payload))
            return _session_payload(engine, {"differential": differential})

        if action.type == "commit_soap":
            soap = _validated_soap_note(action.payload)
            engine.commit_soap(soap)
            return _session_payload(engine)

        if action.type == "complete":
            engine.complete_encounter()
            return _session_payload(engine, {"package_available": True})

        if action.type == "free_text":
            return await _handle_free_text(engine, action.text or "", route)
    except HTTPException:
        raise
    except LLMConfigurationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        provider_name = LLM.provider_name()
        if exc.response.status_code == 401:
            _disconnect_llm()
        raise HTTPException(status_code=502, detail=_provider_http_error_message(exc, provider_name, "")) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"AI provider request failed: {exc.__class__.__name__}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    raise HTTPException(status_code=400, detail="unsupported action")


def _validate_action_before_advance(action: StudentAction, engine: EncounterEngine) -> None:
    if action.dt_minutes < 0:
        raise HTTPException(status_code=400, detail="dt_minutes must be non-negative")

    if action.type == "free_text" and not str(action.text or "").strip():
        raise HTTPException(status_code=400, detail="free_text actions require non-empty text")

    if action.type == "add_note" and not str(action.text or "").strip():
        raise HTTPException(status_code=400, detail="add_note actions require non-empty text")

    if action.type == "exam":
        if not action.exam_maneuver_id:
            raise HTTPException(status_code=400, detail="exam_maneuver_id is required")
        if get_maneuver(action.exam_maneuver_id) is None:
            raise HTTPException(status_code=404, detail="unknown exam maneuver")

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
        _validated_esi_commitment(action.payload)

    if action.type == "commit_differential":
        _validated_differential_diagnoses(action.payload)

    if action.type == "commit_soap":
        _validated_soap_note(action.payload)

    if action.type == "complete" and not engine.can_complete():
        raise HTTPException(status_code=400, detail="Assessment and Plan are required before completing the case.")


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


def _validated_esi_commitment(payload: dict[str, Any]) -> tuple[int, str]:
    if "level" not in payload:
        raise HTTPException(status_code=400, detail="ESI level is required")
    try:
        level = int(payload["level"])
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="ESI level must be an integer from 1 to 5") from exc
    if level < 1 or level > 5:
        raise HTTPException(status_code=400, detail="ESI level must be an integer from 1 to 5")

    rationale = payload.get("rationale", "")
    if rationale is None:
        rationale = ""
    if not isinstance(rationale, str):
        raise HTTPException(status_code=400, detail="ESI rationale must be text")
    return level, rationale.strip()


def _validated_soap_note(payload: dict[str, Any]) -> SOAPNote:
    try:
        soap = SOAPNote.model_validate(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not soap.assessment.strip() or not soap.plan.strip():
        raise HTTPException(status_code=400, detail="SOAP Assessment and Plan are required")
    return SOAPNote(
        subjective=soap.subjective.strip(),
        objective=soap.objective.strip(),
        assessment=soap.assessment.strip(),
        plan=soap.plan.strip(),
    )


@app.get("/api/sessions/{session_id}/package")
async def get_package(session_id: str) -> dict[str, Any]:
    engine = _get_engine(session_id)
    _ensure_case_ended(engine)
    _ensure_grader_validated_for_feedback(engine, surface="Case package")
    package = assemble_case_package(engine.case, engine.state)
    return package.model_dump(mode="json")


@app.post("/api/sessions/{session_id}/grade")
async def grade_session(session_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    engine = _get_engine(session_id)
    _ensure_case_ended(engine)
    _ensure_grader_validated_for_feedback(engine)
    try:
        _ensure_llm_ready_for_ai_call()
    except LLMConfigurationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    package = assemble_case_package(engine.case, engine.state)
    payload = payload or {}
    try:
        rubric = ClinicianRubric.model_validate(payload.get("rubric")) if payload.get("rubric") is not None else _default_rubric(package)
        evidence = _grade_evidence(package, payload)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail={"message": "Invalid grading payload", "errors": exc.errors()}) from exc
    try:
        feedback, usage = await grade_case_package_with_model(package, rubric, evidence, LLM)
    except LLMConfigurationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        provider_name = LLM.provider_name()
        if exc.response.status_code == 401:
            _disconnect_llm()
        raise HTTPException(status_code=502, detail=_provider_http_error_message(exc, provider_name, "")) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"AI provider request failed: {exc.__class__.__name__}") from exc
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

    corpus_payload = payload.get("evidence_corpus", [item.model_dump(mode="json") for item in package.evidence_corpus])
    if isinstance(corpus_payload, dict):
        corpus_payload = corpus_payload.get("passages", [])
    corpus = [EvidencePassage.model_validate(item) for item in corpus_payload]
    try:
        limit = int(payload.get("evidence_limit", 3))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="evidence_limit must be an integer") from exc
    return retrieve_evidence_passages(package, corpus, limit=max(0, min(limit, 10)))


def _default_rubric(package: CasePackage) -> ClinicianRubric:
    return ClinicianRubric(
        expected_diagnoses=list(package.rubric.expected_diagnoses),
        expected_orders=list(package.rubric.expected_orders),
        expected_exams=[entry.id for entry in package.rubric.indicated_exams],
        expected_interventions=[entry.id for entry in package.rubric.indicated_interventions],
        excessive_interventions=[entry.id for entry in package.rubric.excessive_interventions],
        critical_actions=list(package.rubric.critical_actions),
        esi_tolerance=package.rubric.esi_tolerance,
    )


def _ensure_case_ended(engine: EncounterEngine) -> None:
    if not engine.state.ended:
        raise HTTPException(status_code=400, detail="CasePackage can only be assembled after end_encounter.")


def _ensure_grader_validated_for_feedback(engine: EncounterEngine, *, surface: str = "Grader feedback") -> None:
    if engine.case.review_status.grader_clinician_validated and engine.case.review_status.grader_validation_review:
        try:
            assert_grader_validation_review_ready(
                engine.case.review_status.grader_validation_review,
                release_case_id=engine.case.case_id,
            )
            return
        except (CasePreparationError, ValidationError, ValueError) as exc:
            if not ALLOW_UNVALIDATED_GRADER:
                raise HTTPException(
                    status_code=403,
                    detail=f"{surface} is unavailable because the case review artifact is invalid: {exc}",
                ) from exc
    if ALLOW_UNVALIDATED_GRADER:
        return
    raise HTTPException(
        status_code=403,
        detail=(
            f"{surface} is unavailable because this case has not passed clinician validation. "
            "Run backend.grader.validate with a clinician answer key, then apply a case review artifact "
            "with backend.cases.review only after the release threshold passes."
        ),
    )


def _case_status_payload(case) -> dict[str, Any]:
    feedback_validated = _case_feedback_validated(case)
    return {
        "trajectory_signed_off": bool(case.review_status.trajectory_clinician_signed_off),
        "grader_feedback_validated": feedback_validated,
        "playthrough_signed_off": bool(case.review_status.playthrough_clinician_signed_off),
        "feedback_locked": not feedback_validated,
        "feedback_lock_reason": "" if feedback_validated else "Grader feedback is unavailable until this case has passed clinician validation.",
    }


def _case_feedback_validated(case) -> bool:
    if not case.review_status.grader_clinician_validated or not case.review_status.grader_validation_review:
        return False
    try:
        assert_grader_validation_review_ready(
            case.review_status.grader_validation_review,
            release_case_id=case.case_id,
        )
    except (CasePreparationError, ValidationError, ValueError):
        return False
    return True


async def _handle_free_text(engine: EncounterEngine, text: str, route=None) -> dict[str, Any]:
    route = route or route_turn(text)

    if route.intent == Intent.TYPED_ORDER_REDIRECT:
        _append_student_turn(engine, text, route)
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

    if route.intent == Intent.TYPED_INTERVENTION_REDIRECT:
        _append_student_turn(engine, text, route)
        message = "Use the intervention controls for monitor, oxygen, IV access, fluids, analgesia, medications, and procedures so the simulator can mutate deterministic state."
        engine.state.transcript.append(
            {
                "speaker": "system",
                "text": message,
                "elapsed_minutes": engine.state.elapsed_minutes,
                "metadata": {"type": "intervention_redirect"},
            }
        )
        return _session_payload(engine, {"route": route.model_dump(mode="json"), "response": message})

    if route.handler == "commit":
        _append_student_turn(engine, text, route)
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

    if route.intent == Intent.PHYSICAL_EXAM:
        _append_student_turn(engine, text, route)
        message = "Use the Exam panel to choose a region, maneuver type, and specific maneuver so findings come only from authored case data."
        engine.state.transcript.append(
            {
                "speaker": "system",
                "text": message,
                "elapsed_minutes": engine.state.elapsed_minutes,
                "metadata": {
                    "type": "exam_redirect",
                    "route": route.model_dump(mode="json"),
                },
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
    _append_student_turn(engine, text, route)
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


def _append_student_turn(engine: EncounterEngine, text: str, route) -> None:
    engine.state.transcript.append(
        {
            "speaker": "student",
            "text": text,
            "elapsed_minutes": engine.state.elapsed_minutes,
            "metadata": {"type": "free_text", "route": route.model_dump(mode="json")},
        }
    )


def _llm_status_payload() -> dict[str, Any]:
    status = LLM.status()
    provider = str(status.get("provider") or "")
    real_provider_ready = bool(status.get("configured")) and provider != "mock"
    mock_ready = bool(status.get("configured")) and provider == "mock" and ALLOW_MOCK_LLM
    ready = real_provider_ready or mock_ready
    message = "AI connected." if ready else "AI provider is not configured. Patient, nurse, consultant, and grader AI calls are disabled."
    if provider == "mock" and not ALLOW_MOCK_LLM:
        message = "Mock AI is disabled for the running app. Configure a real AI provider."
    return {
        **status,
        "ready": ready,
        "mock_allowed": ALLOW_MOCK_LLM,
        "message": message,
    }


def _ensure_llm_ready_for_ai_call() -> None:
    status = _llm_status_payload()
    if not status["ready"]:
        raise LLMConfigurationError(str(status["message"]))


async def _validate_llm_candidate(candidate: LLMClient) -> None:
    await candidate.complete(
        [
            LLMMessage(role="system", content="You are validating an API connection. Reply with exactly: connected"),
            LLMMessage(role="user", content="connection check"),
        ],
        "cheap",
        "configuration_check",
    )


def _disconnect_llm() -> None:
    global LLM
    LLM = LLMClient(LLMConfig(provider="unconfigured"))


def _looks_like_openrouter_key(api_key: str) -> bool:
    return api_key.strip().lower().startswith("sk-or-")


def _provider_http_error_message(exc: httpx.HTTPStatusError, provider: str, api_key: str) -> str:
    status_code = exc.response.status_code
    if status_code == 401:
        if provider in {"openai", "openai_responses", "responses"} and _looks_like_openrouter_key(api_key):
            return (
                "The key looks like an OpenRouter key, but OpenAI Responses mode was selected. "
                "Use OpenAI-compatible mode with https://openrouter.ai/api/v1/chat/completions."
            )
        return (
            "AI provider rejected the API key (HTTP 401). Use a valid OpenAI API key for OpenAI mode, "
            "or choose OpenAI-compatible mode with the correct base URL for another provider."
        )
    if status_code == 403:
        return "AI provider rejected access (HTTP 403). Check project permissions, model access, or organization settings."
    if status_code == 404:
        return "AI provider could not find the configured model or endpoint (HTTP 404). Check the model name and base URL."
    if status_code == 429:
        return "AI provider rate limit or quota was reached (HTTP 429). Check billing, quota, or retry later."
    return f"AI provider request failed: HTTP {status_code}"


def _get_engine(session_id: str) -> EncounterEngine:
    engine = SESSIONS.get(session_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="session not found")
    return engine


def _session_payload(engine: EncounterEngine, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = {
        "session_id": engine.state.session_id,
        "case_status": _case_status_payload(engine.case),
        "snapshot": engine.visible_snapshot().model_dump(mode="json"),
        "state": {
            "esi_history": [item.model_dump(mode="json") for item in engine.state.esi_history],
            "differential": list(engine.state.differential),
            "soap": engine.state.soap.model_dump(mode="json"),
            "completeness_flags": engine.state.completeness_flags.model_dump(mode="json"),
            "can_complete": engine.can_complete(),
            "ended": engine.state.ended,
            "transcript": [item.model_dump(mode="json") if hasattr(item, "model_dump") else item for item in engine.state.transcript],
            "performed_exams": [item.model_dump(mode="json") for item in engine.state.performed_exams],
            "intervention_events": [item.model_dump(mode="json") for item in engine.state.intervention_events],
            "token_usage": [item.model_dump(mode="json") for item in engine.state.token_usage],
        },
    }
    if extra:
        payload.update(extra)
    return payload
