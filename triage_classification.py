"""
Triage Classification Module for ER Triage Simulation
Handles triage level assignment and comparison with ground truth
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from enum import Enum
from data_loader import Case
from simulation_engine import SimulationEngine


class TriageLevel(Enum):
    """Emergency Severity Index (ESI) Triage Levels"""
    LEVEL_1 = 1  # Resuscitation - Immediate life-threatening
    LEVEL_2 = 2  # Emergent - High risk, unstable
    LEVEL_3 = 3  # Urgent - Stable but needs prompt care
    LEVEL_4 = 4  # Less Urgent - Stable, can wait
    LEVEL_5 = 5  # Non-Urgent - Minor conditions


@dataclass
class TriageDecision:
    """Represents a triage decision"""
    user_level: int
    ground_truth_level: int
    case_id: str
    time_to_decision: int  # minutes
    interventions_performed: List[str]
    patient_outcome: str
    correct: bool
    
    def get_accuracy(self) -> str:
        """Get accuracy description"""
        if self.correct:
            return "Correct"
        elif abs(self.user_level - self.ground_truth_level) == 1:
            return "Close (off by 1 level)"
        elif abs(self.user_level - self.ground_truth_level) == 2:
            return "Moderate error (off by 2 levels)"
        else:
            return "Major error (off by 3+ levels)"


class TriageClassifier:
    """Handles triage classification logic and validation"""
    
    def __init__(self):
        """Initialize the triage classifier"""
        self.triage_rules = self._initialize_triage_rules()
    
    def _initialize_triage_rules(self) -> Dict[int, Dict]:
        """Initialize triage level rules and criteria"""
        return {
            1: {
                "name": "Resuscitation",
                "description": "Immediate life-threatening conditions",
                "criteria": [
                    "Unresponsive or altered mental status",
                    "Severe respiratory distress",
                    "Cardiac arrest or severe shock",
                    "Severe bleeding",
                    "Critical vital signs"
                ],
                "examples": [
                    "Cardiac arrest",
                    "Severe trauma",
                    "Respiratory failure",
                    "Shock",
                    "Unresponsive patient"
                ]
            },
            2: {
                "name": "Emergent",
                "description": "High risk, unstable conditions",
                "criteria": [
                    "Severe pain (8-10/10)",
                    "Moderate respiratory distress",
                    "Significant bleeding",
                    "Severe abdominal pain",
                    "Chest pain with risk factors"
                ],
                "examples": [
                    "Severe chest pain",
                    "Difficulty breathing",
                    "Severe abdominal pain",
                    "Significant trauma",
                    "Stroke symptoms"
                ]
            },
            3: {
                "name": "Urgent",
                "description": "Stable but needs prompt care",
                "criteria": [
                    "Moderate pain (5-7/10)",
                    "Stable vital signs",
                    "Non-life-threatening conditions",
                    "Need for diagnostic tests",
                    "Moderate symptoms"
                ],
                "examples": [
                    "Moderate abdominal pain",
                    "Fever with stable vitals",
                    "Minor trauma",
                    "Urinary symptoms",
                    "Moderate headache"
                ]
            },
            4: {
                "name": "Less Urgent",
                "description": "Stable, can wait",
                "criteria": [
                    "Mild pain (1-4/10)",
                    "Stable vital signs",
                    "Non-urgent conditions",
                    "Routine follow-up",
                    "Minor symptoms"
                ],
                "examples": [
                    "Minor cuts or bruises",
                    "Mild headache",
                    "Routine medication refill",
                    "Minor skin conditions",
                    "Non-urgent follow-up"
                ]
            },
            5: {
                "name": "Non-Urgent",
                "description": "Minor conditions",
                "criteria": [
                    "No pain or minimal pain",
                    "Normal vital signs",
                    "Minor conditions",
                    "Can be managed outpatient",
                    "No immediate risk"
                ],
                "examples": [
                    "Suture removal",
                    "Minor cold symptoms",
                    "Routine check-up",
                    "Minor skin irritation",
                    "Non-urgent concerns"
                ]
            }
        }
    
    def validate_triage_level(self, level: int) -> bool:
        """Validate if triage level is within valid range"""
        return 1 <= level <= 5
    
    def get_triage_description(self, level: int) -> Dict:
        """Get description and criteria for a triage level"""
        if not self.validate_triage_level(level):
            return {"error": "Invalid triage level"}
        
        return self.triage_rules[level]
    
    def suggest_triage_level(self, case: Case, simulation: SimulationEngine) -> int:
        """Suggest triage level based on case data and simulation state"""
        # Start with base acuity from case
        suggested_level = case.acuity
        
        # Adjust based on vital signs
        vitals = case.vitals
        
        # Critical vital signs -> Level 1
        if (vitals.o2 and vitals.o2 < 90) or \
           (vitals.hr and (vitals.hr > 150 or vitals.hr < 40)) or \
           (vitals.sbp and vitals.sbp < 80):
            suggested_level = 1
        
        # Severe pain -> Level 2
        elif vitals.pain and vitals.pain >= 8:
            suggested_level = min(suggested_level, 2)
        
        # Moderate pain -> Level 3
        elif vitals.pain and vitals.pain >= 5:
            suggested_level = min(suggested_level, 3)
        
        # Adjust based on complaint keywords
        complaint_lower = case.complaint.lower()
        
        # Level 1 keywords
        if any(keyword in complaint_lower for keyword in [
            'cardiac arrest', 'unresponsive', 'respiratory distress', 
            'severe bleeding', 'shock', 'critical'
        ]):
            suggested_level = 1
        
        # Level 2 keywords
        elif any(keyword in complaint_lower for keyword in [
            'chest pain', 'difficulty breathing', 'severe pain',
            'stroke', 'severe trauma', 'overdose'
        ]):
            suggested_level = min(suggested_level, 2)
        
        # Level 3 keywords
        elif any(keyword in complaint_lower for keyword in [
            'abdominal pain', 'fever', 'moderate pain',
            'urinary', 'headache'
        ]):
            suggested_level = min(suggested_level, 3)
        
        # Level 4 keywords
        elif any(keyword in complaint_lower for keyword in [
            'minor', 'laceration', 'bruise', 'mild pain'
        ]):
            suggested_level = min(suggested_level, 4)
        
        # Level 5 keywords
        elif any(keyword in complaint_lower for keyword in [
            'suture removal', 'medication refill', 'routine',
            'check-up', 'minor cold'
        ]):
            suggested_level = 5
        
        # Adjust based on simulation state
        if simulation.patient_state.dead:
            suggested_level = 1
        elif simulation.patient_state.deteriorating:
            suggested_level = min(suggested_level, 2)
        
        # Ensure valid range
        return max(1, min(5, suggested_level))
    
    def compare_triage_decisions(self, user_level: int, ground_truth_level: int) -> Dict:
        """Compare user triage decision with ground truth"""
        if not self.validate_triage_level(user_level) or not self.validate_triage_level(ground_truth_level):
            return {"error": "Invalid triage levels"}
        
        difference = abs(user_level - ground_truth_level)
        
        if difference == 0:
            accuracy = "Perfect match"
            severity = "None"
        elif difference == 1:
            accuracy = "Close (off by 1 level)"
            severity = "Minor"
        elif difference == 2:
            accuracy = "Moderate error (off by 2 levels)"
            severity = "Moderate"
        else:
            accuracy = "Major error (off by 3+ levels)"
            severity = "Major"
        
        # Determine if user over-triaged or under-triaged
        if user_level < ground_truth_level:
            direction = "Over-triaged (assigned higher priority)"
        elif user_level > ground_truth_level:
            direction = "Under-triaged (assigned lower priority)"
        else:
            direction = "Correctly triaged"
        
        return {
            "user_level": user_level,
            "ground_truth_level": ground_truth_level,
            "difference": difference,
            "accuracy": accuracy,
            "severity": severity,
            "direction": direction,
            "correct": difference == 0
        }
    
    def analyze_triage_decision(self, case: Case, simulation: SimulationEngine, 
                              user_level: int) -> Dict:
        """Comprehensive analysis of triage decision"""
        ground_truth = case.acuity
        comparison = self.compare_triage_decisions(user_level, ground_truth)
        suggested = self.suggest_triage_level(case, simulation)
        
        # Get descriptions
        user_desc = self.get_triage_description(user_level)
        truth_desc = self.get_triage_description(ground_truth)
        suggested_desc = self.get_triage_description(suggested)
        
        return {
            "user_decision": {
                "level": user_level,
                "description": user_desc
            },
            "ground_truth": {
                "level": ground_truth,
                "description": truth_desc
            },
            "suggested": {
                "level": suggested,
                "description": suggested_desc
            },
            "comparison": comparison,
            "case_context": {
                "complaint": case.complaint,
                "vitals": {
                    "hr": case.vitals.hr,
                    "bp": f"{case.vitals.sbp}/{case.vitals.dbp}",
                    "o2": case.vitals.o2,
                    "pain": case.vitals.pain
                },
                "final_state": simulation.patient_state.get_state().value,
                "interventions": [i.value for i in simulation.patient_state.interventions]
            }
        }
    
    def get_triage_feedback(self, analysis: Dict) -> List[str]:
        """Generate feedback messages for triage decision"""
        feedback = []
        comparison = analysis["comparison"]
        
        if comparison["correct"]:
            feedback.append("✅ Excellent! Your triage level matches the expert assessment.")
        else:
            feedback.append(f"❌ Triage level mismatch. You assigned Level {comparison['user_level']}, but experts assigned Level {comparison['ground_truth_level']}.")
            feedback.append(f"📊 {comparison['direction']}")
            
            # Provide specific feedback based on the case
            case_context = analysis["case_context"]
            
            if comparison["user_level"] > comparison["ground_truth_level"]:
                # Under-triaged
                feedback.append("⚠️  You may have under-triaged this patient. Consider:")
                if case_context["vitals"]["o2"] and case_context["vitals"]["o2"] < 90:
                    feedback.append("  - Low oxygen saturation requires immediate attention")
                if case_context["vitals"]["pain"] and case_context["vitals"]["pain"] >= 8:
                    feedback.append("  - Severe pain indicates higher acuity")
                if "chest pain" in case_context["complaint"].lower():
                    feedback.append("  - Chest pain requires prompt evaluation")
            
            elif comparison["user_level"] < comparison["ground_truth_level"]:
                # Over-triaged
                feedback.append("ℹ️  You may have over-triaged this patient. Consider:")
                if case_context["vitals"]["pain"] and case_context["vitals"]["pain"] <= 3:
                    feedback.append("  - Low pain level suggests less urgent condition")
                if case_context["vitals"]["hr"] and 60 <= case_context["vitals"]["hr"] <= 100:
                    feedback.append("  - Normal heart rate indicates stability")
        
        # Add learning points
        feedback.append("\n📚 Learning Points:")
        truth_desc = analysis["ground_truth"]["description"]
        feedback.append(f"  - Level {comparison['ground_truth_level']} ({truth_desc['name']}): {truth_desc['description']}")
        
        if analysis["case_context"]["interventions"]:
            feedback.append(f"  - Required interventions: {', '.join(analysis['case_context']['interventions'])}")
        
        return feedback


if __name__ == "__main__":
    # Test the triage classifier
    from data_loader import DataLoader
    from simulation_engine import SimulationEngine
    
    classifier = TriageClassifier()
    
    # Load a test case
    loader = DataLoader("MIETIC-validate-samples.csv")
    case = loader.get_random_case()
    
    if case:
        print(f"Testing triage classification with case: {case.id}")
        print(f"Complaint: {case.complaint}")
        print(f"Ground truth acuity: {case.acuity}")
        
        # Initialize simulation
        simulation = SimulationEngine(case)
        
        # Test triage level suggestion
        suggested = classifier.suggest_triage_level(case, simulation)
        print(f"Suggested triage level: {suggested}")
        
        # Test comparison
        user_level = 2  # Simulate user choice
        analysis = classifier.analyze_triage_decision(case, simulation, user_level)
        
        print(f"\nTriage Analysis:")
        print(f"User Level: {analysis['user_decision']['level']}")
        print(f"Ground Truth: {analysis['ground_truth']['level']}")
        print(f"Comparison: {analysis['comparison']['accuracy']}")
        
        # Get feedback
        feedback = classifier.get_triage_feedback(analysis)
        print(f"\nFeedback:")
        for message in feedback:
            print(message)
