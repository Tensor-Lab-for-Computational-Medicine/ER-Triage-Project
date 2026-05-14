"""Generate the browser case bundle from the MIETIC validation CSV."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
INPUT_CSV = ROOT / "data" / "raw" / "mietic_validate_samples.csv"
OUTPUT_JSON = ROOT / "frontend" / "src" / "data" / "cases.json"

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


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = df.columns.str.replace("\ufeff", "")
    if "subject" not in str(df.columns[0]).lower():
        df.columns = ["subject_id"] + list(df.columns[1:])
    return df


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


def text_field(row: pd.Series, name: str, fallback: str) -> str:
    value = row.get(name)
    if pd.isna(value):
        return fallback
    return str(value)


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


def row_to_case(row: pd.Series, case_id: str) -> dict[str, Any]:
    history = text_field(row, "tiragecase", "No medical history available")
    case = {
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
        "interventions": {field: parse_bool(row.get(field, 0)) for field in INTERVENTION_FIELDS},
        "outtime": text_field(row, "outtime", "") or None,
    }

    for field in OUTCOME_BOOL_FIELDS:
        case[field] = parse_bool(row.get(field, 0))
    for field in COUNT_FIELDS:
        case[field] = parse_int(row.get(field, 0))

    return case


def build_cases(input_csv: Path = INPUT_CSV) -> list[dict[str, Any]]:
    df = normalize_columns(pd.read_csv(input_csv, encoding="utf-8-sig"))
    df = df.dropna(subset=["subject_id"])

    cases = []
    for _, row in df.iterrows():
        candidate = row_to_case(row, f"case_{len(cases) + 1:03d}")
        if is_valid(candidate):
            cases.append(candidate)
    return cases


def main() -> None:
    cases = build_cases()
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(cases, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(cases)} cases to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
