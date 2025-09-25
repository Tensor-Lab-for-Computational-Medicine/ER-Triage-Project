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
    OXYGEN = "oxygen"
    AIRWAY = "airway"
    BLEEDING_CONTROL = "bleeding_control"
    IV_FLUIDS = "iv_fluids"
    PAIN_MANAGEMENT = "pain_management"
    CARDIAC_MONITORING = "cardiac_monitoring"


@dataclass
class PatientState:
    """Current patient state in simulation"""
    stable: bool = True
    deteriorating: bool = False
    dead: bool = False
    interventions: Set[InterventionType] = field(default_factory=set)
    time_elapsed: int = 0  # in minutes
    deterioration_timer: int = 0  # timer for deterioration progression
    bleeding_present: bool = False
    low_oxygen: bool = False
    
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
        # Check for bleeding indicators in complaint/history
        bleeding_keywords = ['bleeding', 'hemorrhage', 'laceration', 'wound', 'trauma', 'injury']
        complaint_lower = self.case.complaint.lower()
        history_lower = self.case.history.lower()
        
        self.patient_state.bleeding_present = any(
            keyword in complaint_lower or keyword in history_lower 
            for keyword in bleeding_keywords
        )
        
        # Check for low oxygen saturation
        if self.case.vitals.o2 is not None and self.case.vitals.o2 < 90:
            self.patient_state.low_oxygen = True
        
        # Log initial conditions
        self._log_action("Initial Assessment", {
            "bleeding_detected": self.patient_state.bleeding_present,
            "low_oxygen": self.patient_state.low_oxygen,
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
            "time": self.patient_state.time_elapsed,
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
        
        # Update patient state based on intervention
        result = {"success": True, "message": f"{intervention.value} intervention performed."}
        
        if intervention == InterventionType.OXYGEN:
            if self.patient_state.low_oxygen:
                self.patient_state.low_oxygen = False
                result["message"] += " Oxygen saturation improving."
            else:
                result["message"] += " Oxygen administered prophylactically."
        
        elif intervention == InterventionType.BLEEDING_CONTROL:
            if self.patient_state.bleeding_present:
                self.patient_state.bleeding_present = False
                result["message"] += " Bleeding controlled."
            else:
                result["message"] += " No active bleeding found."
        
        elif intervention == InterventionType.AIRWAY:
            result["message"] += " Airway secured."
        
        elif intervention == InterventionType.IV_FLUIDS:
            result["message"] += " IV access established and fluids started."
        
        elif intervention == InterventionType.PAIN_MANAGEMENT:
            result["message"] += " Pain medication administered."
        
        elif intervention == InterventionType.CARDIAC_MONITORING:
            result["message"] += " Cardiac monitoring initiated."
        
        self._log_action(f"Intervention: {intervention.value}", result)
        return result
    
    def advance_time(self, minutes: int = 5) -> Dict:
        """Advance simulation time and check for deterioration"""
        if self.patient_state.dead:
            return {"message": "Patient is deceased. Time cannot advance."}
        
        self.patient_state.time_elapsed += minutes
        
        # Check deterioration conditions
        deterioration_occurred = False
        
        # Rule 1: Low oxygen without oxygen intervention
        if (self.patient_state.low_oxygen and 
            InterventionType.OXYGEN not in self.patient_state.interventions):
            if not self.patient_state.deteriorating:
                self.patient_state.deteriorating = True
                self.patient_state.deterioration_timer = 0
                deterioration_occurred = True
                self._log_action("Deterioration", {"reason": "Low oxygen saturation without intervention"})
        
        # Rule 2: Bleeding without bleeding control
        if (self.patient_state.bleeding_present and 
            InterventionType.BLEEDING_CONTROL not in self.patient_state.interventions):
            if not self.patient_state.deteriorating:
                self.patient_state.deteriorating = True
                self.patient_state.deterioration_timer = 0
                deterioration_occurred = True
                self._log_action("Deterioration", {"reason": "Active bleeding without control"})
        
        # If deteriorating, increment timer
        if self.patient_state.deteriorating:
            self.patient_state.deterioration_timer += minutes
            
            # Check if patient dies (after 10 minutes of deterioration)
            if self.patient_state.deterioration_timer >= 10:
                self.patient_state.dead = True
                self._log_action("Death", {"reason": "Prolonged deterioration without intervention"})
                return {"message": "Patient has died due to prolonged deterioration."}
        
        # Check if patient stabilizes (interventions were effective)
        if (self.patient_state.deteriorating and 
            not self.patient_state.low_oxygen and 
            not self.patient_state.bleeding_present):
            self.patient_state.deteriorating = False
            self.patient_state.deterioration_timer = 0
            self._log_action("Stabilization", {"reason": "Effective interventions applied"})
            return {"message": "Patient has stabilized with interventions."}
        
        if deterioration_occurred:
            return {"message": f"Patient is deteriorating. Time elapsed: {self.patient_state.time_elapsed} minutes."}
        
        return {"message": f"Time advanced by {minutes} minutes. Patient remains stable."}
    
    def get_patient_status(self) -> Dict:
        """Get current patient status"""
        return {
            "state": self.patient_state.get_state().value,
            "time_elapsed": self.patient_state.time_elapsed,
            "interventions_performed": [i.value for i in self.patient_state.interventions],
            "active_conditions": {
                "bleeding": self.patient_state.bleeding_present,
                "low_oxygen": self.patient_state.low_oxygen
            },
            "deterioration_timer": self.patient_state.deterioration_timer if self.patient_state.deteriorating else 0
        }
    
    def get_available_interventions(self) -> List[InterventionType]:
        """Get list of available interventions"""
        if self.patient_state.dead:
            return []
        
        available = []
        
        # Always available interventions
        available.extend([
            InterventionType.IV_FLUIDS,
            InterventionType.PAIN_MANAGEMENT,
            InterventionType.CARDIAC_MONITORING
        ])
        
        # Condition-specific interventions
        if self.patient_state.low_oxygen:
            available.append(InterventionType.OXYGEN)
        
        if self.patient_state.bleeding_present:
            available.append(InterventionType.BLEEDING_CONTROL)
        
        # Airway intervention for severe cases
        if (self.case.acuity == 1 or 
            "unresponsive" in self.case.complaint.lower() or
            "respiratory distress" in self.case.complaint.lower()):
            available.append(InterventionType.AIRWAY)
        
        return available
    
    def get_action_history(self) -> List[Dict]:
        """Get complete action history"""
        return self.action_history.copy()
    
    def get_simulation_summary(self) -> Dict:
        """Get summary of simulation results"""
        return {
            "case_id": self.case.id,
            "final_state": self.patient_state.get_state().value,
            "total_time": self.patient_state.time_elapsed,
            "interventions_performed": [i.value for i in self.patient_state.interventions],
            "total_actions": len(self.action_history),
            "deterioration_occurred": self.patient_state.deteriorating or self.patient_state.dead,
            "critical_interventions_missed": self._get_missed_critical_interventions()
        }
    
    def _get_missed_critical_interventions(self) -> List[str]:
        """Identify critical interventions that were missed"""
        missed = []
        
        if (self.patient_state.low_oxygen and 
            InterventionType.OXYGEN not in self.patient_state.interventions):
            missed.append("oxygen")
        
        if (self.patient_state.bleeding_present and 
            InterventionType.BLEEDING_CONTROL not in self.patient_state.interventions):
            missed.append("bleeding_control")
        
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
