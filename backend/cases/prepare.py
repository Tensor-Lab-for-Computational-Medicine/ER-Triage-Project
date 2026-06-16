from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from backend.cases.schemas import (
    CaseReviewStatus,
    CaseRubric,
    EvidencePassageSpec,
    ExamFact,
    HiddenTruth,
    HpiFact,
    PreparedCase,
    ResultBundle,
    SourceEvidenceAudit,
    TimelineEvent,
    TrajectorySpec,
    VisibleStart,
)


class CasePreparationError(ValueError):
    """Raised when a raw encounter cannot safely become a prepared case."""


def pilot_exclusion_reason(trajectory: TrajectorySpec) -> str | None:
    """Return why a case must stay out of the learner pilot, if any."""

    if trajectory.excluded_reason:
        return trajectory.excluded_reason
    if not trajectory.rules:
        return "trajectory rules are required for pilot safety"
    return None


def assert_pilot_eligible(case: PreparedCase) -> None:
    reason = pilot_exclusion_reason(case.trajectory)
    if not reason:
        reason = _starting_vitals_mismatch_reason(case.visible_start, case.trajectory)
    if reason:
        raise CasePreparationError(reason)


def prepare_raw_encounter(raw: dict[str, Any]) -> PreparedCase:
    """Transform one raw local encounter record into a visible/hidden split.

    The raw shape is intentionally simple for the pilot. Adapters for specific
    MIMIC-IV-Ext-CDS exports should normalize into this shape before calling
    this function, keeping credentialed data local.
    """

    trajectory = TrajectorySpec.model_validate(raw.get("trajectory") or {})
    visible_start = VisibleStart.model_validate(raw["visible_start"])
    reason = pilot_exclusion_reason(trajectory) or _starting_vitals_mismatch_reason(visible_start, trajectory)
    if reason:
        raise CasePreparationError(reason)

    hidden_truth = HiddenTruth.model_validate(raw["hidden_truth"])
    hpi_facts = [HpiFact.model_validate(item) for item in raw.get("hpi_facts", [])]
    exam_facts = [ExamFact.model_validate(item) for item in raw.get("exam_facts", [])]
    result_bundles = {
        order_id: ResultBundle.model_validate({**bundle, "order_id": order_id})
        for order_id, bundle in (raw.get("result_bundles") or {}).items()
    }
    real_timeline = [TimelineEvent.model_validate(item) for item in raw.get("real_timeline", [])]
    rubric = CaseRubric.model_validate(raw.get("rubric") or {})
    evidence_corpus = [EvidencePassageSpec.model_validate(item) for item in raw.get("evidence_corpus", [])]
    review_status = CaseReviewStatus.model_validate(raw.get("review_status") or {})
    source_evidence_audit = SourceEvidenceAudit.model_validate(raw.get("source_evidence_audit") or {})

    return PreparedCase(
        case_id=raw["case_id"],
        title=raw["title"],
        visible_start=visible_start,
        hpi_facts=hpi_facts,
        exam_facts=exam_facts,
        result_bundles=result_bundles,
        hidden_truth=hidden_truth,
        trajectory=trajectory,
        real_timeline=real_timeline,
        rubric=rubric,
        evidence_corpus=evidence_corpus,
        source=raw.get("source", "local-prepared"),
        review_status=review_status,
        source_evidence_audit=source_evidence_audit,
    )


def serialize_encounter_context(case: PreparedCase) -> dict[str, Any]:
    """Serialize only the start-of-encounter visible context."""

    return {
        "case_id": case.case_id,
        "title": case.title,
        "visible_start": case.visible_start.model_dump(mode="json"),
        "trajectory_start": case.trajectory.starting_vitals.model_dump(mode="json"),
        "source": case.source,
    }


def _starting_vitals_mismatch_reason(visible_start: VisibleStart, trajectory: TrajectorySpec) -> str | None:
    presenting_vitals = visible_start.presenting_vitals.model_dump(mode="json")
    starting_vitals = trajectory.starting_vitals.model_dump(mode="json")
    if presenting_vitals == starting_vitals:
        return None
    return "visible presenting vitals must match trajectory starting vitals"


def _main() -> None:
    parser = argparse.ArgumentParser(description="Prepare one local raw encounter JSON file.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    raw = json.loads(args.input.read_text(encoding="utf-8"))
    prepared = prepare_raw_encounter(raw)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(prepared.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    _main()
