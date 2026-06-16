from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.cases.mimic_ext import find_enriched_case, load_enriched_cases, prepare_mimic_ext_case
from backend.cases.prepare import CasePreparationError
from backend.cases.readiness import CaseReadinessReport, validate_abdominal_case_readiness
from backend.cases.schemas import PreparedCase
from backend.cases.source_ecg_index import load_ecg_source_index
from backend.cases.source_gaps import SourceGapReport, build_source_gap_report
from backend.cases.source_probe import SourceProbeReport, build_source_probe_report


class SourceAcquisitionTask(BaseModel):
    signal: str
    candidate_order_ids: list[str] = Field(default_factory=list)
    missing_source_modules: list[str] = Field(default_factory=list)
    expected_paths: list[str] = Field(default_factory=list)
    checked_paths: list[str] = Field(default_factory=list)
    local_lookup_hints: list[str] = Field(default_factory=list)
    localized_operator_queries: list[dict[str, Any]] = Field(default_factory=list)
    operator_queries: list[dict[str, Any]] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    supplemental_result_template: dict[str, Any] = Field(default_factory=dict)
    blocking_reason: str = ""
    operator_action: str = ""


class SourceRefreshReport(BaseModel):
    case_id: str
    source_root: str
    source_probe: SourceProbeReport
    supplemental_result_count: int = 0
    supplemental_result_order_ids: list[str] = Field(default_factory=list)
    manual_verification_candidate_order_ids: list[str] = Field(default_factory=list)
    preview_result_bundle_ids: list[str] = Field(default_factory=list)
    preview_source_gaps_after_payload: SourceGapReport | None = None
    preview_readiness_after_payload: CaseReadinessReport | None = None
    source_gaps_after_refresh: SourceGapReport | None = None
    readiness_after_refresh: CaseReadinessReport | None = None
    output_written: bool = False
    output_path: str | None = None
    blocking_signals: list[str] = Field(default_factory=list)
    unresolved_release_blocking_order_ids: list[str] = Field(default_factory=list)
    source_acquisition_tasks: list[SourceAcquisitionTask] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    grader_only_truth_excluded: Literal[True] = True


