from __future__ import annotations

import argparse
import csv
from datetime import datetime, timedelta
import gzip
import io
import json
import re
import zipfile
from pathlib import Path
from typing import Any, Literal

import duckdb
from pydantic import BaseModel, Field

from backend.cases.schemas import PreparedCase
from backend.cases.source_ecg_index import load_ecg_source_index
from backend.cases.source_gaps import SourceResultGap, build_source_gap_report
from backend.orders.catalog import get_order


IMAGING_SIGNALS = {
    "chest_xray",
    "ct_imaging_order",
    "ct_abdomen_pelvis_with_contrast",
    "ultrasound_order",
    "ultrasound_ruq",
}
TEXT_COLUMNS = ("text", "report", "report_text", "report_snippet", "impression", "findings")
LAB_ORDER_LABELS = {
    "bmp": (
        "sodium",
        "potassium",
        "chloride",
        "bicarbonate",
        "carbon dioxide",
        "urea nitrogen",
        "creatinine",
        "glucose",
        "calcium",
        "anion gap",
    ),
    "lft": (
        "alanine aminotransferase",
        "alt",
        "aspartate aminotransferase",
        "ast",
        "alkaline phosphatase",
        "bilirubin",
        "albumin",
    ),
    "lipase": ("lipase",),
    "troponin": ("troponin",),
}
ECG_VALUE_FIELDS = (
    ("heart_rate", "ECG heart rate", "bpm"),
    ("rr_interval", "RR interval", "ms"),
    ("qrs_duration", "QRS duration", "ms"),
    ("qtc", "QTc", "ms"),
)
ECG_HEADER_WINDOW_HOURS = 24
CXR_METADATA_WINDOW_HOURS = 24


class SourceProbeCandidate(BaseModel):
    signal: str
    order_id: str
    candidate_order_ids: list[str] = Field(default_factory=list)
    source: str
    source_reference: dict[str, Any] = Field(default_factory=dict)
    narrative: str
    values: list[dict[str, Any]] = Field(default_factory=list)
    match_reason: str
    encounter_link_status: Literal["encounter_linked", "subject_only"] = "encounter_linked"
    requires_manual_verification: bool = False


class SourceInventoryItem(BaseModel):
    module: str
    status: Literal["present", "missing", "skipped"]
    path: str | None = None
    expected_paths: list[str] = Field(default_factory=list)
    detail: str


class SourceProbeReport(BaseModel):
    case_id: str
    source_identifiers: dict[str, Any] = Field(default_factory=dict)
    source_root: str | None = None
    detected_source_dirs: dict[str, str] = Field(default_factory=dict)
    source_inventory: list[SourceInventoryItem] = Field(default_factory=list)
    checked_paths: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    candidates: list[SourceProbeCandidate] = Field(default_factory=list)
    unresolved_release_blocking_results: list[dict[str, Any]] = Field(default_factory=list)
    supplemental_results_payload: dict[str, Any] = Field(default_factory=dict)


def build_source_probe_report(
    case: PreparedCase,
    *,
    source_root: Path | None = None,
    mimic_hosp_dir: Path | None = None,
    mimic_note_dir: Path | None = None,
    mimic_cxr_dir: Path | None = None,
    mimic_ecg_dir: Path | None = None,
    ecg_index: dict[str, list[dict[str, Any]]] | None = None,
    limit: int = 5,
    probe_labs: bool = True,
    probe_ecg: bool = True,
) -> SourceProbeReport:
    gap_report = build_source_gap_report(case)
    gaps = [gap for gap in gap_report.missing_documented_order_results if gap.signal in IMAGING_SIGNALS]
    checked_paths: list[str] = []
    notes: list[str] = []
    candidates: list[SourceProbeCandidate] = []
    detected_source_dirs: dict[str, str] = {}

    scan_ecg_source = probe_ecg and ecg_index is None
    if source_root:
        detected = _detect_source_dirs(source_root.expanduser(), include_ecg=scan_ecg_source)
        detected_source_dirs = {key: str(path) for key, path in detected.items()}
        mimic_hosp_dir = mimic_hosp_dir or detected.get("mimic_hosp_dir")
        mimic_note_dir = mimic_note_dir or detected.get("mimic_note_dir")
        mimic_cxr_dir = mimic_cxr_dir or detected.get("mimic_cxr_dir")
        mimic_ecg_dir = mimic_ecg_dir or detected.get("mimic_ecg_dir")
        if detected_source_dirs:
            notes.append(
                "Auto-detected local source directories from source root: "
                + ", ".join(f"{key}={value}" for key, value in sorted(detected_source_dirs.items()))
                + "."
            )
        else:
            notes.append(f"No MIMIC source tables were auto-detected under source root {source_root}.")

    if not gaps:
        notes.append("No missing documented imaging result signals are present for this case.")

    if mimic_hosp_dir and probe_labs:
        labevents_path, d_labitems_path = _lab_table_paths(mimic_hosp_dir.expanduser())
        if labevents_path and d_labitems_path:
            checked_paths.extend([str(labevents_path), str(d_labitems_path)])
            candidates.extend(_probe_lab_tables(case, labevents_path, d_labitems_path, limit))
        else:
            notes.append(f"MIMIC-IV hosp labevents and d_labitems tables were not both found under {mimic_hosp_dir}.")
    elif mimic_hosp_dir and not probe_labs:
        notes.append("MIMIC-IV hosp lab probing was skipped for this source probe run.")

    if mimic_note_dir:
        note_path = _radiology_table_path(mimic_note_dir.expanduser())
        if note_path:
            checked_paths.append(str(note_path))
            if _is_zip_path(note_path):
                candidates.extend(_probe_radiology_zip(case, gaps, note_path, limit))
            else:
                candidates.extend(_probe_radiology_table(case, gaps, note_path, limit))
        else:
            notes.append(f"MIMIC-IV-Note radiology table was not found under {mimic_note_dir}.")

    if mimic_cxr_dir:
        cxr_report_path = _cxr_report_table_path(mimic_cxr_dir.expanduser())
        cxr_metadata_path = _cxr_metadata_table_path(mimic_cxr_dir.expanduser())
        if not cxr_metadata_path and source_root:
            cxr_metadata_path = _cxr_metadata_table_path(source_root.expanduser())
        raw_reports_dir = _cxr_raw_reports_dir(mimic_cxr_dir.expanduser())
        if cxr_report_path:
            checked_paths.append(str(cxr_report_path))
            if cxr_metadata_path:
                checked_paths.append(str(cxr_metadata_path))
            candidates.extend(_probe_cxr_report_table(case, gaps, cxr_report_path, limit, cxr_metadata_path))
        elif raw_reports_dir:
            checked_paths.append(str(raw_reports_dir))
            if cxr_metadata_path:
                checked_paths.append(str(cxr_metadata_path))
            candidates.extend(_probe_raw_cxr_reports(case, gaps, raw_reports_dir, limit, cxr_metadata_path))
        else:
            notes.append(f"MIMIC-CXR report CSV or raw report folder was not found under {mimic_cxr_dir}.")

    if ecg_index is not None and probe_ecg:
        index_candidates = _probe_ecg_index_rows(case, ecg_index, limit)
        candidates.extend(index_candidates)
        checked_paths.extend(
            sorted(
                {
                    str(row.get("source_file"))
                    for rows in ecg_index.values()
                    for row in rows
                    if row.get("source_file")
                }
            )
        )
        if index_candidates:
            notes.append("Prebuilt ECG source index supplied MIMIC-IV-ECG machine measurement candidates.")
        else:
            notes.append("Prebuilt ECG source index did not contain usable rows for this case subject.")
    elif mimic_ecg_dir and probe_ecg:
        record_path, measurement_path = _ecg_table_paths(mimic_ecg_dir.expanduser())
        if measurement_path:
            checked_paths.append(str(measurement_path))
            candidates.extend(_probe_ecg_measurement_table(case, measurement_path, limit))
        else:
            notes.append(f"MIMIC-IV-ECG machine_measurements table was not found under {mimic_ecg_dir}.")
            waveform_candidates = _probe_ecg_waveform_headers(case, mimic_ecg_dir.expanduser(), limit)
            if waveform_candidates:
                checked_paths.append(str(mimic_ecg_dir.expanduser()))
                candidates.extend(waveform_candidates)
                notes.append(
                    "ECG waveform headers were found for this subject but were excluded from supplemental_results_payload; "
                    "a waveform header alone is not a machine interpretation or clinician-read ECG result."
                )
        if record_path:
            checked_paths.append(str(record_path))
        else:
            notes.append(f"MIMIC-IV-ECG record-list table was not found under {mimic_ecg_dir}.")
    elif mimic_ecg_dir and not probe_ecg:
        notes.append("MIMIC-IV-ECG probing was skipped for this source probe run.")

    if not mimic_hosp_dir and not mimic_note_dir and not mimic_cxr_dir and not mimic_ecg_dir:
        notes.append("No local source directories were provided or detected; pass --source-root, --mimic-hosp-dir, --mimic-note-dir, --mimic-cxr-dir, and/or --mimic-ecg-dir.")

    if (gaps or (mimic_hosp_dir and probe_labs) or mimic_ecg_dir) and not candidates:
        notes.append("No candidate source report/result text or ECG machine measurements were found for this case.")

    source_inventory = _build_source_inventory(
        source_root=source_root.expanduser() if source_root else None,
        mimic_hosp_dir=mimic_hosp_dir.expanduser() if mimic_hosp_dir else None,
        mimic_note_dir=mimic_note_dir.expanduser() if mimic_note_dir else None,
        mimic_cxr_dir=mimic_cxr_dir.expanduser() if mimic_cxr_dir else None,
        mimic_ecg_dir=mimic_ecg_dir.expanduser() if mimic_ecg_dir else None,
        probe_labs=probe_labs,
        probe_ecg=scan_ecg_source,
    )

    auto_apply_candidates = [
        candidate for candidate in candidates if not candidate.requires_manual_verification
    ]
    if any(candidate.requires_manual_verification for candidate in candidates):
        notes.append(
            "Subject-only report candidates were excluded from supplemental_results_payload; verify encounter timing before applying them."
        )

    payload = {
        "case_id": case.case_id,
        "replace_existing": False,
        "results": _supplemental_results_from_candidates(auto_apply_candidates),
    }
    unresolved = _unresolved_release_blocking_results(
        gap_report.release_blocking_missing_results,
        auto_apply_candidates,
        checked_paths,
        notes,
        source_inventory,
    )
    return SourceProbeReport(
        case_id=case.case_id,
        source_identifiers=dict(case.source_evidence_audit.source_identifiers),
        source_root=str(source_root.expanduser()) if source_root else None,
        detected_source_dirs=detected_source_dirs,
        source_inventory=source_inventory,
        checked_paths=checked_paths,
        notes=notes,
        candidates=candidates,
        unresolved_release_blocking_results=unresolved,
        supplemental_results_payload=payload,
    )


def _unresolved_release_blocking_results(
    release_blocking: list[dict[str, Any]],
    auto_apply_candidates: list[SourceProbeCandidate],
    checked_paths: list[str],
    notes: list[str],
    source_inventory: list[SourceInventoryItem],
) -> list[dict[str, Any]]:
    unresolved: list[dict[str, Any]] = []
    inventory_by_module = {item.module: item for item in source_inventory}
    for blocker in release_blocking:
        if any(_candidate_resolves_blocker(candidate, blocker) for candidate in auto_apply_candidates):
            continue
        missing_modules = _missing_local_source_modules(blocker, inventory_by_module)
        unresolved.append(
            {
                "signal": blocker.get("signal"),
                "candidate_order_ids": blocker.get("candidate_order_ids", []),
                "required_source_modules": blocker.get("required_source_modules", []),
                "documented_order_details": blocker.get("documented_order_details", []),
                "local_lookup_hints": blocker.get("local_lookup_hints", []),
                "operator_queries": blocker.get("operator_queries", []),
                "acceptance_criteria": blocker.get("acceptance_criteria", []),
                "supplemental_result_template": blocker.get("supplemental_result_template", {}),
                "checked_paths": list(checked_paths),
                "missing_local_source_modules": missing_modules,
                "localized_operator_queries": _localized_operator_queries(blocker, missing_modules),
                "notes": list(notes),
                "blocking_reason": (
                    "No encounter-linked, auto-applicable source result was found for this release-blocking "
                    "documented order signal in the provided local source directories."
                ),
                "operator_action": blocker.get("operator_action"),
            }
        )
    return unresolved


