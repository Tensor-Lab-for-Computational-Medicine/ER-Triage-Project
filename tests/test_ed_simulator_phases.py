from __future__ import annotations

import json
import asyncio
from pathlib import Path
import subprocess
import sys

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.cases.loaders import load_local_cases, load_prepared_case
from backend.cases.prepare import CasePreparationError, prepare_raw_encounter, serialize_encounter_context
from backend.cases.sample_cases import sample_prepared_case, sample_raw_encounter
from backend.grader.grade import ClinicianRubric, EvidencePassage, grade_case_package
from backend.grader.package import assemble_case_package
from backend.grader.retrieval import retrieve_evidence_passages
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


def test_phase_2_preparation_rejects_starting_vitals_mismatch():
    raw = sample_raw_encounter()
    raw["trajectory"]["starting_vitals"]["spo2"] = 99

    with pytest.raises(CasePreparationError, match="visible presenting vitals"):
        prepare_raw_encounter(raw)


def test_phase_2_loader_excludes_pilot_ineligible_prepared_cases(tmp_path):
    eligible = sample_prepared_case()
    excluded = eligible.model_copy(deep=True)
    excluded.case_id = "excluded_sparse_trajectory"
    excluded.trajectory.rules = []
    excluded.trajectory.excluded_reason = "insufficient MIMIC data to define a safe trajectory"
    mismatched = eligible.model_copy(deep=True)
    mismatched.case_id = "excluded_mismatched_starting_vitals"
    mismatched.trajectory.starting_vitals.spo2 = 99

    eligible_path = tmp_path / "eligible.json"
    excluded_path = tmp_path / "excluded.json"
    mismatched_path = tmp_path / "mismatched.json"
    eligible_path.write_text(eligible.model_dump_json(), encoding="utf-8")
    excluded_path.write_text(excluded.model_dump_json(), encoding="utf-8")
    mismatched_path.write_text(mismatched.model_dump_json(), encoding="utf-8")

    loaded = load_local_cases(tmp_path)

    assert set(loaded) == {eligible.case_id}
    with pytest.raises(CasePreparationError):
        load_prepared_case(excluded_path)
    with pytest.raises(CasePreparationError, match="visible presenting vitals"):
        load_prepared_case(mismatched_path)


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
    assert first_engine.state.active_orders["oxygen"].status == "resulted"
    assert first_engine.state.active_orders["oxygen"].result.source == "simulator"

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
    assert engine.state.active_orders["d_dimer"].result.resulted_at_min == 35

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

    delayed_engine = start_case(case)
    delayed_engine.advance(dt=10)
    delayed_engine.apply_order("d_dimer")
    delayed_engine.advance(dt=34)
    assert delayed_engine.state.active_orders["d_dimer"].status == "resulting"
    delayed_engine.advance(dt=1)
    delayed_record = delayed_engine.state.active_orders["d_dimer"]
    assert delayed_record.status == "resulted"
    assert delayed_record.result.resulted_at_min == 45
    assert case.result_bundles["d_dimer"].resulted_at_min == 35


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


