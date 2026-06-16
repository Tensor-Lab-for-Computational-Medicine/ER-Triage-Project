from __future__ import annotations

import argparse
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from backend.cases.case_pool_audit import CasePoolAudit, CasePoolCandidate
from backend.cases.source_refresh import SourceRefreshReport


class PivotCommand(BaseModel):
    label: str
    command: str
    writes: list[str] = Field(default_factory=list)


class CasePivotPlan(BaseModel):
    selected_case_id: str | None = None
    recommended_case_id: str | None = None
    recommended_source_evidence_case_id: str | None = None
    recommended_unblocked_source_evidence_case_id: str | None = None
    recommended_case_rank: int | None = None
    recommendation_available: bool = False
    selected_case_rank: int | None = None
    selected_case_blockers: list[str] = Field(default_factory=list)
    recommended_auto_apply_decisive_result_ids: list[str] = Field(default_factory=list)
    recommended_unresolved_release_blocking_signals: list[str] = Field(default_factory=list)
    recommended_blocker_issue_codes: list[str] = Field(default_factory=list)
    source_refresh_report_case_id: str | None = None
    source_refresh_output_written: bool = False
    source_refresh_supplemental_result_count: int = 0
    source_refresh_supplemental_result_order_ids: list[str] = Field(default_factory=list)
    source_refresh_manual_verification_candidate_order_ids: list[str] = Field(default_factory=list)
    source_refresh_preview_result_bundle_ids: list[str] = Field(default_factory=list)
    source_refresh_blocking_signals: list[str] = Field(default_factory=list)
    source_refresh_unresolved_release_blocking_order_ids: list[str] = Field(default_factory=list)
    source_refresh_preview_blocking_signals: list[str] = Field(default_factory=list)
    source_refresh_acquisition_task_count: int = 0
    source_refresh_missing_source_modules: list[str] = Field(default_factory=list)
    ready_to_pivot: bool = False
    required_steps: list[str] = Field(default_factory=list)
    commands: list[PivotCommand] = Field(default_factory=list)
    grader_only_truth_excluded: Literal[True] = True


def _cmd_arg(value: str | Path) -> str:
    text = str(value)
    if not text or any(char.isspace() for char in text):
        return '"' + text.replace('"', '\\"') + '"'
    return text


def build_case_pivot_plan(
    case_pool_audit: CasePoolAudit,
    *,
    source_refresh_report: SourceRefreshReport | None = None,
    source_root: str = "D:/physionet",
    enriched_source_file: str | None = None,
) -> CasePivotPlan:
    selected_case_id = case_pool_audit.selected_case_id
    recommended_case_id = (
        case_pool_audit.recommended_unblocked_source_evidence_case_id
        or case_pool_audit.recommended_source_evidence_case_id
        or case_pool_audit.recommended_case_id
    )
    recommended = _candidate_by_id(case_pool_audit, recommended_case_id)
    selected = _candidate_by_id(case_pool_audit, selected_case_id)
    recommendation_available = bool(recommended_case_id and recommended_case_id != selected_case_id)
    refresh_preview_blockers = _preview_blocking_signals(source_refresh_report)
    refresh_blockers = list(source_refresh_report.blocking_signals) if source_refresh_report else []
    ready_to_pivot = bool(
        recommendation_available
        and source_refresh_report
        and source_refresh_report.output_written
        and not refresh_blockers
        and not refresh_preview_blockers
    )
    return CasePivotPlan(
        selected_case_id=selected_case_id,
        recommended_case_id=recommended_case_id,
        recommended_source_evidence_case_id=case_pool_audit.recommended_source_evidence_case_id,
        recommended_unblocked_source_evidence_case_id=case_pool_audit.recommended_unblocked_source_evidence_case_id,
        recommended_case_rank=_candidate_rank(case_pool_audit, recommended_case_id),
        recommendation_available=recommendation_available,
        selected_case_rank=case_pool_audit.selected_case_rank,
        selected_case_blockers=list(case_pool_audit.selected_case_blockers),
        recommended_auto_apply_decisive_result_ids=list(recommended.source_probe_auto_apply_decisive_result_ids)
        if recommended
        else [],
        recommended_unresolved_release_blocking_signals=list(recommended.source_probe_unresolved_release_blocking_signals)
        if recommended
        else [],
        recommended_blocker_issue_codes=list(recommended.blocker_issue_codes) if recommended else [],
        source_refresh_report_case_id=source_refresh_report.case_id if source_refresh_report else None,
        source_refresh_output_written=bool(source_refresh_report and source_refresh_report.output_written),
        source_refresh_supplemental_result_count=source_refresh_report.supplemental_result_count
        if source_refresh_report
        else 0,
        source_refresh_supplemental_result_order_ids=list(source_refresh_report.supplemental_result_order_ids)
        if source_refresh_report
        else [],
        source_refresh_manual_verification_candidate_order_ids=list(
            source_refresh_report.manual_verification_candidate_order_ids
        )
        if source_refresh_report
        else [],
        source_refresh_preview_result_bundle_ids=list(source_refresh_report.preview_result_bundle_ids)
        if source_refresh_report
        else [],
        source_refresh_blocking_signals=refresh_blockers,
        source_refresh_unresolved_release_blocking_order_ids=list(
            source_refresh_report.unresolved_release_blocking_order_ids
        )
        if source_refresh_report
        else [],
        source_refresh_preview_blocking_signals=refresh_preview_blockers,
        source_refresh_acquisition_task_count=(
            len(source_refresh_report.source_acquisition_tasks) if source_refresh_report else 0
        ),
        source_refresh_missing_source_modules=_missing_source_modules(source_refresh_report),
        ready_to_pivot=ready_to_pivot,
        required_steps=_required_steps(
            selected=selected,
            recommended=recommended,
            source_refresh_report=source_refresh_report,
            ready_to_pivot=ready_to_pivot,
        ),
        commands=_commands(
            recommended_case_id=recommended_case_id,
            source_root=source_root,
            enriched_source_file=enriched_source_file or case_pool_audit.source_file,
        ),
    )


