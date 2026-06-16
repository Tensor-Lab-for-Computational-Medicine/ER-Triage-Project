from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

from backend.cases.schemas import PreparedCase, ResultBundle
from backend.orders.catalog import CatalogOrder, get_order


class ResolvedOrder(BaseModel):
    order_id: str
    status: Literal["resulted", "unavailable"]
    result: ResultBundle | None = None
    unavailable_reason: str | None = None


def resolve(order_id: str, case: PreparedCase, state: object | None = None) -> ResolvedOrder:
    """Return source-recorded data or a clearly labeled simulator default."""

    if order_id in case.result_bundles:
        return ResolvedOrder(order_id=order_id, status="resulted", result=case.result_bundles[order_id])
    order = get_order(order_id)
    if order is not None:
        return ResolvedOrder(
            order_id=order_id,
            status="resulted",
            result=_default_result(order, case, _documented_result_gap(order_id, case)),
        )
    source_gap = _documented_result_gap(order_id, case)
    if source_gap:
        signal = str(source_gap.get("signal") or order_id)
        return ResolvedOrder(
            order_id=order_id,
            status="unavailable",
            unavailable_reason=(
                f"A source-recorded order matching {signal} is documented for this encounter, "
                "but no encounter-linked result is available; no value was fabricated."
            ),
        )
    return ResolvedOrder(
        order_id=order_id,
        status="unavailable",
        unavailable_reason="No source-recorded result is available for this order; no value was fabricated.",
    )


def _default_result(order: CatalogOrder, case: PreparedCase, source_gap: dict[str, Any] | None = None) -> ResultBundle:
    definition = _default_definition(order)
    gap_note = ""
    if source_gap:
        signal = str(source_gap.get("signal") or order.id)
        gap_note = f" A source order matching {signal} exists in the encounter record, but no linked result artifact was available."
    return ResultBundle(
        order_id=order.id,
        display_name=order.name,
        values=definition.get("values", []),
        narrative=f"{definition['narrative']}{gap_note} This is a simulator default, not a source-recorded MIMIC result.",
        source="simulator-default",
        source_reference={
            "case_id": case.case_id,
            "order_id": order.id,
            "order_type": order.type,
            "fallback_reason": "no_encounter_linked_source_result",
            **({"source_gap_signal": source_gap.get("signal")} if source_gap else {}),
        },
    )


