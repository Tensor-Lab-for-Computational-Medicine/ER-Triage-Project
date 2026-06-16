from __future__ import annotations

import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.cases.mimic_ext import load_enriched_cases, load_supplemental_results, prepare_mimic_ext_case
from backend.cases.prepare import CasePreparationError
from backend.cases.readiness import ABDOMINAL_COMPLAINT_TERMS, DECISIVE_SOURCE_RESULT_IDS, validate_abdominal_case_readiness
from backend.cases.source_ecg_index import build_ecg_source_index, load_ecg_source_index
from backend.cases.source_probe import build_source_probe_report


class CasePoolCandidate(BaseModel):
    case_id: str
    title: str = ""
    chief_complaint: str = ""
    preparable: bool = True
    abdominal_complaint: bool = False
    result_bundle_ids: list[str] = Field(default_factory=list)
    decisive_result_ids: list[str] = Field(default_factory=list)
    documented_order_signals: list[str] = Field(default_factory=list)
    documented_orders_without_results: list[str] = Field(default_factory=list)
    source_probe_detected_source_dirs: dict[str, str] = Field(default_factory=dict)
    source_probe_checked_paths: list[str] = Field(default_factory=list)
    source_probe_auto_apply_order_ids: list[str] = Field(default_factory=list)
    source_probe_auto_apply_decisive_result_ids: list[str] = Field(default_factory=list)
    source_probe_unresolved_release_blocking_signals: list[str] = Field(default_factory=list)
    source_probe_notes: list[str] = Field(default_factory=list)
    source_evidence_unblocked: bool = False
    source_evidence_status: Literal[
        "attached_decisive_result",
        "auto_applyable_decisive_available",
        "missing_decisive_source_result",
    ] = "missing_decisive_source_result"
    blocker_issue_codes: list[str] = Field(default_factory=list)
    warning_issue_codes: list[str] = Field(default_factory=list)
    selection_score: int = 0
    selection_reasons: list[str] = Field(default_factory=list)
    error: str | None = None


class CasePoolAudit(BaseModel):
    source_file: str
    total_cases: int
    preparable_cases: int
    abdominal_candidates: int
    candidates_with_decisive_result: int
    candidates_with_auto_applyable_decisive_result: int = 0
    candidates_with_source_evidence_path: int = 0
    candidates_with_unblocked_source_evidence_path: int = 0
    recommended_case_id: str | None = None
    recommended_source_evidence_case_id: str | None = None
    recommended_source_evidence_case_rank: int | None = None
    recommended_unblocked_source_evidence_case_id: str | None = None
    recommended_unblocked_source_evidence_case_rank: int | None = None
    selected_case_id: str | None = None
    selected_case_rank: int | None = None
    selected_case_blockers: list[str] = Field(default_factory=list)
    candidates: list[CasePoolCandidate] = Field(default_factory=list)
    excluded_cases: list[CasePoolCandidate] = Field(default_factory=list)
    grader_only_truth_excluded: bool = True


