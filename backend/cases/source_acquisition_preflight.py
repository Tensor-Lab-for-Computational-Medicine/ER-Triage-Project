from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.cases.mimic_ext import find_enriched_case, load_enriched_cases, load_supplemental_results, prepare_mimic_ext_case
from backend.cases.prepare import CasePreparationError
from backend.cases.source_acquisition import SourceAcquisitionChecklist, assert_source_acquisition_matches_case
from backend.cases.source_gaps import build_source_gap_report


class SourceAcquisitionPreflightReport(BaseModel):
    case_id: str
    checklist_case_id: str
    checklist_task_count: int = 0
    checklist_missing_source_modules: list[str] = Field(default_factory=list)
    checklist_unresolved_release_blocking_order_ids: list[str] = Field(default_factory=list)
    supplemental_result_order_ids: list[str] = Field(default_factory=list)
    matched_acquisition_order_ids: list[str] = Field(default_factory=list)
    preview_result_bundle_ids: list[str] = Field(default_factory=list)
    release_blocking_signals_after: list[str] = Field(default_factory=list)
    unresolved_release_blocking_order_ids_after: list[str] = Field(default_factory=list)
    source_ready_after_payload: bool = False
    output_written: Literal[False] = False
    notes: list[str] = Field(default_factory=list)
    grader_only_truth_excluded: Literal[True] = True


def preflight_source_acquisition(
    enriched_case: dict[str, Any],
    *,
    source_acquisition: SourceAcquisitionChecklist,
    supplemental_results: dict[str, Any] | list[dict[str, Any]],
) -> SourceAcquisitionPreflightReport:
    """Validate a local supplemental-result payload in memory before writing a learner case."""

    base_case = prepare_mimic_ext_case(enriched_case)
    assert_source_acquisition_matches_case(base_case, source_acquisition)
    preview_case = prepare_mimic_ext_case(enriched_case, supplemental_results=supplemental_results)
    source_gaps = build_source_gap_report(preview_case)
    release_blocking_items = source_gaps.release_blocking_missing_results
    release_blocking_signals = sorted(
        {str(item.get("signal") or "") for item in release_blocking_items if item.get("signal")}
    )
    unresolved_after = _unresolved_order_ids(release_blocking_items)
    supplemental_order_ids = _supplemental_order_ids(supplemental_results)
    acquisition_order_ids = _acquisition_candidate_order_ids(source_acquisition)
    matched_order_ids = sorted(set(supplemental_order_ids).intersection(acquisition_order_ids))
    source_ready = not release_blocking_items

    notes = [
        "Supplemental payload was validated by prepare_mimic_ext_case in memory; no PreparedCase was written."
    ]
    if source_ready:
        notes.append(
            "Payload clears release-blocking source-result gaps in memory; rerun source_refresh or case preparation to write the guarded PreparedCase."
        )
    else:
        notes.append(
            "Payload is structurally valid, but release-blocking source-result gaps remain after applying it in memory."
        )
    if not matched_order_ids and source_acquisition.unresolved_release_blocking_order_ids:
        notes.append(
            "Payload did not include an order_id from the current unresolved source-acquisition task candidates."
        )

    return SourceAcquisitionPreflightReport(
        case_id=base_case.case_id,
        checklist_case_id=source_acquisition.case_id,
        checklist_task_count=source_acquisition.task_count,
        checklist_missing_source_modules=list(source_acquisition.missing_source_modules),
        checklist_unresolved_release_blocking_order_ids=list(source_acquisition.unresolved_release_blocking_order_ids),
        supplemental_result_order_ids=supplemental_order_ids,
        matched_acquisition_order_ids=matched_order_ids,
        preview_result_bundle_ids=sorted(preview_case.result_bundles),
        release_blocking_signals_after=release_blocking_signals,
        unresolved_release_blocking_order_ids_after=unresolved_after,
        source_ready_after_payload=source_ready,
        notes=notes,
    )


def assert_source_acquisition_preflight_matches_case(
    case_id: str,
    preflight: SourceAcquisitionPreflightReport | None,
    *,
    checklist: SourceAcquisitionChecklist | None = None,
) -> None:
    if preflight is None:
        return
    if preflight.case_id != case_id:
        raise CasePreparationError(
            f"Source acquisition preflight case_id {preflight.case_id!r} does not match prepared case {case_id!r}."
        )
    if preflight.checklist_case_id != case_id:
        raise CasePreparationError(
            f"Source acquisition preflight checklist_case_id {preflight.checklist_case_id!r} does not match prepared case {case_id!r}."
        )
    if checklist and preflight.checklist_case_id != checklist.case_id:
        raise CasePreparationError(
            f"Source acquisition preflight checklist_case_id {preflight.checklist_case_id!r} does not match checklist {checklist.case_id!r}."
        )


def _supplemental_order_ids(payload: dict[str, Any] | list[dict[str, Any]]) -> list[str]:
    return sorted(
        {
            str(entry.get("order_id") or "")
            for entry in _supplemental_entries(payload)
            if isinstance(entry, dict) and entry.get("order_id")
        }
    )


def _supplemental_entries(payload: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    items: list[Any] = payload if isinstance(payload, list) else [payload]
    for item in items:
        if not isinstance(item, dict):
            continue
        nested = item.get("results")
        if isinstance(nested, list):
            entries.extend(entry for entry in nested if isinstance(entry, dict))
        elif item.get("order_id"):
            entries.append(item)
    return entries


def _acquisition_candidate_order_ids(source_acquisition: SourceAcquisitionChecklist) -> list[str]:
    ids = list(source_acquisition.unresolved_release_blocking_order_ids)
    for task in source_acquisition.tasks:
        ids.extend(task.candidate_order_ids)
    return sorted(dict.fromkeys(order_id for order_id in ids if order_id))


def _unresolved_order_ids(items: list[dict[str, Any]]) -> list[str]:
    return sorted(
        {
            str(order_id)
            for item in items
            for order_id in item.get("candidate_order_ids", [])
            if order_id
        }
    )


def _main() -> int:
    parser = argparse.ArgumentParser(
        description="Preflight a local supplemental-results JSON against source-acquisition tasks without writing a PreparedCase."
    )
    parser.add_argument("input", type=Path, help="Local restricted enriched cases JSON.")
    parser.add_argument("--case-id", required=True, help="Case id to preflight from the enriched case file.")
    parser.add_argument("--source-acquisition-report", required=True, type=Path, help="SourceAcquisitionChecklist JSON.")
    parser.add_argument("--supplemental-results", required=True, type=Path, help="Candidate supplemental-results JSON.")
    parser.add_argument("--output", type=Path, help="Optional preflight report JSON output path.")
    args = parser.parse_args()

    enriched_case = find_enriched_case(load_enriched_cases(args.input), args.case_id)
    source_acquisition = SourceAcquisitionChecklist.model_validate_json(
        args.source_acquisition_report.read_text(encoding="utf-8")
    )
    supplemental_results = load_supplemental_results(args.supplemental_results)
    report = preflight_source_acquisition(
        enriched_case,
        source_acquisition=source_acquisition,
        supplemental_results=supplemental_results,
    )

    rendered = report.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0 if report.source_ready_after_payload else 1


if __name__ == "__main__":
    raise SystemExit(_main())
