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


WORK_DIR = ROOT / "data" / "restricted" / "tool_test"
MOCK_DIR = WORK_DIR / "mock_mimic"
CASE_OUT = WORK_DIR / "mock_cases.restricted.json"
TEXT_OUT = WORK_DIR / "mock_outputs.restricted.json"
AUDIT_OUT = WORK_DIR / "mock_audit.restricted.json"


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
    AUDIT_OUT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_OUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    write_mock_mimic_dataset()
    cases = test_adapter()
    test_audit(cases)
    print("Restricted case tool smoke tests passed.")


if __name__ == "__main__":
    main()
