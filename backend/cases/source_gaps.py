from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from backend.cases.schemas import PreparedCase
from backend.orders.catalog import get_order


SIGNAL_CANDIDATES = {
    "chest_xray": ["chest_xray"],
    "ct_imaging_order": [
        "ct_abdomen_pelvis_with_contrast",
        "ct_pulmonary_angiography",
        "ct_head_without_contrast",
        "ct_cervical_spine",
    ],
    "ct_abdomen_pelvis_with_contrast": ["ct_abdomen_pelvis_with_contrast"],
    "ultrasound_order": ["ultrasound_ruq"],
    "ultrasound_ruq": ["ultrasound_ruq"],
    "ecg_12_lead": ["ecg_12_lead"],
}

REFERENCE_PLACEHOLDERS = {
    "note_id": "replace-with-local-note-id-if-available",
    "subject_id": "replace-with-local-subject-id",
    "hadm_id": "replace-with-local-hadm-id-if-available",
    "charttime": "replace-with-local-charttime-if-available",
    "source_file": "replace-with-local-source-file-if-available",
}


class SourceResultGap(BaseModel):
    signal: str
    reason: str
    candidate_order_ids: list[str] = Field(default_factory=list)
    decisive_for_release: bool = False
    required_source_modules: list[str] = Field(default_factory=list)
    documented_order_details: list[dict[str, Any]] = Field(default_factory=list)
    local_lookup_hints: list[str] = Field(default_factory=list)
    operator_queries: list[dict[str, Any]] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    supplemental_result_template: dict[str, Any]


class SourceGapReport(BaseModel):
    case_id: str
    source: str
    source_identifiers: dict[str, Any] = Field(default_factory=dict)
    result_bundle_ids: list[str] = Field(default_factory=list)
    documented_order_signals: list[str] = Field(default_factory=list)
    missing_documented_order_results: list[SourceResultGap] = Field(default_factory=list)
    release_blocking_missing_results: list[dict[str, Any]] = Field(default_factory=list)
    supplemental_results_payload_template: dict[str, Any] = Field(default_factory=dict)


def build_source_gap_report(case: PreparedCase) -> SourceGapReport:
    gaps = [_gap_for_signal(case, signal) for signal in case.source_evidence_audit.documented_orders_without_results]
    entries = [
        gap.supplemental_result_template
        for gap in gaps
    ]
    return SourceGapReport(
        case_id=case.case_id,
        source=case.source,
        source_identifiers=dict(case.source_evidence_audit.source_identifiers),
        result_bundle_ids=sorted(case.result_bundles),
        documented_order_signals=list(case.source_evidence_audit.documented_order_signals),
        missing_documented_order_results=gaps,
        release_blocking_missing_results=[
            _release_blocking_entry(gap) for gap in gaps if gap.decisive_for_release
        ],
        supplemental_results_payload_template={
            "case_id": case.case_id,
            "results": entries,
        },
    )


def _gap_for_signal(case: PreparedCase, signal: str) -> SourceResultGap:
    candidates = _candidate_order_ids(signal)
    details = _details_for_signal(case, signal)
    template_order_id = candidates[0] if len(candidates) == 1 else "replace-with-canonical-order-id-from-candidates"
    return SourceResultGap(
        signal=signal,
        reason=(
            "The local source record documents this order signal, but no linked result/report text "
            "is attached to a canonical structured order. Locate the MIMIC source row/report and paste "
            "only source-recorded values or narrative into a local supplemental-results file."
        ),
        candidate_order_ids=candidates,
        decisive_for_release=_decisive_for_release(signal, candidates),
        required_source_modules=_required_source_modules(signal),
        documented_order_details=details,
        local_lookup_hints=_local_lookup_hints(case, signal, details),
        operator_queries=_operator_queries(case, signal, details),
        acceptance_criteria=_acceptance_criteria(signal, candidates),
        supplemental_result_template={
            "order_id": template_order_id,
            "candidate_order_ids": candidates,
            "source": _default_source_for_signal(signal),
            "source_reference": _source_reference_template(case, details),
            "narrative": "Paste only the local source-recorded result impression/findings or value summary here.",
        },
    )