def _candidate_resolves_blocker(candidate: SourceProbeCandidate, blocker: dict[str, Any]) -> bool:
    candidate_order_ids = set(blocker.get("candidate_order_ids") or [])
    signal = str(blocker.get("signal") or "")
    return candidate.order_id in candidate_order_ids or (signal and candidate.signal == signal)


def _missing_local_source_modules(
    blocker: dict[str, Any],
    inventory_by_module: dict[str, SourceInventoryItem],
) -> list[dict[str, Any]]:
    required: list[str] = []
    signal = str(blocker.get("signal") or "")
    candidate_order_ids = set(blocker.get("candidate_order_ids") or [])
    if signal in {"ct_imaging_order", "ct_abdomen_pelvis_with_contrast", "ultrasound_ruq"} or (
        candidate_order_ids & {"ct_abdomen_pelvis_with_contrast", "ultrasound_ruq"}
    ):
        required.append("mimic_iv_note_radiology")
    if signal == "ecg_12_lead" or "ecg_12_lead" in candidate_order_ids:
        required.append("mimic_iv_ecg_machine_measurements")

    missing: list[dict[str, Any]] = []
    for module in required:
        item = inventory_by_module.get(module)
        if not item or item.status != "present":
            missing.append(
                {
                    "module": module,
                    "status": item.status if item else "missing",
                    "detail": item.detail if item else "Required source module was not found in the local source inventory.",
                    "expected_paths": list(item.expected_paths) if item else [],
                }
            )
    return missing