def test_phase_6_personas_replace_model_invented_vitals_with_state():
    case = sample_prepared_case()
    engine = start_case(case)
    engine.advance(dt=4)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": (
                                "The patient is stable. Current vitals: "
                                "HR 60, BP 120/80, RR 12, SpO2 99%."
                            )
                        }
                    }
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 10},
            },
        )

    client = LLMClient(
        LLMConfig(
            provider="openai_compatible",
            base_url="https://llm.example.test/v1/chat/completions",
            api_key="test-key",
        ),
        transport=httpx.MockTransport(handler),
    )

    nurse_response = asyncio.run(answer_persona("nurse", nurse_context(case, engine.state), "What are the vitals?", client))
    assert f"HR {engine.state.current_vitals.hr}" in nurse_response.text
    assert f"SpO2 {engine.state.current_vitals.spo2}%" in nurse_response.text
    assert "99%" not in nurse_response.text
    assert "stable" not in nurse_response.text.lower()

    patient_response = asyncio.run(answer_persona("patient", patient_context(case, engine.state), "Are you stable?", client))
    assert "monitor numbers" in patient_response.text
    assert "99%" not in patient_response.text
    assert "stable" not in patient_response.text.lower()


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
    assert resulted["order"]["order_id"] == "oxygen"
    assert resulted["order"]["status"] == "resulted"
    assert "oxygen" in [order["order_id"] for order in resulted["snapshot"]["active_orders"]]
    assert resulted["state"]["completeness_flags"]["abcde_addressed"] is True

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
    ended_order_ids = [order["order_id"] for order in completed["snapshot"]["active_orders"]]

    post_end_action = client.post(
        f"/api/sessions/{session_id}/actions",
        json={"type": "order", "order_id": "ct_pulmonary_angiography", "dt_minutes": 5},
    )
    assert post_end_action.status_code == 400
    assert "Encounter has ended" in post_end_action.json()["detail"]
    after_post_end = client.get(f"/api/sessions/{session_id}").json()
    assert after_post_end["state"]["ended"] is True
    assert after_post_end["snapshot"]["elapsed_minutes"] == completed["snapshot"]["elapsed_minutes"]
    assert [order["order_id"] for order in after_post_end["snapshot"]["active_orders"]] == ended_order_ids

    package = client.get(f"/api/sessions/{session_id}/package").json()
    assert package["hidden_truth"]["final_diagnosis"] == "pulmonary embolism"
    assert "d_dimer" in [order["order_id"] for order in package["orders"]]

    feedback = client.post(
        f"/api/sessions/{session_id}/grade",
        json={
            "rubric": {"expected_orders": ["d_dimer"], "critical_actions": ["oxygen"], "esi_tolerance": 0},
            "evidence_corpus": [
                {
                    "id": "rash",
                    "title": "Minor rash care",
                    "text": "Topical skin care guidance for uncomplicated dermatitis.",
                },
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
    assert feedback["completeness"]["critical_actions"]["missed"] == []
    assert feedback["workup_judgment"]["changed_management"] == ["d_dimer"]
    assert all(point["grounded"] for point in feedback["teaching_points"])

    after_grade = client.get(f"/api/sessions/{session_id}").json()
    assert any(row["purpose"] == "grader_feedback" and row["tier"] == "strong" for row in after_grade["state"]["token_usage"])


def test_grading_api_rejects_malformed_payloads_without_usage():
    client = TestClient(app)
    session_id = client.post("/api/sessions", json={}).json()["session_id"]

    client.post(
        f"/api/sessions/{session_id}/actions",
        json={
            "type": "commit_soap",
            "payload": {
                "assessment": "Pulmonary embolism is possible.",
                "plan": "Admit to monitored bed.",
            },
            "dt_minutes": 0,
        },
    )
    client.post(f"/api/sessions/{session_id}/actions", json={"type": "complete", "dt_minutes": 0})

    invalid_payloads = [
        {"rubric": {"esi_tolerance": "high"}},
        {"evidence_passages": [{"id": "pe", "title": "Missing text"}]},
        {"evidence_corpus": {"passages": [{"id": "esi", "text": "Missing title"}]}},
        {"evidence_limit": "many"},
    ]

    for payload in invalid_payloads:
        response = client.post(f"/api/sessions/{session_id}/grade", json=payload)
        assert response.status_code == 400

    state = client.get(f"/api/sessions/{session_id}").json()["state"]
    assert state["token_usage"] == []


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


def test_structured_intervention_events_are_catalog_validated():
    case = sample_prepared_case()
    engine = start_case(case)

    with pytest.raises(ValueError):
        engine.apply_intervention("imaginary bedside trick")
    assert engine.state.interventions == []
    assert engine.state.active_orders == {}

    client = TestClient(app)
    session_id = client.post("/api/sessions", json={}).json()["session_id"]
    response = client.post(
        f"/api/sessions/{session_id}/actions",
        json={"type": "intervention", "intervention_id": "imaginary_bedside_trick", "dt_minutes": 0},
    )
    assert response.status_code == 400
    assert "unknown structured intervention" in response.json()["detail"]


def test_invalid_api_actions_do_not_advance_or_mutate_state():
    client = TestClient(app)
    session_id = client.post("/api/sessions", json={}).json()["session_id"]

    invalid_actions = [
        ({"type": "free_text", "text": "   ", "dt_minutes": 3}, 400),
        ({"type": "order", "order_id": "not_a_real_order", "dt_minutes": 10}, 404),
        ({"type": "intervention", "intervention_id": "imaginary_bedside_trick", "dt_minutes": 7}, 400),
        ({"type": "commit_esi", "payload": {}, "dt_minutes": 5}, 400),
        ({"type": "commit_esi", "payload": {"level": 2, "rationale": ["hypoxemia"]}, "dt_minutes": 5}, 400),
        ({"type": "commit_differential", "payload": {}, "dt_minutes": 6}, 400),
        ({"type": "commit_differential", "payload": {"diagnoses": []}, "dt_minutes": 6}, 400),
        ({"type": "commit_differential", "payload": {"diagnoses": ["   "]}, "dt_minutes": 6}, 400),
        ({"type": "commit_differential", "payload": {"diagnoses": ["PE", 42]}, "dt_minutes": 6}, 400),
        ({"type": "commit_soap", "payload": {}, "dt_minutes": 6}, 400),
        ({"type": "commit_soap", "payload": {"assessment": "PE concern"}, "dt_minutes": 6}, 400),
        ({"type": "commit_soap", "payload": {"plan": "Admit"}, "dt_minutes": 6}, 400),
        ({"type": "advance_time", "dt_minutes": -1}, 400),
        ({"type": "complete", "dt_minutes": 5}, 400),
    ]

    for action, expected_status in invalid_actions:
        response = client.post(f"/api/sessions/{session_id}/actions", json=action)
        assert response.status_code == expected_status
        snapshot = client.get(f"/api/sessions/{session_id}").json()
        assert snapshot["snapshot"]["elapsed_minutes"] == 0
        assert snapshot["snapshot"]["active_orders"] == []
        assert snapshot["snapshot"]["interventions"] == []
        assert snapshot["state"]["esi_history"] == []
        assert snapshot["state"]["differential"] == []
        assert snapshot["state"]["soap"] == {"subjective": "", "objective": "", "assessment": "", "plan": ""}
        assert snapshot["state"]["transcript"] == []

    with pytest.raises(ValueError):
        start_case(sample_prepared_case()).commit_differential([])


def test_completeness_flags_update_before_completion_without_early_omissions():
    case = sample_prepared_case()
    engine = start_case(case)

    assert engine.state.completeness_flags.abcde_addressed is False
    assert engine.state.completeness_flags.esi_committed is False
    assert engine.state.completeness_flags.omissions == []

    engine.apply_intervention("oxygen")
    assert engine.state.completeness_flags.abcde_addressed is True
    assert engine.state.completeness_flags.omissions == []

    engine.commit_esi(2, "hypoxemia")
    assert engine.state.completeness_flags.esi_committed is True

    engine.commit_soap(
        SOAPNote(
            assessment="Pulmonary embolism is the leading concern.",
            plan="Continue oxygen and admit to a monitored bed.",
        )
    )
    assert engine.state.completeness_flags.assessment_committed is True
    assert engine.state.completeness_flags.plan_committed is True
    assert engine.can_complete() is True
    assert engine.state.completeness_flags.end_encounter is False
    assert engine.state.completeness_flags.omissions == []

    engine.complete_encounter()
    assert engine.state.completeness_flags.end_encounter is True
    assert engine.state.completeness_flags.omissions == []


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


def test_phase_10_retrieval_layer_selects_case_relevant_grounding():
    case = sample_prepared_case()
    engine = start_case(case)
    engine.apply_intervention("oxygen")
    engine.commit_esi(2, "hypoxemia")
    engine.commit_differential(["pulmonary embolism"])
    engine.commit_soap(
        SOAPNote(
            assessment="Pulmonary embolism with hypoxemia.",
            plan="Admit to monitored inpatient bed.",
        )
    )
    engine.complete_encounter()
    package = assemble_case_package(case, engine.state)

    corpus = [
        EvidencePassage(id="rash", title="Minor rash care", text="Topical skin care for uncomplicated dermatitis."),
        EvidencePassage(
            id="pe",
            title="Pulmonary embolism",
            text="Pulmonary embolism with hypoxemia requires rapid stabilization.",
        ),
        EvidencePassage(
            id="esi",
            title="ESI acuity",
            text="Emergency Severity Index uses unstable vitals and hypoxemia for acuity.",
        ),
    ]

    retrieved = retrieve_evidence_passages(package, corpus, limit=2)

    assert [passage.id for passage in retrieved] == ["pe", "esi"]
    feedback = grade_case_package(package, ClinicianRubric(esi_tolerance=0), retrieved)
    assert all(point.grounded for point in feedback.teaching_points)


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

    critical_feedback = grade_case_package(package, ClinicianRubric(esi_tolerance=0, critical_actions=["oxygen"]), [])
    assert critical_feedback.completeness["critical_actions"]["missed"] == ["oxygen"]
    assert critical_feedback.completeness["critical_actions"]["gaps"][0]["why_it_mattered"]

    report = run_validation(
        [package],
        ClinicianRubric(esi_tolerance=0),
        [EvidencePassage(id="x", title="PE", text="Pulmonary embolism with hypoxemia is high-risk.")],
        threshold=0.8,
    )
    assert report.release_blocked is False
    assert report.diagnostic_agreement == 1
    assert report.disposition_documentation_rate == 1
    assert report.critical_action_agreement == 1

    missed_critical_report = run_validation(
        [package],
        ClinicianRubric(esi_tolerance=0, critical_actions=["oxygen"]),
        [EvidencePassage(id="x", title="PE", text="Pulmonary embolism with hypoxemia is high-risk.")],
        threshold=0.8,
    )
    assert missed_critical_report.release_blocked is True
    assert missed_critical_report.critical_action_agreement == 0
    assert missed_critical_report.cases[0].critical_actions_complete is False
    assert "critical action agreement below clinician threshold" in missed_critical_report.failure_modes

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


def test_phase_10_validation_cli_emits_release_blocking_report(tmp_path):
    case = sample_prepared_case()
    engine = start_case(case)
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

    package_path = tmp_path / "package.json"
    rubric_path = tmp_path / "rubric.json"
    evidence_path = tmp_path / "evidence.json"
    report_path = tmp_path / "report.json"
    package_path.write_text(package.model_dump_json(), encoding="utf-8")
    rubric_path.write_text(json.dumps({"esi_tolerance": 0, "critical_actions": ["oxygen"]}), encoding="utf-8")
    evidence_path.write_text(
        json.dumps([{"id": "pe", "title": "PE hypoxemia", "text": "Pulmonary embolism with hypoxemia is high-risk."}]),
        encoding="utf-8",
    )

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "backend.grader.validate",
            str(package_path),
            "--rubric",
            str(rubric_path),
            "--evidence",
            str(evidence_path),
            "--threshold",
            "0.8",
            "--output",
            str(report_path),
        ],
        cwd=Path(__file__).resolve().parents[1],
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 1
    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report["release_blocked"] is True
    assert report["critical_action_agreement"] == 0
    assert report["cases"][0]["critical_actions_complete"] is False
    assert "critical action agreement below clinician threshold" in report["failure_modes"]