def build_case_pool_audit(
    enriched_cases: list[dict[str, Any]],
    *,
    source_file: str = "",
    selected_case_id: str | None = None,
    selected_supplemental_results: dict[str, Any] | list[dict[str, Any]] | None = None,
    source_root: Path | None = None,
    mimic_ecg_dir: Path | None = None,
    ecg_index: dict[str, list[dict[str, Any]]] | None = None,
    source_probe_limit: int = 3,
    top_n: int = 25,
) -> CasePoolAudit:
    if ecg_index is None:
        ecg_index = build_ecg_source_index(
            source_root=source_root,
            mimic_ecg_dir=mimic_ecg_dir,
            subject_ids=_subject_ids_from_enriched_cases(enriched_cases),
            limit_per_subject=max(1, source_probe_limit),
        ).rows_by_subject
    candidates: list[CasePoolCandidate] = []
    excluded: list[CasePoolCandidate] = []
    for enriched_case in enriched_cases:
        case_id = _enriched_case_id(enriched_case)
        supplemental = selected_supplemental_results if selected_case_id and case_id == selected_case_id else None
        candidate = _candidate_from_enriched_case(
            enriched_case,
            supplemental_results=supplemental,
            source_root=source_root,
            source_probe_limit=source_probe_limit,
            ecg_index=ecg_index,
        )
        if candidate.preparable and candidate.abdominal_complaint:
            candidates.append(candidate)
        else:
            excluded.append(candidate)

    ranked = sorted(candidates, key=lambda item: (-item.selection_score, item.case_id))
    source_evidence_ranked = [
        candidate
        for candidate in ranked
        if candidate.source_evidence_status in {"attached_decisive_result", "auto_applyable_decisive_available"}
    ]
    unblocked_source_evidence_ranked = [
        candidate
        for candidate in source_evidence_ranked
        if candidate.source_evidence_unblocked
    ]
    selected_rank = None
    selected_blockers: list[str] = []
    if selected_case_id:
        for index, candidate in enumerate(ranked, start=1):
            if candidate.case_id == selected_case_id:
                selected_rank = index
                selected_blockers = list(candidate.blocker_issue_codes)
                break
    return CasePoolAudit(
        source_file=source_file,
        total_cases=len(enriched_cases),
        preparable_cases=sum(1 for item in [*candidates, *excluded] if item.preparable),
        abdominal_candidates=len(candidates),
        candidates_with_decisive_result=sum(1 for item in candidates if item.decisive_result_ids),
        candidates_with_auto_applyable_decisive_result=sum(
            1 for item in candidates if item.source_probe_auto_apply_decisive_result_ids
        ),
        candidates_with_source_evidence_path=len(source_evidence_ranked),
        candidates_with_unblocked_source_evidence_path=len(unblocked_source_evidence_ranked),
        recommended_case_id=ranked[0].case_id if ranked else None,
        recommended_source_evidence_case_id=source_evidence_ranked[0].case_id if source_evidence_ranked else None,
        recommended_source_evidence_case_rank=(
            ranked.index(source_evidence_ranked[0]) + 1 if source_evidence_ranked else None
        ),
        recommended_unblocked_source_evidence_case_id=(
            unblocked_source_evidence_ranked[0].case_id if unblocked_source_evidence_ranked else None
        ),
        recommended_unblocked_source_evidence_case_rank=(
            ranked.index(unblocked_source_evidence_ranked[0]) + 1 if unblocked_source_evidence_ranked else None
        ),
        selected_case_id=selected_case_id,
        selected_case_rank=selected_rank,
        selected_case_blockers=selected_blockers,
        candidates=ranked[: max(1, top_n)],
        excluded_cases=excluded[: max(1, top_n)],
    )