def refresh_case_from_source_root(
    enriched_case: dict[str, Any],
    *,
    source_root: Path,
    mimic_hosp_dir: Path | None = None,
    mimic_note_dir: Path | None = None,
    mimic_cxr_dir: Path | None = None,
    mimic_ecg_dir: Path | None = None,
    ecg_index: dict[str, list[dict[str, Any]]] | None = None,
    output_path: Path | None = None,
    limit: int = 5,
    probe_labs: bool = False,
    probe_ecg: bool = True,
) -> tuple[PreparedCase | None, SourceRefreshReport]:
    """Probe local sources and write a refreshed case only when decisive gaps resolve."""

    base_case = prepare_mimic_ext_case(enriched_case)
    source_probe = build_source_probe_report(
        base_case,
        source_root=source_root,
        mimic_hosp_dir=mimic_hosp_dir,
        mimic_note_dir=mimic_note_dir,
        mimic_cxr_dir=mimic_cxr_dir,
        mimic_ecg_dir=mimic_ecg_dir,
        ecg_index=ecg_index,
        limit=limit,
        probe_labs=probe_labs,
        probe_ecg=probe_ecg,
    )
    payload = source_probe.supplemental_results_payload
    supplemental_count = len(payload.get("results") or [])
    supplemental_order_ids = _payload_order_ids(payload)
    manual_candidate_order_ids = _manual_verification_candidate_order_ids(source_probe)
    blocking_signals = _blocking_signals(source_probe.unresolved_release_blocking_results)
    unresolved_order_ids = _unresolved_release_blocking_order_ids(source_probe.unresolved_release_blocking_results)
    acquisition_tasks = _source_acquisition_tasks(source_probe.unresolved_release_blocking_results)
    notes: list[str] = []
    preview_case = _preview_case_with_probe_payload(enriched_case, payload)
    preview_source_gaps = build_source_gap_report(preview_case) if preview_case else None
    preview_readiness = validate_abdominal_case_readiness(preview_case) if preview_case else None
    preview_result_bundle_ids = sorted(preview_case.result_bundles) if preview_case else []

    if blocking_signals:
        notes.append(
            "Refreshed PreparedCase was not written because release-blocking source results remain unresolved."
        )
        if supplemental_count:
            notes.append(
                "Probe supplemental payload was applied only in memory for preview; no PreparedCase was written."
            )
        return None, SourceRefreshReport(
            case_id=base_case.case_id,
            source_root=str(source_root),
            source_probe=source_probe,
            supplemental_result_count=supplemental_count,
            supplemental_result_order_ids=supplemental_order_ids,
            manual_verification_candidate_order_ids=manual_candidate_order_ids,
            preview_result_bundle_ids=preview_result_bundle_ids,
            preview_source_gaps_after_payload=preview_source_gaps,
            preview_readiness_after_payload=preview_readiness,
            blocking_signals=blocking_signals,
            unresolved_release_blocking_order_ids=unresolved_order_ids,
            source_acquisition_tasks=acquisition_tasks,
            notes=notes,
        )

    refreshed = preview_case or base_case
    source_gaps = preview_source_gaps or build_source_gap_report(refreshed)
    post_refresh_blockers = _blocking_signals(source_gaps.release_blocking_missing_results)
    readiness = preview_readiness or validate_abdominal_case_readiness(refreshed)
    if post_refresh_blockers:
        post_refresh_acquisition_tasks = _source_acquisition_tasks(source_gaps.release_blocking_missing_results)
        notes.append(
            "Refreshed PreparedCase was not written because source-gap validation still reports release-blocking gaps."
        )
        return None, SourceRefreshReport(
            case_id=refreshed.case_id,
            source_root=str(source_root),
            source_probe=source_probe,
            supplemental_result_count=supplemental_count,
            supplemental_result_order_ids=supplemental_order_ids,
            manual_verification_candidate_order_ids=manual_candidate_order_ids,
            preview_result_bundle_ids=preview_result_bundle_ids,
            preview_source_gaps_after_payload=preview_source_gaps,
            preview_readiness_after_payload=preview_readiness,
            source_gaps_after_refresh=source_gaps,
            readiness_after_refresh=readiness,
            blocking_signals=post_refresh_blockers,
            unresolved_release_blocking_order_ids=_unresolved_release_blocking_order_ids(source_gaps.release_blocking_missing_results),
            source_acquisition_tasks=post_refresh_acquisition_tasks,
            notes=notes,
        )

    output_written = False
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(refreshed.model_dump(mode="json"), indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        output_written = True
        notes.append("Refreshed PreparedCase was written after release-blocking source gaps resolved.")
    else:
        notes.append("Release-blocking source gaps resolved; no output path was provided.")

    return refreshed, SourceRefreshReport(
        case_id=refreshed.case_id,
        source_root=str(source_root),
        source_probe=source_probe,
        supplemental_result_count=supplemental_count,
        supplemental_result_order_ids=supplemental_order_ids,
        manual_verification_candidate_order_ids=manual_candidate_order_ids,
        preview_result_bundle_ids=preview_result_bundle_ids,
        preview_source_gaps_after_payload=preview_source_gaps,
        preview_readiness_after_payload=preview_readiness,
        source_gaps_after_refresh=source_gaps,
        readiness_after_refresh=readiness,
        output_written=output_written,
        output_path=str(output_path) if output_written and output_path else None,
        blocking_signals=[],
        notes=notes,
    )


def _blocking_signals(items: list[dict[str, Any]]) -> list[str]:
    return sorted({str(item.get("signal") or "") for item in items if item.get("signal")})


def _payload_order_ids(payload: dict[str, Any]) -> list[str]:
    return sorted(
        {
            str(item.get("order_id") or "")
            for item in payload.get("results", [])
            if isinstance(item, dict) and item.get("order_id")
        }
    )


def _manual_verification_candidate_order_ids(source_probe: SourceProbeReport) -> list[str]:
    auto_applied_order_ids = {
        str(entry.get("order_id") or "")
        for entry in (source_probe.supplemental_results_payload.get("results") or [])
        if isinstance(entry, dict) and entry.get("order_id")
    }
    return sorted(
        {
            candidate.order_id
            for candidate in source_probe.candidates
            if candidate.requires_manual_verification
            and candidate.order_id
            and candidate.order_id not in auto_applied_order_ids
        }
    )


def _unresolved_release_blocking_order_ids(items: list[dict[str, Any]]) -> list[str]:
    return sorted(
        {
            str(order_id)
            for item in items
            for order_id in item.get("candidate_order_ids", [])
            if order_id
        }
    )


def _source_acquisition_tasks(items: list[dict[str, Any]]) -> list[SourceAcquisitionTask]:
    tasks: list[SourceAcquisitionTask] = []
    for item in items:
        missing_modules = [
            str(module.get("module") or "")
            for module in item.get("missing_local_source_modules", [])
            if module.get("module")
        ]
        expected_paths = sorted(
            {
                str(path)
                for module in item.get("missing_local_source_modules", [])
                for path in module.get("expected_paths", [])
                if path
            }
        )
        tasks.append(
            SourceAcquisitionTask(
                signal=str(item.get("signal") or ""),
                candidate_order_ids=[str(order_id) for order_id in item.get("candidate_order_ids", []) if order_id],
                missing_source_modules=sorted(dict.fromkeys(missing_modules)),
                expected_paths=expected_paths,
                checked_paths=[str(path) for path in item.get("checked_paths", []) if path],
                local_lookup_hints=[str(hint) for hint in item.get("local_lookup_hints", []) if hint],
                localized_operator_queries=[
                    dict(query) for query in item.get("localized_operator_queries", []) if isinstance(query, dict)
                ],
                operator_queries=[dict(query) for query in item.get("operator_queries", []) if isinstance(query, dict)],
                acceptance_criteria=[str(criterion) for criterion in item.get("acceptance_criteria", []) if criterion],
                supplemental_result_template=dict(item.get("supplemental_result_template") or {}),
                blocking_reason=str(item.get("blocking_reason") or ""),
                operator_action=str(item.get("operator_action") or ""),
            )
        )
    return tasks


def _preview_case_with_probe_payload(enriched_case: dict[str, Any], payload: dict[str, Any]) -> PreparedCase | None:
    if not payload.get("results"):
        return None
    return prepare_mimic_ext_case(enriched_case, supplemental_results=payload)


def _resolve_optional_path(path: Path | None) -> Path | None:
    return path.expanduser().resolve() if path else None


def _main() -> int:
    parser = argparse.ArgumentParser(
        description="Probe local MIMIC sources and write a refreshed PreparedCase only when decisive source gaps resolve."
    )
    parser.add_argument("input", type=Path, help="Local restricted enriched cases JSON.")
    parser.add_argument("--case-id", required=True, help="Case id to refresh from the enriched case file.")
    parser.add_argument("--source-root", required=True, type=Path, help="Local source root containing MIMIC source folders or ZIPs.")
    parser.add_argument("--mimic-hosp-dir", type=Path, help="Local MIMIC-IV hosp root containing labevents and d_labitems.")
    parser.add_argument("--mimic-note-dir", type=Path, help="Local MIMIC-IV-Note root, radiology CSV path, or zip.")
    parser.add_argument("--mimic-cxr-dir", type=Path, help="Local MIMIC-CXR root, report CSV path, or raw files root.")
    parser.add_argument("--mimic-ecg-dir", type=Path, help="Local MIMIC-IV-ECG root, machine_measurements CSV path, or zip.")
    parser.add_argument("--ecg-index-report", type=Path, help="Prebuilt source_ecg_index JSON to use instead of streaming machine_measurements.")
    parser.add_argument("--output", required=True, type=Path, help="PreparedCase output path. Written only when source gaps resolve.")
    parser.add_argument("--report-output", type=Path, help="Optional source refresh report JSON path.")
    parser.add_argument("--limit", type=int, default=5, help="Maximum source candidates per probe source.")
    parser.add_argument("--probe-labs", action="store_true", help="Also probe large MIMIC-IV hosp lab tables.")
    parser.add_argument("--skip-ecg-probe", action="store_true", help="Skip MIMIC-IV-ECG probing for imaging-only refresh runs.")
    args = parser.parse_args()

    enriched_case = find_enriched_case(load_enriched_cases(args.input), args.case_id)
    try:
        _case, report = refresh_case_from_source_root(
            enriched_case,
            source_root=args.source_root.expanduser().resolve(),
            mimic_hosp_dir=_resolve_optional_path(args.mimic_hosp_dir),
            mimic_note_dir=_resolve_optional_path(args.mimic_note_dir),
            mimic_cxr_dir=_resolve_optional_path(args.mimic_cxr_dir),
            mimic_ecg_dir=_resolve_optional_path(args.mimic_ecg_dir),
            ecg_index=load_ecg_source_index(args.ecg_index_report).rows_by_subject if args.ecg_index_report else None,
            output_path=args.output,
            limit=args.limit,
            probe_labs=args.probe_labs,
            probe_ecg=not args.skip_ecg_probe,
        )
    except CasePreparationError:
        raise

    rendered = report.model_dump_json(indent=2)
    if args.report_output:
        args.report_output.parent.mkdir(parents=True, exist_ok=True)
        args.report_output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0 if report.output_written else 1


if __name__ == "__main__":
    raise SystemExit(_main())
