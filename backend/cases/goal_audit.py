from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from backend.cases.hidden_wall import HiddenWallAudit, build_hidden_wall_audit, build_hidden_wall_payload
from backend.cases.live_state_audit import LiveStateAudit, build_live_state_audit
from backend.cases.playthrough import PlaythroughReport, load_playthrough_actions, run_scripted_playthrough
from backend.cases.readiness import CaseReadinessReport, validate_abdominal_case_readiness
from backend.cases.release_gate_audit import ReleaseGateAudit, build_release_gate_audit
from backend.cases.schemas import PreparedCase
from backend.cases.source_acquisition import SourceAcquisitionChecklist, assert_source_acquisition_matches_case
from backend.cases.source_acquisition_preflight import (
    SourceAcquisitionPreflightReport,
    assert_source_acquisition_preflight_matches_case,
)
from backend.cases.source_gaps import SourceGapReport, build_source_gap_report


class GoalAuditItem(BaseModel):
    id: str
    requirement: str
    status: Literal["proven", "blocked", "warning", "missing"]
    evidence: list[str] = Field(default_factory=list)
    issue_codes: list[str] = Field(default_factory=list)


class GoalCompletionAudit(BaseModel):
    case_id: str
    complete: bool
    blocker_count: int
    warning_count: int
    items: list[GoalAuditItem] = Field(default_factory=list)
    grader_only_truth_excluded: Literal[True] = True


def build_goal_completion_audit(
    case: PreparedCase,
    *,
    readiness: CaseReadinessReport | None = None,
    hidden_wall: HiddenWallAudit | None = None,
    live_state: LiveStateAudit | None = None,
    release_gate: ReleaseGateAudit | None = None,
    source_gaps: SourceGapReport | None = None,
    source_acquisition: SourceAcquisitionChecklist | None = None,
    source_acquisition_preflight: SourceAcquisitionPreflightReport | None = None,
    playthrough_report: PlaythroughReport | None = None,
) -> GoalCompletionAudit:
    assert_source_acquisition_matches_case(case, source_acquisition)
    assert_source_acquisition_preflight_matches_case(
        case.case_id,
        source_acquisition_preflight,
        checklist=source_acquisition,
    )
    hidden_wall_payload = None
    if hidden_wall is None:
        hidden_wall_payload = build_hidden_wall_payload(case)
        hidden_wall = build_hidden_wall_audit(case, hidden_wall_payload)
    readiness = readiness or validate_abdominal_case_readiness(
        case,
        playthrough_report=playthrough_report,
        require_playthrough=playthrough_report is not None,
    )
    live_state = live_state or build_live_state_audit(case)
    release_gate = release_gate or build_release_gate_audit(case)
    source_gaps = source_gaps or build_source_gap_report(case)

    issue_codes = _issue_codes(readiness)
    items = [
        _case_selection_item(issue_codes),
        _hidden_wall_item(hidden_wall),
        _source_result_item(readiness, source_gaps),
        _source_acquisition_item(source_gaps, source_acquisition, source_acquisition_preflight),
        _live_state_item(live_state),
        _trajectory_signoff_item(issue_codes),
        _order_catalog_item(issue_codes),
        _playthrough_item(playthrough_report, readiness),
        _release_gate_item(release_gate),
        _grader_validation_item(issue_codes),
        _clinician_playthrough_item(issue_codes),
        _final_readiness_item(readiness, playthrough_report),
    ]
    blocker_count = sum(1 for item in items if item.status in {"blocked", "missing"})
    warning_count = sum(1 for item in items if item.status == "warning")
    return GoalCompletionAudit(
        case_id=case.case_id,
        complete=blocker_count == 0,
        blocker_count=blocker_count,
        warning_count=warning_count,
        items=items,
    )


def _case_selection_item(issue_codes: set[str]) -> GoalAuditItem:
    blockers = sorted(issue_codes & {"non_mimic_source", "not_abdominal_complaint", "pilot_ineligible_case"})
    return GoalAuditItem(
        id="real_abdominal_mimic_case",
        requirement="Use one pilot-eligible MIMIC-derived abdominal pain case with branching reasoning.",
        status="blocked" if blockers else "proven",
        evidence=["backend.cases.readiness source, abdominal complaint, and pilot eligibility checks."],
        issue_codes=blockers,
    )


