"""Generate the reviewed browser case bundle from the MIETIC validation CSV."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
INPUT_CSV = ROOT / "data" / "raw" / "mietic_validate_samples.csv"
PROCESSED_DIR = ROOT / "data" / "processed"
REVIEW_JSON = PROCESSED_DIR / "case_augmentations.review.json"
OUTPUT_JSON = ROOT / "frontend" / "src" / "data" / "cases.json"

CASE_SCHEMA_VERSION = "clinical_case_v1"
CASE_AUGMENTATION_VERSION = "case_augmentation_v1"

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

COUNT_FIELDS = [
    "lab_event_count",
    "microbio_event_count",
    "exam_count",
    "consults_count",
    "procedure_count",
    "resources_used",
]

PROTECTED_SOURCE_FIELDS = [
    "reference_esi",
    "vitals",
    "disposition",
    "resource_signals",
    "interventions",
    "arrival_transport",
    "sex",
    "age",
    "triage_narrative",
]


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = df.columns.str.replace("\ufeff", "")
    if "subject" not in str(df.columns[0]).lower():
        df.columns = ["subject_id"] + list(df.columns[1:])
    return df


def json_value(value: Any) -> Any:
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def parse_float(value: Any) -> float | None:
    if pd.isna(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_int(value: Any) -> int:
    parsed = parse_float(value)
    return int(parsed) if parsed is not None else 0


def parse_bool(value: Any) -> bool:
    if pd.isna(value):
        return False
    try:
        return bool(int(float(value)))
    except (TypeError, ValueError):
        return str(value).strip().lower() in {"true", "yes", "y"}


def parse_pain(value: Any) -> float | None:
    numeric = parse_float(value)
    if numeric is not None:
        return numeric

    text = str(value).strip().lower()
    if "critical" in text or "crit" in text:
        return 10.0
    if "uta" in text or "unable" in text:
        return 9.0
    return None


def parse_acuity(value: Any) -> int | None:
    if pd.isna(value):
        return None
    try:
        acuity = int(value)
    except (TypeError, ValueError):
        text = str(value).strip().lower()
        if "critical" in text or "crit" in text or "uta" in text or "unable" in text:
            acuity = 1
        else:
            return None
    return acuity if 1 <= acuity <= 5 else None


def text_field(row: pd.Series, name: str, fallback: str = "") -> str:
    value = row.get(name)
    if pd.isna(value):
        return fallback
    return str(value).strip()


def compact_text(value: str) -> str:
    return " ".join(str(value or "").split())


def evidence_item(
    evidence_id: str,
    domain: str,
    statement: str,
    source_field: str,
    *,
    confidence: str = "documented",
) -> dict[str, Any]:
    return {
        "id": evidence_id,
        "domain": domain,
        "statement": compact_text(statement),
        "source_field": source_field,
        "confidence": confidence,
    }


def is_valid(case: dict[str, Any]) -> bool:
    vitals = case["vitals"]
    required_vitals = ["temp", "hr", "rr", "o2", "sbp", "dbp", "pain"]
    if any(vitals[field] is None for field in required_vitals):
        return False
    if not case["complaint"] or case["complaint"] == "Unknown complaint":
        return False
    if not case["history"] or case["history"] == "No medical history available":
        return False
    return case["acuity"] is not None


def retained(row: pd.Series) -> bool:
    return text_field(row, "Final Decision").upper() == "RETAIN"


def vital_sentence(vitals: dict[str, Any]) -> str:
    def fmt(value: Any) -> str:
        return "unavailable" if value is None else str(value)

    def fmt_bp(value: Any) -> str:
        return "unavailable" if value is None else str(round(value))

    return (
        f"Temperature {fmt(vitals['temp'])} F, heart rate {fmt(vitals['hr'])}, "
        f"respiratory rate {fmt(vitals['rr'])}, oxygen saturation {fmt(vitals['o2'])}%, "
        f"blood pressure {fmt_bp(vitals['sbp'])}/{fmt_bp(vitals['dbp'])}, "
        f"pain {fmt(vitals['pain'])}/10."
    )


def resource_signals(case: dict[str, Any]) -> dict[str, int]:
    return {field: parse_int(case.get(field, 0)) for field in COUNT_FIELDS}


def intervention_names(interventions: dict[str, bool]) -> list[str]:
    return [field for field, active in interventions.items() if active]


def outcome_names(case: dict[str, Any]) -> list[str]:
    outcomes: list[str] = []
    for field in OUTCOME_BOOL_FIELDS:
        if case.get(field):
            outcomes.append(field)
    return outcomes


def build_documented_evidence(case: dict[str, Any], row: pd.Series) -> list[dict[str, Any]]:
    evidence = [
        evidence_item(
            "documented_demographics",
            "demographics",
            f"{round(case['demographics']['age'])}-year-old {case['demographics']['sex']} arrived by {case['demographics']['transport']}.",
            "age, gender, arrival_transport",
        ),
        evidence_item(
            "documented_chief_complaint",
            "chief_complaint",
            f"Chief complaint: {case['complaint']}.",
            "chiefcomplaint",
        ),
        evidence_item(
            "documented_triage_narrative",
            "triage_narrative",
            case["history"],
            "tiragecase",
        ),
        evidence_item(
            "documented_vitals",
            "vitals",
            vital_sentence(case["vitals"]),
            "temperature, heartrate, resprate, o2sat, sbp, dbp, pain",
        ),
        evidence_item(
            "documented_reference_esi",
            "reference_esi",
            f"Reference ESI {case['acuity']}.",
            "acuity",
        ),
        evidence_item(
            "documented_disposition",
            "disposition",
            f"Disposition: {case['disposition']}.",
            "disposition",
        ),
    ]

    resources = resource_signals(case)
    resource_parts = [f"{field}: {value}" for field, value in resources.items() if value]
    if resource_parts:
        evidence.append(evidence_item("documented_resources", "resources", "; ".join(resource_parts), ",".join(COUNT_FIELDS)))

    interventions = intervention_names(case["interventions"])
    if interventions:
        evidence.append(evidence_item("documented_interventions", "interventions", "; ".join(interventions), ",".join(INTERVENTION_FIELDS)))

    outcomes = outcome_names(case)
    if outcomes:
        evidence.append(evidence_item("documented_outcomes", "outcomes", "; ".join(outcomes), ",".join(OUTCOME_BOOL_FIELDS)))

    expert_count = sum(1 for field in ["Expert 1 Opinion", "Expert 2 Opinion", "Expert 3 Opinion"] if text_field(row, field))
    if expert_count:
        evidence.append(
            evidence_item(
                "documented_expert_review",
                "adjudication",
                f"{expert_count} expert validation opinions were recorded; final decision {text_field(row, 'Final Decision')}.",
                "Expert 1 Opinion, Expert 2 Opinion, Expert 3 Opinion, Final Decision",
            )
        )

    return evidence


def build_missing_evidence(case: dict[str, Any]) -> list[dict[str, str]]:
    text = f"{case['complaint']} {case['history']}".lower()
    missing: list[dict[str, str]] = []

    def add(domain: str, needed_for: str, reason: str) -> None:
        if not any(item["domain"] == domain for item in missing):
            missing.append({"domain": domain, "needed_for": needed_for, "reason": reason})

    if not any(term in text for term in ["exam", "tender", "range of motion", "distal pulse", "sensation", "motor"]):
        add("focused_physical_exam", "SOAP assessment, DDx, and clinical decision review", "The source bundle does not contain a structured physical exam.")

    if any(term in text for term in ["foot", "leg", "wrist", "ankle", "fracture", "injury", "swelling", "laceration"]):
        add("neurovascular_status", "extremity injury safety screen", "Extremity cases need distal circulation, sensation, motor function, and skin findings.")
        if "fall" not in text and "injur" not in text and "trauma" not in text:
            add("mechanism", "injury plausibility and patient dialogue", "The source describes pain or swelling without a clear mechanism.")

    if "no additional symptoms" not in text and "denies" not in text:
        add("relevant_negatives", "DDx support and safer patient dialogue", "Relevant negative symptoms are not structured in the source bundle.")

    if case.get("exam_count", 0) and not any(term in text for term in ["x-ray", "ct", "ultrasound", "imaging showed", "fracture"]):
        add("imaging_or_exam_result", "diagnostic reasoning and plan specificity", "The bundle records imaging or exam use as a count but not the result.")

    return missing


def expert_opinions(row: pd.Series) -> list[dict[str, str]]:
    opinions = []
    for index, field in enumerate(["Expert 1 Opinion", "Expert 2 Opinion", "Expert 3 Opinion"], start=1):
        value = text_field(row, field)
        if value:
            opinions.append({"reviewer": f"Expert {index}", "opinion": value})
    return opinions


def load_review(path: Path = REVIEW_JSON) -> dict[str, Any]:
    if not path.exists():
        return {"schema_version": "case_augmentation_review_v1", "cases": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def valid_use_in(value: Any) -> list[str]:
    allowed = {"dialogue", "physical_exam", "soap", "decision_review", "grading_reference"}
    items = value if isinstance(value, list) else []
    return [item for item in items if item in allowed]


def reviewed_fact(fact: dict[str, Any], case_review_status: str) -> dict[str, Any] | None:
    if case_review_status != "reviewed":
        return None
    if fact.get("review_status") != "reviewed":
        return None
    use_in = valid_use_in(fact.get("use_in"))
    if "grading_reference" in use_in and fact.get("review_status") != "reviewed":
        use_in.remove("grading_reference")
    required = ["id", "domain", "statement", "rationale", "source_anchors", "confidence"]
    if any(not fact.get(field) for field in required):
        return None
    return {
        **fact,
        "statement": compact_text(fact["statement"]),
        "rationale": compact_text(fact["rationale"]),
        "source_anchors": [compact_text(item) for item in fact.get("source_anchors", []) if compact_text(item)],
        "use_in": use_in,
    }


def build_augmentation(case_id: str, review: dict[str, Any]) -> dict[str, Any]:
    entry = review.get("cases", {}).get(case_id, {})
    review_status = entry.get("review_status", "source_only")
    facts = [
        fact
        for fact in (reviewed_fact(item, review_status) for item in entry.get("inferred_facts", []))
        if fact is not None
    ]
    return {
        "version": CASE_AUGMENTATION_VERSION,
        "review_status": review_status,
        "generated_by": entry.get("generated_by"),
        "model": entry.get("model"),
        "prompt_version": entry.get("prompt_version"),
        "generated_at": entry.get("generated_at"),
        "reviewed_by": entry.get("reviewed_by"),
        "reviewed_at": entry.get("reviewed_at"),
        "likely_working_diagnosis": entry.get("likely_working_diagnosis", ""),
        "ddx": entry.get("ddx", []) if review_status == "reviewed" else [],
        "teaching_points": entry.get("teaching_points", []) if review_status == "reviewed" else [],
        "inferred_facts": facts,
        "protected_source_fields": PROTECTED_SOURCE_FIELDS,
    }


def row_to_case(row: pd.Series, case_id: str, raw_row_index: int, review: dict[str, Any]) -> dict[str, Any]:
    history = text_field(row, "tiragecase", "No medical history available")
    interventions = {field: parse_bool(row.get(field, 0)) for field in INTERVENTION_FIELDS}
    case = {
        "schema_version": CASE_SCHEMA_VERSION,
        "id": case_id,
        "demographics": {
            "age": parse_float(row.get("age")) or 0,
            "sex": text_field(row, "gender", "Unknown"),
            "transport": text_field(row, "arrival_transport", "Unknown"),
        },
        "complaint": text_field(row, "chiefcomplaint", "Unknown complaint"),
        "vitals": {
            "temp": parse_float(row.get("temperature")),
            "hr": parse_float(row.get("heartrate")),
            "rr": parse_float(row.get("resprate")),
            "o2": parse_float(row.get("o2sat")),
            "sbp": parse_float(row.get("sbp")),
            "dbp": parse_float(row.get("dbp")),
            "pain": parse_pain(row.get("pain")),
        },
        "history": history,
        "acuity": parse_acuity(row.get("acuity")),
        "disposition": text_field(row, "disposition", "Unknown"),
        "outcome": history,
        "interventions": interventions,
        "outtime": text_field(row, "outtime") or None,
    }

    for field in OUTCOME_BOOL_FIELDS:
        case[field] = parse_bool(row.get(field, 0))
    for field in COUNT_FIELDS:
        case[field] = parse_int(row.get(field, 0))

    case["source"] = {
        "dataset": "MIETIC validation sample",
        "schema_version": CASE_SCHEMA_VERSION,
        "raw_row_index": raw_row_index,
        "subject_id": json_value(row.get("subject_id")),
        "stay_id": json_value(row.get("stay_id")),
        "hadm_id": json_value(row.get("hadm_id")),
        "intime": text_field(row, "intime"),
        "outtime": text_field(row, "outtime"),
        "age": case["demographics"]["age"],
        "sex": case["demographics"]["sex"],
        "arrival_transport": case["demographics"]["transport"],
        "chief_complaint": case["complaint"],
        "triage_narrative": history,
        "vitals": case["vitals"],
        "reference_esi": case["acuity"],
        "disposition": case["disposition"],
        "resource_signals": resource_signals(case),
        "interventions": interventions,
        "outcomes": {field: case[field] for field in OUTCOME_BOOL_FIELDS},
        "adjudication": {
            "final_decision": text_field(row, "Final Decision"),
            "expert_opinions": expert_opinions(row),
        },
    }
    case["documented_evidence"] = build_documented_evidence(case, row)
    case["missing_evidence"] = build_missing_evidence(case)
    case["augmentation"] = build_augmentation(case_id, review)
    return case


def source_cases(input_csv: Path = INPUT_CSV, review_path: Path = REVIEW_JSON) -> list[dict[str, Any]]:
    df = normalize_columns(pd.read_csv(input_csv, encoding="utf-8-sig"))
    df = df.dropna(subset=["subject_id"])
    review = load_review(review_path)

    cases: list[dict[str, Any]] = []
    valid_ordinal = 0
    for raw_row_index, row in df.iterrows():
        candidate_id = f"case_{valid_ordinal + 1:03d}"
        candidate = row_to_case(row, candidate_id, int(raw_row_index), review)
        if not is_valid(candidate):
            continue
        valid_ordinal += 1
        candidate["id"] = f"case_{valid_ordinal:03d}"
        candidate["source"]["case_id"] = candidate["id"]
        if retained(row):
            cases.append(candidate)
    return cases


def build_cases(input_csv: Path = INPUT_CSV, review_path: Path = REVIEW_JSON) -> list[dict[str, Any]]:
    cases = []
    for case in source_cases(input_csv, review_path):
        if case["augmentation"]["review_status"] in {"draft", "rejected"}:
            continue
        cases.append(case)
    return cases


def main() -> None:
    cases = build_cases()
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(cases, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(cases)} reviewed retained cases to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
