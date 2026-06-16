from __future__ import annotations

import argparse
import json
import math
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from backend.cases.prepare import CasePreparationError, prepare_raw_encounter
from backend.cases.schemas import PreparedCase
from backend.orders.catalog import get_order


ABDOMINAL_TERMS = (
    "abd pain",
    "abdominal",
    "abdomen",
    "belly",
    "epigastric",
    "right upper quadrant",
    "ruq",
    "flank",
)

LAB_LABELS_BY_ORDER = {
    "cbc": (
        "white blood cells",
        "hemoglobin",
        "hematocrit",
        "platelet count",
    ),
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
    "cmp": (
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
    "lactate": ("lactate", "lactic acid"),
    "coagulation_panel": ("inr", "ptt", "pt", "fibrinogen"),
    "magnesium": ("magnesium",),
    "point_of_care_glucose": ("glucose",),
}


def load_enriched_cases(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict) and isinstance(payload.get("cases"), list):
        return payload["cases"]
    if isinstance(payload, list):
        return payload
    raise CasePreparationError("Expected a MIMIC-IV-Ext enriched JSON object with a cases list.")


def find_enriched_case(cases: Iterable[dict[str, Any]], case_id: str) -> dict[str, Any]:
    for case in cases:
        if str(case.get("id") or case.get("case_id") or "") == case_id:
            return case
    raise CasePreparationError(f"Case id not found in enriched file: {case_id}")


def prepare_mimic_ext_case(enriched_case: dict[str, Any], supplemental_results: dict[str, Any] | list[dict[str, Any]] | None = None) -> PreparedCase:
    raw = normalize_mimic_ext_case(enriched_case)
    if supplemental_results:
        raw = attach_supplemental_results(raw, supplemental_results)
    return prepare_raw_encounter(raw)


def load_supplemental_results(path: Path) -> dict[str, Any] | list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, (dict, list)):
        raise CasePreparationError("Supplemental results must be a JSON object or list.")
    return payload


def attach_supplemental_results(raw: dict[str, Any], payload: dict[str, Any] | list[dict[str, Any]]) -> dict[str, Any]:
    """Attach operator-supplied result snippets that are still traceable to MIMIC source rows."""

    updated = json.loads(json.dumps(raw))
    case_id = str(updated.get("case_id") or "")
    entries, replace_existing = _supplemental_entries_for_case(payload, case_id)
    if not entries:
        return updated

    result_bundles = updated.setdefault("result_bundles", {})
    for entry in entries:
        if not isinstance(entry, dict):
            raise CasePreparationError("Each supplemental result must be a JSON object.")
        order_id = str(entry.get("order_id") or "").strip()
        order = get_order(order_id)
        if order is None:
            raise CasePreparationError(f"Supplemental result references unknown order_id: {order_id}")
        if order_id in result_bundles and not replace_existing:
            raise CasePreparationError(f"Supplemental result would overwrite existing source result: {order_id}")

        source = str(entry.get("source") or entry.get("source_module") or "").strip()
        if "mimic" not in source.lower():
            raise CasePreparationError(f"Supplemental result for {order_id} must name a MIMIC source.")
        _reject_unfilled_supplemental_placeholders(order_id, entry)

        source_reference = _supplemental_source_reference(entry)
        if not source_reference:
            raise CasePreparationError(f"Supplemental result for {order_id} requires a source_reference or source row identifier.")
        _validate_supplemental_source_reference(updated, order_id, source_reference)
        _validate_releaseable_result_source(order_id, source, source_reference)

        narrative = _first_text(entry, "narrative", "report", "report_text", "report_snippet", "text", "text_snippet", "impression", "findings")
        values = entry.get("values") or []
        if not narrative and not values:
            raise CasePreparationError(f"Supplemental result for {order_id} requires narrative text or structured values.")
        if not isinstance(values, list):
            raise CasePreparationError(f"Supplemental result values for {order_id} must be a list.")

        result_bundles[order_id] = {
            "display_name": order.name,
            "values": values,
            "narrative": narrative,
            "source": source,
            "source_reference": source_reference,
        }

    _refresh_source_evidence_audit(updated)
    return updated


def _reject_unfilled_supplemental_placeholders(order_id: str, entry: dict[str, Any]) -> None:
    placeholder_locations = _placeholder_locations(entry)
    if placeholder_locations:
        raise CasePreparationError(
            f"Supplemental result for {order_id} contains unfilled template placeholders: "
            + ", ".join(placeholder_locations)
        )


def _placeholder_locations(value: Any, path: str = "entry") -> list[str]:
    if isinstance(value, dict):
        locations: list[str] = []
        for key, item in value.items():
            locations.extend(_placeholder_locations(item, f"{path}.{key}"))
        return locations
    if isinstance(value, list):
        locations = []
        for index, item in enumerate(value):
            locations.extend(_placeholder_locations(item, f"{path}[{index}]"))
        return locations
    if isinstance(value, str) and _is_unfilled_template_text(value):
        return [path]
    return []


def _is_unfilled_template_text(value: str) -> bool:
    text = " ".join(value.strip().lower().split())
    return (
        text.startswith("replace-with")
        or "paste only the local source-recorded" in text
        or "replace with" in text
    )


def attach_raw_cxr_reports(enriched_case: dict[str, Any], raw_reports_dir: Path, limit: int = 5) -> dict[str, Any]:
    """Attach subject-level raw MIMIC-CXR snippets as manual candidates only."""

    identifiers = enriched_case.get("identifiers") or {}
    subject_id = str(identifiers.get("subject_id") or "").strip()
    if not subject_id:
        ed_stay = _first_nested(enriched_case, "linked_context", "ed", "edstays") or {}
        subject_id = str(_pick(ed_stay, "subject_id") or "").strip()
    if not subject_id:
        return enriched_case

    subject_id = subject_id.split(".", 1)[0]
    files_dir = raw_reports_dir / "files" if (raw_reports_dir / "files").is_dir() else raw_reports_dir
    subject_dir = files_dir / f"p{subject_id[:2]}" / f"p{subject_id}"
    if not subject_dir.is_dir():
        return enriched_case

    report_rows = []
    for report_path in sorted(subject_dir.glob("s*.txt"))[:limit]:
        report_rows.append(
            {
                "subject_id": subject_id,
                "study_id": report_path.stem.removeprefix("s"),
                "report_snippet": " ".join(report_path.read_text(encoding="utf-8", errors="replace").split())[:900],
                "source_format": "mimic-cxr-raw-text",
                "source_file": str(report_path),
                "encounter_link_status": "subject_only",
                "requires_manual_verification": True,
            }
        )
    if not report_rows:
        return enriched_case

    updated = json.loads(json.dumps(enriched_case))
    linked_context = updated.setdefault("linked_context", {})
    cxr_context = linked_context.setdefault("cxr", {})
    cxr_context["reports"] = [*cxr_context.get("reports", []), *report_rows]
    return updated