def _hidden_wall_item(hidden_wall: HiddenWallAudit) -> GoalAuditItem:
    return GoalAuditItem(
        id="ground_truth_wall",
        requirement="Hidden diagnosis, validated ESI, disposition, and un-ordered results never enter in-loop contexts.",
        status="proven" if hidden_wall.passed else "blocked",
        evidence=[
            f"Hidden-wall audit scanned {len(hidden_wall.payload_names)} in-loop payload groups.",
            "backend.cases.hidden_wall payload dump excludes HiddenTruth fields when findings are empty.",
        ],
        issue_codes=[] if hidden_wall.passed else ["ground_truth_wall_failed"],
    )


def _source_result_item(readiness: CaseReadinessReport, source_gaps: SourceGapReport) -> GoalAuditItem:
    issue_codes = _issue_codes(readiness)
    blockers = sorted(
        issue_codes
        & {
            "missing_decisive_source_result",
            "release_blocking_source_result_gap",
            "non_source_result_bundle",
            "missing_result_source_reference",
        }
    )
    warnings = sorted(issue_codes & {"limited_source_lab_coverage"})
    status: Literal["proven", "blocked", "warning", "missing"] = "blocked" if blockers else "warning" if warnings else "proven"
    return GoalAuditItem(
        id="source_result_provenance",
        requirement="Every obtainable result comes from the source record; absent tests return explicit unavailable.",
        status=status,
        evidence=[
            f"Prepared result bundles: {', '.join(source_gaps.result_bundle_ids) or 'none'}.",
            f"Missing documented order-result signals: {', '.join(gap.signal for gap in source_gaps.missing_documented_order_results) or 'none'}.",
        ],
        issue_codes=[*blockers, *warnings],
    )


def _source_acquisition_item(
    source_gaps: SourceGapReport,
    source_acquisition: SourceAcquisitionChecklist | None,
    source_acquisition_preflight: SourceAcquisitionPreflightReport | None,
) -> GoalAuditItem:
    if not source_gaps.release_blocking_missing_results:
        return GoalAuditItem(
            id="source_acquisition_ready",
            requirement="Release-blocking source-result gaps have an acquisition path and are resolved before learner use.",
            status="proven",
            evidence=["No release-blocking source gaps remain in source_gaps.release_blocking_missing_results."],
        )
    if source_acquisition is None:
        return GoalAuditItem(
            id="source_acquisition_ready",
            requirement="Release-blocking source-result gaps have an acquisition path and are resolved before learner use.",
            status="missing",
            evidence=["No SourceAcquisitionChecklist was supplied for the unresolved release-blocking source gaps."],
            issue_codes=["source_acquisition_checklist_missing"],
        )
    if source_acquisition.source_ready:
        return GoalAuditItem(
            id="source_acquisition_ready",
            requirement="Release-blocking source-result gaps have an acquisition path and are resolved before learner use.",
            status="blocked",
            evidence=[
                f"source_acquisition.source_ready={source_acquisition.source_ready}.",
                f"task_count={source_acquisition.task_count}.",
                "Current source_gaps.release_blocking_missing_results is still non-empty; rerun preparation/source_refresh and audit the written case.",
            ],
            issue_codes=["source_acquisition_ready_but_case_still_has_gaps"],
        )
    preflight_evidence: list[str] = []
    preflight_issue_codes: list[str] = []
    if source_acquisition_preflight:
        preflight_evidence = [
            f"preflight.source_ready_after_payload={source_acquisition_preflight.source_ready_after_payload}.",
            "preflight.supplemental_result_order_ids="
            + (", ".join(source_acquisition_preflight.supplemental_result_order_ids) or "none")
            + ".",
            "preflight.matched_acquisition_order_ids="
            + (", ".join(source_acquisition_preflight.matched_acquisition_order_ids) or "none")
            + ".",
            "preflight.unresolved_release_blocking_order_ids_after="
            + (", ".join(source_acquisition_preflight.unresolved_release_blocking_order_ids_after) or "none")
            + ".",
        ]
        if source_acquisition_preflight.source_ready_after_payload:
            preflight_issue_codes.append("source_acquisition_payload_not_applied")
        else:
            preflight_issue_codes.append("source_acquisition_preflight_blocked")
    else:
        preflight_issue_codes.append("source_acquisition_preflight_missing")
    missing_modules = ", ".join(source_acquisition.missing_source_modules) or "none listed"
    unresolved = ", ".join(source_acquisition.unresolved_release_blocking_order_ids) or "none listed"
    return GoalAuditItem(
        id="source_acquisition_ready",
        requirement="Release-blocking source-result gaps have an acquisition path and are resolved before learner use.",
        status="blocked",
        evidence=[
            f"source_acquisition.source_ready={source_acquisition.source_ready}.",
            f"task_count={source_acquisition.task_count}.",
            f"Missing source modules: {missing_modules}.",
            f"Unresolved order ids: {unresolved}.",
            *preflight_evidence,
        ],
        issue_codes=[
            "source_acquisition_tasks_unresolved",
            *source_acquisition.missing_source_modules,
            *preflight_issue_codes,
        ],
    )