def _candidate_by_id(case_pool_audit: CasePoolAudit, case_id: str | None) -> CasePoolCandidate | None:
    if not case_id:
        return None
    for candidate in case_pool_audit.candidates:
        if candidate.case_id == case_id:
            return candidate
    return None


def _candidate_rank(case_pool_audit: CasePoolAudit, case_id: str | None) -> int | None:
    if not case_id:
        return None
    for index, candidate in enumerate(case_pool_audit.candidates, start=1):
        if candidate.case_id == case_id:
            return index
    return None


def _preview_blocking_signals(source_refresh_report: SourceRefreshReport | None) -> list[str]:
    if not source_refresh_report or not source_refresh_report.preview_source_gaps_after_payload:
        return []
    return sorted(
        {
            str(item.get("signal") or "")
            for item in source_refresh_report.preview_source_gaps_after_payload.release_blocking_missing_results
            if item.get("signal")
        }
    )


def _missing_source_modules(source_refresh_report: SourceRefreshReport | None) -> list[str]:
    if not source_refresh_report:
        return []
    return sorted(
        {
            module
            for task in source_refresh_report.source_acquisition_tasks
            for module in task.missing_source_modules
            if module
        }
    )


def _required_steps(
    *,
    selected: CasePoolCandidate | None,
    recommended: CasePoolCandidate | None,
    source_refresh_report: SourceRefreshReport | None,
    ready_to_pivot: bool,
) -> list[str]:
    if ready_to_pivot:
        return [
            "Switch the pilot case to the recommended prepared output, then regenerate playthrough, readiness, clinician-review, and grader-validation artifacts for that case_id."
        ]
    steps: list[str] = []
    if recommended is None:
        steps.append("Rerun case_pool_audit with --source-root and confirm a higher-ranked abdominal candidate exists.")
        return steps
    if not recommended.source_evidence_unblocked:
        steps.append(
            "No release-unblocked source-evidence candidate is available yet; this recommendation is a blocked evidence lead, not a pivot-ready case."
        )
    if recommended.source_probe_auto_apply_decisive_result_ids:
        steps.append(
            "Preserve the recommended candidate's auto-applyable source evidence: "
            + ", ".join(recommended.source_probe_auto_apply_decisive_result_ids)
            + "."
        )
    if source_refresh_report is None:
        steps.append("Run source_refresh for the recommended case and review its fail-closed report before pivoting.")
    elif source_refresh_report.blocking_signals:
        order_suffix = ""
        if source_refresh_report.unresolved_release_blocking_order_ids:
            order_suffix = " Candidate order ids: " + ", ".join(source_refresh_report.unresolved_release_blocking_order_ids) + "."
        missing_modules = _missing_source_modules(source_refresh_report)
        module_suffix = ""
        if missing_modules:
            module_suffix = " Missing source modules: " + ", ".join(missing_modules) + "."
        steps.append(
            "Resolve source_refresh.blocking_signals for the recommended case: "
            + ", ".join(source_refresh_report.blocking_signals)
            + "."
            + order_suffix
            + module_suffix
        )
    if source_refresh_report and source_refresh_report.manual_verification_candidate_order_ids:
        steps.append(
            "Manually verify timing before applying source_refresh.manual_verification_candidate_order_ids: "
            + ", ".join(source_refresh_report.manual_verification_candidate_order_ids)
            + "."
        )
    if source_refresh_report and source_refresh_report.preview_result_bundle_ids:
        steps.append(
            "Use source_refresh.preview_result_bundle_ids to verify partial payload impact; do not write or release while blockers remain."
        )
    if selected and selected.blocker_issue_codes:
        steps.append(
            "Keep the currently selected case fail-closed while blockers remain: "
            + ", ".join(selected.blocker_issue_codes)
            + "."
        )
    return steps