def normalize_mimic_ext_case(enriched_case: dict[str, Any]) -> dict[str, Any]:
    case_id = str(enriched_case.get("id") or enriched_case.get("case_id") or "").strip()
    if not case_id:
        raise CasePreparationError("Enriched case is missing id.")

    triage = _first_nested(enriched_case, "linked_context", "ed", "triage") or {}
    vitals_source = _presenting_vitals_source(enriched_case, triage)
    vitals = _vitals_from_source(vitals_source)
    demographics = _demographics_from_source(enriched_case)
    complaint = str(enriched_case.get("complaint") or triage.get("chiefcomplaint") or "").strip()
    if not complaint:
        raise CasePreparationError(f"{case_id} is missing a chief complaint.")

    hidden_truth = _hidden_truth_from_source(enriched_case)
    result_bundles = _result_bundles_from_source(enriched_case)
    title = _case_title(demographics, complaint)

    raw = {
        "case_id": case_id,
        "title": title,
        "source": f"mimic-iv-ext-cds-local:{case_id}",
        "visible_start": {
            "chief_complaint": complaint,
            "demographics": demographics,
            "presenting_vitals": vitals,
            "triage_context": _triage_context(enriched_case, demographics, vitals, vitals_source),
            "appearance": _appearance(complaint, vitals),
        },
        "source_evidence_audit": _source_evidence_audit(enriched_case, result_bundles),
        "hpi_facts": _hpi_facts(enriched_case, vitals),
        "exam_facts": _exam_facts(complaint, vitals),
        "result_bundles": result_bundles,
        "hidden_truth": hidden_truth,
        "trajectory": _trajectory_for_abdominal_case(vitals),
        "real_timeline": _real_timeline(enriched_case),
        "rubric": _rubric_for_abdominal_case(vitals, hidden_truth),
        "evidence_corpus": _evidence_corpus_for_abdominal_case(hidden_truth),
        "review_status": {
            "trajectory_clinician_signed_off": False,
            "grader_clinician_validated": False,
            "notes": [
                "Prepared from local credentialed source rows; requires clinician trajectory signoff.",
                "Grader validation must pass against a clinician answer key before learner use.",
            ],
        },
    }
    return raw


VITAL_FIELD_ALIASES = {
    "temperature": ("temperature", "temp"),
    "heartrate": ("heartrate", "hr"),
    "resprate": ("resprate", "rr"),
    "o2sat": ("o2sat", "o2", "spo2"),
    "sbp": ("sbp",),
    "dbp": ("dbp",),
    "pain": ("pain",),
}


def _presenting_vitals_source(enriched_case: dict[str, Any], triage: dict[str, Any]) -> dict[str, Any]:
    source = dict(triage or enriched_case.get("vitals") or {})
    repeat_rows = _nested(enriched_case, "linked_context", "ed", "repeat_vitals") or []
    if not isinstance(repeat_rows, list):
        repeat_rows = []
    filled: list[str] = []
    for target_key, aliases in VITAL_FIELD_ALIASES.items():
        if _valid_vital_value(_pick(source, *aliases), target_key):
            continue
        for row in repeat_rows:
            if not isinstance(row, dict):
                continue
            value = _pick(row, *aliases)
            if not _valid_vital_value(value, target_key):
                continue
            source[target_key] = value
            charttime = _clean_string(row.get("charttime"))
            filled.append(f"{_vital_label(target_key)} from ed.vitalsign{f' at {charttime}' if charttime else ''}")
            break
    if filled:
        source["_vitals_source_note"] = (
            "Missing triage vital fields filled from same-encounter MIMIC-IV-ED source rows: "
            + "; ".join(filled)
            + "."
        )
    return source


def _valid_vital_value(value: Any, key: str) -> bool:
    number = _number(value)
    if number is None:
        return False
    if key == "pain":
        return 0 <= number <= 10
    if key == "o2sat":
        return 0 <= number <= 100
    return True


def _vital_label(key: str) -> str:
    return {
        "temperature": "temperature",
        "heartrate": "heart rate",
        "resprate": "respiratory rate",
        "o2sat": "oxygen saturation",
        "sbp": "systolic blood pressure",
        "dbp": "diastolic blood pressure",
        "pain": "pain score",
    }.get(key, key)


def _source_evidence_audit(enriched_case: dict[str, Any], result_bundles: dict[str, Any]) -> dict[str, Any]:
    result_ids = set(result_bundles)
    signals: list[str] = []
    details: list[dict[str, Any]] = []
    for row in _objective_values(enriched_case, "imaging_orders"):
        row_signals = _order_signals_from_source_row(row)
        signals.extend(row_signals)
        details.extend(_documented_order_details(row, row_signals))
    for row in _objective_values(enriched_case, "ecg"):
        if row:
            signals.append("ecg_12_lead")
            details.extend(_documented_order_details(row, ["ecg_12_lead"]))

    unique_signals = sorted(dict.fromkeys(signals))
    without_results = sorted(signal for signal in unique_signals if not _order_signal_has_result(signal, result_ids))
    return {
        "source_identifiers": _source_identifiers(enriched_case),
        "result_bundle_ids": sorted(result_ids),
        "documented_order_signals": unique_signals,
        "documented_orders_without_results": without_results,
        "documented_order_details": details,
    }


def _supplemental_entries_for_case(payload: dict[str, Any] | list[dict[str, Any]], case_id: str) -> tuple[list[dict[str, Any]], bool]:
    if isinstance(payload, list):
        entries = []
        for entry in payload:
            if not isinstance(entry, dict):
                raise CasePreparationError("Each supplemental result must be a JSON object.")
            if str(entry.get("case_id") or case_id) == case_id:
                entries.append(entry)
        return entries, False

    replace_existing = bool(payload.get("replace_existing"))
    if "cases" in payload:
        cases = payload.get("cases") or {}
        if isinstance(cases, dict):
            case_payload = cases.get(case_id) or {}
            if isinstance(case_payload, dict):
                return list(case_payload.get("results") or []), replace_existing
            if isinstance(case_payload, list):
                return list(case_payload), replace_existing
        if isinstance(cases, list):
            return [entry for entry in cases if str(entry.get("case_id") or "") == case_id], replace_existing
        raise CasePreparationError("Supplemental cases must be an object or list.")

    payload_case_id = str(payload.get("case_id") or case_id)
    if payload_case_id != case_id:
        raise CasePreparationError(f"Supplemental results case_id {payload_case_id!r} does not match prepared case {case_id!r}.")
    entries = payload.get("results")
    if entries is None:
        entries = [payload] if payload.get("order_id") else []
    if not isinstance(entries, list):
        raise CasePreparationError("Supplemental results must be a list.")
    return list(entries), replace_existing


def _supplemental_source_reference(entry: dict[str, Any]) -> dict[str, Any]:
    reference = entry.get("source_reference")
    if isinstance(reference, dict) and reference:
        return reference
    keys = (
        "source_file",
        "note_id",
        "study_id",
        "subject_id",
        "hadm_id",
        "charttime",
        "storetime",
        "ordertime",
        "poe_id",
        "poe_seq",
        "source_module",
    )
    return {key: entry[key] for key in keys if key in entry and entry[key] not in (None, "")}


