from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.cases.case_pool_audit import CasePoolAudit
from backend.cases.playthrough import PlaythroughReport, load_playthrough_actions, run_scripted_playthrough
from backend.cases.playthrough_review import PlaythroughReviewPacket, build_playthrough_review_packet
from backend.cases.readiness import CaseReadinessReport, validate_abdominal_case_readiness
from backend.cases.release_gate_audit import ReleaseGateAudit, build_release_gate_audit
from backend.cases.schemas import PreparedCase
from backend.cases.goal_audit import GoalCompletionAudit, build_goal_completion_audit
from backend.cases.hidden_wall import HiddenWallAudit, build_hidden_wall_audit, build_hidden_wall_payload
from backend.cases.live_state_audit import LiveStateAudit, build_live_state_audit
from backend.cases.source_acquisition import SourceAcquisitionChecklist, assert_source_acquisition_matches_case
from backend.cases.source_acquisition_preflight import (
    SourceAcquisitionPreflightReport,
    assert_source_acquisition_preflight_matches_case,
)
from backend.cases.source_gaps import SourceGapReport, build_source_gap_report
from backend.cases.source_probe import SourceProbeReport
from backend.cases.trajectory_review import TrajectoryReviewPacket, build_trajectory_review_packet
from backend.grader.validation_prep import ValidationPrepPacket, build_validation_prep_packet


class ReadinessCommand(BaseModel):
    label: str
    command: str
    writes: list[str] = Field(default_factory=list)


def _cmd_arg(value: str | Path) -> str:
    text = str(value)
    if not text or any(char.isspace() for char in text):
        return '"' + text.replace('"', '\\"') + '"'
    return text


class PlaythroughProof(BaseModel):
    provided: bool = False
    script_path: str | None = None
    objective_ready: bool = False
    report: PlaythroughReport | None = None
    blocking_findings: list[str] = Field(default_factory=list)
    error: str | None = None
    grader_only_truth_excluded: Literal[True] = True


class PilotReadinessBundle(BaseModel):
    case_id: str
    ready_for_learner_pilot: bool
    readiness: CaseReadinessReport
    hidden_wall: HiddenWallAudit
    hidden_wall_payload: dict[str, Any] = Field(default_factory=dict)
    live_state: LiveStateAudit
    release_gate: ReleaseGateAudit
    source_gaps: SourceGapReport
    source_probe: SourceProbeReport | None = None
    source_acquisition: SourceAcquisitionChecklist | None = None
    source_acquisition_preflight: SourceAcquisitionPreflightReport | None = None
    case_pool_audit: CasePoolAudit | None = None
    trajectory_review: TrajectoryReviewPacket
    playthrough_proof: PlaythroughProof = Field(default_factory=PlaythroughProof)
    playthrough_review: PlaythroughReviewPacket | None = None
    goal_audit: GoalCompletionAudit
    validation_prep: ValidationPrepPacket | None = None
    commands: list[ReadinessCommand] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    grader_only_truth_excluded: Literal[True] = True