def _candidate_from_enriched_case(
    enriched_case: dict[str, Any],
    *,
    supplemental_results: dict[str, Any] | list[dict[str, Any]] | None = None,
    source_root: Path | None = None,
    source_probe_limit: int = 3,
    ecg_index: dict[str, list[dict[str, Any]]] | None = None,
) -> CasePoolCandidate:
    case_id = _enriched_case_id(enriched_case)
    try:
        prepared = prepare_mimic_ext_case(enriched_case, supplemental_results=supplemental_results)
    except Exception as exc:
        return CasePoolCandidate(
            case_id=case_id,
            preparable=False,
            error=f"{type(exc).__name__}: {exc}",
            selection_reasons=["Case could not be prepared from available source fields."],
        )

    readiness = validate_abdominal_case_readiness(prepared)
    blocker_codes = sorted(issue.code for issue in readiness.issues if issue.severity == "blocker")
    warning_codes = sorted(issue.code for issue in readiness.issues if issue.severity == "warning")
    result_ids = sorted(prepared.result_bundles)
    decisive = sorted(set(result_ids) & set(DECISIVE_SOURCE_RESULT_IDS))
    text = f"{prepared.title} {prepared.visible_start.chief_complaint}".lower()
    abdominal = any(term in text for term in ABDOMINAL_COMPLAINT_TERMS)
    source_probe_summary = _source_probe_summary_for_candidate(
        prepared,
        abdominal=abdominal,
        source_root=source_root,
        source_probe_limit=source_probe_limit,
        ecg_index=ecg_index or {},
    )
    source_evidence_status = _source_evidence_status(
        decisive,
        source_probe_summary["auto_apply_decisive_result_ids"],
    )
    source_evidence_unblocked = _source_evidence_unblocked(
        source_evidence_status=source_evidence_status,
        blocker_codes=blocker_codes,
        source_probe_unresolved=source_probe_summary["unresolved_release_blocking_signals"],
    )
    reasons = _selection_reasons(
        abdominal=abdominal,
        result_ids=result_ids,
        decisive=decisive,
        documented_order_signals=list(prepared.source_evidence_audit.documented_order_signals),
        documented_orders_without_results=list(prepared.source_evidence_audit.documented_orders_without_results),
        source_probe_auto_apply_decisive=source_probe_summary["auto_apply_decisive_result_ids"],
        source_probe_unresolved=source_probe_summary["unresolved_release_blocking_signals"],
        source_evidence_unblocked=source_evidence_unblocked,
        blocker_codes=blocker_codes,
        warning_codes=warning_codes,
    )
    return CasePoolCandidate(
        case_id=prepared.case_id,
        title=prepared.title,
        chief_complaint=prepared.visible_start.chief_complaint,
        preparable=True,
        abdominal_complaint=abdominal,
        result_bundle_ids=result_ids,
        decisive_result_ids=decisive,
        documented_order_signals=list(prepared.source_evidence_audit.documented_order_signals),
        documented_orders_without_results=list(prepared.source_evidence_audit.documented_orders_without_results),
        source_probe_detected_source_dirs=source_probe_summary["detected_source_dirs"],
        source_probe_checked_paths=source_probe_summary["checked_paths"],
        source_probe_auto_apply_order_ids=source_probe_summary["auto_apply_order_ids"],
        source_probe_auto_apply_decisive_result_ids=source_probe_summary["auto_apply_decisive_result_ids"],
        source_probe_unresolved_release_blocking_signals=source_probe_summary["unresolved_release_blocking_signals"],
        source_probe_notes=source_probe_summary["notes"],
        source_evidence_unblocked=source_evidence_unblocked,
        source_evidence_status=source_evidence_status,
        blocker_issue_codes=blocker_codes,
        warning_issue_codes=warning_codes,
        selection_score=_selection_score(
            abdominal=abdominal,
            result_ids=result_ids,
            decisive=decisive,
            documented_order_signals=list(prepared.source_evidence_audit.documented_order_signals),
            documented_orders_without_results=list(prepared.source_evidence_audit.documented_orders_without_results),
            source_probe_auto_apply_decisive=source_probe_summary["auto_apply_decisive_result_ids"],
            blocker_codes=blocker_codes,
            warning_codes=warning_codes,
        ),
        selection_reasons=reasons,
    )


def _enriched_case_id(enriched_case: dict[str, Any]) -> str:
    return str(enriched_case.get("id") or enriched_case.get("case_id") or "")


def _subject_ids_from_enriched_cases(enriched_cases: list[dict[str, Any]]) -> set[str]:
    subject_ids: set[str] = set()
    for enriched_case in enriched_cases:
        identifiers = enriched_case.get("identifiers") or {}
        value = _clean_identifier(identifiers.get("subject_id"))
        if value:
            subject_ids.add(value)
    return subject_ids