def _validate_supplemental_source_reference(raw: dict[str, Any], order_id: str, source_reference: dict[str, Any]) -> None:
    audit = raw.get("source_evidence_audit") or {}
    identifiers = audit.get("source_identifiers") or {}
    identifier_keys = ("subject_id", "hadm_id", "stay_id")
    case_ids = {
        key: _clean_identifier(identifiers.get(key))
        for key in identifier_keys
        if _clean_identifier(identifiers.get(key))
    }
    reference_ids = {
        key: _clean_identifier(source_reference.get(key))
        for key in identifier_keys
        if _clean_identifier(source_reference.get(key))
    }

    mismatches = [
        f"{key}={reference_ids[key]} expected {case_ids[key]}"
        for key in sorted(reference_ids)
        if key in case_ids and reference_ids[key] != case_ids[key]
    ]
    if mismatches:
        raise CasePreparationError(
            f"Supplemental result for {order_id} source_reference does not match case source identifiers: "
            + ", ".join(mismatches)
        )
    if case_ids and not any(key in reference_ids for key in case_ids):
        raise CasePreparationError(
            f"Supplemental result for {order_id} source_reference must include at least one matching case identifier "
            "(subject_id, hadm_id, or stay_id)."
        )

    matching_order_details = [
        detail
        for detail in audit.get("documented_order_details", [])
        if isinstance(detail, dict) and order_id in set(str(item) for item in detail.get("candidate_order_ids", []))
    ]
    if not matching_order_details:
        return

    reference_poe_id = _clean_identifier(source_reference.get("poe_id"))
    if reference_poe_id:
        allowed_poe_ids = {
            _clean_identifier(detail.get("poe_id"))
            for detail in matching_order_details
            if _clean_identifier(detail.get("poe_id"))
        }
        if allowed_poe_ids and reference_poe_id not in allowed_poe_ids:
            raise CasePreparationError(
                f"Supplemental result for {order_id} source_reference poe_id={reference_poe_id} "
                f"does not match documented source order provenance."
            )

    reference_poe_seq = _clean_identifier(source_reference.get("poe_seq"))
    if reference_poe_seq:
        allowed_poe_seqs = {
            _clean_identifier(detail.get("poe_seq"))
            for detail in matching_order_details
            if _clean_identifier(detail.get("poe_seq"))
        }
        if allowed_poe_seqs and reference_poe_seq not in allowed_poe_seqs:
            raise CasePreparationError(
                f"Supplemental result for {order_id} source_reference poe_seq={reference_poe_seq} "
                f"does not match documented source order provenance."
            )


def _validate_releaseable_result_source(order_id: str, source: str, source_reference: dict[str, Any]) -> None:
    reference_text = " ".join(
        str(value)
        for value in (
            source,
            source_reference.get("source_module"),
            source_reference.get("source_format"),
            source_reference.get("source_file"),
        )
        if value not in (None, "")
    ).lower()
    if order_id != "chest_xray" or "mimic-cxr" not in reference_text:
        return
    if _source_reference_has_encounter_link(source_reference):
        return
    raise CasePreparationError(
        "Supplemental chest_xray result from MIMIC-CXR must include encounter-linked study metadata "
        "(for example metadata_file plus match_distance_seconds) before it can become a learner-visible result."
    )


def _source_reference_has_encounter_link(source_reference: dict[str, Any]) -> bool:
    if _mapping_has_encounter_link(source_reference):
        return True
    rows = source_reference.get("rows")
    if isinstance(rows, list):
        return any(isinstance(row, dict) and _mapping_has_encounter_link(row) for row in rows)
    return False


def _mapping_has_encounter_link(value: dict[str, Any]) -> bool:
    status = (_clean_string(value.get("encounter_link_status")) or "").lower()
    manual = (_clean_string(value.get("requires_manual_verification")) or "").lower()
    if manual == "true":
        return False
    if status == "encounter_linked":
        return True
    has_metadata = _reference_value_present(value.get("metadata_file"))
    has_time_link = _reference_value_present(value.get("match_distance_seconds")) or _reference_value_present(value.get("charttime"))
    return has_metadata and has_time_link


def _refresh_source_evidence_audit(raw: dict[str, Any]) -> None:
    result_ids = set(raw.get("result_bundles") or {})
    audit = raw.setdefault("source_evidence_audit", {})
    signals = sorted(dict.fromkeys(str(item) for item in audit.get("documented_order_signals", []) if item))
    audit["result_bundle_ids"] = sorted(result_ids)
    audit["documented_order_signals"] = signals
    audit["documented_orders_without_results"] = sorted(signal for signal in signals if not _order_signal_has_result(signal, result_ids))


def _source_identifiers(enriched_case: dict[str, Any]) -> dict[str, Any]:
    identifiers = enriched_case.get("identifiers") or {}
    keys = ("subject_id", "hadm_id", "stay_id", "intime", "outtime")
    return {key: identifiers[key] for key in keys if identifiers.get(key) not in (None, "")}


def _documented_order_details(row: dict[str, Any], signals: list[str]) -> list[dict[str, Any]]:
    if not signals:
        return []
    keys = (
        "poe_id",
        "poe_seq",
        "subject_id",
        "hadm_id",
        "stay_id",
        "ordertime",
        "charttime",
        "study_id",
        "order_type",
        "order_subtype",
        "transaction_type",
        "order_status",
        "clinical_class",
        "clinical_class_label",
        "source_module",
        "source_file",
    )
    base = {key: row[key] for key in keys if key in row and row[key] not in (None, "")}
    return [
        {
            "signal": signal,
            "candidate_order_ids": _candidate_order_ids_for_signal(signal),
            **base,
        }
        for signal in signals
    ]


def _candidate_order_ids_for_signal(signal: str) -> list[str]:
    if signal == "chest_xray":
        return ["chest_xray"]
    if signal == "ct_imaging_order":
        return ["ct_abdomen_pelvis_with_contrast", "ct_pulmonary_angiography", "ct_head_without_contrast", "ct_cervical_spine"]
    if signal == "ultrasound_order":
        return ["ultrasound_ruq"]
    if signal == "imaging_order":
        return ["chest_xray", "ct_abdomen_pelvis_with_contrast", "ultrasound_ruq"]
    return [signal]