def _live_state_item(live_state: LiveStateAudit) -> GoalAuditItem:
    return GoalAuditItem(
        id="deterministic_live_state",
        requirement="Vitals, clock, order status, and patient stability are controlled by deterministic code-held state.",
        status="proven" if live_state.passed else "blocked",
        evidence=[
            f"Deterministic scenarios passed: {live_state.all_scenarios_deterministic}.",
            f"Persona state guard passed: {live_state.persona_guard_passed}.",
        ],
        issue_codes=[] if live_state.passed else ["live_state_audit_failed"],
    )


def _trajectory_signoff_item(issue_codes: set[str]) -> GoalAuditItem:
    blockers = sorted(issue_codes & {"trajectory_not_clinician_signed", "trajectory_review_missing"})
    return GoalAuditItem(
        id="clinician_trajectory_signoff",
        requirement="A clinician signs off deterministic trajectory rules as conservative and defensible.",
        status="blocked" if blockers else "proven",
        evidence=["backend.cases.review stores trajectory_review only after all trajectory confirmations are true."],
        issue_codes=blockers,
    )


def _order_catalog_item(issue_codes: set[str]) -> GoalAuditItem:
    blockers = sorted(issue_codes & {"missing_catalog_orders"})
    return GoalAuditItem(
        id="fixed_structured_order_catalog",
        requirement="Student orders use a broad fixed searchable catalog, not a per-case shortlist.",
        status="blocked" if blockers else "proven",
        evidence=["backend.cases.readiness checks abdominal branch catalog coverage."],
        issue_codes=blockers,
    )


def _playthrough_item(playthrough_report: PlaythroughReport | None, readiness: CaseReadinessReport) -> GoalAuditItem:
    if playthrough_report is None:
        return GoalAuditItem(
            id="objective_playthrough",
            requirement="A start-to-debrief run exercises questions, exams, consult, orders/results, vitals response, ESI revision, differential, SOAP, completion, no leakage, and no fabricated results.",
            status="missing",
            evidence=["No PlaythroughReport was supplied to the goal audit."],
            issue_codes=["objective_playthrough_missing"],
        )
    missing = [
        name
        for name, value in playthrough_report.success_checklist.model_dump(mode="json").items()
        if not value
    ]
    return GoalAuditItem(
        id="objective_playthrough",
        requirement="A start-to-debrief run exercises questions, exams, consult, orders/results, vitals response, ESI revision, differential, SOAP, completion, no leakage, and no fabricated results.",
        status="proven" if playthrough_report.objective_ready else "blocked",
        evidence=[
            f"objective_ready={playthrough_report.objective_ready}.",
            f"elapsed_minutes={playthrough_report.elapsed_minutes}.",
            f"unavailable_orders={', '.join(playthrough_report.unavailable_orders) or 'none'}.",
        ],
        issue_codes=missing,
    )


