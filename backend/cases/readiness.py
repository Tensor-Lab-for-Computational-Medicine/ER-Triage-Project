from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.cases.playthrough import PlaythroughReport, load_playthrough_actions, run_scripted_playthrough
from backend.cases.prepare import CasePreparationError, assert_pilot_eligible
from backend.cases.schemas import PreparedCase
from backend.cases.source_gaps import build_source_gap_report
from backend.orders.catalog import get_order
from backend.state.context import consult_context, exam_context, nurse_context, patient_context, results_context
from backend.state.engine import start_case


ABDOMINAL_COMPLAINT_TERMS = (
    "abd",
    "abdominal",
    "abdomen",
    "belly",
    "epigastric",
    "ruq",
    "right upper quadrant",
    "flank",
)
ABDOMINAL_BRANCH_ORDER_IDS = (
    "cbc",
    "bmp",
    "cmp",
    "lft",
    "lipase",
    "troponin",
    "ecg_12_lead",
    "ct_abdomen_pelvis_with_contrast",
    "ultrasound_ruq",
)
DECISIVE_SOURCE_RESULT_IDS = (
    "ct_abdomen_pelvis_with_contrast",
    "ultrasound_ruq",
    "ecg_12_lead",
)


class CaseReadinessIssue(BaseModel):
    code: str
    severity: Literal["blocker", "warning"]
    message: str


class CaseReadinessReport(BaseModel):
    case_id: str
    ready_for_learner_pilot: bool
    issues: list[CaseReadinessIssue] = Field(default_factory=list)
    objective_playthrough_ready: bool | None = None


def validate_abdominal_case_readiness(
    case: PreparedCase,
    *,
    playthrough_report: PlaythroughReport | None = None,
    require_playthrough: bool = False,
    playthrough_error: str | None = None,
) -> CaseReadinessReport:
    issues: list[CaseReadinessIssue] = []
    _check_source(case, issues)
    _check_abdominal_complaint(case, issues)
    _check_pilot_eligibility(case, issues)
    _check_order_catalog(issues)
    _check_result_coverage(case, issues)
    _check_release_blocking_source_gaps(case, issues)
    _check_rubric_ground_truth_alignment(case, issues)
    _check_hidden_wall(case, issues)
    _check_clinician_validation(case, issues)
    objective_playthrough_ready = _check_objective_playthrough(
        playthrough_report,
        require_playthrough=require_playthrough,
        playthrough_error=playthrough_error,
        issues=issues,
    )
    return CaseReadinessReport(
        case_id=case.case_id,
        ready_for_learner_pilot=not any(issue.severity == "blocker" for issue in issues),
        issues=issues,
        objective_playthrough_ready=objective_playthrough_ready,
    )


def assert_abdominal_case_ready(case: PreparedCase) -> None:
    report = validate_abdominal_case_readiness(case)
    if not report.ready_for_learner_pilot:
        blockers = "; ".join(issue.message for issue in report.issues if issue.severity == "blocker")
        raise CasePreparationError(blockers or "case is not ready for learner pilot")


def _check_source(case: PreparedCase, issues: list[CaseReadinessIssue]) -> None:
    if "mimic" not in case.source.lower():
        issues.append(
            CaseReadinessIssue(
                code="non_mimic_source",
                severity="blocker",
                message="Learner pilot abdominal case must be prepared from a local MIMIC-IV-Ext-CDS source record.",
            )
        )


def _check_abdominal_complaint(case: PreparedCase, issues: list[CaseReadinessIssue]) -> None:
    text = f"{case.title} {case.visible_start.chief_complaint}".lower()
    if not any(term in text for term in ABDOMINAL_COMPLAINT_TERMS):
        issues.append(
            CaseReadinessIssue(
                code="not_abdominal_complaint",
                severity="blocker",
                message="Case chief complaint/title does not look like an abdominal pain presentation.",
            )
        )


def _check_pilot_eligibility(case: PreparedCase, issues: list[CaseReadinessIssue]) -> None:
    try:
        assert_pilot_eligible(case)
    except CasePreparationError as exc:
        issues.append(
            CaseReadinessIssue(
                code="pilot_ineligible_case",
                severity="blocker",
                message=str(exc),
            )
        )


def _check_order_catalog(issues: list[CaseReadinessIssue]) -> None:
    missing = [order_id for order_id in ABDOMINAL_BRANCH_ORDER_IDS if get_order(order_id) is None]
    if missing:
        issues.append(
            CaseReadinessIssue(
                code="missing_catalog_orders",
                severity="blocker",
                message=f"Order catalog is missing abdominal branch orders: {', '.join(missing)}.",
            )
        )