def _candidate_order_ids(signal: str) -> list[str]:
    candidates = SIGNAL_CANDIDATES.get(signal, [signal])
    return [order_id for order_id in candidates if get_order(order_id) is not None]


def _default_source_for_signal(signal: str) -> str:
    if signal == "ecg_12_lead":
        return "MIMIC-IV-ECG"
    if signal in {"chest_xray", "ct_imaging_order", "ct_abdomen_pelvis_with_contrast", "ultrasound_order", "ultrasound_ruq"}:
        return "MIMIC-IV-Note radiology"
    return "MIMIC source"


def _decisive_for_release(signal: str, candidates: list[str]) -> bool:
    decisive_order_ids = {"ct_abdomen_pelvis_with_contrast", "ultrasound_ruq", "ecg_12_lead"}
    return signal != "chest_xray" and bool(decisive_order_ids & set(candidates))


def _required_source_modules(signal: str) -> list[str]:
    if signal in {"ct_imaging_order", "ct_abdomen_pelvis_with_contrast", "ultrasound_order", "ultrasound_ruq"}:
        return [
            "MIMIC-IV-Note note/radiology.csv(.gz)",
            "Local POE order row for source_reference order provenance",
        ]
    if signal == "chest_xray":
        return [
            "MIMIC-IV-Note note/radiology.csv(.gz) or MIMIC-CXR report text",
            "Encounter-linked CXR study list/report metadata; subject-only raw reports require manual timing verification",
            "Local POE order row for source_reference order provenance",
        ]
    if signal == "ecg_12_lead":
        return [
            "MIMIC-IV-ECG machine_measurements.csv(.gz)",
            "MIMIC-IV-ECG record-list.csv(.gz) for study time/path provenance",
        ]
    return ["Local MIMIC source table containing the ordered result"]


def _acceptance_criteria(signal: str, candidates: list[str]) -> list[str]:
    criteria = [
        "Narrative and values are copied only from source-recorded rows; no interpretation or fabricated values.",
        "source_reference includes subject_id, hadm_id or stay_id when available, source file/table, and row-level identifiers.",
        "The selected order_id is one canonical catalog order from candidate_order_ids.",
    ]
    if signal in {"ct_imaging_order", "ct_abdomen_pelvis_with_contrast", "ultrasound_order", "ultrasound_ruq"}:
        criteria.extend(
            [
                "Radiology row/report matches the case hadm_id or subject_id and is closest to the documented imaging order time.",
                "For learner release, at least one abdominal decisive result must be attached as ct_abdomen_pelvis_with_contrast or ultrasound_ruq.",
            ]
        )
    if signal == "chest_xray":
        criteria.append(
            "Do not auto-apply a raw CXR report matched only by subject_id; first verify study metadata/list timing or another encounter link."
        )
    if signal == "ecg_12_lead":
        criteria.append(
            "ECG measurements must match the case subject_id and be temporally plausible for the ED encounter."
        )
    if not candidates:
        criteria.append("No current catalog candidate exists; add a catalog order before attaching this result.")
    return criteria


def _release_blocking_entry(gap: SourceResultGap) -> dict[str, Any]:
    return {
        "signal": gap.signal,
        "candidate_order_ids": gap.candidate_order_ids,
        "required_source_modules": gap.required_source_modules,
        "documented_order_details": gap.documented_order_details,
        "local_lookup_hints": gap.local_lookup_hints,
        "operator_queries": gap.operator_queries,
        "acceptance_criteria": gap.acceptance_criteria,
        "supplemental_result_template": gap.supplemental_result_template,
        "operator_action": (
            "Attach one encounter-linked decisive abdominal imaging or ECG result from the required source modules, "
            "then rerun case preparation with that local supplemental-results file."
        ),
    }


