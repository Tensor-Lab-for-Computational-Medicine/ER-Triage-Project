"""Generate local-only simulator cases from MIMIC-IV-Ext-CDS.

The output is restricted and must stay ignored by git. It is intended for local
research, grounding audits, and ML-fellow validation work, not public deployment.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import subprocess
from pathlib import Path
from typing import Any
from zipfile import ZipFile

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_DIR = ROOT / "mimic-iv-ext-clinical-decision-support-for-referral-triage-and-diagnosis-1.0.2"
DEFAULT_OUTPUT = ROOT / "data" / "restricted" / "mimic_iv_ext_cases.restricted.json"

CASE_SCHEMA_VERSION = "clinical_case_v2"
DATASET_NAME = "MIMIC-IV-Ext-CDS"
DATASET_VERSION = "1.0.2"
SOURCE_RESTRICTION = "credentialed_local_only"


def compact_text(value: Any) -> str:
    return " ".join(str(value or "").replace("\n", " ").split()).strip()


def parse_int(value: Any) -> int | None:
    if pd.isna(value):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def parse_float(value: Any) -> float | None:
    if pd.isna(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def read_csv(path: Path, **kwargs: Any) -> pd.DataFrame:
    if path.suffix == ".zip":
        with ZipFile(path) as zf:
            with zf.open("clinical_data.csv") as handle:
                return pd.read_csv(handle, **kwargs)
    return pd.read_csv(path, **kwargs)


def is_gitignored(path: Path) -> bool:
    result = subprocess.run(
        ["git", "check-ignore", "-q", str(path.relative_to(ROOT))],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def assert_restricted_output(path: Path) -> None:
    resolved = path.resolve()
    try:
        resolved.relative_to(ROOT)
    except ValueError as exc:
        raise SystemExit(f"Output must be inside the repository so git ignore rules can protect it: {resolved}") from exc
    if not is_gitignored(resolved):
        raise SystemExit(
            f"Refusing to write restricted MIMIC-derived data to a non-ignored path: {resolved}"
        )


def parse_patient_info(value: str) -> dict[str, Any]:
    text = compact_text(value)
    gender = re.search(r"Gender:\s*([^,]+)", text, flags=re.I)
    race = re.search(r"Race:\s*([^,]+)", text, flags=re.I)
    age = re.search(r"Age:\s*(\d+(?:\.\d+)?)", text, flags=re.I)
    return {
        "age": parse_float(age.group(1)) if age else None,
        "sex": compact_text(gender.group(1)) if gender else "Unknown",
        "race": compact_text(race.group(1)) if race else "Unknown",
    }


def parse_vitals(value: str) -> dict[str, float | None]:
    text = compact_text(value)
    aliases = {
        "temp": r"Temperature:\s*([-+]?\d+(?:\.\d+)?)",
        "hr": r"Heartrate:\s*([-+]?\d+(?:\.\d+)?)",
        "rr": r"resprate:\s*([-+]?\d+(?:\.\d+)?)",
        "o2": r"o2sat:\s*([-+]?\d+(?:\.\d+)?)",
        "sbp": r"sbp:\s*([-+]?\d+(?:\.\d+)?)",
        "dbp": r"dbp:\s*([-+]?\d+(?:\.\d+)?)",
    }
    return {
        key: parse_float(match.group(1)) if (match := re.search(pattern, text, flags=re.I)) else None
        for key, pattern in aliases.items()
    }


def parse_pain(value: Any) -> float | None:
    if pd.isna(value):
        return None
    numeric = parse_float(value)
    if numeric is not None:
        return numeric
    return None


def evidence_item(
    evidence_id: str,
    domain: str,
    statement: str,
    source_field: str,
    *,
    use: str = "simulation_grounding",
    provenance: str = "source_record",
) -> dict[str, Any] | None:
    cleaned = compact_text(statement)
    if not cleaned:
        return None
    return {
        "id": evidence_id,
        "domain": domain,
        "statement": cleaned,
        "source_field": source_field,
        "provenance": provenance,
        "source_restriction": SOURCE_RESTRICTION,
        "use": use,
    }


def parse_list_text(value: Any) -> list[str]:
    text = compact_text(value)
    if not text or text == "[]":
        return []
    stripped = text.strip("[]")
    if not stripped:
        return []
    values = re.findall(r"'([^']+)'|\"([^\"]+)\"", text)
    if values:
        return [compact_text(left or right) for left, right in values if compact_text(left or right)]
    return [compact_text(part) for part in re.split(r";|,\s*(?=[A-Z][a-z])", stripped) if compact_text(part)]


def vital_anchors(vitals: dict[str, float | None]) -> list[str]:
    anchors: list[str] = []
    for label, key in [
        ("heart rate", "hr"),
        ("respiratory rate", "rr"),
        ("oxygen saturation", "o2"),
        ("systolic blood pressure", "sbp"),
        ("temperature", "temp"),
        ("pain", "pain"),
    ]:
        value = vitals.get(key)
        if value is None:
            continue
        if key == "hr" and (value >= 110 or value < 60):
            anchors.append(f"{label}: {value}")
        elif key == "rr" and (value >= 22 or value < 12):
            anchors.append(f"{label}: {value}")
        elif key == "o2" and value < 94:
            anchors.append(f"{label}: {value}")
        elif key == "sbp" and (value < 100 or value >= 160):
            anchors.append(f"{label}: {value}")
        elif key == "temp" and (value >= 100.4 or value < 96.8):
            anchors.append(f"{label}: {value}")
        elif key == "pain" and value >= 7:
            anchors.append(f"{label}: {value}")
    return anchors


def source_exam_snippet(row: pd.Series) -> tuple[str, str]:
    for field in ["HPI", "tests"]:
        text = compact_text(row.get(field))
        if not text:
            continue
        sentences = re.split(r"(?<=[.!?])\s+|(?<=:)\s+", text)
        candidates = [
            compact_text(sentence)
            for sentence in sentences
            if re.search(r"\b(on exam|physical exam|exam showed|exam notable|exam:|appears|abdomen|lungs?|breath sounds?|pulses?|tender|distress|neurologic|oriented|laceration|swelling|wound)\b", sentence, flags=re.I)
        ]
        if candidates:
            snippet = compact_text(" ".join(candidates[:3]))
            return snippet[:700], f"clinical_data.{field}"
    return "", ""


def focused_exam_target(row: pd.Series, diagnoses: dict[str, Any], vitals: dict[str, float | None], triage: int | None) -> dict[str, Any]:
    source_snippet, source_field = source_exam_snippet(row)
    complaint = compact_text(row.get("chiefcomplaint"))
    diagnosis_text = " ".join(diagnoses.get("primary", []) + diagnoses.get("secondary", []) + [diagnoses.get("icd", {}).get("title", "")])
    combined = f"{complaint} {row.get('HPI', '')} {diagnosis_text}".lower()

    if source_snippet:
        statement = f"Source physical exam context: {source_snippet}"
        rationale = "The restricted MIMIC source text includes exam-relevant bedside context; it is displayed as source context for local validation only."
        provenance = "source_record"
        confidence = "high"
    elif re.search(r"\b(shortness of breath|dyspnea|respiratory|pneumonia|hypox|asthma|copd|chest pain)\b", combined):
        statement = "Focused exam should assess work of breathing, ability to speak, oxygen requirement, breath sounds, chest wall findings, cardiac rhythm and perfusion, edema, and thromboembolic clues when relevant."
        rationale = "The source supports cardiopulmonary triage reasoning but does not provide a structured physical exam."
        provenance = "local_teaching_inference"
        confidence = "moderate"
    elif re.search(r"\b(altered|syncope|seizure|stroke|weakness|headache|intracranial|confusion|fall)\b", combined):
        statement = "Focused exam should assess airway protection, glucose or toxidrome clues, orientation, speech, cranial nerves, motor strength, sensation, coordination, gait or trauma signs, and serial neurologic change."
        rationale = "The source supports neurologic or altered-mental-status triage reasoning but does not provide a structured bedside neurologic exam."
        provenance = "local_teaching_inference"
        confidence = "moderate"
    elif re.search(r"\b(abdominal|abdomen|vomiting|nausea|pelvic|rectal|perianal|crohn|bowel|appendicitis)\b", combined):
        statement = "Focused exam should assess abdominal tenderness location, distention, guarding, rebound, rigidity, bowel sounds, hydration, CVA tenderness, pelvic or perianal findings when indicated, and serial abdominal exam change."
        rationale = "The source supports abdominal or pelvic diagnostic reasoning but does not provide a structured focused exam."
        provenance = "local_teaching_inference"
        confidence = "moderate"
    elif re.search(r"\b(fracture|injury|laceration|wound|swelling|pain|leg|arm|hand|foot|ankle|wrist)\b", combined):
        statement = "Focused exam should assess location of injury, deformity, swelling, open wound or contamination, focal tenderness, range of motion or function, distal pulses, capillary refill, motor function, and sensation."
        rationale = "The source supports extremity or wound-focused reasoning but does not provide a structured musculoskeletal or neurovascular exam."
        provenance = "local_teaching_inference"
        confidence = "moderate"
    elif re.search(r"\b(fever|sepsis|infection|abscess|cellulitis)\b", combined):
        statement = "Focused exam should assess mental status, perfusion, skin findings, source-specific tenderness or drainage, cardiopulmonary status, hydration, and signs of systemic toxicity."
        rationale = "The source supports infectious or sepsis-focused reasoning but does not provide a structured source exam."
        provenance = "local_teaching_inference"
        confidence = "moderate"
    else:
        statement = "Focused exam should assess general appearance, mental status, airway and breathing, perfusion, pain or distress, and complaint-directed organ system findings that would change triage or initial management."
        rationale = "The source provides enough context for local simulation but does not provide a structured physical exam."
        provenance = "local_teaching_inference"
        confidence = "low"

    anchors = [
        complaint,
        f"Reference ESI {triage}" if triage else "",
        *diagnoses.get("primary", [])[:2],
        *vital_anchors(vitals)[:3],
    ]
    return {
        "id": f"mimic_{int(row['stay_id'])}_exam_01",
        "domain": "physical_exam",
        "statement": statement,
        "rationale": rationale,
        "source_anchors": [anchor for anchor in anchors if anchor],
        "confidence": confidence,
        "review_status": "local_teaching_draft",
        "provenance": provenance,
        "source_field": source_field or "local_complaint_vitals_diagnosis_template",
        "source_restriction": SOURCE_RESTRICTION,
        "use_in": ["physical_exam", "soap", "decision_review"],
    }


def source_tables(input_dir: Path) -> dict[str, pd.DataFrame]:
    required = {
        "initial": input_dir / "initial_assessment_info.csv",
        "vitals": input_dir / "vital_signs.csv",
        "demographics": input_dir / "patient_demographics.csv",
        "clinical": input_dir / "clinical_data.csv.zip",
    }
    missing = [str(path) for path in required.values() if not path.exists()]
    if missing:
        raise SystemExit("MIMIC-IV-Ext-CDS input folder is missing required files:\n" + "\n".join(missing))

    tables = {
        "initial": read_csv(required["initial"]),
        "vitals": read_csv(required["vitals"]),
        "demographics": read_csv(required["demographics"]),
        "clinical": read_csv(
            required["clinical"],
            usecols=[
                "stay_id",
                "HPI",
                "tests",
                "past_medication",
                "diagnosis",
                "primary_diagnosis",
                "secondary_diagnosis",
            ],
        ),
    }

    approved = input_dir / "specialty_referral_clinician_approved.csv"
    if approved.exists():
        approved_df = read_csv(approved)
        approved_df = approved_df.rename(columns={"specialty clinician approved": "clinician_approved_specialty"})
        tables["approved_referral"] = approved_df[["stay_id", "clinician_approved_specialty"]]
    else:
        tables["approved_referral"] = pd.DataFrame(columns=["stay_id", "clinician_approved_specialty"])
    return tables


def merged_core(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    core = tables["initial"].merge(tables["vitals"], on="stay_id", how="left")
    core = core.merge(tables["demographics"], on="stay_id", how="left")
    core = core.merge(tables["clinical"], on="stay_id", how="left")
    core = core.merge(tables["approved_referral"], on="stay_id", how="left")
    return core


def row_complete(row: pd.Series, min_hpi_chars: int, max_hpi_chars: int, max_tests_chars: int) -> bool:
    required = [
        "triage",
        "chiefcomplaint",
        "arrival_transport",
        "disposition",
        "icd_title",
        "initial_vitals",
        "patient_info",
        "HPI",
        "tests",
        "primary_diagnosis",
    ]
    if any(pd.isna(row.get(field)) or not compact_text(row.get(field)) for field in required):
        return False
    hpi_len = len(compact_text(row.get("HPI")))
    tests_len = len(compact_text(row.get("tests")))
    return min_hpi_chars <= hpi_len <= max_hpi_chars and tests_len <= max_tests_chars


def row_to_case(row: pd.Series, ordinal: int) -> dict[str, Any]:
    patient = parse_patient_info(row["patient_info"])
    vitals = parse_vitals(row["initial_vitals"])
    pain = parse_pain(row.get("pain"))
    vitals["pain"] = pain
    triage = parse_int(row["triage"])
    diagnoses = {
        "primary": parse_list_text(row.get("primary_diagnosis")),
        "secondary": parse_list_text(row.get("secondary_diagnosis")),
        "icd": {
            "code": compact_text(row.get("icd_code")),
            "title": compact_text(row.get("icd_title")),
            "version": parse_int(row.get("icd_version")),
        },
        "raw_diagnosis_text": compact_text(row.get("diagnosis")),
    }
    specialty = parse_list_text(row.get("clinician_approved_specialty"))
    evidence = [
        evidence_item("source_demographics", "demographics", row["patient_info"], "patient_demographics.patient_info"),
        evidence_item("source_chief_complaint", "chief_complaint", row["chiefcomplaint"], "initial_assessment_info.chiefcomplaint"),
        evidence_item("source_hpi", "history_of_present_illness", row["HPI"], "clinical_data.HPI"),
        evidence_item("source_vitals", "vitals", row["initial_vitals"], "vital_signs.initial_vitals"),
        evidence_item("source_triage", "triage_level", f"Reference ESI {triage}.", "initial_assessment_info.triage"),
        evidence_item("source_pain", "pain", f"Pain: {compact_text(row.get('pain'))}.", "initial_assessment_info.pain"),
        evidence_item("source_disposition", "disposition", row["disposition"], "initial_assessment_info.disposition", use="retrospective_grounding"),
        evidence_item("source_icd", "diagnosis", row["icd_title"], "initial_assessment_info.icd_title", use="retrospective_grounding"),
        evidence_item("source_primary_diagnosis", "primary_diagnosis", "; ".join(diagnoses["primary"]), "clinical_data.primary_diagnosis", use="retrospective_grounding"),
        evidence_item("source_secondary_diagnosis", "secondary_diagnosis", "; ".join(diagnoses["secondary"]), "clinical_data.secondary_diagnosis", use="retrospective_grounding"),
        evidence_item("source_tests", "tests", row["tests"], "clinical_data.tests", use="retrospective_grounding"),
        evidence_item("source_past_medication", "past_medication", row.get("past_medication"), "clinical_data.past_medication", use="retrospective_grounding"),
        evidence_item("source_approved_referral", "clinician_approved_specialty", "; ".join(specialty), "specialty_referral_clinician_approved", use="retrospective_grounding"),
    ]
    documented_evidence = [item for item in evidence if item]
    focused_exam = focused_exam_target(row, diagnoses, vitals, triage)
    if focused_exam["provenance"] == "source_record":
        documented_evidence.append(
            evidence_item(
                "source_focused_exam",
                "physical_exam",
                focused_exam["statement"],
                focused_exam["source_field"],
                use="simulation_grounding",
                provenance="source_record",
            )
        )

    return {
        "schema_version": CASE_SCHEMA_VERSION,
        "id": f"mimic_ext_{ordinal:05d}",
        "case_source": "mimic_restricted_local",
        "source_restriction": SOURCE_RESTRICTION,
        "dataset_license": "PhysioNet Credentialed Health Data License 1.5.0",
        "generated_for": "local_research_validation_only",
        "tasks_available": {
            "triage": True,
            "diagnosis": True,
            "referral": True,
            "management": True,
            "reassessment": True,
            "sbar": True,
        },
        "demographics": {
            "age": patient["age"],
            "sex": patient["sex"],
            "race": patient["race"],
            "transport": compact_text(row.get("arrival_transport")),
        },
        "complaint": compact_text(row["chiefcomplaint"]),
        "history": compact_text(row["HPI"]),
        "vitals": vitals,
        "acuity": triage,
        "disposition": compact_text(row["disposition"]),
        "ground_truth": {
            "diagnoses": diagnoses,
            "tests": compact_text(row.get("tests")),
            "medications": compact_text(row.get("past_medication")),
            "past_medication": compact_text(row.get("past_medication")),
            "referral": {
                "clinician_approved_specialty": specialty,
                "scoring": "source_record_when_present",
            },
            "disposition": compact_text(row["disposition"]),
            "reference_esi": triage,
        },
        "evidence_availability": {
            "chief_complaint": "triage",
            "hpi": "after_questioning",
            "vitals": "triage",
            "diagnoses": "retrospective",
            "tests": "retrospective",
            "medications": "retrospective",
            "disposition": "retrospective",
            "referral": "retrospective",
        },
        "workflow_reference": {
            "initial_triage": {
                "reference_esi": triage,
                "chief_complaint": compact_text(row["chiefcomplaint"]),
                "pain_raw": compact_text(row.get("pain")),
                "initial_vitals": compact_text(row["initial_vitals"]),
            },
            "retrospective_context": {
                "diagnosis": diagnoses["primary"],
                "tests": "Available only after ED evaluation; use for debrief grounding, not triage reveal.",
                "medications": "Available only as retrospective medication context.",
                "referral": specialty,
                "disposition": compact_text(row["disposition"]),
            },
        },
        "source": {
            "dataset": DATASET_NAME,
            "version": DATASET_VERSION,
            "restriction": SOURCE_RESTRICTION,
            "stay_id": int(row["stay_id"]),
            "subject_id": int(row["subject_id"]) if not pd.isna(row.get("subject_id")) else None,
            "hadm_id": int(row["hadm_id"]) if not pd.isna(row.get("hadm_id")) else None,
            "provenance_fields": sorted({item["source_field"] for item in documented_evidence}),
        },
        "documented_evidence": documented_evidence,
        "augmentation": {
            "version": "case_augmentation_v2",
            "review_status": "local_teaching_draft",
            "generated_by": "restricted_mimic_adapter",
            "model": "local_rule_based_exam_target_v1",
            "prompt_version": "restricted_mimic_case_adapter_v1",
            "inferred_facts": [focused_exam],
        },
        "missing_evidence": [
            {
                "domain": "attending_management_plan",
                "needed_for": "prospective management gold standard",
                "reason": "The dataset includes retrospective tests, medications, diagnoses, and disposition, but not a stepwise attending-authored ED management plan.",
            }
        ],
    }


def build_cases(args: argparse.Namespace) -> list[dict[str, Any]]:
    input_dir = Path(args.input_dir).expanduser().resolve()
    tables = source_tables(input_dir)
    core = merged_core(tables)
    filtered = core[
        core.apply(
            row_complete,
            axis=1,
            min_hpi_chars=args.min_hpi_chars,
            max_hpi_chars=args.max_hpi_chars,
            max_tests_chars=args.max_tests_chars,
        )
    ].copy()
    filtered = filtered.sort_values(["triage", "stay_id"], ascending=[True, True])

    if args.seed is not None:
        filtered = filtered.sample(frac=1, random_state=args.seed)
    elif args.shuffle:
        filtered = filtered.sample(frac=1, random_state=random.randint(1, 1_000_000))

    if args.limit:
        filtered = filtered.head(args.limit)

    return [row_to_case(row, index) for index, (_, row) in enumerate(filtered.iterrows(), start=1)]


def write_bundle(cases: list[dict[str, Any]], output: Path, input_dir: Path) -> None:
    assert_restricted_output(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    bundle = {
        "schema_version": "restricted_case_bundle_v1",
        "source_dataset": DATASET_NAME,
        "source_version": DATASET_VERSION,
        "source_restriction": SOURCE_RESTRICTION,
        "input_dir": str(input_dir),
        "case_count": len(cases),
        "cases": cases,
    }
    output.write_text(json.dumps(bundle, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate local restricted MIMIC-IV-Ext-CDS simulator cases.")
    parser.add_argument("--input-dir", default=os.environ.get("MIMIC_IV_EXT_CDS_DIR", str(DEFAULT_INPUT_DIR)))
    parser.add_argument("--out", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--seed", type=int, default=13)
    parser.add_argument("--shuffle", action="store_true")
    parser.add_argument("--min-hpi-chars", type=int, default=120)
    parser.add_argument("--max-hpi-chars", type=int, default=1200)
    parser.add_argument("--max-tests-chars", type=int, default=1800)
    args = parser.parse_args()

    output = Path(args.out).expanduser().resolve()
    input_dir = Path(args.input_dir).expanduser().resolve()
    cases = build_cases(args)
    write_bundle(cases, output, input_dir)
    print(f"Wrote {len(cases)} restricted MIMIC-IV-Ext-CDS cases to {output}")


if __name__ == "__main__":
    main()
