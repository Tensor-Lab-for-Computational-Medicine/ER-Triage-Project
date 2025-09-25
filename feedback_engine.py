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
    total_time: int
    interventions_performed: List[str]
    patient_final_state: str
    critical_interventions_missed: List[str]
    user_actions: List[Dict]
    simulation_actions: List[Dict]
    correct_triage: bool
    session_timestamp: str


class FeedbackEngine:
    """Generates comprehensive feedback for simulation sessions"""
    
    def __init__(self):
        """Initialize the feedback engine"""
        self.triage_classifier = TriageClassifier()
        self.session_history: List[SimulationSession] = []
    
    def create_session_record(self, case: Case, simulation: SimulationEngine, 
                            user_triage_level: int, user_actions: List[Dict]) -> SimulationSession:
        """Create a complete session record"""
        summary = simulation.get_simulation_summary()
        
        return SimulationSession(
            case_id=case.id,
            user_triage_level=user_triage_level,
            ground_truth_level=case.acuity,
            total_time=summary['total_time'],
            interventions_performed=summary['interventions_performed'],
            patient_final_state=summary['final_state'],
            critical_interventions_missed=summary['critical_interventions_missed'],
            user_actions=user_actions,
            simulation_actions=simulation.get_action_history(),
            correct_triage=user_triage_level == case.acuity,
            session_timestamp=datetime.now().isoformat()
        )
    
    def generate_comprehensive_feedback(self, session: SimulationSession, 
                                      case: Case, simulation: SimulationEngine) -> Dict:
        """Generate comprehensive feedback for a simulation session"""
        
        # Triage analysis
        triage_analysis = self.triage_classifier.analyze_triage_decision(
            case, simulation, session.user_triage_level
        )
        
        # Performance metrics
        performance_metrics = self._calculate_performance_metrics(session)
        
        # Clinical feedback
        clinical_feedback = self._generate_clinical_feedback(session, case, simulation)
        
        # Learning recommendations
        learning_recommendations = self._generate_learning_recommendations(
            session, triage_analysis
        )
        
        return {
            "session_summary": {
                "case_id": session.case_id,
                "timestamp": session.session_timestamp,
                "total_time": session.total_time,
                "patient_outcome": session.patient_final_state
            },
            "triage_analysis": triage_analysis,
            "performance_metrics": performance_metrics,
            "clinical_feedback": clinical_feedback,
            "learning_recommendations": learning_recommendations,
            "detailed_analysis": self._generate_detailed_analysis(session, case, simulation)
        }
    
    def _calculate_performance_metrics(self, session: SimulationSession) -> Dict:
        """Calculate performance metrics for the session"""
        # Triage accuracy
        triage_accuracy = 1.0 if session.correct_triage else 0.0
        
        # Intervention efficiency
        total_actions = len(session.user_actions)
        intervention_actions = len([a for a in session.user_actions if a.get('action') == 'intervention'])
        intervention_efficiency = intervention_actions / max(total_actions, 1)
        
        # Time efficiency (lower is better for triage)
        time_efficiency = 1.0 / max(session.total_time / 10, 1)  # Normalize to 10 minutes
        
        # Critical intervention coverage
        critical_missed = len(session.critical_interventions_missed)
        critical_coverage = 1.0 - (critical_missed / max(len(session.interventions_performed) + critical_missed, 1))
        
        # Overall score (weighted average)
        overall_score = (
            triage_accuracy * 0.4 +
            intervention_efficiency * 0.2 +
            time_efficiency * 0.2 +
            critical_coverage * 0.2
        )
        
        return {
            "triage_accuracy": triage_accuracy,
            "intervention_efficiency": intervention_efficiency,
            "time_efficiency": time_efficiency,
            "critical_intervention_coverage": critical_coverage,
            "overall_score": overall_score,
            "total_actions": total_actions,
            "intervention_actions": intervention_actions
        }
    
    def _generate_clinical_feedback(self, session: SimulationSession, 
                                  case: Case, simulation: SimulationEngine) -> List[str]:
        """Generate clinical feedback based on case and simulation"""
        feedback = []
        
        # Patient outcome feedback
        if session.patient_final_state == "dead":
            feedback.append("💀 CRITICAL: Patient died during simulation")
            if session.critical_interventions_missed:
                feedback.append(f"   Missed critical interventions: {', '.join(session.critical_interventions_missed)}")
        elif session.patient_final_state == "deteriorating":
            feedback.append("⚠️  Patient deteriorated during simulation")
            feedback.append("   Consider more aggressive interventions")
        else:
            feedback.append("✅ Patient remained stable throughout simulation")
        
        # Vital signs analysis
        vitals = case.vitals
        if vitals.o2 and vitals.o2 < 90:
            if "oxygen" in session.interventions_performed:
                feedback.append("✅ Correctly identified and treated low oxygen saturation")
            else:
                feedback.append("❌ Missed low oxygen saturation - should have provided oxygen therapy")
        
        if vitals.pain and vitals.pain >= 8:
            if "pain_management" in session.interventions_performed:
                feedback.append("✅ Appropriately addressed severe pain")
            else:
                feedback.append("⚠️  Consider pain management for severe pain (8+/10)")
        
        # Complaint-specific feedback
        complaint_lower = case.complaint.lower()
        if "chest pain" in complaint_lower:
            if "cardiac_monitoring" in session.interventions_performed:
                feedback.append("✅ Appropriate cardiac monitoring for chest pain")
            else:
                feedback.append("💡 Consider cardiac monitoring for chest pain cases")
        
        if "bleeding" in complaint_lower or "laceration" in complaint_lower:
            if "bleeding_control" in session.interventions_performed:
                feedback.append("✅ Correctly addressed bleeding")
            else:
                feedback.append("❌ Missed bleeding control for trauma case")
        
        if "unresponsive" in complaint_lower:
            if "airway" in session.interventions_performed:
                feedback.append("✅ Appropriate airway management for unresponsive patient")
            else:
                feedback.append("❌ Critical: Unresponsive patients need airway assessment")
        
        return feedback
    
    def _generate_learning_recommendations(self, session: SimulationSession, 
                                         triage_analysis: Dict) -> List[str]:
        """Generate learning recommendations based on performance"""
        recommendations = []
        
        # Triage recommendations
        if not session.correct_triage:
            comparison = triage_analysis["comparison"]
            if comparison["user_level"] > comparison["ground_truth_level"]:
                recommendations.append("📚 Study ESI Level 2-3 criteria - you may be under-triaging")
            else:
                recommendations.append("📚 Study ESI Level 1-2 criteria - you may be over-triaging")
        
        # Intervention recommendations
        if session.critical_interventions_missed:
            recommendations.append("🔧 Practice identifying critical interventions:")
            for intervention in session.critical_interventions_missed:
                recommendations.append(f"   - {intervention.replace('_', ' ').title()}")
        
        # Time management
        if session.total_time > 15:
            recommendations.append("⏰ Work on faster triage decisions - aim for <15 minutes")
        elif session.total_time < 5:
            recommendations.append("⏰ Consider spending more time on assessment - thoroughness is important")
        
        # Action efficiency
        if len(session.user_actions) > 20:
            recommendations.append("🎯 Focus on essential actions - avoid unnecessary steps")
        
        # Specific learning areas
        if session.patient_final_state == "dead":
            recommendations.append("🚨 Review emergency protocols and critical intervention timing")
        
        if session.intervention_efficiency < 0.3:
            recommendations.append("🔧 Practice identifying when interventions are needed")
        
        return recommendations
    
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
        print("📊 SIMULATION FEEDBACK REPORT")
        print("="*80)
        
        # Session summary
        summary = feedback["session_summary"]
        print(f"\n📋 SESSION SUMMARY")
        print(f"Case ID: {summary['case_id']}")
        print(f"Total Time: {summary['total_time']} minutes")
        print(f"Patient Outcome: {summary['patient_outcome'].upper()}")
        
        # Performance metrics
        metrics = feedback["performance_metrics"]
        print(f"\n📈 PERFORMANCE METRICS")
        print(f"Overall Score: {metrics['overall_score']:.1%}")
        print(f"Triage Accuracy: {'✅ Correct' if metrics['triage_accuracy'] == 1.0 else '❌ Incorrect'}")
        print(f"Intervention Efficiency: {metrics['intervention_efficiency']:.1%}")
        print(f"Time Efficiency: {metrics['time_efficiency']:.1%}")
        print(f"Critical Intervention Coverage: {metrics['critical_intervention_coverage']:.1%}")
        
        # Triage analysis
        triage = feedback["triage_analysis"]
        print(f"\n🏷️  TRIAGE ANALYSIS")
        print(f"Your Decision: ESI Level {triage['user_decision']['level']} ({triage['user_decision']['description']['name']})")
        print(f"Expert Decision: ESI Level {triage['ground_truth']['level']} ({triage['ground_truth']['description']['name']})")
        print(f"Result: {triage['comparison']['accuracy']}")
        print(f"Direction: {triage['comparison']['direction']}")
        
        # Clinical feedback
        clinical = feedback["clinical_feedback"]
        if clinical:
            print(f"\n🏥 CLINICAL FEEDBACK")
            for item in clinical:
                print(f"  {item}")
        
        # Learning recommendations
        learning = feedback["learning_recommendations"]
        if learning:
            print(f"\n📚 LEARNING RECOMMENDATIONS")
            for item in learning:
                print(f"  {item}")
        
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
        avg_time = sum(s.total_time for s in self.session_history) / total_sessions
        avg_score = sum(
            self._calculate_performance_metrics(s)["overall_score"] 
            for s in self.session_history
        ) / total_sessions
        
        return {
            "total_sessions": total_sessions,
            "triage_accuracy": correct_triages / total_sessions,
            "average_time": avg_time,
            "average_score": avg_score,
            "sessions": [
                {
                    "case_id": s.case_id,
                    "correct_triage": s.correct_triage,
                    "time": s.total_time,
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
