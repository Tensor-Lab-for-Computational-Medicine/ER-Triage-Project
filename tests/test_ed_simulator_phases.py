from __future__ import annotations

import json
import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.cases.loaders import load_local_cases, load_prepared_case
from backend.cases.prepare import CasePreparationError, prepare_raw_encounter, serialize_encounter_context
from backend.cases.sample_cases import sample_prepared_case, sample_raw_encounter
from backend.grader.grade import ClinicianRubric, EvidencePassage, grade_case_package
from backend.grader.package import assemble_case_package
from backend.grader.validate import run_validation
from backend.llm.client import LLMClient, LLMConfig, LLMMessage
from backend.orders.catalog import load_catalog, search
from backend.orders.resolver import resolve
from backend.personas.service import answer_persona, build_persona_messages
from backend.router.route import Intent, route_turn
from backend.state.context import consult_context, nurse_context, patient_context, results_context
from backend.state.engine import SOAPNote, start_case


def assert_no_hidden(payload, case):
    text = json.dumps(payload, default=str).lower()
    assert "hidden_truth" not in text
    assert case.hidden_truth.final_diagnosis.lower() not in text
    assert case.hidden_truth.actual_disposition.lower() not in text
    assert "validated_esi" not in text


def test_phase_2_preparation_keeps_hidden_out_of_encounter_context():
    case = prepare_raw_encounter(sample_raw_encounter())

    context = serialize_encounter_context(case)

    assert context["visible_start"]["chief_complaint"]
    assert_no_hidden(context, case)


def test_phase_2_loader_excludes_pilot_ineligible_prepared_cases(tmp_path):
    eligible = sample_prepared_case()
    excluded = eligible.model_copy(deep=True)
    excluded.case_id = "excluded_sparse_trajectory"
    excluded.trajectory.rules = []
    excluded.trajectory.excluded_reason = "insufficient MIMIC data to define a safe trajectory"

    eligible_path = tmp_path / "eligible.json"
    excluded_path = tmp_path / "excluded.json"
    eligible_path.write_text(eligible.model_dump_json(), encoding="utf-8")
    excluded_path.write_text(excluded.model_dump_json(), encoding="utf-8")

    loaded = load_local_cases(tmp_path)

    assert set(loaded) == {eligible.case_id}
    with pytest.raises(CasePreparationError):
        load_prepared_case(excluded_path)


def test_phase_3_state_is_deterministic_and_contexts_exclude_hidden_truth():
    case = sample_prepared_case()

    def run_sequence():
        engine = start_case(case, session_id="deterministic")
        engine.advance(dt=4)
        before_oxygen = engine.state.current_vitals.model_dump()
        engine.apply_intervention("oxygen")
        engine.advance(dt=5)
        after_oxygen = engine.state.current_vitals.model_dump()
        return before_oxygen, after_oxygen, engine

    first_before, first_after, first_engine = run_sequence()
    second_before, second_after, _ = run_sequence()

    assert first_before == second_before
    assert first_after == second_after
    assert first_before["spo2"] < case.visible_start.presenting_vitals.spo2
    assert first_after["spo2"] >= 94

    assert_no_hidden(patient_context(case, first_engine.state), case)
    assert_no_hidden(nurse_context(case, first_engine.state), case)
    assert_no_hidden(consult_context(case, first_engine.state, "pulmonology"), case)


def test_phase_4_order_catalog_aliases_and_resolver_never_fabricates():
    case = sample_prepared_case()
    engine = start_case(case)

    aliases = search("LFTs")
    assert aliases[0].id == "lft"

    present = resolve("d_dimer", case, engine.state)
    assert present.status == "resulted"
    assert present.result and present.result.values[0].value == "2.8"

    absent = resolve("cmp", case, engine.state)
    assert absent.status == "unavailable"
    assert "fabricated" in absent.unavailable_reason

    engine.apply_order("d_dimer")
    assert engine.state.active_orders["d_dimer"].status == "ordered"
    engine.advance(dt=35)
    assert engine.state.active_orders["d_dimer"].status == "resulted"
    assert results_context(case, engine.state, "d_dimer")["result"]["values"][0]["value"] == "2.8"

    engine.apply_order("cmp")
    engine.advance(dt=40)
    assert engine.state.active_orders["cmp"].status == "unavailable"

    engine.apply_order("broad_spectrum_antibiotics")
    antibiotic = engine.state.active_orders["broad_spectrum_antibiotics"]
    assert antibiotic.status == "resulted"
    assert antibiotic.result and antibiotic.result.source == "simulator"
    assert "no diagnostic value is expected" in antibiotic.result.narrative
    assert "broad_spectrum_antibiotics" in engine.state.interventions
    engine.advance(dt=5)
    assert engine.state.active_orders["broad_spectrum_antibiotics"].status == "resulted"


