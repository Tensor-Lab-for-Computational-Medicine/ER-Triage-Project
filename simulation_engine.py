"""
Simulation Engine for ER Triage Simulation
Manages patient state, deterioration rules, and intervention tracking
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set
from enum import Enum
import time


class PatientCondition(Enum):
    """Patient condition states"""
    STABLE = "stable"
    DETERIORATING = "deteriorating"
    DEAD = "dead"


class InterventionType(Enum):
    """Types of interventions available"""
    # Procedures
    INVASIVE_VENTILATION = "invasive_ventilation"
    INTRAVENOUS = "intravenous"
    INTRAVENOUS_FLUIDS = "intravenous_fluids"
    INTRAMUSCULAR = "intramuscular"
    ORAL_MEDICATIONS = "oral_medications"
    NEBULIZED_MEDICATIONS = "nebulized_medications"
    
    # Medication tiers
    TIER1_CRITICAL = "tier1_med_usage_1h"
    TIER2_URGENT = "tier2_med_usage"
    TIER3_MODERATE = "tier3_med_usage"
    TIER4_ROUTINE = "tier4_med_usage"
    
    # Critical procedures
    CRITICAL_PROCEDURE = "critical_procedure"
    
    # Psychiatric
    PSYCHOTROPIC = "psychotropic_med_within_120min"


@dataclass
class PatientState:
    """Current patient state in simulation"""
    stable: bool = True
    deteriorating: bool = False
    dead: bool = False
    interventions: Set[InterventionType] = field(default_factory=set)
    
    def get_state(self) -> PatientCondition:
        """Get current patient state"""
        if self.dead:
            return PatientCondition.DEAD
        elif self.deteriorating:
            return PatientCondition.DETERIORATING
        else:
            return PatientCondition.STABLE


class SimulationEngine:
    """Manages patient state and simulation rules"""
    
    def __init__(self, case):
        """Initialize simulation with a case"""
        self.case = case
        self.patient_state = PatientState()
        self.action_history: List[Dict] = []
        self._initialize_patient_conditions()
    
    def _initialize_patient_conditions(self):
        """Initialize patient conditions based on case data"""
        # Log initial conditions
        self._log_action("Initial Assessment", {
            "initial_vitals": {
                "hr": self.case.vitals.hr,
                "bp": f"{self.case.vitals.sbp}/{self.case.vitals.dbp}",
                "o2": self.case.vitals.o2,
                "temp": self.case.vitals.temp
            }
        })
    
    def _log_action(self, action: str, details: Dict):
        """Log an action taken during simulation"""
        self.action_history.append({
            "action": action,
            "details": details,
            "patient_state": self.patient_state.get_state().value
        })
    
    def perform_intervention(self, intervention: InterventionType) -> Dict:
        """Perform an intervention and update patient state"""
        if self.patient_state.dead:
            return {"success": False, "message": "Patient is deceased. No interventions possible."}
        
        # Add intervention
        self.patient_state.interventions.add(intervention)
        
        # Map to display names
        intervention_names = {
            InterventionType.INVASIVE_VENTILATION: "Perform Endotracheal Intubation",
            InterventionType.INTRAVENOUS: "Start IV Access",
            InterventionType.INTRAVENOUS_FLUIDS: "Start IV Fluids",
            InterventionType.INTRAMUSCULAR: "Give IM Medication",
            InterventionType.ORAL_MEDICATIONS: "Give Oral Medication",
            InterventionType.NEBULIZED_MEDICATIONS: "Give Nebulized Treatment",
            InterventionType.TIER1_CRITICAL: "Administer Emergency Medication",
            InterventionType.TIER2_URGENT: "Administer Urgent Medication",
            InterventionType.TIER3_MODERATE: "Administer Stabilizing Medication",
            InterventionType.TIER4_ROUTINE: "Administer Routine Medication",
            InterventionType.CRITICAL_PROCEDURE: "Perform Emergency Procedure",
            InterventionType.PSYCHOTROPIC: "Administer Psychotropic Medication"
        }
        
        display_name = intervention_names.get(intervention, intervention.value)
        result = {"success": True, "message": f"{display_name} performed."}
        
        self._log_action(f"Intervention: {intervention.value}", result)
        return result
    
    def check_patient_status(self) -> Dict:
        """Check current patient status and update state accordingly"""
        if self.patient_state.dead:
            return {"message": "Patient is deceased."}
        
        # Patient status is now based on MIETIC ground truth, not artificial rules
        return {"message": "Patient remains stable."}
    
    def get_patient_status(self) -> Dict:
        """Get current patient status"""
        return {
            "state": self.patient_state.get_state().value,
            "interventions_performed": [i.value for i in self.patient_state.interventions]
        }
    
    def get_available_interventions(self) -> List[InterventionType]:
        """Get list of available interventions (excluding already performed)"""
        if self.patient_state.dead:
            return []
        
        # All possible interventions
        all_interventions = [
            InterventionType.INVASIVE_VENTILATION,
            InterventionType.INTRAVENOUS,
            InterventionType.INTRAVENOUS_FLUIDS,
            InterventionType.INTRAMUSCULAR,
            InterventionType.ORAL_MEDICATIONS,
            InterventionType.NEBULIZED_MEDICATIONS,
            InterventionType.TIER1_CRITICAL,
            InterventionType.TIER2_URGENT,
            InterventionType.TIER3_MODERATE,
            InterventionType.TIER4_ROUTINE,
            InterventionType.CRITICAL_PROCEDURE,
            InterventionType.PSYCHOTROPIC
        ]
        
        # Filter out interventions that have already been performed
        available = [i for i in all_interventions if i not in self.patient_state.interventions]
        
        return available
    
    def get_action_history(self) -> List[Dict]:
        """Get complete action history"""
        return self.action_history.copy()
    
    def get_simulation_summary(self) -> Dict:
        """Get summary of simulation results"""
        return {
            "case_id": self.case.id,
            "final_state": self.patient_state.get_state().value,
            "interventions_performed": [i.value for i in self.patient_state.interventions],
            "total_actions": len(self.action_history),
            "deterioration_occurred": self.patient_state.deteriorating or self.patient_state.dead,
            "critical_interventions_missed": self._get_missed_critical_interventions()
        }
    
    def _get_missed_critical_interventions(self) -> List[str]:
        """Identify critical interventions that were missed based on ground truth"""
        missed = []
        
        # Compare user's interventions against ground truth from case data
        ground_truth = self.case.interventions
        user_interventions = {i.value for i in self.patient_state.interventions}
        
        # Check each ground truth intervention
        if ground_truth.invasive_ventilation and 'invasive_ventilation' not in user_interventions:
            missed.append("invasive_ventilation")
        if ground_truth.intravenous and 'intravenous' not in user_interventions:
            missed.append("intravenous")
        if ground_truth.intravenous_fluids and 'intravenous_fluids' not in user_interventions:
            missed.append("intravenous_fluids")
        if ground_truth.tier1_med_usage_1h and 'tier1_med_usage_1h' not in user_interventions:
            missed.append("tier1_critical")
        if ground_truth.tier2_med_usage and 'tier2_med_usage' not in user_interventions:
            missed.append("tier2_urgent")
        if ground_truth.critical_procedure and 'critical_procedure' not in user_interventions:
            missed.append("critical_procedure")
        
        return missed


if __name__ == "__main__":
    # Test the simulation engine
    from data_loader import DataLoader
    
    # Load a test case
    loader = DataLoader("MIETIC-validate-samples.csv")
    case = loader.get_random_case()
    
    if case:
        print(f"Testing simulation with case: {case.id}")
        print(f"Complaint: {case.complaint}")
        print(f"Acuity: {case.acuity}")
        
        # Initialize simulation
        sim = SimulationEngine(case)
        
        # Show initial status
        print(f"\nInitial Status: {sim.get_patient_status()}")
        
        # Show available interventions
        interventions = sim.get_available_interventions()
        print(f"Available interventions: {[i.value for i in interventions]}")
        
        # Test some interventions
        if interventions:
            result = sim.perform_intervention(interventions[0])
            print(f"Intervention result: {result}")
        
        # Advance time
        result = sim.advance_time(5)
        print(f"Time advance result: {result}")
        
        # Show final status
        print(f"\nFinal Status: {sim.get_patient_status()}")
        print(f"Simulation Summary: {sim.get_simulation_summary()}")
