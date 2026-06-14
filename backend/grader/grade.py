from __future__ import annotations

from pydantic import BaseModel, Field

from backend.grader.package import CasePackage
from backend.llm.client import LLMClient, LLMMessage, LLMResult


class EvidencePassage(BaseModel):
    id: str
    title: str
    text: str
    url: str | None = None


class ClinicianRubric(BaseModel):
    expected_diagnoses: list[str] = Field(default_factory=list)
    expected_orders: list[str] = Field(default_factory=list)
    critical_actions: list[str] = Field(default_factory=list)
    esi_tolerance: int = 0


class TeachingPoint(BaseModel):
    claim: str
    evidence_id: str | None = None
    grounded: bool


class GraderFeedback(BaseModel):
    diagnostic_accuracy: dict
    acuity: dict
    completeness: dict
    workup_judgment: dict
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
    expected = [truth.final_diagnosis, *rubric.expected_diagnoses]
    matched_diagnoses = [diagnosis for diagnosis in expected if diagnosis.lower() in diagnosis_text]

    last_esi = package.esi_history[-1].level if package.esi_history else None
    esi_delta = abs(last_esi - truth.validated_esi) if last_esi else None
    ordered_ids = [order.order_id for order in package.orders]
    missed_orders = [order_id for order_id in rubric.expected_orders if order_id not in ordered_ids]
    low_yield = [
        order.order_id
        for order in package.orders
        if order.status == "unavailable" and order.order_id not in rubric.expected_orders
    ]

    teaching_points = _grounded_teaching_points(package, evidence_passages)

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
        },
        workup_judgment={
            "ordered": ordered_ids,
            "missed": missed_orders,
            "low_yield_or_unavailable": low_yield,
            "unordered_source_results": list(package.unordered_results),
        },
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
