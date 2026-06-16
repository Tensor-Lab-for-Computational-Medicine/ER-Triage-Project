from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class VitalSigns(BaseModel):
    temp_c: float | None = None
    hr: int
    sbp: int
    dbp: int
    rr: int
    spo2: int = Field(ge=0, le=100)
    pain: int | None = Field(default=None, ge=0, le=10)


class VisibleStart(BaseModel):
    chief_complaint: str
    demographics: dict[str, Any]
    presenting_vitals: VitalSigns
    triage_context: str
    appearance: str


class HpiFact(BaseModel):
    id: str
    topic: str
    triggers: list[str] = Field(default_factory=list)
    lay_response: str
    clinician_note: str


class ExamFact(BaseModel):
    id: str
    maneuver_id: str | None = None
    system: str
    triggers: list[str] = Field(default_factory=list)
    finding: str
    source: str = "source-record"


class ResultValue(BaseModel):
    name: str
    value: str
    unit: str | None = None
    flag: Literal["low", "normal", "high", "critical", "abnormal"] | None = None
    reference_range: str | None = None


class ResultBundle(BaseModel):
    order_id: str
    display_name: str
    resulted_at_min: int | None = None
    values: list[ResultValue] = Field(default_factory=list)
    narrative: str | None = None
    source: str = "mimic"
    source_reference: dict[str, Any] = Field(default_factory=dict)


class HiddenTruth(BaseModel):
    final_diagnosis: str
    validated_esi: int = Field(ge=1, le=5)
    actual_disposition: str
    clinician_key_points: list[str] = Field(default_factory=list)


class EvidencePassageSpec(BaseModel):
    id: str
    title: str
    text: str
    url: str | None = None


class RubricAction(BaseModel):
    id: str
    label: str = ""
    why: str = ""
    early_minutes: float | None = None
    evidence_terms: list[str] = Field(default_factory=list)


class CaseRubric(BaseModel):
    expected_diagnoses: list[str] = Field(default_factory=list)
    expected_orders: list[str] = Field(default_factory=list)
    indicated_exams: list[RubricAction] = Field(default_factory=list)
    indicated_interventions: list[RubricAction] = Field(default_factory=list)
    excessive_interventions: list[RubricAction] = Field(default_factory=list)
    critical_actions: list[str] = Field(default_factory=list)
    esi_tolerance: int = 0


class TrajectoryCondition(BaseModel):
    below: float | None = None
    above: float | None = None
    absent_intervention: str | None = None
    present_intervention: str | None = None


class TrajectoryRule(BaseModel):
    id: str
    vital: Literal["temp_c", "hr", "sbp", "dbp", "rr", "spo2", "pain"]
    condition: TrajectoryCondition
    delta_per_minute: float
    floor: float | None = None
    ceiling: float | None = None


class TrajectorySpec(BaseModel):
    starting_vitals: VitalSigns
    rules: list[TrajectoryRule] = Field(default_factory=list)
    excluded_reason: str | None = None


class CaseReviewStatus(BaseModel):
    trajectory_clinician_signed_off: bool = False
    grader_clinician_validated: bool = False
    playthrough_clinician_signed_off: bool = False
    trajectory_review: dict[str, Any] = Field(default_factory=dict)
    grader_validation_review: dict[str, Any] = Field(default_factory=dict)
    playthrough_review: dict[str, Any] = Field(default_factory=dict)
    notes: list[str] = Field(default_factory=list)


class SourceEvidenceAudit(BaseModel):
    source_identifiers: dict[str, Any] = Field(default_factory=dict)
    result_bundle_ids: list[str] = Field(default_factory=list)
    documented_order_signals: list[str] = Field(default_factory=list)
    documented_orders_without_results: list[str] = Field(default_factory=list)
    documented_order_details: list[dict[str, Any]] = Field(default_factory=list)


class TimelineEvent(BaseModel):
    elapsed_min: int
    label: str
    detail: str


class PreparedCase(BaseModel):
    case_id: str
    title: str
    visible_start: VisibleStart
    hpi_facts: list[HpiFact] = Field(default_factory=list)
    exam_facts: list[ExamFact] = Field(default_factory=list)
    result_bundles: dict[str, ResultBundle] = Field(default_factory=dict)
    hidden_truth: HiddenTruth
    trajectory: TrajectorySpec
    real_timeline: list[TimelineEvent] = Field(default_factory=list)
    rubric: CaseRubric = Field(default_factory=CaseRubric)
    evidence_corpus: list[EvidencePassageSpec] = Field(default_factory=list)
    source: str = "local-prepared"
    review_status: CaseReviewStatus = Field(default_factory=CaseReviewStatus)
    source_evidence_audit: SourceEvidenceAudit = Field(default_factory=SourceEvidenceAudit)


class VisibleSnapshot(BaseModel):
    case_id: str
    title: str
    elapsed_minutes: float
    phase: str
    current_vitals: VitalSigns
    visible_start: VisibleStart
    appearance: str
    active_orders: list[dict[str, Any]] = Field(default_factory=list)
    resulted_orders: list[ResultBundle] = Field(default_factory=list)
    interventions: list[str] = Field(default_factory=list)
    performed_exams: list[dict[str, Any]] = Field(default_factory=list)
    intervention_events: list[dict[str, Any]] = Field(default_factory=list)
    running_summary: str = ""