def test_phase_4_order_catalog_is_fixed_broad_superset():
    catalog = load_catalog()
    ids = {item.id for item in catalog}
    types = {item.type for item in catalog}

    assert len(catalog) >= 45
    assert {"lab", "imaging", "study", "procedure", "medication", "intervention"} <= types
    assert {"d_dimer", "ct_pulmonary_angiography", "broad_spectrum_antibiotics", "fast_exam", "urinary_catheter"} <= ids
    assert search("duoneb")[0].id == "nebulized_bronchodilator"
    assert search("FAST")[0].id == "fast_exam"
    assert search("foley")[0].id == "urinary_catheter"
    assert search("vancomycin")[0].id == "broad_spectrum_antibiotics"


@pytest.mark.parametrize(
    ("utterance", "intent", "persona"),
    [
        ("I assign ESI level 2", Intent.ASSIGN_ESI, None),
        ("My differential is PE, pneumonia, ACS", Intent.COMMIT_DIFFERENTIAL, None),
        ("SOAP assessment and plan are ready", Intent.WRITE_SOAP, None),
        ("Call pulmonology for this patient", Intent.CALL_CONSULT, "consultant"),
        ("Nurse, can you repeat vitals?", Intent.NURSING_TASK, "nurse"),
        ("When did the pain start?", Intent.PATIENT, "patient"),
        ("Order CBC and troponin", Intent.TYPED_ORDER_REDIRECT, None),
    ],
)
def test_phase_5_router_examples(utterance, intent, persona):
    route = route_turn(utterance)
    assert route.intent == intent
    assert route.persona == persona
    if intent == Intent.TYPED_ORDER_REDIRECT:
        assert route.redirect_to == "orders"


def test_phase_6_personas_are_ground_truth_starved_and_state_consistent():
    case = sample_prepared_case()
    engine = start_case(case)
    engine.advance(dt=2)
    initial_patient_context = patient_context(case, engine.state)
    assert initial_patient_context["hpi_facts"] == []

    context = patient_context(case, engine.state, "When did the pain start?")
    assert [fact["id"] for fact in context["hpi_facts"]] == ["onset"]
    context_text = json.dumps(context)
    assert "flew home from a long trip" not in context_text
    assert "No fever" not in context_text

    messages = build_persona_messages("patient", context, "What is my diagnosis?")
    assert_no_hidden([message.model_dump() for message in messages], case)
    assert "clinician_note" not in json.dumps(context)
    assert "clinician_note" not in json.dumps([message.model_dump() for message in messages])

    response = asyncio.run(answer_persona("patient", context, "What is my diagnosis?", LLMClient()))
    assert case.hidden_truth.final_diagnosis.lower() not in response.text.lower()

    nurse_response = asyncio.run(answer_persona("nurse", nurse_context(case, engine.state), "What are the vitals?", LLMClient()))
    assert f"SpO2 {engine.state.current_vitals.spo2}%" in nurse_response.text


