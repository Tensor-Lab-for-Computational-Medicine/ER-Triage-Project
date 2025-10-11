"""
User Interface Module for ER Triage Simulation
Provides CLI interface for user interactions and actions
"""

from typing import Dict, List, Optional, Any
from simulation_engine import SimulationEngine, InterventionType
from data_loader import Case
import time


class UserInterface:
    """Handles user interactions and displays"""
    
    def __init__(self):
        """Initialize the user interface"""
        self.current_simulation: Optional[SimulationEngine] = None
        self.user_actions: List[Dict] = []
        self.checked_vitals: List[Dict] = []  # Track vitals that have been checked
    
    def display_welcome(self):
        """Display welcome message and instructions"""
        print("=" * 60)
        print("ER TRIAGE SIMULATION - MIETIC/MIMIC")
        print("=" * 60)
        print("Welcome to the Emergency Room Triage Simulation!")
        print("You are a triage nurse evaluating patients in the ED.")
        print("\nYour objectives:")
        print("1. Assess the patient's condition")
        print("2. Perform necessary interventions")
        print("3. Assign appropriate triage classification")
        print("4. Learn from expert feedback")
        print("=" * 60)
    
    def display_commands(self):
        """Display available commands"""
        print("\nCommands available:")
        print("- 'help' - Show this help message")
        print("- 'vitals' - Display patient vital signs")
        print("- 'history' - Review patient medical history")
        print("- 'complaint' - Review chief complaint")
        print("- 'interventions' - Show available interventions")
        print("- 'triage' - Assign triage classification")
        print("- 'quit' - Exit simulation")
    
    def display_case_summary(self, case: Case):
        """Display initial case summary"""
        print(f"\nNEW PATIENT ARRIVAL")
        print(f"Age: {case.demographics.age:.0f} years")
        print(f"Sex: {case.demographics.sex}")
        print(f"Arrival Transport: {case.demographics.transport}")
        print(f"Chief Complaint: {case.complaint}")
        
        print(f"\nSimulation started.")
        print("Type 'help' for available commands.")
    
    def display_status_summary(self, simulation: SimulationEngine):
        """Display checked vitals and performed interventions"""
        print("\n" + "=" * 60)
        
        # Display checked vitals
        if self.checked_vitals:
            print("VITALS CHECKED:")
            for vital in self.checked_vitals:
                print(f"  - {vital['name']}: {vital['value']}")
        else:
            print("VITALS CHECKED: None")
        
        print()
        
        # Display performed interventions
        status = simulation.get_patient_status()
        if status['interventions_performed']:
            # Map database field names to display names
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
            
            print("INTERVENTIONS PERFORMED:")
            for intervention in status['interventions_performed']:
                display_name = display_names.get(intervention, intervention.replace('_', ' ').title())
                print(f"  - {display_name}")
        else:
            print("INTERVENTIONS PERFORMED: None")
        
        print("=" * 60)
    
    def display_vitals(self, case: Case):
        """Display vital signs interactively"""
        vitals = case.vitals
        
        # List of available vital signs
        vital_options = []
        vital_data = {}
        
        if vitals.hr is not None:
            vital_options.append("Heart Rate")
            vital_data["Heart Rate"] = f"{vitals.hr} bpm"
        
        if vitals.sbp is not None or vitals.dbp is not None:
            vital_options.append("Blood Pressure")
            sbp_str = str(vitals.sbp) if vitals.sbp is not None else '?'
            dbp_str = str(vitals.dbp) if vitals.dbp is not None else '?'
            vital_data["Blood Pressure"] = f"{sbp_str}/{dbp_str} mmHg"
        
        if vitals.rr is not None:
            vital_options.append("Respiratory Rate")
            vital_data["Respiratory Rate"] = f"{vitals.rr} breaths/min"
        
        if vitals.o2 is not None:
            vital_options.append("Oxygen Saturation")
            vital_data["Oxygen Saturation"] = f"{vitals.o2}%"
        
        if vitals.temp is not None:
            vital_options.append("Temperature")
            vital_data["Temperature"] = f"{vitals.temp}°F"
        
        if vitals.pain is not None:
            vital_options.append("Pain Level")
            vital_data["Pain Level"] = f"{vitals.pain}/10"
        
        if not vital_options:
            print("\nNo vital signs available for this patient")
            return
        
        print(f"\nAVAILABLE VITAL SIGNS:")
        for i, vital in enumerate(vital_options, 1):
            print(f"  {i}. {vital}")
        
        # Prompt for vital sign selection
        while True:
            choice = self.get_user_input("\nEnter vital sign number (1-{}) or 'back' to return: ".format(len(vital_options)))
            
            if choice == 'back' or choice == 'quit':
                return
            
            try:
                vital_number = int(choice)
                if 1 <= vital_number <= len(vital_options):
                    vital_name = vital_options[vital_number - 1]
                    vital_value = vital_data[vital_name]
                    
                    # Add clinical alerts only (no result display, it will show in status summary)
                    if vital_name == "Oxygen Saturation" and vitals.o2 and vitals.o2 < 90:
                        print("\n[ALERT] Low oxygen saturation - consider oxygen therapy")
                    elif vital_name == "Heart Rate" and vitals.hr:
                        if vitals.hr > 100:
                            print("\n[ALERT] Tachycardia (elevated heart rate)")
                        elif vitals.hr < 60:
                            print("\n[ALERT] Bradycardia (low heart rate)")
                    elif vital_name == "Blood Pressure" and vitals.sbp:
                        if vitals.sbp > 140:
                            print("\n[ALERT] Hypertension (high blood pressure)")
                        elif vitals.sbp < 90:
                            print("\n[ALERT] Hypotension (low blood pressure)")
                    elif vital_name == "Temperature" and vitals.temp:
                        if vitals.temp > 100.4:
                            print("\n[ALERT] Fever (elevated temperature)")
                        elif vitals.temp < 96.8:
                            print("\n[ALERT] Hypothermia (low temperature)")
                    
                    self.user_actions.append({
                        'action': 'vitals_check',
                        'vital': vital_name
                    })
                    # Track checked vitals with their values
                    self.checked_vitals.append({
                        'name': vital_name,
                        'value': vital_value
                    })
                    return
                else:
                    print(f"Invalid number. Please enter 1-{len(vital_options)}")
            except ValueError:
                print(f"Invalid input. Please enter a number 1-{len(vital_options)} or 'back'")
    
    def display_medical_history(self, case: Case):
        """Display patient medical history"""
        print(f"\nMEDICAL HISTORY")
        print(f"{case.history}")
    
    def display_complaint(self, case: Case):
        """Display chief complaint details"""
        print(f"\nCHIEF COMPLAINT")
        print(f"{case.complaint}")
        
        # Provide additional context based on complaint
        complaint_lower = case.complaint.lower()
        if "chest pain" in complaint_lower:
            print("\n[NOTE] Consider: Cardiac monitoring, EKG, cardiac enzymes")
        elif "shortness of breath" in complaint_lower or "dyspnea" in complaint_lower:
            print("\n[NOTE] Consider: Oxygen therapy, chest X-ray, ABG")
        elif "bleeding" in complaint_lower or "laceration" in complaint_lower:
            print("\n[NOTE] Consider: Bleeding control, wound assessment")
        elif "unresponsive" in complaint_lower:
            print("\n[NOTE] Consider: Airway management, neurological assessment")
        elif "abdominal pain" in complaint_lower:
            print("\n[NOTE] Consider: IV access, pain management, imaging")
    
    def display_available_interventions(self, simulation: SimulationEngine):
        """Display available interventions and prompt for selection"""
        interventions = simulation.get_available_interventions()
        
        if not interventions:
            if simulation.patient_state.dead:
                print("\nNo interventions available (patient is deceased)")
            else:
                print("\nAll available interventions have been performed")
            return
        
        print(f"\nAVAILABLE INTERVENTIONS:")
        
        # Map to display names
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
        
        for i, intervention in enumerate(interventions, 1):
            display_name = display_names.get(intervention.value, intervention.value.replace('_', ' ').title())
            print(f"  {i}. {display_name}")
        
        # Prompt for intervention selection
        while True:
            choice = self.get_user_input("\nEnter intervention number (1-{}) or 'back' to return: ".format(len(interventions)))
            
            if choice == 'back' or choice == 'quit':
                return
            
            try:
                intervention_number = int(choice)
                if 1 <= intervention_number <= len(interventions):
                    intervention_type = interventions[intervention_number - 1]
                    result = simulation.perform_intervention(intervention_type)
                    if result['success']:
                        print(f"[SUCCESS] {result['message']}")
                        self.user_actions.append({
                            'action': 'intervention',
                            'intervention': str(intervention_number)
                        })
                        return
                    else:
                        print(f"[ERROR] {result['message']}")
                        return
                else:
                    print(f"Invalid number. Please enter 1-{len(interventions)}")
            except ValueError:
                print(f"Invalid input. Please enter a number 1-{len(interventions)} or 'back'")
    
    def display_triage_options(self):
        """Display triage classification options"""
        print(f"\nTRIAGE CLASSIFICATION")
        print("Please select the appropriate triage level:")
        print("1. ESI Level 1 - Resuscitation (Immediate life-threatening)")
        print("2. ESI Level 2 - Emergent (High risk, unstable)")
        print("3. ESI Level 3 - Urgent (Stable but needs prompt care)")
        print("4. ESI Level 4 - Less Urgent (Stable, can wait)")
        print("5. ESI Level 5 - Non-Urgent (Minor conditions)")
        print("\nType the number (1-5) to select triage level.")
    
    def get_user_input(self, prompt: str = "> ") -> str:
        """Get user input with prompt"""
        return input(prompt).strip().lower()
    
    
    def get_triage_classification(self) -> Optional[int]:
        """Get triage classification from user"""
        while True:
            choice = self.get_user_input("Enter triage level (1-5): ")
            if choice in ['1', '2', '3', '4', '5']:
                triage_level = int(choice)
                self.user_actions.append({
                    'action': 'triage',
                    'level': triage_level
                })
                return triage_level
            elif choice == 'quit':
                return None
            else:
                print("Invalid choice. Please enter 1, 2, 3, 4, or 5.")
    
    def display_help(self):
        """Display help information"""
        print(f"\nHELP - Available Commands:")
        print("  help          - Show this help message")
        print("  vitals        - Display patient vital signs")
        print("  history       - Review patient medical history")
        print("  complaint     - Review chief complaint")
        print("  interventions - Show available interventions")
        print("  triage        - Assign triage classification")
        print("  quit          - Exit simulation")
        print("\nTips:")
        print("  - Review vitals, history, and complaint carefully")
        print("  - Perform necessary interventions")
        print("  - Assign triage level based on patient condition")
    
    def display_simulation_end(self, simulation: SimulationEngine):
        """Display simulation end summary"""
        summary = simulation.get_simulation_summary()
        
        print(f"\nSIMULATION COMPLETE")
        print(f"Final Patient State: {summary['final_state'].upper()}")
        print(f"Interventions Performed: {len(summary['interventions_performed'])}")
        
        if summary['interventions_performed']:
            print("  - " + "\n  - ".join(summary['interventions_performed']))
        
        if summary['critical_interventions_missed']:
            print(f"[WARNING] Critical Interventions Missed: {', '.join(summary['critical_interventions_missed'])}")
        
        if summary['deterioration_occurred']:
            print("[WARNING] Patient deterioration occurred during simulation")
        else:
            print("[SUCCESS] Patient remained stable throughout simulation")
    
    def run_interactive_session(self, simulation: SimulationEngine):
        """Run the main interactive session"""
        self.current_simulation = simulation
        
        while True:
            if simulation.patient_state.dead:
                self.display_simulation_end(simulation)
                break
            
            # Display status summary before each command
            self.display_status_summary(simulation)
            
            command = self.get_user_input("\nEnter your next command: ")
            
            if command == 'help':
                self.display_help()
            elif command == 'vitals':
                self.display_vitals(simulation.case)
            elif command == 'history':
                self.display_medical_history(simulation.case)
            elif command == 'complaint':
                self.display_complaint(simulation.case)
            elif command == 'interventions':
                self.display_available_interventions(simulation)
            elif command == 'triage':
                self.display_triage_options()
                triage_level = self.get_triage_classification()
                if triage_level:
                    print(f"[SUCCESS] Triage Level {triage_level} assigned.")
                    break
                else:
                    continue
            elif command == 'quit':
                print("Exiting simulation...")
                break
            else:
                print("Unknown command. Type 'help' for available commands.")


if __name__ == "__main__":
    # Test the user interface
    from data_loader import DataLoader
    
    ui = UserInterface()
    ui.display_welcome()
    
    # Load a test case
    loader = DataLoader("MIETIC-validate-samples.csv")
    case = loader.get_random_case()
    
    if case:
        ui.display_case_summary(case)
        
        # Display available commands
        ui.display_commands()
        
        # Initialize simulation
        from simulation_engine import SimulationEngine
        simulation = SimulationEngine(case)
        
        # Run interactive session
        ui.run_interactive_session(simulation)