def _order_signals_from_source_row(row: dict[str, Any]) -> list[str]:
    label = " ".join(
        str(row.get(key) or "")
        for key in ("order_type", "order_subtype", "clinical_class", "clinical_class_label", "study_description", "description", "exam_name", "modality")
    ).lower()
    signals: list[str] = []
    if "ecg" in label or "ekg" in label or "electrocardiogram" in label:
        signals.append("ecg_12_lead")
    if "chest" in label and ("xray" in label or "x-ray" in label or "radiograph" in label):
        signals.append("chest_xray")
    if "ct" in label or "computed tomography" in label:
        if any(term in label for term in ("abd", "abdomen", "abdominal", "pelvis", "a/p")):
            signals.append("ct_abdomen_pelvis_with_contrast")
        else:
            signals.append("ct_imaging_order")
    if "ultrasound" in label or "sonogram" in label:
        if any(term in label for term in ("ruq", "right upper quadrant", "gallbladder", "biliary", "abd", "abdomen", "abdominal")):
            signals.append("ultrasound_ruq")
        else:
            signals.append("ultrasound_order")
    if not signals and any(term in label for term in ("radiology", "imaging", "xray", "x-ray")):
        signals.append("imaging_order")
    return signals


def _order_signal_has_result(signal: str, result_ids: set[str]) -> bool:
    if signal in result_ids:
        return True
    if signal == "ct_imaging_order":
        return any(order_id.startswith("ct_") for order_id in result_ids)
    if signal == "ultrasound_order":
        return any(order_id.startswith("ultrasound_") for order_id in result_ids)
    if signal == "imaging_order":
        return any(order_id in result_ids for order_id in ("chest_xray", "ct_abdomen_pelvis_with_contrast", "ultrasound_ruq"))
    return False


def _vitals_from_source(source: dict[str, Any]) -> dict[str, Any]:
    temp = _required_number(_pick(source, "temperature", "temp"), "temperature")
    if temp > 45:
        temp = (temp - 32) * 5 / 9

    pain_raw = _pick(source, "pain")
    pain = _number(pain_raw)
    if pain is None:
        pain = 0
    if pain < 0 or pain > 10:
        raise CasePreparationError(f"pain score outside 0-10 range: {pain_raw!r}")

    return {
        "temp_c": round(temp, 1),
        "hr": int(round(_required_number(_pick(source, "heartrate", "hr"), "heart rate"))),
        "sbp": int(round(_required_number(_pick(source, "sbp"), "systolic blood pressure"))),
        "dbp": int(round(_required_number(_pick(source, "dbp"), "diastolic blood pressure"))),
        "rr": int(round(_required_number(_pick(source, "resprate", "rr"), "respiratory rate"))),
        "spo2": int(round(_required_number(_pick(source, "o2sat", "o2", "spo2"), "oxygen saturation"))),
        "pain": int(round(pain)),
    }


def _demographics_from_source(enriched_case: dict[str, Any]) -> dict[str, Any]:
    raw = enriched_case.get("demographics") or {}
    age = _number(raw.get("age"))
    sex = str(raw.get("sex") or raw.get("gender") or "").strip().upper()
    transport = str(raw.get("transport") or raw.get("arrival_transport") or "").strip()
    demographics: dict[str, Any] = {}
    if age is not None:
        demographics["age"] = int(age)
    if sex:
        demographics["sex"] = "female" if sex.startswith("F") else "male" if sex.startswith("M") else sex
    if transport:
        demographics["arrival_transport"] = transport
    return demographics


def _hidden_truth_from_source(enriched_case: dict[str, Any]) -> dict[str, Any]:
    ground_truth = enriched_case.get("ground_truth") or {}
    diagnosis = _select_final_diagnosis(enriched_case)
    esi = int(round(_required_number(ground_truth.get("reference_esi") or enriched_case.get("acuity"), "reference ESI")))
    disposition = str(ground_truth.get("disposition") or enriched_case.get("disposition") or "").strip()
    if not disposition:
        raise CasePreparationError("Ground-truth disposition is missing.")
    return {
        "final_diagnosis": diagnosis,
        "validated_esi": esi,
        "actual_disposition": disposition,
        "clinician_key_points": [
            "Severe abdominal pain with distention warrants early acuity commitment and reassessment.",
            "Structured orders must return only source-recorded results; missing reports stay unavailable.",
            "Disposition and diagnostic accuracy are graded only after encounter completion.",
        ],
    }


def _select_final_diagnosis(enriched_case: dict[str, Any]) -> str:
    diagnoses = enriched_case.get("ground_truth", {}).get("diagnoses", {})
    candidates: list[str] = []
    if isinstance(diagnoses, dict):
        candidates.extend(str(item) for item in diagnoses.get("primary") or [])
        candidates.extend(str(item) for item in diagnoses.get("secondary") or [])
    for row in enriched_case.get("retrospective_ground_truth", {}).get("hospital_icd") or []:
        candidates.append(str(row.get("long_title") or row.get("icd_title") or ""))
    for row in enriched_case.get("retrospective_ground_truth", {}).get("ed_icd") or []:
        candidates.append(str(row.get("long_title") or row.get("icd_title") or ""))

    cleaned = [" ".join(item.split()) for item in candidates if item and item.strip()]
    if not cleaned:
        raise CasePreparationError("No diagnosis found in ground truth.")

    generic_markers = ("pain", "unspecified site", "symptom", "other specified")
    for item in cleaned:
        normalized = item.lower()
        if not any(marker in normalized for marker in generic_markers):
            return item
    return cleaned[0]


def _result_bundles_from_source(enriched_case: dict[str, Any]) -> dict[str, Any]:
    bundles: dict[str, Any] = {}
    lab_rows = _objective_values(enriched_case, "labs")
    poc_rows = _objective_values(enriched_case, "poc_glucose")
    all_lab_rows = [*lab_rows, *poc_rows]
    for order_id, label_needles in LAB_LABELS_BY_ORDER.items():
        rows = poc_rows if order_id == "point_of_care_glucose" else all_lab_rows
        source_rows = _result_source_rows_for_labels(rows, label_needles)
        values = _result_values_for_labels(rows, label_needles)
        if values:
            order = get_order(order_id)
            bundles[order_id] = {
                "display_name": order.name if order else order_id.replace("_", " ").title(),
                "values": values,
                "narrative": f"Source-recorded values for {order.name if order else order_id}.",
                "source": "mimic",
                "source_reference": _bundle_source_reference(enriched_case, "MIMIC-IV hosp.labevents", source_rows),
            }

    radiology_results = _radiology_results(enriched_case)
    for order_id, result in radiology_results.items():
        order = get_order(order_id)
        bundles[order_id] = {
            "display_name": order.name if order else order_id.replace("_", " ").title(),
            "values": [],
            "narrative": result["narrative"],
            "source": "mimic",
            "source_reference": _bundle_source_reference(enriched_case, "MIMIC-IV-Note radiology or MIMIC-CXR", [result["row"]]),
        }

    ecg_bundle = _ecg_result_bundle(enriched_case)
    if ecg_bundle:
        bundles["ecg_12_lead"] = ecg_bundle

    return bundles


