from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.cases.playthrough import load_playthrough_actions, run_scripted_playthrough
from backend.cases.playthrough_review import PlaythroughReviewPacket, build_playthrough_review_packet
from backend.cases.schemas import PreparedCase, VisibleStart
from backend.cases.source_acquisition import SourceAcquisitionChecklist, assert_source_acquisition_matches_case
from backend.cases.source_acquisition_preflight import (
    SourceAcquisitionPreflightReport,
    assert_source_acquisition_preflight_matches_case,
)
from backend.cases.source_gaps import SourceGapReport, build_source_gap_report
from backend.cases.source_probe import SourceProbeReport
from backend.cases.trajectory_review import TrajectoryReviewPacket, build_trajectory_review_packet
from backend.grader.validation_prep import ValidationPrepPacket, build_validation_prep_packet


class ClinicianReviewDossier(BaseModel):
    case_id: str
    visible_start: VisibleStart
    source_identifiers: dict[str, Any] = Field(default_factory=dict)
    source_gaps: SourceGapReport
    source_probe_unresolved: list[dict[str, Any]] = Field(default_factory=list)
    source_acquisition: SourceAcquisitionChecklist | None = None
    source_acquisition_preflight: SourceAcquisitionPreflightReport | None = None
    trajectory_review: TrajectoryReviewPacket
    playthrough_review: PlaythroughReviewPacket | None = None
    validation_prep: ValidationPrepPacket | None = None
    case_review_artifact_template: dict[str, Any]
    required_completion_steps: list[str] = Field(default_factory=list)
    commands: list[str] = Field(default_factory=list)
    grader_only_truth_excluded: Literal[True] = True


def build_clinician_review_dossier(
    case: PreparedCase,
    *,
    playthrough_script_path: Path | None = None,
    package_paths: list[Path] | None = None,
    source_probe: SourceProbeReport | None = None,
    source_acquisition: SourceAcquisitionChecklist | None = None,
    source_acquisition_preflight: SourceAcquisitionPreflightReport | None = None,
    threshold: float = 0.8,
) -> ClinicianReviewDossier:
    assert_source_acquisition_matches_case(case, source_acquisition)
    assert_source_acquisition_preflight_matches_case(
        case.case_id,
        source_acquisition_preflight,
        checklist=source_acquisition,
    )
    package_paths = package_paths or []
    source_gaps = build_source_gap_report(case)
    trajectory_review = build_trajectory_review_packet(case)
    playthrough_review = None
    if playthrough_script_path:
        playthrough_report, _package = run_scripted_playthrough(case, load_playthrough_actions(playthrough_script_path))
        playthrough_review = build_playthrough_review_packet(case, playthrough_report)
    validation_prep = (
        build_validation_prep_packet(package_paths, threshold=threshold, release_case_id=case.case_id)
        if package_paths
        else None
    )
    return ClinicianReviewDossier(
        case_id=case.case_id,
        visible_start=case.visible_start,
        source_identifiers=dict(case.source_evidence_audit.source_identifiers),
        source_gaps=source_gaps,
        source_probe_unresolved=list(source_probe.unresolved_release_blocking_results) if source_probe else [],
        source_acquisition=source_acquisition,
        source_acquisition_preflight=source_acquisition_preflight,
        trajectory_review=trajectory_review,
        playthrough_review=playthrough_review,
        validation_prep=validation_prep,
        case_review_artifact_template=_case_review_artifact_template(
            case,
            trajectory_review=trajectory_review,
            playthrough_review=playthrough_review,
            validation_prep=validation_prep,
            threshold=threshold,
        ),
        required_completion_steps=_required_completion_steps(
            source_gaps,
            playthrough_review,
            validation_prep,
            source_probe,
            source_acquisition,
            source_acquisition_preflight,
        ),
        commands=_commands(case.case_id, bool(package_paths)),
    )