def _details_for_signal(case: PreparedCase, signal: str) -> list[dict[str, Any]]:
    return [
        dict(detail)
        for detail in case.source_evidence_audit.documented_order_details
        if str(detail.get("signal") or "") == signal
    ]


def _source_reference_template(case: PreparedCase, details: list[dict[str, Any]]) -> dict[str, Any]:
    reference = dict(REFERENCE_PLACEHOLDERS)
    for key, value in case.source_evidence_audit.source_identifiers.items():
        if key in {"subject_id", "hadm_id", "stay_id"} and value not in (None, ""):
            reference[key] = value
    if details:
        first = details[0]
        for key in ("poe_id", "poe_seq", "ordertime", "charttime", "study_id", "source_file"):
            if first.get(key) not in (None, ""):
                reference[key] = first[key]
    return reference


def _local_lookup_hints(case: PreparedCase, signal: str, details: list[dict[str, Any]]) -> list[str]:
    identifiers = case.source_evidence_audit.source_identifiers
    subject_id = _clean_identifier(identifiers.get("subject_id"))
    hadm_id = _clean_identifier(identifiers.get("hadm_id"))
    stay_id = _clean_identifier(identifiers.get("stay_id"))
    first = details[0] if details else {}
    poe_id = _clean_identifier(first.get("poe_id"))
    ordertime = _clean_identifier(first.get("ordertime"))
    hints: list[str] = []

    if signal in {"ct_imaging_order", "ct_abdomen_pelvis_with_contrast", "ultrasound_order", "ultrasound_ruq"}:
        if hadm_id:
            hints.append(f"Search MIMIC-IV-Note note/radiology(.csv[.gz]) for hadm_id={hadm_id}; prefer reports closest to ordertime={ordertime or 'the imaging order time'}.")
    if signal == "chest_xray":
        if hadm_id:
            hints.append(f"Search MIMIC-IV-Note note/radiology(.csv[.gz]) for hadm_id={hadm_id}; prefer reports closest to ordertime={ordertime or 'the imaging order time'}.")
        if subject_id:
            hints.append(f"Search MIMIC-CXR reports for subject_id={subject_id}; raw reports usually live under files/p{subject_id[:2]}/p{subject_id}/s*.txt.")
            hints.append(
                "If MIMIC-CXR metadata is available, join report study_id to the metadata StudyDate/StudyTime and prefer a study closest to the documented CXR order time."
            )
    if signal == "ecg_12_lead" and subject_id:
        hints.append(f"Search MIMIC-IV-ECG record-list and machine_measurements for subject_id={subject_id}; prefer records near the ED order time.")
    if poe_id:
        hints.append(f"Use the source POE order row poe_id={poe_id} as the order provenance in source_reference.")
    if stay_id:
        hints.append(f"Keep stay_id={stay_id} in the supplemental source_reference so the result remains traceable to this ED encounter.")
    return hints


