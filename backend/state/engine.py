from __future__ import annotations

from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from backend.cases.schemas import PreparedCase, ResultBundle, VisibleSnapshot, VitalSigns
from backend.orders.catalog import CatalogOrder, get_order
from backend.orders.resolver import resolve


IMMEDIATE_ORDER_TYPES = {"intervention", "medication", "procedure"}


class EncounterPhase(str, Enum):
    TRIAGE = "triage"
    WORKUP = "workup"
    DISPOSITION = "disposition"
    COMPLETE = "complete"


class OrderRecord(BaseModel):
    order_id: str
    display_name: str
    order_type: str
    status: Literal["ordered", "resulting", "resulted", "unavailable"]
    ordered_at_min: float
    result_due_at_min: float
    result: ResultBundle | None = None
    unavailable_reason: str | None = None


class ESICommitment(BaseModel):
    level: int = Field(ge=1, le=5)
    rationale: str = ""
    elapsed_minutes: float


class SOAPNote(BaseModel):
    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""


class CompletenessFlags(BaseModel):
    abcde_addressed: bool = False
    esi_committed: bool = False
    assessment_committed: bool = False
    plan_committed: bool = False
    end_encounter: bool = False
    omissions: list[str] = Field(default_factory=list)


class TranscriptMessage(BaseModel):
    speaker: str
    text: str
    elapsed_minutes: float
    metadata: dict[str, Any] = Field(default_factory=dict)


class TokenUsageRecord(BaseModel):
    tier: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    estimated_cost_usd: float
    purpose: str


class CaseState(BaseModel):
    session_id: str
    case_id: str
    current_vitals: VitalSigns
    previous_vitals: VitalSigns
    elapsed_minutes: float = 0
    phase: EncounterPhase = EncounterPhase.TRIAGE
    active_orders: dict[str, OrderRecord] = Field(default_factory=dict)
    interventions: list[str] = Field(default_factory=list)
    esi_history: list[ESICommitment] = Field(default_factory=list)
    differential: list[str] = Field(default_factory=list)
    soap: SOAPNote = Field(default_factory=SOAPNote)
    completeness_flags: CompletenessFlags = Field(default_factory=CompletenessFlags)
    running_summary: str = ""
    transcript: list[TranscriptMessage] = Field(default_factory=list)
    ended: bool = False
    token_usage: list[TokenUsageRecord] = Field(default_factory=list)