def _default_definition(order: CatalogOrder) -> dict[str, Any]:
    defaults: dict[str, dict[str, Any]] = {
        "cbc": {
            "values": [
                {"name": "WBC", "value": "8.4", "unit": "K/uL", "flag": "normal", "reference_range": "4.0-11.0"},
                {"name": "Hemoglobin", "value": "14.0", "unit": "g/dL", "flag": "normal", "reference_range": "13.5-17.5"},
                {"name": "Platelets", "value": "245", "unit": "K/uL", "flag": "normal", "reference_range": "150-400"},
            ],
            "narrative": "Default CBC: no leukocytosis, anemia, or thrombocytopenia.",
        },
        "bmp": {
            "values": [
                {"name": "Sodium", "value": "140", "unit": "mmol/L", "flag": "normal", "reference_range": "135-145"},
                {"name": "Potassium", "value": "4.1", "unit": "mmol/L", "flag": "normal", "reference_range": "3.5-5.0"},
                {"name": "Creatinine", "value": "0.9", "unit": "mg/dL", "flag": "normal", "reference_range": "0.6-1.3"},
                {"name": "Glucose", "value": "96", "unit": "mg/dL", "flag": "normal", "reference_range": "70-110"},
            ],
            "narrative": "Default BMP: electrolytes, renal function, and glucose are within reference range.",
        },
        "cmp": {
            "values": [
                {"name": "Sodium", "value": "140", "unit": "mmol/L", "flag": "normal", "reference_range": "135-145"},
                {"name": "Potassium", "value": "4.1", "unit": "mmol/L", "flag": "normal", "reference_range": "3.5-5.0"},
                {"name": "Creatinine", "value": "0.9", "unit": "mg/dL", "flag": "normal", "reference_range": "0.6-1.3"},
                {"name": "AST", "value": "24", "unit": "IU/L", "flag": "normal", "reference_range": "10-40"},
                {"name": "ALT", "value": "22", "unit": "IU/L", "flag": "normal", "reference_range": "7-56"},
            ],
            "narrative": "Default CMP: electrolytes, renal function, liver enzymes, and bilirubin are within reference range.",
        },
        "lft": {
            "values": [
                {"name": "AST", "value": "24", "unit": "IU/L", "flag": "normal", "reference_range": "10-40"},
                {"name": "ALT", "value": "22", "unit": "IU/L", "flag": "normal", "reference_range": "7-56"},
                {"name": "Total bilirubin", "value": "0.7", "unit": "mg/dL", "flag": "normal", "reference_range": "0.1-1.2"},
            ],
            "narrative": "Default hepatic panel: no transaminitis or hyperbilirubinemia.",
        },
        "troponin": {
            "values": [{"name": "High-sensitivity troponin", "value": "6", "unit": "ng/L", "flag": "normal", "reference_range": "0-14"}],
            "narrative": "Default troponin: negative, without biochemical evidence of myocardial injury.",
        },
        "d_dimer": {
            "values": [{"name": "D-dimer", "value": "0.27", "unit": "mg/L FEU", "flag": "normal", "reference_range": "<0.50"}],
            "narrative": "Default D-dimer: negative.",
        },
        "lactate": {
            "values": [{"name": "Lactate", "value": "1.2", "unit": "mmol/L", "flag": "normal", "reference_range": "0.5-2.0"}],
            "narrative": "Default lactate: not elevated.",
        },
        "blood_culture": {
            "values": [{"name": "Blood cultures", "value": "No growth to date", "flag": "normal"}],
            "narrative": "Default blood culture update: no growth to date.",
        },
        "abg": {
            "values": [
                {"name": "pH", "value": "7.40", "flag": "normal", "reference_range": "7.35-7.45"},
                {"name": "PaCO2", "value": "40", "unit": "mmHg", "flag": "normal", "reference_range": "35-45"},
                {"name": "PaO2", "value": "92", "unit": "mmHg", "flag": "normal", "reference_range": "80-100"},
            ],
            "narrative": "Default ABG: no acid-base disturbance or hypoxemia.",
        },
        "venous_blood_gas": {
            "values": [
                {"name": "pH", "value": "7.38", "flag": "normal", "reference_range": "7.31-7.41"},
                {"name": "PvCO2", "value": "44", "unit": "mmHg", "flag": "normal", "reference_range": "38-52"},
            ],
            "narrative": "Default VBG: no major acid-base disturbance.",
        },
        "urinalysis": {
            "values": [
                {"name": "Leukocyte esterase", "value": "Negative", "flag": "normal"},
                {"name": "Nitrite", "value": "Negative", "flag": "normal"},
                {"name": "Blood", "value": "Negative", "flag": "normal"},
            ],
            "narrative": "Default urinalysis: no evidence of infection or hematuria.",
        },
        "urine_pregnancy": {
            "values": [{"name": "Urine hCG", "value": "Negative", "flag": "normal"}],
            "narrative": "Default urine pregnancy test: negative.",
        },
        "serum_pregnancy": {
            "values": [{"name": "Serum beta-hCG", "value": "<5", "unit": "mIU/mL", "flag": "normal", "reference_range": "<5"}],
            "narrative": "Default serum beta-hCG: negative.",
        },
        "coagulation_panel": {
            "values": [
                {"name": "INR", "value": "1.0", "flag": "normal", "reference_range": "0.9-1.1"},
                {"name": "PTT", "value": "30", "unit": "sec", "flag": "normal", "reference_range": "25-35"},
            ],
            "narrative": "Default coagulation studies: within reference range.",
        },
        "type_and_screen": {
            "values": [
                {"name": "ABO/Rh", "value": "O positive"},
                {"name": "Antibody screen", "value": "Negative", "flag": "normal"},
            ],
            "narrative": "Default type and screen: O positive, antibody screen negative.",
        },
        "point_of_care_glucose": {
            "values": [{"name": "Point-of-care glucose", "value": "96", "unit": "mg/dL", "flag": "normal", "reference_range": "70-110"}],
            "narrative": "Default point-of-care glucose: within reference range.",
        },
        "lipase": {
            "values": [{"name": "Lipase", "value": "34", "unit": "IU/L", "flag": "normal", "reference_range": "13-60"}],
            "narrative": "Default lipase: not elevated.",
        },
        "bnp": {
            "values": [{"name": "BNP", "value": "42", "unit": "pg/mL", "flag": "normal", "reference_range": "<100"}],
            "narrative": "Default BNP: not elevated.",
        },
        "magnesium": {
            "values": [{"name": "Magnesium", "value": "2.0", "unit": "mg/dL", "flag": "normal", "reference_range": "1.7-2.2"}],
            "narrative": "Default magnesium: within reference range.",
        },
        "respiratory_viral_panel": {
            "values": [
                {"name": "COVID-19", "value": "Negative", "flag": "normal"},
                {"name": "Influenza A/B", "value": "Negative", "flag": "normal"},
                {"name": "RSV", "value": "Negative", "flag": "normal"},
            ],
            "narrative": "Default respiratory viral testing: negative for common tested viruses.",
        },
        "wound_culture": {
            "values": [{"name": "Wound culture", "value": "No growth to date", "flag": "normal"}],
            "narrative": "Default wound culture update: no growth to date.",
        },
        "ecg_12_lead": {
            "values": [
                {"name": "Rate", "value": "80", "unit": "bpm", "flag": "normal", "reference_range": "60-100"},
                {"name": "Rhythm", "value": "Normal sinus rhythm", "flag": "normal"},
                {"name": "ST-segment changes", "value": "None", "flag": "normal"},
            ],
            "narrative": "Default ECG: normal sinus rhythm without ST elevation, ST depression, or acute ischemic changes.",
        },
        "focused_cardiac_ultrasound": {
            "values": [
                {"name": "Pericardial effusion", "value": "Absent", "flag": "normal"},
                {"name": "LV systolic function", "value": "Grossly normal", "flag": "normal"},
            ],
            "narrative": "Default focused cardiac ultrasound: grossly normal systolic function and no pericardial effusion.",
        },
        "fast_exam": {
            "values": [{"name": "Free fluid", "value": "Not visualized", "flag": "normal"}],
            "narrative": "Default FAST exam: no free intraperitoneal or pericardial fluid visualized.",
        },
    }
    if order.id in defaults:
        return defaults[order.id]
    if order.type == "imaging":
        return {
            "values": [{"name": "Acute abnormality", "value": "Not identified", "flag": "normal"}],
            "narrative": f"Default {order.name}: no acute abnormality identified.",
        }
    if order.type == "study":
        return {
            "values": [{"name": "Acute abnormality", "value": "Not identified", "flag": "normal"}],
            "narrative": f"Default {order.name}: no acute abnormality identified.",
        }
    if order.type == "lab":
        return {
            "values": [{"name": order.name, "value": "Within reference range", "flag": "normal"}],
            "narrative": f"Default {order.name}: no abnormality detected.",
        }
    return {
        "values": [],
        "narrative": f"Default feedback for {order.name}: completed without a diagnostic result value.",
    }


def _documented_result_gap(order_id: str, case: PreparedCase) -> dict[str, Any] | None:
    audit = case.source_evidence_audit
    unresolved_signals = {str(signal) for signal in audit.documented_orders_without_results}
    for detail in audit.documented_order_details:
        if not isinstance(detail, dict):
            continue
        signal = str(detail.get("signal") or "")
        if signal not in unresolved_signals:
            continue
        candidates = {str(item) for item in detail.get("candidate_order_ids", []) if item}
        if order_id == signal or order_id in candidates or _order_matches_unresolved_signal(order_id, signal):
            return detail
    if order_id in unresolved_signals:
        return {"signal": order_id}
    return None


def _order_matches_unresolved_signal(order_id: str, signal: str) -> bool:
    if signal == "ct_imaging_order" and order_id.startswith("ct_"):
        return True
    if signal == "ultrasound_order" and order_id.startswith("ultrasound_"):
        return True
    if signal == "imaging_order" and (
        order_id.startswith("ct_") or order_id.startswith("ultrasound_") or order_id == "chest_xray"
    ):
        return True
    return False
