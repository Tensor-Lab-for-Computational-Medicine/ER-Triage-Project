"""Smoke tests for restricted MIMIC adapter and grounding audit tools."""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path
from types import SimpleNamespace
from zipfile import ZipFile

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import audit_grounding  # noqa: E402
import generate_mimic_restricted_cases as mimic_adapter  # noqa: E402
import link_mimic_restricted_context as mimic_linker  # noqa: E402


WORK_DIR = ROOT / "data" / "restricted" / "tool_test"
MOCK_DIR = WORK_DIR / "mock_mimic"
CASE_OUT = WORK_DIR / "mock_cases.restricted.json"
TEXT_OUT = WORK_DIR / "mock_outputs.restricted.json"
AUDIT_OUT = WORK_DIR / "mock_audit.restricted.json"
LINK_DIR = WORK_DIR / "mock_linkage"
LINK_MIETIC = LINK_DIR / "mietic_validate_samples.csv"
LINK_OUT = WORK_DIR / "mock_mietic_mimic_enriched.restricted.json"


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(path, index=False)


def write_mock_mimic_dataset() -> None:
    if WORK_DIR.exists():
        shutil.rmtree(WORK_DIR)
    MOCK_DIR.mkdir(parents=True, exist_ok=True)

    pd.DataFrame([
        {
            "stay_id": 1,
            "triage": 2,
            "pain": "8",
            "chiefcomplaint": "SHORTNESS OF BREATH",
            "arrival_transport": "AMBULANCE",
            "disposition": "ADMITTED",
            "icd_code": "J9600",
            "icd_title": "Acute respiratory failure",
            "icd_version": 10,
        },
        {
            "stay_id": 2,
            "triage": 3,
            "pain": "5",
            "chiefcomplaint": "FALL",
            "arrival_transport": "WALK IN",
            "disposition": "HOME",
            "icd_code": "S0101",
            "icd_title": "Scalp laceration",
            "icd_version": 10,
        },
    ]).to_csv(MOCK_DIR / "initial_assessment_info.csv", index=False)

    pd.DataFrame([
        {
            "stay_id": 1,
            "subject_id": 100,
            "hadm_id": 200,
            "initial_vitals": "Temperature: 100.2, Heartrate: 122.0, resprate: 28.0, o2sat: 90.0, sbp: 99.0, dbp: 47.0",
        },
        {
            "stay_id": 2,
            "subject_id": 101,
            "hadm_id": 201,
            "initial_vitals": "Temperature: 98.6, Heartrate: 88.0, resprate: 16.0, o2sat: 99.0, sbp: 132.0, dbp: 76.0",
        },
    ]).to_csv(MOCK_DIR / "vital_signs.csv", index=False)

    pd.DataFrame([
        {"stay_id": 1, "patient_info": "Gender: Female, Race: WHITE, Age: 80"},
        {"stay_id": 2, "patient_info": "Gender: Male, Race: BLACK, Age: 45"},
    ]).to_csv(MOCK_DIR / "patient_demographics.csv", index=False)

    clinical = pd.DataFrame([
        {
            "stay_id": 1,
            "text": "Synthetic note for adapter testing only.",
            "HPI": (
                "Synthetic elderly patient with worsening shortness of breath, fever, "
                "productive cough, and increased work of breathing over two days."
            ),
            "tests": "Chest x-ray showed multifocal infiltrates. CBC and BMP were obtained.",
            "past_medication": "Home albuterol inhaler and levothyroxine.",
            "diagnosis": "Acute hypoxemic respiratory failure due to pneumonia",
            "primary_diagnosis": "['Acute hypoxemic respiratory failure', 'Pneumonia']",
            "secondary_diagnosis": "['Anemia']",
        },
        {
            "stay_id": 2,
            "text": "Synthetic note for adapter testing only.",
            "HPI": (
                "Synthetic patient slipped and struck the back of the head with brief dizziness. "
                "On exam, there is a two centimeter occipital scalp laceration without focal neurologic deficit."
            ),
            "tests": "CT head was negative for acute intracranial hemorrhage.",
            "past_medication": "No anticoagulant medication.",
            "diagnosis": "Scalp laceration after fall",
            "primary_diagnosis": "['Scalp laceration']",
            "secondary_diagnosis": "['Fall']",
        },
    ])
    csv_bytes = clinical.to_csv(index=False).encode("utf-8")
    with ZipFile(MOCK_DIR / "clinical_data.csv.zip", "w") as zip_file:
        zip_file.writestr("clinical_data.csv", csv_bytes)

    pd.DataFrame([
        {
            "stay_id": 1,
            "HPI": clinical.loc[0, "HPI"],
            "patient_info": "Gender: Female, Race: WHITE, Age: 80",
            "initial_vitals": "Temperature: 100.2, Heartrate: 122.0, resprate: 28.0, o2sat: 90.0, sbp: 99.0, dbp: 47.0",
            "specialty clinician approved": "['Pulmonology']",
        },
        {
            "stay_id": 2,
            "HPI": clinical.loc[1, "HPI"],
            "patient_info": "Gender: Male, Race: BLACK, Age: 45",
            "initial_vitals": "Temperature: 98.6, Heartrate: 88.0, resprate: 16.0, o2sat: 99.0, sbp: 132.0, dbp: 76.0",
            "specialty clinician approved": "[]",
        },
    ]).to_csv(MOCK_DIR / "specialty_referral_clinician_approved.csv", index=False)