def _check_result_coverage(case: PreparedCase, issues: list[CaseReadinessIssue]) -> None:
    present = set(case.result_bundles)
    missing_common = [order_id for order_id in ("cbc", "bmp", "lft", "lipase", "troponin") if order_id not in present]
    if missing_common:
        issues.append(
            CaseReadinessIssue(
                code="limited_source_lab_coverage",
                severity="warning",
                message=(
                    "These common branch labs are not source-recorded and will return unavailable if ordered: "
                    + ", ".join(missing_common)
                    + "."
                ),
            )
        )

    if not any(order_id in present for order_id in DECISIVE_SOURCE_RESULT_IDS):
        missing_order_evidence = case.source_evidence_audit.documented_orders_without_results
        suffix = ""
        if missing_order_evidence:
            suffix = (
                " Source order evidence exists without linked report/result text for: "
                + ", ".join(missing_order_evidence)
                + "."
            )
        issues.append(
            CaseReadinessIssue(
                code="missing_decisive_source_result",
                severity="blocker",
                message=(
                    "No source-recorded decisive ECG/imaging result is present for the abdominal branch; "
                    "do not make this a learner case until the linked report/result is available."
                    + suffix
                ),
            )
        )

    non_mimic = [
        order_id
        for order_id, bundle in case.result_bundles.items()
        if "mimic" not in str(bundle.source or "").lower()
    ]
    if non_mimic:
        issues.append(
            CaseReadinessIssue(
                code="non_source_result_bundle",
                severity="blocker",
                message=f"Result bundles must trace to MIMIC source rows, but these do not: {', '.join(non_mimic)}.",
            )
        )

    missing_provenance = [
        order_id
        for order_id, bundle in case.result_bundles.items()
        if "mimic" in str(bundle.source or "").lower() and not bundle.source_reference
    ]
    if missing_provenance:
        issues.append(
            CaseReadinessIssue(
                code="missing_result_source_reference",
                severity="blocker",
                message=(
                    "MIMIC result bundles must include source_reference metadata with case/source row provenance: "
                    + ", ".join(missing_provenance)
                    + "."
                ),
            )
        )


def _check_release_blocking_source_gaps(case: PreparedCase, issues: list[CaseReadinessIssue]) -> None:
    source_gaps = build_source_gap_report(case)
    blockers = source_gaps.release_blocking_missing_results
    if not blockers:
        return
    signals = sorted({str(item.get("signal") or "") for item in blockers if item.get("signal")})
    order_ids = sorted(
        {
            str(order_id)
            for item in blockers
            for order_id in item.get("candidate_order_ids", [])
            if order_id
        }
    )
    suffix = f" Signals: {', '.join(signals)}." if signals else ""
    if order_ids:
        suffix += f" Candidate orders: {', '.join(order_ids)}."
    issues.append(
        CaseReadinessIssue(
            code="release_blocking_source_result_gap",
            severity="blocker",
            message=(
                "Documented release-blocking source order evidence still lacks an encounter-linked result; "
                "do not release the learner case until source_gaps.release_blocking_missing_results is empty."
                + suffix
            ),
        )
    )


def _check_rubric_ground_truth_alignment(case: PreparedCase, issues: list[CaseReadinessIssue]) -> None:
    expected = [diagnosis for diagnosis in case.rubric.expected_diagnoses if str(diagnosis or "").strip()]
    if not expected:
        return
    truth = case.hidden_truth.final_diagnosis
    if any(_diagnosis_terms_match(diagnosis, truth) for diagnosis in expected):
        return
    issues.append(
        CaseReadinessIssue(
            code="rubric_ground_truth_mismatch",
            severity="blocker",
            message=(
                "Rubric expected diagnoses do not include the hidden ground-truth diagnosis. "
                "Fix the offline case rubric before validating or releasing grader feedback."
            ),
        )
    )


def _check_hidden_wall(case: PreparedCase, issues: list[CaseReadinessIssue]) -> None:
    try:
        engine = start_case(case, session_id="readiness-hidden-wall")
    except Exception as exc:
        issues.append(
            CaseReadinessIssue(
                code="state_engine_start_failed",
                severity="blocker",
                message=f"State engine could not start this case: {exc}",
            )
        )
        return

    contexts: dict[str, Any] = {
        "patient": patient_context(case, engine.state, "Why are you here?"),
        "exam": exam_context(case, engine.state, "Examine the abdomen."),
        "nurse": nurse_context(case, engine.state),
        "consultant": consult_context(case, engine.state, "surgery"),
        "results": results_context(case, engine.state, "ct_abdomen_pelvis_with_contrast"),
    }
    leaked = _hidden_terms_in_payload(case, contexts)
    if leaked:
        issues.append(
            CaseReadinessIssue(
                code="ground_truth_wall_leakage",
                severity="blocker",
                message=f"In-loop context contains hidden truth terms: {', '.join(leaked)}.",
            )
        )


