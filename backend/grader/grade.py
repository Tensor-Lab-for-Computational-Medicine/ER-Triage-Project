from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.grader.package import CasePackage
from backend.llm.client import LLMClient, LLMMessage, LLMResult
from backend.cases.schemas import RubricAction
from backend.orders.catalog import get_order


class EvidencePassage(BaseModel):
    id: str
    title: str
    text: str
    url: str | None = None


class ClinicianRubric(BaseModel):
    expected_diagnoses: list[str] = Field(default_factory=list)
    expected_orders: list[str] = Field(default_factory=list)
    expected_exams: list[str] = Field(default_factory=list)
    expected_interventions: list[str] = Field(default_factory=list)
    excessive_interventions: list[str] = Field(default_factory=list)
    critical_actions: list[str] = Field(default_factory=list)
    esi_tolerance: int = 0


class TeachingPoint(BaseModel):
    claim: str
    evidence_id: str | None = None
    grounded: bool


class ActionFeedbackItem(BaseModel):
    action_id: str | None = None
    label: str
    message: str
    grounded: bool
    evidence_id: str | None = None
    evidence_note: str
    elapsed_minutes: float | None = None


class WorkupFeedbackItem(BaseModel):
    order_id: str
    display_name: str
    category: Literal["changed_management", "missed", "low_yield", "unavailable"]
    message: str
    grounded: bool
    evidence_id: str | None = None
    evidence_note: str
    status: str | None = None
    elapsed_minutes: float | None = None
    result_summary: str | None = None


class GraderFeedback(BaseModel):
    diagnostic_accuracy: dict
    acuity: dict
    completeness: dict
    workup_judgment: dict
    action_feedback: dict
    teaching_points: list[TeachingPoint]


def grade_case_package(
    package: CasePackage,
    rubric: ClinicianRubric | None = None,
    evidence_passages: list[EvidencePassage] | None = None,
) -> GraderFeedback:
    rubric = rubric or ClinicianRubric()
    evidence_passages = evidence_passages or []

    truth = package.hidden_truth
    diagnosis_text = " ".join([*package.differential, package.soap.assessment]).lower()
    expected_orders = rubric.expected_orders or list(package.rubric.expected_orders)
    expected_diagnoses = rubric.expected_diagnoses or list(package.rubric.expected_diagnoses)
    expected = [truth.final_diagnosis, *expected_diagnoses]
    matched_diagnoses = [diagnosis for diagnosis in expected if diagnosis.lower() in diagnosis_text]

    last_esi = package.esi_history[-1].level if package.esi_history else None
    esi_delta = abs(last_esi - truth.validated_esi) if last_esi else None
    ordered_ids = [order.order_id for order in package.orders]
    performed_exam_ids = [record.maneuver_id for record in package.exams]
    intervention_ids = [record.intervention_id for record in package.interventions]
    performed_action_ids = set(ordered_ids) | set(performed_exam_ids) | set(intervention_ids)
    missed_orders = [order_id for order_id in expected_orders if order_id not in ordered_ids]
    changed_management = [
        order.order_id
        for order in package.orders
        if order.order_id in expected_orders and order.status == "resulted"
    ]
    low_yield = [
        order.order_id
        for order in package.orders
        if order.status == "unavailable" and order.order_id not in rubric.expected_orders
    ]
    critical_actions = rubric.critical_actions or list(package.rubric.critical_actions)
    missed_critical_actions = [action_id for action_id in critical_actions if action_id not in performed_action_ids]
    critical_action_gaps = [
        {
            "action_id": action_id,
            "why_it_mattered": "Clinician rubric marked this as critical for this case.",
        }
        for action_id in missed_critical_actions
    ]

    action_feedback = _action_feedback(package, rubric, evidence_passages)
    teaching_points = _grounded_teaching_points(package, evidence_passages)
    workup_items = _workup_feedback_items(package, expected_orders, evidence_passages)

    return GraderFeedback(
        diagnostic_accuracy={
            "ground_truth": truth.final_diagnosis,
            "matched": bool(matched_diagnoses),
            "matched_terms": matched_diagnoses,
        },
        acuity={
            "validated_esi": truth.validated_esi,
            "last_committed_esi": last_esi,
            "defensible": bool(last_esi and esi_delta is not None and esi_delta <= rubric.esi_tolerance),
            "revision_count": max(0, len(package.esi_history) - 1),
        },
        completeness={
            "flags": package.completeness_flags,
            "omissions": package.completeness_flags.get("omissions", []),
            "exams": {
                "expected": [entry.id for entry in _expected_exam_entries(package, rubric)],
                "performed": performed_exam_ids,
                "missed": [
                    entry.id
                    for entry in _expected_exam_entries(package, rubric)
                    if entry.id not in performed_exam_ids
                ],
            },
            "interventions": {
                "expected": [entry.id for entry in _expected_intervention_entries(package, rubric)],
                "performed": intervention_ids,
                "missed": [
                    entry.id
                    for entry in _expected_intervention_entries(package, rubric)
                    if entry.id not in intervention_ids
                ],
            },
            "critical_actions": {
                "expected": list(critical_actions),
                "performed": [action_id for action_id in critical_actions if action_id in performed_action_ids],
                "missed": missed_critical_actions,
                "gaps": critical_action_gaps,
            },
        },
        workup_judgment={
            "ordered": ordered_ids,
            "exams_performed": performed_exam_ids,
            "interventions_applied": intervention_ids,
            "changed_management": changed_management,
            "missed": missed_orders,
            "low_yield_or_unavailable": low_yield,
            "unordered_source_results": list(package.unordered_results),
            "items": [item.model_dump(mode="json") for item in workup_items],
        },
        action_feedback=action_feedback,
        teaching_points=teaching_points,
    )


