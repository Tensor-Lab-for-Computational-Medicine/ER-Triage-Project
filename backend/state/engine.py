from __future__ import annotations

from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from backend.cases.schemas import PreparedCase, ResultBundle, VisibleSnapshot, VitalSigns
from backend.exams.catalog import ExamManeuver, get_maneuver
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


class ExamRecord(BaseModel):
    maneuver_id: str
    display_name: str
    region: str
    maneuver_type: str
    finding: str
    source: str
    performed_at_min: float


class InterventionRecord(BaseModel):
    intervention_id: str
    display_name: str
    applied_at_min: float
    effect_summary: str
    vitals_after: VitalSigns


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
    performed_exams: list[ExamRecord] = Field(default_factory=list)
    intervention_events: list[InterventionRecord] = Field(default_factory=list)
    esi_history: list[ESICommitment] = Field(default_factory=list)
    differential: list[str] = Field(default_factory=list)
    soap: SOAPNote = Field(default_factory=SOAPNote)
    completeness_flags: CompletenessFlags = Field(default_factory=CompletenessFlags)
    running_summary: str = ""
    transcript: list[TranscriptMessage] = Field(default_factory=list)
    ended: bool = False
    token_usage: list[TokenUsageRecord] = Field(default_factory=list)


class EncounterEngine:
    """Single source of truth for vitals and procedural state."""

    def __init__(self, case: PreparedCase, session_id: str | None = None):
        self.case = case
        self.state = CaseState(
            session_id=session_id or str(uuid4()),
            case_id=case.case_id,
            current_vitals=case.trajectory.starting_vitals.model_copy(deep=True),
            previous_vitals=case.trajectory.starting_vitals.model_copy(deep=True),
            running_summary=case.visible_start.triage_context,
        )
        self._refresh_completeness_flags()

    def advance(self, action_effect: str | None = None, dt: float = 1) -> CaseState:
        if dt < 0:
            raise ValueError("dt must be non-negative")
        if self.state.ended:
            return self.state

        self.state.previous_vitals = self.state.current_vitals.model_copy(deep=True)
        self.state.elapsed_minutes = round(self.state.elapsed_minutes + dt, 3)
        self._apply_trajectory(dt)
        self._release_due_orders()
        self._refresh_completeness_flags()
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

    def perform_exam(self, maneuver_id: str) -> ExamRecord:
        maneuver = get_maneuver(maneuver_id)
        if maneuver is None:
            raise ValueError(f"unknown exam maneuver: {maneuver_id}")

        finding, source = self._resolve_exam_finding(maneuver)
        record = ExamRecord(
            maneuver_id=maneuver.id,
            display_name=maneuver.name,
            region=maneuver.region,
            maneuver_type=maneuver.maneuver_type,
            finding=finding,
            source=source,
            performed_at_min=self.state.elapsed_minutes,
        )
        self.state.performed_exams.append(record)
        self._append(
            "exam",
            f"{maneuver.name}: {finding}",
            {
                "type": "exam_result",
                "exam_maneuver_id": maneuver.id,
                "region": maneuver.region,
                "maneuver_type": maneuver.maneuver_type,
                "source": source,
            },
        )
        self._refresh_completeness_flags()
        return record

    def apply_intervention(self, intervention_id: str) -> InterventionRecord:
        canonical = intervention_id.strip().lower().replace(" ", "_")
        order = get_order(canonical)
        if order is None:
            raise ValueError(f"unknown structured intervention: {canonical}")
        if order.type not in IMMEDIATE_ORDER_TYPES:
            raise ValueError(f"{canonical} is not a structured intervention, medication, or procedure.")
        if order.id not in self.state.active_orders:
            self.state.active_orders[order.id] = OrderRecord(
                order_id=order.id,
                display_name=order.name,
                order_type=order.type,
                status="resulted",
                ordered_at_min=self.state.elapsed_minutes,
                result_due_at_min=self.state.elapsed_minutes,
                result=_structured_action_result(order, self.state.elapsed_minutes),
            )
        return self._record_intervention(
            order,
            {"type": "intervention", "intervention_id": order.id},
            append_transcript=True,
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
            self._record_intervention(
                order,
                {"type": "intervention_from_order", "intervention_id": order.id, "order_id": order.id},
                append_transcript=False,
            )
        self._append("student", transcript_text, metadata)
        self._release_due_orders()
        self._refresh_completeness_flags()
        self._refresh_phase()
        return self.state.active_orders[order.id]

    def commit_esi(self, level: int, rationale: str = "") -> ESICommitment:
        commitment = ESICommitment(level=level, rationale=rationale, elapsed_minutes=self.state.elapsed_minutes)
        self.state.esi_history.append(commitment)
        self._refresh_completeness_flags()
        self._append("student", f"Committed ESI {level}. {rationale}".strip(), {"type": "esi_commit"})
        return commitment

    def commit_differential(self, diagnoses: list[str]) -> list[str]:
        cleaned = [item.strip() for item in diagnoses if item.strip()]
        if not cleaned:
            raise ValueError("At least one differential diagnosis is required.")
        self.state.differential = cleaned
        self._append("student", "Committed differential: " + "; ".join(self.state.differential), {"type": "differential_commit"})
        self._refresh_phase()
        return self.state.differential

    def commit_soap(self, soap: SOAPNote) -> SOAPNote:
        self.state.soap = soap
        self._refresh_completeness_flags()
        self._append("student", "Committed SOAP note.", {"type": "soap_commit", "soap": soap.model_dump(mode="json")})
        self._refresh_phase()
        return self.state.soap

    def can_complete(self) -> bool:
        self._refresh_completeness_flags()
        flags = self.state.completeness_flags
        return flags.assessment_committed and flags.plan_committed

    def complete_encounter(self) -> None:
        if not self.can_complete():
            raise ValueError("Assessment and Plan are required before completing the case.")
        flags = self.state.completeness_flags
        self._refresh_completeness_flags()
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
            performed_exams=[record.model_dump(mode="json") for record in self.state.performed_exams],
            intervention_events=[record.model_dump(mode="json") for record in self.state.intervention_events],
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
                record.result = _stamp_result_release_time(resolved.result, self.state.elapsed_minutes)
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

    def _record_intervention(
        self,
        order: CatalogOrder,
        metadata: dict[str, Any] | None = None,
        append_transcript: bool = True,
    ) -> InterventionRecord:
        already_active = order.id in self.state.interventions
        effect_summary = self._apply_intervention_effect(order.id, already_active=already_active)
        record = InterventionRecord(
            intervention_id=order.id,
            display_name=order.name,
            applied_at_min=self.state.elapsed_minutes,
            effect_summary=effect_summary,
            vitals_after=self.state.current_vitals.model_copy(deep=True),
        )
        self.state.intervention_events.append(record)
        if append_transcript:
            self._append(
                "nurse",
                _intervention_confirmation(order.id, order.name, already_active),
                metadata or {"type": "intervention", "intervention_id": order.id},
            )
        self._refresh_completeness_flags()
        self._refresh_phase()
        return record

    def _apply_intervention_effect(self, canonical: str, already_active: bool = False) -> str:
        if canonical and canonical not in self.state.interventions:
            self.state.interventions.append(canonical)
        if already_active:
            return f"{canonical.replace('_', ' ')} was already active; no additional vital-sign change applied."
        if canonical == "oxygen" and self.state.current_vitals.spo2 < 94:
            self.state.current_vitals.spo2 = 94
            return "SpO2 increased immediately toward the authored oxygen recovery trajectory."
        if canonical == "analgesia" and self.state.current_vitals.pain is not None:
            self.state.current_vitals.pain = max(0, self.state.current_vitals.pain - 1)
            return "Pain score decreased immediately and will continue along the authored analgesia response."
        if canonical == "iv_fluids" and self.state.current_vitals.sbp < 110:
            self.state.current_vitals.sbp = min(115, self.state.current_vitals.sbp + 5)
            return "Systolic blood pressure increased immediately toward the authored fluid response."
        if canonical == "cardiac_monitor":
            return "Continuous monitoring is active; diagnostic results are not generated by this intervention."
        if canonical == "continuous_pulse_ox":
            return "Continuous pulse oximetry is active; oxygenation remains governed by the trajectory."
        if canonical == "iv_access":
            return "IV access is established for medications, fluids, and contrast if ordered."
        return f"{canonical.replace('_', ' ')} recorded; deterministic state updated without a source-result reveal."

    def _resolve_exam_finding(self, maneuver: ExamManeuver) -> tuple[str, str]:
        if maneuver.id == "general_inspection_appearance":
            return self._appearance(), "live-state"
        for fact in self.case.exam_facts:
            if (fact.maneuver_id or fact.id) == maneuver.id:
                if self._is_generic_exam_finding(fact.finding):
                    break
                return fact.finding, fact.source
        return self._default_exam_finding(maneuver), "simulator-default-exam"

    def _refresh_completeness_flags(self) -> None:
        flags = self.state.completeness_flags
        flags.esi_committed = bool(self.state.esi_history)
        flags.assessment_committed = bool(self.state.soap.assessment.strip())
        flags.plan_committed = bool(self.state.soap.plan.strip())
        flags.abcde_addressed = self._abcde_addressed()

    def _abcde_addressed(self) -> bool:
        required_interventions = {"oxygen", "cardiac_monitor", "iv_access"}
        return required_interventions.issubset(self.state.interventions) or self.state.current_vitals.spo2 >= 94

    def _appearance(self) -> str:
        if self.state.current_vitals.spo2 < 90:
            return "Worsening dyspnea with visible respiratory distress."
        if "oxygen" in self.state.interventions and self.state.current_vitals.spo2 >= 94:
            return "Breathing more comfortably on oxygen."
        if "analgesia" in self.state.interventions and self.state.current_vitals.pain is not None and self.state.current_vitals.pain <= 4:
            return "More comfortable after analgesia, still requiring focused reassessment."
        return self.case.visible_start.appearance

    def _is_generic_exam_finding(self, finding: str) -> bool:
        text = " ".join(str(finding or "").lower().split())
        generic_fragments = (
            "not assessed",
            "no abnormality documented",
            "source record",
            "source-record",
            "source-recorded",
            "does not include",
            "not documented",
            "no documentation",
            "no detailed",
        )
        return not text or any(fragment in text for fragment in generic_fragments)

    def _default_exam_finding(self, maneuver: ExamManeuver) -> str:
        text = " ".join(
            [
                self.case.visible_start.chief_complaint,
                self.case.visible_start.triage_context,
                self.case.visible_start.appearance,
            ]
        ).lower()
        abdominal = any(term in text for term in ("abd", "belly", "distention", "distended", "bowel", "vomit"))
        chest = any(term in text for term in ("chest", "shortness of breath", "dyspnea", "breath", "spo2", "hypox"))
        tachycardic = self.state.current_vitals.hr >= 100
        tachypneic = self.state.current_vitals.rr >= 22 or self.state.current_vitals.spo2 < 94

        defaults = {
            "general_inspection_skin_color": "Skin inspected over face, lips, hands, and exposed extremities: no cyanosis, mottling, or marked pallor seen.",
            "general_palpation_temperature": "Skin palpated over forehead and distal extremities: warm and dry, without marked coolness or clamminess.",
            "general_special_mental_status": "Brief mental status assessed: awake, attentive to the encounter, and able to follow simple commands.",
            "abdomen_inspection_scars": "Abdominal skin inspected: no ecchymosis, erythema, open wound, or acute surgical-site change seen.",
            "abdomen_auscultation_bruits": "Auscultated over the epigastrium, periumbilical area, and flanks: no abdominal bruit heard.",
            "abdomen_percussion_cva_tenderness": "Percussion over both costovertebral angles: no right or left CVA tenderness elicited.",
            "abdomen_palpation_guarding": "Guarding assessed with gentle palpation: no involuntary guarding or board-like rigidity appreciated.",
            "abdomen_palpation_rebound": "Rebound tenderness checked gently: no clear rebound pain elicited.",
            "abdomen_special_murphy": "Murphy sign assessed with right upper quadrant palpation during inspiration: negative, without inspiratory arrest.",
            "abdomen_special_rosving": "Rovsing sign assessed with left lower quadrant pressure: negative, without referred right lower quadrant pain.",
            "abdomen_special_psoas": "Psoas sign assessed with hip extension/resisted flexion: negative, without focal right lower quadrant pain.",
            "abdomen_special_obturator": "Obturator sign assessed with hip flexion and internal rotation: negative, without focal pelvic or right lower quadrant pain.",
            "cardiovascular_inspection_jvp": "Neck veins inspected with the head of bed elevated: no obvious jugular venous distention.",
            "cardiovascular_palpation_pulses": "Radial pulses palpated bilaterally: symmetric and palpable; distal extremities are warm.",
            "cardiovascular_palpation_precordium": "Precordium palpated: no heave, lift, or palpable thrill appreciated.",
            "cardiovascular_percussion_cardiac_dullness": "Precordial percussion performed: no clinically obvious expansion of cardiac dullness at bedside.",
            "cardiovascular_special_orthostatics": "Orthostatic screen not suggestive of immediate positional intolerance during this brief bedside assessment.",
            "respiratory_palpation_chest_wall": "Chest wall palpated over the area of reported discomfort and adjacent ribs: no focal crepitus or deformity.",
            "respiratory_palpation_tactile_fremitus": "Tactile fremitus assessed over symmetric posterior lung fields: no focal asymmetry appreciated.",
            "respiratory_percussion_lung_fields": "Lung fields percussed bilaterally: no focal dullness to percussion appreciated.",
            "respiratory_special_egophony": "Egophony assessed over posterior lung fields: no focal E-to-A change heard.",
            "neurologic_inspection_speech": "Speech and face inspected during conversation: speech is clear and facial movement appears symmetric.",
            "neurologic_palpation_spine": "Spine palpated along the midline: no focal midline step-off or point tenderness appreciated.",
            "neurologic_auscultation_carotids": "Carotids auscultated bilaterally: no carotid bruit heard.",
            "neurologic_percussion_reflexes": "Patellar reflexes checked bilaterally: present and grossly symmetric.",
            "neurologic_special_pronator_drift": "Pronator drift assessed with arms extended: no drift observed.",
            "skin_inspection_rash": "Exposed skin inspected: no diffuse rash, petechiae, vesicles, or cellulitic change seen.",
            "skin_palpation_turgor": "Skin turgor assessed at the hand/forearm: no marked tenting.",
            "skin_auscultation_bruit_over_lesion": "No vascular skin lesion is apparent on inspection; no bruit heard over exposed abnormal skin.",
            "skin_percussion_tender_area": "Tender skin areas tapped/percussed where exposed: no focal percussion tenderness.",
            "skin_special_nikolsky": "Nikolsky sign assessed on intact exposed skin: negative, without epidermal sloughing.",
            "extremities_inspection_edema": "Extremities inspected for swelling and symmetry: no unilateral leg swelling or marked edema seen.",
            "extremities_palpation_calf": "Calves palpated bilaterally: soft and symmetric without focal calf tenderness.",
            "extremities_auscultation_bruit": "Peripheral vascular auscultation over accessible femoral areas: no bruit heard.",
            "extremities_percussion_bony_tenderness": "Bony areas percussed where clinically exposed: no focal bony percussion tenderness.",
            "extremities_special_homan": "Homan sign assessed gently: no calf pain with passive ankle dorsiflexion.",
        }
        if maneuver.id == "abdomen_inspection_distention":
            return "Abdomen inspected from bedside: visibly distended." if abdominal else "Abdomen inspected from bedside: flat to mildly rounded, without visible distention."
        if maneuver.id == "abdomen_auscultation_bowel_sounds":
            return "Auscultated in all four quadrants: bowel sounds are present but decreased." if abdominal else "Auscultated in all four quadrants: bowel sounds present without high-pitched rushes."
        if maneuver.id == "abdomen_percussion_tympany":
            return "Percussion across the abdomen: tympany predominates over the distended central abdomen." if abdominal else "Percussion across the abdomen: no focal percussion tenderness or marked tympany."
        if maneuver.id == "abdomen_palpation_light":
            return "Light palpation performed in all quadrants: diffuse tenderness over the distended abdomen, greatest in the lower abdomen; no involuntary guarding on light touch." if abdominal else "Light palpation performed in all quadrants: abdomen soft and non-tender, without guarding."
        if maneuver.id == "abdomen_palpation_deep":
            return "Deep palpation performed only where tolerated: diffuse tenderness persists; no discrete palpable mass appreciated." if abdominal else "Deep palpation performed in all quadrants: no focal deep tenderness or palpable mass appreciated."
        if maneuver.id == "cardiovascular_auscultation_heart_sounds":
            rhythm = "tachycardic" if tachycardic else "regular rate"
            return f"Heart auscultated at standard listening posts: {rhythm} with regular rhythm; no obvious murmur, rub, or gallop heard."
        if maneuver.id == "respiratory_inspection_work_of_breathing":
            return "Respirations observed at bedside: tachypneic with mildly increased work of breathing." if tachypneic else "Respirations observed at bedside: unlabored, without accessory muscle use."
        if maneuver.id == "respiratory_auscultation_breath_sounds":
            return "Auscultated anterior and posterior lung fields: breath sounds present bilaterally, without focal wheeze or crackles." if chest or tachypneic else "Auscultated anterior and posterior lung fields: clear breath sounds bilaterally."
        return defaults.get(
            maneuver.id,
            f"{maneuver.name} performed: no acute abnormality appreciated on this focused bedside assessment.",
        )


def start_case(case: PreparedCase, session_id: str | None = None) -> EncounterEngine:
    return EncounterEngine(case=case, session_id=session_id)


def _compact_summary(current: str, addition: str, max_chars: int = 700) -> str:
    merged = " ".join(part.strip() for part in [current, addition] if part and part.strip())
    return merged[-max_chars:]


def _format_result(record: OrderRecord) -> str:
    if not record.result:
        return f"{record.display_name}: resulted."
    if _is_default_ecg_result(record):
        return f"{record.display_name} resulted. ECG tracing is available in the result viewer."
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


def _is_default_ecg_result(record: OrderRecord) -> bool:
    display_name = record.display_name.lower()
    return bool(
        record.result
        and record.result.source == "simulator-default"
        and ("ecg" in display_name or "ekg" in display_name or "12-lead" in display_name)
    )


def _structured_action_result(order: CatalogOrder, elapsed_minutes: float) -> ResultBundle:
    return ResultBundle(
        order_id=order.id,
        display_name=order.name,
        resulted_at_min=int(round(elapsed_minutes)),
        narrative=f"{order.name} recorded as a structured {order.type}; no diagnostic value is expected.",
        source="simulator",
    )


def _intervention_confirmation(intervention_id: str, display_name: str, already_active: bool) -> str:
    if already_active:
        return f"{display_name} already active."
    if intervention_id == "oxygen":
        return "O2 started, 2 L nasal cannula."
    if intervention_id == "cardiac_monitor":
        return "Cardiac monitor started."
    if intervention_id == "continuous_pulse_ox":
        return "Continuous pulse oximetry started."
    if intervention_id == "iv_access":
        return "IV access established."
    if intervention_id == "iv_fluids":
        return "IV crystalloid bolus started."
    if intervention_id == "analgesia":
        return "Analgesia given."
    return f"{display_name} completed."


def _stamp_result_release_time(result: ResultBundle | None, elapsed_minutes: float) -> ResultBundle | None:
    if result is None:
        return None
    return result.model_copy(update={"resulted_at_min": int(round(elapsed_minutes))}, deep=True)
