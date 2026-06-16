from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.cases.schemas import PreparedCase, VisibleStart, VitalSigns
from backend.state.engine import start_case


class TrajectorySnapshot(BaseModel):
    elapsed_minutes: float
    event: str
    vitals: VitalSigns
    interventions: list[str] = Field(default_factory=list)


class TrajectoryScenario(BaseModel):
    id: str
    label: str
    deterministic: bool
    snapshots: list[TrajectorySnapshot] = Field(default_factory=list)


class TrajectoryReviewPacket(BaseModel):
    case_id: str
    source: str
    source_identifiers: dict[str, Any] = Field(default_factory=dict)
    visible_start: VisibleStart
    trajectory: dict[str, Any]
    deterministic_engine: dict[str, str]
    review_requirements: list[str] = Field(default_factory=list)
    rule_summaries: list[dict[str, Any]] = Field(default_factory=list)
    scenarios: list[TrajectoryScenario] = Field(default_factory=list)
    review_artifact_template: dict[str, Any]
    grader_only_truth_excluded: Literal[True] = True


def build_trajectory_review_packet(case: PreparedCase, review_time: str = "replace-with-review-time") -> TrajectoryReviewPacket:
    scenarios = [
        _scenario(case, "natural_15_min", "No intervention for 15 minutes", [("advance", 5), ("advance", 5), ("advance", 5)]),
        _scenario(case, "analgesia_then_15_min", "Analgesia at time 0, then 15 minutes", [("intervention:analgesia", 0), ("advance", 5), ("advance", 5), ("advance", 5)]),
        _scenario(case, "oxygen_then_15_min", "Oxygen at time 0, then 15 minutes", [("intervention:oxygen", 0), ("advance", 5), ("advance", 5), ("advance", 5)]),
        _scenario(case, "fluids_then_15_min", "IV fluids at time 0, then 15 minutes", [("intervention:iv_fluids", 0), ("advance", 5), ("advance", 5), ("advance", 5)]),
    ]
    return TrajectoryReviewPacket(
        case_id=case.case_id,
        source=case.source,
        source_identifiers=dict(case.source_evidence_audit.source_identifiers),
        visible_start=case.visible_start,
        trajectory=case.trajectory.model_dump(mode="json"),
        deterministic_engine={
            "module": "backend.state.engine",
            "entrypoint": "EncounterEngine.advance",
            "rule_application": "EncounterEngine._apply_trajectory",
        },
        review_requirements=[
            "Verify the starting vitals against the local source record.",
            "Review each deterministic rule and confirm the direction, rate, floor, and ceiling are clinically defensible for this case.",
            "Review intervention scenarios and confirm immediate effects plus subsequent trajectory behavior are plausible.",
            "Confirm repeated runs with identical actions and timing produce identical vital signs.",
            "Confirm no model-generated physiology or narrated-stable override is required for the trajectory.",
        ],
        rule_summaries=[_rule_summary(rule) for rule in case.trajectory.rules],
        scenarios=scenarios,
        review_artifact_template={
            "case_id": case.case_id,
            "trajectory": {
                "reviewer_name": "replace-with-clinician-name",
                "reviewed_at": review_time,
                "starting_vitals_verified": False,
                "rules_clinically_defensible": False,
                "intervention_effects_reviewed": False,
                "deterministic_behavior_reviewed": False,
                "no_model_generated_trajectory": False,
                "notes": [
                    "Fill this only after reviewing the packet against the local source record and simulator behavior."
                ],
            },
        },
    )


def _rule_summary(rule) -> dict[str, Any]:
    condition = rule.condition.model_dump(mode="json")
    return {
        "id": rule.id,
        "vital": rule.vital,
        "condition": {key: value for key, value in condition.items() if value not in (None, "")},
        "delta_per_minute": rule.delta_per_minute,
        "floor": rule.floor,
        "ceiling": rule.ceiling,
        "review_prompt": (
            f"Confirm this rule's effect on {rule.vital} is conservative, deterministic, "
            "and clinically defensible for the visible presentation."
        ),
    }


def _scenario(case: PreparedCase, scenario_id: str, label: str, actions: list[tuple[str, float]]) -> TrajectoryScenario:
    first = _run_actions(case, scenario_id, actions)
    second = _run_actions(case, scenario_id, actions)
    deterministic = [item.model_dump(mode="json") for item in first] == [item.model_dump(mode="json") for item in second]
    return TrajectoryScenario(id=scenario_id, label=label, deterministic=deterministic, snapshots=first)


def _run_actions(case: PreparedCase, scenario_id: str, actions: list[tuple[str, float]]) -> list[TrajectorySnapshot]:
    engine = start_case(case, session_id=f"trajectory-review-{scenario_id}")
    snapshots = [_snapshot(engine, "start")]
    for action, minutes in actions:
        if action == "advance":
            engine.advance(dt=minutes)
            snapshots.append(_snapshot(engine, f"advance {minutes:g} min"))
            continue
        if action.startswith("intervention:"):
            intervention_id = action.split(":", 1)[1]
            engine.apply_intervention(intervention_id)
            snapshots.append(_snapshot(engine, f"apply {intervention_id}"))
            if minutes:
                engine.advance(dt=minutes)
                snapshots.append(_snapshot(engine, f"advance {minutes:g} min after {intervention_id}"))
            continue
        raise ValueError(f"unsupported trajectory review action: {action}")
    return snapshots


def _snapshot(engine, event: str) -> TrajectorySnapshot:
    return TrajectorySnapshot(
        elapsed_minutes=engine.state.elapsed_minutes,
        event=event,
        vitals=engine.state.current_vitals.model_copy(deep=True),
        interventions=list(engine.state.interventions),
    )


def _main() -> None:
    parser = argparse.ArgumentParser(description="Build a hidden-safe deterministic trajectory review packet.")
    parser.add_argument("case", type=Path, help="PreparedCase JSON.")
    parser.add_argument("--output", type=Path, help="Optional packet JSON path.")
    parser.add_argument("--review-template-output", type=Path, help="Optional trajectory-only review artifact template path.")
    args = parser.parse_args()

    case = PreparedCase.model_validate_json(args.case.read_text(encoding="utf-8"))
    packet = build_trajectory_review_packet(case)
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