async def grade_case_package_with_model(
    package: CasePackage,
    rubric: ClinicianRubric | None,
    evidence_passages: list[EvidencePassage],
    client: LLMClient,
) -> tuple[GraderFeedback, LLMResult]:
    """Use a strong model for feedback rendering while keeping judgments deterministic."""

    feedback = grade_case_package(package, rubric, evidence_passages)
    result = await client.complete(
        [
            LLMMessage(role="system", content="Render concise educational feedback from validated structured grading data."),
            LLMMessage(role="user", content=feedback.model_dump_json()),
        ],
        tier="strong",
        purpose="grader_feedback",
    )
    return feedback, result


def _expected_exam_entries(package: CasePackage, rubric: ClinicianRubric) -> list[RubricAction]:
    return _merge_entries(package.rubric.indicated_exams, rubric.expected_exams)


def _expected_intervention_entries(package: CasePackage, rubric: ClinicianRubric) -> list[RubricAction]:
    return _merge_entries(package.rubric.indicated_interventions, rubric.expected_interventions)


def _excessive_intervention_entries(package: CasePackage, rubric: ClinicianRubric) -> list[RubricAction]:
    return _merge_entries(package.rubric.excessive_interventions, rubric.excessive_interventions)


def _merge_entries(base_entries: list[RubricAction], extra_ids: list[str]) -> list[RubricAction]:
    entries = [entry for entry in base_entries]
    seen = {entry.id for entry in entries}
    for action_id in extra_ids:
        if action_id in seen:
            continue
        entries.append(
            RubricAction(
                id=action_id,
                label=action_id.replace("_", " "),
                why="Clinician rubric marked this action as expected for this case.",
            )
        )
        seen.add(action_id)
    return entries


def _first_elapsed(records, attr: str) -> dict[str, float]:
    elapsed: dict[str, float] = {}
    for record in records:
        action_id = getattr(record, attr)
        if action_id not in elapsed:
            elapsed[action_id] = float(getattr(record, "performed_at_min", getattr(record, "applied_at_min", 0)))
    return elapsed