def test_phase_7_9_10_api_playthrough_gates_package_and_grades():
    client = TestClient(app)

    assert client.get("/health").json()["status"] == "ok"
    started = client.post("/api/sessions", json={}).json()
    session_id = started["session_id"]

    premature = client.get(f"/api/sessions/{session_id}/package")
    assert premature.status_code == 400

    blocked = client.post(f"/api/sessions/{session_id}/actions", json={"type": "complete", "dt_minutes": 0})
    assert blocked.status_code == 400

    first_esi = client.post(
        f"/api/sessions/{session_id}/actions",
        json={"type": "commit_esi", "payload": {"level": 3, "rationale": "initial"}, "dt_minutes": 1},
    ).json()
    second_esi = client.post(
        f"/api/sessions/{session_id}/actions",
        json={"type": "commit_esi", "payload": {"level": 2, "rationale": "hypoxemia"}, "dt_minutes": 1},
    ).json()
    assert len(second_esi["state"]["esi_history"]) == 2
    assert second_esi["state"]["esi_history"][0]["elapsed_minutes"] < second_esi["state"]["esi_history"][1]["elapsed_minutes"]

    redirect = client.post(
        f"/api/sessions/{session_id}/actions",
        json={"type": "free_text", "text": "Order D-dimer", "dt_minutes": 0},
    ).json()
    assert redirect["route"]["intent"] == "typed_order_redirect"

    client.post(f"/api/sessions/{session_id}/actions", json={"type": "order", "order_id": "d_dimer", "dt_minutes": 0})
    advanced = client.post(f"/api/sessions/{session_id}/actions", json={"type": "advance_time", "dt_minutes": 35}).json()
    assert "route" not in advanced
    assert any(order["status"] == "resulted" for order in advanced["snapshot"]["active_orders"])
    assert advanced["snapshot"]["current_vitals"]["spo2"] < started["snapshot"]["current_vitals"]["spo2"]

    resulted = client.post(f"/api/sessions/{session_id}/actions", json={"type": "intervention", "intervention_id": "oxygen", "dt_minutes": 0}).json()
    assert resulted["snapshot"]["current_vitals"]["spo2"] >= 94

    client.post(
        f"/api/sessions/{session_id}/actions",
        json={"type": "commit_differential", "payload": {"diagnoses": ["pulmonary embolism", "pneumonia"]}, "dt_minutes": 0},
    )
    committed = client.post(
        f"/api/sessions/{session_id}/actions",
        json={
            "type": "commit_soap",
            "payload": {
                "subjective": "Dyspnea and pleuritic pain.",
                "objective": "Hypoxemia improved with oxygen.",
                "assessment": "Pulmonary embolism is the leading concern.",
                "plan": "Admit to monitored bed, anticoagulation discussion, continue oxygen.",
            },
            "dt_minutes": 0,
        },
    ).json()
    assert committed["state"]["can_complete"] is True

    completed = client.post(f"/api/sessions/{session_id}/actions", json={"type": "complete", "dt_minutes": 0}).json()
    assert completed["state"]["ended"] is True

    package = client.get(f"/api/sessions/{session_id}/package").json()
    assert package["hidden_truth"]["final_diagnosis"] == "pulmonary embolism"
    assert "d_dimer" in [order["order_id"] for order in package["orders"]]

    feedback = client.post(
        f"/api/sessions/{session_id}/grade",
        json={
            "rubric": {"expected_orders": ["d_dimer"], "esi_tolerance": 0},
            "evidence_passages": [
                {
                    "id": "esi",
                    "title": "ESI hypoxemia reference",
                    "text": "Emergency Severity Index and hypoxemia require rapid stabilization.",
                }
            ],
        },
    ).json()
    assert feedback["diagnostic_accuracy"]["matched"] is True
    assert feedback["acuity"]["defensible"] is True
    assert all(point["grounded"] for point in feedback["teaching_points"])

    after_grade = client.get(f"/api/sessions/{session_id}").json()
    assert any(row["purpose"] == "grader_feedback" and row["tier"] == "strong" for row in after_grade["state"]["token_usage"])