def _result_values_for_labels(rows: list[dict[str, Any]], label_needles: tuple[str, ...]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result_values: list[dict[str, Any]] = []
    for row in sorted(rows, key=lambda item: str(item.get("charttime") or item.get("storetime") or "")):
        label = str(row.get("label") or row.get("test_name") or "").strip()
        normalized = _normalize_label(label)
        if not label or normalized in seen:
            continue
        if not any(needle in normalized for needle in label_needles):
            continue
        value = _display_value(row)
        if value is None:
            continue
        seen.add(normalized)
        result_values.append(
            {
                "name": label,
                "value": value,
                "unit": _clean_string(row.get("valueuom")),
                "flag": _result_flag(row),
                "reference_range": _reference_range(row),
            }
        )
    return result_values


def _result_source_rows_for_labels(rows: list[dict[str, Any]], label_needles: tuple[str, ...]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    selected: list[dict[str, Any]] = []
    for row in sorted(rows, key=lambda item: str(item.get("charttime") or item.get("storetime") or "")):
        label = str(row.get("label") or row.get("test_name") or "").strip()
        normalized = _normalize_label(label)
        if not label or normalized in seen:
            continue
        if not any(needle in normalized for needle in label_needles):
            continue
        if _display_value(row) is None:
            continue
        seen.add(normalized)
        selected.append(row)
    return selected


def _bundle_source_reference(enriched_case: dict[str, Any], source_module: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    reference = {
        "source_module": source_module,
        "case_identifiers": _source_identifiers(enriched_case),
        "rows": [_compact_source_row_reference(row) for row in rows],
    }
    reference["rows"] = [row for row in reference["rows"] if row]
    return reference


def _compact_source_row_reference(row: dict[str, Any]) -> dict[str, Any]:
    keys = (
        "subject_id",
        "hadm_id",
        "stay_id",
        "specimen_id",
        "itemid",
        "label",
        "test_name",
        "charttime",
        "storetime",
        "poe_id",
        "poe_seq",
        "ordertime",
        "note_id",
        "study_id",
        "ecg_time",
        "source_file",
        "source_format",
        "source_module",
        "metadata_file",
        "match_distance_seconds",
        "encounter_link_status",
        "requires_manual_verification",
        "study_description",
        "description",
        "exam_name",
        "modality",
        "path",
    )
    compact: dict[str, Any] = {}
    for key in keys:
        value = row.get(key)
        if _reference_value_present(value):
            compact[key] = value
    return compact


def _reference_value_present(value: Any) -> bool:
    if value in (None, ""):
        return False
    if isinstance(value, float) and math.isnan(value):
        return False
    return True


def _radiology_narratives(enriched_case: dict[str, Any]) -> dict[str, str]:
    return {order_id: result["narrative"] for order_id, result in _radiology_results(enriched_case).items()}


def _radiology_results(enriched_case: dict[str, Any]) -> dict[str, dict[str, Any]]:
    narratives: dict[str, str] = {}
    rows_by_order: dict[str, dict[str, Any]] = {}
    note_rows = _nested(enriched_case, "linked_context", "note", "radiology") or []
    report_rows = _nested(enriched_case, "linked_context", "cxr", "reports") or []
    for row in [*note_rows, *report_rows]:
        text = _first_text(row, "text", "report", "report_text", "report_snippet", "note_text", "impression", "findings")
        if not text:
            continue
        if not _radiology_row_is_releaseable(row):
            continue
        label = " ".join(str(row.get(key) or "") for key in ("study_description", "description", "exam_name", "modality")).lower()
        if "ultrasound" in label or "gallbladder" in label or "right upper quadrant" in label:
            order_id = "ultrasound_ruq"
        elif "abd" in label or "pelvis" in label or "ct" in label:
            order_id = "ct_abdomen_pelvis_with_contrast"
        elif "chest" in label or "xray" in label or "x-ray" in label or row.get("source_format") == "mimic-cxr-raw-text":
            order_id = "chest_xray"
        else:
            continue
        if order_id not in narratives:
            narratives[order_id] = text
            rows_by_order[order_id] = row
    return {
        order_id: {
            "narrative": narrative,
            "row": rows_by_order[order_id],
        }
        for order_id, narrative in narratives.items()
    }


def _radiology_row_is_releaseable(row: dict[str, Any]) -> bool:
    if not _is_mimic_cxr_raw_row(row):
        return True
    return _mapping_has_encounter_link(row)


def _is_mimic_cxr_raw_row(row: dict[str, Any]) -> bool:
    source_text = " ".join(
        str(row.get(key) or "")
        for key in ("source_format", "source_module", "source", "source_file")
    ).lower()
    return "mimic-cxr" in source_text or "mimic_cxr" in source_text


def _ecg_result_bundle(enriched_case: dict[str, Any]) -> dict[str, Any] | None:
    rows = _objective_values(enriched_case, "ecg")
    if not rows:
        return None

    result_values: list[dict[str, Any]] = []
    narratives: list[str] = []
    seen: set[str] = set()
    for row in rows:
        report = _first_text(row, "machine_report", "report", "report_text", "text", "note_text")
        if report:
            narratives.append(report)
        for field, label, unit in (
            ("heart_rate", "ECG heart rate", "bpm"),
            ("rr_interval", "RR interval", "ms"),
            ("qrs_duration", "QRS duration", "ms"),
            ("qtc", "QTc", "ms"),
        ):
            value = _clean_string(row.get(field))
            if not value or field in seen:
                continue
            seen.add(field)
            result_values.append({"name": label, "value": value, "unit": unit})

    if not result_values and not narratives:
        return None

    order = get_order("ecg_12_lead")
    narrative = " ".join(dict.fromkeys(narratives))
    if not narrative and result_values:
        narrative = "Source ECG machine measurement values are available."
    return {
        "display_name": order.name if order else "12-lead ECG",
        "values": result_values,
        "narrative": narrative,
        "source": "mimic",
        "source_reference": _bundle_source_reference(enriched_case, "MIMIC-IV-ECG", rows),
    }


def _hpi_facts(enriched_case: dict[str, Any], vitals: dict[str, Any]) -> list[dict[str, Any]]:
    complaint = str(enriched_case.get("complaint") or "").strip()
    history = _clean_history(str(enriched_case.get("history") or ""))
    facts = [
        {
            "id": "chief_concern",
            "topic": "chief concern",
            "triggers": ["why", "here", "brought", "complaint", "problem"],
            "lay_response": _chief_concern_response(complaint),
            "clinician_note": complaint,
        },
        {
            "id": "pain_severity",
            "topic": "pain severity",
            "triggers": ["pain", "severity", "rate", "score", "bad"],
            "lay_response": f"The pain is about {vitals['pain']} out of 10.",
            "clinician_note": f"Triage pain score {vitals['pain']}/10.",
        },
    ]

    associated = _associated_symptom_response(history)
    if associated:
        associated_response, associated_triggers = associated
        facts.append(
            {
                "id": "associated_symptoms",
                "topic": "associated symptoms",
                "triggers": associated_triggers,
                "lay_response": associated_response,
                "clinician_note": history,
            }
        )

    allergy_response = _allergy_response(history)
    if allergy_response:
        facts.append(
            {
                "id": "allergies",
                "topic": "allergies",
                "triggers": ["allergy", "allergies", "allergic"],
                "lay_response": allergy_response,
                "clinician_note": history,
            }
        )

    medical_history = _medical_history_response(history)
    if medical_history:
        facts.append(
            {
                "id": "medical_history",
                "topic": "medical history",
                "triggers": ["history", "medical", "problems", "medications", "blood thinner", "surgery"],
                "lay_response": medical_history,
                "clinician_note": history,
            }
        )
    return facts


def _exam_facts(complaint: str, vitals: dict[str, Any]) -> list[dict[str, Any]]:
    facts = [
        {
            "id": "general_appearance",
            "maneuver_id": "general_inspection_appearance",
            "system": "general",
            "triggers": ["general", "appearance", "look", "inspect", "exam"],
            "finding": _appearance(complaint, vitals),
            "source": "triage appearance and vital signs",
        }
    ]
    normalized = complaint.lower()
    if any(term in normalized for term in ("abd", "abdominal", "abdomen", "belly", "distention")):
        facts.append(
            {
                "id": "abdominal_inspection",
                "maneuver_id": "abdomen_inspection_distention",
                "system": "abdomen",
                "triggers": [
                    "abdomen",
                    "abdominal",
                    "belly",
                    "inspect abdomen",
                    "distention",
                    "distended",
                    "look at abdomen",
                ],
                "finding": "Visible abdominal distention with severe discomfort.",
                "source": "chief complaint and triage appearance",
            }
        )
        facts.append(
            {
                "id": "abdominal_palpation_source_limited",
                "maneuver_id": "abdomen_palpation_light",
                "system": "abdomen",
                "triggers": [
                    "palpate",
                    "tender",
                    "tenderness",
                    "guarding",
                    "rebound",
                    "peritoneal",
                    "bowel sounds",
                    "abdominal exam",
                ],
                "finding": "Light palpation performed in all quadrants: markedly distended abdomen with diffuse tenderness, greatest across the lower abdomen; no involuntary guarding on light touch.",
                "source": "simulated focused abdominal exam",
            }
        )
    if int(vitals.get("hr") or 0) > 100:
        facts.append(
            {
                "id": "cardiac_rate",
                "maneuver_id": "cardiovascular_auscultation_heart_sounds",
                "system": "cardiac",
                "triggers": ["heart", "cardiac", "pulse", "pulses", "rate"],
                "finding": "Heart auscultated at standard listening posts: tachycardic with regular rhythm; no obvious murmur, rub, or gallop heard.",
                "source": "triage vital signs",
            }
        )
    if int(vitals.get("rr") or 0) > 20 or int(vitals.get("spo2") or 100) < 94:
        facts.append(
            {
                "id": "respiratory_effort",
                "maneuver_id": "respiratory_inspection_work_of_breathing",
                "system": "respiratory",
                "triggers": ["lung", "lungs", "breath sounds", "auscultate", "respiratory", "chest"],
                "finding": "Respirations observed at bedside: tachypneic with mildly increased work of breathing.",
                "source": "triage vital signs and appearance",
            }
        )
    return facts


def _trajectory_for_abdominal_case(vitals: dict[str, Any]) -> dict[str, Any]:
    rules = [
        {
            "id": "severe_pain_without_analgesia",
            "vital": "pain",
            "condition": {"above": 6, "absent_intervention": "analgesia"},
            "delta_per_minute": 0.05,
            "ceiling": min(10, max(7, int(vitals["pain"]))),
        },
        {
            "id": "analgesia_pain_response",
            "vital": "pain",
            "condition": {"above": 3, "present_intervention": "analgesia"},
            "delta_per_minute": -0.35,
            "floor": 3,
        },
        {
            "id": "pain_tachycardia_without_treatment",
            "vital": "hr",
            "condition": {"above": 95, "absent_intervention": "analgesia"},
            "delta_per_minute": 0.1,
            "ceiling": max(105, int(vitals["hr"]) + 10),
        },
        {
            "id": "fluid_support_for_borderline_pressure",
            "vital": "sbp",
            "condition": {"below": 110, "present_intervention": "iv_fluids"},
            "delta_per_minute": 0.4,
            "ceiling": 115,
        },
    ]
    return {"starting_vitals": vitals, "rules": rules}


def _rubric_for_abdominal_case(vitals: dict[str, Any], hidden_truth: dict[str, Any] | None = None) -> dict[str, Any]:
    final_diagnosis = str((hidden_truth or {}).get("final_diagnosis") or "").strip()
    expected_diagnoses = [final_diagnosis] if final_diagnosis else []
    obstructive_case = _is_obstructive_abdominal_diagnosis(final_diagnosis)
    expected_orders = ["cbc", "bmp", "lft", "lipase", "ct_abdomen_pelvis_with_contrast"]
    indicated_exams = [
        {
            "id": "general_inspection_appearance",
            "label": "General appearance",
            "why": "Severe abdominal pain requires early assessment of distress, toxicity, and trajectory change.",
            "early_minutes": 2,
            "evidence_terms": ["acute abdominal pain", "physical examination", "severe pain"],
        },
        {
            "id": "abdomen_inspection_distention",
            "label": "Abdominal inspection",
            "why": "Inspection for distention helps distinguish biliary, obstructive, and peritoneal branches.",
            "early_minutes": 4,
            "evidence_terms": ["abdominal examination", "inspection", "distention"],
        },
        {
            "id": "abdomen_palpation_light",
            "label": "Light abdominal palpation",
            "why": "Localizing tenderness is a discriminating maneuver in worsening abdominal pain.",
            "early_minutes": 5,
            "evidence_terms": ["abdominal examination", "palpation", "tenderness"],
        },
        {
            "id": "abdomen_palpation_guarding",
            "label": "Guarding",
            "why": "No assessment for guarding misses a peritoneal-sign screen that changes urgency and disposition.",
            "early_minutes": 6,
            "evidence_terms": ["guarding", "peritoneal", "acute abdomen"],
        },
        {
            "id": "abdomen_palpation_rebound",
            "label": "Rebound tenderness",
            "why": "No assessment for rebound misses a peritoneal-sign screen that changes urgency and disposition.",
            "early_minutes": 6,
            "evidence_terms": ["rebound", "peritoneal", "acute abdomen"],
        },
        {
            "id": "abdomen_auscultation_bowel_sounds",
            "label": "Bowel sounds",
            "why": "Bowel sounds contribute to the abdominal branch point for obstruction or ileus.",
            "evidence_terms": ["abdominal examination", "auscultation", "bowel sounds"],
        },
    ]
    if obstructive_case:
        indicated_exams.append(
            {
                "id": "abdomen_percussion_tympany",
                "label": "Abdominal percussion",
                "why": "Percussion helps characterize distention and supports the obstruction or ileus branch.",
                "evidence_terms": ["abdominal examination", "percussion", "distention"],
            }
        )
    else:
        expected_orders.append("ultrasound_ruq")
        indicated_exams.append(
            {
                "id": "abdomen_special_murphy",
                "label": "Murphy sign",
                "why": "Murphy sign is a targeted discriminating test for right-upper-quadrant biliary pathology.",
                "evidence_terms": ["Murphy", "biliary", "right upper quadrant"],
            }
        )
    return {
        "expected_diagnoses": expected_diagnoses,
        "expected_orders": expected_orders,
        "indicated_exams": indicated_exams,
        "indicated_interventions": [
            {
                "id": "cardiac_monitor",
                "label": "Monitor",
                "why": "Severe pain with tachycardia and ESI-2 acuity warrants early monitoring.",
                "early_minutes": 3,
                "evidence_terms": ["high risk", "monitoring", "emergency severity index"],
            },
            {
                "id": "iv_access",
                "label": "IV access",
                "why": "IV access supports analgesia, fluids, contrast imaging, and escalation if the patient worsens.",
                "early_minutes": 5,
                "evidence_terms": ["intravenous", "resources", "acute abdomen"],
            },
            {
                "id": "analgesia",
                "label": "Analgesia",
                "why": f"The presenting pain score is {vitals['pain']}/10 and the authored trajectory improves only after analgesia.",
                "early_minutes": 8,
                "evidence_terms": ["acute abdominal pain", "analgesia", "pain"],
            },
        ],
        "excessive_interventions": [
            {
                "id": "oxygen",
                "label": "Supplemental oxygen",
                "why": "Oxygen is not indicated by the authored abdominal case while SpO2 is normal and no respiratory distress is present.",
                "evidence_terms": ["oxygen", "hypoxemia"],
            }
        ],
        "critical_actions": ["cardiac_monitor", "iv_access", "analgesia"],
        "esi_tolerance": 0,
    }


def _evidence_corpus_for_abdominal_case(hidden_truth: dict[str, Any] | None = None) -> list[dict[str, str]]:
    final_diagnosis = str((hidden_truth or {}).get("final_diagnosis") or "").lower()
    passages = [
        {
            "id": "abdominal-exam",
            "title": "Abdominal examination maneuvers",
            "url": "https://en.wikipedia.org/wiki/Abdominal_examination",
            "text": (
                "Abdominal examination includes inspection, auscultation, palpation, and percussion. "
                "Palpation assesses tenderness, guarding, rigidity, rebound, and referred pain."
            ),
        },
        {
            "id": "peritoneal-signs",
            "title": "Peritoneal signs in acute abdominal pain",
            "url": "https://en.wikipedia.org/wiki/Peritonitis",
            "text": (
                "Peritoneal irritation can manifest as acute abdominal pain with tenderness, guarding, rigidity, "
                "and rebound tenderness. These findings increase urgency and can affect disposition."
            ),
        },
    ]
    if _is_obstructive_abdominal_diagnosis(final_diagnosis):
        passages.append(
            {
                "id": "bowel-obstruction-volvulus",
                "title": "Volvulus and obstructive abdominal presentations",
                "url": "https://en.wikipedia.org/wiki/Volvulus",
                "text": (
                    "Volvulus is an intestinal twisting process that can cause bowel obstruction. "
                    "Adult presentations may include abdominal pain, abdominal distention, vomiting, "
                    "constipation, and ischemia risk. Evaluation commonly uses abdominal imaging such "
                    "as x-ray, contrast study, or CT, and urgent decompression or surgery may be needed."
                ),
            }
        )
    else:
        passages.append(
            {
                "id": "acute-cholecystitis",
                "title": "Acute cholecystitis evaluation and treatment",
                "url": "https://www.ncbi.nlm.nih.gov/books/NBK459171/",
                "text": (
                    "Acute cholecystitis can present with right upper quadrant or epigastric pain, nausea, vomiting, "
                    "and Murphy sign. Evaluation includes clinical assessment, CBC, metabolic and liver tests, "
                    "lipase assessment, and ultrasound or CT imaging. Management may include intravenous fluids, "
                    "antibiotics, analgesia, and surgical consultation depending on clinical status."
                ),
            }
        )
    return passages


def _is_obstructive_abdominal_diagnosis(final_diagnosis: str) -> bool:
    normalized = str(final_diagnosis or "").lower()
    return any(term in normalized for term in ("volvulus", "obstruction", "ileus"))


def _real_timeline(enriched_case: dict[str, Any]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    ed_stay = _first_nested(enriched_case, "linked_context", "ed", "edstays") or {}
    base_time = _parse_time(ed_stay.get("intime"))
    events.append({"elapsed_min": 0, "label": "ED arrival", "detail": "Arrived and triage vitals were recorded."})

    for item in _objective_values(enriched_case, "imaging_orders")[:2]:
        elapsed = _elapsed_minutes(base_time, item.get("ordertime"))
        events.append(
            {
                "elapsed_min": elapsed,
                "label": "Source imaging order",
                "detail": str(item.get("clinical_class_label") or item.get("order_subtype") or "Imaging order"),
            }
        )
    for row in (_nested(enriched_case, "retrospective_ground_truth", "hospital_procedures") or [])[:2]:
        events.append(
            {
                "elapsed_min": 24 * 60,
                "label": "Hospital procedure",
                "detail": str(row.get("long_title") or "Procedure recorded after ED disposition."),
            }
        )
    disposition = str(enriched_case.get("ground_truth", {}).get("disposition") or enriched_case.get("disposition") or "Disposition recorded")
    ed_out = _elapsed_minutes(base_time, ed_stay.get("outtime"))
    events.append({"elapsed_min": ed_out, "label": "ED disposition", "detail": disposition})
    return sorted(events, key=lambda event: event["elapsed_min"])


def _triage_context(
    enriched_case: dict[str, Any],
    demographics: dict[str, Any],
    vitals: dict[str, Any],
    vitals_source: dict[str, Any] | None = None,
) -> str:
    transport = demographics.get("arrival_transport")
    pieces = []
    if transport:
        pieces.append(f"Arrived by {str(transport).lower()}.")
    pieces.append(f"Triage pain score {vitals['pain']}/10.")
    source_note = _clean_string((vitals_source or {}).get("_vitals_source_note"))
    if source_note:
        pieces.append(source_note)
    history = _clean_history(str(enriched_case.get("history") or ""))
    if "allergy" in history.lower():
        allergy_sentence = next((sentence for sentence in _sentences(history) if "allerg" in sentence.lower()), "")
        if allergy_sentence:
            pieces.append(allergy_sentence)
    return " ".join(pieces)


def _appearance(complaint: str, vitals: dict[str, Any]) -> str:
    if "distention" in complaint.lower():
        return "Uncomfortable with severe abdominal pain and visible abdominal distention."
    if int(vitals.get("pain") or 0) >= 8:
        return "Uncomfortable, guarding from severe pain."
    return "Awake and uncomfortable but speaking clearly."


def _chief_concern_response(complaint: str) -> str:
    normalized = complaint.lower()
    if "distention" in normalized:
        return "My abdomen hurts badly and feels really distended."
    if "abd" in normalized or "abdominal" in normalized or "epigastric" in normalized:
        return "My abdomen hurts badly."
    return f"I came in because of {complaint.lower()}."


def _associated_symptom_response(history: str) -> tuple[str, list[str]] | None:
    symptoms = []
    triggers = []
    lowered = history.lower()
    for labels, phrase, symptom_triggers in (
        (("nausea",), "nausea", ["nausea"]),
        (("vomit", "vomiting"), "vomiting", ["vomit", "vomiting"]),
        (("constipation",), "constipation", ["constipation", "bowel"]),
        (("diarrhea",), "diarrhea", ["diarrhea", "bowel"]),
        (("fever", "febrile"), "fevers", ["fever"]),
        (("night sweat",), "night sweats", ["night sweat"]),
        (("reduced oral intake", "decreased oral intake"), "not eating or drinking much", ["appetite", "eat", "drink"]),
        (("distention", "distended"), "bloating or distention", ["distention", "distended", "bloating", "abdomen", "abdominal", "belly"]),
        (("dyspnea", "shortness of breath"), "shortness of breath", ["dyspnea", "shortness of breath", "breath", "breathing"]),
    ):
        if any(label in lowered for label in labels):
            symptoms.append(phrase)
            triggers.extend(symptom_triggers)
    if not symptoms:
        return None
    return "I have had " + ", ".join(dict.fromkeys(symptoms)) + ".", list(dict.fromkeys(triggers))


def _allergy_response(history: str) -> str | None:
    lowered = history.lower()
    if "no known allergies" in lowered or "no known drug allergies" in lowered or "nkda" in lowered:
        return "I have no known allergies."
    match = re.search(r"allerg(?:y|ies|ic) to (?P<allergy>[^.]+)", history, flags=re.IGNORECASE)
    if match:
        allergy = match.group("allergy").strip(" ,.")
        return f"I am allergic to {allergy}."
    return None


def _medical_history_response(history: str) -> str | None:
    match = re.search(r"history(?:, including| of)? (?P<history>.+?) presented", history, flags=re.IGNORECASE)
    if not match:
        match = re.search(r"medical history, including (?P<history>.+?) presented", history, flags=re.IGNORECASE)
    if not match:
        return None
    text = match.group("history").strip(" ,.")
    if len(text) > 220:
        text = text[:220].rsplit(",", 1)[0].strip()
    return f"I have a history of {text}."


def _objective_values(enriched_case: dict[str, Any], objective_id: str) -> list[dict[str, Any]]:
    for item in enriched_case.get("optional_objective_data") or []:
        if item.get("id") == objective_id and item.get("availability") == "available":
            return [row for row in item.get("values") or [] if isinstance(row, dict)]
    return []


def _display_value(row: dict[str, Any]) -> str | None:
    value = _clean_string(row.get("value"))
    numeric = _number(row.get("valuenum"))
    if value and value != "___":
        return value
    if numeric is not None:
        return f"{numeric:g}"
    return None


def _result_flag(row: dict[str, Any]) -> str | None:
    raw_flag = _clean_string(row.get("flag"))
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


def _reference_range(row: dict[str, Any]) -> str | None:
    lower = _clean_string(row.get("ref_range_lower"))
    upper = _clean_string(row.get("ref_range_upper"))
    if lower and upper:
        return f"{lower}-{upper}"
    return lower or upper


def _clean_history(text: str) -> str:
    return " ".join(text.replace("掳", " degrees ").split())


def _sentences(text: str) -> list[str]:
    return [item.strip() for item in re.split(r"(?<=[.!?])\s+", text) if item.strip()]


def _normalize_label(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", label.lower()).strip()


def _clean_string(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    return text


def _clean_identifier(value: Any) -> str:
    text = str(value or "").strip()
    if not text or text.lower() == "nan":
        return ""
    if text.endswith(".0"):
        return text[:-2]
    return text


def _number(value: Any) -> float | None:
    cleaned = _clean_string(value)
    if cleaned is None or cleaned.lower() in {"___", "critical"}:
        return None
    try:
        number = float(cleaned)
    except ValueError:
        return None
    if math.isnan(number):
        return None
    return number


def _required_number(value: Any, label: str) -> float:
    number = _number(value)
    if number is None:
        raise CasePreparationError(f"Required source value missing or non-numeric: {label}")
    return number


def _pick(source: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in source:
            return source[key]
    return None


def _nested(source: dict[str, Any], *keys: str) -> Any:
    current: Any = source
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _first_nested(source: dict[str, Any], *keys: str) -> dict[str, Any] | None:
    value = _nested(source, *keys)
    if isinstance(value, list) and value and isinstance(value[0], dict):
        return value[0]
    if isinstance(value, dict):
        return value
    return None


def _first_text(row: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        text = _clean_string(row.get(key))
        if text:
            return " ".join(text.split())
    return None


def _parse_time(value: Any) -> datetime | None:
    text = _clean_string(value)
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _elapsed_minutes(base_time: datetime | None, value: Any) -> int:
    current = _parse_time(value)
    if base_time is None or current is None:
        return 0
    return max(0, int(round((current - base_time).total_seconds() / 60)))


def _case_title(demographics: dict[str, Any], complaint: str) -> str:
    age = demographics.get("age")
    sex = str(demographics.get("sex") or "").strip().lower()
    sex_label = "F" if sex.startswith("f") else "M" if sex.startswith("m") else ""
    identity = f"{age}{sex_label}" if age is not None else sex_label or "Adult"
    normalized = complaint.lower().replace("abd pain", "abdominal pain").strip()
    return f"{identity} {normalized}"


def _main() -> None:
    parser = argparse.ArgumentParser(description="Prepare one local MIMIC-IV-Ext enriched case into data/cases JSON.")
    parser.add_argument("input", type=Path, help="Local restricted enriched cases JSON.")
    parser.add_argument("--case-id", required=True, help="Source case id to prepare.")
    parser.add_argument("--output", required=True, type=Path, help="PreparedCase JSON output path, usually under data/cases/.")
    parser.add_argument("--cxr-reports-dir", type=Path, help="Optional local MIMIC-CXR raw reports root with files/pXX/pXXXXXXXX/s*.txt.")
    parser.add_argument("--supplemental-results", type=Path, help="Optional local JSON with source-backed MIMIC result snippets keyed by order_id.")
    args = parser.parse_args()

    enriched_case = find_enriched_case(load_enriched_cases(args.input), args.case_id)
    if args.cxr_reports_dir:
        enriched_case = attach_raw_cxr_reports(enriched_case, args.cxr_reports_dir.expanduser().resolve())
    supplemental_results = load_supplemental_results(args.supplemental_results.expanduser().resolve()) if args.supplemental_results else None
    case = prepare_mimic_ext_case(enriched_case, supplemental_results=supplemental_results)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(case.model_dump(mode="json"), indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Prepared {case.case_id}: {case.title}")


if __name__ == "__main__":
    _main()