def _source_evidence_status(decisive: list[str], source_probe_auto_apply_decisive: list[str]) -> str:
    if decisive:
        return "attached_decisive_result"
    if source_probe_auto_apply_decisive:
        return "auto_applyable_decisive_available"
    return "missing_decisive_source_result"


def _source_evidence_unblocked(
    *,
    source_evidence_status: str,
    blocker_codes: list[str],
    source_probe_unresolved: list[str],
) -> bool:
    if source_evidence_status == "missing_decisive_source_result":
        return False
    if source_evidence_status == "auto_applyable_decisive_available":
        return not source_probe_unresolved
    if "release_blocking_source_result_gap" in blocker_codes:
        return False
    if source_probe_unresolved:
        return False
    return True


def _selection_score(
    *,
    abdominal: bool,
    result_ids: list[str],
    decisive: list[str],
    documented_order_signals: list[str],
    documented_orders_without_results: list[str],
    source_probe_auto_apply_decisive: list[str],
    blocker_codes: list[str],
    warning_codes: list[str],
) -> int:
    score = 0
    if abdominal:
        score += 100
    score += len(result_ids) * 8
    score += len(decisive) * 75
    score += len(source_probe_auto_apply_decisive) * 60
    if "ct_imaging_order" in documented_order_signals or "ct_abdomen_pelvis_with_contrast" in documented_order_signals:
        score += 25
    if documented_orders_without_results:
        score += 10
    score -= 30 * len([code for code in blocker_codes if code != "missing_decisive_source_result"])
    score -= 12 * len(warning_codes)
    return score


def _selection_reasons(
    *,
    abdominal: bool,
    result_ids: list[str],
    decisive: list[str],
    documented_order_signals: list[str],
    documented_orders_without_results: list[str],
    source_probe_auto_apply_decisive: list[str],
    source_probe_unresolved: list[str],
    source_evidence_unblocked: bool,
    blocker_codes: list[str],
    warning_codes: list[str],
) -> list[str]:
    reasons: list[str] = []
    if abdominal:
        reasons.append("Chief complaint/title matches abdominal-pain terms.")
    if result_ids:
        reasons.append(f"Prepared source result bundles: {', '.join(result_ids)}.")
    if decisive:
        reasons.append(f"Has source-recorded decisive branch result: {', '.join(decisive)}.")
    else:
        reasons.append("No source-recorded decisive ECG/CT/ultrasound result is attached.")
    if documented_order_signals:
        reasons.append(f"Source order signals: {', '.join(documented_order_signals)}.")
    if documented_orders_without_results:
        reasons.append(f"Documented order signals still missing linked reports/results: {', '.join(documented_orders_without_results)}.")
    if source_probe_auto_apply_decisive:
        reasons.append(
            "Local source probe found auto-applyable decisive result candidates: "
            + ", ".join(source_probe_auto_apply_decisive)
            + "."
        )
    if source_probe_unresolved:
        reasons.append(
            "Local source probe still has unresolved release-blocking signals: "
            + ", ".join(source_probe_unresolved)
            + "."
        )
    if source_evidence_unblocked:
        reasons.append("Source evidence path has no unresolved release-blocking source-result signals.")
    elif decisive or source_probe_auto_apply_decisive:
        reasons.append("Source evidence path is partial; release-blocking source-result signals still prevent pivot/release.")
    if blocker_codes:
        reasons.append(f"Readiness blockers: {', '.join(blocker_codes)}.")
    if warning_codes:
        reasons.append(f"Readiness warnings: {', '.join(warning_codes)}.")
    return reasons


