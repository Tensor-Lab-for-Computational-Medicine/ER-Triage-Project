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
        
        return {
            "user_level": session.user_triage_level,
            "expert_level": session.ground_truth_level,
            "comparison": direction,
            "outcomes": outcomes
        }
    
    def _generate_clinical_feedback(self, session: SimulationSession, 
                                  case: Case, simulation: SimulationEngine) -> List[str]:
        """Generate clinical feedback showing ground truth interventions"""
        feedback = []
        
        # Map intervention field names to display names
        display_names = {
            "invasive_ventilation": "Endotracheal intubation performed",
            "intravenous": "IV access established",
            "intravenous_fluids": "IV fluids administered",
            "intramuscular": "IM medication administered",
            "oral_medications": "Oral medication administered",
            "nebulized_medications": "Nebulized treatment administered",
            "tier1_med_usage_1h": "Emergency medications (Tier 1) administered",
            "tier2_med_usage": "Urgent medications (Tier 2) administered",
            "tier3_med_usage": "Stabilizing medications (Tier 3) administered",
            "tier4_med_usage": "Routine medications (Tier 4) administered",
            "critical_procedure": "Critical procedure performed",
            "psychotropic_med_within_120min": "Psychotropic medication administered"
        }
        
        # List all ground truth interventions that occurred
        ground_truth = case.interventions
        
        if ground_truth.invasive_ventilation:
            feedback.append(display_names["invasive_ventilation"])
        if ground_truth.intravenous:
            feedback.append(display_names["intravenous"])
        if ground_truth.intravenous_fluids:
            feedback.append(display_names["intravenous_fluids"])
        if ground_truth.intramuscular:
            feedback.append(display_names["intramuscular"])
        if ground_truth.oral_medications:
            feedback.append(display_names["oral_medications"])
        if ground_truth.nebulized_medications:
            feedback.append(display_names["nebulized_medications"])
        if ground_truth.tier1_med_usage_1h:
            feedback.append(display_names["tier1_med_usage_1h"])
        if ground_truth.tier2_med_usage:
            feedback.append(display_names["tier2_med_usage"])
        if ground_truth.tier3_med_usage:
            feedback.append(display_names["tier3_med_usage"])
        if ground_truth.tier4_med_usage:
            feedback.append(display_names["tier4_med_usage"])
        if ground_truth.critical_procedure:
            feedback.append(display_names["critical_procedure"])
        if ground_truth.psychotropic_med_within_120min:
            feedback.append(display_names["psychotropic_med_within_120min"])
        
        if not feedback:
            feedback.append("No interventions were performed in the actual ED visit")
        
        return feedback
    
    
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