def _case_review_artifact_template(
    case: PreparedCase,
    *,
    trajectory_review: TrajectoryReviewPacket,
    playthrough_review: PlaythroughReviewPacket | None,
    validation_prep: ValidationPrepPacket | None,
    threshold: float,
) -> dict[str, Any]:
    return {
        "case_id": case.case_id,
        "trajectory": trajectory_review.review_artifact_template["trajectory"],
        "grader_validation": {
            "reviewer_name": "replace-with-clinician-name",
            "reviewed_at": "replace-with-review-time",
            "threshold": validation_prep.threshold if validation_prep else threshold,
            "validation_report": {
                "cases": [],
                "diagnostic_agreement": 0,
                "esi_agreement": 0,
                "disposition_documentation_rate": 0,
                "critical_action_agreement": 0,
                "feedback_grounding_rate": 0,
                "clinician_answer_key_coverage": 0,
                "clinician_diagnostic_agreement": None,
                "clinician_esi_agreement": None,
                "clinician_disposition_agreement": None,
                "clinician_critical_action_agreement": None,
                "release_blocked": True,
                "failure_modes": ["replace with backend.grader.validate output after clinician answer-key review"],
            },
            "clinician_answer_key_reviewed": False,
            "feedback_release_approved": False,
            "notes": [
                "Paste the backend.grader.validate output only after the clinician answer key and evidence file are complete.",
                "Validation cases must be held out from this release case_id.",
            ],
        },
        "playthrough": (
            playthrough_review.review_artifact_template["playthrough"]
            if playthrough_review
            else {
                "reviewer_name": "replace-with-clinician-name",
                "reviewed_at": "replace-with-review-time",
                "playthrough_report": None,
                "clinician_played_case_start_to_debrief": False,
                "case_felt_realistic": False,
                "vitals_and_state_behaved_correctly": False,
                "feedback_clinically_sound": False,
                "feedback_identified_strengths_and_misses": False,
                "no_fabricated_values_confirmed": False,
                "no_hidden_leakage_confirmed": False,
                "notes": [
                    "Paste the hidden-safe playthrough report after a clinician completes the case and confirms debrief quality."
                ],
            }
        ),
        "notes": [
            "Keep completed review artifacts in ignored local storage unless explicitly de-identified and approved.",
            "This template is intentionally fail-closed until all clinician fields are completed.",
        ],
    }


def _required_completion_steps(
    source_gaps: SourceGapReport,
    playthrough_review: PlaythroughReviewPacket | None,
    validation_prep: ValidationPrepPacket | None,
    source_probe: SourceProbeReport | None,
    source_acquisition: SourceAcquisitionChecklist | None,
    source_acquisition_preflight: SourceAcquisitionPreflightReport | None,
) -> list[str]:
    steps: list[str] = []
    if source_gaps.release_blocking_missing_results:
        steps.append("Resolve release-blocking source_gaps by attaching one encounter-linked CT/US/ECG result from local source rows.")
    if source_probe and source_probe.unresolved_release_blocking_results:
        if any(item.get("localized_operator_queries") for item in source_probe.unresolved_release_blocking_results):
            steps.append("Use source_probe_unresolved.localized_operator_queries to locate the missing source row before filling supplemental results.")
        else:
            steps.append("Use source_probe_unresolved.operator_queries to locate the missing source row before filling supplemental results.")
    if source_acquisition and not source_acquisition.source_ready:
        steps.append(
            "Resolve source_acquisition.tasks and rerun source_refresh until source_ready=true. Missing modules: "
            + (", ".join(source_acquisition.missing_source_modules) or "see source_acquisition.tasks")
            + "."
        )
    if source_acquisition_preflight and not source_acquisition_preflight.source_ready_after_payload:
        steps.append(
            "Current supplemental-results preflight does not clear release blockers; remaining order ids: "
            + (
                ", ".join(source_acquisition_preflight.unresolved_release_blocking_order_ids_after)
                or "see source_acquisition_preflight"
            )
            + "."
        )
    elif source_acquisition_preflight and source_acquisition_preflight.source_ready_after_payload:
        if source_gaps.release_blocking_missing_results:
            steps.append(
                "Supplemental-results preflight clears blockers in memory; rerun guarded case preparation/source_refresh and use the written case for final review."
            )
    steps.append("Clinician reviews trajectory_review and fills all trajectory booleans true only after source/state review.")
    if validation_prep:
        steps.append("Clinician fills validation_prep.clinician_answer_key_template and reviews evidence before running backend.grader.validate.")
    else:
        steps.append("Generate held-out validation packages, then build validation_prep before grader signoff.")
    if playthrough_review:
        steps.append("Clinician completes the objective playthrough to debrief and fills playthrough review booleans only after feedback review.")
    else:
        steps.append("Run an objective playthrough script, then build a playthrough review packet before playthrough signoff.")
    steps.append("Apply the completed case_review_artifact_template with backend.cases.review, then rerun finalization/readiness.")
    return steps


