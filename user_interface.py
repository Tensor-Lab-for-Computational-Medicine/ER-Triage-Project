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
    
    def display_welcome(self):
        """Display welcome message and instructions"""
        print("=" * 60)
        print("🏥 ER TRIAGE SIMULATION - MIETIC/MIMIC")
        print("=" * 60)
        print("Welcome to the Emergency Room Triage Simulation!")
        print("You are a triage nurse evaluating patients in the ED.")
        print("\nYour objectives:")
        print("1. Assess the patient's condition")
        print("2. Perform necessary interventions")
        print("3. Assign appropriate triage classification")
        print("4. Learn from expert feedback")
        print("\nCommands available:")
        print("- 'help' - Show this help message")
        print("- 'status' - Show current patient status")
        print("- 'vitals' - Display patient vital signs")
        print("- 'history' - Review patient medical history")
        print("- 'complaint' - Review chief complaint")
        print("- 'interventions' - Show available interventions")
        print("- 'perform <intervention>' - Perform an intervention")
        print("- 'advance <minutes>' - Advance simulation time")
        print("- 'triage' - Assign triage classification")
        print("- 'quit' - Exit simulation")
        print("=" * 60)
    
    def display_case_summary(self, case: Case):
        """Display initial case summary"""
        print(f"\n📋 NEW PATIENT ARRIVAL")
        print(f"Patient ID: {case.id}")
        print(f"Age: {case.demographics.age:.0f} years")
        print(f"Sex: {case.demographics.sex}")
        print(f"Arrival Method: {case.demographics.transport}")
        print(f"Chief Complaint: {case.complaint}")
        
        # Display available vitals
        vitals = case.vitals
        print(f"\n📊 INITIAL VITAL SIGNS:")
        if vitals.hr is not None:
            print(f"  Heart Rate: {vitals.hr} bpm")
        if vitals.sbp is not None and vitals.dbp is not None:
            print(f"  Blood Pressure: {vitals.sbp}/{vitals.dbp} mmHg")
        elif vitals.sbp is not None:
            print(f"  Systolic BP: {vitals.sbp} mmHg")
        if vitals.rr is not None:
            print(f"  Respiratory Rate: {vitals.rr} breaths/min")
        if vitals.o2 is not None:
            print(f"  Oxygen Saturation: {vitals.o2}%")
        if vitals.temp is not None:
            print(f"  Temperature: {vitals.temp}°F")
        if vitals.pain is not None:
            print(f"  Pain Level: {vitals.pain}/10")
        
        print(f"\n⏰ Simulation started. Time: 0 minutes")
        print("Type 'help' for available commands.")
    
    def display_patient_status(self, simulation: SimulationEngine):
        """Display current patient status"""
        status = simulation.get_patient_status()
        
        print(f"\n📊 PATIENT STATUS")
        print(f"Condition: {status['state'].upper()}")
        print(f"Time Elapsed: {status['time_elapsed']} minutes")
        
        if status['active_conditions']['bleeding']:
            print("⚠️  ACTIVE BLEEDING DETECTED")
        if status['active_conditions']['low_oxygen']:
            print("⚠️  LOW OXYGEN SATURATION")
        
        if status['interventions_performed']:
            print(f"Interventions: {', '.join(status['interventions_performed'])}")
        else:
            print("Interventions: None performed")
        
        if status['deterioration_timer'] > 0:
            print(f"⚠️  Deteriorating for {status['deterioration_timer']} minutes")
    
    def display_vitals(self, case: Case):
        """Display detailed vital signs"""
        vitals = case.vitals
        print(f"\n📊 DETAILED VITAL SIGNS")
        print(f"  Heart Rate: {vitals.hr if vitals.hr else 'Not recorded'} bpm")
        print(f"  Blood Pressure: {vitals.sbp if vitals.sbp else 'Not recorded'}/{vitals.dbp if vitals.dbp else 'Not recorded'} mmHg")
        print(f"  Respiratory Rate: {vitals.rr if vitals.rr else 'Not recorded'} breaths/min")
        print(f"  Oxygen Saturation: {vitals.o2 if vitals.o2 else 'Not recorded'}%")
        print(f"  Temperature: {vitals.temp if vitals.temp else 'Not recorded'}°F")
        print(f"  Pain Level: {vitals.pain if vitals.pain else 'Not recorded'}/10")
        
        # Highlight concerning values
        if vitals.o2 and vitals.o2 < 90:
            print("  ⚠️  Low oxygen saturation - consider oxygen therapy")
        if vitals.hr and (vitals.hr > 100 or vitals.hr < 60):
            print("  ⚠️  Abnormal heart rate")
        if vitals.sbp and (vitals.sbp > 140 or vitals.sbp < 90):
            print("  ⚠️  Abnormal blood pressure")
        if vitals.temp and (vitals.temp > 100.4 or vitals.temp < 96.8):
            print("  ⚠️  Abnormal temperature")
    
    def display_medical_history(self, case: Case):
        """Display patient medical history"""
        print(f"\n📋 MEDICAL HISTORY")
        print(f"{case.history}")
    
    def display_complaint(self, case: Case):
        """Display chief complaint details"""
        print(f"\n🚨 CHIEF COMPLAINT")
        print(f"{case.complaint}")
        
        # Provide additional context based on complaint
        complaint_lower = case.complaint.lower()
        if "chest pain" in complaint_lower:
            print("\n💡 Consider: Cardiac monitoring, EKG, cardiac enzymes")
        elif "shortness of breath" in complaint_lower or "dyspnea" in complaint_lower:
            print("\n💡 Consider: Oxygen therapy, chest X-ray, ABG")
        elif "bleeding" in complaint_lower or "laceration" in complaint_lower:
            print("\n💡 Consider: Bleeding control, wound assessment")
        elif "unresponsive" in complaint_lower:
            print("\n💡 Consider: Airway management, neurological assessment")
        elif "abdominal pain" in complaint_lower:
            print("\n💡 Consider: IV access, pain management, imaging")
    
    def display_available_interventions(self, simulation: SimulationEngine):
        """Display available interventions"""
        interventions = simulation.get_available_interventions()
        
        if not interventions:
            print("\n❌ No interventions available (patient may be deceased)")
            return
        
        print(f"\n🔧 AVAILABLE INTERVENTIONS:")
        for i, intervention in enumerate(interventions, 1):
            print(f"  {i}. {intervention.value.replace('_', ' ').title()}")
        
        print(f"\nTo perform an intervention, type: 'perform <intervention_name>'")
        print(f"Example: 'perform oxygen' or 'perform bleeding_control'")
    
    def display_triage_options(self):
        """Display triage classification options"""
        print(f"\n🏷️  TRIAGE CLASSIFICATION")
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
    
    def perform_intervention(self, simulation: SimulationEngine, intervention_name: str) -> bool:
        """Perform an intervention based on user input"""
        # Map user input to intervention types
        intervention_map = {
            'oxygen': InterventionType.OXYGEN,
            'airway': InterventionType.AIRWAY,
            'bleeding_control': InterventionType.BLEEDING_CONTROL,
            'bleeding': InterventionType.BLEEDING_CONTROL,
            'iv_fluids': InterventionType.IV_FLUIDS,
            'iv': InterventionType.IV_FLUIDS,
            'fluids': InterventionType.IV_FLUIDS,
            'pain_management': InterventionType.PAIN_MANAGEMENT,
            'pain': InterventionType.PAIN_MANAGEMENT,
            'cardiac_monitoring': InterventionType.CARDIAC_MONITORING,
            'monitoring': InterventionType.CARDIAC_MONITORING
        }
        
        intervention_type = intervention_map.get(intervention_name)
        if not intervention_type:
            print(f"❌ Unknown intervention: {intervention_name}")
            print("Available interventions:")
            for name in intervention_map.keys():
                print(f"  - {name}")
            return False
        
        result = simulation.perform_intervention(intervention_type)
        if result['success']:
            print(f"✅ {result['message']}")
            self.user_actions.append({
                'action': 'intervention',
                'intervention': intervention_name,
                'time': simulation.patient_state.time_elapsed
            })
        else:
            print(f"❌ {result['message']}")
        
        return result['success']
    
    def advance_time(self, simulation: SimulationEngine, minutes: int) -> bool:
        """Advance simulation time"""
        result = simulation.advance_time(minutes)
        print(f"⏰ {result['message']}")
        
        # Check if patient died
        if simulation.patient_state.dead:
            print("💀 Patient has died. Simulation ending.")
            return False
        
        return True
    
    def get_triage_classification(self) -> Optional[int]:
        """Get triage classification from user"""
        while True:
            choice = self.get_user_input("Enter triage level (1-5): ")
            if choice in ['1', '2', '3', '4', '5']:
                triage_level = int(choice)
                self.user_actions.append({
                    'action': 'triage',
                    'level': triage_level,
                    'time': self.current_simulation.patient_state.time_elapsed if self.current_simulation else 0
                })
                return triage_level
            elif choice == 'quit':
                return None
            else:
                print("❌ Invalid choice. Please enter 1, 2, 3, 4, or 5.")
    
    def display_help(self):
        """Display help information"""
        print(f"\n📖 HELP - Available Commands:")
        print("  help          - Show this help message")
        print("  status        - Show current patient status")
        print("  vitals        - Display patient vital signs")
        print("  history       - Review patient medical history")
        print("  complaint     - Review chief complaint")
        print("  interventions - Show available interventions")
        print("  perform <name>- Perform an intervention")
        print("  advance <min> - Advance simulation time")
        print("  triage        - Assign triage classification")
        print("  quit          - Exit simulation")
        print("\n💡 Tips:")
        print("  - Monitor patient status regularly")
        print("  - Perform interventions for critical conditions")
        print("  - Advance time to see patient progression")
        print("  - Assign triage level based on patient condition")
    
    def display_simulation_end(self, simulation: SimulationEngine):
        """Display simulation end summary"""
        summary = simulation.get_simulation_summary()
        
        print(f"\n🏁 SIMULATION COMPLETE")
        print(f"Final Patient State: {summary['final_state'].upper()}")
        print(f"Total Time: {summary['total_time']} minutes")
        print(f"Interventions Performed: {len(summary['interventions_performed'])}")
        
        if summary['interventions_performed']:
            print("  - " + "\n  - ".join(summary['interventions_performed']))
        
        if summary['critical_interventions_missed']:
            print(f"⚠️  Critical Interventions Missed: {', '.join(summary['critical_interventions_missed'])}")
        
        if summary['deterioration_occurred']:
            print("⚠️  Patient deterioration occurred during simulation")
        else:
            print("✅ Patient remained stable throughout simulation")
    
    def run_interactive_session(self, simulation: SimulationEngine):
        """Run the main interactive session"""
        self.current_simulation = simulation
        
        while True:
            if simulation.patient_state.dead:
                self.display_simulation_end(simulation)
                break
            
            command = self.get_user_input("\n> ")
            
            if command == 'help':
                self.display_help()
            elif command == 'status':
                self.display_patient_status(simulation)
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
                    print(f"✅ Triage Level {triage_level} assigned.")
                    break
                else:
                    continue
            elif command.startswith('perform '):
                intervention_name = command[8:].strip()
                self.perform_intervention(simulation, intervention_name)
            elif command.startswith('advance '):
                try:
                    minutes = int(command[8:].strip())
                    if not self.advance_time(simulation, minutes):
                        break
                except ValueError:
                    print("❌ Invalid time. Please enter a number of minutes.")
            elif command == 'quit':
                print("👋 Exiting simulation...")
                break
            else:
                print("❌ Unknown command. Type 'help' for available commands.")


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
        
        # Initialize simulation
        from simulation_engine import SimulationEngine
        simulation = SimulationEngine(case)
        
        # Run interactive session
        ui.run_interactive_session(simulation)