def _action_feedback(
    package: CasePackage,
    rubric: ClinicianRubric,
    evidence_passages: list[EvidencePassage],
) -> dict:
    exam_entries = _expected_exam_entries(package, rubric)
    intervention_entries = _expected_intervention_entries(package, rubric)
    excessive_entries = _excessive_intervention_entries(package, rubric)
    performed_exams = _first_elapsed(package.exams, "maneuver_id")
    performed_interventions = _first_elapsed(package.interventions, "intervention_id")
    expected_intervention_ids = {entry.id for entry in intervention_entries}

    omissions_that_mattered = [
        _feedback_item(
            entry,
            f"No assessment for {entry.label or entry.id.replace('_', ' ')}; {entry.why}",
            evidence_passages,
            None,
        )
        for entry in exam_entries
        if entry.id not in performed_exams
    ]

    timing_sequence: list[ActionFeedbackItem] = []
    for entry in [*exam_entries, *intervention_entries]:
        elapsed = performed_exams.get(entry.id, performed_interventions.get(entry.id))
        if entry.early_minutes is None:
            continue
        if elapsed is None:
            timing_sequence.append(
                _feedback_item(
                    entry,
                    f"{entry.label or entry.id.replace('_', ' ')} was never completed; it was expected by {entry.early_minutes:g} min for this case.",
                    evidence_passages,
                    None,
                )
            )
        elif elapsed > entry.early_minutes:
            timing_sequence.append(
                _feedback_item(
                    entry,
                    f"{entry.label or entry.id.replace('_', ' ')} occurred at {elapsed:g} min; this case rubric expected it by {entry.early_minutes:g} min.",
                    evidence_passages,
                    elapsed,
                )
            )

    appropriate = [
        _feedback_item(
            entry,
            f"{entry.label or entry.id.replace('_', ' ')} was applied appropriately. {entry.why}",
            evidence_passages,
            performed_interventions.get(entry.id),
        )
        for entry in intervention_entries
        if entry.id in performed_interventions
    ]
    missed = [
        _feedback_item(
            entry,
            f"{entry.label or entry.id.replace('_', ' ')} was missed. {entry.why}",
            evidence_passages,
            None,
        )
        for entry in intervention_entries
        if entry.id not in performed_interventions
    ]

    excessive_by_id = {entry.id: entry for entry in excessive_entries}
    extra_performed_ids = [
        action_id
        for action_id in performed_interventions
        if action_id not in expected_intervention_ids
    ]
    excessive: list[ActionFeedbackItem] = []
    for action_id in extra_performed_ids:
        entry = excessive_by_id.get(
            action_id,
            RubricAction(
                id=action_id,
                label=action_id.replace("_", " "),
                why="This intervention was not listed as indicated by the case rubric.",
            ),
        )
        excessive.append(
            _feedback_item(
                entry,
                f"{entry.label or action_id.replace('_', ' ')} may be excessive here. {entry.why}",
                evidence_passages,
                performed_interventions.get(action_id),
            )
        )

    positives = [
        _feedback_item(
            entry,
            f"Good targeted exam: {entry.label or entry.id.replace('_', ' ')}. {entry.why}",
            evidence_passages,
            performed_exams.get(entry.id),
        )
        for entry in exam_entries
        if entry.id in performed_exams
    ][:3]
    if not positives and package.exams:
        first_exam = package.exams[0]
        positives.append(
            ActionFeedbackItem(
                action_id=first_exam.maneuver_id,
                label=first_exam.display_name,
                message=f"Positive exam behavior: {first_exam.display_name} was performed and recorded structurally.",
                grounded=False,
                evidence_id=None,
                evidence_note="No evidence found for this specific positive-feedback claim.",
                elapsed_minutes=first_exam.performed_at_min,
            )
        )

    return {
        "omissions_that_mattered": [item.model_dump(mode="json") for item in omissions_that_mattered],
        "timing_sequence": [item.model_dump(mode="json") for item in timing_sequence],
        "interventions": {
            "appropriate": [item.model_dump(mode="json") for item in appropriate],
            "missed": [item.model_dump(mode="json") for item in missed],
            "excessive": [item.model_dump(mode="json") for item in excessive],
        },
        "positive_reinforcement": [item.model_dump(mode="json") for item in positives],
    }


def _feedback_item(
    entry: RubricAction,
    message: str,
    evidence_passages: list[EvidencePassage],
    elapsed_minutes: float | None,
) -> ActionFeedbackItem:
    passage = _find_supporting_passage(message, evidence_passages, entry.evidence_terms)
    return ActionFeedbackItem(
        action_id=entry.id,
        label=entry.label or entry.id.replace("_", " "),
        message=message if passage else f"{message} No evidence found for this specific feedback claim.",
        grounded=bool(passage),
        evidence_id=passage.id if passage else None,
        evidence_note=f"Grounded in {passage.title}." if passage else "No evidence found for this specific feedback claim.",
        elapsed_minutes=elapsed_minutes,
    )


def _find_supporting_passage(
    message: str,
    evidence_passages: list[EvidencePassage],
    evidence_terms: list[str] | None = None,
) -> EvidencePassage | None:
    if not evidence_passages:
        return None
    terms = [term.lower() for term in (evidence_terms or []) if term.strip()]
    message_tokens = {token for token in _feedback_tokens(message)}
    for passage in evidence_passages:
        text = f"{passage.title} {passage.text}".lower()
        if terms and any(term in text for term in terms):
            return passage
        passage_tokens = set(_feedback_tokens(text))
        if len(message_tokens & passage_tokens) >= 2:
            return passage
    return None