def _commands(case_id: str, has_packages: bool) -> list[str]:
    commands = [
        f"python -m backend.cases.source_probe data/cases/{case_id}.json --skip-lab-probe --output data/restricted/{case_id}.source-probe.local.json",
        f"python -m backend.cases.source_acquisition data/restricted/{case_id}.source-refresh.local.json --output data/restricted/{case_id}.source-acquisition.local.json",
        f"python -m backend.cases.source_acquisition_preflight data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json --case-id {case_id} --source-acquisition-report data/restricted/{case_id}.source-acquisition.local.json --supplemental-results data/restricted/{case_id}.results.local.json --output data/restricted/{case_id}.source-acquisition-preflight.local.json",
        f"python -m backend.cases.trajectory_review data/cases/{case_id}.json --output data/restricted/{case_id}.trajectory-review.local.json --review-template-output data/restricted/{case_id}.trajectory-review.local.template.json",
        f"python -m backend.cases.playthrough_review data/cases/{case_id}.json --script data/restricted/{case_id}.playthrough.local.json --output data/restricted/{case_id}.playthrough-review.local.json --review-template-output data/restricted/{case_id}.playthrough-review.local.template.json",
    ]
    if has_packages:
        commands.append(
            f"python -m backend.grader.validate data/restricted/heldout-validation-packages/*.package.json --answer-key data/restricted/heldout-validation-packages/clinician-answer-key.completed.json --evidence data/restricted/heldout-validation-packages/evidence.completed.json --output data/restricted/{case_id}.grader-validation.local.json"
        )
    else:
        commands.append(
            f"python -m backend.grader.heldout_packages data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json --release-case-id {case_id} --max-cases 3 --output-dir data/restricted/heldout-validation-packages --manifest-output data/restricted/heldout-validation-packages.manifest.local.json"
        )
    commands.append(
        f"python -m backend.cases.review data/cases/{case_id}.json --review data/restricted/{case_id}.review.local.json --output data/cases/{case_id}.reviewed.local.json"
    )
    return commands


def _main() -> int:
    parser = argparse.ArgumentParser(description="Build a hidden-safe clinician review dossier for release signoff.")
    parser.add_argument("case", type=Path, help="PreparedCase JSON.")
    parser.add_argument("--playthrough-script", type=Path, help="Hidden-safe objective playthrough script.")
    parser.add_argument("--package", dest="packages", action="append", type=Path, default=[], help="Held-out CasePackage JSON. May be repeated.")
    parser.add_argument("--source-probe-report", type=Path, help="Optional source-probe report JSON.")
    parser.add_argument("--source-acquisition-report", type=Path, help="Optional source-acquisition checklist JSON.")
    parser.add_argument("--source-acquisition-preflight-report", type=Path, help="Optional source-acquisition preflight JSON.")
    parser.add_argument("--threshold", type=float, default=0.8, help="Validation agreement threshold for the grader review template.")
    parser.add_argument("--output", type=Path, help="Optional dossier JSON path.")
    parser.add_argument("--review-template-output", type=Path, help="Optional combined case review artifact template path.")
    args = parser.parse_args()

    case = PreparedCase.model_validate_json(args.case.read_text(encoding="utf-8"))
    source_probe = (
        SourceProbeReport.model_validate_json(args.source_probe_report.read_text(encoding="utf-8"))
        if args.source_probe_report
        else None
    )
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
    dossier = build_clinician_review_dossier(
        case,
        playthrough_script_path=args.playthrough_script,
        package_paths=[path.expanduser().resolve() for path in args.packages],
        source_probe=source_probe,
        source_acquisition=source_acquisition,
        source_acquisition_preflight=source_acquisition_preflight,
        threshold=args.threshold,
    )
    rendered = dossier.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    if args.review_template_output:
        args.review_template_output.parent.mkdir(parents=True, exist_ok=True)
        args.review_template_output.write_text(
            json.dumps(dossier.case_review_artifact_template, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