def build_pilot_readiness_bundle(
    case: PreparedCase,
    case_path: Path,
    package_paths: list[Path] | None = None,
    artifact_dir: Path | None = None,
    playthrough_script_path: Path | None = None,
    source_probe: SourceProbeReport | None = None,
    source_acquisition: SourceAcquisitionChecklist | None = None,
    source_acquisition_preflight: SourceAcquisitionPreflightReport | None = None,
    case_pool_audit: CasePoolAudit | None = None,
) -> PilotReadinessBundle:
    assert_source_acquisition_matches_case(case, source_acquisition)
    assert_source_acquisition_preflight_matches_case(
        case.case_id,
        source_acquisition_preflight,
        checklist=source_acquisition,
    )
    package_paths = package_paths or []
    playthrough_proof = build_playthrough_proof(case, playthrough_script_path)
    readiness = validate_abdominal_case_readiness(
        case,
        playthrough_report=playthrough_proof.report,
        require_playthrough=playthrough_script_path is not None,
        playthrough_error=playthrough_proof.error,
    )
    hidden_wall_payload = build_hidden_wall_payload(case)
    hidden_wall = build_hidden_wall_audit(case, hidden_wall_payload)
    live_state = build_live_state_audit(case)
    release_gate = build_release_gate_audit(case)
    source_gaps = build_source_gap_report(case)
    trajectory_review = build_trajectory_review_packet(case)
    playthrough_review = build_playthrough_review_packet(case, playthrough_proof.report) if playthrough_proof.report else None
    goal_audit = build_goal_completion_audit(
        case,
        readiness=readiness,
        hidden_wall=hidden_wall,
        live_state=live_state,
        release_gate=release_gate,
        source_gaps=source_gaps,
        source_acquisition=source_acquisition,
        source_acquisition_preflight=source_acquisition_preflight,
        playthrough_report=playthrough_proof.report,
    )
    validation_prep = build_validation_prep_packet(package_paths, release_case_id=case.case_id) if package_paths else None
    return PilotReadinessBundle(
        case_id=case.case_id,
        ready_for_learner_pilot=readiness.ready_for_learner_pilot and playthrough_proof.objective_ready and goal_audit.complete,
        readiness=readiness,
        hidden_wall=hidden_wall,
        hidden_wall_payload=hidden_wall_payload,
        live_state=live_state,
        release_gate=release_gate,
        source_gaps=source_gaps,
        source_probe=source_probe,
        source_acquisition=source_acquisition,
        source_acquisition_preflight=source_acquisition_preflight,
        case_pool_audit=case_pool_audit,
        trajectory_review=trajectory_review,
        playthrough_proof=playthrough_proof,
        playthrough_review=playthrough_review,
        goal_audit=goal_audit,
        validation_prep=validation_prep,
        commands=_commands(
            case.case_id,
            case_path,
            package_paths,
            artifact_dir,
            playthrough_script_path,
            source_probe,
            source_acquisition,
            source_acquisition_preflight,
        ),
        next_steps=_next_steps(
            readiness,
            bool(package_paths),
            playthrough_proof,
            source_gaps,
            source_probe,
            case_pool_audit,
            source_acquisition,
            source_acquisition_preflight,
        ),
    )


def build_playthrough_proof(case: PreparedCase, playthrough_script_path: Path | None) -> PlaythroughProof:
    if playthrough_script_path is None:
        return PlaythroughProof(
            provided=False,
            blocking_findings=[
                "No objective playthrough script was provided; run the case start-to-finish and attach the hidden-safe playthrough report."
            ],
        )
    script_path = playthrough_script_path.expanduser().resolve()
    try:
        report, _hidden_package = run_scripted_playthrough(case, load_playthrough_actions(script_path))
    except Exception as exc:  # pragma: no cover - exact parser/runtime errors vary by script
        return PlaythroughProof(
            provided=True,
            script_path=str(script_path),
            error=type(exc).__name__,
            blocking_findings=[
                "Objective playthrough script could not be run; fix the script and rerun the bundle."
            ],
        )
    return PlaythroughProof(
        provided=True,
        script_path=str(script_path),
        objective_ready=report.objective_ready,
        report=report,
        blocking_findings=_playthrough_blocking_findings(report),
    )


