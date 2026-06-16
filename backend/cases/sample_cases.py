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
        "exam_facts": [
            {
                "id": "general_appearance",
                "maneuver_id": "general_inspection_appearance",
                "system": "general",
                "triggers": ["general", "appearance", "look", "inspect", "exam"],
                "finding": "Anxious, mildly diaphoretic, and working harder to breathe.",
                "source": "triage appearance",
            },
            {
                "id": "respiratory_effort",
                "maneuver_id": "respiratory_inspection_work_of_breathing",
                "system": "respiratory",
                "triggers": ["lung", "lungs", "breath sounds", "auscultate", "respiratory", "chest"],
                "finding": "Respirations observed at bedside: tachypneic with increased work of breathing.",
                "source": "triage vitals and appearance",
            },
            {
                "id": "cardiac_rate",
                "maneuver_id": "cardiovascular_auscultation_heart_sounds",
                "system": "cardiac",
                "triggers": ["heart", "cardiac", "pulse", "pulses", "rate"],
                "finding": "Heart auscultated at standard listening posts: tachycardic with regular rhythm; no obvious murmur, rub, or gallop heard.",
                "source": "triage vital signs",
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
        "rubric": {
            "expected_diagnoses": ["pulmonary embolism"],
            "expected_orders": ["d_dimer", "ct_pulmonary_angiography"],
            "indicated_exams": [
                {
                    "id": "general_inspection_appearance",
                    "label": "General appearance",
                    "why": "Hypoxemia and dyspnea require early assessment of distress and work of breathing.",
                    "early_minutes": 2,
                    "evidence_terms": ["hypoxemia", "emergency severity index", "oxygen"],
                },
                {
                    "id": "respiratory_inspection_work_of_breathing",
                    "label": "Work of breathing",
                    "why": "Respiratory distress changes stabilization urgency and monitoring needs.",
                    "early_minutes": 2,
                    "evidence_terms": ["hypoxemia", "oxygen", "respiratory distress"],
                },
                {
                    "id": "respiratory_auscultation_breath_sounds",
                    "label": "Breath sounds",
                    "why": "Breath-sound assessment helps compare PE against pneumonia, pneumothorax, and bronchospasm branches.",
                    "evidence_terms": ["dyspnea", "breath sounds", "respiratory"],
                },
                {
                    "id": "cardiovascular_auscultation_heart_sounds",
                    "label": "Heart sounds",
                    "why": "Tachycardia and pleuritic pain warrant a focused cardiopulmonary exam.",
                    "evidence_terms": ["tachycardia", "emergency severity index"],
                },
            ],
            "indicated_interventions": [
                {
                    "id": "oxygen",
                    "label": "Supplemental oxygen",
                    "why": "The presenting SpO2 is low and worsens without oxygen in the authored trajectory.",
                    "early_minutes": 2,
                    "evidence_terms": ["hypoxemia", "oxygen"],
                },
                {
                    "id": "cardiac_monitor",
                    "label": "Cardiac monitor",
                    "why": "Hypoxemia and tachycardia warrant continuous monitoring during early stabilization.",
                    "early_minutes": 3,
                    "evidence_terms": ["emergency severity index", "high risk", "monitoring"],
                },
                {
                    "id": "iv_access",
                    "label": "IV access",
                    "why": "IV access supports contrast imaging and treatment if the patient deteriorates.",
                    "early_minutes": 5,
                    "evidence_terms": ["resources", "intravenous"],
                },
            ],
            "excessive_interventions": [
                {
                    "id": "broad_spectrum_antibiotics",
                    "label": "Broad-spectrum antibiotics",
                    "why": "No authored infectious syndrome or source result supports empiric antibiotics in this presentation.",
                    "evidence_terms": ["no fever", "productive cough"],
                }
            ],
            "critical_actions": ["oxygen", "cardiac_monitor", "iv_access"],
            "esi_tolerance": 0,
        },
        "evidence_corpus": [
            {
                "id": "esi-hypoxemia",
                "title": "Emergency Severity Index stabilization priorities",
                "url": "https://www.ncbi.nlm.nih.gov/books/NBK2627/",
                "text": "Emergency Severity Index triage prioritizes high-risk patients and immediate life-saving interventions. Hypoxemia, respiratory distress, oxygen therapy, monitoring, and intravenous access are relevant early stabilization resources.",
            },
            {
                "id": "acute-dyspnea-exam",
                "title": "Emergency dyspnea assessment",
                "url": "https://www.ncbi.nlm.nih.gov/books/NBK499965/",
                "text": "Emergency evaluation of dyspnea includes appearance, work of breathing, vital signs, oxygenation, cardiac assessment, and lung examination to identify respiratory distress and dangerous cardiopulmonary causes.",
            },
        ],
    }


def sample_prepared_case() -> PreparedCase:
    return prepare_raw_encounter(sample_raw_encounter())
