from __future__ import annotations

import argparse
from datetime import datetime
import json
from pathlib import Path
import re
from typing import Any

from pydantic import BaseModel, Field

from backend.cases.playthrough import PlaythroughReport
from backend.cases.prepare import CasePreparationError
from backend.cases.schemas import PreparedCase
from backend.grader.validate import ValidationReport


class TrajectoryReview(BaseModel):
    reviewer_name: str
    reviewed_at: str
    starting_vitals_verified: bool = False
    rules_clinically_defensible: bool = False
    intervention_effects_reviewed: bool = False
    deterministic_behavior_reviewed: bool = False
    no_model_generated_trajectory: bool = False
    notes: list[str] = Field(default_factory=list)


class GraderValidationReview(BaseModel):
    reviewer_name: str
    reviewed_at: str
    threshold: float = Field(default=0.8, ge=0, le=1)
    validation_report: ValidationReport
    clinician_answer_key_reviewed: bool = False
    feedback_release_approved: bool = False
    notes: list[str] = Field(default_factory=list)


class PlaythroughClinicalReview(BaseModel):
    reviewer_name: str
    reviewed_at: str
    playthrough_report: PlaythroughReport | None = None
    clinician_played_case_start_to_debrief: bool = False
    case_felt_realistic: bool = False
    vitals_and_state_behaved_correctly: bool = False
    feedback_clinically_sound: bool = False
    feedback_identified_strengths_and_misses: bool = False
    no_fabricated_values_confirmed: bool = False
    no_hidden_leakage_confirmed: bool = False
    notes: list[str] = Field(default_factory=list)


class CaseReviewArtifact(BaseModel):
    case_id: str
    trajectory: TrajectoryReview | None = None
    grader_validation: GraderValidationReview | None = None
    playthrough: PlaythroughClinicalReview | None = None
    notes: list[str] = Field(default_factory=list)


def apply_case_review(case: PreparedCase, artifact: CaseReviewArtifact | dict[str, Any]) -> PreparedCase:
    review = artifact if isinstance(artifact, CaseReviewArtifact) else CaseReviewArtifact.model_validate(artifact)
    if review.case_id != case.case_id:
        raise CasePreparationError(f"Review case_id {review.case_id!r} does not match prepared case {case.case_id!r}.")

    status = case.review_status.model_copy(deep=True)
    notes = [*status.notes, *review.notes]
    if review.trajectory:
        _validate_trajectory_review(review.trajectory)
        status.trajectory_clinician_signed_off = True
        status.trajectory_review = review.trajectory.model_dump(mode="json")
        notes.append(f"Trajectory signed off by {review.trajectory.reviewer_name} at {review.trajectory.reviewed_at}.")
    if review.grader_validation:
        _validate_grader_review(review.grader_validation, release_case_id=case.case_id)
        status.grader_clinician_validated = True
        status.grader_validation_review = review.grader_validation.model_dump(mode="json")
        notes.append(f"Grader validation approved by {review.grader_validation.reviewer_name} at {review.grader_validation.reviewed_at}.")
    if review.playthrough:
        _validate_playthrough_review(review.playthrough, release_case_id=case.case_id)
        status.playthrough_clinician_signed_off = True
        status.playthrough_review = review.playthrough.model_dump(mode="json")
        notes.append(f"Objective playthrough signed off by {review.playthrough.reviewer_name} at {review.playthrough.reviewed_at}.")

    status.notes = list(dict.fromkeys(item for item in notes if item))
    return case.model_copy(update={"review_status": status}, deep=True)


def assert_grader_validation_review_ready(
    review: GraderValidationReview | dict[str, Any],
    *,
    release_case_id: str | None = None,
) -> GraderValidationReview:
    parsed = review if isinstance(review, GraderValidationReview) else GraderValidationReview.model_validate(review)
    _validate_grader_review(parsed, release_case_id=release_case_id)
    return parsed


def _validate_trajectory_review(review: TrajectoryReview) -> None:
    missing = []
    if not review.starting_vitals_verified:
        missing.append("starting_vitals_verified")
    if not review.rules_clinically_defensible:
        missing.append("rules_clinically_defensible")
    if not review.intervention_effects_reviewed:
        missing.append("intervention_effects_reviewed")
    if not review.deterministic_behavior_reviewed:
        missing.append("deterministic_behavior_reviewed")
    if not review.no_model_generated_trajectory:
        missing.append("no_model_generated_trajectory")
    if missing:
        raise CasePreparationError("Trajectory review is incomplete: " + ", ".join(missing))
    _validate_review_metadata(review.reviewer_name, review.reviewed_at, "Trajectory")