def _operator_queries(case: PreparedCase, signal: str, details: list[dict[str, Any]]) -> list[dict[str, Any]]:
    identifiers = case.source_evidence_audit.source_identifiers
    subject_id = _clean_identifier(identifiers.get("subject_id"))
    hadm_id = _clean_identifier(identifiers.get("hadm_id"))
    first = details[0] if details else {}
    ordertime = _clean_identifier(first.get("ordertime"))
    queries: list[dict[str, Any]] = []

    if signal in {"ct_imaging_order", "ct_abdomen_pelvis_with_contrast", "ultrasound_order", "ultrasound_ruq", "chest_xray"}:
        radiology_filter = _radiology_query_filter(signal)
        where: list[str] = []
        if hadm_id:
            where.append(f"TRY_CAST(hadm_id AS BIGINT) = {int(hadm_id)}")
        elif subject_id:
            where.append(f"TRY_CAST(subject_id AS BIGINT) = {int(subject_id)}")
        if radiology_filter:
            where.append(radiology_filter)
        order_clause = _query_order_by_time(ordertime, "charttime")
        queries.append(
            {
                "label": "Find encounter-linked MIMIC-IV-Note radiology rows",
                "source_module": "MIMIC-IV-Note",
                "path_hint": "D:/physionet/mimic-iv-note/note/radiology.csv.gz",
                "tool": "duckdb",
                "sql": (
                    "SELECT note_id, subject_id, hadm_id, charttime, storetime, text\n"
                    "FROM read_csv_auto('D:/physionet/mimic-iv-note/note/radiology.csv.gz', header=true)\n"
                    f"WHERE {' AND '.join(where) if where else 'TRUE'}\n"
                    f"{order_clause}\n"
                    "LIMIT 20;"
                ),
            }
        )

    if signal == "chest_xray" and subject_id:
        queries.append(
            {
                "label": "Locate subject-level MIMIC-CXR raw reports for manual encounter-link verification",
                "source_module": "MIMIC-CXR",
                "path_hint": f"D:/physionet/mimic-cxr/files/p{subject_id[:2]}/p{subject_id}/s*.txt",
                "tool": "powershell",
                "command": f"Get-ChildItem -Path D:/physionet/mimic-cxr/files/p{subject_id[:2]}/p{subject_id} -Filter s*.txt",
            }
        )
        order_clause = _query_order_by_time(ordertime, "study_datetime")
        time_filter = _time_window_filter(ordertime, "study_datetime")
        queries.append(
            {
                "label": "Link MIMIC-CXR reports to study metadata near CXR order time",
                "source_module": "MIMIC-CXR",
                "path_hint": "D:/physionet/mimic-cxr/cxr_reports.csv.gz plus D:/physionet/mimic-cxr-jpg/mimic-cxr-2.0.0-metadata.csv.gz",
                "tool": "duckdb",
                "sql": (
                    "WITH metadata AS (\n"
                    "  SELECT subject_id, study_id,\n"
                    "    TRY_CAST(\n"
                    "      SUBSTR(REGEXP_REPLACE(CAST(StudyDate AS VARCHAR), '[^0-9]', '', 'g'), 1, 4) || '-' ||\n"
                    "      SUBSTR(REGEXP_REPLACE(CAST(StudyDate AS VARCHAR), '[^0-9]', '', 'g'), 5, 2) || '-' ||\n"
                    "      SUBSTR(REGEXP_REPLACE(CAST(StudyDate AS VARCHAR), '[^0-9]', '', 'g'), 7, 2) || ' ' ||\n"
                    "      SUBSTR(REGEXP_REPLACE(COALESCE(CAST(StudyTime AS VARCHAR), ''), '[^0-9]', '', 'g') || '000000', 1, 2) || ':' ||\n"
                    "      SUBSTR(REGEXP_REPLACE(COALESCE(CAST(StudyTime AS VARCHAR), ''), '[^0-9]', '', 'g') || '000000', 3, 2) || ':' ||\n"
                    "      SUBSTR(REGEXP_REPLACE(COALESCE(CAST(StudyTime AS VARCHAR), ''), '[^0-9]', '', 'g') || '000000', 5, 2)\n"
                    "    AS TIMESTAMP) AS study_datetime\n"
                    "  FROM read_csv_auto('D:/physionet/mimic-cxr-jpg/mimic-cxr-2.0.0-metadata.csv.gz', header=true)\n"
                    ")\n"
                    "SELECT r.subject_id, r.study_id, metadata.study_datetime, r.report_text\n"
                    "FROM read_csv_auto('D:/physionet/mimic-cxr/cxr_reports.csv.gz', header=true) r\n"
                    "JOIN metadata USING(subject_id, study_id)\n"
                    f"WHERE TRY_CAST(r.subject_id AS BIGINT) = {int(subject_id)}"
                    + (f" AND {time_filter}" if time_filter else "")
                    + f"\n{order_clause}\n"
                    "LIMIT 20;"
                ),
            }
        )

    if signal == "ecg_12_lead" and subject_id:
        time_filter = _time_window_filter(ordertime, "ecg_time")
        where = [f"TRY_CAST(subject_id AS BIGINT) = {int(subject_id)}"]
        if time_filter:
            where.append(time_filter)
        order_clause = _query_order_by_time(ordertime, "ecg_time")
        queries.append(
            {
                "label": "Find temporally plausible MIMIC-IV-ECG machine measurements",
                "source_module": "MIMIC-IV-ECG",
                "path_hint": "D:/physionet/mimic-iv-ecg/machine_measurements.csv.gz",
                "tool": "duckdb",
                "sql": (
                    "SELECT subject_id, study_id, ecg_time, heart_rate, rr_interval, qrs_duration, qtc, report_0, report_1\n"
                    "FROM read_csv_auto('D:/physionet/mimic-iv-ecg/machine_measurements.csv.gz', header=true)\n"
                    f"WHERE {' AND '.join(where)}\n"
                    f"{order_clause}\n"
                    "LIMIT 20;"
                ),
            }
        )
        queries.append(
            {
                "label": "Cross-check MIMIC-IV-ECG record-list path provenance",
                "source_module": "MIMIC-IV-ECG",
                "path_hint": "D:/physionet/mimic-iv-ecg/record-list.csv.gz",
                "tool": "duckdb",
                "sql": (
                    "SELECT subject_id, study_id, ecg_time, path\n"
                    "FROM read_csv_auto('D:/physionet/mimic-iv-ecg/record-list.csv.gz', header=true)\n"
                    f"WHERE TRY_CAST(subject_id AS BIGINT) = {int(subject_id)}\n"
                    f"{order_clause}\n"
                    "LIMIT 20;"
                ),
            }
        )

    return queries