def _workup_feedback_items(
    package: CasePackage,
    expected_orders: list[str],
    evidence_passages: list[EvidencePassage],
) -> list[WorkupFeedbackItem]:
    expected_order_ids = list(dict.fromkeys(expected_orders))
    ordered_by_id = {order.order_id: order for order in package.orders}
    items: list[WorkupFeedbackItem] = []

    for order in package.orders:
        if order.order_id in expected_order_ids and order.status == "resulted":
            category = "changed_management"
            message = (
                f"{order.display_name} changed management in this case because the clinician rubric expected it "
                "and the simulator released a source-recorded result."
            )
        elif order.order_id in expected_order_ids and order.status == "unavailable":
            category = "unavailable"
            message = (
                f"{order.display_name} was expected and ordered, but no source-recorded result was available; "
                "the simulator correctly avoided fabricating a value."
            )
        elif order.status == "unavailable":
            category = "low_yield"
            message = (
                f"{order.display_name} was low-yield for this case record: it was not an expected workup item "
                "and no source-recorded result was available."
            )
        else:
            continue

        items.append(
            _workup_feedback_item(
                order_id=order.order_id,
                display_name=order.display_name,
                category=category,
                message=message,
                status=order.status,
                elapsed_minutes=order.ordered_at_min,
                result_summary=_result_summary(order.result),
                evidence_passages=evidence_passages,
            )
        )

    for order_id in expected_order_ids:
        if order_id in ordered_by_id:
            continue
        display_name = _order_display_name(order_id)
        items.append(
            _workup_feedback_item(
                order_id=order_id,
                display_name=display_name,
                category="missed",
                message=f"{display_name} was missed; the clinician rubric expected it for this case.",
                status="not_ordered",
                elapsed_minutes=None,
                result_summary=None,
                evidence_passages=evidence_passages,
            )
        )

    return items


def _workup_feedback_item(
    *,
    order_id: str,
    display_name: str,
    category: Literal["changed_management", "missed", "low_yield", "unavailable"],
    message: str,
    status: str | None,
    elapsed_minutes: float | None,
    result_summary: str | None,
    evidence_passages: list[EvidencePassage],
) -> WorkupFeedbackItem:
    passage = _find_supporting_passage(message, evidence_passages, _order_evidence_terms(order_id, display_name))
    return WorkupFeedbackItem(
        order_id=order_id,
        display_name=display_name,
        category=category,
        message=message if passage else f"{message} No evidence found for this specific workup judgment.",
        grounded=bool(passage),
        evidence_id=passage.id if passage else None,
        evidence_note=f"Grounded in {passage.title}." if passage else "No evidence found for this specific workup judgment.",
        status=status,
        elapsed_minutes=elapsed_minutes,
        result_summary=result_summary,
    )


def _order_display_name(order_id: str) -> str:
    catalog_order = get_order(order_id)
    return catalog_order.name if catalog_order else order_id.replace("_", " ")


def _order_evidence_terms(order_id: str, display_name: str) -> list[str]:
    catalog_order = get_order(order_id)
    terms = [order_id.replace("_", " "), display_name]
    if catalog_order:
        terms.extend(catalog_order.aliases)
    return terms


def _result_summary(result) -> str | None:
    if result is None:
        return None
    if result.narrative:
        return result.narrative
    if result.values:
        return "; ".join(
            f"{value.name}: {value.value}{(' ' + value.unit) if value.unit else ''}"
            for value in result.values[:3]
        )
    return None


def _feedback_tokens(text: str) -> list[str]:
    return [
        token.strip(".,;:()[]{}").lower()
        for token in str(text).split()
        if len(token.strip(".,;:()[]{}")) > 3
    ]


def _grounded_teaching_points(package: CasePackage, evidence_passages: list[EvidencePassage]) -> list[TeachingPoint]:
    if not evidence_passages:
        return [TeachingPoint(claim="No evidence found for guideline-grounded teaching claims.", grounded=False)]

    points: list[TeachingPoint] = []
    diagnosis = package.hidden_truth.final_diagnosis.lower()
    for passage in evidence_passages:
        text = passage.text.lower()
        if diagnosis in text or "hypoxemia" in text or "emergency severity index" in text:
            points.append(
                TeachingPoint(
                    claim=f"Grounded teaching point available from {passage.title}.",
                    evidence_id=passage.id,
                    grounded=True,
                )
            )
    if not points:
        points.append(TeachingPoint(claim="No evidence found for guideline-grounded teaching claims.", grounded=False))
    return points[:3]