def _commands(
    *,
    recommended_case_id: str | None,
    source_root: str,
    enriched_source_file: str,
) -> list[PivotCommand]:
    if not recommended_case_id:
        return []
    refresh_report = Path("data") / "restricted" / f"{recommended_case_id}.source-refresh.local.json"
    refresh_output = Path("data") / "cases" / f"{recommended_case_id}.source-refresh.local.json"
    readiness_report = Path("data") / "restricted" / f"{recommended_case_id}.pilot-readiness.local.json"
    artifact_dir = Path("data") / "restricted" / f"{recommended_case_id}-readiness"
    return [
        PivotCommand(
            label="source-refresh recommended case",
            command=(
                f"python -m backend.cases.source_refresh {_cmd_arg(enriched_source_file)} "
                f"--case-id {recommended_case_id} "
                f"--source-root {_cmd_arg(source_root)} "
                f"--output {_cmd_arg(refresh_output)} "
                f"--report-output {_cmd_arg(refresh_report)}"
            ),
            writes=[str(refresh_report), str(refresh_output)],
        ),
        PivotCommand(
            label="readiness bundle for recommended case",
            command=(
                f"python -m backend.cases.pilot_readiness_bundle {_cmd_arg(refresh_output)} "
                f"--output {_cmd_arg(readiness_report)} "
                f"--artifact-dir {_cmd_arg(artifact_dir)}"
            ),
            writes=[str(readiness_report), str(artifact_dir)],
        ),
    ]


def _main() -> int:
    parser = argparse.ArgumentParser(description="Build a hidden-safe pivot plan from the selected case to the ranked recommended case.")
    parser.add_argument("case_pool_audit", type=Path, help="CasePoolAudit JSON.")
    parser.add_argument("--source-refresh-report", type=Path, help="Optional SourceRefreshReport JSON for the recommended case.")
    parser.add_argument("--source-root", default="D:/physionet", help="Source root to show in generated commands.")
    parser.add_argument("--enriched-source-file", help="Enriched cases file to show in generated commands.")
    parser.add_argument("--output", type=Path, help="Optional pivot-plan JSON output path.")
    args = parser.parse_args()

    case_pool_audit = CasePoolAudit.model_validate_json(args.case_pool_audit.read_text(encoding="utf-8"))
    source_refresh_report = (
        SourceRefreshReport.model_validate_json(args.source_refresh_report.read_text(encoding="utf-8"))
        if args.source_refresh_report
        else None
    )
    plan = build_case_pivot_plan(
        case_pool_audit,
        source_refresh_report=source_refresh_report,
        source_root=args.source_root,
        enriched_source_file=args.enriched_source_file,
    )
    rendered = plan.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0 if plan.ready_to_pivot else 1


if __name__ == "__main__":
    raise SystemExit(_main())
