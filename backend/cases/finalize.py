from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.cases.goal_audit import GoalCompletionAudit, build_goal_completion_audit
from backend.cases.hidden_wall import HiddenWallAudit, build_hidden_wall_audit, build_hidden_wall_payload
from backend.cases.live_state_audit import LiveStateAudit, build_live_state_audit
from backend.cases.playthrough import PlaythroughAction, load_playthrough_actions, run_scripted_playthrough
from backend.cases.prepare import CasePreparationError
from backend.cases.readiness import CaseReadinessReport, validate_abdominal_case_readiness
from backend.cases.release_gate_audit import ReleaseGateAudit, build_release_gate_audit
from backend.cases.review import apply_case_review
from backend.cases.schemas import PreparedCase
from backend.cases.source_gaps import SourceGapReport, build_source_gap_report


class CaseFinalizationReport(BaseModel):
    case_id: str
    ready_for_learner_pilot: bool
    reviewed: bool = False
    objective_playthrough_ready: bool = False
    output_written: bool = False
    output_path: str | None = None
    review_error: str | None = None
    playthrough_error: str | None = None
    readiness: CaseReadinessReport | None = None
    hidden_wall: HiddenWallAudit | None = None
    live_state: LiveStateAudit | None = None
    release_gate: ReleaseGateAudit | None = None
    source_gaps: SourceGapReport | None = None
    goal_audit: GoalCompletionAudit | None = None
    blocking_issue_codes: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    grader_only_truth_excluded: Literal[True] = True


def finalize_case_for_learner(
    case: PreparedCase,
    review_artifact: dict[str, Any],
    playthrough_actions: list[PlaythroughAction | dict[str, Any]],
) -> tuple[PreparedCase, CaseFinalizationReport]:
    """Apply clinician release evidence and verify the final learner gate.

    This function intentionally does not write files. Callers should only write
    the returned case when the report says ready_for_learner_pilot=true.
    """

    try:
        reviewed = apply_case_review(case, review_artifact)
    except CasePreparationError as exc:
        return case, CaseFinalizationReport(
            case_id=case.case_id,
            ready_for_learner_pilot=False,
            review_error=str(exc),
            blocking_issue_codes=["review_artifact_rejected"],
            notes=["Review artifact was rejected; no learner-ready case should be written."],
        )

    playthrough_report = None
    playthrough_error = None
    try:
        playthrough_report, _hidden_package = run_scripted_playthrough(reviewed, playthrough_actions)
    except Exception as exc:  # pragma: no cover - parser/runtime details vary by script
        playthrough_error = f"{type(exc).__name__}: {exc}"

    readiness = validate_abdominal_case_readiness(
        reviewed,
        playthrough_report=playthrough_report,
        require_playthrough=True,
        playthrough_error=playthrough_error,
    )
    hidden_wall_payload = build_hidden_wall_payload(reviewed)
    hidden_wall = build_hidden_wall_audit(reviewed, hidden_wall_payload)
    live_state = build_live_state_audit(reviewed)
    release_gate = build_release_gate_audit(reviewed)
    source_gaps = build_source_gap_report(reviewed)
    goal_audit = build_goal_completion_audit(
        reviewed,
        readiness=readiness,
        hidden_wall=hidden_wall,
        live_state=live_state,
        release_gate=release_gate,
        source_gaps=source_gaps,
        playthrough_report=playthrough_report,
    )
    objective_ready = bool(playthrough_report and playthrough_report.objective_ready)
    ready = readiness.ready_for_learner_pilot and objective_ready and goal_audit.complete
    blocker_codes = [
        issue.code
        for issue in readiness.issues
        if issue.severity == "blocker"
    ]
    if not objective_ready and "objective_playthrough_incomplete" not in blocker_codes and not playthrough_error:
        blocker_codes.append("objective_playthrough_incomplete")
    if playthrough_error and "objective_playthrough_error" not in blocker_codes:
        blocker_codes.append("objective_playthrough_error")

    return reviewed, CaseFinalizationReport(
        case_id=reviewed.case_id,
        ready_for_learner_pilot=ready,
        reviewed=True,
        objective_playthrough_ready=objective_ready,
        playthrough_error=playthrough_error,
        readiness=readiness,
        hidden_wall=hidden_wall,
        live_state=live_state,
        release_gate=release_gate,
        source_gaps=source_gaps,
        goal_audit=goal_audit,
        blocking_issue_codes=sorted(dict.fromkeys(blocker_codes)),
        notes=[] if ready else ["Final learner-ready case was not written because one or more release gates are still blocked."],
    )


def _main() -> int:
    parser = argparse.ArgumentParser(description="Apply local release evidence and write a learner-ready case only if every gate passes.")
    parser.add_argument("case", type=Path, help="PreparedCase JSON.")
    parser.add_argument("--review", required=True, type=Path, help="Completed local CaseReviewArtifact JSON.")
    parser.add_argument("--playthrough-script", required=True, type=Path, help="Hidden-safe objective playthrough script.")
    parser.add_argument("--output", required=True, type=Path, help="Learner-ready PreparedCase output path.")
    parser.add_argument("--report-output", type=Path, help="Optional finalization report JSON path.")
    args = parser.parse_args()

    case = PreparedCase.model_validate_json(args.case.read_text(encoding="utf-8"))
    review_artifact = json.loads(args.review.read_text(encoding="utf-8"))
    actions = load_playthrough_actions(args.playthrough_script)
    finalized, report = finalize_case_for_learner(case, review_artifact, actions)

    if report.ready_for_learner_pilot:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(finalized.model_dump(mode="json"), indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        report.output_written = True
        report.output_path = str(args.output)

    rendered = report.model_dump_json(indent=2)
    if args.report_output:
        args.report_output.parent.mkdir(parents=True, exist_ok=True)
        args.report_output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0 if report.ready_for_learner_pilot else 1


if __name__ == "__main__":
    raise SystemExit(_main())
