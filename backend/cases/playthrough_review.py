from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.cases.playthrough import PlaythroughReport, load_playthrough_actions, run_scripted_playthrough
from backend.cases.prepare import CasePreparationError
from backend.cases.schemas import PreparedCase, VisibleStart


class PlaythroughReviewPacket(BaseModel):
    case_id: str
    visible_start: VisibleStart
    objective_ready: bool
    success_checklist: dict[str, bool]
    playthrough_report: PlaythroughReport
    blocking_findings: list[str] = Field(default_factory=list)
    debrief_review_requirements: list[str] = Field(default_factory=list)
    review_artifact_template: dict[str, Any]
    grader_only_truth_excluded: Literal[True] = True


def build_playthrough_review_packet(
    case: PreparedCase,
    playthrough_report: PlaythroughReport,
    review_time: str = "replace-with-review-time",
) -> PlaythroughReviewPacket:
    if playthrough_report.case_id != case.case_id:
        raise CasePreparationError(
            f"Playthrough report case_id {playthrough_report.case_id!r} does not match prepared case {case.case_id!r}."
        )
    leaked = _hidden_terms_in_payload(case, playthrough_report.model_dump(mode="json"))
    if leaked:
        raise CasePreparationError("Playthrough review packet would contain hidden truth terms: " + ", ".join(leaked))

    checklist = playthrough_report.success_checklist.model_dump(mode="json")
    blocking_findings = _blocking_findings(playthrough_report, checklist)
    template = {
        "case_id": case.case_id,
        "playthrough": {
            "reviewer_name": "replace-with-clinician-name",
            "reviewed_at": review_time,
            "playthrough_report": playthrough_report.model_dump(mode="json"),
            "clinician_played_case_start_to_debrief": False,
            "case_felt_realistic": False,
            "vitals_and_state_behaved_correctly": False,
            "feedback_clinically_sound": False,
            "feedback_identified_strengths_and_misses": False,
            "no_fabricated_values_confirmed": False,
            "no_hidden_leakage_confirmed": False,
            "notes": [
                "Fill this only after a clinician completes the case, reviews the debrief, and confirms the run is safe for learners."
            ],
        },
    }
    return PlaythroughReviewPacket(
        case_id=case.case_id,
        visible_start=case.visible_start,
        objective_ready=playthrough_report.objective_ready,
        success_checklist=checklist,
        playthrough_report=playthrough_report,
        blocking_findings=blocking_findings,
        debrief_review_requirements=[
            "Clinician plays the case from triage to debrief.",
            "Vitals, elapsed time, and ordered-result status behave as the authored state says.",
            "No result value is fabricated; unavailable orders are explicit.",
            "No in-loop patient, nurse, consultant, result, or exam context leaks hidden truth.",
            "Debrief feedback is clinically sound and identifies both strengths and missed actions.",
        ],
        review_artifact_template=template,
    )


def _blocking_findings(report: PlaythroughReport, checklist: dict[str, bool]) -> list[str]:
    findings: list[str] = []
    if not report.passed:
        if report.hidden_leakage:
            findings.append("Playthrough leaked hidden truth labels.")
        if report.fabricated_result_violations:
            findings.append("Playthrough produced fabricated or unproven result values.")
        if not report.package_after_completion_only:
            findings.append("CasePackage was available before encounter completion.")
        if not report.completed:
            findings.append("Encounter was not completed.")
    for name, value in checklist.items():
        if not value:
            findings.append(f"Objective checklist item is incomplete: {name}.")
    return findings


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


def _main() -> None:
    parser = argparse.ArgumentParser(description="Build a hidden-safe objective playthrough review packet.")
    parser.add_argument("case", type=Path, help="PreparedCase JSON.")
    parser.add_argument("--script", required=True, type=Path, help="Playthrough JSON action list or {'actions': [...]} object.")
    parser.add_argument("--output", type=Path, help="Optional packet JSON path.")
    parser.add_argument("--review-template-output", type=Path, help="Optional playthrough-only review artifact template path.")
    args = parser.parse_args()

    case = PreparedCase.model_validate_json(args.case.read_text(encoding="utf-8"))
    report, _hidden_package = run_scripted_playthrough(case, load_playthrough_actions(args.script))
    packet = build_playthrough_review_packet(case, report)
    rendered = packet.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    if args.review_template_output:
        args.review_template_output.parent.mkdir(parents=True, exist_ok=True)
        args.review_template_output.write_text(
            json.dumps(packet.review_artifact_template, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    _main()