def _validate_grader_review(review: GraderValidationReview, release_case_id: str | None = None) -> None:
    report = review.validation_report
    if report.release_blocked:
        raise CasePreparationError("Grader validation report is release_blocked.")
    if not report.cases:
        raise CasePreparationError("Grader validation requires at least one held-out case.")
    if release_case_id:
        non_held_out = [
            row.case_id
            for row in report.cases
            if row.case_id == release_case_id
        ]
        if non_held_out:
            raise CasePreparationError(
                "Grader validation cases must be held out from the release case: "
                + ", ".join(non_held_out)
            )
    if report.clinician_answer_key_coverage < 1:
        raise CasePreparationError("Grader validation requires clinician answer key coverage for every held-out case.")
    ungrounded_case_feedback = [
        row.case_id
        for row in report.cases
        if not row.feedback_grounding_complete
    ]
    if ungrounded_case_feedback:
        raise CasePreparationError(
            "Grader validation requires grounded feedback or explicit no-evidence language for every held-out case: "
            + ", ".join(ungrounded_case_feedback)
        )
    missing_case_scores = [
        row.case_id
        for row in report.cases
        if (
            not row.clinician_key_present
            or row.clinician_diagnostic_match is None
            or row.clinician_esi_match is None
            or row.clinician_disposition_match is None
        )
    ]
    if missing_case_scores:
        raise CasePreparationError(
            "Grader validation requires clinician diagnostic, ESI, and disposition scoring for every held-out case: "
            + ", ".join(missing_case_scores)
        )
    required_scores = {
        "clinician_diagnostic_agreement": report.clinician_diagnostic_agreement,
        "clinician_esi_agreement": report.clinician_esi_agreement,
        "clinician_disposition_agreement": report.clinician_disposition_agreement,
        "feedback_grounding_rate": report.feedback_grounding_rate,
    }
    below = [
        label
        for label, score in required_scores.items()
        if score is None or score < review.threshold
    ]
    if below:
        raise CasePreparationError("Grader validation did not meet clinician threshold for: " + ", ".join(below))
    if not review.clinician_answer_key_reviewed:
        raise CasePreparationError("Grader validation review requires clinician_answer_key_reviewed.")
    if not review.feedback_release_approved:
        raise CasePreparationError("Grader validation review requires feedback_release_approved.")
    _validate_review_metadata(review.reviewer_name, review.reviewed_at, "Grader validation")


def _validate_playthrough_review(review: PlaythroughClinicalReview, release_case_id: str | None = None) -> None:
    if review.playthrough_report is None:
        raise CasePreparationError("Playthrough review requires playthrough_report.")
    if release_case_id and review.playthrough_report.case_id != release_case_id:
        raise CasePreparationError(
            f"Playthrough report case_id {review.playthrough_report.case_id!r} does not match release case {release_case_id!r}."
        )
    if not review.playthrough_report.objective_ready:
        missing = [
            name
            for name, value in review.playthrough_report.success_checklist.model_dump(mode="json").items()
            if not value
        ]
        suffix = ": " + ", ".join(missing) if missing else "."
        raise CasePreparationError("Playthrough report is not objective_ready" + suffix)
    required = {
        "clinician_played_case_start_to_debrief": review.clinician_played_case_start_to_debrief,
        "case_felt_realistic": review.case_felt_realistic,
        "vitals_and_state_behaved_correctly": review.vitals_and_state_behaved_correctly,
        "feedback_clinically_sound": review.feedback_clinically_sound,
        "feedback_identified_strengths_and_misses": review.feedback_identified_strengths_and_misses,
        "no_fabricated_values_confirmed": review.no_fabricated_values_confirmed,
        "no_hidden_leakage_confirmed": review.no_hidden_leakage_confirmed,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise CasePreparationError("Playthrough clinical review is incomplete: " + ", ".join(missing))
    _validate_review_metadata(review.reviewer_name, review.reviewed_at, "Playthrough")


def _validate_review_metadata(reviewer_name: str, reviewed_at: str, label: str) -> None:
    name = _clean_review_text(reviewer_name)
    if not name or _looks_like_placeholder(name):
        raise CasePreparationError(f"{label} review requires a concrete reviewer_name.")
    timestamp = _clean_review_text(reviewed_at)
    if not timestamp or _looks_like_placeholder(timestamp):
        raise CasePreparationError(f"{label} review requires a concrete reviewed_at timestamp.")
    if not re.search(r"\d{1,2}:\d{2}", timestamp):
        raise CasePreparationError(f"{label} review reviewed_at must include a time.")
    try:
        datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError as exc:
        raise CasePreparationError(f"{label} review reviewed_at is not a valid ISO timestamp.") from exc


def _clean_review_text(value: str) -> str:
    return " ".join(str(value or "").split()).strip()


def _looks_like_placeholder(value: str) -> bool:
    normalized = value.lower()
    return any(marker in normalized for marker in ("replace-with", "todo", "tbd", "clinician-name", "review-time"))


def _main() -> None:
    parser = argparse.ArgumentParser(description="Apply a local clinician review artifact to a PreparedCase JSON.")
    parser.add_argument("case", type=Path, help="PreparedCase JSON.")
    parser.add_argument("--review", required=True, type=Path, help="Local clinician review artifact JSON.")
    parser.add_argument("--output", required=True, type=Path, help="Output PreparedCase JSON.")
    args = parser.parse_args()

    case = PreparedCase.model_validate_json(args.case.read_text(encoding="utf-8"))
    review = CaseReviewArtifact.model_validate_json(args.review.read_text(encoding="utf-8"))
    reviewed = apply_case_review(case, review)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(reviewed.model_dump(mode="json"), indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(
        f"Applied review to {reviewed.case_id}: "
        f"trajectory={reviewed.review_status.trajectory_clinician_signed_off}, "
        f"grader={reviewed.review_status.grader_clinician_validated}, "
        f"playthrough={reviewed.review_status.playthrough_clinician_signed_off}"
    )


if __name__ == "__main__":
    _main()