def _source_probe_summary_for_candidate(
    prepared: Any,
    *,
    abdominal: bool,
    source_root: Path | None,
    source_probe_limit: int,
    ecg_index: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    empty = {
        "detected_source_dirs": {},
        "checked_paths": [],
        "auto_apply_order_ids": [],
        "auto_apply_decisive_result_ids": [],
        "unresolved_release_blocking_signals": [],
        "notes": [],
    }
    if not abdominal:
        return empty
    ecg_summary = _ecg_index_summary_for_candidate(prepared, ecg_index, source_probe_limit)
    if source_root is None:
        unresolved = ["source_root_not_provided_for_release_blocking_probe"] if ecg_summary["auto_apply_order_ids"] else []
        notes = [*ecg_summary["notes"]]
        if unresolved:
            notes.append(
                "ECG index evidence is partial because no source root was provided to probe release-blocking CT/US/CXR gaps."
            )
        return {
            **empty,
            "checked_paths": ecg_summary["checked_paths"],
            "auto_apply_order_ids": ecg_summary["auto_apply_order_ids"],
            "auto_apply_decisive_result_ids": ecg_summary["auto_apply_decisive_result_ids"],
            "unresolved_release_blocking_signals": unresolved,
            "notes": notes,
        }
    try:
        report = build_source_probe_report(
            prepared,
            source_root=source_root,
            limit=source_probe_limit,
            probe_labs=False,
            probe_ecg=False,
        )
    except Exception as exc:
        return {
            **empty,
            "auto_apply_order_ids": ecg_summary["auto_apply_order_ids"],
            "auto_apply_decisive_result_ids": ecg_summary["auto_apply_decisive_result_ids"],
            "checked_paths": ecg_summary["checked_paths"],
            "notes": [*ecg_summary["notes"], f"Source probe failed for this candidate: {type(exc).__name__}: {exc}"],
        }
    auto_apply_order_ids = set(
        {
            str(item.get("order_id") or "")
            for item in report.supplemental_results_payload.get("results", [])
            if item.get("order_id")
        }
    )
    auto_apply_order_ids.update(ecg_summary["auto_apply_order_ids"])
    unresolved_signals = {
        str(item.get("signal") or "")
        for item in report.unresolved_release_blocking_results
        if item.get("signal")
    }
    if "ecg_12_lead" in auto_apply_order_ids:
        unresolved_signals.discard("ecg_12_lead")
    notes = [*report.notes, *ecg_summary["notes"]]
    checked_paths = sorted(dict.fromkeys([*report.checked_paths, *ecg_summary["checked_paths"]]))
    return {
        "detected_source_dirs": dict(report.detected_source_dirs),
        "checked_paths": checked_paths,
        "auto_apply_order_ids": sorted(auto_apply_order_ids),
        "auto_apply_decisive_result_ids": sorted(set(auto_apply_order_ids) & set(DECISIVE_SOURCE_RESULT_IDS)),
        "unresolved_release_blocking_signals": sorted(unresolved_signals),
        "notes": notes,
    }


def _ecg_index_summary_for_candidate(
    prepared: Any,
    ecg_index: dict[str, list[dict[str, Any]]],
    limit: int,
) -> dict[str, Any]:
    subject_id = _clean_identifier(prepared.source_evidence_audit.source_identifiers.get("subject_id"))
    rows = list(ecg_index.get(subject_id, []))
    if not rows:
        return {"auto_apply_order_ids": [], "auto_apply_decisive_result_ids": [], "checked_paths": [], "notes": []}
    checked_paths = sorted({str(row.get("source_file")) for row in rows if row.get("source_file")})
    matching_rows = [row for row in rows if _ecg_row_in_case_window(prepared, row)]
    if matching_rows:
        return {
            "auto_apply_order_ids": ["ecg_12_lead"],
            "auto_apply_decisive_result_ids": ["ecg_12_lead"],
            "checked_paths": checked_paths,
            "notes": [
                "Shared ECG source index found encounter-window MIMIC-IV-ECG machine measurements for this candidate."
            ],
        }
    sampled_times = [
        _clean_identifier(row.get("ecg_time"))
        for row in rows[: max(1, limit)]
        if _clean_identifier(row.get("ecg_time"))
    ]
    suffix = f" Sampled ECG times: {', '.join(sampled_times)}." if sampled_times else ""
    return {
        "auto_apply_order_ids": [],
        "auto_apply_decisive_result_ids": [],
        "checked_paths": checked_paths,
        "notes": [
            "Shared ECG source index found subject-level MIMIC-IV-ECG machine measurements, but none were inside the encounter window."
            + suffix
        ],
    }


def _ecg_row_in_case_window(prepared: Any, row: dict[str, Any]) -> bool:
    ecg_time = _parse_source_datetime(row.get("ecg_time"))
    bounds = _case_time_bounds(prepared)
    if not ecg_time or not bounds:
        return False
    lower, upper = bounds
    return lower <= ecg_time <= upper


def _case_time_bounds(prepared: Any) -> tuple[datetime, datetime] | None:
    identifiers = prepared.source_evidence_audit.source_identifiers
    intime = _parse_source_datetime(identifiers.get("intime"))
    if intime:
        outtime = _parse_source_datetime(identifiers.get("outtime")) or intime
        return intime - timedelta(hours=6), outtime + timedelta(hours=24)
    order_times = []
    for row in prepared.source_evidence_audit.documented_order_details:
        parsed = _parse_source_datetime(row.get("ordertime") or row.get("charttime"))
        if parsed:
            order_times.append(parsed)
    if not order_times:
        return None
    return min(order_times) - timedelta(hours=6), max(order_times) + timedelta(hours=24)


def _parse_source_datetime(value: Any) -> datetime | None:
    text = _clean_identifier(value).replace(" ", "T")
    if not text:
        return None
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _clean_identifier(value: Any) -> str:
    text = str(value or "").strip()
    if text.endswith(".0"):
        return text[:-2]
    return text


def _main() -> int:
    parser = argparse.ArgumentParser(description="Build a hidden-safe audit of abdominal candidates in a local MIMIC-IV-Ext case pool.")
    parser.add_argument("input", type=Path, help="Local restricted enriched cases JSON.")
    parser.add_argument("--selected-case-id", help="Case id currently selected for the pilot.")
    parser.add_argument("--selected-supplemental-results", type=Path, help="Optional source-backed supplemental-results JSON to apply to the selected case only.")
    parser.add_argument("--source-root", type=Path, help="Optional local source root to probe for auto-applyable decisive results per abdominal candidate.")
    parser.add_argument("--mimic-ecg-dir", type=Path, help="Optional MIMIC-IV-ECG root, machine_measurements CSV path, or zip for shared ECG indexing.")
    parser.add_argument("--ecg-index-report", type=Path, help="Optional prebuilt source_ecg_index JSON to reuse for ECG candidate summaries.")
    parser.add_argument("--source-probe-limit", type=int, default=3, help="Maximum source-probe candidates per source when --source-root is used.")
    parser.add_argument("--top-n", type=int, default=25, help="Number of ranked candidates/excluded rows to retain.")
    parser.add_argument("--output", type=Path, help="Optional audit JSON output path.")
    args = parser.parse_args()

    try:
        cases = load_enriched_cases(args.input)
    except CasePreparationError:
        raise
    audit = build_case_pool_audit(
        cases,
        source_file=str(args.input),
        selected_case_id=args.selected_case_id,
        selected_supplemental_results=(
            load_supplemental_results(args.selected_supplemental_results.expanduser().resolve())
            if args.selected_supplemental_results
            else None
        ),
        source_root=args.source_root.expanduser().resolve() if args.source_root else None,
        mimic_ecg_dir=args.mimic_ecg_dir.expanduser().resolve() if args.mimic_ecg_dir else None,
        ecg_index=load_ecg_source_index(args.ecg_index_report).rows_by_subject if args.ecg_index_report else None,
        source_probe_limit=args.source_probe_limit,
        top_n=args.top_n,
    )
    rendered = audit.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0 if audit.abdominal_candidates else 1


if __name__ == "__main__":
    raise SystemExit(_main())