def _release_gate_item(release_gate: ReleaseGateAudit) -> GoalAuditItem:
    issue_codes = []
    if not release_gate.passed:
        issue_codes.append("release_gate_audit_failed")
    if not release_gate.runtime_override_safe_for_learner:
        issue_codes.append("unvalidated_grader_override_active")
    return GoalAuditItem(
        id="post_completion_release_gate",
        requirement="Grader-only truth joins the student record only after encounter completion and validated feedback release.",
        status="proven" if release_gate.passed else "blocked",
        evidence=[
            f"Release-gate endpoint checks passed: {release_gate.passed}.",
            f"Runtime unvalidated-grader override active: {release_gate.runtime_unvalidated_grader_override_active}.",
            f"Runtime override safe for learner: {release_gate.runtime_override_safe_for_learner}.",
            f"Package assembly before validation attempted: {release_gate.package_assembly_attempted_before_validation}.",
            f"Token usage before validation recorded: {release_gate.token_usage_recorded_before_validation}.",
        ],
        issue_codes=issue_codes,
    )


def _grader_validation_item(issue_codes: set[str]) -> GoalAuditItem:
    blockers = sorted(issue_codes & {"grader_not_validated", "grader_validation_review_missing", "rubric_ground_truth_mismatch"})
    return GoalAuditItem(
        id="validated_grader_feedback",
        requirement="The separate grader is validated against held-out ground truth and clinician answer key before feedback is shown.",
        status="blocked" if blockers else "proven",
        evidence=["backend.cases.review accepts grader_validation only when validation cases are held out from the release case and the report meets threshold, answer-key coverage, clinician scoring, and grounding checks."],
        issue_codes=blockers,
    )


def _clinician_playthrough_item(issue_codes: set[str]) -> GoalAuditItem:
    blockers = sorted(issue_codes & {"playthrough_not_clinician_signed", "playthrough_review_missing"})
    return GoalAuditItem(
        id="clinician_playthrough_signoff",
        requirement="A clinician completes the case to debrief and confirms realism, feedback quality, no fabrication, and no hidden leakage.",
        status="blocked" if blockers else "proven",
        evidence=["backend.cases.review accepts playthrough signoff only with objective_ready report and explicit clinician confirmations."],
        issue_codes=blockers,
    )


def _final_readiness_item(readiness: CaseReadinessReport, playthrough_report: PlaythroughReport | None) -> GoalAuditItem:
    ready = readiness.ready_for_learner_pilot and bool(playthrough_report and playthrough_report.objective_ready)
    return GoalAuditItem(
        id="goal_completion",
        requirement="All objective requirements are proven for this one case.",
        status="proven" if ready else "blocked",
        evidence=[
            f"readiness.ready_for_learner_pilot={readiness.ready_for_learner_pilot}.",
            f"objective_playthrough_ready={bool(playthrough_report and playthrough_report.objective_ready)}.",
        ],
        issue_codes=[issue.code for issue in readiness.issues if issue.severity == "blocker"],
    )


def _issue_codes(readiness: CaseReadinessReport) -> set[str]:
    return {issue.code for issue in readiness.issues}


def _main() -> int:
    parser = argparse.ArgumentParser(description="Build a hidden-safe requirement-level audit for the abdominal case goal.")
    parser.add_argument("case", type=Path, help="PreparedCase JSON.")
    parser.add_argument("--playthrough-script", type=Path, help="Optional hidden-safe objective playthrough script.")
    parser.add_argument("--source-acquisition-report", type=Path, help="Optional source-acquisition checklist JSON.")
    parser.add_argument("--source-acquisition-preflight-report", type=Path, help="Optional source-acquisition preflight JSON.")
    parser.add_argument("--output", type=Path, help="Optional audit JSON output path.")
    args = parser.parse_args()

    case = PreparedCase.model_validate_json(args.case.read_text(encoding="utf-8"))
    playthrough_report = None
    if args.playthrough_script:
        playthrough_report, _hidden_package = run_scripted_playthrough(case, load_playthrough_actions(args.playthrough_script))
    source_acquisition = (
        SourceAcquisitionChecklist.model_validate_json(args.source_acquisition_report.read_text(encoding="utf-8"))
        if args.source_acquisition_report
        else None
    )
    source_acquisition_preflight = (
        SourceAcquisitionPreflightReport.model_validate_json(args.source_acquisition_preflight_report.read_text(encoding="utf-8"))
        if args.source_acquisition_preflight_report
        else None
    )
    audit = build_goal_completion_audit(
        case,
        playthrough_report=playthrough_report,
        source_acquisition=source_acquisition,
        source_acquisition_preflight=source_acquisition_preflight,
    )
    rendered = audit.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0 if audit.complete else 1


if __name__ == "__main__":
    raise SystemExit(_main())