def write_bundle_artifacts(bundle: PilotReadinessBundle, artifact_dir: Path) -> dict[str, str]:
    artifact_dir.mkdir(parents=True, exist_ok=True)
    paths = {
        "bundle": artifact_dir / f"{bundle.case_id}.pilot-readiness.json",
        "goal_audit": artifact_dir / f"{bundle.case_id}.goal-audit.json",
        "hidden_wall": artifact_dir / f"{bundle.case_id}.hidden-wall.json",
        "hidden_wall_payload": artifact_dir / f"{bundle.case_id}.hidden-wall.payload.json",
        "live_state": artifact_dir / f"{bundle.case_id}.live-state.json",
        "release_gate": artifact_dir / f"{bundle.case_id}.release-gate.json",
        "source_gaps": artifact_dir / f"{bundle.case_id}.source-gaps.json",
        "supplemental_results_template": artifact_dir / f"{bundle.case_id}.results.local.template.json",
        "trajectory_review": artifact_dir / f"{bundle.case_id}.trajectory-review.json",
        "trajectory_review_template": artifact_dir / f"{bundle.case_id}.trajectory-review.local.template.json",
    }
    if bundle.source_probe:
        paths["source_probe"] = artifact_dir / f"{bundle.case_id}.source-probe.json"
        paths["supplemental_results_candidates"] = artifact_dir / f"{bundle.case_id}.results.local.candidates.json"
    if bundle.source_acquisition:
        paths["source_acquisition"] = artifact_dir / f"{bundle.case_id}.source-acquisition.json"
    if bundle.source_acquisition_preflight:
        paths["source_acquisition_preflight"] = artifact_dir / f"{bundle.case_id}.source-acquisition-preflight.json"
    if bundle.case_pool_audit:
        paths["case_pool_audit"] = artifact_dir / f"{bundle.case_id}.case-pool-audit.json"
    if bundle.playthrough_proof.report:
        paths["playthrough_report"] = artifact_dir / f"{bundle.case_id}.playthrough-report.json"
    if bundle.playthrough_review:
        paths["playthrough_review"] = artifact_dir / f"{bundle.case_id}.playthrough-review.json"
        paths["playthrough_review_template"] = artifact_dir / f"{bundle.case_id}.playthrough-review.local.template.json"
    paths["bundle"].write_text(bundle.model_dump_json(indent=2) + "\n", encoding="utf-8")
    paths["goal_audit"].write_text(bundle.goal_audit.model_dump_json(indent=2) + "\n", encoding="utf-8")
    paths["hidden_wall"].write_text(bundle.hidden_wall.model_dump_json(indent=2) + "\n", encoding="utf-8")
    paths["hidden_wall_payload"].write_text(
        json.dumps(bundle.hidden_wall_payload, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    paths["live_state"].write_text(bundle.live_state.model_dump_json(indent=2) + "\n", encoding="utf-8")
    paths["release_gate"].write_text(bundle.release_gate.model_dump_json(indent=2) + "\n", encoding="utf-8")
    paths["source_gaps"].write_text(bundle.source_gaps.model_dump_json(indent=2) + "\n", encoding="utf-8")
    paths["supplemental_results_template"].write_text(
        json.dumps(bundle.source_gaps.supplemental_results_payload_template, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    if bundle.source_probe:
        paths["source_probe"].write_text(bundle.source_probe.model_dump_json(indent=2) + "\n", encoding="utf-8")
        paths["supplemental_results_candidates"].write_text(
            json.dumps(bundle.source_probe.supplemental_results_payload, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
    if bundle.source_acquisition:
        paths["source_acquisition"].write_text(bundle.source_acquisition.model_dump_json(indent=2) + "\n", encoding="utf-8")
    if bundle.source_acquisition_preflight:
        paths["source_acquisition_preflight"].write_text(
            bundle.source_acquisition_preflight.model_dump_json(indent=2) + "\n",
            encoding="utf-8",
        )
    if bundle.case_pool_audit:
        paths["case_pool_audit"].write_text(bundle.case_pool_audit.model_dump_json(indent=2) + "\n", encoding="utf-8")
    paths["trajectory_review"].write_text(bundle.trajectory_review.model_dump_json(indent=2) + "\n", encoding="utf-8")
    paths["trajectory_review_template"].write_text(
        json.dumps(bundle.trajectory_review.review_artifact_template, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    if bundle.playthrough_proof.report:
        paths["playthrough_report"].write_text(bundle.playthrough_proof.report.model_dump_json(indent=2) + "\n", encoding="utf-8")
    if bundle.playthrough_review:
        paths["playthrough_review"].write_text(bundle.playthrough_review.model_dump_json(indent=2) + "\n", encoding="utf-8")
        paths["playthrough_review_template"].write_text(
            json.dumps(bundle.playthrough_review.review_artifact_template, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
    if bundle.validation_prep:
        paths["validation_prep"] = artifact_dir / f"{bundle.case_id}.grader-validation-prep.json"
        paths["clinician_answer_key_template"] = artifact_dir / f"{bundle.case_id}.clinician-answer-key.template.json"
        paths["evidence_template"] = artifact_dir / f"{bundle.case_id}.evidence.template.json"
        paths["validation_prep"].write_text(bundle.validation_prep.model_dump_json(indent=2) + "\n", encoding="utf-8")
        paths["clinician_answer_key_template"].write_text(
            json.dumps(bundle.validation_prep.clinician_answer_key_template, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        paths["evidence_template"].write_text(
            json.dumps(bundle.validation_prep.evidence_template, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
    return {key: str(path) for key, path in paths.items()}


def _commands(
    case_id: str,
    case_path: Path,
    package_paths: list[Path],
    artifact_dir: Path | None,
    playthrough_script_path: Path | None,
    source_probe: SourceProbeReport | None = None,
    source_acquisition: SourceAcquisitionChecklist | None = None,
    source_acquisition_preflight: SourceAcquisitionPreflightReport | None = None,
) -> list[ReadinessCommand]:
    artifact_root = artifact_dir or Path("reports") / "restricted"
    case_ref = _cmd_arg(case_path)
    playthrough_script_ref = (
        _cmd_arg(playthrough_script_path)
        if playthrough_script_path
        else _cmd_arg(Path("data") / "restricted" / f"{case_id}.playthrough.local.json")
    )
    source_root_ref = _cmd_arg(source_probe.source_root if source_probe and source_probe.source_root else "D:/physionet")
    source_acquisition_ref = _cmd_arg(artifact_root / f"{case_id}.source-acquisition.json")
    source_acquisition_preflight_ref = _cmd_arg(artifact_root / f"{case_id}.source-acquisition-preflight.json")
    commands = [
        ReadinessCommand(
            label="hidden-wall audit",
            command=(
                f"python -m backend.cases.hidden_wall {case_ref} "
                f"--output {_cmd_arg(artifact_root / f'{case_id}.hidden-wall.json')} "
                f"--payload-output {_cmd_arg(artifact_root / f'{case_id}.hidden-wall.payload.json')}"
            ),
            writes=[
                str(artifact_root / f"{case_id}.hidden-wall.json"),
                str(artifact_root / f"{case_id}.hidden-wall.payload.json"),
            ],
        ),
        ReadinessCommand(
            label="goal completion audit",
            command=(
                f"python -m backend.cases.goal_audit {case_ref} "
                f"--playthrough-script {playthrough_script_ref} "
                f"{'--source-acquisition-report ' + source_acquisition_ref + ' ' if source_acquisition else ''}"
                f"{'--source-acquisition-preflight-report ' + source_acquisition_preflight_ref + ' ' if source_acquisition_preflight else ''}"
                f"--output {_cmd_arg(artifact_root / f'{case_id}.goal-audit.json')}"
            ),
            writes=[
                str(artifact_root / f"{case_id}.goal-audit.json"),
            ],
        ),
        ReadinessCommand(
            label="live-state audit",
            command=(
                f"python -m backend.cases.live_state_audit {case_ref} "
                f"--output {_cmd_arg(artifact_root / f'{case_id}.live-state.json')}"
            ),
            writes=[
                str(artifact_root / f"{case_id}.live-state.json"),
            ],
        ),
        ReadinessCommand(
            label="release-gate audit",
            command=(
                f"python -m backend.cases.release_gate_audit {case_ref} "
                f"--output {_cmd_arg(artifact_root / f'{case_id}.release-gate.json')}"
            ),
            writes=[
                str(artifact_root / f"{case_id}.release-gate.json"),
            ],
        ),
        ReadinessCommand(
            label="source-result gaps",
            command=(
                f"python -m backend.cases.source_gaps {case_ref} "
                f"--output {_cmd_arg(artifact_root / f'{case_id}.source-gaps.json')} "
                f"--template-output {_cmd_arg(artifact_root / f'{case_id}.results.local.template.json')}"
            ),
            writes=[
                str(artifact_root / f"{case_id}.source-gaps.json"),
                str(artifact_root / f"{case_id}.results.local.template.json"),
            ],
        ),
        ReadinessCommand(
            label="source-result probe",
            command=(
                f"python -m backend.cases.source_probe {case_ref} "
                f"--source-root {source_root_ref} "
                "--skip-lab-probe "
                f"--output {_cmd_arg(artifact_root / f'{case_id}.source-probe.json')} "
                f"--supplemental-output {_cmd_arg(artifact_root / f'{case_id}.results.local.candidates.json')}"
            ),
            writes=[
                str(artifact_root / f"{case_id}.source-probe.json"),
                str(artifact_root / f"{case_id}.results.local.candidates.json"),
            ],
        ),
        ReadinessCommand(
            label="trajectory review packet",
            command=(
                f"python -m backend.cases.trajectory_review {case_ref} "
                f"--output {_cmd_arg(artifact_root / f'{case_id}.trajectory-review.json')} "
                f"--review-template-output {_cmd_arg(artifact_root / f'{case_id}.trajectory-review.local.template.json')}"
            ),
            writes=[
                str(artifact_root / f"{case_id}.trajectory-review.json"),
                str(artifact_root / f"{case_id}.trajectory-review.local.template.json"),
            ],
        ),
        ReadinessCommand(
            label="objective playthrough proof",
            command=(
                f"python -m backend.cases.playthrough {case_ref} "
                f"--script {playthrough_script_ref} "
                f"--output {_cmd_arg(artifact_root / f'{case_id}.playthrough-report.json')}"
            ),
            writes=[
                str(artifact_root / f"{case_id}.playthrough-report.json"),
            ],
        ),
        ReadinessCommand(
            label="playthrough review packet",
            command=(
                f"python -m backend.cases.playthrough_review {case_ref} "
                f"--script {playthrough_script_ref} "
                f"--output {_cmd_arg(artifact_root / f'{case_id}.playthrough-review.json')} "
                f"--review-template-output {_cmd_arg(artifact_root / f'{case_id}.playthrough-review.local.template.json')}"
            ),
            writes=[
                str(artifact_root / f"{case_id}.playthrough-review.json"),
                str(artifact_root / f"{case_id}.playthrough-review.local.template.json"),
            ],
        ),
    ]
    if source_acquisition:
        commands.append(
            ReadinessCommand(
                label="source acquisition checklist",
                command=(
                    "python -m backend.cases.source_acquisition "
                    f"{_cmd_arg(Path('data') / 'restricted' / f'{case_id}.source-refresh.local.json')} "
                    f"--output {source_acquisition_ref}"
                ),
                writes=[str(artifact_root / f"{case_id}.source-acquisition.json")],
            )
        )
    if source_acquisition_preflight:
        commands.append(
            ReadinessCommand(
                label="source acquisition preflight",
                command=(
                    "python -m backend.cases.source_acquisition_preflight "
                    f"{_cmd_arg(Path('data') / 'restricted' / 'mietic_mimic_main_ed_enriched_cases.restricted.json')} "
                    f"--case-id {case_id} "
                    f"--source-acquisition-report {source_acquisition_ref} "
                    f"--supplemental-results {_cmd_arg(Path('data') / 'restricted' / f'{case_id}.results.local.json')} "
                    f"--output {source_acquisition_preflight_ref}"
                ),
                writes=[str(artifact_root / f"{case_id}.source-acquisition-preflight.json")],
            )
        )
    if package_paths:
        package_args = " ".join(_cmd_arg(path) for path in package_paths)
        commands.append(
            ReadinessCommand(
                label="grader validation prep",
                command=(
                    f"python -m backend.grader.validation_prep {package_args} "
                    f"--release-case-id {case_id} "
                    f"--output {_cmd_arg(artifact_root / f'{case_id}.grader-validation-prep.json')} "
                    f"--answer-key-output {_cmd_arg(artifact_root / f'{case_id}.clinician-answer-key.template.json')} "
                    f"--evidence-output {_cmd_arg(artifact_root / f'{case_id}.evidence.template.json')}"
                ),
                writes=[
                    str(artifact_root / f"{case_id}.grader-validation-prep.json"),
                    str(artifact_root / f"{case_id}.clinician-answer-key.template.json"),
                    str(artifact_root / f"{case_id}.evidence.template.json"),
                ],
            )
        )
    else:
        commands.append(
            ReadinessCommand(
                label="held-out grader package generation",
                command=(
                    "python -m backend.grader.heldout_packages "
                    f"{_cmd_arg('data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json')} "
                    f"--release-case-id {case_id} "
                    "--max-cases 3 "
                    f"--output-dir {_cmd_arg(artifact_root / f'{case_id}.heldout-validation-packages')} "
                    f"--manifest-output {_cmd_arg(artifact_root / f'{case_id}.heldout-validation-packages.manifest.json')}"
                ),
                writes=[
                    str(artifact_root / f"{case_id}.heldout-validation-packages.manifest.json"),
                    str(artifact_root / f"{case_id}.heldout-validation-packages"),
                ],
            )
        )
        commands.append(
            ReadinessCommand(
                label="grader validation prep",
                command=(
                    "After generating or completing held-out CasePackage files, run "
                    f"python -m backend.grader.validation_prep data/validation/packages/*.json --release-case-id {case_id}"
                ),
            )
        )
    dossier_package_args = " ".join(f"--package {_cmd_arg(path)}" for path in package_paths)
    commands.append(
        ReadinessCommand(
            label="clinician review dossier",
            command=(
                f"python -m backend.cases.clinician_review_dossier {case_ref} "
                f"--playthrough-script {playthrough_script_ref} "
                f"--source-probe-report {_cmd_arg(artifact_root / f'{case_id}.source-probe.json')} "
                f"{'--source-acquisition-report ' + source_acquisition_ref + ' ' if source_acquisition else ''}"
                f"{'--source-acquisition-preflight-report ' + source_acquisition_preflight_ref + ' ' if source_acquisition_preflight else ''}"
                f"{dossier_package_args + ' ' if dossier_package_args else ''}"
                f"--output {_cmd_arg(artifact_root / f'{case_id}.clinician-review-dossier.json')} "
                f"--review-template-output {_cmd_arg(artifact_root / f'{case_id}.review.local.template.json')}"
            ),
            writes=[
                str(artifact_root / f"{case_id}.clinician-review-dossier.json"),
                str(artifact_root / f"{case_id}.review.local.template.json"),
            ],
        )
    )
    commands.append(
        ReadinessCommand(
            label="learner-readiness gate",
            command=(
                f"python -m backend.cases.readiness {case_ref} "
                f"--require-playthrough --playthrough-script {playthrough_script_ref}"
            ),
        )
    )
    commands.append(
        ReadinessCommand(
            label="finalize learner-ready case",
            command=(
                f"python -m backend.cases.finalize {case_ref} "
                f"--review {_cmd_arg(Path('data') / 'restricted' / f'{case_id}.review.local.json')} "
                f"--playthrough-script {playthrough_script_ref} "
                f"--output {_cmd_arg(Path('data') / 'cases' / f'{case_id}.learner-ready.local.json')} "
                f"--report-output {_cmd_arg(artifact_root / f'{case_id}.finalization.json')}"
            ),
            writes=[
                str(Path("data") / "cases" / f"{case_id}.learner-ready.local.json"),
                str(artifact_root / f"{case_id}.finalization.json"),
            ],
        )
    )
    return commands


def _next_steps(
    readiness: CaseReadinessReport,
    has_packages: bool,
    playthrough_proof: PlaythroughProof,
    source_gaps: SourceGapReport,
    source_probe: SourceProbeReport | None = None,
    case_pool_audit: CasePoolAudit | None = None,
    source_acquisition: SourceAcquisitionChecklist | None = None,
    source_acquisition_preflight: SourceAcquisitionPreflightReport | None = None,
) -> list[str]:
    issue_codes = {issue.code for issue in readiness.issues if issue.severity == "blocker"}
    steps: list[str] = []
    recommendation = _case_pool_recommendation_next_step(case_pool_audit)
    if recommendation:
        steps.append(recommendation)
    if "missing_decisive_source_result" in issue_codes or "release_blocking_source_result_gap" in issue_codes:
        steps.append(_source_result_next_step(source_probe))
    if source_acquisition and not source_acquisition.source_ready:
        steps.append(
            "Resolve source_acquisition.tasks before learner release; missing source modules: "
            + (", ".join(source_acquisition.missing_source_modules) or "see source_acquisition.tasks")
            + "."
        )
    if source_acquisition_preflight and not source_acquisition_preflight.source_ready_after_payload:
        steps.append(
            "The current supplemental-results preflight remains blocked; unresolved order ids after payload: "
            + (
                ", ".join(source_acquisition_preflight.unresolved_release_blocking_order_ids_after)
                or "see source_acquisition_preflight"
            )
            + "."
        )
    elif source_acquisition_preflight and source_acquisition_preflight.source_ready_after_payload:
        if source_gaps.release_blocking_missing_results:
            steps.append(
                "The supplemental-results preflight clears blockers in memory; rerun guarded preparation/source_refresh so the prepared case itself has empty source gaps."
            )
    if "missing_result_source_reference" in issue_codes:
        steps.append("Regenerate or repair result bundles so every MIMIC result includes source_reference metadata with case/source row provenance.")
    if "trajectory_not_clinician_signed" in issue_codes or "trajectory_review_missing" in issue_codes:
        steps.append("Have a clinician review the trajectory packet and apply the completed review artifact.")
    if "grader_not_validated" in issue_codes or "grader_validation_review_missing" in issue_codes:
        if has_packages:
            steps.append("Fill the clinician answer key, run grader validation, and apply the passing validation review artifact.")
        else:
            steps.append("Complete held-out encounters to produce CasePackage files, then prepare a clinician answer key and run grader validation.")
    if "playthrough_not_clinician_signed" in issue_codes or "playthrough_review_missing" in issue_codes:
        steps.append("Have a clinician play the objective run to debrief, review the playthrough report and feedback, then apply the completed playthrough review artifact.")
    if not playthrough_proof.objective_ready:
        steps.append("Run the objective clinician-style playthrough script and preserve a report with objective_ready=true.")
    if not steps:
        steps.append("Run the learner-readiness gate and preserve the passing report with the local case artifacts.")
    return steps


def _case_pool_recommendation_next_step(case_pool_audit: CasePoolAudit | None) -> str | None:
    if not case_pool_audit or not case_pool_audit.recommended_case_id:
        return None
    selected = case_pool_audit.selected_case_id
    recommended = (
        case_pool_audit.recommended_unblocked_source_evidence_case_id
        or case_pool_audit.recommended_source_evidence_case_id
        or case_pool_audit.recommended_case_id
    )
    if not selected or selected == recommended:
        return None
    candidate = next(
        (item for item in case_pool_audit.candidates if item.case_id == recommended),
        None,
    )
    suffix = ""
    if candidate:
        auto_apply = ", ".join(candidate.source_probe_auto_apply_decisive_result_ids)
        unresolved = ", ".join(candidate.source_probe_unresolved_release_blocking_signals)
        if auto_apply:
            suffix += f" Local auto-applyable decisive source candidates: {auto_apply}."
        if unresolved:
            suffix += f" Remaining release-blocking source signals: {unresolved}."
    rank_suffix = f" Current selected rank: {case_pool_audit.selected_case_rank}." if case_pool_audit.selected_case_rank else ""
    if case_pool_audit.recommended_unblocked_source_evidence_case_id:
        recommendation_field = "case_pool_audit.recommended_unblocked_source_evidence_case_id"
    elif case_pool_audit.recommended_source_evidence_case_id:
        recommendation_field = "case_pool_audit.recommended_source_evidence_case_id"
    else:
        recommendation_field = "case_pool_audit.recommended_case_id"
    source_suffix = ""
    if case_pool_audit.recommended_source_evidence_case_id and not case_pool_audit.recommended_unblocked_source_evidence_case_id:
        source_suffix = (
            " No candidate currently has an attached or auto-applyable decisive source result with all release-blocking source-result gaps cleared; "
            "treat this as a blocked evidence lead, not a pivot-ready case."
        )
    elif not case_pool_audit.recommended_source_evidence_case_id:
        source_suffix = " No candidate currently has an attached or auto-applyable decisive source result."
    return (
        f"Evaluate {recommendation_field} "
        f"({recommended}) before continuing the selected case ({selected}); "
        "the local pool audit ranks it higher for the abdominal pilot."
        + rank_suffix
        + suffix
        + source_suffix
        + " Run source_refresh for the recommended case and keep it fail-closed until all release blockers clear."
    )


def _source_result_next_step(source_probe: SourceProbeReport | None) -> str:
    if not source_probe or not source_probe.unresolved_release_blocking_results:
        return (
            "Use source_gaps.release_blocking_missing_results to attach the linked MIMIC radiology/ECG row "
            "for the decisive order signal, then rerun preparation with a supplemental-results file."
        )
    signals = ", ".join(
        str(item.get("signal"))
        for item in source_probe.unresolved_release_blocking_results
        if item.get("signal")
    )
    checked_paths = sorted(
        {
            str(path)
            for item in source_probe.unresolved_release_blocking_results
            for path in item.get("checked_paths", [])
            if path
        }
    )
    checked_suffix = f" Checked paths: {', '.join(checked_paths)}." if checked_paths else ""
    if any(item.get("localized_operator_queries") for item in source_probe.unresolved_release_blocking_results):
        query_suffix = " Use localized_operator_queries attached to the unresolved blocker for runnable local DuckDB/PowerShell lookups."
    elif any(item.get("operator_queries") for item in source_probe.unresolved_release_blocking_results):
        query_suffix = " Use operator_queries attached to the unresolved blocker for DuckDB/PowerShell lookups."
    else:
        query_suffix = ""
    return (
        "Resolve source_probe.unresolved_release_blocking_results "
        f"({signals or 'decisive source result'}): attach an encounter-linked MIMIC radiology/ECG result, "
        "rerun source_probe, then rerun preparation with the resulting supplemental-results payload."
        + checked_suffix
        + query_suffix
    )


def _playthrough_blocking_findings(report: PlaythroughReport) -> list[str]:
    findings: list[str] = []
    if not report.passed:
        if not report.completed:
            findings.append("Encounter was not completed.")
        if not report.package_assembled:
            findings.append("CasePackage was not assembled after completion.")
        if not report.package_after_completion_only:
            findings.append("CasePackage could be assembled before encounter completion.")
        if report.hidden_leakage:
            findings.append("In-loop playthrough payload leaked hidden truth labels.")
        if report.fabricated_result_violations:
            findings.append("Playthrough produced structured results without source provenance.")
    missing = [field for field, value in report.success_checklist.model_dump(mode="json").items() if not value]
    for field in missing:
        findings.append(f"Objective checklist item is incomplete: {field}.")
    return findings


def _main() -> int:
    parser = argparse.ArgumentParser(description="Build a hidden-safe pilot-readiness bundle for one prepared abdominal case.")
    parser.add_argument("case", type=Path, help="PreparedCase JSON.")
    parser.add_argument("--package", dest="packages", action="append", type=Path, default=[], help="Completed CasePackage JSON for validation prep. May be repeated.")
    parser.add_argument("--playthrough-script", type=Path, help="Hidden-safe objective playthrough script for this case.")
    parser.add_argument("--source-probe-report", type=Path, help="Optional source-probe JSON report to embed in the bundle.")
    parser.add_argument("--source-acquisition-report", type=Path, help="Optional source-acquisition checklist JSON to embed in the bundle.")
    parser.add_argument("--source-acquisition-preflight-report", type=Path, help="Optional source-acquisition preflight JSON to embed in the bundle.")
    parser.add_argument("--case-pool-audit-report", type=Path, help="Optional hidden-safe case-pool audit JSON report to embed in the bundle.")
    parser.add_argument("--output", type=Path, help="Optional bundle JSON output path.")
    parser.add_argument("--artifact-dir", type=Path, help="Optional directory to write bundle sub-artifacts.")
    args = parser.parse_args()

    case_path = args.case.expanduser().resolve()
    case = PreparedCase.model_validate_json(case_path.read_text(encoding="utf-8"))
    package_paths = [path.expanduser().resolve() for path in args.packages]
    playthrough_script_path = args.playthrough_script.expanduser().resolve() if args.playthrough_script else None
    source_probe = None
    if args.source_probe_report:
        source_probe_path = args.source_probe_report.expanduser().resolve()
        source_probe = SourceProbeReport.model_validate_json(source_probe_path.read_text(encoding="utf-8"))
    source_acquisition = None
    if args.source_acquisition_report:
        source_acquisition_path = args.source_acquisition_report.expanduser().resolve()
        source_acquisition = SourceAcquisitionChecklist.model_validate_json(source_acquisition_path.read_text(encoding="utf-8"))
    source_acquisition_preflight = None
    if args.source_acquisition_preflight_report:
        source_acquisition_preflight_path = args.source_acquisition_preflight_report.expanduser().resolve()
        source_acquisition_preflight = SourceAcquisitionPreflightReport.model_validate_json(
            source_acquisition_preflight_path.read_text(encoding="utf-8")
        )
    case_pool_audit = None
    if args.case_pool_audit_report:
        case_pool_audit_path = args.case_pool_audit_report.expanduser().resolve()
        case_pool_audit = CasePoolAudit.model_validate_json(case_pool_audit_path.read_text(encoding="utf-8"))
    bundle = build_pilot_readiness_bundle(
        case,
        case_path,
        package_paths,
        args.artifact_dir,
        playthrough_script_path,
        source_probe=source_probe,
        source_acquisition=source_acquisition,
        source_acquisition_preflight=source_acquisition_preflight,
        case_pool_audit=case_pool_audit,
    )
    rendered = bundle.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    if args.artifact_dir:
        write_bundle_artifacts(bundle, args.artifact_dir.expanduser().resolve())
    return 0 if bundle.ready_for_learner_pilot else 1


if __name__ == "__main__":
    raise SystemExit(_main())