def test_adapter() -> list[dict]:
    args = SimpleNamespace(
        input_dir=str(MOCK_DIR),
        out=str(CASE_OUT),
        limit=10,
        seed=1,
        shuffle=False,
        min_hpi_chars=40,
        max_hpi_chars=500,
        max_tests_chars=500,
    )
    cases = mimic_adapter.build_cases(args)
    assert len(cases) == 2
    case = cases[0]
    assert case["schema_version"] == "clinical_case_v2"
    assert case["case_source"] == "mimic_restricted_local"
    assert case["source_restriction"] == "credentialed_local_only"
    assert case["tasks_available"]["diagnosis"] is True
    assert case["tasks_available"]["referral"] is True
    assert case["ground_truth"]["diagnoses"]["primary"] == [
        "Acute hypoxemic respiratory failure",
        "Pneumonia",
    ]
    assert case["ground_truth"]["referral"]["clinician_approved_specialty"] == ["Pulmonology"]
    assert case["evidence_availability"]["diagnoses"] == "retrospective"
    assert all(item["source_restriction"] == "credentialed_local_only" for item in case["documented_evidence"])
    exam_fact = case["augmentation"]["inferred_facts"][0]
    assert exam_fact["domain"] == "physical_exam"
    assert exam_fact["review_status"] == "local_teaching_draft"
    assert exam_fact["provenance"] == "local_teaching_inference"
    assert "Focused exam should assess" in exam_fact["statement"]

    source_exam_case = cases[1]
    source_exam_fact = source_exam_case["augmentation"]["inferred_facts"][0]
    assert source_exam_fact["domain"] == "physical_exam"
    assert source_exam_fact["review_status"] == "local_teaching_draft"
    assert source_exam_fact["provenance"] == "source_record"
    assert "Source physical exam context" in source_exam_fact["statement"]
    assert any(item["domain"] == "physical_exam" for item in source_exam_case["documented_evidence"])
    mimic_adapter.write_bundle(cases, CASE_OUT.resolve(), MOCK_DIR.resolve())
    assert CASE_OUT.exists()
    return cases