def _check_clinician_validation(case: PreparedCase, issues: list[CaseReadinessIssue]) -> None:
    if not case.review_status.trajectory_clinician_signed_off:
        issues.append(
            CaseReadinessIssue(
                code="trajectory_not_clinician_signed",
                severity="blocker",
                message="Deterministic trajectory requires clinician signoff before learner use.",
            )
        )
    elif not case.review_status.trajectory_review:
        issues.append(
            CaseReadinessIssue(
                code="trajectory_review_missing",
                severity="blocker",
                message="Trajectory signoff flag is set, but the clinician trajectory review artifact is missing.",
            )
        )
    if not case.review_status.grader_clinician_validated:
        issues.append(
            CaseReadinessIssue(
                code="grader_not_validated",
                severity="blocker",
                message="Grader must pass held-out validation against a clinician answer key before learner feedback is shown.",
            )
        )
    elif not case.review_status.grader_validation_review:
        issues.append(
            CaseReadinessIssue(
                code="grader_validation_review_missing",
                severity="blocker",
                message="Grader validation flag is set, but the validation review artifact is missing.",
            )
        )
    if not case.review_status.playthrough_clinician_signed_off:
        issues.append(
            CaseReadinessIssue(
                code="playthrough_not_clinician_signed",
                severity="blocker",
                message="A clinician must complete and sign off the objective playthrough before learner use.",
            )
        )
    elif not case.review_status.playthrough_review:
        issues.append(
            CaseReadinessIssue(
                code="playthrough_review_missing",
                severity="blocker",
                message="Playthrough signoff flag is set, but the clinician playthrough review artifact is missing.",
            )
        )


def _check_objective_playthrough(
    playthrough_report: PlaythroughReport | None,
    *,
    require_playthrough: bool,
    playthrough_error: str | None,
    issues: list[CaseReadinessIssue],
) -> bool | None:
    if playthrough_error:
        issues.append(
            CaseReadinessIssue(
                code="objective_playthrough_error",
                severity="blocker",
                message=f"Objective playthrough proof could not run: {playthrough_error}.",
            )
        )
        return False
    if playthrough_report is None:
        if require_playthrough:
            issues.append(
                CaseReadinessIssue(
                    code="objective_playthrough_missing",
                    severity="blocker",
                    message=(
                        "Objective clinician-style playthrough proof is required before learner release. "
                        "Pass --playthrough-script with a hidden-safe script that reaches objective_ready=true."
                    ),
                )
            )
            return False
        return None
    if playthrough_report.objective_ready:
        return True

    missing = [
        name
        for name, value in playthrough_report.success_checklist.model_dump(mode="json").items()
        if not value
    ]
    suffix = f" Incomplete checklist items: {', '.join(missing)}." if missing else ""
    issues.append(
        CaseReadinessIssue(
            code="objective_playthrough_incomplete",
            severity="blocker",
            message=(
                "Objective clinician-style playthrough did not prove the full triage-to-debrief run."
                + suffix
            ),
        )
    )
    return False


def _hidden_terms_in_payload(case: PreparedCase, payload: Any) -> list[str]:
    text = json.dumps(payload, default=str).lower()
    terms = {
        "hidden_truth": "hidden_truth",
        "validated_esi": "validated_esi",
        "actual_disposition": case.hidden_truth.actual_disposition,
        "final_diagnosis": case.hidden_truth.final_diagnosis,
    }
    leaked = []
    for label, value in terms.items():
        normalized = " ".join(str(value or "").lower().split())
        if normalized and normalized in text:
            leaked.append(label)
    return leaked


def _diagnosis_terms_match(left: str, right: str) -> bool:
    normalized_left = _normalize_diagnosis(left)
    normalized_right = _normalize_diagnosis(right)
    if not normalized_left or not normalized_right:
        return False
    return (
        normalized_left == normalized_right
        or normalized_left in normalized_right
        or normalized_right in normalized_left
    )


def _normalize_diagnosis(value: str) -> str:
    return " ".join(str(value or "").lower().replace("-", " ").split())


def _main() -> int:
    parser = argparse.ArgumentParser(description="Run the abdominal case learner-readiness gate.")
    parser.add_argument("case", type=Path, help="PreparedCase JSON.")
    parser.add_argument("--playthrough-script", type=Path, help="Optional hidden-safe objective playthrough script.")
    parser.add_argument("--require-playthrough", action="store_true", help="Block readiness unless the playthrough proof is objective_ready=true.")
    parser.add_argument("--output", type=Path, help="Optional JSON report path.")
    args = parser.parse_args()

    case = PreparedCase.model_validate_json(args.case.read_text(encoding="utf-8"))
    playthrough_report = None
    playthrough_error = None
    if args.playthrough_script:
        try:
            playthrough_report, _hidden_package = run_scripted_playthrough(case, load_playthrough_actions(args.playthrough_script))
        except Exception as exc:  # pragma: no cover - exact parser/runtime errors vary by script
            playthrough_error = f"{type(exc).__name__}: {exc}"
    report = validate_abdominal_case_readiness(
        case,
        playthrough_report=playthrough_report,
        require_playthrough=args.require_playthrough or bool(args.playthrough_script),
        playthrough_error=playthrough_error,
    )
    rendered = report.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0 if report.ready_for_learner_pilot else 1


if __name__ == "__main__":
    raise SystemExit(_main())
