"""Build restricted MIETIC-to-MIMIC clinical_case_v3 enrichment.

This script never writes to the public frontend bundle. It joins MIETIC
validation rows to credentialed local MIMIC modules when identifiers are
available and emits an ignored `.restricted.json` artifact for local review or
browser-memory loading.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from typing import Any

import duckdb
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MIETIC = ROOT / "data" / "raw" / "mietic_validate_samples.csv"
DEFAULT_MIMICIV_DIR = Path("D:/physionet/mimiciv")
DEFAULT_MIMIC_ED_DIR = Path("D:/physionet/mimic-iv-ed")
DEFAULT_MIMIC_NOTE_DIR = Path("D:/physionet/mimic-iv-note")
DEFAULT_MIMIC_CXR_DIR = Path("D:/physionet/mimic-cxr")
DEFAULT_MIMIC_ECG_DIR = Path("D:/physionet/mimic-iv-ecg")
DEFAULT_OUTPUT = ROOT / "data" / "restricted" / "mietic_mimic_enriched_cases.restricted.json"

SOURCE_RESTRICTION = "credentialed_local_only"
SOURCE_DATASET = "MIETIC-MIMIC-IV-Enriched"

LAB_CLASSIFIERS = [
    ("poc_glucose", "POC glucose", re.compile(r"\bglucose\b|fingerstick|dextrose", re.I)),
    ("cbc", "CBC / hematology", re.compile(r"white blood|wbc|hemoglobin|hematocrit|platelet|rbc|cbc", re.I)),
    ("bmp_cmp", "BMP / CMP", re.compile(r"sodium|potassium|chloride|bicarbonate|creatinine|urea|bun|calcium|albumin|bilirubin|alt|ast|alkaline|protein", re.I)),
    ("blood_gas", "Blood gas", re.compile(r"blood gas|ph|pco2|po2|base excess|bicarbonate", re.I)),
    ("lactate", "Lactate", re.compile(r"lactate", re.I)),
    ("troponin", "Troponin", re.compile(r"troponin", re.I)),
    ("coagulation", "Coagulation", re.compile(r"\binr\b|ptt|prothrombin|fibrinogen", re.I)),
    ("type_screen", "Blood bank / type screen", re.compile(r"type.*screen|abo|rh|crossmatch|blood bank", re.I)),
    ("urinalysis", "Urinalysis", re.compile(r"urine|urinalysis|ua ", re.I)),
    ("pregnancy", "Pregnancy test", re.compile(r"hcg|pregnan", re.I)),
]

MED_CLASSIFIERS = [
    ("analgesic", "Analgesics", re.compile(r"morphine|fentanyl|hydromorphone|ketorolac|acetaminophen|ibuprofen|oxycodone|analges", re.I)),
    ("antiemetic", "Antiemetics", re.compile(r"ondansetron|metoclopramide|prochlorperazine|antiem", re.I)),
    ("antibiotic", "Antibiotics", re.compile(r"cef|vanco|piperacillin|tazobactam|azithro|levo|metro|clinda|antibiotic", re.I)),
    ("bronchodilator", "Bronchodilators", re.compile(r"albuterol|ipratropium|duoneb|bronchod", re.I)),
    ("epinephrine", "Epinephrine", re.compile(r"epinephrine|adrenalin", re.I)),
    ("naloxone", "Naloxone", re.compile(r"naloxone|narcan", re.I)),
    ("sedative", "Sedatives", re.compile(r"lorazepam|midazolam|diazepam|propofol|ketamine|haloperidol|droperidol|sedat", re.I)),
    ("anticoag_reversal", "Anticoagulants / reversal", re.compile(r"heparin|warfarin|apixaban|rivaroxaban|enoxaparin|vitamin k|kcentra|protamine|reversal", re.I)),
    ("iv_fluid", "IV fluids", re.compile(r"normal saline|lactated|dextrose|sodium chloride|fluid|bolus|ringer", re.I)),
    ("pressor", "Vasopressors", re.compile(r"norepinephrine|phenylephrine|vasopressin|epinephrine|pressor", re.I)),
]

ORDER_CLASSIFIERS = [
    ("cxr", "Chest x-ray", re.compile(r"chest.*x|cxr|xray|x-ray", re.I)),
    ("ct", "CT imaging", re.compile(r"\bct\b|computed tomography", re.I)),
    ("ultrasound", "Ultrasound / eFAST", re.compile(r"ultrasound|sonogram|efast|fast exam", re.I)),
    ("mri", "MRI", re.compile(r"\bmri\b|magnetic resonance", re.I)),
    ("ecg", "ECG / cardiology", re.compile(r"ecg|ekg|electrocardiogram|cardiology|troponin", re.I)),
    ("respiratory", "Respiratory therapy", re.compile(r"respiratory|oxygen|ventilat|nebul", re.I)),
    ("consult", "Consult order", re.compile(r"consult|surgery|neurology|orthopedic|cardiology|critical care|icu", re.I)),
    ("blood_bank", "Blood bank", re.compile(r"blood bank|type.*screen|crossmatch|transfusion|red blood|rbc", re.I)),
]


def compact_text(value: Any) -> str:
    if pd.isna(value):
        return ""
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


def parse_bool(value: Any) -> bool:
    if pd.isna(value):
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def parse_timestamp(value: Any) -> str | None:
    text = compact_text(value)
    if not text:
        return None
    parsed = pd.to_datetime(text, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.isoformat()


def normalize_mietic(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, encoding="utf-8-sig")
    df.columns = df.columns.str.replace("\ufeff", "")
    if "subject" not in str(df.columns[0]).lower():
        df.columns = ["subject_id"] + list(df.columns[1:])

    records: list[dict[str, Any]] = []
    for index, row in df.iterrows():
        public_uid = f"mietic_validate_public_{index + 1:03d}"
        records.append(
            {
                "public_case_uid": public_uid,
                "id": f"restricted_{public_uid}",
                "source_row_index": int(index),
                "subject_id": parse_int(row.get("subject_id")),
                "stay_id": parse_int(row.get("stay_id")),
                "hadm_id": parse_int(row.get("hadm_id")),
                "intime": parse_timestamp(row.get("intime")),
                "outtime": parse_timestamp(row.get("outtime")),
                "gender": compact_text(row.get("gender")) or "Unknown",
                "race": compact_text(row.get("race")) or "Unknown",
                "arrival_transport": compact_text(row.get("arrival_transport")) or "UNKNOWN",
                "disposition": compact_text(row.get("disposition")),
                "temperature": parse_float(row.get("temperature")),
                "heartrate": parse_float(row.get("heartrate")),
                "resprate": parse_float(row.get("resprate")),
                "o2sat": parse_float(row.get("o2sat")),
                "sbp": parse_float(row.get("sbp")),
                "dbp": parse_float(row.get("dbp")),
                "pain": parse_float(row.get("pain")),
                "acuity": parse_int(row.get("acuity")) or 3,
                "chief_complaint": compact_text(row.get("chiefcomplaint")) or "Undifferentiated ED presentation",
                "triage_text": compact_text(row.get("tiragecase")) or compact_text(row.get("triagecase")),
                "age": parse_float(row.get("age")),
                "resources_used": parse_int(row.get("resources_used")) or 0,
                "lab_event_count": parse_int(row.get("lab_event_count")) or 0,
                "microbio_event_count": parse_int(row.get("microbio_event_count")) or 0,
                "exam_count": parse_int(row.get("exam_count")) or 0,
                "consults_count": parse_int(row.get("consults_count")) or 0,
                "procedure_count": parse_int(row.get("procedure_count")) or 0,
                "flags": {
                    "invasive_ventilation": parse_bool(row.get("invasive_ventilation")),
                    "non_invasive_ventilation": parse_bool(row.get("non_invasive_ventilation")),
                    "transfer_to_icu_in_1h": parse_bool(row.get("transfer_to_icu_in_1h")),
                    "transfer_to_icu_beyond_1h": parse_bool(row.get("transfer_to_icu_beyond_1h")),
                    "transfer_within_1h": parse_bool(row.get("transfer_within_1h")),
                    "transfer_beyond_1h": parse_bool(row.get("transfer_beyond_1h")),
                    "expired_within_1h": parse_bool(row.get("expired_within_1h")),
                    "expired_beyond_1h": parse_bool(row.get("expired_beyond_1h")),
                    "transfusion_within_1h": parse_bool(row.get("transfusion_within_1h")),
                    "transfusion_beyond_1h": parse_bool(row.get("transfusion_beyond_1h")),
                    "red_cell_order_more_than_1": parse_bool(row.get("red_cell_order_more_than_1")),
                    "critical_procedure": parse_bool(row.get("critical_procedure")),
                    "intravenous": parse_bool(row.get("intravenous")),
                    "intravenous_fluids": parse_bool(row.get("intravenous_fluids")),
                    "intramuscular": parse_bool(row.get("intramuscular")),
                    "nebulized_medications": parse_bool(row.get("nebulized_medications")),
                    "oral_medications": parse_bool(row.get("oral_medications")),
                },
            }
        )
    return pd.DataFrame(records)


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
    if not is_gitignored(path):
        raise SystemExit(f"Refusing to write restricted linkage to a non-ignored path: {path}")


def first_existing(candidates: list[Path]) -> Path | None:
    for path in candidates:
        if path.exists():
            return path
    return None


def csv_candidates(path_without_suffix: Path) -> list[Path]:
    return [
        Path(f"{path_without_suffix}.csv.gz"),
        Path(f"{path_without_suffix}.csv"),
    ]


def table_path(base: Path, *parts: str) -> Path | None:
    return first_existing(csv_candidates(base.joinpath(*parts)))


def file_table_path(base: Path, name: str) -> Path | None:
    name_path = base / name
    if name_path.suffix:
        candidates = [name_path]
        if name_path.suffix == ".csv":
            candidates.insert(0, Path(f"{name_path}.gz"))
        return first_existing(candidates)
    return first_existing(csv_candidates(name_path))


def sql_path(path: Path) -> str:
    return "'" + str(path).replace("'", "''").replace("\\", "/") + "'"


def read_csv_sql(path: Path) -> str:
    return f"read_csv_auto({sql_path(path)}, sample_size=-1, all_varchar=true)"


def table_columns(con: duckdb.DuckDBPyConnection, path: Path) -> set[str]:
    query = f"DESCRIBE SELECT * FROM {read_csv_sql(path)} LIMIT 0"
    return {row[0] for row in con.execute(query).fetchall()}


def select_expr(cols: set[str], alias: str, column: str, *, as_name: str | None = None, fallback: str = "NULL", cast: str | None = None) -> str:
    expression = f"{alias}.{column}" if column in cols else fallback
    if cast:
        expression = f"TRY_CAST({expression} AS {cast})"
    return f"{expression} AS {as_name or column}"


def fetch_records(con: duckdb.DuckDBPyConnection, query: str) -> list[dict[str, Any]]:
    rows = con.execute(query).fetchdf()
    return json.loads(rows.to_json(orient="records", date_format="iso"))


def run_optional_query(con: duckdb.DuckDBPyConnection, label: str, query: str) -> tuple[list[dict[str, Any]], str | None]:
    try:
        return fetch_records(con, query), None
    except Exception as exc:  # pragma: no cover - defensive against local schema drift
        return [], f"{label} query failed: {exc}"


def discover_paths(args: argparse.Namespace) -> dict[str, dict[str, Path | None]]:
    mimiciv_dir = Path(args.mimiciv_dir).expanduser().resolve()
    mimic_ed_dir = Path(args.mimic_ed_dir).expanduser().resolve()
    note_dir = Path(args.mimic_note_dir).expanduser().resolve()
    cxr_dir = Path(args.mimic_cxr_dir).expanduser().resolve()
    ecg_dir = Path(args.mimic_ecg_dir).expanduser().resolve()

    return {
        "ed": {
            "edstays": table_path(mimic_ed_dir, "ed", "edstays") or table_path(mimic_ed_dir, "edstays"),
            "triage": table_path(mimic_ed_dir, "ed", "triage") or table_path(mimic_ed_dir, "triage"),
            "diagnosis": table_path(mimic_ed_dir, "ed", "diagnosis") or table_path(mimic_ed_dir, "diagnosis"),
            "vitalsign": table_path(mimic_ed_dir, "ed", "vitalsign") or table_path(mimic_ed_dir, "vitalsign"),
            "medrecon": table_path(mimic_ed_dir, "ed", "medrecon") or table_path(mimic_ed_dir, "medrecon"),
            "pyxis": table_path(mimic_ed_dir, "ed", "pyxis") or table_path(mimic_ed_dir, "pyxis"),
        },
        "hosp": {
            "admissions": table_path(mimiciv_dir, "hosp", "admissions") or table_path(mimiciv_dir, "admissions"),
            "diagnoses_icd": table_path(mimiciv_dir, "hosp", "diagnoses_icd") or table_path(mimiciv_dir, "diagnoses_icd"),
            "d_icd_diagnoses": table_path(mimiciv_dir, "hosp", "d_icd_diagnoses") or table_path(mimiciv_dir, "d_icd_diagnoses"),
            "procedures_icd": table_path(mimiciv_dir, "hosp", "procedures_icd") or table_path(mimiciv_dir, "procedures_icd"),
            "d_icd_procedures": table_path(mimiciv_dir, "hosp", "d_icd_procedures") or table_path(mimiciv_dir, "d_icd_procedures"),
            "labevents": table_path(mimiciv_dir, "hosp", "labevents") or table_path(mimiciv_dir, "labevents"),
            "d_labitems": table_path(mimiciv_dir, "hosp", "d_labitems") or table_path(mimiciv_dir, "d_labitems"),
            "microbiologyevents": table_path(mimiciv_dir, "hosp", "microbiologyevents") or table_path(mimiciv_dir, "microbiologyevents"),
            "poe": table_path(mimiciv_dir, "hosp", "poe") or table_path(mimiciv_dir, "poe"),
            "prescriptions": table_path(mimiciv_dir, "hosp", "prescriptions") or table_path(mimiciv_dir, "prescriptions"),
            "pharmacy": table_path(mimiciv_dir, "hosp", "pharmacy") or table_path(mimiciv_dir, "pharmacy"),
            "emar": table_path(mimiciv_dir, "hosp", "emar") or table_path(mimiciv_dir, "emar"),
            "services": table_path(mimiciv_dir, "hosp", "services") or table_path(mimiciv_dir, "services"),
            "transfers": table_path(mimiciv_dir, "hosp", "transfers") or table_path(mimiciv_dir, "transfers"),
        },
        "icu": {
            "icustays": table_path(mimiciv_dir, "icu", "icustays") or table_path(mimiciv_dir, "icustays"),
            "d_items": table_path(mimiciv_dir, "icu", "d_items") or table_path(mimiciv_dir, "d_items"),
            "procedureevents": table_path(mimiciv_dir, "icu", "procedureevents") or table_path(mimiciv_dir, "procedureevents"),
            "inputevents": table_path(mimiciv_dir, "icu", "inputevents") or table_path(mimiciv_dir, "inputevents"),
        },
        "note": {
            "discharge": table_path(note_dir, "note", "discharge") or table_path(note_dir, "discharge"),
            "radiology": table_path(note_dir, "note", "radiology") or table_path(note_dir, "radiology"),
        },
        "cxr": {
            "study_list": file_table_path(cxr_dir, "cxr-study-list.csv") or table_path(cxr_dir, "mimic-cxr-2.0.0-metadata", "cxr-study-list"),
            "record_list": file_table_path(cxr_dir, "cxr-record-list.csv") or table_path(cxr_dir, "mimic-cxr-2.0.0-metadata", "cxr-record-list"),
            "reports": file_table_path(cxr_dir, "cxr_reports.csv"),
        },
        "ecg": {
            "record_list": file_table_path(ecg_dir, "record-list.csv") or table_path(ecg_dir, "record-list"),
            "machine_measurements": file_table_path(ecg_dir, "machine_measurements.csv") or table_path(ecg_dir, "machine_measurements"),
            "waveform_note_links": file_table_path(ecg_dir, "waveform_note_links.csv") or table_path(ecg_dir, "waveform_note_links"),
        },
    }


def module_table_availability(paths: dict[str, dict[str, Path | None]]) -> dict[str, Any]:
    matrix: dict[str, Any] = {}
    for module, tables in paths.items():
        matrix[module] = {
            "available": any(path is not None for path in tables.values()),
            "tables": {
                name: {
                    "status": "found" if path else "missing",
                    "path": str(path) if path else None,
                }
                for name, path in tables.items()
            },
        }
    return matrix


def case_time_window(alias: str, time_col: str, before_hours: int, after_hours: int) -> str:
    return f"""
        (
          m.intime IS NULL
          OR TRY_CAST({alias}.{time_col} AS TIMESTAMP) BETWEEN
             TRY_CAST(m.intime AS TIMESTAMP) - INTERVAL '{before_hours} hours'
             AND COALESCE(TRY_CAST(m.outtime AS TIMESTAMP), TRY_CAST(m.intime AS TIMESTAMP)) + INTERVAL '{after_hours} hours'
        )
    """


def query_ed_tables(con: duckdb.DuckDBPyConnection, paths: dict[str, Path | None], args: argparse.Namespace) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    notes: list[str] = []
    result: dict[str, list[dict[str, Any]]] = {}

    simple_stay_tables = {
        "edstays": ["subject_id", "hadm_id", "stay_id", "intime", "outtime", "gender", "race", "arrival_transport", "disposition"],
        "triage": ["subject_id", "stay_id", "temperature", "heartrate", "resprate", "o2sat", "sbp", "dbp", "pain", "acuity", "chiefcomplaint"],
        "diagnosis": ["subject_id", "stay_id", "seq_num", "icd_code", "icd_version", "icd_title"],
        "vitalsign": ["subject_id", "stay_id", "charttime", "temperature", "heartrate", "resprate", "o2sat", "sbp", "dbp", "rhythm", "pain"],
        "medrecon": ["subject_id", "stay_id", "charttime", "name", "gsn", "ndc", "etccode", "etcdescription"],
        "pyxis": ["subject_id", "stay_id", "charttime", "med_rn", "name", "gsn"],
    }
    for name, columns in simple_stay_tables.items():
        path = paths.get(name)
        if not path:
            notes.append(f"MIMIC-IV-ED {name} table not found.")
            result[name] = []
            continue
        cols = table_columns(con, path)
        select_list = ["m.public_case_uid"]
        select_list.extend(select_expr(cols, "t", col, cast="TIMESTAMP" if col in {"charttime", "intime", "outtime"} else None) for col in columns)
        order_col = "TRY_CAST(t.charttime AS TIMESTAMP)" if "charttime" in cols else "m.public_case_uid"
        query = f"""
            SELECT {", ".join(select_list)}
            FROM mietic_ids m
            JOIN {read_csv_sql(path)} t
              ON TRY_CAST(t.stay_id AS BIGINT) = m.stay_id
            WHERE m.stay_id IS NOT NULL
            QUALIFY ROW_NUMBER() OVER (
              PARTITION BY m.public_case_uid
              ORDER BY {order_col}
            ) <= {args.limit_per_case if name not in {"edstays", "triage"} else 1}
            ORDER BY m.public_case_uid, {order_col}
        """
        rows, note = run_optional_query(con, f"ED {name}", query)
        if note:
            notes.append(note)
        result[name] = rows

    return result, notes


def query_hospital_context(con: duckdb.DuckDBPyConnection, paths: dict[str, Path | None], args: argparse.Namespace) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    notes: list[str] = []
    result: dict[str, list[dict[str, Any]]] = {}

    def query_by_hadm(table_key: str, columns: list[str], *, limit: int | None = None, order: str = "m.public_case_uid") -> None:
        path = paths.get(table_key)
        if not path:
            notes.append(f"MIMIC-IV hosp.{table_key} table not found.")
            result[table_key] = []
            return
        cols = table_columns(con, path)
        select_list = ["m.public_case_uid"]
        for col in columns:
            cast = "TIMESTAMP" if col.endswith("time") or col in {"charttime", "storetime", "starttime", "stoptime", "entertime", "verifiedtime", "transfertime", "intime", "outtime", "admittime", "dischtime", "deathtime"} else None
            select_list.append(select_expr(cols, "t", col, cast=cast))
        qualify = f"QUALIFY ROW_NUMBER() OVER (PARTITION BY m.public_case_uid ORDER BY {order}) <= {limit}" if limit else ""
        query = f"""
            SELECT {", ".join(select_list)}
            FROM mietic_ids m
            JOIN {read_csv_sql(path)} t
              ON TRY_CAST(t.hadm_id AS BIGINT) = m.hadm_id
            WHERE m.hadm_id IS NOT NULL
            {qualify}
            ORDER BY m.public_case_uid, {order}
        """
        rows, note = run_optional_query(con, f"hosp.{table_key}", query)
        if note:
            notes.append(note)
        result[table_key] = rows

    query_by_hadm("admissions", ["subject_id", "hadm_id", "admittime", "dischtime", "deathtime", "admission_type", "admission_location", "discharge_location", "race", "edregtime", "edouttime", "hospital_expire_flag"], order="TRY_CAST(t.admittime AS TIMESTAMP)")
    query_by_hadm("services", ["subject_id", "hadm_id", "transfertime", "prev_service", "curr_service"], limit=args.limit_per_case, order="TRY_CAST(t.transfertime AS TIMESTAMP)")
    query_by_hadm("transfers", ["subject_id", "hadm_id", "transfer_id", "eventtype", "careunit", "intime", "outtime"], limit=args.limit_per_case, order="TRY_CAST(t.intime AS TIMESTAMP)")
    query_by_hadm("poe", ["poe_id", "poe_seq", "subject_id", "hadm_id", "ordertime", "order_type", "order_subtype", "transaction_type", "order_status"], limit=args.limit_per_case, order="TRY_CAST(t.ordertime AS TIMESTAMP)")
    query_by_hadm("prescriptions", ["subject_id", "hadm_id", "pharmacy_id", "poe_id", "starttime", "stoptime", "drug_type", "drug", "prod_strength", "dose_val_rx", "dose_unit_rx", "route"], limit=args.limit_per_case, order="TRY_CAST(t.starttime AS TIMESTAMP)")
    query_by_hadm("pharmacy", ["subject_id", "hadm_id", "pharmacy_id", "poe_id", "starttime", "stoptime", "medication", "proc_type", "status", "entertime", "verifiedtime", "route", "frequency"], limit=args.limit_per_case, order="TRY_CAST(t.entertime AS TIMESTAMP)")
    query_by_hadm("emar", ["subject_id", "hadm_id", "emar_id", "pharmacy_id", "charttime", "medication", "event_txt", "scheduletime", "storetime"], limit=args.limit_per_case, order="TRY_CAST(t.charttime AS TIMESTAMP)")

    diag_path = paths.get("diagnoses_icd")
    if diag_path:
        cols = table_columns(con, diag_path)
        d_icd = paths.get("d_icd_diagnoses")
        join_title = ""
        title_select = "NULL AS long_title"
        if d_icd:
            join_title = f"""
                LEFT JOIN {read_csv_sql(d_icd)} di
                  ON d.icd_code = di.icd_code
                 AND TRY_CAST(d.icd_version AS INTEGER) = TRY_CAST(di.icd_version AS INTEGER)
            """
            title_select = "di.long_title"
        query = f"""
            SELECT
              m.public_case_uid,
              {select_expr(cols, "d", "subject_id")},
              {select_expr(cols, "d", "hadm_id")},
              {select_expr(cols, "d", "seq_num")},
              {select_expr(cols, "d", "icd_code")},
              {select_expr(cols, "d", "icd_version")},
              {title_select}
            FROM mietic_ids m
            JOIN {read_csv_sql(diag_path)} d
              ON TRY_CAST(d.hadm_id AS BIGINT) = m.hadm_id
            {join_title}
            WHERE m.hadm_id IS NOT NULL
            ORDER BY m.public_case_uid, TRY_CAST(d.seq_num AS INTEGER)
        """
        result["diagnoses_icd"], note = run_optional_query(con, "hosp.diagnoses_icd", query)
        if note:
            notes.append(note)
    else:
        result["diagnoses_icd"] = []
        notes.append("MIMIC-IV hosp.diagnoses_icd table not found.")

    proc_path = paths.get("procedures_icd")
    if proc_path:
        cols = table_columns(con, proc_path)
        d_proc = paths.get("d_icd_procedures")
        join_title = ""
        title_select = "NULL AS long_title"
        if d_proc:
            join_title = f"""
                LEFT JOIN {read_csv_sql(d_proc)} di
                  ON p.icd_code = di.icd_code
                 AND TRY_CAST(p.icd_version AS INTEGER) = TRY_CAST(di.icd_version AS INTEGER)
            """
            title_select = "di.long_title"
        query = f"""
            SELECT
              m.public_case_uid,
              {select_expr(cols, "p", "subject_id")},
              {select_expr(cols, "p", "hadm_id")},
              {select_expr(cols, "p", "seq_num")},
              {select_expr(cols, "p", "chartdate")},
              {select_expr(cols, "p", "icd_code")},
              {select_expr(cols, "p", "icd_version")},
              {title_select}
            FROM mietic_ids m
            JOIN {read_csv_sql(proc_path)} p
              ON TRY_CAST(p.hadm_id AS BIGINT) = m.hadm_id
            {join_title}
            WHERE m.hadm_id IS NOT NULL
            ORDER BY m.public_case_uid, p.chartdate, TRY_CAST(p.seq_num AS INTEGER)
        """
        result["procedures_icd"], note = run_optional_query(con, "hosp.procedures_icd", query)
        if note:
            notes.append(note)
    else:
        result["procedures_icd"] = []
        notes.append("MIMIC-IV hosp.procedures_icd table not found.")

    lab_path = paths.get("labevents")
    d_lab = paths.get("d_labitems")
    if lab_path and d_lab:
        cols = table_columns(con, lab_path)
        d_cols = table_columns(con, d_lab)
        query = f"""
            WITH labs AS (
              SELECT
                m.public_case_uid,
                {select_expr(cols, "l", "subject_id")},
                {select_expr(cols, "l", "hadm_id")},
                {select_expr(cols, "l", "labevent_id")},
                {select_expr(cols, "l", "itemid")},
                {select_expr(d_cols, "d", "label")},
                {select_expr(d_cols, "d", "fluid")},
                {select_expr(d_cols, "d", "category")},
                {select_expr(cols, "l", "charttime", cast="TIMESTAMP")},
                {select_expr(cols, "l", "storetime", cast="TIMESTAMP")},
                {select_expr(cols, "l", "value")},
                {select_expr(cols, "l", "valuenum", cast="DOUBLE")},
                {select_expr(cols, "l", "valueuom")},
                {select_expr(cols, "l", "ref_range_lower")},
                {select_expr(cols, "l", "ref_range_upper")},
                {select_expr(cols, "l", "flag")},
                {select_expr(cols, "l", "priority")},
                ROW_NUMBER() OVER (
                  PARTITION BY m.public_case_uid
                  ORDER BY COALESCE(TRY_CAST(l.storetime AS TIMESTAMP), TRY_CAST(l.charttime AS TIMESTAMP))
                ) AS rn
              FROM mietic_ids m
              JOIN {read_csv_sql(lab_path)} l
                ON (
                  (m.hadm_id IS NOT NULL AND TRY_CAST(l.hadm_id AS BIGINT) = m.hadm_id)
                  OR (
                    m.hadm_id IS NULL
                    AND m.subject_id IS NOT NULL
                    AND TRY_CAST(l.subject_id AS BIGINT) = m.subject_id
                    AND {case_time_window("l", "charttime", args.before_hours, args.after_hours)}
                  )
                )
              JOIN {read_csv_sql(d_lab)} d
                ON TRY_CAST(l.itemid AS BIGINT) = TRY_CAST(d.itemid AS BIGINT)
              WHERE m.hadm_id IS NOT NULL OR {case_time_window("l", "charttime", args.before_hours, args.after_hours)}
            )
            SELECT * EXCLUDE (rn)
            FROM labs
            WHERE rn <= {args.limit_per_case}
            ORDER BY public_case_uid, COALESCE(storetime, charttime)
        """
        result["labevents"], note = run_optional_query(con, "hosp.labevents", query)
        if note:
            notes.append(note)
    else:
        result["labevents"] = []
        notes.append("MIMIC-IV hosp.labevents or d_labitems table not found.")

    micro_path = paths.get("microbiologyevents")
    if micro_path:
        cols = table_columns(con, micro_path)
        query = f"""
            WITH micro AS (
              SELECT
                m.public_case_uid,
                {select_expr(cols, "e", "subject_id")},
                {select_expr(cols, "e", "hadm_id")},
                {select_expr(cols, "e", "micro_specimen_id")},
                {select_expr(cols, "e", "chartdate", cast="TIMESTAMP")},
                {select_expr(cols, "e", "charttime", cast="TIMESTAMP")},
                {select_expr(cols, "e", "storedate", cast="TIMESTAMP")},
                {select_expr(cols, "e", "storetime", cast="TIMESTAMP")},
                {select_expr(cols, "e", "spec_type_desc")},
                {select_expr(cols, "e", "test_name")},
                {select_expr(cols, "e", "org_name")},
                {select_expr(cols, "e", "ab_name")},
                {select_expr(cols, "e", "dilution_text")},
                {select_expr(cols, "e", "dilution_comparison")},
                {select_expr(cols, "e", "dilution_value")},
                {select_expr(cols, "e", "interpretation")},
                {select_expr(cols, "e", "comments")},
                ROW_NUMBER() OVER (
                  PARTITION BY m.public_case_uid
                  ORDER BY COALESCE(TRY_CAST(e.storetime AS TIMESTAMP), TRY_CAST(e.charttime AS TIMESTAMP), TRY_CAST(e.chartdate AS TIMESTAMP))
                ) AS rn
              FROM mietic_ids m
              JOIN {read_csv_sql(micro_path)} e
                ON (
                  (m.hadm_id IS NOT NULL AND TRY_CAST(e.hadm_id AS BIGINT) = m.hadm_id)
                  OR (
                    m.hadm_id IS NULL
                    AND m.subject_id IS NOT NULL
                    AND TRY_CAST(e.subject_id AS BIGINT) = m.subject_id
                    AND {case_time_window("e", "charttime", args.before_hours, args.after_hours)}
                  )
                )
            )
            SELECT * EXCLUDE (rn)
            FROM micro
            WHERE rn <= {args.limit_per_case}
            ORDER BY public_case_uid, COALESCE(storetime, charttime, chartdate)
        """
        result["microbiologyevents"], note = run_optional_query(con, "hosp.microbiologyevents", query)
        if note:
            notes.append(note)
    else:
        result["microbiologyevents"] = []
        notes.append("MIMIC-IV hosp.microbiologyevents table not found.")

    return result, notes


def query_icu_context(con: duckdb.DuckDBPyConnection, paths: dict[str, Path | None], args: argparse.Namespace) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    notes: list[str] = []
    result: dict[str, list[dict[str, Any]]] = {}

    icu_path = paths.get("icustays")
    if icu_path:
        cols = table_columns(con, icu_path)
        query = f"""
            SELECT
              m.public_case_uid,
              {select_expr(cols, "i", "subject_id")},
              {select_expr(cols, "i", "hadm_id")},
              {select_expr(cols, "i", "stay_id")},
              {select_expr(cols, "i", "first_careunit")},
              {select_expr(cols, "i", "last_careunit")},
              {select_expr(cols, "i", "intime", cast="TIMESTAMP")},
              {select_expr(cols, "i", "outtime", cast="TIMESTAMP")},
              {select_expr(cols, "i", "los")}
            FROM mietic_ids m
            JOIN {read_csv_sql(icu_path)} i
              ON TRY_CAST(i.hadm_id AS BIGINT) = m.hadm_id
            WHERE m.hadm_id IS NOT NULL
            ORDER BY m.public_case_uid, TRY_CAST(i.intime AS TIMESTAMP)
        """
        result["icustays"], note = run_optional_query(con, "icu.icustays", query)
        if note:
            notes.append(note)
    else:
        result["icustays"] = []
        notes.append("MIMIC-IV icu.icustays table not found.")

    d_items = paths.get("d_items")
    for key, time_col in [("procedureevents", "starttime"), ("inputevents", "starttime")]:
        path = paths.get(key)
        if not path:
            result[key] = []
            notes.append(f"MIMIC-IV icu.{key} table not found.")
            continue
        cols = table_columns(con, path)
        join_items = ""
        label_select = "NULL AS item_label"
        if d_items:
            join_items = f"LEFT JOIN {read_csv_sql(d_items)} d ON TRY_CAST(t.itemid AS BIGINT) = TRY_CAST(d.itemid AS BIGINT)"
            label_select = "d.label AS item_label"
        query = f"""
            WITH rows AS (
              SELECT
                m.public_case_uid,
                {select_expr(cols, "t", "subject_id")},
                {select_expr(cols, "t", "hadm_id")},
                {select_expr(cols, "t", "stay_id")},
                {select_expr(cols, "t", "starttime", cast="TIMESTAMP")},
                {select_expr(cols, "t", "endtime", cast="TIMESTAMP")},
                {select_expr(cols, "t", "storetime", cast="TIMESTAMP")},
                {select_expr(cols, "t", "itemid")},
                {label_select},
                {select_expr(cols, "t", "amount", cast="DOUBLE")},
                {select_expr(cols, "t", "amountuom")},
                {select_expr(cols, "t", "rate", cast="DOUBLE")},
                {select_expr(cols, "t", "rateuom")},
                {select_expr(cols, "t", "value", cast="DOUBLE")},
                {select_expr(cols, "t", "valueuom")},
                {select_expr(cols, "t", "statusdescription")},
                ROW_NUMBER() OVER (
                  PARTITION BY m.public_case_uid
                  ORDER BY TRY_CAST(t.{time_col} AS TIMESTAMP)
                ) AS rn
              FROM mietic_ids m
              JOIN {read_csv_sql(path)} t
                ON TRY_CAST(t.hadm_id AS BIGINT) = m.hadm_id
              {join_items}
              WHERE m.hadm_id IS NOT NULL
            )
            SELECT * EXCLUDE (rn)
            FROM rows
            WHERE rn <= {args.limit_per_case}
            ORDER BY public_case_uid, starttime
        """
        result[key], note = run_optional_query(con, f"icu.{key}", query)
        if note:
            notes.append(note)

    return result, notes


def query_note_context(con: duckdb.DuckDBPyConnection, paths: dict[str, Path | None], args: argparse.Namespace) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    notes: list[str] = []
    result: dict[str, list[dict[str, Any]]] = {}
    for key in ["discharge", "radiology"]:
        path = paths.get(key)
        if not path:
            result[key] = []
            notes.append(f"MIMIC-IV-Note {key} table not found.")
            continue
        cols = table_columns(con, path)
        hadm_condition = "TRY_CAST(n.hadm_id AS BIGINT) = m.hadm_id" if "hadm_id" in cols else "FALSE"
        time_order = "TRY_CAST(n.charttime AS TIMESTAMP)" if "charttime" in cols else "m.public_case_uid"
        text_expr = "SUBSTR(n.text, 1, 900)" if "text" in cols else "NULL"
        query = f"""
            SELECT
              m.public_case_uid,
              {select_expr(cols, "n", "note_id")},
              {select_expr(cols, "n", "subject_id")},
              {select_expr(cols, "n", "hadm_id")},
              {select_expr(cols, "n", "charttime", cast="TIMESTAMP")},
              {select_expr(cols, "n", "storetime", cast="TIMESTAMP")},
              {text_expr} AS text_snippet
            FROM mietic_ids m
            JOIN {read_csv_sql(path)} n
              ON (
                ({hadm_condition})
                OR (
                  m.hadm_id IS NULL
                  AND m.subject_id IS NOT NULL
                  AND TRY_CAST(n.subject_id AS BIGINT) = m.subject_id
                )
              )
            WHERE m.hadm_id IS NOT NULL OR m.subject_id IS NOT NULL
            QUALIFY ROW_NUMBER() OVER (PARTITION BY m.public_case_uid ORDER BY {time_order}) <= {min(args.limit_per_case, 5)}
            ORDER BY m.public_case_uid, {time_order}
        """
        result[key], note = run_optional_query(con, f"note.{key}", query)
        if note:
            notes.append(note)
    return result, notes


def query_cxr_context(con: duckdb.DuckDBPyConnection, paths: dict[str, Path | None], args: argparse.Namespace) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    notes: list[str] = []
    result: dict[str, list[dict[str, Any]]] = {"studies": [], "reports": []}
    study_path = paths.get("study_list")
    if study_path:
        cols = table_columns(con, study_path)
        query = f"""
            SELECT
              m.public_case_uid,
              {select_expr(cols, "s", "subject_id")},
              {select_expr(cols, "s", "study_id")},
              {select_expr(cols, "s", "studydate")},
              {select_expr(cols, "s", "studytime")}
            FROM mietic_ids m
            JOIN {read_csv_sql(study_path)} s
              ON TRY_CAST(s.subject_id AS BIGINT) = m.subject_id
            WHERE m.subject_id IS NOT NULL
            QUALIFY ROW_NUMBER() OVER (PARTITION BY m.public_case_uid ORDER BY s.study_id) <= {min(args.limit_per_case, 8)}
            ORDER BY m.public_case_uid, s.study_id
        """
        result["studies"], note = run_optional_query(con, "cxr.study_list", query)
        if note:
            notes.append(note)
    else:
        notes.append("MIMIC-CXR study list not found.")

    report_path = paths.get("reports")
    if report_path:
        cols = table_columns(con, report_path)
        text_expr = "SUBSTR(r.report, 1, 900)" if "report" in cols else ("SUBSTR(r.text, 1, 900)" if "text" in cols else "NULL")
        query = f"""
            SELECT
              m.public_case_uid,
              {select_expr(cols, "r", "subject_id")},
              {select_expr(cols, "r", "study_id")},
              {text_expr} AS report_snippet
            FROM mietic_ids m
            JOIN {read_csv_sql(report_path)} r
              ON TRY_CAST(r.subject_id AS BIGINT) = m.subject_id
            WHERE m.subject_id IS NOT NULL
            QUALIFY ROW_NUMBER() OVER (PARTITION BY m.public_case_uid ORDER BY r.study_id) <= {min(args.limit_per_case, 5)}
            ORDER BY m.public_case_uid, r.study_id
        """
        result["reports"], note = run_optional_query(con, "cxr.reports", query)
        if note:
            notes.append(note)
    else:
        notes.append("MIMIC-CXR report CSV not found; raw text reports are not parsed by this linker.")
    return result, notes


def query_ecg_context(con: duckdb.DuckDBPyConnection, paths: dict[str, Path | None], args: argparse.Namespace) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    notes: list[str] = []
    result: dict[str, list[dict[str, Any]]] = {"records": [], "machine_measurements": []}
    record_path = paths.get("record_list")
    if record_path:
        cols = table_columns(con, record_path)
        order_col = "TRY_CAST(e.ecg_time AS TIMESTAMP)" if "ecg_time" in cols else "e.study_id"
        query = f"""
            SELECT
              m.public_case_uid,
              {select_expr(cols, "e", "subject_id")},
              {select_expr(cols, "e", "study_id")},
              {select_expr(cols, "e", "ecg_time", cast="TIMESTAMP")},
              {select_expr(cols, "e", "path")}
            FROM mietic_ids m
            JOIN {read_csv_sql(record_path)} e
              ON TRY_CAST(e.subject_id AS BIGINT) = m.subject_id
            WHERE m.subject_id IS NOT NULL
            QUALIFY ROW_NUMBER() OVER (PARTITION BY m.public_case_uid ORDER BY {order_col}) <= {min(args.limit_per_case, 5)}
            ORDER BY m.public_case_uid, {order_col}
        """
        result["records"], note = run_optional_query(con, "ecg.record_list", query)
        if note:
            notes.append(note)
    else:
        notes.append("MIMIC-IV-ECG record-list table not found.")

    mm_path = paths.get("machine_measurements")
    if mm_path:
        cols = table_columns(con, mm_path)
        report_exprs = [
            f"mmt.{col}" for col in sorted(cols)
            if re.fullmatch(r"report_\d+", col, flags=re.I) or col.lower() in {"report", "machine_report"}
        ]
        report_expr = " || ' ' || ".join(report_exprs) if report_exprs else "NULL"
        order_col = "TRY_CAST(mmt.ecg_time AS TIMESTAMP)" if "ecg_time" in cols else "mmt.study_id"
        query = f"""
            SELECT
              m.public_case_uid,
              {select_expr(cols, "mmt", "subject_id")},
              {select_expr(cols, "mmt", "study_id")},
              {select_expr(cols, "mmt", "ecg_time", cast="TIMESTAMP")},
              {select_expr(cols, "mmt", "heart_rate")},
              {select_expr(cols, "mmt", "rr_interval")},
              {select_expr(cols, "mmt", "qrs_duration")},
              {select_expr(cols, "mmt", "qtc")},
              SUBSTR({report_expr}, 1, 700) AS machine_report
            FROM mietic_ids m
            JOIN {read_csv_sql(mm_path)} mmt
              ON TRY_CAST(mmt.subject_id AS BIGINT) = m.subject_id
            WHERE m.subject_id IS NOT NULL
            QUALIFY ROW_NUMBER() OVER (PARTITION BY m.public_case_uid ORDER BY {order_col}) <= {min(args.limit_per_case, 5)}
            ORDER BY m.public_case_uid, {order_col}
        """
        result["machine_measurements"], note = run_optional_query(con, "ecg.machine_measurements", query)
        if note:
            notes.append(note)
    else:
        notes.append("MIMIC-IV-ECG machine_measurements table not found.")
    return result, notes


def group_by_case(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        case_uid = str(row.get("public_case_uid"))
        if not case_uid:
            continue
        cleaned = {
            key: value
            for key, value in row.items()
            if key != "public_case_uid" and value not in (None, "")
        }
        grouped.setdefault(case_uid, []).append(cleaned)
    return grouped


def group_context(module_rows: dict[str, list[dict[str, Any]]]) -> dict[str, dict[str, list[dict[str, Any]]]]:
    return {name: group_by_case(rows) for name, rows in module_rows.items()}


def classify_text(text: str, classifiers: list[tuple[str, str, re.Pattern[str]]]) -> list[dict[str, str]]:
    matches = []
    for key, label, pattern in classifiers:
        if pattern.search(text):
            matches.append({"id": key, "label": label})
    return matches


def classify_labs(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        text = f"{row.get('label', '')} {row.get('category', '')} {row.get('fluid', '')}"
        matches = classify_text(text, LAB_CLASSIFIERS) or [{"id": "other_labs", "label": "Other labs"}]
        enriched = {**row, "clinical_class": matches[0]["id"], "clinical_class_label": matches[0]["label"]}
        grouped.setdefault(matches[0]["id"], []).append(enriched)
    return grouped


def classify_meds(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        text = f"{row.get('name', '')} {row.get('drug', '')} {row.get('medication', '')} {row.get('event_txt', '')}"
        matches = classify_text(text, MED_CLASSIFIERS) or [{"id": "other_meds", "label": "Other medications"}]
        enriched = {**row, "clinical_class": matches[0]["id"], "clinical_class_label": matches[0]["label"]}
        grouped.setdefault(matches[0]["id"], []).append(enriched)
    return grouped


def classify_orders(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        text = f"{row.get('order_type', '')} {row.get('order_subtype', '')}"
        matches = classify_text(text, ORDER_CLASSIFIERS) or [{"id": "other_orders", "label": "Other orders"}]
        enriched = {**row, "clinical_class": matches[0]["id"], "clinical_class_label": matches[0]["label"]}
        grouped.setdefault(matches[0]["id"], []).append(enriched)
    return grouped


def first_time(values: list[dict[str, Any]], *keys: str) -> str | None:
    for row in values:
        for key in keys:
            if row.get(key):
                return str(row[key])
    return None


def medication_names(rows: list[dict[str, Any]], limit: int = 5) -> list[str]:
    names = []
    for row in rows:
        value = compact_text(row.get("name") or row.get("drug") or row.get("medication") or row.get("event_txt"))
        if value and value not in names:
            names.append(value)
    return names[:limit]


def lab_summary(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "Not documented"
    labels = []
    for row in rows:
        label = compact_text(row.get("label") or row.get("clinical_class_label"))
        raw_value = compact_text(row.get("value"))
        numeric_value = compact_text(row.get("valuenum"))
        value = numeric_value if raw_value in {"", "___"} and numeric_value else raw_value or numeric_value
        unit = compact_text(row.get("valueuom"))
        piece = f"{label}: {value}{(' ' + unit) if unit else ''}".strip(": ")
        if piece and piece not in labels:
            labels.append(piece)
    return "; ".join(labels[:4]) or f"{len(rows)} linked lab result(s)"


def microbiology_summary(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "Not documented"
    pieces = []
    for row in rows:
        specimen = compact_text(row.get("spec_type_desc"))
        test = compact_text(row.get("test_name"))
        organism = compact_text(row.get("org_name"))
        interpretation = compact_text(row.get("interpretation"))
        comments = compact_text(row.get("comments"))
        result = organism or interpretation or comments
        label = " / ".join(part for part in [specimen, test] if part)
        piece = f"{label}: {result}" if label and result else label or result
        if piece and piece not in pieces:
            pieces.append(piece)
    return "; ".join(pieces[:4]) or f"{len(rows)} linked microbiology event(s)"


def vital_summary(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "Not documented"
    latest = rows[-1]
    parts = []
    for key, label in [
        ("heartrate", "HR"),
        ("resprate", "RR"),
        ("o2sat", "SpO2"),
        ("sbp", "SBP"),
        ("dbp", "DBP"),
        ("temperature", "T"),
        ("pain", "pain"),
        ("rhythm", "rhythm"),
    ]:
        if latest.get(key):
            parts.append(f"{label} {latest[key]}")
    prefix = f"{len(rows)} repeat vital set{'s' if len(rows) != 1 else ''}"
    return f"{prefix}; latest " + ", ".join(parts) if parts else prefix


def note_summary(rows: list[dict[str, Any]], label: str) -> str:
    if not rows:
        return "Not documented"
    snippet = compact_text(rows[0].get("text_snippet") or rows[0].get("report_snippet"))
    return f"{label}: {snippet[:240]}{'...' if len(snippet) > 240 else ''}" if snippet else f"{len(rows)} linked {label.lower()} item(s)"


def make_optional_item(
    item_id: str,
    category: str,
    label: str,
    values: list[dict[str, Any]],
    *,
    source_module: str,
    display_policy: str,
    summary: str,
    available_at: str | None = None,
    unlock_action_ids: list[str] | None = None,
    provenance: str = "source_record",
) -> dict[str, Any]:
    return {
        "id": item_id,
        "category": category,
        "label": label,
        "availability": "available" if values else "not_documented",
        "source_module": source_module,
        "available_at": available_at,
        "display_policy": display_policy,
        "unlock_action_ids": unlock_action_ids or [],
        "values": values,
        "summary": summary if values else "Not documented in linked restricted source context.",
        "provenance": provenance,
        "source_restriction": SOURCE_RESTRICTION,
    }


def build_optional_objective_data(context: dict[str, Any]) -> list[dict[str, Any]]:
    ed = context["ed"]
    hosp = context["hosp"]
    icu = context["icu"]
    note = context["note"]
    cxr = context["cxr"]
    ecg = context["ecg"]
    labs_by_class = classify_labs(hosp["labs"])
    meds_by_class = classify_meds(ed["pyxis"] + hosp["prescriptions"] + hosp["pharmacy"] + hosp["emar"])
    orders_by_class = classify_orders(hosp["poe_orders"])
    glucose = labs_by_class.get("poc_glucose", [])
    imaging_orders = [
        row for key, rows in orders_by_class.items()
        if key in {"cxr", "ct", "ultrasound", "mri", "ecg"}
        for row in rows
    ]
    blood_bank = labs_by_class.get("type_screen", []) + orders_by_class.get("blood_bank", [])
    consults = orders_by_class.get("consult", [])
    plan_labs = [
        row for key, rows in labs_by_class.items()
        if key not in {"poc_glucose", "type_screen"}
        for row in rows
    ]
    ed_meds = ed["pyxis"]
    home_meds = ed["medrecon"]
    reassessment_values = ed["repeat_vitals"] + hosp["transfers"] + hosp["services"] + icu["icustays"] + icu["procedureevents"] + icu["inputevents"]

    return [
        make_optional_item(
            "repeat_vitals",
            "Encounter",
            "Repeat ED vitals / rhythm trend",
            ed["repeat_vitals"],
            source_module="MIMIC-IV-ED ed.vitalsign",
            display_policy="encounter_unlock",
            available_at=first_time(ed["repeat_vitals"], "charttime"),
            summary=vital_summary(ed["repeat_vitals"]),
        ),
        make_optional_item(
            "home_meds",
            "Encounter",
            "Medication reconciliation",
            home_meds,
            source_module="MIMIC-IV-ED ed.medrecon",
            display_policy="encounter_unlock",
            available_at=first_time(home_meds, "charttime"),
            summary=", ".join(medication_names(home_meds)) or "Not documented",
        ),
        make_optional_item(
            "poc_glucose",
            "Encounter",
            "POC glucose / linked glucose",
            glucose,
            source_module="MIMIC-IV hosp.labevents",
            display_policy="encounter_unlock",
            available_at=first_time(glucose, "storetime", "charttime"),
            summary=lab_summary(glucose),
            unlock_action_ids=["poc_glucose"],
        ),
        make_optional_item(
            "ecg",
            "Encounter",
            "ECG machine summary",
            ecg["machine_measurements"] or ecg["records"],
            source_module="MIMIC-IV-ECG",
            display_policy="encounter_unlock",
            available_at=first_time(ecg["machine_measurements"] + ecg["records"], "ecg_time"),
            summary=note_summary(ecg["machine_measurements"], "ECG") if ecg["machine_measurements"] else f"{len(ecg['records'])} linked ECG record(s)",
            unlock_action_ids=["ecg"],
        ),
        make_optional_item(
            "labs",
            "Plan",
            "Linked labs",
            plan_labs,
            source_module="MIMIC-IV hosp.labevents",
            display_policy="plan_unlock",
            available_at=first_time(plan_labs, "storetime", "charttime"),
            summary=lab_summary(plan_labs),
            unlock_action_ids=["bloodwork", "poc_glucose", "type_screen"],
        ),
        make_optional_item(
            "cultures_microbiology",
            "Plan",
            "Cultures / microbiology",
            hosp["microbiology"],
            source_module="MIMIC-IV hosp.microbiologyevents",
            display_policy="plan_unlock",
            available_at=first_time(hosp["microbiology"], "storetime", "charttime", "chartdate"),
            summary=microbiology_summary(hosp["microbiology"]),
            unlock_action_ids=["cultures", "antibiotics"],
        ),
        make_optional_item(
            "imaging_orders",
            "Plan",
            "Imaging orders / CXR reports",
            imaging_orders + cxr["studies"] + cxr["reports"] + note["radiology"],
            source_module="MIMIC-IV POE, MIMIC-CXR, MIMIC-IV-Note radiology",
            display_policy="plan_unlock",
            available_at=first_time(imaging_orders + note["radiology"], "ordertime", "charttime"),
            summary=note_summary(cxr["reports"] or note["radiology"], "Imaging") if (cxr["reports"] or note["radiology"]) else f"{len(imaging_orders)} linked imaging order(s)",
            unlock_action_ids=["cxr", "ct_with_contrast", "ct_without_contrast", "efast", "bedside_ultrasound"],
        ),
        make_optional_item(
            "medications_given",
            "Plan",
            "ED/hospital medications given",
            ed_meds + hosp["prescriptions"] + hosp["pharmacy"] + hosp["emar"],
            source_module="MIMIC-IV-ED pyxis and MIMIC-IV hosp medication tables",
            display_policy="plan_unlock",
            available_at=first_time(ed_meds + hosp["prescriptions"] + hosp["pharmacy"] + hosp["emar"], "charttime", "starttime", "entertime"),
            summary=", ".join(medication_names(ed_meds + hosp["prescriptions"] + hosp["pharmacy"] + hosp["emar"])) or "Not documented",
            unlock_action_ids=[
                "analgesia",
                "antiemetics",
                "antibiotics",
                "bronchodilators",
                "epinephrine",
                "naloxone",
                "iv_fluids",
                "blood_transfusion",
            ],
        ),
        make_optional_item(
            "blood_bank",
            "Plan",
            "Blood bank / type-screen evidence",
            blood_bank,
            source_module="MIMIC-IV hosp.labevents and POE",
            display_policy="plan_unlock",
            available_at=first_time(blood_bank, "storetime", "charttime", "ordertime"),
            summary=lab_summary(blood_bank),
            unlock_action_ids=["type_screen", "blood_transfusion"],
        ),
        make_optional_item(
            "consult_orders",
            "Plan",
            "Consult/order evidence",
            consults + hosp["services"],
            source_module="MIMIC-IV hosp.poe and services",
            display_policy="plan_unlock",
            available_at=first_time(consults + hosp["services"], "ordertime", "transfertime"),
            summary=f"{len(consults)} consult/order signal(s); service path: " + ", ".join(compact_text(row.get("curr_service")) for row in hosp["services"][:4] if row.get("curr_service")) if (consults or hosp["services"]) else "Not documented",
            unlock_action_ids=["consult_emergency_attending", "consult_specialty", "consult_critical_care"],
        ),
        make_optional_item(
            "reassessment_updates",
            "Reassessment",
            "Reassessment-linked outcomes and trends",
            reassessment_values,
            source_module="MIMIC-IV-ED vitals, MIMIC-IV transfers/services, MIMIC-IV ICU",
            display_policy="reassessment_unlock",
            available_at=first_time(reassessment_values, "charttime", "intime", "transfertime", "starttime"),
            summary=vital_summary(ed["repeat_vitals"]) if ed["repeat_vitals"] else f"{len(reassessment_values)} linked reassessment signal(s)",
        ),
        make_optional_item(
            "retrospective_diagnoses",
            "Debrief",
            "Retrospective ED/hospital diagnoses",
            ed["diagnoses"] + hosp["diagnoses"],
            source_module="MIMIC-IV-ED diagnosis and MIMIC-IV hosp.diagnoses_icd",
            display_policy="debrief_only",
            available_at=None,
            summary=", ".join(
                compact_text(row.get("icd_title") or row.get("long_title") or row.get("icd_code"))
                for row in (ed["diagnoses"] + hosp["diagnoses"])[:5]
                if compact_text(row.get("icd_title") or row.get("long_title") or row.get("icd_code"))
            ) or "Not documented",
            provenance="retrospective_ground_truth",
        ),
        make_optional_item(
            "retrospective_procedures",
            "Debrief",
            "Retrospective procedures and service path",
            hosp["procedures"] + icu["procedureevents"] + hosp["transfers"] + hosp["services"],
            source_module="MIMIC-IV procedures, ICU procedureevents, services, transfers",
            display_policy="debrief_only",
            available_at=None,
            summary=f"{len(hosp['procedures'] + icu['procedureevents'])} procedure signal(s), {len(hosp['transfers'])} transfer row(s)",
            provenance="retrospective_ground_truth",
        ),
        make_optional_item(
            "retrospective_notes",
            "Debrief",
            "Discharge/radiology note snippets",
            note["discharge"] + note["radiology"] + cxr["reports"],
            source_module="MIMIC-IV-Note and MIMIC-CXR",
            display_policy="debrief_only",
            available_at=None,
            summary=note_summary(note["discharge"] or note["radiology"] or cxr["reports"], "Note"),
            provenance="retrospective_ground_truth",
        ),
    ]


def make_context(public_uid: str, grouped: dict[str, dict[str, dict[str, list[dict[str, Any]]]]]) -> dict[str, Any]:
    return {
        "ed": {
            "edstays": grouped["ed"]["edstays"].get(public_uid, []),
            "triage": grouped["ed"]["triage"].get(public_uid, []),
            "diagnoses": grouped["ed"]["diagnosis"].get(public_uid, []),
            "repeat_vitals": grouped["ed"]["vitalsign"].get(public_uid, []),
            "medrecon": grouped["ed"]["medrecon"].get(public_uid, []),
            "pyxis": grouped["ed"]["pyxis"].get(public_uid, []),
        },
        "hosp": {
            "admissions": grouped["hosp"]["admissions"].get(public_uid, []),
            "diagnoses": grouped["hosp"]["diagnoses_icd"].get(public_uid, []),
            "procedures": grouped["hosp"]["procedures_icd"].get(public_uid, []),
            "labs": grouped["hosp"]["labevents"].get(public_uid, []),
            "microbiology": grouped["hosp"]["microbiologyevents"].get(public_uid, []),
            "poe_orders": grouped["hosp"]["poe"].get(public_uid, []),
            "prescriptions": grouped["hosp"]["prescriptions"].get(public_uid, []),
            "pharmacy": grouped["hosp"]["pharmacy"].get(public_uid, []),
            "emar": grouped["hosp"]["emar"].get(public_uid, []),
            "services": grouped["hosp"]["services"].get(public_uid, []),
            "transfers": grouped["hosp"]["transfers"].get(public_uid, []),
        },
        "icu": {
            "icustays": grouped["icu"]["icustays"].get(public_uid, []),
            "procedureevents": grouped["icu"]["procedureevents"].get(public_uid, []),
            "inputevents": grouped["icu"]["inputevents"].get(public_uid, []),
        },
        "note": {
            "discharge": grouped["note"]["discharge"].get(public_uid, []),
            "radiology": grouped["note"]["radiology"].get(public_uid, []),
        },
        "cxr": {
            "studies": grouped["cxr"]["studies"].get(public_uid, []),
            "reports": grouped["cxr"]["reports"].get(public_uid, []),
        },
        "ecg": {
            "records": grouped["ecg"]["records"].get(public_uid, []),
            "machine_measurements": grouped["ecg"]["machine_measurements"].get(public_uid, []),
        },
    }


def linked_categories_for_module(module_context: dict[str, list[dict[str, Any]]]) -> list[str]:
    return [key for key, rows in module_context.items() if rows]


def case_module_availability(table_matrix: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    matrix = json.loads(json.dumps(table_matrix))
    for module, module_context in context.items():
        linked = linked_categories_for_module(module_context)
        matrix.setdefault(module, {})
        matrix[module]["linked_categories"] = linked
        matrix[module]["absent_categories"] = [key for key in module_context if key not in linked]
    return matrix


def diagnosis_titles(rows: list[dict[str, Any]]) -> list[str]:
    titles = []
    for row in rows:
        title = compact_text(row.get("icd_title") or row.get("long_title") or row.get("icd_code"))
        if title and title not in titles:
            titles.append(title)
    return titles


def focused_exam_fact(public_uid: str, row: dict[str, Any]) -> dict[str, Any]:
    text = f"{row.get('chief_complaint', '')} {row.get('triage_text', '')}".lower()
    if re.search(r"shortness|dyspnea|breath|chest|cough|hypox|pneumonia", text):
        statement = "Focused exam should assess work of breathing, oxygen need, breath sounds, perfusion, chest findings, and response to respiratory support."
    elif re.search(r"fall|head|seizure|altered|confus|weakness|stroke|syncope", text):
        statement = "Focused exam should assess airway protection, mental status, speech, cranial nerves, strength, sensation, gait or trauma signs, and glucose when appropriate."
    elif re.search(r"abd|vomit|pelvic|rectal|flank|urinary", text):
        statement = "Focused exam should assess abdominal tenderness location, distention, guarding, rebound, CVA tenderness, hydration, and pelvic or rectal findings when indicated."
    elif re.search(r"fracture|injury|pain|swelling|wound|laceration|foot|hand|wrist|ankle|leg", text):
        statement = "Focused exam should assess injury location, deformity, swelling, wound contamination, point tenderness, range of motion, distal pulses, capillary refill, motor function, and sensation."
    else:
        statement = "Focused exam should assess general appearance, airway and breathing, perfusion, mental status, pain or distress, and complaint-directed organ-system findings."
    return {
        "id": f"{public_uid}_restricted_exam_01",
        "domain": "physical_exam",
        "statement": statement,
        "rationale": "Generated from restricted linked MIETIC/MIMIC complaint context; source exam details may remain absent.",
        "source_anchors": [row.get("chief_complaint", ""), f"Reference ESI {row.get('acuity', 3)}"],
        "confidence": "moderate",
        "review_status": "local_teaching_draft",
        "provenance": "local_teaching_inference",
        "source_restriction": SOURCE_RESTRICTION,
        "use_in": ["physical_exam", "soap", "decision_review"],
    }


def build_case_record(row: dict[str, Any], context: dict[str, Any], table_matrix: dict[str, Any]) -> dict[str, Any]:
    public_uid = row["public_case_uid"]
    optional_data = build_optional_objective_data(context)
    ed_titles = diagnosis_titles(context["ed"]["diagnoses"])
    hosp_titles = diagnosis_titles(context["hosp"]["diagnoses"])
    primary_titles = ed_titles[:3] or hosp_titles[:3]
    secondary_titles = [title for title in hosp_titles if title not in primary_titles][:5]
    flags = row.get("flags") or {}
    disposition = row.get("disposition") or (context["ed"]["edstays"][0].get("disposition") if context["ed"]["edstays"] else "")

    return {
        "schema_version": "clinical_case_v3",
        "id": row["id"],
        "case_source": "mimic_restricted_local",
        "source_restriction": SOURCE_RESTRICTION,
        "source": {
            "dataset": SOURCE_DATASET,
            "restriction": SOURCE_RESTRICTION,
            "public_case_uid": public_uid,
            "source_row_index": row["source_row_index"],
            "display_name": "Restricted local MIMIC-IV enriched MIETIC case",
        },
        "identifiers": {
            "subject_id": row["subject_id"],
            "stay_id": row["stay_id"],
            "hadm_id": row["hadm_id"],
            "intime": row["intime"],
            "outtime": row["outtime"],
        },
        "tasks_available": {
            "triage": True,
            "diagnosis": True,
            "referral": True,
            "management": True,
            "reassessment": True,
            "sbar": True,
            "optional_objective_data": True,
        },
        "demographics": {
            "age": row["age"],
            "sex": row["gender"],
            "race": row["race"],
            "transport": row["arrival_transport"],
        },
        "complaint": row["chief_complaint"],
        "history": row["triage_text"] or row["chief_complaint"],
        "vitals": {
            "temp": row["temperature"],
            "hr": row["heartrate"],
            "rr": row["resprate"],
            "o2": row["o2sat"],
            "sbp": row["sbp"],
            "dbp": row["dbp"],
            "pain": row["pain"],
        },
        "acuity": row["acuity"],
        "disposition": disposition,
        "resources_used": row["resources_used"],
        "lab_event_count": row["lab_event_count"],
        "microbio_event_count": row["microbio_event_count"],
        "exam_count": row["exam_count"],
        "consults_count": row["consults_count"],
        "procedure_count": row["procedure_count"],
        **flags,
        "linked_context": context,
        "optional_objective_data": optional_data,
        "retrospective_ground_truth": {
            "ed_icd": context["ed"]["diagnoses"],
            "hospital_icd": context["hosp"]["diagnoses"],
            "hospital_procedures": context["hosp"]["procedures"],
            "service_path": context["hosp"]["services"],
            "transfer_path": context["hosp"]["transfers"],
            "icu_course": context["icu"],
            "note_snippets": context["note"],
            "cxr_context": context["cxr"],
            "ecg_context": context["ecg"],
        },
        "ground_truth": {
            "diagnoses": {
                "primary": primary_titles,
                "secondary": secondary_titles,
                "icd": context["ed"]["diagnoses"][0] if context["ed"]["diagnoses"] else (context["hosp"]["diagnoses"][0] if context["hosp"]["diagnoses"] else {}),
            },
            "referral": {
                "clinician_approved_specialty": [],
            },
            "disposition": disposition,
            "reference_esi": row["acuity"],
        },
        "module_availability": case_module_availability(table_matrix, context),
        "documented_evidence": [
            {
                "id": f"{public_uid}_chief_complaint",
                "domain": "chief_complaint",
                "statement": row["chief_complaint"],
                "source_field": "MIETIC.chiefcomplaint",
                "provenance": "source_record",
                "source_restriction": SOURCE_RESTRICTION,
                "use": "simulation_grounding",
            },
            {
                "id": f"{public_uid}_triage_text",
                "domain": "history_of_present_illness",
                "statement": row["triage_text"] or row["chief_complaint"],
                "source_field": "MIETIC.tiragecase",
                "provenance": "source_record",
                "source_restriction": SOURCE_RESTRICTION,
                "use": "simulation_grounding",
            },
        ],
        "augmentation": {
            "review_status": "local_teaching_draft",
            "inferred_facts": [focused_exam_fact(public_uid, row)],
        },
    }


def build_payload(args: argparse.Namespace) -> dict[str, Any]:
    mimiciv_dir = Path(args.mimiciv_dir).expanduser().resolve()
    mimic_ed_dir = Path(args.mimic_ed_dir).expanduser().resolve()
    mimic_note_dir = Path(args.mimic_note_dir).expanduser().resolve()
    mimic_cxr_dir = Path(args.mimic_cxr_dir).expanduser().resolve()
    mimic_ecg_dir = Path(args.mimic_ecg_dir).expanduser().resolve()
    mietic = normalize_mietic(Path(args.mietic).expanduser().resolve())
    con = duckdb.connect(database=":memory:")
    con.register("mietic_ids", mietic)
    paths = discover_paths(args)
    table_matrix = module_table_availability(paths)

    notes: list[str] = []
    ed_rows, ed_notes = query_ed_tables(con, paths["ed"], args)
    hosp_rows, hosp_notes = query_hospital_context(con, paths["hosp"], args)
    icu_rows, icu_notes = query_icu_context(con, paths["icu"], args)
    note_rows, note_notes = query_note_context(con, paths["note"], args)
    cxr_rows, cxr_notes = query_cxr_context(con, paths["cxr"], args)
    ecg_rows, ecg_notes = query_ecg_context(con, paths["ecg"], args)
    for note_group in [ed_notes, hosp_notes, icu_notes, note_notes, cxr_notes, ecg_notes]:
        notes.extend(note_group)

    grouped = {
        "ed": group_context(ed_rows),
        "hosp": group_context(hosp_rows),
        "icu": group_context(icu_rows),
        "note": group_context(note_rows),
        "cxr": group_context(cxr_rows),
        "ecg": group_context(ecg_rows),
    }

    cases = []
    records = []
    for row in mietic.to_dict(orient="records"):
        public_uid = row["public_case_uid"]
        context = make_context(public_uid, grouped)
        case = build_case_record(row, context, table_matrix)
        cases.append(case)
        records.append(
            {
                "schema_version": "clinical_case_v3_linked_context",
                "public_case_uid": public_uid,
                "source_restriction": SOURCE_RESTRICTION,
                "identifiers": case["identifiers"],
                "linked_context": context,
                "optional_objective_data": case["optional_objective_data"],
                "retrospective_ground_truth": case["retrospective_ground_truth"],
                "module_availability": case["module_availability"],
            }
        )

    return {
        "schema_version": "restricted_mietic_mimic_enrichment_v1",
        "source_dataset": SOURCE_DATASET,
        "source_restriction": SOURCE_RESTRICTION,
        "mietic_input": str(Path(args.mietic).expanduser().resolve()),
        "mimiciv_dir": str(mimiciv_dir),
        "mimic_ed_dir": str(mimic_ed_dir),
        "mimic_note_dir": str(mimic_note_dir),
        "mimic_cxr_dir": str(mimic_cxr_dir),
        "mimic_ecg_dir": str(mimic_ecg_dir),
        "module_availability": table_matrix,
        "case_count": len(cases),
        "notes": notes,
        "cases": cases,
        "records": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Link MIETIC validation rows to local restricted MIMIC-IV modules.")
    parser.add_argument("--mietic", default=str(DEFAULT_MIETIC))
    parser.add_argument("--mimiciv-dir", default=str(DEFAULT_MIMICIV_DIR))
    parser.add_argument("--mimic-ed-dir", default=str(DEFAULT_MIMIC_ED_DIR))
    parser.add_argument("--mimic-note-dir", default=str(DEFAULT_MIMIC_NOTE_DIR))
    parser.add_argument("--mimic-cxr-dir", default=str(DEFAULT_MIMIC_CXR_DIR))
    parser.add_argument("--mimic-ecg-dir", default=str(DEFAULT_MIMIC_ECG_DIR))
    parser.add_argument("--out", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--before-hours", type=int, default=6)
    parser.add_argument("--after-hours", type=int, default=24)
    parser.add_argument("--limit-per-case", type=int, default=12)
    args = parser.parse_args()

    output = Path(args.out).expanduser().resolve()
    assert_restricted_output(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = build_payload(args)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {payload['case_count']} restricted enriched clinical_case_v3 cases to {output}")


if __name__ == "__main__":
    main()