def test_audit(cases: list[dict]) -> None:
    TEXT_OUT.write_text(
        json.dumps(
            {
                "outputs": [
                    {
                        "case_id": cases[0]["id"],
                        "section": "simulation_debrief",
                        "text": (
                            "Reference ESI 2 is supported by pneumonia and respiratory failure. "
                            "The patient can be discharged home on aspirin."
                        ),
                    }
                ]
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    report = audit_grounding.audit(cases, audit_grounding.output_items(json.loads(TEXT_OUT.read_text(encoding="utf-8"))))
    assert report["summary"]["claim_counts"]["supported"] >= 1
    assert report["summary"]["claim_counts"]["contradicted"] >= 1

    cited_report = audit_grounding.audit(
        cases,
        [
            {
                "case_id": cases[0]["id"],
                "section": "grounded_tutor",
                "claims": [
                    {
                        "text": "The answer should use the documented chief complaint.",
                        "case_evidence_ids": ["case_chief_complaint"],
                    },
                    {
                        "text": "High-risk ESI teaching should cite an emergency medicine reference.",
                        "reference_chunk_ids": ["esi_v5_level_1_2"],
                    },
                    {
                        "text": "This old rule has been superseded.",
                        "reference_chunk_ids": ["old_rule"],
                    },
                    {
                        "text": "This local textbook rule is not allowed for external AI use.",
                        "reference_chunk_ids": ["restricted_textbook"],
                    },
                ],
            }
        ],
        {
            "esi_v5_level_1_2": {
                "id": "esi_v5_level_1_2",
                "active": True,
                "source": {"external_ai_use_allowed": True},
            },
            "old_rule": {
                "id": "old_rule",
                "active": False,
                "source": {"external_ai_use_allowed": True},
            },
            "restricted_textbook": {
                "id": "restricted_textbook",
                "active": True,
                "source": {"external_ai_use_allowed": False},
            },
        },
    )
    counts = cited_report["summary"]["claim_counts"]
    assert counts["case_supported"] >= 1
    assert counts["clinical_supported"] >= 1
    assert counts["stale_source"] >= 1
    assert counts["license_violation"] >= 1
    AUDIT_OUT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_OUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def write_mock_mimic_linkage_dataset() -> None:
    LINK_DIR.mkdir(parents=True, exist_ok=True)
    mimiciv = LINK_DIR / "mimiciv"
    mimic_ed = LINK_DIR / "mimic-iv-ed"
    mimic_note = LINK_DIR / "mimic-iv-note"
    mimic_cxr = LINK_DIR / "mimic-cxr"
    mimic_ecg = LINK_DIR / "mimic-iv-ecg"

    write_csv(
        LINK_MIETIC,
        [
            {
                "subject_id": 100,
                "stay_id": 300,
                "hadm_id": 200,
                "intime": "2143-03-21 07:46:00",
                "outtime": "2143-03-21 15:04:00",
                "gender": "F",
                "race": "WHITE",
                "arrival_transport": "AMBULANCE",
                "disposition": "ADMITTED",
                "temperature": 100.2,
                "heartrate": 122,
                "resprate": 28,
                "o2sat": 90,
                "sbp": 99,
                "dbp": 47,
                "pain": 8,
                "acuity": 2,
                "chiefcomplaint": "SHORTNESS OF BREATH",
                "tiragecase": "Older patient with worsening shortness of breath, fever, cough, and increased work of breathing.",
                "transfer_to_icu_in_1h": 1,
                "transfusion_within_1h": 0,
                "red_cell_order_more_than_1": 0,
                "lab_event_count": 4,
                "microbio_event_count": 1,
                "exam_count": 2,
                "consults_count": 1,
                "procedure_count": 1,
                "age": 80,
                "resources_used": 6,
            }
        ],
    )

    write_csv(mimic_ed / "ed" / "edstays.csv", [{"subject_id": 100, "hadm_id": 200, "stay_id": 300, "intime": "2143-03-21 07:46:00", "outtime": "2143-03-21 15:04:00", "gender": "F", "race": "WHITE", "arrival_transport": "AMBULANCE", "disposition": "ADMITTED"}])
    write_csv(mimic_ed / "ed" / "triage.csv", [{"subject_id": 100, "stay_id": 300, "temperature": 100.2, "heartrate": 122, "resprate": 28, "o2sat": 90, "sbp": 99, "dbp": 47, "pain": 8, "acuity": 2, "chiefcomplaint": "SHORTNESS OF BREATH"}])
    write_csv(mimic_ed / "ed" / "diagnosis.csv", [{"subject_id": 100, "stay_id": 300, "seq_num": 1, "icd_code": "J9600", "icd_version": 10, "icd_title": "Acute respiratory failure"}])
    write_csv(mimic_ed / "ed" / "vitalsign.csv", [
        {"subject_id": 100, "stay_id": 300, "charttime": "2143-03-21 08:30:00", "temperature": 100.4, "heartrate": 128, "resprate": 30, "o2sat": 88, "sbp": 92, "dbp": 45, "rhythm": "Sinus tachycardia", "pain": "8"},
        {"subject_id": 100, "stay_id": 300, "charttime": "2143-03-21 09:15:00", "temperature": 100.1, "heartrate": 118, "resprate": 24, "o2sat": 94, "sbp": 106, "dbp": 58, "rhythm": "Sinus tachycardia", "pain": "6"},
    ])
    write_csv(mimic_ed / "ed" / "medrecon.csv", [{"subject_id": 100, "stay_id": 300, "charttime": "2143-03-21 07:55:00", "name": "Albuterol inhaler", "gsn": "1", "ndc": "2", "etccode": "RESP", "etcdescription": "Bronchodilator"}])
    write_csv(mimic_ed / "ed" / "pyxis.csv", [{"subject_id": 100, "stay_id": 300, "charttime": "2143-03-21 08:05:00", "med_rn": 1, "name": "Ceftriaxone", "gsn": "3"}])

    write_csv(mimiciv / "hosp" / "admissions.csv", [{"subject_id": 100, "hadm_id": 200, "admittime": "2143-03-21 15:10:00", "dischtime": "2143-03-25 12:00:00", "admission_type": "EW EMER.", "admission_location": "EMERGENCY ROOM", "discharge_location": "HOME", "race": "WHITE", "edregtime": "2143-03-21 07:46:00", "edouttime": "2143-03-21 15:04:00", "hospital_expire_flag": 0}])
    write_csv(mimiciv / "hosp" / "diagnoses_icd.csv", [{"subject_id": 100, "hadm_id": 200, "seq_num": 1, "icd_code": "J189", "icd_version": 10}])
    write_csv(mimiciv / "hosp" / "d_icd_diagnoses.csv", [{"icd_code": "J189", "icd_version": 10, "long_title": "Pneumonia, unspecified organism"}])
    write_csv(mimiciv / "hosp" / "procedures_icd.csv", [{"subject_id": 100, "hadm_id": 200, "seq_num": 1, "chartdate": "2143-03-21", "icd_code": "5A09357", "icd_version": 10}])
    write_csv(mimiciv / "hosp" / "d_icd_procedures.csv", [{"icd_code": "5A09357", "icd_version": 10, "long_title": "Assistance with respiratory ventilation"}])
    write_csv(mimiciv / "hosp" / "d_labitems.csv", [
        {"itemid": 50931, "label": "Glucose", "fluid": "Blood", "category": "Chemistry"},
        {"itemid": 50813, "label": "Lactate", "fluid": "Blood", "category": "Blood Gas"},
        {"itemid": 51222, "label": "Hemoglobin", "fluid": "Blood", "category": "Hematology"},
        {"itemid": 52033, "label": "ABO/Rh Type", "fluid": "Blood", "category": "Blood Bank"},
    ])
    write_csv(mimiciv / "hosp" / "labevents.csv", [
        {"labevent_id": 1, "subject_id": 100, "hadm_id": 200, "itemid": 50931, "charttime": "2143-03-21 08:00:00", "storetime": "2143-03-21 08:05:00", "value": "62", "valuenum": 62, "valueuom": "mg/dL", "flag": "abnormal", "priority": "STAT"},
        {"labevent_id": 2, "subject_id": 100, "hadm_id": 200, "itemid": 50813, "charttime": "2143-03-21 08:10:00", "storetime": "2143-03-21 08:30:00", "value": "4.1", "valuenum": 4.1, "valueuom": "mmol/L", "flag": "abnormal", "priority": "STAT"},
        {"labevent_id": 3, "subject_id": 100, "hadm_id": 200, "itemid": 51222, "charttime": "2143-03-21 08:10:00", "storetime": "2143-03-21 08:40:00", "value": "8.2", "valuenum": 8.2, "valueuom": "g/dL", "flag": "abnormal", "priority": "STAT"},
        {"labevent_id": 4, "subject_id": 100, "hadm_id": 200, "itemid": 52033, "charttime": "2143-03-21 08:15:00", "storetime": "2143-03-21 08:45:00", "value": "O POS", "valuenum": "", "valueuom": "", "flag": "", "priority": "STAT"},
    ])
    write_csv(mimiciv / "hosp" / "microbiologyevents.csv", [{"subject_id": 100, "hadm_id": 200, "micro_specimen_id": 10, "chartdate": "2143-03-21", "charttime": "2143-03-21 08:20:00", "storetime": "2143-03-22 10:00:00", "spec_type_desc": "BLOOD CULTURE", "test_name": "Blood Culture", "org_name": "STREPTOCOCCUS PNEUMONIAE", "ab_name": "CEFTRIAXONE", "interpretation": "S"}])
    write_csv(mimiciv / "hosp" / "poe.csv", [
        {"poe_id": "100-1", "poe_seq": 1, "subject_id": 100, "hadm_id": 200, "ordertime": "2143-03-21 08:01:00", "order_type": "Lab", "order_subtype": "CBC", "transaction_type": "New", "order_status": "Active"},
        {"poe_id": "100-2", "poe_seq": 2, "subject_id": 100, "hadm_id": 200, "ordertime": "2143-03-21 08:02:00", "order_type": "Radiology", "order_subtype": "Chest X-Ray", "transaction_type": "New", "order_status": "Active"},
        {"poe_id": "100-3", "poe_seq": 3, "subject_id": 100, "hadm_id": 200, "ordertime": "2143-03-21 08:03:00", "order_type": "Consults", "order_subtype": "Critical Care", "transaction_type": "New", "order_status": "Active"},
        {"poe_id": "100-4", "poe_seq": 4, "subject_id": 100, "hadm_id": 200, "ordertime": "2143-03-21 08:04:00", "order_type": "Blood Bank", "order_subtype": "Type and Screen", "transaction_type": "New", "order_status": "Active"},
    ])
    write_csv(mimiciv / "hosp" / "prescriptions.csv", [{"subject_id": 100, "hadm_id": 200, "pharmacy_id": 55, "poe_id": "100-5", "starttime": "2143-03-21 08:06:00", "stoptime": "2143-03-22 08:06:00", "drug_type": "MAIN", "drug": "Vancomycin", "dose_val_rx": "1000", "dose_unit_rx": "mg", "route": "IV"}])
    write_csv(mimiciv / "hosp" / "pharmacy.csv", [{"subject_id": 100, "hadm_id": 200, "pharmacy_id": 55, "poe_id": "100-5", "starttime": "2143-03-21 08:06:00", "stoptime": "2143-03-22 08:06:00", "medication": "Vancomycin", "proc_type": "IV Piggyback", "status": "Active", "entertime": "2143-03-21 08:06:00", "verifiedtime": "2143-03-21 08:07:00", "route": "IV", "frequency": "Once"}])
    write_csv(mimiciv / "hosp" / "emar.csv", [{"subject_id": 100, "hadm_id": 200, "emar_id": "e1", "pharmacy_id": 55, "charttime": "2143-03-21 08:10:00", "medication": "Vancomycin", "event_txt": "Administered", "scheduletime": "2143-03-21 08:10:00", "storetime": "2143-03-21 08:11:00"}])
    write_csv(mimiciv / "hosp" / "services.csv", [{"subject_id": 100, "hadm_id": 200, "transfertime": "2143-03-21 15:15:00", "prev_service": "MED", "curr_service": "MICU"}])
    write_csv(mimiciv / "hosp" / "transfers.csv", [{"subject_id": 100, "hadm_id": 200, "transfer_id": 900, "eventtype": "transfer", "careunit": "Medical Intensive Care Unit", "intime": "2143-03-21 15:20:00", "outtime": "2143-03-22 12:00:00"}])
    write_csv(mimiciv / "icu" / "icustays.csv", [{"subject_id": 100, "hadm_id": 200, "stay_id": 800, "first_careunit": "MICU", "last_careunit": "MICU", "intime": "2143-03-21 15:20:00", "outtime": "2143-03-22 12:00:00", "los": 0.9}])
    write_csv(mimiciv / "icu" / "d_items.csv", [{"itemid": 225792, "label": "Invasive Ventilation"}, {"itemid": 221906, "label": "Norepinephrine"}])
    write_csv(mimiciv / "icu" / "procedureevents.csv", [{"subject_id": 100, "hadm_id": 200, "stay_id": 800, "starttime": "2143-03-21 15:30:00", "endtime": "2143-03-21 18:30:00", "storetime": "2143-03-21 15:31:00", "itemid": 225792, "value": 180, "valueuom": "min", "statusdescription": "FinishedRunning"}])
    write_csv(mimiciv / "icu" / "inputevents.csv", [{"subject_id": 100, "hadm_id": 200, "stay_id": 800, "starttime": "2143-03-21 15:40:00", "endtime": "2143-03-21 18:00:00", "storetime": "2143-03-21 15:41:00", "itemid": 221906, "amount": 8, "amountuom": "mg", "rate": 0.05, "rateuom": "mcg/kg/min", "statusdescription": "Changed"}])
    write_csv(mimic_note / "note" / "discharge.csv", [{"note_id": "d1", "subject_id": 100, "hadm_id": 200, "charttime": "2143-03-25 12:00:00", "storetime": "2143-03-25 12:10:00", "text": "Discharge summary: treated for pneumonia and respiratory failure requiring ICU care."}])
    write_csv(mimic_note / "note" / "radiology.csv", [{"note_id": "r1", "subject_id": 100, "hadm_id": 200, "charttime": "2143-03-21 08:30:00", "storetime": "2143-03-21 09:00:00", "text": "Chest radiograph shows multifocal pneumonia without pneumothorax."}])
    write_csv(mimic_cxr / "cxr-study-list.csv", [{"subject_id": 100, "study_id": 500, "studydate": "21430321", "studytime": "083000"}])
    write_csv(mimic_cxr / "cxr_reports.csv", [{"subject_id": 100, "study_id": 500, "report": "CXR impression: multifocal pneumonia."}])
    write_csv(mimic_ecg / "record-list.csv", [{"subject_id": 100, "study_id": 700, "ecg_time": "2143-03-21 07:58:00", "path": "files/p100/s700"}])
    write_csv(mimic_ecg / "machine_measurements.csv", [{"subject_id": 100, "study_id": 700, "ecg_time": "2143-03-21 07:58:00", "heart_rate": 122, "rr_interval": 500, "qrs_duration": 90, "qtc": 440, "report_0": "Sinus tachycardia", "report_1": "Nonspecific ST abnormality"}])


def test_mietic_mimic_linker() -> dict:
    write_mock_mimic_linkage_dataset()
    args = SimpleNamespace(
        mietic=str(LINK_MIETIC),
        mimiciv_dir=str(LINK_DIR / "mimiciv"),
        mimic_ed_dir=str(LINK_DIR / "mimic-iv-ed"),
        mimic_note_dir=str(LINK_DIR / "mimic-iv-note"),
        mimic_cxr_dir=str(LINK_DIR / "mimic-cxr"),
        mimic_ecg_dir=str(LINK_DIR / "mimic-iv-ecg"),
        out=str(LINK_OUT),
        before_hours=6,
        after_hours=24,
        limit_per_case=20,
    )
    payload = mimic_linker.build_payload(args)
    assert payload["schema_version"] == "restricted_mietic_mimic_enrichment_v1"
    assert payload["source_restriction"] == "credentialed_local_only"
    assert payload["case_count"] == 1
    case = payload["cases"][0]
    assert case["schema_version"] == "clinical_case_v3"
    assert case["source"]["dataset"] == "MIETIC-MIMIC-IV-Enriched"
    assert case["linked_context"]["ed"]["repeat_vitals"]
    assert case["linked_context"]["hosp"]["labs"]
    assert case["linked_context"]["icu"]["inputevents"]
    assert case["linked_context"]["note"]["discharge"]
    assert case["linked_context"]["cxr"]["reports"]
    assert case["linked_context"]["ecg"]["machine_measurements"]
    by_id = {item["id"]: item for item in case["optional_objective_data"]}
    assert by_id["repeat_vitals"]["display_policy"] == "encounter_unlock"
    assert by_id["poc_glucose"]["availability"] == "available"
    assert by_id["labs"]["display_policy"] == "plan_unlock"
    assert by_id["imaging_orders"]["display_policy"] == "plan_unlock"
    assert by_id["reassessment_updates"]["display_policy"] == "reassessment_unlock"
    assert by_id["retrospective_notes"]["display_policy"] == "debrief_only"
    assert "Discharge summary" not in by_id["reassessment_updates"]["summary"]
    assert case["module_availability"]["note"]["tables"]["discharge"]["status"] == "found"
    mimic_linker.assert_restricted_output(LINK_OUT.resolve())
    LINK_OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return payload


def main() -> None:
    write_mock_mimic_dataset()
    cases = test_adapter()
    test_audit(cases)
    test_mietic_mimic_linker()
    print("Restricted case tool smoke tests passed.")


if __name__ == "__main__":
    main()