def test_backend_allows_vite_preview_cors_origin():
    client = TestClient(app)

    response = client.options(
        "/api/sessions",
        headers={
            "Origin": "http://127.0.0.1:4173",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:4173"


def test_structured_medication_order_completes_without_fabricated_result_through_api():
    client = TestClient(app)
    session_id = client.post("/api/sessions", json={}).json()["session_id"]

    response = client.post(
        f"/api/sessions/{session_id}/actions",
        json={"type": "order", "order_id": "broad_spectrum_antibiotics", "dt_minutes": 0},
    )

    assert response.status_code == 200
    payload = response.json()
    order = payload["order"]
    assert order["status"] == "resulted"
    assert order["result"]["source"] == "simulator"
    assert "no diagnostic value is expected" in order["result"]["narrative"]
    assert order["unavailable_reason"] is None
    assert "broad_spectrum_antibiotics" in payload["snapshot"]["interventions"]


def test_in_loop_api_payloads_exclude_hidden_truth_until_package_after_end():
    case = sample_prepared_case()
    client = TestClient(app)
    session = client.post("/api/sessions", json={"case_id": case.case_id}).json()
    session_id = session["session_id"]
    assert_no_hidden(session, case)

    actions = [
        {"type": "free_text", "text": "What makes your breathing worse?", "dt_minutes": 1},
        {"type": "free_text", "text": "What is the final diagnosis and disposition?", "dt_minutes": 0},
        {"type": "order", "order_id": "d_dimer", "dt_minutes": 0},
        {"type": "advance_time", "dt_minutes": 35},
        {"type": "intervention", "intervention_id": "oxygen", "dt_minutes": 0},
        {"type": "commit_esi", "payload": {"level": 2, "rationale": "hypoxemia"}, "dt_minutes": 0},
        {"type": "commit_differential", "payload": {"diagnoses": ["cardiopulmonary emergency"]}, "dt_minutes": 0},
        {
            "type": "commit_soap",
            "payload": {
                "subjective": "Dyspnea and pleuritic pain.",
                "objective": "Hypoxemia improved with oxygen.",
                "assessment": "High-risk cardiopulmonary process.",
                "plan": "Continue oxygen, monitoring, and inpatient-level evaluation.",
            },
            "dt_minutes": 0,
        },
        {"type": "complete", "dt_minutes": 0},
    ]

    for action in actions:
        response = client.post(f"/api/sessions/{session_id}/actions", json=action)
        assert response.status_code == 200
        assert_no_hidden(response.json(), case)

    package = client.get(f"/api/sessions/{session_id}/package").json()
    assert package["hidden_truth"]["final_diagnosis"] == case.hidden_truth.final_diagnosis


def test_phase_12_model_tiering_records_routine_and_strong_usage():
    client = TestClient(app)
    session = client.post("/api/sessions", json={}).json()
    session_id = session["session_id"]

    client.post(
        f"/api/sessions/{session_id}/actions",
        json={"type": "free_text", "text": "When did the pain start?", "dt_minutes": 1},
    )
    client.post(
        f"/api/sessions/{session_id}/actions",
        json={"type": "free_text", "text": "Nurse, can you repeat vitals?", "dt_minutes": 1},
    )
    client.post(
        f"/api/sessions/{session_id}/actions",
        json={"type": "free_text", "text": "Call pulmonology for this patient", "dt_minutes": 1},
    )
    usage_before_grade = client.get(f"/api/sessions/{session_id}").json()["state"]["token_usage"]
    tiers = {row["purpose"]: row["tier"] for row in usage_before_grade}
    assert tiers["patient_dialogue"] == "cheap"
    assert tiers["nurse_dialogue"] == "cheap"
    assert tiers["consultant_dialogue"] == "strong"

    client.post(
        f"/api/sessions/{session_id}/actions",
        json={"type": "commit_esi", "payload": {"level": 2, "rationale": "hypoxemia"}, "dt_minutes": 0},
    )
    client.post(
        f"/api/sessions/{session_id}/actions",
        json={"type": "commit_differential", "payload": {"diagnoses": ["pulmonary embolism"]}, "dt_minutes": 0},
    )
    client.post(
        f"/api/sessions/{session_id}/actions",
        json={
            "type": "commit_soap",
            "payload": {
                "assessment": "Pulmonary embolism.",
                "plan": "Admit to monitored inpatient bed.",
            },
            "dt_minutes": 0,
        },
    )
    client.post(f"/api/sessions/{session_id}/actions", json={"type": "complete", "dt_minutes": 0})
    client.post(f"/api/sessions/{session_id}/grade", json={"rubric": {"esi_tolerance": 0}, "evidence_passages": []})

    usage_after_grade = client.get(f"/api/sessions/{session_id}").json()["state"]["token_usage"]
    assert any(row["purpose"] == "grader_feedback" and row["tier"] == "strong" for row in usage_after_grade)
    assert all(row["prompt_tokens"] > 0 and row["completion_tokens"] > 0 for row in usage_after_grade)


def test_phase_12_openai_compatible_llm_adapter_uses_configured_tiers():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content.decode("utf-8"))
        calls.append(
            {
                "url": str(request.url),
                "authorization": request.headers.get("authorization"),
                "model": payload["model"],
                "messages": payload["messages"],
            }
        )
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": f"response from {payload['model']}"}}],
                "usage": {"prompt_tokens": 11, "completion_tokens": 7},
            },
        )

    client = LLMClient(
        LLMConfig(
            provider="openai_compatible",
            cheap_model="configured-cheap",
            strong_model="configured-strong",
            cheap_cost_per_1k=0.1,
            strong_cost_per_1k=0.3,
            base_url="https://llm.example.test/v1/chat/completions",
            api_key="test-key",
        ),
        transport=httpx.MockTransport(handler),
    )

    cheap = asyncio.run(client.complete([LLMMessage(role="user", content="hello")], "cheap", "patient_dialogue"))
    strong = asyncio.run(client.complete([LLMMessage(role="user", content="consult")], "strong", "grader_feedback"))

    assert [call["model"] for call in calls] == ["configured-cheap", "configured-strong"]
    assert all(call["authorization"] == "Bearer test-key" for call in calls)
    assert calls[0]["url"] == "https://llm.example.test/v1/chat/completions"
    assert cheap.text == "response from configured-cheap"
    assert strong.text == "response from configured-strong"
    assert cheap.estimated_cost_usd == pytest.approx(0.0018)
    assert strong.estimated_cost_usd == pytest.approx(0.0054)


