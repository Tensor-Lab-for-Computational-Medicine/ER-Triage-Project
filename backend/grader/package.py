from __future__ import annotations

from pydantic import BaseModel, Field

from backend.cases.schemas import CaseRubric, EvidencePassageSpec, HiddenTruth, ResultBundle, TimelineEvent
from backend.grader.context import grader_context
from backend.state.engine import CaseState, ESICommitment, ExamRecord, InterventionRecord, OrderRecord, SOAPNote, TranscriptMessage


class CasePackage(BaseModel):
    session_id: str
    case_id: str
    transcript: list[TranscriptMessage]
    orders: list[OrderRecord]
    exams: list[ExamRecord] = Field(default_factory=list)
    interventions: list[InterventionRecord] = Field(default_factory=list)
    unordered_results: dict[str, ResultBundle] = Field(default_factory=dict)
    esi_history: list[ESICommitment]
    differential: list[str]
    soap: SOAPNote
    completeness_flags: dict
    hidden_truth: HiddenTruth
    real_timeline: list[TimelineEvent]
    rubric: CaseRubric = Field(default_factory=CaseRubric)
    evidence_corpus: list[EvidencePassageSpec] = Field(default_factory=list)
    token_usage: list[dict] = Field(default_factory=list)


def assemble_case_package(case, state: CaseState) -> CasePackage:
    if not state.ended:
        raise ValueError("CasePackage can only be assembled after end_encounter.")

    context = grader_context(case, state)
    unordered_results = {
        order_id: ResultBundle.model_validate(bundle)
        for order_id, bundle in context["unordered_results"].items()
    }
    return CasePackage(
        session_id=state.session_id,
        case_id=state.case_id,
        transcript=list(state.transcript),
        orders=list(state.active_orders.values()),
        exams=list(state.performed_exams),
        interventions=list(state.intervention_events),
        unordered_results=unordered_results,
        esi_history=list(state.esi_history),
        differential=list(state.differential),
        soap=state.soap,
        completeness_flags=state.completeness_flags.model_dump(mode="json"),
        hidden_truth=HiddenTruth.model_validate(context["hidden_truth"]),
        real_timeline=[TimelineEvent.model_validate(item) for item in context["real_timeline"]],
        rubric=case.rubric,
        evidence_corpus=list(case.evidence_corpus),
        token_usage=[item.model_dump(mode="json") for item in state.token_usage],
    )
