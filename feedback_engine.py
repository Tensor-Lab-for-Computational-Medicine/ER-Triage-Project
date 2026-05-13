"""
Feedback Engine for ER Triage Simulation
Provides comprehensive feedback comparing user decisions with ground truth
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from data_loader import Case
from simulation_engine import SimulationEngine
from triage_classification import TriageClassifier, TriageDecision
import json
from datetime import datetime


@dataclass
class SimulationSession:
    """Complete simulation session data"""
    case_id: str
    user_triage_level: int
    ground_truth_level: int
    interventions_performed: List[str]
    patient_final_state: str
    critical_interventions_missed: List[str]
    user_actions: List[Dict]
    simulation_actions: List[Dict]
    correct_triage: bool
    session_timestamp: str
    checked_vitals: List[Dict] = None
    chief_complaint_question: Optional[str] = None
    medical_history_question: Optional[str] = None
    triage_rationale: Optional[str] = None


class FeedbackEngine:
    """Generates comprehensive feedback for simulation sessions"""
    
    def __init__(self):
        """Initialize the feedback engine"""
        self.triage_classifier = TriageClassifier()
        self.session_history: List[SimulationSession] = []
    
    def create_session_record(self, case: Case, simulation: SimulationEngine, 
                            user_triage_level: int, user_actions: List[Dict],
                            checked_vitals: List[Dict] = None) -> SimulationSession:
        """Create a complete session record"""
        summary = simulation.get_simulation_summary()
        
        return SimulationSession(
            case_id=case.id,
            user_triage_level=user_triage_level,
            ground_truth_level=case.acuity,
            interventions_performed=summary['interventions_performed'],
            patient_final_state=summary['final_state'],
            critical_interventions_missed=summary['critical_interventions_missed'],
            user_actions=user_actions,
            checked_vitals=checked_vitals if checked_vitals else [],
            simulation_actions=simulation.get_action_history(),
            correct_triage=user_triage_level == case.acuity,
            session_timestamp=datetime.now().isoformat()
        )
    
    def generate_comprehensive_feedback(self, session: SimulationSession, 
                                      case: Case, simulation: SimulationEngine) -> Dict:
        """Generate comprehensive feedback for a simulation session"""
        
        # Session summary with user actions
        session_summary = self._generate_session_summary(session, case)
        
        # Triage analysis with outcome data
        triage_analysis = self._generate_triage_analysis(session, case)
        
        # Clinical feedback showing ground truth interventions
        clinical_feedback = self._generate_clinical_feedback(session, case, simulation)
        
        return {
            "session_summary": session_summary,
            "triage_analysis": triage_analysis,
            "clinical_feedback": clinical_feedback
        }
    
    def _generate_session_summary(self, session: SimulationSession, case: Case) -> Dict:
        """Generate session summary with user actions"""
        # Map intervention database names to display names
        display_names = {
            "invasive_ventilation": "Perform Endotracheal Intubation",
            "intravenous": "Start IV Access",
            "intravenous_fluids": "Start IV Fluids",
            "intramuscular": "Give IM Medication",
            "oral_medications": "Give Oral Medication",
            "nebulized_medications": "Give Nebulized Treatment",
            "tier1_med_usage_1h": "Administer Emergency Medication",
            "tier2_med_usage": "Administer Urgent Medication",
            "tier3_med_usage": "Administer Stabilizing Medication",
            "tier4_med_usage": "Administer Routine Medication",
            "critical_procedure": "Perform Emergency Procedure",
            "psychotropic_med_within_120min": "Administer Psychotropic Medication"
        }
        
        # Format interventions performed
        interventions_display = [
            display_names.get(i, i.replace('_', ' ').title())
            for i in session.interventions_performed
        ]
        
        return {
            "arrival_method": case.demographics.transport,
            "chief_complaint": case.complaint,
            "chief_complaint_question": session.chief_complaint_question,
            "medical_history_question": session.medical_history_question,
            "triage_rationale": session.triage_rationale,
            "vitals_checked": session.checked_vitals if session.checked_vitals else [],
            "interventions_performed": interventions_display,
            "triage_level_assigned": session.user_triage_level
        }
    
    def _generate_triage_analysis(self, session: SimulationSession, case: Case) -> Dict:
        """Generate triage analysis with outcome data"""
        # Determine triage direction
        if session.user_triage_level < session.ground_truth_level:
            direction = "Over-triaged"
        elif session.user_triage_level > session.ground_truth_level:
            direction = "Under-triaged"
        else:
            direction = "Correct triage"
        
        # Collect outcome data
        outcomes = []
        
        # Disposition
        if case.disposition and case.disposition != "Unknown":
            outcomes.append(f"Disposition: {case.disposition}")
        
        # Transfers to surgery
        if case.transfer2surgeryin1h:
            outcomes.append("Patient transferred to surgery within 1 hour")
        elif case.transfer_to_surgery_beyond_1h:
            outcomes.append("Patient transferred to surgery after 1 hour")
        
        # Transfers to ICU
        if case.transfer_to_icu_in_1h:
            outcomes.append("Patient transferred to ICU within 1 hour")
        elif case.transfer_to_icu_beyond_1h:
            outcomes.append("Patient transferred to ICU after 1 hour")
        
        # General transfers
        if case.transfer_within_1h:
            outcomes.append("Patient transferred within 1 hour")
        elif case.transfer_beyond_1h:
            outcomes.append("Patient transferred after 1 hour")
        
        # Expired
        if case.expired_within_1h:
            outcomes.append("Patient expired within 1 hour")
        elif case.expired_beyond_1h:
            outcomes.append("Patient expired after 1 hour")
        
        # Blood transfusions
        if case.red_cell_order_more_than_1:
            outcomes.append("Multiple red cell units ordered")
        
        if case.transfusion_within_1h:
            outcomes.append("Blood transfusion within 1 hour")
        elif case.transfusion_beyond_1h:
            outcomes.append("Blood transfusion after 1 hour")
        
        all_vitals = self._format_all_vitals(case)
        abnormal_vitals = self._identify_abnormal_vitals(case)
        checked_names = {vital.get("name") for vital in session.checked_vitals or []}
        missing_vitals = [
            vital["name"] for vital in all_vitals
            if vital["name"] not in checked_names
        ]
        reference_reasoning = self._generate_reference_reasoning(case, abnormal_vitals)
        missed_assessment = self._generate_missed_assessment(
            session, case, missing_vitals, abnormal_vitals
        )
        
        return {
            "user_level": session.user_triage_level,
            "expert_level": session.ground_truth_level,
            "comparison": direction,
            "outcomes": outcomes,
            "all_vitals": all_vitals,
            "abnormal_vitals": abnormal_vitals,
            "missing_vitals": missing_vitals,
            "reference_reasoning": reference_reasoning,
            "missed_assessment": missed_assessment,
            "rationale_feedback": self._generate_rationale_feedback(session, case)
        }
    
    def _generate_clinical_feedback(self, session: SimulationSession, 
                                  case: Case, simulation: SimulationEngine) -> List[str]:
        """Generate clinical feedback showing ground truth interventions"""
        feedback = []
        
        # Map intervention field names to display names
        display_names = {
            "invasive_ventilation": ("Endotracheal intubation performed", "Airway protection or ventilatory failure was serious enough to require definitive airway management."),
            "intravenous": ("IV access established", "IV access supports blood draws, medication delivery, fluids, contrast imaging, and rapid escalation if the patient worsens."),
            "intravenous_fluids": ("IV fluids administered", "Fluids are commonly used when dehydration, poor perfusion, sepsis, bleeding, or hypotension is part of the early ED concern."),
            "intramuscular": ("IM medication administered", "IM medication suggests a need for treatment when oral or IV delivery was not the best immediate route."),
            "oral_medications": ("Oral medication administered", "Oral medication suggests the patient was stable enough for non-parenteral symptom treatment or routine therapy."),
            "nebulized_medications": ("Nebulized treatment administered", "Nebulized therapy is most often tied to wheezing, bronchospasm, or respiratory symptoms needing inhaled treatment."),
            "tier1_med_usage_1h": ("Emergency medications (Tier 1) administered", "A time-sensitive medication was given early, which is a strong signal that the ED team treated this as potentially high acuity."),
            "tier2_med_usage": ("Urgent medications (Tier 2) administered", "Urgent medication use suggests active treatment needs beyond a low-resource visit."),
            "tier3_med_usage": ("Stabilizing medications (Tier 3) administered", "Stabilizing medication use supports an ESI resource need even when the patient is not crashing."),
            "tier4_med_usage": ("Routine medications (Tier 4) administered", "Routine medication use may reflect lower acuity treatment, but it still helps estimate resource needs."),
            "critical_procedure": ("Critical procedure performed", "A critical procedure is a major escalation signal and should push the learner to revisit acuity and immediate safety risks."),
            "psychotropic_med_within_120min": ("Psychotropic medication administered", "Psychotropic medication can indicate agitation, severe distress, or behavioral health needs requiring monitored ED care.")
        }
        
        # List all ground truth interventions that occurred
        ground_truth = case.interventions
        
        if ground_truth.invasive_ventilation:
            feedback.append(self._intervention_feedback_item("invasive_ventilation", display_names))
        if ground_truth.intravenous:
            feedback.append(self._intervention_feedback_item("intravenous", display_names))
        if ground_truth.intravenous_fluids:
            feedback.append(self._intervention_feedback_item("intravenous_fluids", display_names))
        if ground_truth.intramuscular:
            feedback.append(self._intervention_feedback_item("intramuscular", display_names))
        if ground_truth.oral_medications:
            feedback.append(self._intervention_feedback_item("oral_medications", display_names))
        if ground_truth.nebulized_medications:
            feedback.append(self._intervention_feedback_item("nebulized_medications", display_names))
        if ground_truth.tier1_med_usage_1h:
            feedback.append(self._intervention_feedback_item("tier1_med_usage_1h", display_names))
        if ground_truth.tier2_med_usage:
            feedback.append(self._intervention_feedback_item("tier2_med_usage", display_names))
        if ground_truth.tier3_med_usage:
            feedback.append(self._intervention_feedback_item("tier3_med_usage", display_names))
        if ground_truth.tier4_med_usage:
            feedback.append(self._intervention_feedback_item("tier4_med_usage", display_names))
        if ground_truth.critical_procedure:
            feedback.append(self._intervention_feedback_item("critical_procedure", display_names))
        if ground_truth.psychotropic_med_within_120min:
            feedback.append(self._intervention_feedback_item("psychotropic_med_within_120min", display_names))
        
        return feedback

    def _intervention_feedback_item(self, value: str, display_names: Dict) -> Dict:
        """Create a structured intervention teaching item."""
        name, explanation = display_names[value]
        return {
            "value": value,
            "name": name,
            "explanation": explanation
        }

    def _format_all_vitals(self, case: Case) -> List[Dict]:
        """Return the complete triage vital set for feedback."""
        vitals = case.vitals
        formatted = []

        if vitals.hr is not None:
            formatted.append({"name": "Heart Rate", "value": f"{vitals.hr} bpm"})
        if vitals.sbp is not None or vitals.dbp is not None:
            sbp = int(vitals.sbp) if vitals.sbp is not None else "?"
            dbp = int(vitals.dbp) if vitals.dbp is not None else "?"
            formatted.append({"name": "Blood Pressure", "value": f"{sbp}/{dbp} mmHg"})
        if vitals.rr is not None:
            formatted.append({"name": "Respiratory Rate", "value": f"{vitals.rr} breaths/min"})
        if vitals.o2 is not None:
            formatted.append({"name": "Oxygen Saturation", "value": f"{vitals.o2}%"})
        if vitals.temp is not None:
            formatted.append({"name": "Temperature", "value": f"{vitals.temp}°F"})
        if vitals.pain is not None:
            formatted.append({"name": "Pain Level", "value": f"{vitals.pain}/10"})

        return formatted

    def _identify_abnormal_vitals(self, case: Case) -> List[Dict]:
        """Flag vital signs that should affect triage reasoning."""
        vitals = case.vitals
        abnormal = []

        if vitals.hr is not None:
            if vitals.hr >= 130 or vitals.hr < 50:
                abnormal.append({"name": "Heart Rate", "value": f"{vitals.hr} bpm", "severity": "critical", "reason": "danger-zone heart rate"})
            elif vitals.hr >= 110 or vitals.hr < 60:
                abnormal.append({"name": "Heart Rate", "value": f"{vitals.hr} bpm", "severity": "watch", "reason": "abnormal heart rate"})
        if vitals.sbp is not None:
            if vitals.sbp < 90 or vitals.sbp >= 180:
                abnormal.append({"name": "Blood Pressure", "value": f"{int(vitals.sbp)}/{int(vitals.dbp)} mmHg", "severity": "critical", "reason": "danger-zone blood pressure"})
            elif vitals.sbp < 100 or vitals.sbp >= 160:
                abnormal.append({"name": "Blood Pressure", "value": f"{int(vitals.sbp)}/{int(vitals.dbp)} mmHg", "severity": "watch", "reason": "abnormal blood pressure"})
        if vitals.rr is not None:
            if vitals.rr >= 30 or vitals.rr < 8:
                abnormal.append({"name": "Respiratory Rate", "value": f"{vitals.rr} breaths/min", "severity": "critical", "reason": "danger-zone respiratory rate"})
            elif vitals.rr >= 22 or vitals.rr < 12:
                abnormal.append({"name": "Respiratory Rate", "value": f"{vitals.rr} breaths/min", "severity": "watch", "reason": "abnormal respiratory rate"})
        if vitals.o2 is not None:
            if vitals.o2 < 90:
                abnormal.append({"name": "Oxygen Saturation", "value": f"{vitals.o2}%", "severity": "critical", "reason": "hypoxemia"})
            elif vitals.o2 < 94:
                abnormal.append({"name": "Oxygen Saturation", "value": f"{vitals.o2}%", "severity": "watch", "reason": "borderline oxygenation"})
        if vitals.temp is not None:
            if vitals.temp >= 103 or vitals.temp < 95:
                abnormal.append({"name": "Temperature", "value": f"{vitals.temp}°F", "severity": "critical", "reason": "danger-zone temperature"})
            elif vitals.temp >= 100.4 or vitals.temp < 96.8:
                abnormal.append({"name": "Temperature", "value": f"{vitals.temp}°F", "severity": "watch", "reason": "abnormal temperature"})
        if vitals.pain is not None:
            if vitals.pain >= 8:
                abnormal.append({"name": "Pain Level", "value": f"{vitals.pain}/10", "severity": "critical", "reason": "severe pain or distress"})
            elif vitals.pain >= 5:
                abnormal.append({"name": "Pain Level", "value": f"{vitals.pain}/10", "severity": "watch", "reason": "moderate pain"})

        return abnormal

    def _generate_reference_reasoning(self, case: Case, abnormal_vitals: List[Dict]) -> List[str]:
        """Create concise case-specific reasoning for the reference ESI level."""
        reasoning = [
            f"The reference ESI level was {case.acuity} for a patient presenting with {case.complaint}."
        ]

        if abnormal_vitals:
            vital_text = "; ".join(
                f"{item['name']} {item['value']} ({item['reason']})"
                for item in abnormal_vitals
            )
            reasoning.append(f"Vital-sign clues that should be reconciled: {vital_text}.")
        else:
            reasoning.append("The available vital signs do not show an obvious danger-zone abnormality, so resource need and complaint risk become more important.")

        ground_truth_items = self._generate_clinical_feedback(None, case, None)
        if ground_truth_items:
            reasoning.append(
                f"Actual ED care included {len(ground_truth_items)} recorded intervention category/categories, supporting the resource estimate."
            )
        else:
            reasoning.append("No tracked ED intervention category was recorded, so the main learning target is acuity/resource estimation rather than procedure selection.")

        if case.disposition and case.disposition != "Unknown":
            reasoning.append(f"The recorded disposition was {case.disposition}.")

        return reasoning

    def _generate_missed_assessment(
        self,
        session: SimulationSession,
        case: Case,
        missing_vitals: List[str],
        abnormal_vitals: List[Dict]
    ) -> List[str]:
        """Explain what the learner should revisit."""
        missed = []

        if missing_vitals:
            missed.append(
                "A complete triage vital set was not documented: "
                + ", ".join(missing_vitals)
                + ". In real triage these are baseline data, not optional extras."
            )

        if session.user_triage_level > session.ground_truth_level:
            missed.append(
                f"The assigned ESI {session.user_triage_level} was lower acuity than the reference ESI {session.ground_truth_level}; revisit resource needs and high-risk complaint features."
            )
        elif session.user_triage_level < session.ground_truth_level:
            missed.append(
                f"The assigned ESI {session.user_triage_level} was higher acuity than the reference ESI {session.ground_truth_level}; identify which danger signals were absent or less severe."
            )

        if abnormal_vitals:
            missed.append("Abnormal vital signs should be explicitly named in the triage rationale.")

        if not session.triage_rationale:
            missed.append("No written rationale was documented, so the debrief cannot assess the learner's reasoning.")

        return missed

    def _generate_rationale_feedback(self, session: SimulationSession, case: Case) -> str:
        """Give feedback on the learner's written ESI rationale."""
        rationale = (session.triage_rationale or "").strip()
        if not rationale:
            return "Document a one- to two-sentence ESI rationale so the debrief can separate a lucky guess from clinical reasoning."

        lower = rationale.lower()
        signals = []
        if str(case.acuity) in lower or "esi" in lower:
            signals.append("acuity level")
        if any(term in lower for term in ["vital", "bp", "heart", "oxygen", "sat", "pain", "temperature", "respiratory"]):
            signals.append("vital signs")
        if any(term in lower for term in ["resource", "lab", "imaging", "iv", "med", "procedure"]):
            signals.append("resource needs")
        if any(term in lower for term in ["risk", "danger", "unstable", "distress", "severe"]):
            signals.append("risk language")

        if len(signals) >= 2:
            return f"Your rationale included {', '.join(signals)}. Strong ESI rationales connect complaint risk, vital signs, and expected resources."

        return "Your rationale was recorded, but it should more clearly connect the complaint, vital signs, and expected ED resources."
    
    
    def _generate_detailed_analysis(self, session: SimulationSession, 
                                  case: Case, simulation: SimulationEngine) -> Dict:
        """Generate detailed analysis of the simulation"""
        return {
            "case_details": {
                "complaint": case.complaint,
                "demographics": {
                    "age": case.demographics.age,
                    "sex": case.demographics.sex,
                    "transport": case.demographics.transport
                },
                "vitals": {
                    "hr": case.vitals.hr,
                    "bp": f"{case.vitals.sbp}/{case.vitals.dbp}",
                    "rr": case.vitals.rr,
                    "o2": case.vitals.o2,
                    "temp": case.vitals.temp,
                    "pain": case.vitals.pain
                },
                "expert_opinions": case.expert_opinions,
                "final_decision": case.final_decision
            },
            "simulation_timeline": session.simulation_actions,
            "user_actions": session.user_actions,
            "intervention_analysis": {
                "performed": session.interventions_performed,
                "missed": session.critical_interventions_missed,
                "efficiency": len(session.interventions_performed) / max(len(session.user_actions), 1)
            }
        }
    
    def display_feedback(self, feedback: Dict):
        """Display formatted feedback to user"""
        print("\n" + "="*80)
        print("SIMULATION FEEDBACK REPORT")
        print("="*80)
        
        # Session summary
        summary = feedback["session_summary"]
        print(f"\nSESSION SUMMARY")
        print(f"Arrival Method: {summary['arrival_method']}")
        print(f"Chief Complaint: {summary['chief_complaint']}")
        
        print(f"\nQuestions Asked:")
        if summary.get('chief_complaint_question'):
            print(f"  Chief Complaint: {summary['chief_complaint_question']}")
        if summary.get('medical_history_question'):
            print(f"  Medical History: {summary['medical_history_question']}")
        
        print(f"\nVitals Checked:")
        if summary['vitals_checked']:
            for vital in summary['vitals_checked']:
                print(f"  - {vital['name']}: {vital['value']}")
        else:
            print("  None")
        
        print(f"\nInterventions Performed:")
        if summary['interventions_performed']:
            for intervention in summary['interventions_performed']:
                print(f"  - {intervention}")
        else:
            print("  None")
        
        print(f"\nTriage Level Assigned: ESI Level {summary['triage_level_assigned']}")
        
        # Triage analysis
        triage = feedback["triage_analysis"]
        print(f"\nTRIAGE ANALYSIS")
        print(f"Your Decision: ESI Level {triage['user_level']}")
        print(f"Expert Decision: ESI Level {triage['expert_level']}")
        print(f"Result: {triage['comparison']}")
        
        # Patient outcomes
        if triage['outcomes']:
            print(f"\nPatient Outcomes:")
            for outcome in triage['outcomes']:
                print(f"  - {outcome}")
        
        # Clinical feedback
        clinical = feedback["clinical_feedback"]
        if clinical:
            print(f"\nACTUAL INTERVENTIONS IN ED")
            print("The following interventions were actually performed:")
            for item in clinical:
                print(f"  - {item}")
        
        print("\n" + "="*80)
    
    def save_session(self, session: SimulationSession):
        """Save session to history"""
        self.session_history.append(session)
    
    def get_session_history(self) -> List[SimulationSession]:
        """Get complete session history"""
        return self.session_history.copy()
    
    def get_performance_summary(self) -> Dict:
        """Get overall performance summary across all sessions"""
        if not self.session_history:
            return {"message": "No sessions completed yet"}
        
        total_sessions = len(self.session_history)
        correct_triages = sum(1 for s in self.session_history if s.correct_triage)
        avg_score = sum(
            self._calculate_performance_metrics(s)["overall_score"] 
            for s in self.session_history
        ) / total_sessions
        
        return {
            "total_sessions": total_sessions,
            "triage_accuracy": correct_triages / total_sessions,
            "average_score": avg_score,
            "sessions": [
                {
                    "case_id": s.case_id,
                    "correct_triage": s.correct_triage,
                    "outcome": s.patient_final_state
                }
                for s in self.session_history
            ]
        }


if __name__ == "__main__":
    # Test the feedback engine
    from data_loader import DataLoader
    from simulation_engine import SimulationEngine
    
    # Load a test case
    loader = DataLoader("MIETIC-validate-samples.csv")
    case = loader.get_random_case()
    
    if case:
        print(f"Testing feedback engine with case: {case.id}")
        
        # Initialize simulation
        simulation = SimulationEngine(case)
        
        # Simulate some actions
        simulation.perform_intervention(simulation.get_available_interventions()[0] if simulation.get_available_interventions() else None)
        simulation.advance_time(5)
        
        # Create session record
        feedback_engine = FeedbackEngine()
        session = feedback_engine.create_session_record(
            case, simulation, 2, [{"action": "intervention", "intervention": "oxygen", "time": 0}]
        )
        
        # Generate feedback
        feedback = feedback_engine.generate_comprehensive_feedback(session, case, simulation)
        
        # Display feedback
        feedback_engine.display_feedback(feedback)
