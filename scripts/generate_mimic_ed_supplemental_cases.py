"""Generate a local-only supplemental MIMIC-IV-ED case bundle.

This script is for credentialed local workflow testing when the reviewed public
MIETIC bundle plus the MIETIC-linked restricted bundle contain fewer than the
requested 100 distinct cases. It samples deidentified ED encounters from local
MIMIC-IV-ED tables, emits pseudonymous case IDs, and keeps the output under
`data/restricted/`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import subprocess
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MIMIC_ED_DIR = Path(r"D:\Projects\EHR Triage\mimic-iv-ed-2.2\mimic-iv-ed-2.2\ed")
DEFAULT_PATIENTS = Path(r"D:\Projects\EHR Triage\mimic-iv-3.1\mimic-iv-3.1\hosp\patients.csv.gz")
DEFAULT_MIETIC = ROOT / "data" / "raw" / "mietic_validate_samples.csv"
DEFAULT_OUTPUT = ROOT / "data" / "restricted" / "mimic_iv_ed_supplemental_cases.restricted.json"

DATASET_NAME = "MIMIC-IV-ED-Restricted-Supplement"
DATASET_VERSION = "2.2"
CASE_SCHEMA_VERSION = "clinical_case_v3"
SOURCE_RESTRICTION = "credentialed_local_only"

INTERVENTION_FIELDS = [
    "invasive_ventilation",
    "intravenous",
    "intravenous_fluids",
    "intramuscular",
    "oral_medications",
    "nebulized_medications",
    "tier1_med_usage_1h",
    "tier2_med_usage",
    "tier3_med_usage",
    "tier4_med_usage",
    "critical_procedure",
    "psychotropic_med_within_120min",
]

OUTCOME_BOOL_FIELDS = [
    "transfer2surgeryin1h",
    "transfer_to_surgery_beyond_1h",
    "transfer_to_icu_in_1h",
    "transfer_to_icu_beyond_1h",
    "transfer_within_1h",
    "transfer_beyond_1h",
    "expired_within_1h",
    "expired_beyond_1h",
    "red_cell_order_more_than_1",
    "transfusion_within_1h",
    "transfusion_beyond_1h",
    "invasive_ventilation_beyond_1h",
    "non_invasive_ventilation",
    "tier1_med_usage_beyond_1h",
    "intraosseous_line_placed",
]


def compact_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return " ".join(str(value or "").replace("\n", " ").split()).strip()


def parse_float(value: Any) -> float | None:
    if pd.isna(value):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def parse_int(value: Any) -> int | None:
    parsed = parse_float(value)
    return int(parsed) if parsed is not None else None


def normalized_complaint(value: Any) -> str:
    text = compact_text(value)
    text = re.sub(r"\s+", " ", text)
    return text[:120] or "Undifferentiated ED concern"


def sex_label(value: str) -> str:
    text = compact_text(value).upper()
    if text.startswith("F"):
        return "female"
    if text.startswith("M"):
        return "male"
    return "patient"


def pseudonym(*parts: Any) -> str:
    text = "|".join(compact_text(part) for part in parts)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def is_gitignored(path: Path) -> bool:
    try:
        relative = path.resolve().relative_to(ROOT)
    except ValueError:
        return False
    result = subprocess.run(
        ["git", "check-ignore", "-q", str(relative)],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def assert_restricted_output(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not is_gitignored(path):
        raise SystemExit(f"Refusing to write restricted case data to a non-ignored path: {path}")


def read_required(path: Path, label: str, **kwargs: Any) -> pd.DataFrame:
    if not path.exists():
        raise SystemExit(f"Missing {label}: {path}")
    return pd.read_csv(path, **kwargs)


def source_stay_ids(path: Path) -> set[int]:
    if not path.exists():
        return set()
    df = pd.read_csv(path, encoding="utf-8-sig", usecols=lambda name: str(name).replace("\ufeff", "") == "stay_id")
    df.columns = df.columns.str.replace("\ufeff", "")
    return {int(value) for value in df["stay_id"].dropna().tolist()}


def diagnosis_groups(path: Path, selected_stay_ids: set[int]) -> dict[int, list[str]]:
    diagnosis = read_required(path, "MIMIC-IV-ED diagnosis table")
    diagnosis = diagnosis[diagnosis["stay_id"].isin(selected_stay_ids)].copy()
    diagnosis["seq_num"] = pd.to_numeric(diagnosis["seq_num"], errors="coerce").fillna(99)
    diagnosis = diagnosis.sort_values(["stay_id", "seq_num"])
    grouped: dict[int, list[str]] = {}
    for stay_id, rows in diagnosis.groupby("stay_id"):
        values = [compact_text(value) for value in rows["icd_title"].tolist()]
        grouped[int(stay_id)] = [value for value in values if value][:5]
    return grouped


def presentation_category(text: str) -> str:
    lower = text.lower()
    if re.search(r"chest|palpitation|syncope|cardiac", lower):
        return "cardiopulmonary"
    if re.search(r"shortness|dyspnea|sob|cough|asthma|copd|respiratory", lower):
        return "respiratory"
    if re.search(r"abdominal|abd |vomit|nausea|diarrhea|gi|pelvic|flank", lower):
        return "abdominal_gi_or_pelvic"
    if re.search(r"altered|confus|seizure|stroke|weak|dizz|headache|neuro", lower):
        return "neurologic_or_altered_mental_status"
    if re.search(r"fever|infection|sepsis|cellulitis|abscess", lower):
        return "infectious_or_sepsis"
    if re.search(r"fall|injury|fracture|trauma|laceration|wound|pain|swelling", lower):
        return "trauma_or_msk"
    if re.search(r"psych|suicid|overdose|depress|agitat", lower):
        return "behavioral_health_or_toxicology"
    return "undifferentiated"


def focused_exam_statement(category: str) -> str:
    if category in {"cardiopulmonary", "respiratory"}:
        return "Focused exam should assess work of breathing, ability to speak, oxygen requirement, breath sounds, cardiac rhythm, perfusion, edema, and chest wall findings that change triage or immediate management."
    if category == "abdominal_gi_or_pelvic":
        return "Focused exam should assess abdominal tenderness location, distention, guarding, rebound, hydration, CVA tenderness, pelvic or perianal findings when indicated, and serial abdominal change."
    if category == "neurologic_or_altered_mental_status":
        return "Focused exam should assess airway protection, glucose or toxidrome clues, orientation, speech, cranial nerves, strength, sensation, coordination, gait, trauma signs, and serial neurologic change."
    if category == "infectious_or_sepsis":
        return "Focused exam should assess mental status, perfusion, skin findings, source-specific tenderness or drainage, cardiopulmonary status, hydration, and signs of systemic toxicity."
    if category == "trauma_or_msk":
        return "Focused exam should assess injury location, deformity, swelling, wounds or contamination, focal tenderness, range of motion, distal pulses, capillary refill, motor function, and sensation."
    if category == "behavioral_health_or_toxicology":
        return "Focused exam should assess airway and breathing, toxidrome clues, trauma, mental status, agitation or self-harm risk, vital-sign instability, and need for safety precautions."
    return "Focused exam should assess general appearance, mental status, airway and breathing, perfusion, pain or distress, and complaint-directed organ system findings that would change triage or initial management."


def vital_sentence(vitals: dict[str, float | None]) -> str:
    def fmt(value: Any) -> str:
        return "unavailable" if value is None else str(value)

    bp = "unavailable"
    if vitals["sbp"] is not None and vitals["dbp"] is not None:
        bp = f"{round(vitals['sbp'])}/{round(vitals['dbp'])}"
    elif vitals["sbp"] is not None:
        bp = f"{round(vitals['sbp'])}/unavailable"
    elif vitals["dbp"] is not None:
        bp = f"unavailable/{round(vitals['dbp'])}"
    return (
        f"Temperature {fmt(vitals['temp'])} F, heart rate {fmt(vitals['hr'])}, "
        f"respiratory rate {fmt(vitals['rr'])}, oxygen saturation {fmt(vitals['o2'])}%, "
        f"blood pressure {bp}, pain {fmt(vitals['pain'])}/10."
    )


def evidence_item(evidence_id: str, domain: str, statement: str, source_field: str) -> dict[str, str]:
    return {
        "id": evidence_id,
        "domain": domain,
        "statement": compact_text(statement),
        "source_field": source_field,
        "provenance": "source_record",
        "source_restriction": SOURCE_RESTRICTION,
    }


def estimated_resource_count(row: pd.Series, diagnoses: list[str]) -> int:
    acuity = parse_int(row.get("acuity")) or 3
    text = f"{row.get('chiefcomplaint', '')} {' '.join(diagnoses)}".lower()
    count = 0
    if acuity <= 2:
        count += 2
    if re.search(r"chest|syncope|shortness|dyspnea|abdominal|fever|sepsis|altered|stroke|fracture|overdose", text):
        count += 2
    if re.search(r"laceration|wound|pain|suture|medication refill", text):
        count += 1
    return max(0, min(count, 5))


def build_case(row: pd.Series, ordinal: int, diagnoses: list[str]) -> dict[str, Any]:
    complaint = normalized_complaint(row.get("chiefcomplaint"))
    age = parse_float(row.get("anchor_age")) or 0
    sex = compact_text(row.get("gender_x") or row.get("gender_y") or row.get("gender") or "Unknown")
    transport = compact_text(row.get("arrival_transport")) or "UNKNOWN"
    disposition = compact_text(row.get("disposition")) or "UNKNOWN"
    acuity = parse_int(row.get("acuity")) or 3
    vitals = {
        "temp": parse_float(row.get("temperature")),
        "hr": parse_float(row.get("heartrate")),
        "rr": parse_float(row.get("resprate")),
        "o2": parse_float(row.get("o2sat")),
        "sbp": parse_float(row.get("sbp")),
        "dbp": parse_float(row.get("dbp")),
        "pain": parse_float(row.get("pain")),
    }
    category = presentation_category(f"{complaint} {' '.join(diagnoses)}")
    case_id = f"restricted_ed_supplemental_{ordinal:03d}"
    diagnosis_summary = diagnoses[0] if diagnoses else "No ED diagnosis title linked in the sampled restricted diagnosis table."
    history = (
        f"{round(age) if age else 'Adult'}-year-old {sex_label(sex)} arrived by {transport.lower()} "
        f"with {complaint}. Initial triage acuity was ESI {acuity}. {vital_sentence(vitals)}"
    )
    resources_used = estimated_resource_count(row, diagnoses)
    interventions = {field: False for field in INTERVENTION_FIELDS}
    case_data: dict[str, Any] = {
        "schema_version": CASE_SCHEMA_VERSION,
        "id": case_id,
        "case_source": "mimic_restricted_local",
        "source_restriction": SOURCE_RESTRICTION,
        "demographics": {
            "age": age,
            "sex": sex,
            "transport": transport,
        },
        "complaint": complaint,
        "vitals": vitals,
        "history": history,
        "acuity": acuity,
        "disposition": disposition,
        "outcome": f"ED disposition documented as {disposition}. Retrospective ED diagnosis context: {diagnosis_summary}.",
        "interventions": interventions,
        "lab_event_count": 0,
        "microbio_event_count": 0,
        "exam_count": 0,
        "consults_count": 0,
        "procedure_count": 0,
        "resources_used": resources_used,
        "tasks_available": {
            "triage": True,
            "diagnosis": True,
            "referral": False,
            "management": True,
            "reassessment": True,
            "sbar": True,
        },
    }
    for field in OUTCOME_BOOL_FIELDS:
        case_data[field] = False

    source_hash = pseudonym(row.get("subject_id"), row.get("stay_id"))
    case_data["source"] = {
        "dataset": DATASET_NAME,
        "schema_version": CASE_SCHEMA_VERSION,
        "source_version": DATASET_VERSION,
        "restriction": SOURCE_RESTRICTION,
        "pseudonymous_source_hash": source_hash,
        "age": age,
        "sex": sex,
        "arrival_transport": transport,
        "chief_complaint": complaint,
        "chief_complaint_source": "mimic_iv_ed.triage.chiefcomplaint",
        "triage_narrative": history,
        "vitals": vitals,
        "reference_esi": acuity,
        "disposition": disposition,
        "resource_signals": {
            "lab_event_count": 0,
            "microbio_event_count": 0,
            "exam_count": 0,
            "consults_count": 0,
            "procedure_count": 0,
            "resources_used": resources_used,
        },
    }
    case_data["documented_evidence"] = [
        evidence_item("documented_demographics", "demographics", f"{round(age) if age else 'Adult'}-year-old {sex} arrived by {transport}.", "patients.anchor_age, patients.gender, edstays.arrival_transport"),
        evidence_item("documented_chief_complaint", "chief_complaint", f"Chief complaint: {complaint}.", "triage.chiefcomplaint"),
        evidence_item("documented_vitals", "vitals", vital_sentence(vitals), "triage.temperature, triage.heartrate, triage.resprate, triage.o2sat, triage.sbp, triage.dbp, triage.pain"),
        evidence_item("documented_reference_esi", "reference_esi", f"Reference ESI {acuity}.", "triage.acuity"),
        evidence_item("documented_disposition", "disposition", f"ED disposition: {disposition}.", "edstays.disposition"),
    ]
    if diagnoses:
        case_data["documented_evidence"].append(
            evidence_item("documented_ed_diagnosis", "diagnosis", f"Retrospective ED diagnosis context: {'; '.join(diagnoses[:3])}.", "diagnosis.icd_title")
        )

    exam_statement = focused_exam_statement(category)
    case_data["augmentation"] = {
        "version": "mimic_iv_ed_supplemental_case_augmentation_v1",
        "review_status": "local_teaching_draft",
        "generated_by": "generate_mimic_ed_supplemental_cases.py",
        "model": "deterministic_source_table_sampler",
        "prompt_version": "not_applicable",
        "generated_at": None,
        "reviewed_by": [],
        "reviewed_at": None,
        "likely_working_diagnosis": diagnosis_summary,
        "ddx": [],
        "teaching_points": [
            "Use this local restricted case for workflow testing and formative practice only.",
            "Do not treat the retrospective ED diagnosis as information available during initial triage."
        ],
        "inferred_facts": [
            {
                "id": f"{case_id}_focused_exam_01",
                "domain": "physical_exam",
                "statement": exam_statement,
                "rationale": "MIMIC-IV-ED triage rows do not provide a structured physical exam, so this is a local teaching inference for focused exam practice.",
                "source_anchors": [complaint, f"Reference ESI {acuity}", *diagnoses[:2]],
                "confidence": "moderate",
                "review_status": "local_teaching_draft",
                "provenance": "local_teaching_inference",
                "source_field": "triage.chiefcomplaint, triage.acuity, diagnosis.icd_title",
                "source_restriction": SOURCE_RESTRICTION,
                "use_in": ["physical_exam", "soap", "decision_review"],
            }
        ],
        "protected_source_fields": [
            "reference_esi",
            "vitals",
            "disposition",
            "arrival_transport",
            "sex",
            "age",
            "triage_narrative",
        ],
    }
    case_data["missing_evidence"] = [
        {
            "domain": "focused_physical_exam",
            "needed_for": "SOAP assessment, DDx, and clinical decision review",
            "reason": "MIMIC-IV-ED triage tables do not include a structured physical exam.",
        },
        {
            "domain": "relevant_negatives",
            "needed_for": "DDx support and safer patient dialogue",
            "reason": "Relevant negative symptoms are not structured in the sampled ED triage row.",
        },
    ]
    case_data["simulation_reveal_data"] = [
        {
            "id": f"{case_id}_focused_exam_scaffold",
            "domain": "focused_physical_exam",
            "covers_domains": ["focused_physical_exam", "physical_exam"],
            "label": "Focused physical exam target",
            "category": "Simulation reveal scaffold",
            "availability": "scaffold_available",
            "value": exam_statement,
            "source": DATASET_NAME,
            "source_basis": "local_teaching_inference",
            "display_policy": "encounter_unlock",
            "unlock_action_ids": [],
            "review_status": "local_teaching_draft",
            "source_restriction": SOURCE_RESTRICTION,
            "limitation": "Local restricted formative scaffold; not source-record physical exam truth or summative assessment evidence.",
        },
        {
            "id": f"{case_id}_relevant_negatives_scaffold",
            "domain": "relevant_negatives",
            "covers_domains": ["relevant_negatives"],
            "label": "Relevant negatives prompt",
            "category": "Simulation reveal scaffold",
            "availability": "scaffold_available",
            "value": "Ask and document pertinent negatives before narrowing the differential; do not infer absent symptoms unless they are supplied by the patient script or faculty source.",
            "source": DATASET_NAME,
            "source_basis": "source_limitation_scaffold",
            "display_policy": "encounter_unlock",
            "unlock_action_ids": [],
            "review_status": "local_teaching_draft",
            "source_restriction": SOURCE_RESTRICTION,
            "limitation": "Local restricted formative scaffold; not source-record negative-symptom truth.",
        },
    ]
    case_data["ground_truth"] = {
        "diagnoses": {
            "primary": diagnoses[:1],
            "secondary": diagnoses[1:],
            "icd": {},
            "raw_diagnosis_text": "; ".join(diagnoses),
        },
        "referral": {
            "clinician_approved_specialty": [],
        },
        "disposition": disposition,
        "tests": "",
        "medications": "",
        "reference_esi": acuity,
    }
    return case_data


def build_cases(args: argparse.Namespace) -> list[dict[str, Any]]:
    mimic_ed_dir = Path(args.mimic_ed_dir)
    patients_path = Path(args.patients)
    triage = read_required(mimic_ed_dir / "triage.csv.gz", "MIMIC-IV-ED triage table")
    edstays = read_required(mimic_ed_dir / "edstays.csv.gz", "MIMIC-IV-ED stays table")
    patients = read_required(patients_path, "MIMIC-IV patients table", usecols=["subject_id", "gender", "anchor_age"])

    excluded = source_stay_ids(Path(args.exclude_mietic))
    merged = (
        triage.merge(edstays, on=["subject_id", "stay_id"], how="inner")
        .merge(patients, on="subject_id", how="left")
    )
    merged["acuity_numeric"] = pd.to_numeric(merged["acuity"], errors="coerce")
    merged["chief_text"] = merged["chiefcomplaint"].map(normalized_complaint)
    merged["complaint_key"] = merged["chief_text"].str.lower().str.replace(r"[^a-z0-9]+", " ", regex=True).str.strip()
    merged["presentation"] = merged["chief_text"].map(presentation_category)
    eligible = merged[
        (~merged["stay_id"].isin(excluded))
        & merged["chief_text"].astype(bool)
        & merged["acuity_numeric"].between(1, 5)
        & pd.to_numeric(merged["anchor_age"], errors="coerce").fillna(0).between(18, 95)
    ].copy()
    eligible["vital_completeness"] = eligible[["temperature", "heartrate", "resprate", "o2sat", "sbp", "dbp", "pain"]].notna().sum(axis=1)
    eligible = eligible.sort_values(["vital_completeness", "acuity_numeric", "stay_id"], ascending=[False, True, True])
    eligible = eligible.drop_duplicates(["complaint_key", "acuity_numeric"], keep="first")

    selected_rows = []
    seen_stays: set[int] = set()
    target_acuity_order = [1, 2, 3, 4, 5]
    while len(selected_rows) < args.limit:
        added = False
        for acuity in target_acuity_order:
            candidates = eligible[eligible["acuity_numeric"] == acuity]
            if not len(candidates):
                continue
            for _, row in candidates.iterrows():
                stay_id = int(row["stay_id"])
                if stay_id in seen_stays:
                    continue
                selected_rows.append(row)
                seen_stays.add(stay_id)
                added = True
                break
            if len(selected_rows) >= args.limit:
                break
        if not added:
            break

    selected_stay_ids = {int(row["stay_id"]) for row in selected_rows}
    diagnoses = diagnosis_groups(mimic_ed_dir / "diagnosis.csv.gz", selected_stay_ids)
    return [
        build_case(row, index + 1, diagnoses.get(int(row["stay_id"]), []))
        for index, row in enumerate(selected_rows)
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a restricted supplemental MIMIC-IV-ED case bundle.")
    parser.add_argument("--mimic-ed-dir", default=str(DEFAULT_MIMIC_ED_DIR))
    parser.add_argument("--patients", default=str(DEFAULT_PATIENTS))
    parser.add_argument("--exclude-mietic", default=str(DEFAULT_MIETIC))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--limit", type=int, default=27)
    args = parser.parse_args()

    output = Path(args.output)
    assert_restricted_output(output)
    cases = build_cases(args)
    if len(cases) < args.limit:
        raise SystemExit(f"Only generated {len(cases)} supplemental cases; requested {args.limit}.")
    payload = {
        "schema_version": "restricted_mimic_iv_ed_supplemental_bundle_v1",
        "source_dataset": DATASET_NAME,
        "source_version": DATASET_VERSION,
        "source_restriction": SOURCE_RESTRICTION,
        "generation_note": "Local-only credentialed MIMIC-IV-ED supplemental cases for workflow testing; not public release cases.",
        "case_count": len(cases),
        "cases": cases,
    }
    output.write_text(json.dumps(payload, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "case_count": len(cases)}, indent=2))


if __name__ == "__main__":
    main()
