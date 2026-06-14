from __future__ import annotations

from backend.cases.prepare import prepare_raw_encounter
from backend.cases.schemas import PreparedCase


def sample_raw_encounter() -> dict:
    return {
        "case_id": "sample_pe_001",
        "title": "46F dyspnea with pleuritic chest pain",
        "source": "synthetic-local-fixture",
        "visible_start": {
            "chief_complaint": "Shortness of breath and right-sided chest pain",
            "demographics": {"age": 46, "sex": "female"},
            "presenting_vitals": {
                "temp_c": 37.2,
                "hr": 118,
                "sbp": 126,
                "dbp": 78,
                "rr": 24,
                "spo2": 90,
                "pain": 7,
            },
            "triage_context": "Walk-in patient, speaking in short sentences, symptoms began today.",
            "appearance": "Anxious, mildly diaphoretic, increased work of breathing.",
        },
        "hpi_facts": [
            {
                "id": "onset",
                "topic": "onset and character",
                "triggers": ["when", "start", "onset", "pain", "character"],
                "lay_response": "It started this morning and gets sharper when I take a deep breath.",
                "clinician_note": "Acute pleuritic chest pain with dyspnea.",
            },
            {
                "id": "risk",
                "topic": "risk factors",
                "triggers": ["travel", "clot", "estrogen", "surgery", "risk"],
                "lay_response": "I flew home from a long trip two days ago. I have not had surgery.",
                "clinician_note": "Recent prolonged travel; no recent surgery reported.",
            },
            {
                "id": "infectious",
                "topic": "infectious symptoms",
                "triggers": ["fever", "cough", "sputum", "infection"],
                "lay_response": "No fever, and I am not coughing anything up.",
                "clinician_note": "No fever or productive cough by history.",
            },
        ],
        "result_bundles": {
            "ecg_12_lead": {
                "display_name": "12-lead ECG",
                "resulted_at_min": 5,
                "values": [
                    {"name": "Rhythm", "value": "Sinus tachycardia", "flag": "abnormal"},
                    {"name": "ST elevation", "value": "None", "flag": "normal"},
                ],
                "narrative": "Sinus tachycardia without STEMI.",
            },
            "cbc": {
                "display_name": "CBC",
                "resulted_at_min": 30,
                "values": [
                    {"name": "WBC", "value": "10.8", "unit": "K/uL", "flag": "normal"},
                    {"name": "Hemoglobin", "value": "13.1", "unit": "g/dL", "flag": "normal"},
                    {"name": "Platelets", "value": "240", "unit": "K/uL", "flag": "normal"},
                ],
                "narrative": "CBC without anemia or marked leukocytosis.",
            },
            "d_dimer": {
                "display_name": "D-dimer",
                "resulted_at_min": 35,
                "values": [
                    {"name": "D-dimer", "value": "2.8", "unit": "mg/L FEU", "flag": "high"},
                ],
                "narrative": "D-dimer is elevated.",
            },
            "ct_pulmonary_angiography": {
                "display_name": "CT pulmonary angiography",
                "resulted_at_min": 80,
                "values": [],
                "narrative": "Right lower lobe segmental filling defect with small pleural effusion. No right heart strain reported.",
            },
        },
        "hidden_truth": {
            "final_diagnosis": "pulmonary embolism",
            "validated_esi": 2,
            "actual_disposition": "Admitted to monitored inpatient bed",
            "clinician_key_points": [
                "Hypoxemia and tachycardia make this high risk at triage.",
                "Oxygen and monitoring should occur before extended history.",
                "Definitive imaging changes disposition and anticoagulation planning.",
            ],
        },
        "trajectory": {
            "starting_vitals": {
                "temp_c": 37.2,
                "hr": 118,
                "sbp": 126,
                "dbp": 78,
                "rr": 24,
                "spo2": 90,
                "pain": 7,
            },
            "rules": [
                {
                    "id": "hypoxemia_without_oxygen",
                    "vital": "spo2",
                    "condition": {"below": 92, "absent_intervention": "oxygen"},
                    "delta_per_minute": -0.5,
                    "floor": 86,
                },
                {
                    "id": "oxygen_recovery",
                    "vital": "spo2",
                    "condition": {"below": 96, "present_intervention": "oxygen"},
                    "delta_per_minute": 1.5,
                    "ceiling": 96,
                },
                {
                    "id": "tachycardia_without_stabilization",
                    "vital": "hr",
                    "condition": {"above": 110, "absent_intervention": "oxygen"},
                    "delta_per_minute": 0.4,
                    "ceiling": 128,
                },
                {
                    "id": "analgesia_pain_response",
                    "vital": "pain",
                    "condition": {"above": 3, "present_intervention": "analgesia"},
                    "delta_per_minute": -0.3,
                    "floor": 3,
                },
            ],
        },
        "real_timeline": [
            {"elapsed_min": 0, "label": "Arrival", "detail": "Hypoxemic and tachycardic on triage vitals."},
            {"elapsed_min": 3, "label": "Stabilization", "detail": "Oxygen, monitor, IV access, and ECG prioritized."},
            {"elapsed_min": 80, "label": "Imaging", "detail": "CT pulmonary angiography identified segmental clot."},
            {"elapsed_min": 120, "label": "Disposition", "detail": "Admitted for monitored treatment."},
        ],
    }


def sample_prepared_case() -> PreparedCase:
    return prepare_raw_encounter(sample_raw_encounter())