class EncounterEngine:
    """Single source of truth for physiologic and procedural state."""

    def __init__(self, case: PreparedCase, session_id: str | None = None):
        self.case = case
        self.state = CaseState(
            session_id=session_id or str(uuid4()),
            case_id=case.case_id,
            current_vitals=case.trajectory.starting_vitals.model_copy(deep=True),
            previous_vitals=case.trajectory.starting_vitals.model_copy(deep=True),
            running_summary=case.visible_start.triage_context,
        )

    def advance(self, action_effect: str | None = None, dt: float = 1) -> CaseState:
        if dt < 0:
            raise ValueError("dt must be non-negative")
        if self.state.ended:
            return self.state

        self.state.previous_vitals = self.state.current_vitals.model_copy(deep=True)
        self.state.elapsed_minutes = round(self.state.elapsed_minutes + dt, 3)
        self._apply_trajectory(dt)
        self._release_due_orders()
        self._refresh_phase()
        return self.state

    def apply_order(self, order_id: str) -> OrderRecord:
        order = get_order(order_id)
        if order is None:
            raise ValueError(f"unknown order: {order_id}")
        return self._apply_catalog_order(
            order,
            f"Ordered {order.name}.",
            {"type": "order", "order_id": order.id},
        )

    def apply_intervention(self, intervention_id: str) -> OrderRecord:
        canonical = intervention_id.strip().lower().replace(" ", "_")
        order = get_order(canonical)
        if order is None:
            raise ValueError(f"unknown structured intervention: {canonical}")
        if order.type not in IMMEDIATE_ORDER_TYPES:
            raise ValueError(f"{canonical} is not a structured intervention, medication, or procedure.")
        return self._apply_catalog_order(
            order,
            f"Applied intervention: {order.id.replace('_', ' ')}.",
            {"type": "intervention", "intervention_id": order.id},
        )

    def _apply_catalog_order(self, order: CatalogOrder, transcript_text: str, metadata: dict[str, Any]) -> OrderRecord:
        if order.id in self.state.active_orders:
            return self.state.active_orders[order.id]

        immediate = order.type in IMMEDIATE_ORDER_TYPES
        record = OrderRecord(
            order_id=order.id,
            display_name=order.name,
            order_type=order.type,
            status="resulted" if immediate else "ordered",
            ordered_at_min=self.state.elapsed_minutes,
            result_due_at_min=self.state.elapsed_minutes if immediate else self.state.elapsed_minutes + order.result_delay_min,
            result=_structured_action_result(order, self.state.elapsed_minutes) if immediate else None,
        )
        self.state.active_orders[order.id] = record
        if immediate:
            self._apply_intervention_effect(order.id)
        self._append("student", transcript_text, metadata)
        self._release_due_orders()
        self._refresh_phase()
        return self.state.active_orders[order.id]

    def commit_esi(self, level: int, rationale: str = "") -> ESICommitment:
        commitment = ESICommitment(level=level, rationale=rationale, elapsed_minutes=self.state.elapsed_minutes)
        self.state.esi_history.append(commitment)
        self.state.completeness_flags.esi_committed = True
        self._append("student", f"Committed ESI {level}. {rationale}".strip(), {"type": "esi_commit"})
        return commitment

    def commit_differential(self, diagnoses: list[str]) -> list[str]:
        self.state.differential = [item.strip() for item in diagnoses if item.strip()]
        self._append("student", "Committed differential: " + "; ".join(self.state.differential), {"type": "differential_commit"})
        self._refresh_phase()
        return self.state.differential

    def commit_soap(self, soap: SOAPNote) -> SOAPNote:
        self.state.soap = soap
        self.state.completeness_flags.assessment_committed = bool(soap.assessment.strip())
        self.state.completeness_flags.plan_committed = bool(soap.plan.strip())
        self._append("student", "Committed SOAP note.", {"type": "soap_commit", "soap": soap.model_dump(mode="json")})
        self._refresh_phase()
        return self.state.soap

    def can_complete(self) -> bool:
        flags = self.state.completeness_flags
        return flags.assessment_committed and flags.plan_committed

    def complete_encounter(self) -> None:
        if not self.can_complete():
            raise ValueError("Assessment and Plan are required before completing the case.")
        flags = self.state.completeness_flags
        flags.abcde_addressed = all(item in self.state.interventions for item in ["oxygen", "cardiac_monitor", "iv_access"]) or self.state.current_vitals.spo2 >= 94
        flags.end_encounter = True
        flags.omissions = []
        if not flags.esi_committed:
            flags.omissions.append("ESI was never committed.")
        if not flags.abcde_addressed:
            flags.omissions.append("ABCDE stabilization was incomplete before disposition.")
        self.state.ended = True
        self.state.phase = EncounterPhase.COMPLETE
        self._append("system", "Encounter completed.", {"type": "complete"})

    def visible_snapshot(self) -> VisibleSnapshot:
        resulted = [
            record.result
            for record in self.state.active_orders.values()
            if record.status == "resulted" and record.result is not None
        ]
        return VisibleSnapshot(
            case_id=self.case.case_id,
            title=self.case.title,
            elapsed_minutes=self.state.elapsed_minutes,
            phase=self.state.phase.value,
            current_vitals=self.state.current_vitals,
            visible_start=self.case.visible_start,
            appearance=self._appearance(),
            active_orders=[record.model_dump(mode="json") for record in self.state.active_orders.values()],
            resulted_orders=resulted,
            interventions=list(self.state.interventions),
            running_summary=self.state.running_summary,
        )

    def record_usage(self, usage: TokenUsageRecord) -> None:
        self.state.token_usage.append(usage)

    def _apply_trajectory(self, dt: float) -> None:
        if dt == 0:
            return
        vitals = self.state.current_vitals
        interventions = set(self.state.interventions)
        for rule in self.case.trajectory.rules:
            value = getattr(vitals, rule.vital)
            if value is None:
                continue
            condition = rule.condition
            if condition.below is not None and not value < condition.below:
                continue
            if condition.above is not None and not value > condition.above:
                continue
            if condition.absent_intervention and condition.absent_intervention in interventions:
                continue
            if condition.present_intervention and condition.present_intervention not in interventions:
                continue

            next_value = value + rule.delta_per_minute * dt
            if rule.floor is not None:
                next_value = max(rule.floor, next_value)
            if rule.ceiling is not None:
                next_value = min(rule.ceiling, next_value)
            if rule.vital in {"hr", "sbp", "dbp", "rr", "spo2", "pain"}:
                next_value = int(round(next_value))
            setattr(vitals, rule.vital, next_value)

    def _release_due_orders(self) -> None:
        for record in self.state.active_orders.values():
            if record.status in {"resulted", "unavailable"}:
                continue
            if self.state.elapsed_minutes < record.result_due_at_min:
                if self.state.elapsed_minutes > record.ordered_at_min:
                    record.status = "resulting"
                continue

            resolved = resolve(record.order_id, self.case, self.state)
            if resolved.status == "resulted":
                record.status = "resulted"
                record.result = resolved.result
                self._append("results", _format_result(record), {"type": "result", "order_id": record.order_id})
            else:
                record.status = "unavailable"
                record.unavailable_reason = resolved.unavailable_reason
                self._append("results", f"{record.display_name}: {record.unavailable_reason}", {"type": "result_unavailable", "order_id": record.order_id})

    def _refresh_phase(self) -> None:
        if self.state.ended:
            self.state.phase = EncounterPhase.COMPLETE
        elif self.state.soap.assessment.strip() or self.state.soap.plan.strip():
            self.state.phase = EncounterPhase.DISPOSITION
        elif self.state.active_orders or self.state.differential or self.state.elapsed_minutes >= 5:
            self.state.phase = EncounterPhase.WORKUP
        else:
            self.state.phase = EncounterPhase.TRIAGE

    def _append(self, speaker: str, text: str, metadata: dict[str, Any] | None = None) -> None:
        self.state.transcript.append(
            TranscriptMessage(
                speaker=speaker,
                text=text.strip(),
                elapsed_minutes=self.state.elapsed_minutes,
                metadata=metadata or {},
            )
        )
        if speaker in {"student", "patient", "nurse", "consultant"} and text.strip():
            self.state.running_summary = _compact_summary(self.state.running_summary, text)

    def _apply_intervention_effect(self, canonical: str) -> None:
        if canonical and canonical not in self.state.interventions:
            self.state.interventions.append(canonical)
        if canonical == "oxygen" and self.state.current_vitals.spo2 < 94:
            self.state.current_vitals.spo2 = 94
        if canonical == "analgesia" and self.state.current_vitals.pain is not None:
            self.state.current_vitals.pain = max(0, self.state.current_vitals.pain - 1)

    def _appearance(self) -> str:
        if self.state.current_vitals.spo2 < 90:
            return "Worsening dyspnea with visible respiratory distress."
        if "oxygen" in self.state.interventions and self.state.current_vitals.spo2 >= 94:
            return "Breathing more comfortably on oxygen."
        return self.case.visible_start.appearance


def start_case(case: PreparedCase, session_id: str | None = None) -> EncounterEngine:
    return EncounterEngine(case=case, session_id=session_id)


def _compact_summary(current: str, addition: str, max_chars: int = 700) -> str:
    merged = " ".join(part.strip() for part in [current, addition] if part and part.strip())
    return merged[-max_chars:]


def _format_result(record: OrderRecord) -> str:
    if not record.result:
        return f"{record.display_name}: resulted."
    lines = [f"{record.display_name} resulted."]
    if record.result.values:
        values = []
        for item in record.result.values:
            value = item.value if item.unit is None else f"{item.value} {item.unit}"
            flag = f" ({item.flag})" if item.flag else ""
            values.append(f"{item.name}: {value}{flag}")
        lines.append("; ".join(values))
    if record.result.narrative:
        lines.append(record.result.narrative)
    return " ".join(lines)


def _structured_action_result(order: CatalogOrder, elapsed_minutes: float) -> ResultBundle:
    return ResultBundle(
        order_id=order.id,
        display_name=order.name,
        resulted_at_min=int(round(elapsed_minutes)),
        narrative=f"{order.name} recorded as a structured {order.type}; no diagnostic value is expected.",
        source="simulator",
    )