def _localized_operator_queries(blocker: dict[str, Any], missing_modules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    replacements = _operator_query_path_replacements(missing_modules)
    if not replacements:
        return []
    localized: list[dict[str, Any]] = []
    for query in blocker.get("operator_queries") or []:
        if not isinstance(query, dict):
            continue
        updated = dict(query)
        changed = False
        for field in ("path_hint", "sql", "command"):
            value = updated.get(field)
            if not isinstance(value, str):
                continue
            replaced = value
            for old, new in replacements.items():
                replaced = replaced.replace(old, new)
            if replaced != value:
                updated[field] = replaced
                changed = True
        if changed:
            updated["localized_from_source_root"] = True
            localized.append(updated)
    return localized


def _operator_query_path_replacements(missing_modules: list[dict[str, Any]]) -> dict[str, str]:
    by_module = {str(item.get("module") or ""): item for item in missing_modules}
    replacements: dict[str, str] = {}

    note_path = _first_expected_path(by_module.get("mimic_iv_note_radiology"), "radiology.csv")
    if note_path:
        sql_path = _sql_friendly_path(note_path)
        replacements["D:/physionet/mimic-iv-note/note/radiology.csv.gz"] = sql_path
        replacements["D:/physionet/mimic-iv-note/note/radiology.csv"] = sql_path

    cxr_metadata_path = _first_expected_path(by_module.get("mimic_cxr_metadata"), "metadata")
    if cxr_metadata_path:
        sql_path = _sql_friendly_path(cxr_metadata_path)
        replacements["D:/physionet/mimic-cxr-jpg/mimic-cxr-2.0.0-metadata.csv.gz"] = sql_path
        replacements["D:/physionet/mimic-cxr-jpg/mimic-cxr-2.0.0-metadata.csv"] = sql_path

    ecg_measurement_path = _first_expected_path(by_module.get("mimic_iv_ecg_machine_measurements"), "machine_measurements")
    if ecg_measurement_path:
        sql_path = _sql_friendly_path(ecg_measurement_path)
        replacements["D:/physionet/mimic-iv-ecg/machine_measurements.csv.gz"] = sql_path
        replacements["D:/physionet/mimic-iv-ecg/machine_measurements.csv"] = sql_path
    return replacements


def _first_expected_path(module_item: dict[str, Any] | None, contains: str) -> str | None:
    if not module_item:
        return None
    for path in module_item.get("expected_paths") or []:
        text = str(path)
        if contains.lower() in text.lower() and _is_concrete_local_path(text):
            return text
    return None


def _is_concrete_local_path(path: str) -> bool:
    text = str(path)
    return bool(re.match(r"^[A-Za-z]:[\\/]", text) or text.startswith("/") or text.startswith("\\\\"))


def _sql_friendly_path(path: str) -> str:
    return str(path).replace("\\", "/")


def _supplemental_results_from_candidates(candidates: list[SourceProbeCandidate]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    seen_order_ids: set[str] = set()
    for candidate in candidates:
        if candidate.order_id in seen_order_ids:
            continue
        seen_order_ids.add(candidate.order_id)
        results.append(
            {
                "order_id": candidate.order_id,
                "source": candidate.source,
                "source_reference": candidate.source_reference,
                "narrative": candidate.narrative,
                "values": candidate.values,
            }
        )
    return results


def _probe_radiology_table(case: PreparedCase, gaps: list[SourceResultGap], table_path: Path, limit: int) -> list[SourceProbeCandidate]:
    candidates: list[SourceProbeCandidate] = []
    for gap in gaps:
        rows = _query_radiology_rows_for_gap(case, gap, table_path, limit)
        for row in rows:
            narrative = _compact_text(row.get("narrative"))
            if not narrative or not _matches_signal(gap.signal, narrative):
                continue
            order_id = _infer_order_id(gap.signal, narrative, gap.candidate_order_ids)
            if not order_id:
                continue
            candidates.append(
                SourceProbeCandidate(
                    signal=gap.signal,
                    order_id=order_id,
                    candidate_order_ids=gap.candidate_order_ids,
                    source="MIMIC-IV-Note radiology",
                    source_reference=_source_reference(case, gap, row),
                    narrative=narrative,
                    match_reason="Matched local MIMIC-IV-Note radiology text by case hadm_id/subject_id and imaging signal terms.",
                )
            )
    return _dedupe_candidates(candidates)


def _probe_radiology_zip(case: PreparedCase, gaps: list[SourceResultGap], zip_path: Path, limit: int) -> list[SourceProbeCandidate]:
    member = _radiology_zip_member(zip_path)
    if not member:
        return []
    candidates: list[SourceProbeCandidate] = []
    for gap in gaps:
        rows = _query_radiology_rows_from_zip_for_gap(case, gap, zip_path, member, limit)
        for row in rows:
            narrative = _compact_text(row.get("narrative"))
            if not narrative or not _matches_signal(gap.signal, narrative):
                continue
            order_id = _infer_order_id(gap.signal, narrative, gap.candidate_order_ids)
            if not order_id:
                continue
            candidates.append(
                SourceProbeCandidate(
                    signal=gap.signal,
                    order_id=order_id,
                    candidate_order_ids=gap.candidate_order_ids,
                    source="MIMIC-IV-Note radiology",
                    source_reference=_source_reference(case, gap, row),
                    narrative=narrative,
                    match_reason="Matched zipped MIMIC-IV-Note radiology text by case identifiers and imaging signal terms.",
                )
            )
    return _dedupe_candidates(candidates)


def _probe_lab_tables(case: PreparedCase, labevents_path: Path, d_labitems_path: Path, limit: int) -> list[SourceProbeCandidate]:
    target_order_ids = [
        order_id
        for order_id in ("bmp", "lft", "lipase", "troponin")
        if order_id not in case.result_bundles and get_order(order_id) is not None
    ]
    if not target_order_ids:
        return []
    rows = _query_lab_rows(case, labevents_path, d_labitems_path, target_order_ids, limit)
    candidates: list[SourceProbeCandidate] = []
    for order_id in target_order_ids:
        values = _lab_values_for_order(rows, order_id)
        if not values:
            continue
        order = get_order(order_id)
        candidates.append(
            SourceProbeCandidate(
                signal=order_id,
                order_id=order_id,
                candidate_order_ids=[order_id],
                source="MIMIC-IV hosp.labevents",
                source_reference=_lab_source_reference(case, rows, order_id, labevents_path, d_labitems_path),
                narrative=f"Source-recorded values for {order.name if order else order_id}.",
                values=values,
                match_reason="Matched local MIMIC-IV hosp.labevents by subject_id and charttime inside the ED stay.",
            )
        )
    return candidates


def _query_lab_rows(
    case: PreparedCase,
    labevents_path: Path,
    d_labitems_path: Path,
    target_order_ids: list[str],
    limit: int,
) -> list[dict[str, Any]]:
    identifiers = case.source_evidence_audit.source_identifiers
    subject_id = _clean_identifier(identifiers.get("subject_id"))
    if not subject_id:
        return []
    label_filters = sorted({needle for order_id in target_order_ids for needle in LAB_ORDER_LABELS.get(order_id, ())})
    if not label_filters:
        return []
    label_regex = "|".join(re.escape(label) for label in label_filters)
    with duckdb.connect(database=":memory:") as con:
        lab_cols = _table_columns(con, labevents_path)
        item_cols = _table_columns(con, d_labitems_path)
        if not {"subject_id", "itemid", "charttime"} <= lab_cols or "itemid" not in item_cols or "label" not in item_cols:
            return []
        filters = [
            f"TRY_CAST(l.subject_id AS BIGINT) = {int(subject_id)}",
            f"REGEXP_MATCHES(LOWER(CAST(d.label AS VARCHAR)), {_sql_string(label_regex)})",
        ]
        if "fluid" in item_cols:
            filters.append("LOWER(COALESCE(CAST(d.fluid AS VARCHAR), '')) = 'blood'")
        time_filter = _lab_time_filter(case, "l")
        if time_filter:
            filters.append(time_filter)
        else:
            hadm_id = _clean_identifier(identifiers.get("hadm_id"))
            if hadm_id and "hadm_id" in lab_cols:
                filters.append(f"TRY_CAST(l.hadm_id AS BIGINT) = {int(hadm_id)}")
        query = f"""
            SELECT
              {_select(lab_cols, "l", "subject_id")},
              {_select(lab_cols, "l", "hadm_id")},
              {_select(lab_cols, "l", "specimen_id")},
              {_select(lab_cols, "l", "itemid")},
              {_select(lab_cols, "l", "charttime", cast="TIMESTAMP")},
              {_select(lab_cols, "l", "storetime", cast="TIMESTAMP")},
              d.label AS label,
              {_select(item_cols, "d", "fluid")},
              {_select(item_cols, "d", "category")},
              {_select(lab_cols, "l", "value")},
              {_select(lab_cols, "l", "valuenum")},
              {_select(lab_cols, "l", "valueuom")},
              {_select(lab_cols, "l", "flag")},
              {_select(lab_cols, "l", "ref_range_lower")},
              {_select(lab_cols, "l", "ref_range_upper")}
            FROM {_read_csv_sql(labevents_path)} l
            JOIN {_read_csv_sql(d_labitems_path)} d USING(itemid)
            WHERE {" AND ".join(filters)}
            ORDER BY TRY_CAST(l.charttime AS TIMESTAMP), d.label
            LIMIT {max(20, limit * 25)}
        """
        return _fetch_records(con, query)


def _lab_time_filter(case: PreparedCase, alias: str) -> str | None:
    identifiers = case.source_evidence_audit.source_identifiers
    intime = _clean_identifier(identifiers.get("intime"))
    outtime = _clean_identifier(identifiers.get("outtime"))
    if not intime or not outtime:
        return None
    return (
        f"TRY_CAST({alias}.charttime AS TIMESTAMP) BETWEEN "
        f"TRY_CAST({_sql_string(intime)} AS TIMESTAMP) "
        f"AND TRY_CAST({_sql_string(outtime)} AS TIMESTAMP)"
    )


def _lab_values_for_order(rows: list[dict[str, Any]], order_id: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    values: list[dict[str, Any]] = []
    for row in rows:
        label = _clean_identifier(row.get("label"))
        normalized = _normalize_label(label)
        if not label or normalized in seen:
            continue
        if not any(needle in normalized for needle in LAB_ORDER_LABELS.get(order_id, ())):
            continue
        value = _display_lab_value(row)
        if value is None:
            continue
        seen.add(normalized)
        values.append(
            {
                "name": label,
                "value": value,
                "unit": _clean_optional(row.get("valueuom")),
                "flag": _lab_result_flag(row),
                "reference_range": _lab_reference_range(row),
            }
        )
    return values


def _lab_rows_for_order(rows: list[dict[str, Any]], order_id: str) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        label = _clean_identifier(row.get("label"))
        normalized = _normalize_label(label)
        if not label or normalized in seen:
            continue
        if not any(needle in normalized for needle in LAB_ORDER_LABELS.get(order_id, ())):
            continue
        if _display_lab_value(row) is None:
            continue
        seen.add(normalized)
        selected.append(row)
    return selected


def _lab_source_reference(
    case: PreparedCase,
    rows: list[dict[str, Any]],
    order_id: str,
    labevents_path: Path,
    d_labitems_path: Path,
) -> dict[str, Any]:
    identifiers = case.source_evidence_audit.source_identifiers
    reference: dict[str, Any] = {
        "source_file": str(labevents_path),
        "dictionary_file": str(d_labitems_path),
        "match_basis": "subject_id plus charttime inside ED stay",
        "rows": [_compact_lab_row_reference(row) for row in _lab_rows_for_order(rows, order_id)],
    }
    for key in ("subject_id", "stay_id", "intime", "outtime"):
        value = identifiers.get(key)
        if value not in (None, ""):
            reference[key] = value
    hadm_id = identifiers.get("hadm_id")
    if hadm_id not in (None, ""):
        reference["case_hadm_id"] = hadm_id
    return reference


def _compact_lab_row_reference(row: dict[str, Any]) -> dict[str, Any]:
    return {
        key: row[key]
        for key in (
            "subject_id",
            "hadm_id",
            "specimen_id",
            "itemid",
            "label",
            "charttime",
            "storetime",
            "fluid",
            "category",
        )
        if row.get(key) not in (None, "")
    }


def _display_lab_value(row: dict[str, Any]) -> str | None:
    value = _clean_optional(row.get("value"))
    numeric = _clean_optional(row.get("valuenum"))
    if value and value != "___":
        return value
    if numeric:
        return numeric
    return None


def _lab_result_flag(row: dict[str, Any]) -> str | None:
    raw_flag = _clean_optional(row.get("flag"))
    if raw_flag in {"low", "normal", "high", "critical", "abnormal"}:
        return raw_flag
    numeric = _number(row.get("valuenum"))
    lower = _number(row.get("ref_range_lower"))
    upper = _number(row.get("ref_range_upper"))
    if numeric is None:
        return None
    if lower is not None and numeric < lower:
        return "low"
    if upper is not None and numeric > upper:
        return "high"
    if lower is not None or upper is not None:
        return "normal"
    return None


def _lab_reference_range(row: dict[str, Any]) -> str | None:
    lower = _clean_optional(row.get("ref_range_lower"))
    upper = _clean_optional(row.get("ref_range_upper"))
    if lower and upper:
        return f"{lower}-{upper}"
    return lower or upper


def _probe_cxr_report_table(
    case: PreparedCase,
    gaps: list[SourceResultGap],
    table_path: Path,
    limit: int,
    metadata_path: Path | None = None,
) -> list[SourceProbeCandidate]:
    if not any(gap.signal == "chest_xray" for gap in gaps):
        return []
    gap = _gap_by_signal(gaps, "chest_xray")
    rows = _query_cxr_rows(case, table_path, limit, gap, metadata_path)
    return [
        SourceProbeCandidate(
            signal="chest_xray",
            order_id="chest_xray",
            candidate_order_ids=["chest_xray"],
            source="MIMIC-CXR report+metadata" if _is_cxr_encounter_linked(row) else "MIMIC-CXR",
            source_reference=_source_reference(case, gap, row),
            narrative=_compact_text(row.get("narrative")),
            match_reason=_cxr_match_reason(row, "report table"),
            encounter_link_status="encounter_linked" if _is_cxr_encounter_linked(row) else "subject_only",
            requires_manual_verification=not _is_cxr_encounter_linked(row),
        )
        for row in rows
        if _compact_text(row.get("narrative"))
    ]


def _probe_raw_cxr_reports(
    case: PreparedCase,
    gaps: list[SourceResultGap],
    raw_reports_dir: Path,
    limit: int,
    metadata_path: Path | None = None,
) -> list[SourceProbeCandidate]:
    if not any(gap.signal == "chest_xray" for gap in gaps):
        return []
    subject_id = _clean_identifier(case.source_evidence_audit.source_identifiers.get("subject_id"))
    if not subject_id:
        return []
    subject_dir = raw_reports_dir / f"p{subject_id[:2]}" / f"p{subject_id}"
    if not subject_dir.is_dir():
        return []
    gap = _gap_by_signal(gaps, "chest_xray")
    report_paths = sorted(subject_dir.glob("s*.txt"))[: max(1, limit)]
    metadata_by_study = (
        _query_cxr_metadata_rows(case, metadata_path, [path.stem.removeprefix("s") for path in report_paths], gap, limit)
        if metadata_path
        else {}
    )
    candidates: list[SourceProbeCandidate] = []
    for report_path in report_paths:
        narrative = _compact_text(report_path.read_text(encoding="utf-8", errors="replace"))
        if not narrative:
            continue
        study_id = report_path.stem.removeprefix("s")
        row = {
            "subject_id": subject_id,
            "study_id": study_id,
            "source_file": str(report_path),
            **metadata_by_study.get(study_id, {}),
        }
        encounter_linked = _is_cxr_encounter_linked(row)
        candidates.append(
            SourceProbeCandidate(
                signal="chest_xray",
                order_id="chest_xray",
                candidate_order_ids=["chest_xray"],
                source="MIMIC-CXR raw text+metadata" if encounter_linked else "MIMIC-CXR raw text",
                source_reference=_source_reference(
                    case,
                    gap,
                    row,
                ),
                narrative=narrative[:2000],
                match_reason=_cxr_match_reason(row, "raw report file"),
                encounter_link_status="encounter_linked" if encounter_linked else "subject_only",
                requires_manual_verification=not encounter_linked,
            )
        )
    return candidates


def _query_radiology_rows_for_gap(case: PreparedCase, gap: SourceResultGap, table_path: Path, limit: int) -> list[dict[str, Any]]:
    with duckdb.connect(database=":memory:") as con:
        cols = _table_columns(con, table_path)
        text_col = _first_present(cols, TEXT_COLUMNS)
        if not text_col:
            return []
        filters = _identifier_filters(case, cols, "r")
        if not filters:
            return []
        text_filters = _radiology_text_filters(gap.signal, "r", text_col)
        if text_filters:
            filters.append(f"({' OR '.join(text_filters)})")
        ordertime = _gap_ordertime(gap)
        order_expr = _radiology_order_expression(cols, "r", ordertime)
        distance_expr = _radiology_distance_expression(cols, "r", ordertime)
        query = f"""
            SELECT
              {_select(cols, "r", "note_id")},
              {_select(cols, "r", "subject_id")},
              {_select(cols, "r", "hadm_id")},
              {_select(cols, "r", "charttime", cast="TIMESTAMP")},
              {_select(cols, "r", "storetime", cast="TIMESTAMP")},
              {distance_expr} AS match_distance_seconds,
              SUBSTR(CAST(r.{text_col} AS VARCHAR), 1, 2000) AS narrative
            FROM {_read_csv_sql(table_path)} r
            WHERE {" AND ".join(filters)}
            ORDER BY {order_expr}
            LIMIT {max(1, limit)}
        """
        return _fetch_records(con, query)


def _query_radiology_rows_from_zip_for_gap(
    case: PreparedCase,
    gap: SourceResultGap,
    zip_path: Path,
    member: str,
    limit: int,
) -> list[dict[str, Any]]:
    matched: list[dict[str, Any]] = []
    with zipfile.ZipFile(zip_path) as archive:
        with archive.open(member) as raw_stream:
            stream = gzip.GzipFile(fileobj=raw_stream) if member.lower().endswith(".gz") else raw_stream
            text_stream = io.TextIOWrapper(stream, encoding="utf-8", errors="replace", newline="")
            reader = csv.DictReader(text_stream)
            text_col = _first_present(set(reader.fieldnames or []), TEXT_COLUMNS)
            if not text_col:
                return []
            for row in reader:
                if not _radiology_zip_row_matches_case(row, case):
                    continue
                narrative = _compact_text(row.get(text_col))
                if not narrative or not _matches_signal(gap.signal, narrative):
                    continue
                ordertime = _gap_ordertime(gap)
                matched.append(
                    {
                        "note_id": row.get("note_id"),
                        "subject_id": row.get("subject_id"),
                        "hadm_id": row.get("hadm_id"),
                        "charttime": row.get("charttime"),
                        "storetime": row.get("storetime"),
                        "match_distance_seconds": _time_distance_seconds(row.get("charttime"), ordertime),
                        "source_file": str(zip_path),
                        "source_member": member,
                        "narrative": narrative[:2000],
                    }
                )
    matched.sort(key=lambda row: _sort_distance(row.get("match_distance_seconds")))
    return matched[: max(1, limit)]


def _query_cxr_rows(
    case: PreparedCase,
    table_path: Path,
    limit: int,
    gap: SourceResultGap,
    metadata_path: Path | None = None,
) -> list[dict[str, Any]]:
    with duckdb.connect(database=":memory:") as con:
        cols = _table_columns(con, table_path)
        text_col = _first_present(cols, TEXT_COLUMNS)
        if not text_col or "subject_id" not in cols:
            return []
        subject_id = _clean_identifier(case.source_evidence_audit.source_identifiers.get("subject_id"))
        if not subject_id:
            return []
        metadata_join = ""
        metadata_select = "NULL AS charttime, NULL AS match_distance_seconds, NULL AS metadata_file"
        metadata_order = "c.study_id"
        metadata_filter = ""
        if metadata_path:
            meta_cols = _table_columns(con, metadata_path)
            study_col = _column_named(cols, "study_id")
            meta_study_col = _column_named(meta_cols, "study_id")
            meta_subject_col = _column_named(meta_cols, "subject_id")
            study_time_expr = _cxr_study_time_expression(meta_cols, "m")
            ordertime = _gap_ordertime(gap)
            if study_col and meta_study_col and meta_subject_col and study_time_expr and ordertime:
                distance_expr = _cxr_distance_expression(study_time_expr, ordertime)
                metadata_join = (
                    f"LEFT JOIN {_read_csv_sql(metadata_path)} m "
                    f"ON TRY_CAST(c.{study_col} AS BIGINT) = TRY_CAST(m.{meta_study_col} AS BIGINT) "
                    f"AND TRY_CAST(c.subject_id AS BIGINT) = TRY_CAST(m.{meta_subject_col} AS BIGINT)"
                )
                metadata_select = (
                    f"{study_time_expr} AS charttime, {distance_expr} AS match_distance_seconds, "
                    f"{_sql_string(str(metadata_path))} AS metadata_file"
                )
                metadata_order = f"COALESCE({distance_expr}, 999999999), c.study_id"
                metadata_filter = (
                    f" AND ({study_time_expr} BETWEEN "
                    f"TRY_CAST({_sql_string(ordertime)} AS TIMESTAMP) - INTERVAL '{CXR_METADATA_WINDOW_HOURS} hours' "
                    f"AND TRY_CAST({_sql_string(ordertime)} AS TIMESTAMP) + INTERVAL '{CXR_METADATA_WINDOW_HOURS} hours' "
                    f"OR {study_time_expr} IS NULL)"
                )
        query = f"""
            SELECT DISTINCT
              {_select(cols, "c", "subject_id")},
              {_select(cols, "c", "study_id")},
              {metadata_select},
              {_sql_string(str(table_path))} AS source_file,
              SUBSTR(CAST(c.{text_col} AS VARCHAR), 1, 2000) AS narrative
            FROM {_read_csv_sql(table_path)} c
            {metadata_join}
            WHERE TRY_CAST(c.subject_id AS BIGINT) = {int(subject_id)}
            {metadata_filter}
            ORDER BY {metadata_order}
            LIMIT {max(1, limit)}
        """
        return _fetch_records(con, query)


def _query_cxr_metadata_rows(
    case: PreparedCase,
    metadata_path: Path,
    study_ids: list[str],
    gap: SourceResultGap,
    limit: int,
) -> dict[str, dict[str, Any]]:
    if not study_ids:
        return {}
    subject_id = _clean_identifier(case.source_evidence_audit.source_identifiers.get("subject_id"))
    ordertime = _gap_ordertime(gap)
    if not subject_id or not ordertime:
        return {}
    with duckdb.connect(database=":memory:") as con:
        cols = _table_columns(con, metadata_path)
        subject_col = _column_named(cols, "subject_id")
        study_col = _column_named(cols, "study_id")
        study_time_expr = _cxr_study_time_expression(cols, "m")
        if not subject_col or not study_col or not study_time_expr:
            return {}
        study_filter = ", ".join(str(int(study_id)) for study_id in study_ids if study_id.isdigit())
        if not study_filter:
            return {}
        distance_expr = _cxr_distance_expression(study_time_expr, ordertime)
        query = f"""
            SELECT
              TRY_CAST(m.{subject_col} AS BIGINT) AS subject_id,
              TRY_CAST(m.{study_col} AS BIGINT) AS study_id,
              {study_time_expr} AS charttime,
              {distance_expr} AS match_distance_seconds,
              {_sql_string(str(metadata_path))} AS metadata_file
            FROM {_read_csv_sql(metadata_path)} m
            WHERE TRY_CAST(m.{subject_col} AS BIGINT) = {int(subject_id)}
              AND TRY_CAST(m.{study_col} AS BIGINT) IN ({study_filter})
              AND {study_time_expr} BETWEEN
                TRY_CAST({_sql_string(ordertime)} AS TIMESTAMP) - INTERVAL '{CXR_METADATA_WINDOW_HOURS} hours'
                AND TRY_CAST({_sql_string(ordertime)} AS TIMESTAMP) + INTERVAL '{CXR_METADATA_WINDOW_HOURS} hours'
            ORDER BY {distance_expr}
            LIMIT {max(1, limit)}
        """
        rows = _fetch_records(con, query)
    by_study: dict[str, dict[str, Any]] = {}
    for row in rows:
        study_id = _clean_identifier(row.get("study_id"))
        if study_id and study_id not in by_study:
            by_study[study_id] = row
    return by_study


def _probe_ecg_measurement_table(case: PreparedCase, table_path: Path, limit: int) -> list[SourceProbeCandidate]:
    if "ecg_12_lead" in case.result_bundles:
        return []
    rows = _query_ecg_measurement_rows(case, table_path, limit, require_time_window=True)
    requires_manual_verification = False
    match_reason = "Matched local MIMIC-IV-ECG machine measurements by case subject_id and ED encounter time window."
    if not rows:
        rows = _query_ecg_measurement_rows(case, table_path, limit, require_time_window=False)
        requires_manual_verification = True
        match_reason = (
            "Matched local MIMIC-IV-ECG machine measurements by subject_id, but ECG time is outside the "
            "ED encounter window or cannot be encounter-linked."
        )
    candidates: list[SourceProbeCandidate] = []
    for row in rows:
        values = _ecg_values(row)
        narrative = _compact_text(row.get("machine_report"))
        if not narrative and values:
            narrative = "Source ECG machine measurements are available."
        if not narrative and not values:
            continue
        candidates.append(
            SourceProbeCandidate(
                signal="ecg_12_lead",
                order_id="ecg_12_lead",
                candidate_order_ids=["ecg_12_lead"],
                source="MIMIC-IV-ECG",
                source_reference=_ecg_source_reference(case, row),
                narrative=narrative,
                values=values,
                match_reason=match_reason,
                encounter_link_status="subject_only" if requires_manual_verification else "encounter_linked",
                requires_manual_verification=requires_manual_verification,
            )
        )
    return _dedupe_candidates(candidates)


def _probe_ecg_index_rows(
    case: PreparedCase,
    ecg_index: dict[str, list[dict[str, Any]]],
    limit: int,
) -> list[SourceProbeCandidate]:
    if "ecg_12_lead" in case.result_bundles:
        return []
    subject_id = _clean_identifier(case.source_evidence_audit.source_identifiers.get("subject_id"))
    if not subject_id:
        return []
    rows = [dict(row) for row in ecg_index.get(subject_id, []) if isinstance(row, dict)]
    if not rows:
        return []
    matching_rows = [row for row in rows if _ecg_row_in_time_window(case, row, set(row))]
    requires_manual_verification = False
    match_reason = "Matched prebuilt MIMIC-IV-ECG source index by case subject_id and ED encounter time window."
    selected_rows = matching_rows
    if not selected_rows:
        selected_rows = rows
        requires_manual_verification = True
        match_reason = (
            "Matched prebuilt MIMIC-IV-ECG source index by subject_id, but ECG time is outside the "
            "ED encounter window or cannot be encounter-linked."
        )
    selected_rows = sorted(selected_rows, key=lambda row: _sort_distance(_ecg_row_distance_seconds(case, row)))
    candidates: list[SourceProbeCandidate] = []
    for row in selected_rows[: max(1, limit)]:
        values = _ecg_values(row)
        narrative = _compact_text(row.get("machine_report"))
        if not narrative:
            narrative = _compact_text(_ecg_report_expression_from_row(row))
        if not narrative and values:
            narrative = "Source ECG machine measurements are available."
        if not narrative and not values:
            continue
        row["match_distance_seconds"] = _ecg_row_distance_seconds(case, row)
        candidates.append(
            SourceProbeCandidate(
                signal="ecg_12_lead",
                order_id="ecg_12_lead",
                candidate_order_ids=["ecg_12_lead"],
                source="MIMIC-IV-ECG",
                source_reference=_ecg_source_reference(case, row),
                narrative=narrative,
                values=values,
                match_reason=match_reason,
                encounter_link_status="subject_only" if requires_manual_verification else "encounter_linked",
                requires_manual_verification=requires_manual_verification,
            )
        )
    return _dedupe_candidates(candidates)


def _query_ecg_measurement_rows(
    case: PreparedCase,
    table_path: Path,
    limit: int,
    *,
    require_time_window: bool,
) -> list[dict[str, Any]]:
    if _is_zip_path(table_path):
        member = _ecg_measurement_zip_member(table_path)
        if not member:
            return []
        return _query_ecg_measurement_rows_from_zip(
            case,
            table_path,
            member,
            limit,
            require_time_window=require_time_window,
        )

    with duckdb.connect(database=":memory:") as con:
        cols = _table_columns(con, table_path)
        if "subject_id" not in cols:
            return []
        subject_id = _clean_identifier(case.source_evidence_audit.source_identifiers.get("subject_id"))
        if not subject_id:
            return []
        report_expr = _ecg_report_expression(cols, "e")
        filters = [f"TRY_CAST(e.subject_id AS BIGINT) = {int(subject_id)}"]
        time_filter = _ecg_time_filter(case, cols, "e") if require_time_window else None
        if require_time_window and not time_filter:
            return []
        if require_time_window and time_filter:
            filters.append(time_filter)
        order_expr = _ecg_order_expression(case, cols, "e")
        distance_expr = _ecg_distance_expression(case, cols, "e")
        select_values = [
            _select(cols, "e", "subject_id"),
            _select(cols, "e", "study_id"),
            _select(cols, "e", "ecg_time", cast="TIMESTAMP"),
            _select(cols, "e", "path"),
            _select(cols, "e", "heart_rate"),
            _select(cols, "e", "rr_interval"),
            _select(cols, "e", "qrs_duration"),
            _select(cols, "e", "qtc"),
            f"{distance_expr} AS match_distance_seconds",
            f"SUBSTR({report_expr}, 1, 1000) AS machine_report",
        ]
        query = f"""
            SELECT {", ".join(select_values)}
            FROM {_read_csv_sql(table_path)} e
            WHERE {" AND ".join(filters)}
            ORDER BY {order_expr}
            LIMIT {max(1, limit)}
        """
        return _fetch_records(con, query)


def _query_ecg_measurement_rows_from_zip(
    case: PreparedCase,
    zip_path: Path,
    member: str,
    limit: int,
    *,
    require_time_window: bool,
) -> list[dict[str, Any]]:
    subject_id = _clean_identifier(case.source_evidence_audit.source_identifiers.get("subject_id"))
    if not subject_id:
        return []
    matched: list[dict[str, Any]] = []
    with zipfile.ZipFile(zip_path) as archive:
        with archive.open(member) as raw_stream:
            stream = gzip.GzipFile(fileobj=raw_stream) if member.lower().endswith(".gz") else raw_stream
            text_stream = io.TextIOWrapper(stream, encoding="utf-8", errors="replace", newline="")
            reader = csv.DictReader(text_stream)
            cols = set(reader.fieldnames or [])
            if "subject_id" not in cols:
                return []
            report_columns = _ecg_report_columns(cols)
            for row in reader:
                if _clean_identifier(row.get("subject_id")) != subject_id:
                    continue
                if require_time_window and not _ecg_row_in_time_window(case, row, cols):
                    continue
                machine_report = _compact_text(" ".join(str(row.get(col) or "") for col in report_columns))
                matched.append(
                    {
                        "subject_id": row.get("subject_id"),
                        "study_id": row.get("study_id"),
                        "ecg_time": row.get("ecg_time"),
                        "path": row.get("path"),
                        "heart_rate": row.get("heart_rate"),
                        "rr_interval": row.get("rr_interval"),
                        "qrs_duration": row.get("qrs_duration"),
                        "qtc": row.get("qtc"),
                        "match_distance_seconds": _ecg_row_distance_seconds(case, row),
                        "machine_report": machine_report[:1000],
                        "source_file": str(zip_path),
                        "source_member": member,
                    }
                )
    matched.sort(key=lambda row: _sort_distance(row.get("match_distance_seconds")))
    return matched[: max(1, limit)]


def _probe_ecg_waveform_headers(case: PreparedCase, source: Path, limit: int) -> list[SourceProbeCandidate]:
    subject_id = _clean_identifier(case.source_evidence_audit.source_identifiers.get("subject_id"))
    if not subject_id:
        return []
    rows = _ecg_header_rows_for_subject(source, subject_id)
    if not rows:
        return []
    rows = sorted(rows, key=lambda row: _absolute_ecg_header_distance_hours(case, row))
    candidates: list[SourceProbeCandidate] = []
    for row in rows[: max(1, limit)]:
        distance_hours = _ecg_header_distance_hours(case, row)
        encounter_linked = distance_hours is not None and abs(distance_hours) <= ECG_HEADER_WINDOW_HOURS
        candidates.append(
            SourceProbeCandidate(
                signal="ecg_12_lead",
                order_id="ecg_12_lead",
                candidate_order_ids=["ecg_12_lead"],
                source="MIMIC-IV-ECG waveform header",
                source_reference=_ecg_header_source_reference(case, row, distance_hours),
                narrative=(
                    "Source ECG waveform header documents a 12-lead ECG waveform file for this subject; "
                    "no machine interpretation or clinician-read result text is present in the header."
                ),
                match_reason=(
                    "Matched MIMIC-IV-ECG waveform header by subject_id"
                    + (
                        " and timestamp near the ED encounter."
                        if encounter_linked
                        else "; timestamp is outside the ED encounter window or cannot be encounter-linked."
                    )
                ),
                encounter_link_status="encounter_linked" if encounter_linked else "subject_only",
                requires_manual_verification=True,
            )
        )
    return candidates


def _ecg_header_rows_for_subject(source: Path, subject_id: str) -> list[dict[str, Any]]:
    if source.is_file() and source.suffix.lower() == ".zip":
        return _ecg_header_rows_from_zip(source, subject_id)
    if source.is_dir():
        return _ecg_header_rows_from_dir(source, subject_id)
    return []


def _ecg_header_rows_from_zip(zip_path: Path, subject_id: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    subject_pattern = f"/p{subject_id}/"
    try:
        with zipfile.ZipFile(zip_path) as archive:
            for entry in archive.infolist():
                normalized = "/" + entry.filename.replace("\\", "/")
                if not normalized.endswith(".hea") or subject_pattern not in normalized:
                    continue
                with archive.open(entry) as stream:
                    first_line = stream.readline().decode("utf-8", errors="ignore").strip()
                parsed = _parse_ecg_header_first_line(first_line)
                if not parsed:
                    continue
                parsed.update(
                    {
                        "subject_id": subject_id,
                        "path": entry.filename,
                        "source_file": str(zip_path),
                        "header_line": first_line,
                    }
                )
                rows.append(parsed)
    except (OSError, zipfile.BadZipFile):
        return []
    return rows


def _ecg_header_rows_from_dir(root: Path, subject_id: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    subject_dirs = [path for path in root.rglob(f"p{subject_id}") if path.is_dir()]
    for subject_dir in subject_dirs:
        for header in subject_dir.rglob("*.hea"):
            try:
                first_line = header.read_text(encoding="utf-8", errors="ignore").splitlines()[0].strip()
            except (OSError, IndexError):
                continue
            parsed = _parse_ecg_header_first_line(first_line)
            if not parsed:
                continue
            parsed.update(
                {
                    "subject_id": subject_id,
                    "path": str(header),
                    "source_file": str(header),
                    "header_line": first_line,
                }
            )
            rows.append(parsed)
    return rows


def _parse_ecg_header_first_line(line: str) -> dict[str, Any] | None:
    match = re.match(
        r"^(?P<study_id>\d+)\s+\d+\s+\d+\s+\d+\s+(?P<time>\d{2}:\d{2}:\d{2})\s+(?P<day>\d{2})/(?P<month>\d{2})/(?P<year>\d{4})",
        line,
    )
    if not match:
        return None
    timestamp = f"{match.group('year')}-{match.group('month')}-{match.group('day')}T{match.group('time')}"
    return {
        "study_id": match.group("study_id"),
        "ecg_time": timestamp,
    }


def _ecg_header_distance_hours(case: PreparedCase, row: dict[str, Any]) -> float | None:
    intime = _clean_identifier(case.source_evidence_audit.source_identifiers.get("intime"))
    ecg_time = _clean_identifier(row.get("ecg_time"))
    if not intime or not ecg_time:
        return None
    try:
        return (datetime.fromisoformat(ecg_time) - datetime.fromisoformat(intime)).total_seconds() / 3600
    except ValueError:
        return None


def _absolute_ecg_header_distance_hours(case: PreparedCase, row: dict[str, Any]) -> float:
    distance = _ecg_header_distance_hours(case, row)
    return abs(distance) if distance is not None else 999999


def _ecg_header_source_reference(case: PreparedCase, row: dict[str, Any], distance_hours: float | None) -> dict[str, Any]:
    reference = {
        key: row[key]
        for key in ("subject_id", "study_id", "ecg_time", "path", "source_file", "header_line")
        if row.get(key) not in (None, "")
    }
    if distance_hours is not None:
        reference["match_distance_hours_from_ed_intime"] = round(distance_hours, 2)
    for key in ("hadm_id", "stay_id", "intime", "outtime"):
        value = case.source_evidence_audit.source_identifiers.get(key)
        if value not in (None, ""):
            reference[key] = value
    return reference


def _identifier_filters(case: PreparedCase, cols: set[str], alias: str) -> list[str]:
    identifiers = case.source_evidence_audit.source_identifiers
    filters: list[str] = []
    hadm_id = _clean_identifier(identifiers.get("hadm_id"))
    subject_id = _clean_identifier(identifiers.get("subject_id"))
    if hadm_id and "hadm_id" in cols:
        filters.append(f"TRY_CAST({alias}.hadm_id AS BIGINT) = {int(hadm_id)}")
    if subject_id and "subject_id" in cols:
        filters.append(f"TRY_CAST({alias}.subject_id AS BIGINT) = {int(subject_id)}")
    return filters


def _radiology_text_filters(signal: str, alias: str, text_col: str) -> list[str]:
    text = f"LOWER(CAST({alias}.{text_col} AS VARCHAR))"
    if signal == "chest_xray":
        return [
            f"{text} LIKE '%cxr%'",
            f"{text} LIKE '%chest x-ray%'",
            f"{text} LIKE '%chest xray%'",
            f"{text} LIKE '%chest radiograph%'",
            f"{text} LIKE '%portable chest%'",
            f"{text} LIKE '%examination: chest%'",
            f"{text} LIKE '%pa and lateral views of the chest%'",
            f"{text} LIKE '%single frontal view of the chest%'",
        ]
    if signal in {"ct_imaging_order", "ct_abdomen_pelvis_with_contrast"}:
        return [
            f"{text} LIKE '%ct abdomen%'",
            f"{text} LIKE '%ct pelvis%'",
            f"{text} LIKE '%ct abd%'",
            f"{text} LIKE '%computed tomograph%'",
            f"REGEXP_MATCHES({text}, '\\\\bct\\\\b')",
        ]
    if signal in {"ultrasound_order", "ultrasound_ruq"}:
        return [
            f"{text} LIKE '%ultrasound%'",
            f"{text} LIKE '%sonograph%'",
            f"{text} LIKE '%gallbladder%'",
        ]
    return []


def _gap_ordertime(gap: SourceResultGap) -> str | None:
    for detail in gap.documented_order_details:
        ordertime = _clean_identifier(detail.get("ordertime"))
        if ordertime:
            return ordertime
    reference = gap.supplemental_result_template.get("source_reference") or {}
    ordertime = _clean_identifier(reference.get("ordertime"))
    return ordertime or None


def _radiology_order_expression(cols: set[str], alias: str, ordertime: str | None) -> str:
    if "charttime" not in cols:
        return "1"
    if ordertime:
        return _radiology_distance_expression(cols, alias, ordertime)
    return f"TRY_CAST({alias}.charttime AS TIMESTAMP)"


def _radiology_distance_expression(cols: set[str], alias: str, ordertime: str | None) -> str:
    if "charttime" not in cols or not ordertime:
        return "NULL"
    return (
        "ABS(DATE_DIFF('second', "
        f"TRY_CAST({alias}.charttime AS TIMESTAMP), "
        f"TRY_CAST({_sql_string(ordertime)} AS TIMESTAMP)"
        "))"
    )


def _cxr_study_time_expression(cols: set[str], alias: str) -> str | None:
    direct_col = _column_named(
        cols,
        "charttime",
        "study_datetime",
        "study_date_time",
        "studydatetime",
        "performed_datetime",
    )
    if direct_col:
        return f"TRY_CAST({alias}.{direct_col} AS TIMESTAMP)"
    date_col = _column_named(cols, "studydate", "study_date", "StudyDate")
    time_col = _column_named(cols, "studytime", "study_time", "StudyTime")
    if not date_col or not time_col:
        return None
    date_digits = f"REGEXP_REPLACE(COALESCE(CAST({alias}.{date_col} AS VARCHAR), ''), '[^0-9]', '', 'g')"
    time_digits = (
        f"SUBSTR(REGEXP_REPLACE(COALESCE(CAST({alias}.{time_col} AS VARCHAR), ''), "
        "'[^0-9]', '', 'g') || '000000', 1, 6)"
    )
    timestamp_text = (
        f"SUBSTR({date_digits}, 1, 4) || '-' || SUBSTR({date_digits}, 5, 2) || '-' || "
        f"SUBSTR({date_digits}, 7, 2) || ' ' || SUBSTR({time_digits}, 1, 2) || ':' || "
        f"SUBSTR({time_digits}, 3, 2) || ':' || SUBSTR({time_digits}, 5, 2)"
    )
    return f"TRY_CAST({timestamp_text} AS TIMESTAMP)"


def _cxr_distance_expression(study_time_expr: str, ordertime: str) -> str:
    return (
        "ABS(DATE_DIFF('second', "
        f"{study_time_expr}, "
        f"TRY_CAST({_sql_string(ordertime)} AS TIMESTAMP)"
        "))"
    )


def _is_cxr_encounter_linked(row: dict[str, Any]) -> bool:
    if row.get("charttime") in (None, ""):
        return False
    distance = _number(row.get("match_distance_seconds"))
    return distance is not None and abs(distance) <= CXR_METADATA_WINDOW_HOURS * 3600


def _cxr_match_reason(row: dict[str, Any], source_kind: str) -> str:
    if _is_cxr_encounter_linked(row):
        return (
            f"Matched local MIMIC-CXR {source_kind} by subject_id, study_id, and study metadata time "
            "near the documented ED CXR order."
        )
    return (
        f"Matched local MIMIC-CXR {source_kind} by subject_id only; study timing or another encounter link is "
        "required before using this as an encounter result."
    )


def _ecg_report_expression(cols: set[str], alias: str) -> str:
    report_columns = _ecg_report_columns(cols)
    if not report_columns:
        return "NULL"
    return " || ' ' || ".join(f"COALESCE(CAST({alias}.{col} AS VARCHAR), '')" for col in report_columns)


def _ecg_report_columns(cols: set[str]) -> list[str]:
    return [
        col
        for col in sorted(cols)
        if re.fullmatch(r"report_\d+", col, flags=re.I) or col.lower() in {"report", "machine_report", "report_text"}
    ]


def _ecg_report_expression_from_row(row: dict[str, Any]) -> str:
    report_columns = _ecg_report_columns(set(row))
    return " ".join(str(row.get(col) or "") for col in report_columns)


def _ecg_time_filter(case: PreparedCase, cols: set[str], alias: str) -> str | None:
    if "ecg_time" not in cols:
        return None
    bounds = _ecg_time_bounds(case)
    if not bounds:
        return None
    lower, upper = bounds
    return (
        f"TRY_CAST({alias}.ecg_time AS TIMESTAMP) BETWEEN "
        f"TRY_CAST({_sql_string(lower.isoformat())} AS TIMESTAMP) "
        f"AND TRY_CAST({_sql_string(upper.isoformat())} AS TIMESTAMP)"
    )


def _ecg_order_expression(case: PreparedCase, cols: set[str], alias: str) -> str:
    if "ecg_time" not in cols:
        return f"{alias}.study_id" if "study_id" in cols else "1"
    distance_expr = _ecg_distance_expression(case, cols, alias)
    return f"{distance_expr}, TRY_CAST({alias}.ecg_time AS TIMESTAMP)"


def _ecg_distance_expression(case: PreparedCase, cols: set[str], alias: str) -> str:
    if "ecg_time" not in cols:
        return "NULL"
    anchor = _ecg_anchor_datetime(case)
    if not anchor:
        return "CAST(0 AS BIGINT)"
    return (
        "ABS(DATE_DIFF('second', "
        f"TRY_CAST({alias}.ecg_time AS TIMESTAMP), "
        f"TRY_CAST({_sql_string(anchor.isoformat())} AS TIMESTAMP)"
        "))"
    )


def _ecg_values(row: dict[str, Any]) -> list[dict[str, Any]]:
    values: list[dict[str, Any]] = []
    for field, label, unit in ECG_VALUE_FIELDS:
        value = _clean_identifier(row.get(field))
        if value:
            values.append({"name": label, "value": value, "unit": unit})
    return values


def _ecg_source_reference(case: PreparedCase, row: dict[str, Any]) -> dict[str, Any]:
    reference = {
        key: row[key]
        for key in ("subject_id", "study_id", "ecg_time", "path", "match_distance_seconds", "source_file", "source_member")
        if row.get(key) not in (None, "")
    }
    for key in ("subject_id", "hadm_id", "stay_id"):
        value = case.source_evidence_audit.source_identifiers.get(key)
        if value not in (None, "") and key not in reference:
            reference[key] = value
    return reference


def _ecg_row_in_time_window(case: PreparedCase, row: dict[str, Any], cols: set[str]) -> bool:
    if "ecg_time" not in cols:
        return False
    ecg_time = _parse_source_datetime(row.get("ecg_time"))
    if not ecg_time:
        return False
    bounds = _ecg_time_bounds(case)
    if not bounds:
        return False
    lower, upper = bounds
    return lower <= ecg_time <= upper


def _ecg_row_distance_seconds(case: PreparedCase, row: dict[str, Any]) -> int | None:
    anchor = _ecg_anchor_datetime(case)
    if not anchor:
        return None
    row_dt = _parse_source_datetime(row.get("ecg_time"))
    if not row_dt:
        return None
    return abs(int((row_dt - anchor).total_seconds()))


def _ecg_time_bounds(case: PreparedCase) -> tuple[datetime, datetime] | None:
    identifiers = case.source_evidence_audit.source_identifiers
    intime = _parse_source_datetime(identifiers.get("intime"))
    if intime:
        outtime = _parse_source_datetime(identifiers.get("outtime")) or intime
        return intime - timedelta(hours=6), outtime + timedelta(hours=24)
    order_times = _documented_order_datetimes(case)
    if not order_times:
        return None
    return min(order_times) - timedelta(hours=6), max(order_times) + timedelta(hours=24)


def _ecg_anchor_datetime(case: PreparedCase) -> datetime | None:
    identifiers = case.source_evidence_audit.source_identifiers
    intime = _parse_source_datetime(identifiers.get("intime"))
    if intime:
        return intime
    order_times = _documented_order_datetimes(case)
    return min(order_times) if order_times else None


def _documented_order_datetimes(case: PreparedCase) -> list[datetime]:
    values: list[datetime] = []
    for row in case.source_evidence_audit.documented_order_details:
        parsed = _parse_source_datetime(row.get("ordertime") or row.get("charttime"))
        if parsed:
            values.append(parsed)
    return values


def _matches_signal(signal: str, narrative: str) -> bool:
    text = narrative.lower()
    if signal == "chest_xray":
        return bool(
            re.search(
                r"\b(cxr|chest x[- ]?ray|portable chest|chest radiograph)\b"
                r"|examination:\s*chest\b"
                r"|pa and lateral views of the chest\b"
                r"|single frontal view of the chest\b",
                text,
            )
        )
    if signal in {"ct_imaging_order", "ct_abdomen_pelvis_with_contrast"}:
        return "ct" in text or "computed tomograph" in text
    if signal in {"ultrasound_order", "ultrasound_ruq"}:
        return "ultrasound" in text or "sonograph" in text
    return False


def _infer_order_id(signal: str, narrative: str, candidates: list[str]) -> str | None:
    text = narrative.lower()
    if signal == "chest_xray" and "chest_xray" in candidates:
        return "chest_xray"
    if signal in {"ct_imaging_order", "ct_abdomen_pelvis_with_contrast"}:
        if re.search(r"abdomen|pelvis|abdominal", text) and "ct_abdomen_pelvis_with_contrast" in candidates:
            return "ct_abdomen_pelvis_with_contrast"
        if re.search(r"pulmonary|chest.*angiograph|cta", text) and "ct_pulmonary_angiography" in candidates:
            return "ct_pulmonary_angiography"
        if "head" in text and "ct_head_without_contrast" in candidates:
            return "ct_head_without_contrast"
        if "cervical" in text and "ct_cervical_spine" in candidates:
            return "ct_cervical_spine"
    if signal in {"ultrasound_order", "ultrasound_ruq"} and "ultrasound_ruq" in candidates:
        return "ultrasound_ruq"
    return candidates[0] if len(candidates) == 1 else None


def _source_reference(case: PreparedCase, gap: SourceResultGap, row: dict[str, Any]) -> dict[str, Any]:
    template = dict(gap.supplemental_result_template.get("source_reference") or {})
    reference = {
        key: value
        for key, value in template.items()
        if value not in (None, "") and not str(value).startswith("replace-with")
    }
    for key in (
        "note_id",
        "subject_id",
        "hadm_id",
        "charttime",
        "storetime",
        "study_id",
        "source_file",
        "source_member",
        "metadata_file",
        "match_distance_seconds",
    ):
        value = row.get(key)
        if value not in (None, ""):
            reference[key] = value
    for key in ("subject_id", "hadm_id", "stay_id"):
        value = case.source_evidence_audit.source_identifiers.get(key)
        if value not in (None, "") and key not in reference:
            reference[key] = value
    return reference


def _radiology_zip_row_matches_case(row: dict[str, Any], case: PreparedCase) -> bool:
    identifiers = case.source_evidence_audit.source_identifiers
    matched = False
    for key in ("hadm_id", "subject_id"):
        case_value = _clean_identifier(identifiers.get(key))
        row_value = _clean_identifier(row.get(key))
        if not row_value:
            continue
        if not case_value or row_value != case_value:
            return False
        matched = True
    return matched


def _time_distance_seconds(row_time: Any, target_time: str | None) -> int | None:
    row_dt = _parse_source_datetime(row_time)
    target_dt = _parse_source_datetime(target_time)
    if not row_dt or not target_dt:
        return None
    return abs(int((row_dt - target_dt).total_seconds()))


def _parse_source_datetime(value: Any) -> datetime | None:
    text = _clean_identifier(value).replace(" ", "T")
    if not text:
        return None
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _sort_distance(value: Any) -> int:
    parsed = _number(value)
    return int(parsed) if parsed is not None else 999999999


def _gap_by_signal(gaps: list[SourceResultGap], signal: str) -> SourceResultGap:
    for gap in gaps:
        if gap.signal == signal:
            return gap
    raise ValueError(f"missing source result gap for signal: {signal}")


def _dedupe_candidates(candidates: list[SourceProbeCandidate]) -> list[SourceProbeCandidate]:
    seen: set[tuple[str, str, str, str]] = set()
    deduped: list[SourceProbeCandidate] = []
    for candidate in candidates:
        key = (
            candidate.signal,
            candidate.order_id,
            str(candidate.source_reference.get("note_id") or ""),
            str(candidate.source_reference.get("study_id") or candidate.source_reference.get("source_file") or ""),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(candidate)
    return deduped


def _radiology_table_path(base: Path) -> Path | None:
    if base.is_file():
        return base
    return _first_existing([
        base / "note" / "radiology.csv.gz",
        base / "note" / "radiology.csv",
        base / "radiology.csv.gz",
        base / "radiology.csv",
        *_glob_candidates(base, "*/note/radiology.csv.gz"),
        *_glob_candidates(base, "*/note/radiology.csv"),
        *_glob_candidates(base, "*/radiology.csv.gz"),
        *_glob_candidates(base, "*/radiology.csv"),
    ]) or _radiology_zip_path(base)


def _radiology_zip_path(base: Path) -> Path | None:
    candidates: list[Path] = []
    if base.is_file() and _is_zip_path(base):
        candidates.append(base)
    elif base.is_dir():
        candidates.extend(_glob_candidates(base, "*mimic*note*.zip"))
        candidates.extend(_glob_candidates(base, "*radiology*.zip"))
        candidates.extend(_glob_candidates(base, "*/**/*mimic*note*.zip"))
        candidates.extend(_glob_candidates(base, "*/**/*radiology*.zip"))
    seen: set[Path] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        if _radiology_zip_member(candidate):
            return candidate
    return None


def _radiology_zip_member(zip_path: Path) -> str | None:
    if not _is_zip_path(zip_path):
        return None
    try:
        with zipfile.ZipFile(zip_path) as archive:
            members = [name for name in archive.namelist() if _is_radiology_csv_member(name)]
    except (OSError, zipfile.BadZipFile):
        return None
    if not members:
        return None
    return sorted(members, key=_radiology_member_sort_key)[0]


def _is_radiology_csv_member(name: str) -> bool:
    normalized = name.replace("\\", "/").lower()
    return normalized.endswith("/radiology.csv.gz") or normalized.endswith("/radiology.csv") or normalized in {
        "radiology.csv.gz",
        "radiology.csv",
    }


def _radiology_member_sort_key(name: str) -> tuple[int, str]:
    normalized = name.replace("\\", "/").lower()
    priority = 0 if "/note/radiology.csv" in normalized else 1
    return (priority, normalized)


def _lab_table_paths(base: Path) -> tuple[Path | None, Path | None]:
    if base.is_file():
        parent = base.parent
        if base.name.startswith("labevents"):
            return base, _first_existing([parent / "d_labitems.csv.gz", parent / "d_labitems.csv"])
        if base.name.startswith("d_labitems"):
            return _first_existing([parent / "labevents.csv.gz", parent / "labevents.csv"]), base
        return None, None
    labevents_path = _first_existing([
        base / "labevents.csv.gz",
        base / "labevents.csv",
        base / "hosp" / "labevents.csv.gz",
        base / "hosp" / "labevents.csv",
        *_glob_candidates(base, "*/hosp/labevents.csv.gz"),
        *_glob_candidates(base, "*/hosp/labevents.csv"),
    ])
    d_labitems_path = _first_existing([
        base / "d_labitems.csv.gz",
        base / "d_labitems.csv",
        base / "hosp" / "d_labitems.csv.gz",
        base / "hosp" / "d_labitems.csv",
        *_glob_candidates(base, "*/hosp/d_labitems.csv.gz"),
        *_glob_candidates(base, "*/hosp/d_labitems.csv"),
    ])
    return labevents_path, d_labitems_path


def _cxr_report_table_path(base: Path) -> Path | None:
    if base.is_file():
        return base
    return _first_existing([
        base / "cxr_reports.csv.gz",
        base / "cxr_reports.csv",
        *_glob_candidates(base, "*/cxr_reports.csv.gz"),
        *_glob_candidates(base, "*/cxr_reports.csv"),
    ])


def _cxr_metadata_table_path(base: Path) -> Path | None:
    if base.is_file():
        return None
    return _first_existing([
        base / "mimic-cxr-2.0.0-metadata.csv.gz",
        base / "mimic-cxr-2.0.0-metadata.csv",
        base / "metadata.csv.gz",
        base / "metadata.csv",
        base / "cxr_metadata.csv.gz",
        base / "cxr_metadata.csv",
        *_glob_candidates(base, "*/mimic-cxr-2.0.0-metadata.csv.gz"),
        *_glob_candidates(base, "*/mimic-cxr-2.0.0-metadata.csv"),
        *_glob_candidates(base, "*/metadata.csv.gz"),
        *_glob_candidates(base, "*/metadata.csv"),
        *_glob_candidates(base, "*/cxr_metadata.csv.gz"),
        *_glob_candidates(base, "*/cxr_metadata.csv"),
    ])


def _ecg_table_paths(base: Path) -> tuple[Path | None, Path | None]:
    if base.is_file():
        if base.suffix.lower() == ".zip":
            return (
                base if _ecg_record_zip_member(base) else None,
                base if _ecg_measurement_zip_member(base) else None,
            )
        if "machine" in base.name.lower():
            return None, base
        return base, None
    record_path = _first_existing([
        base / "record-list.csv.gz",
        base / "record-list.csv",
        base / "record_list.csv.gz",
        base / "record_list.csv",
    ])
    measurement_path = _first_existing([
        base / "machine_measurements.csv.gz",
        base / "machine_measurements.csv",
        *_glob_candidates(base, "*/machine_measurements.csv.gz"),
        *_glob_candidates(base, "*/machine_measurements.csv"),
    ])
    if not measurement_path:
        measurement_path = _ecg_zip_table_path(base, _ecg_measurement_zip_member)
    if not record_path:
        record_path = _ecg_zip_table_path(base, _ecg_record_zip_member)
    return record_path, measurement_path


def _ecg_zip_table_path(base: Path, member_finder: Any) -> Path | None:
    if not base.is_dir():
        return None
    candidates = [
        *_glob_candidates(base, "*ecg*.zip"),
        *_glob_candidates(base, "*/**/*ecg*.zip"),
    ]
    seen: set[Path] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        if member_finder(candidate):
            return candidate
    return None


def _ecg_measurement_zip_member(zip_path: Path) -> str | None:
    return _ecg_zip_member(zip_path, ("machine_measurements.csv.gz", "machine_measurements.csv"))


def _ecg_record_zip_member(zip_path: Path) -> str | None:
    return _ecg_zip_member(zip_path, ("record-list.csv.gz", "record-list.csv", "record_list.csv.gz", "record_list.csv"))


def _ecg_zip_member(zip_path: Path, names: tuple[str, ...]) -> str | None:
    if not _is_zip_path(zip_path):
        return None
    try:
        with zipfile.ZipFile(zip_path) as archive:
            members = [name for name in archive.namelist() if _is_named_zip_member(name, names)]
    except (OSError, zipfile.BadZipFile):
        return None
    if not members:
        return None
    return sorted(members, key=lambda name: name.replace("\\", "/").lower())[0]


def _is_named_zip_member(name: str, names: tuple[str, ...]) -> bool:
    normalized = name.replace("\\", "/").lower()
    return any(normalized.endswith(f"/{candidate}") or normalized == candidate for candidate in names)


def _detect_source_dirs(source_root: Path, *, include_ecg: bool = True) -> dict[str, Path]:
    detected: dict[str, Path] = {}
    if not source_root.exists():
        return detected
    labevents_path, d_labitems_path = _lab_table_paths(source_root)
    if labevents_path and d_labitems_path:
        detected["mimic_hosp_dir"] = _common_existing_parent(labevents_path, d_labitems_path)
    note_path = _radiology_table_path(source_root)
    if note_path:
        detected["mimic_note_dir"] = note_path
    cxr_path = _cxr_report_table_path(source_root)
    cxr_raw_dir = _cxr_raw_reports_dir(source_root)
    if cxr_path:
        detected["mimic_cxr_dir"] = cxr_path
    elif cxr_raw_dir:
        detected["mimic_cxr_dir"] = cxr_raw_dir
    if not include_ecg:
        return detected
    record_path, measurement_path = _ecg_table_paths(source_root)
    if measurement_path:
        detected["mimic_ecg_dir"] = measurement_path
    elif record_path:
        detected["mimic_ecg_dir"] = record_path
    else:
        waveform_source = _ecg_waveform_source_path(source_root)
        if waveform_source:
            detected["mimic_ecg_dir"] = waveform_source
    return detected


def _build_source_inventory(
    *,
    source_root: Path | None,
    mimic_hosp_dir: Path | None,
    mimic_note_dir: Path | None,
    mimic_cxr_dir: Path | None,
    mimic_ecg_dir: Path | None,
    probe_labs: bool,
    probe_ecg: bool,
) -> list[SourceInventoryItem]:
    hosp_base = mimic_hosp_dir or source_root
    note_base = mimic_note_dir or source_root
    cxr_base = mimic_cxr_dir or source_root
    ecg_base = mimic_ecg_dir or source_root

    inventory = [
        _hosp_inventory_item(hosp_base, probe_labs=probe_labs),
        _note_inventory_item(note_base),
        _cxr_reports_inventory_item(cxr_base),
        _cxr_metadata_inventory_item(cxr_base, source_root),
        _ecg_machine_inventory_item(ecg_base, probe_ecg=probe_ecg),
        _ecg_record_inventory_item(ecg_base, probe_ecg=probe_ecg),
        _ecg_waveform_inventory_item(ecg_base, probe_ecg=probe_ecg),
    ]
    return inventory


def _hosp_inventory_item(base: Path | None, *, probe_labs: bool) -> SourceInventoryItem:
    if not base:
        return SourceInventoryItem(
            module="mimic_iv_hosp_labs",
            status="missing",
            detail="No MIMIC-IV hosp source path was provided or auto-detected.",
            expected_paths=_expected_hosp_paths(None),
        )
    labevents_path, d_labitems_path = _lab_table_paths(base)
    if labevents_path and d_labitems_path:
        status: Literal["present", "missing", "skipped"] = "present" if probe_labs else "skipped"
        detail = (
            "MIMIC-IV hosp lab tables are present and will be probed."
            if probe_labs
            else "MIMIC-IV hosp lab tables are present, but lab probing was skipped for this run."
        )
        return SourceInventoryItem(
            module="mimic_iv_hosp_labs",
            status=status,
            path=str(_common_existing_parent(labevents_path, d_labitems_path)),
            detail=detail,
        )
    return SourceInventoryItem(
        module="mimic_iv_hosp_labs",
        status="missing",
        path=str(base),
        expected_paths=_expected_hosp_paths(base),
        detail="Both labevents and d_labitems are required for source-backed lab probing.",
    )


def _note_inventory_item(base: Path | None) -> SourceInventoryItem:
    if not base:
        return SourceInventoryItem(
            module="mimic_iv_note_radiology",
            status="missing",
            detail="No MIMIC-IV-Note source path was provided or auto-detected.",
            expected_paths=_expected_note_radiology_paths(None),
        )
    note_path = _radiology_table_path(base)
    if note_path:
        return SourceInventoryItem(
            module="mimic_iv_note_radiology",
            status="present",
            path=str(note_path),
            detail="MIMIC-IV-Note radiology table or zip member is available for CT/US radiology result linkage.",
        )
    return SourceInventoryItem(
        module="mimic_iv_note_radiology",
        status="missing",
        path=str(base),
        expected_paths=_expected_note_radiology_paths(base),
        detail="MIMIC-IV-Note note/radiology.csv(.gz) or a zip containing it was not found.",
    )


def _cxr_reports_inventory_item(base: Path | None) -> SourceInventoryItem:
    if not base:
        return SourceInventoryItem(
            module="mimic_cxr_reports",
            status="missing",
            detail="No MIMIC-CXR source path was provided or auto-detected.",
            expected_paths=_expected_cxr_report_paths(None),
        )
    report_path = _cxr_report_table_path(base)
    raw_dir = _cxr_raw_reports_dir(base)
    if report_path:
        return SourceInventoryItem(
            module="mimic_cxr_reports",
            status="present",
            path=str(report_path),
            detail="MIMIC-CXR report table is available; study metadata is still needed for encounter-time linkage.",
        )
    if raw_dir:
        return SourceInventoryItem(
            module="mimic_cxr_reports",
            status="present",
            path=str(raw_dir),
            detail="MIMIC-CXR raw report text is available; subject-only matches require study metadata before auto-release.",
        )
    return SourceInventoryItem(
        module="mimic_cxr_reports",
        status="missing",
        path=str(base),
        expected_paths=_expected_cxr_report_paths(base),
        detail="Neither a MIMIC-CXR report table nor raw files/pXX/pSUBJECT report tree was found.",
    )


def _cxr_metadata_inventory_item(base: Path | None, source_root: Path | None) -> SourceInventoryItem:
    search_bases = [candidate for candidate in (base, source_root) if candidate]
    for search_base in search_bases:
        metadata_path = _cxr_metadata_table_path(search_base)
        if metadata_path:
            return SourceInventoryItem(
                module="mimic_cxr_metadata",
                status="present",
                path=str(metadata_path),
                detail="MIMIC-CXR study metadata is available for raw/report CXR encounter-time linkage.",
            )
    return SourceInventoryItem(
        module="mimic_cxr_metadata",
        status="missing",
        path=str(base or source_root) if (base or source_root) else None,
        expected_paths=_expected_cxr_metadata_paths(source_root or base),
        detail="MIMIC-CXR metadata with StudyDate/StudyTime was not found; raw CXR reports remain subject-only.",
    )


def _ecg_machine_inventory_item(base: Path | None, *, probe_ecg: bool) -> SourceInventoryItem:
    if not probe_ecg:
        return SourceInventoryItem(
            module="mimic_iv_ecg_machine_measurements",
            status="skipped",
            path=str(base) if base else None,
            detail="MIMIC-IV-ECG machine_measurements inventory was skipped for this run.",
        )
    if not base:
        return SourceInventoryItem(
            module="mimic_iv_ecg_machine_measurements",
            status="missing",
            detail="No MIMIC-IV-ECG source path was provided or auto-detected.",
            expected_paths=_expected_ecg_measurement_paths(None),
        )
    _record_path, measurement_path = _ecg_table_paths(base)
    if measurement_path:
        status: Literal["present", "missing", "skipped"] = "present" if probe_ecg else "skipped"
        detail = (
            "MIMIC-IV-ECG machine_measurements is available for machine-read ECG result linkage."
            if probe_ecg
            else "MIMIC-IV-ECG machine_measurements is available, but ECG probing was skipped for this run."
        )
        return SourceInventoryItem(
            module="mimic_iv_ecg_machine_measurements",
            status=status,
            path=str(measurement_path),
            detail=detail,
        )
    return SourceInventoryItem(
        module="mimic_iv_ecg_machine_measurements",
        status="missing",
        path=str(base),
        expected_paths=_expected_ecg_measurement_paths(base),
        detail="MIMIC-IV-ECG machine_measurements.csv(.gz) or matching zip member was not found.",
    )


def _ecg_record_inventory_item(base: Path | None, *, probe_ecg: bool) -> SourceInventoryItem:
    if not probe_ecg:
        return SourceInventoryItem(
            module="mimic_iv_ecg_record_list",
            status="skipped",
            path=str(base) if base else None,
            detail="MIMIC-IV-ECG record-list inventory was skipped for this run.",
        )
    if not base:
        return SourceInventoryItem(
            module="mimic_iv_ecg_record_list",
            status="missing",
            detail="No MIMIC-IV-ECG source path was provided or auto-detected.",
            expected_paths=_expected_ecg_record_paths(None),
        )
    record_path, _measurement_path = _ecg_table_paths(base)
    if record_path:
        status: Literal["present", "missing", "skipped"] = "present" if probe_ecg else "skipped"
        return SourceInventoryItem(
            module="mimic_iv_ecg_record_list",
            status=status,
            path=str(record_path),
            detail="MIMIC-IV-ECG record-list is available for path/study provenance."
            if probe_ecg
            else "MIMIC-IV-ECG record-list is available, but ECG probing was skipped for this run.",
        )
    return SourceInventoryItem(
        module="mimic_iv_ecg_record_list",
        status="missing",
        path=str(base),
        expected_paths=_expected_ecg_record_paths(base),
        detail="MIMIC-IV-ECG record-list.csv(.gz) or matching zip member was not found.",
    )


def _ecg_waveform_inventory_item(base: Path | None, *, probe_ecg: bool) -> SourceInventoryItem:
    if not probe_ecg:
        return SourceInventoryItem(
            module="mimic_iv_ecg_waveforms",
            status="skipped",
            path=str(base) if base else None,
            detail="ECG waveform inventory was skipped for this run.",
        )
    if not base:
        return SourceInventoryItem(
            module="mimic_iv_ecg_waveforms",
            status="missing",
            detail="No MIMIC-IV-ECG source path was provided or auto-detected.",
            expected_paths=_expected_ecg_waveform_paths(None),
        )
    waveform_path = _ecg_waveform_source_path(base)
    if waveform_path:
        status: Literal["present", "missing", "skipped"] = "present" if probe_ecg else "skipped"
        return SourceInventoryItem(
            module="mimic_iv_ecg_waveforms",
            status=status,
            path=str(waveform_path),
            detail="ECG waveform headers are available for audit only; headers do not contain machine interpretation results."
            if probe_ecg
            else "ECG waveform headers are available, but ECG probing was skipped for this run.",
        )
    return SourceInventoryItem(
        module="mimic_iv_ecg_waveforms",
        status="missing",
        path=str(base),
        expected_paths=_expected_ecg_waveform_paths(base),
        detail="No local ECG waveform header tree or ECG zip was found.",
    )


def _expected_hosp_paths(base: Path | None) -> list[str]:
    if not base:
        return [
            "mimic-iv-*/hosp/labevents.csv.gz",
            "mimic-iv-*/hosp/d_labitems.csv.gz",
        ]
    return _string_paths(
        [
            base / "hosp" / "labevents.csv.gz",
            base / "hosp" / "d_labitems.csv.gz",
            base / "mimic-iv-3.1" / "hosp" / "labevents.csv.gz",
            base / "mimic-iv-3.1" / "hosp" / "d_labitems.csv.gz",
            base / "labevents.csv.gz",
            base / "d_labitems.csv.gz",
        ]
    )


def _expected_note_radiology_paths(base: Path | None) -> list[str]:
    if not base:
        return [
            "mimic-iv-note*/note/radiology.csv.gz",
            "mimic-iv-note*.zip containing note/radiology.csv.gz",
        ]
    return _string_paths(
        [
            base / "mimic-iv-note" / "note" / "radiology.csv.gz",
            base / "mimic-iv-note" / "note" / "radiology.csv",
            base / "mimic-iv-note-deidentified-free-text-clinical-notes-2.2" / "note" / "radiology.csv.gz",
            base / "mimic-iv-note-deidentified-free-text-clinical-notes-2.2.zip",
            base / "note" / "radiology.csv.gz",
            base / "note" / "radiology.csv",
            base / "radiology.csv.gz",
            base / "radiology.csv",
        ]
    )


def _expected_cxr_report_paths(base: Path | None) -> list[str]:
    if not base:
        return [
            "mimic-cxr-reports/files/pXX/pSUBJECT/sSTUDY.txt",
            "mimic-cxr/cxr_reports.csv.gz",
        ]
    return _string_paths(
        [
            base / "mimic-cxr-reports" / "files",
            base / "mimic-cxr" / "files",
            base / "mimic-cxr" / "cxr_reports.csv.gz",
            base / "cxr_reports.csv.gz",
            base / "files",
        ]
    )


def _expected_cxr_metadata_paths(base: Path | None) -> list[str]:
    if not base:
        return [
            "mimic-cxr-jpg/mimic-cxr-2.0.0-metadata.csv.gz",
            "mimic-cxr-2.0.0-metadata.csv.gz",
        ]
    return _string_paths(
        [
            base / "mimic-cxr-jpg" / "mimic-cxr-2.0.0-metadata.csv.gz",
            base / "mimic-cxr-jpg" / "mimic-cxr-2.0.0-metadata.csv",
            base / "mimic-cxr" / "mimic-cxr-2.0.0-metadata.csv.gz",
            base / "mimic-cxr" / "mimic-cxr-2.0.0-metadata.csv",
            base / "mimic-cxr-2.0.0-metadata.csv.gz",
            base / "mimic-cxr-2.0.0-metadata.csv",
            base / "metadata.csv.gz",
            base / "metadata.csv",
        ]
    )


def _expected_ecg_measurement_paths(base: Path | None) -> list[str]:
    if not base:
        return [
            "mimic-iv-ecg*/machine_measurements.csv.gz",
            "mimic-iv-ecg*.zip containing machine_measurements.csv",
        ]
    return _string_paths(
        [
            base / "mimic-iv-ecg-diagnostic-electrocardiogram-matched-subset-1.0" / "machine_measurements.csv",
            base / "mimic-iv-ecg-diagnostic-electrocardiogram-matched-subset-1.0.zip",
            base / "machine_measurements.csv.gz",
            base / "machine_measurements.csv",
        ]
    )


def _expected_ecg_record_paths(base: Path | None) -> list[str]:
    if not base:
        return [
            "mimic-iv-ecg*/record-list.csv.gz",
            "mimic-iv-ecg*.zip containing record-list.csv",
        ]
    return _string_paths(
        [
            base / "mimic-iv-ecg-diagnostic-electrocardiogram-matched-subset-1.0" / "record-list.csv",
            base / "mimic-iv-ecg-diagnostic-electrocardiogram-matched-subset-1.0.zip",
            base / "record-list.csv.gz",
            base / "record-list.csv",
            base / "record_list.csv.gz",
            base / "record_list.csv",
        ]
    )


def _expected_ecg_waveform_paths(base: Path | None) -> list[str]:
    if not base:
        return [
            "mimic-iv-ecg*/files/pXXXX/pSUBJECT/sSTUDY/*.hea",
            "mimic-iv-ecg*.zip containing files/.../*.hea",
        ]
    return _string_paths(
        [
            base / "mimic-iv-ecg-diagnostic-electrocardiogram-matched-subset-1.0" / "files",
            base / "mimic-iv-ecg-diagnostic-electrocardiogram-matched-subset-1.0.zip",
            base / "files",
        ]
    )


def _string_paths(paths: list[Path]) -> list[str]:
    seen: set[str] = set()
    rendered: list[str] = []
    for path in paths:
        text = str(path)
        if text in seen:
            continue
        seen.add(text)
        rendered.append(text)
    return rendered


def _common_existing_parent(first: Path, second: Path) -> Path:
    first_parent = first.parent
    second_parent = second.parent
    return first_parent if first_parent == second_parent else first_parent


def _cxr_raw_reports_dir(base: Path) -> Path | None:
    if (base / "files").is_dir():
        return base / "files"
    if base.is_dir() and any(child.is_dir() and re.fullmatch(r"p\d{2}", child.name) for child in base.iterdir()):
        return base
    for candidate in _glob_candidates(base, "*/files"):
        if candidate.is_dir() and any(child.is_dir() and re.fullmatch(r"p\d{2}", child.name) for child in candidate.iterdir()):
            return candidate
    return None


def _ecg_waveform_source_path(base: Path) -> Path | None:
    if base.is_file() and base.suffix.lower() == ".zip" and "ecg" in base.name.lower():
        return base
    if not base.is_dir():
        return None
    zip_candidate = _first_existing(_glob_candidates(base, "*ecg*.zip"))
    if zip_candidate:
        return zip_candidate
    if (base / "files").is_dir():
        return base
    return _first_existing([path.parent.parent.parent for path in _glob_candidates(base, "*/files/p*/p*")])


def _first_existing(paths: list[Path]) -> Path | None:
    for path in paths:
        if path.exists():
            return path
    return None


def _is_zip_path(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() == ".zip"


def _glob_candidates(base: Path, pattern: str) -> list[Path]:
    if not base.is_dir():
        return []
    return sorted(base.glob(pattern))


def _sql_path(path: Path) -> str:
    return "'" + str(path).replace("'", "''").replace("\\", "/") + "'"


def _sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _read_csv_sql(path: Path) -> str:
    return f"read_csv_auto({_sql_path(path)}, sample_size=-1, all_varchar=true)"


def _table_columns(con: duckdb.DuckDBPyConnection, path: Path) -> set[str]:
    return {row[0] for row in con.execute(f"DESCRIBE SELECT * FROM {_read_csv_sql(path)} LIMIT 0").fetchall()}


def _select(cols: set[str], alias: str, column: str, *, cast: str | None = None) -> str:
    expression = f"{alias}.{column}" if column in cols else "NULL"
    if cast and column in cols:
        expression = f"TRY_CAST({expression} AS {cast})"
    return f"{expression} AS {column}"


def _first_present(cols: set[str], names: tuple[str, ...]) -> str | None:
    for name in names:
        if name in cols:
            return name
    return None


def _column_named(cols: set[str], *names: str) -> str | None:
    lookup = {col.lower(): col for col in cols}
    for name in names:
        column = lookup.get(name.lower())
        if column:
            return column
    return None


def _fetch_records(con: duckdb.DuckDBPyConnection, query: str) -> list[dict[str, Any]]:
    rows = con.execute(query).fetchdf()
    return json.loads(rows.to_json(orient="records", date_format="iso"))


def _clean_identifier(value: Any) -> str:
    text = str(value or "").strip()
    if text.endswith(".0"):
        return text[:-2]
    return text


def _clean_optional(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text or text.lower() == "nan":
        return None
    if text.endswith(".0") and text.replace(".", "", 1).isdigit():
        return text[:-2]
    return text


def _number(value: Any) -> float | None:
    text = _clean_optional(value)
    if text is None or text == "___":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _normalize_label(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", label.lower()).strip()


def _compact_text(value: Any) -> str:
    return " ".join(str(value or "").replace("\n", " ").split()).strip()


def _main() -> int:
    parser = argparse.ArgumentParser(description="Probe local MIMIC report sources for candidate supplemental result text.")
    parser.add_argument("case", type=Path, help="PreparedCase JSON.")
    parser.add_argument("--source-root", type=Path, help="Local root containing one or more MIMIC source folders or ZIPs; source dirs are auto-detected.")
    parser.add_argument("--mimic-hosp-dir", type=Path, help="Local MIMIC-IV hosp root containing labevents and d_labitems.")
    parser.add_argument("--mimic-note-dir", type=Path, help="Local MIMIC-IV-Note root or radiology CSV path.")
    parser.add_argument("--mimic-cxr-dir", type=Path, help="Local MIMIC-CXR root, cxr_reports CSV path, or raw files root.")
    parser.add_argument("--mimic-ecg-dir", type=Path, help="Local MIMIC-IV-ECG root or machine_measurements CSV path.")
    parser.add_argument("--ecg-index-report", type=Path, help="Prebuilt source_ecg_index JSON to use instead of streaming machine_measurements.")
    parser.add_argument("--limit", type=int, default=5, help="Maximum candidate rows/files to inspect per source.")
    parser.add_argument("--skip-lab-probe", action="store_true", help="Skip MIMIC-IV hosp labevents probing when only decisive imaging/ECG gaps are being audited.")
    parser.add_argument("--skip-ecg-probe", action="store_true", help="Skip MIMIC-IV-ECG probing when a separate ECG index or imaging-only audit is being used.")
    parser.add_argument("--output", type=Path, help="Optional probe report JSON output path.")
    parser.add_argument("--supplemental-output", type=Path, help="Optional candidate supplemental-results JSON output path.")
    args = parser.parse_args()

    case = PreparedCase.model_validate_json(args.case.read_text(encoding="utf-8"))
    report = build_source_probe_report(
        case,
        source_root=args.source_root,
        mimic_hosp_dir=args.mimic_hosp_dir,
        mimic_note_dir=args.mimic_note_dir,
        mimic_cxr_dir=args.mimic_cxr_dir,
        mimic_ecg_dir=args.mimic_ecg_dir,
        ecg_index=load_ecg_source_index(args.ecg_index_report).rows_by_subject if args.ecg_index_report else None,
        limit=args.limit,
        probe_labs=not args.skip_lab_probe,
        probe_ecg=not args.skip_ecg_probe,
    )
    rendered = report.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    if args.supplemental_output:
        args.supplemental_output.parent.mkdir(parents=True, exist_ok=True)
        args.supplemental_output.write_text(
            json.dumps(report.supplemental_results_payload, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