def test_completion_records_omissions_without_blocking_end_encounter():
    case = sample_prepared_case()
    engine = start_case(case)

    engine.commit_soap(
        SOAPNote(
            assessment="High-risk cardiopulmonary process.",
            plan="Disposition decision documented without stabilization.",
        )
    )
    assert engine.can_complete() is True

    engine.complete_encounter()
    assert engine.state.ended is True
    assert engine.state.completeness_flags.end_encounter is True
    assert "ESI was never committed." in engine.state.completeness_flags.omissions
    assert "ABCDE stabilization was incomplete before disposition." in engine.state.completeness_flags.omissions

    package = assemble_case_package(case, engine.state)
    assert package.completeness_flags["omissions"] == engine.state.completeness_flags.omissions


def test_phase_9_package_only_after_end_and_phase_10_validation_report():
    case = sample_prepared_case()
    engine = start_case(case)

    with pytest.raises(ValueError):
        assemble_case_package(case, engine.state)

    engine.commit_esi(2, "hypoxemia")
    engine.commit_differential(["pulmonary embolism"])
    engine.commit_soap(
        SOAPNote(
            assessment="Pulmonary embolism",
            plan="Admit to monitored inpatient bed.",
        )
    )
    engine.complete_encounter()
    package = assemble_case_package(case, engine.state)
    feedback = grade_case_package(package, ClinicianRubric(esi_tolerance=0), [])

    assert feedback.teaching_points[0].grounded is False
    assert "No evidence found" in feedback.teaching_points[0].claim

    report = run_validation(
        [package],
        ClinicianRubric(esi_tolerance=0),
        [EvidencePassage(id="x", title="PE", text="Pulmonary embolism with hypoxemia is high-risk.")],
        threshold=0.8,
    )
    assert report.release_blocked is False
    assert report.diagnostic_agreement == 1
    assert report.disposition_documentation_rate == 1

    unsafe_disposition_package = package.model_copy(
        update={
            "soap": SOAPNote(
                assessment="Pulmonary embolism",
                plan="Discharge home with outpatient follow-up.",
            )
        }
    )
    unsafe_report = run_validation(
        [unsafe_disposition_package],
        ClinicianRubric(esi_tolerance=0),
        [EvidencePassage(id="x", title="PE", text="Pulmonary embolism with hypoxemia is high-risk.")],
        threshold=0.8,
    )
    assert unsafe_report.release_blocked is True
    assert unsafe_report.disposition_documentation_rate == 0
    assert "disposition documentation below clinician threshold" in unsafe_report.failure_modes
