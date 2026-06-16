from __future__ import annotations

import argparse
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from backend.cases.prepare import CasePreparationError
from backend.cases.schemas import PreparedCase
from backend.cases.source_refresh import SourceAcquisitionTask, SourceRefreshReport


class SourceAcquisitionChecklist(BaseModel):
    case_id: str
    source_root: str
    source_ready: bool = False
    source_refresh_output_written: bool = False
    blocking_signals: list[str] = Field(default_factory=list)
    unresolved_release_blocking_order_ids: list[str] = Field(default_factory=list)
    missing_source_modules: list[str] = Field(default_factory=list)
    task_count: int = 0
    tasks: list[SourceAcquisitionTask] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    grader_only_truth_excluded: Literal[True] = True


def build_source_acquisition_checklist(report: SourceRefreshReport) -> SourceAcquisitionChecklist:
    tasks = list(report.source_acquisition_tasks)
    missing_modules = sorted(
        {
            module
            for task in tasks
            for module in task.missing_source_modules
            if module
        }
    )
    return SourceAcquisitionChecklist(
        case_id=report.case_id,
        source_root=report.source_root,
        source_ready=report.output_written and not tasks and not report.blocking_signals,
        source_refresh_output_written=report.output_written,
        blocking_signals=list(report.blocking_signals),
        unresolved_release_blocking_order_ids=list(report.unresolved_release_blocking_order_ids),
        missing_source_modules=missing_modules,
        task_count=len(tasks),
        tasks=tasks,
        next_actions=_next_actions(report, tasks, missing_modules),
    )


def assert_source_acquisition_matches_case(
    case: PreparedCase,
    checklist: SourceAcquisitionChecklist | None,
) -> None:
    if checklist is None:
        return
    if checklist.case_id != case.case_id:
        raise CasePreparationError(
            f"Source acquisition checklist case_id {checklist.case_id!r} does not match prepared case {case.case_id!r}."
        )


def _next_actions(
    report: SourceRefreshReport,
    tasks: list[SourceAcquisitionTask],
    missing_modules: list[str],
) -> list[str]:
    if not tasks:
        if report.output_written:
            return [
                "Source refresh wrote a prepared case; rerun the learner-readiness bundle and clinician review artifacts."
            ]
        return [
            "No source acquisition tasks were generated; rerun source_refresh and inspect source_probe for non-release-blocking candidates."
        ]

    actions: list[str] = []
    if missing_modules:
        actions.append(
            "Acquire or point --source-root at the missing local source modules: "
            + ", ".join(missing_modules)
            + "."
        )
    actions.append(
        "Run each localized_operator_query against the credentialed local source files and choose only encounter-linked rows."
    )
    actions.append(
        "Fill the supplemental_result_template with source-recorded narrative or values only; do not infer or summarize beyond the source row."
    )
    actions.append(
        "Rerun backend.cases.source_refresh; it must write the prepared case before learner readiness can advance."
    )
    return actions


def _main() -> int:
    parser = argparse.ArgumentParser(
        description="Build a hidden-safe checklist for unresolved source acquisition tasks from a SourceRefreshReport."
    )
    parser.add_argument("source_refresh_report", type=Path, help="SourceRefreshReport JSON.")
    parser.add_argument("--output", type=Path, help="Optional checklist JSON output path.")
    args = parser.parse_args()

    report = SourceRefreshReport.model_validate_json(args.source_refresh_report.read_text(encoding="utf-8"))
    checklist = build_source_acquisition_checklist(report)
    rendered = checklist.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0 if checklist.source_ready else 1


if __name__ == "__main__":
    raise SystemExit(_main())