def _radiology_query_filter(signal: str) -> str:
    if signal in {"ct_imaging_order", "ct_abdomen_pelvis_with_contrast"}:
        pattern = "ct|computed tomography|abdomen|pelvis|abdominal"
    elif signal in {"ultrasound_order", "ultrasound_ruq"}:
        pattern = "ultrasound|right upper quadrant|ruq|gallbladder|biliary"
    elif signal == "chest_xray":
        pattern = "chest|portable|x-?ray|radiograph"
    else:
        return ""
    return f"REGEXP_MATCHES(LOWER(COALESCE(CAST(text AS VARCHAR), '')), {_sql_string(pattern)})"


def _query_order_by_time(ordertime: str, column: str) -> str:
    timestamp = _timestamp_literal(ordertime)
    if not timestamp:
        return f"ORDER BY TRY_CAST({column} AS TIMESTAMP)"
    return f"ORDER BY ABS(DATE_DIFF('second', TRY_CAST({column} AS TIMESTAMP), {timestamp}))"


def _time_window_filter(ordertime: str, column: str) -> str:
    timestamp = _timestamp_literal(ordertime)
    if not timestamp:
        return ""
    return f"TRY_CAST({column} AS TIMESTAMP) BETWEEN {timestamp} - INTERVAL '12 hours' AND {timestamp} + INTERVAL '12 hours'"


def _timestamp_literal(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return f"TIMESTAMP {_sql_string(text.replace('T', ' '))}"


def _sql_string(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def _clean_identifier(value: Any) -> str:
    text = str(value or "").strip()
    if text.endswith(".0"):
        return text[:-2]
    return text


def _main() -> int:
    parser = argparse.ArgumentParser(description="Report source-recorded order signals that still need linked result text.")
    parser.add_argument("case", type=Path, help="PreparedCase JSON.")
    parser.add_argument("--output", type=Path, help="Optional JSON report path.")
    parser.add_argument("--template-output", type=Path, help="Optional supplemental-results template JSON path.")
    args = parser.parse_args()

    case = PreparedCase.model_validate_json(args.case.read_text(encoding="utf-8"))
    report = build_source_gap_report(case)
    rendered = report.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    if args.template_output:
        args.template_output.parent.mkdir(parents=True, exist_ok=True)
        args.template_output.write_text(
            json.dumps(report.supplemental_results_payload_template, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
    return 0 if not report.missing_documented_order_results else 1


if __name__ == "__main__":
    raise SystemExit(_main())
