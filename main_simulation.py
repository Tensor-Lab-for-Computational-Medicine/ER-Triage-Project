"""
Main Simulation Loop for ER Triage Simulation
Integrates all components to provide complete simulation experience
"""

import sys
import os
from typing import Optional, List, Dict, Any
from data_loader import DataLoader, Case
from simulation_engine import SimulationEngine
from user_interface import UserInterface
from triage_classification import TriageClassifier
from feedback_engine import FeedbackEngine, SimulationSession


class ERTriageSimulation:
    """Main simulation class that orchestrates all components"""
    
    def __init__(self, csv_path: str = "MIETIC-validate-samples.csv"):
        """Initialize the simulation with data source"""
        self.csv_path = csv_path
        self.data_loader: Optional[DataLoader] = None
        self.user_interface = UserInterface()
        self.triage_classifier = TriageClassifier()
        self.feedback_engine = FeedbackEngine()
        self.current_case: Optional[Case] = None
        self.current_simulation: Optional[SimulationEngine] = None
        self.session_history: List[SimulationSession] = []
        
        # Initialize data loader
        try:
            self.data_loader = DataLoader(csv_path)
            print(f"✅ Data loaded successfully: {len(self.data_loader.cases)} cases available")
        except Exception as e:
            print(f"❌ Error loading data: {e}")
            sys.exit(1)
    
    def run_single_simulation(self, case: Optional[Case] = None) -> Optional[SimulationSession]:
        """Run a single simulation session"""
        # Get case
        if case is None:
            case = self.data_loader.get_random_case()
        
        if case is None:
            print("❌ No cases available")
            return None
        
        self.current_case = case
        self.current_simulation = SimulationEngine(case)
        
        # Display case summary
        self.user_interface.display_case_summary(case)
        
        # Run interactive session
        user_actions = []
        self.user_interface.current_simulation = self.current_simulation
        
        try:
            # Main interaction loop
            while True:
                if self.current_simulation.patient_state.dead:
                    print("💀 Patient has died. Simulation ending.")
                    break
                
                command = self.user_interface.get_user_input("\n> ")
                
                if command == 'help':
                    self.user_interface.display_help()
                elif command == 'status':
                    self.user_interface.display_patient_status(self.current_simulation)
                elif command == 'vitals':
                    self.user_interface.display_vitals(case)
                elif command == 'history':
                    self.user_interface.display_medical_history(case)
                elif command == 'complaint':
                    self.user_interface.display_complaint(case)
                elif command == 'interventions':
                    self.user_interface.display_available_interventions(self.current_simulation)
                elif command == 'triage':
                    self.user_interface.display_triage_options()
                    triage_level = self.user_interface.get_triage_classification()
                    if triage_level:
                        print(f"✅ Triage Level {triage_level} assigned.")
                        user_actions.append({
                            'action': 'triage',
                            'level': triage_level,
                            'time': self.current_simulation.patient_state.time_elapsed
                        })
                        break
                    else:
                        continue
                elif command.startswith('perform '):
                    intervention_name = command[8:].strip()
                    success = self.user_interface.perform_intervention(self.current_simulation, intervention_name)
                    if success:
                        user_actions.append({
                            'action': 'intervention',
                            'intervention': intervention_name,
                            'time': self.current_simulation.patient_state.time_elapsed
                        })
                elif command.startswith('advance '):
                    try:
                        minutes = int(command[8:].strip())
                        if not self.user_interface.advance_time(self.current_simulation, minutes):
                            break
                    except ValueError:
                        print("❌ Invalid time. Please enter a number of minutes.")
                elif command == 'quit':
                    print("👋 Exiting simulation...")
                    return None
                else:
                    print("❌ Unknown command. Type 'help' for available commands.")
        
        except KeyboardInterrupt:
            print("\n👋 Simulation interrupted by user.")
            return None
        
        # Create session record
        if user_actions:
            last_triage_action = next((a for a in reversed(user_actions) if a['action'] == 'triage'), None)
            if last_triage_action:
                triage_level = last_triage_action['level']
            else:
                print("⚠️  No triage level assigned. Using suggested level.")
                triage_level = self.triage_classifier.suggest_triage_level(case, self.current_simulation)
        else:
            print("⚠️  No actions taken. Using suggested triage level.")
            triage_level = self.triage_classifier.suggest_triage_level(case, self.current_simulation)
        
        session = self.feedback_engine.create_session_record(
            case, self.current_simulation, triage_level, user_actions
        )
        
        # Generate and display feedback
        feedback = self.feedback_engine.generate_comprehensive_feedback(
            session, case, self.current_simulation
        )
        self.feedback_engine.display_feedback(feedback)
        
        # Save session
        self.feedback_engine.save_session(session)
        self.session_history.append(session)
        
        return session
    
    def run_multiple_simulations(self, num_simulations: int = 5):
        """Run multiple simulation sessions"""
        print(f"\n🎯 Starting {num_simulations} simulation sessions...")
        
        for i in range(num_simulations):
            print(f"\n{'='*60}")
            print(f"SIMULATION SESSION {i+1}/{num_simulations}")
            print(f"{'='*60}")
            
            session = self.run_single_simulation()
            
            if session is None:
                print("Session cancelled or failed.")
                continue
            
            # Ask if user wants to continue
            if i < num_simulations - 1:
                continue_choice = self.user_interface.get_user_input("\nContinue to next simulation? (y/n): ")
                if continue_choice.lower() != 'y':
                    break
        
        # Display overall performance summary
        self.display_overall_performance()
    
    def run_practice_mode(self):
        """Run practice mode with guided learning"""
        print("\n🎓 PRACTICE MODE")
        print("This mode provides guided learning with hints and explanations.")
        
        case = self.data_loader.get_random_case()
        if case is None:
            print("❌ No cases available")
            return
        
        print(f"\n📋 Practice Case: {case.complaint}")
        print(f"Patient: {case.demographics.age:.0f} year old {case.demographics.sex}")
        
        # Show suggested approach
        simulation = SimulationEngine(case)
        suggested_triage = self.triage_classifier.suggest_triage_level(case, simulation)
        suggested_desc = self.triage_classifier.get_triage_description(suggested_triage)
        
        print(f"\n💡 Suggested Approach:")
        print(f"  - Consider ESI Level {suggested_triage} ({suggested_desc['name']})")
        print(f"  - Key criteria: {', '.join(suggested_desc['criteria'][:2])}")
        
        # Show available interventions
        interventions = simulation.get_available_interventions()
        if interventions:
            print(f"  - Available interventions: {', '.join([i.value for i in interventions])}")
        
        # Run simulation with hints
        self.run_single_simulation(case)
    
    def run_case_study_mode(self, case_id: Optional[str] = None):
        """Run case study mode focusing on specific cases"""
        if case_id:
            case = self.data_loader.get_case_by_id(case_id)
            if case is None:
                print(f"❌ Case {case_id} not found")
                return
        else:
            # Show available cases by acuity
            print("\n📚 CASE STUDY MODE")
            print("Select a case to study:")
            
            for acuity in [1, 2, 3, 4, 5]:
                cases = self.data_loader.get_cases_by_acuity(acuity)
                if cases:
                    print(f"  {acuity}. ESI Level {acuity} cases ({len(cases)} available)")
            
            choice = self.user_interface.get_user_input("Enter acuity level (1-5): ")
            try:
                acuity = int(choice)
                cases = self.data_loader.get_cases_by_acuity(acuity)
                if cases:
                    case = cases[0]  # Take first case of this acuity
                else:
                    print(f"❌ No cases found for acuity level {acuity}")
                    return
            except ValueError:
                print("❌ Invalid choice")
                return
        
        print(f"\n📖 CASE STUDY: {case.complaint}")
        print(f"Expert Assessment: ESI Level {case.acuity}")
        
        # Show expert opinions
        if case.expert_opinions:
            print(f"\n👨‍⚕️ Expert Opinions:")
            for expert, opinion in case.expert_opinions.items():
                if opinion and opinion != 'nan':
                    print(f"  {expert.replace('_', ' ').title()}: {opinion}")
        
        # Run simulation
        self.run_single_simulation(case)
    
    def display_overall_performance(self):
        """Display overall performance across all sessions"""
        if not self.session_history:
            print("No sessions completed yet.")
            return
        
        print(f"\n{'='*60}")
        print("📊 OVERALL PERFORMANCE SUMMARY")
        print(f"{'='*60}")
        
        total_sessions = len(self.session_history)
        correct_triages = sum(1 for s in self.session_history if s.correct_triage)
        avg_time = sum(s.total_time for s in self.session_history) / total_sessions
        
        print(f"Total Sessions: {total_sessions}")
        print(f"Triage Accuracy: {correct_triages}/{total_sessions} ({correct_triages/total_sessions:.1%})")
        print(f"Average Time per Session: {avg_time:.1f} minutes")
        
        # Performance by acuity level
        acuity_performance = {}
        for session in self.session_history:
            acuity = session.ground_truth_level
            if acuity not in acuity_performance:
                acuity_performance[acuity] = {'total': 0, 'correct': 0}
            acuity_performance[acuity]['total'] += 1
            if session.correct_triage:
                acuity_performance[acuity]['correct'] += 1
        
        print(f"\nPerformance by Acuity Level:")
        for acuity in sorted(acuity_performance.keys()):
            stats = acuity_performance[acuity]
            accuracy = stats['correct'] / stats['total']
            print(f"  ESI Level {acuity}: {stats['correct']}/{stats['total']} ({accuracy:.1%})")
        
        # Recent sessions
        print(f"\nRecent Sessions:")
        for i, session in enumerate(self.session_history[-5:], 1):
            status = "✅" if session.correct_triage else "❌"
            print(f"  {i}. {session.case_id}: Level {session.user_triage_level} → {status} ({session.total_time}min)")
    
    def display_main_menu(self):
        """Display main menu options"""
        print(f"\n{'='*60}")
        print("🏥 ER TRIAGE SIMULATION - MAIN MENU")
        print(f"{'='*60}")
        print("1. Single Simulation (Random Case)")
        print("2. Multiple Simulations (Practice Session)")
        print("3. Practice Mode (Guided Learning)")
        print("4. Case Study Mode (Specific Cases)")
        print("5. View Performance Summary")
        print("6. View Dataset Statistics")
        print("7. Exit")
        print(f"{'='*60}")
    
    def run(self):
        """Main simulation loop"""
        self.user_interface.display_welcome()
        
        while True:
            self.display_main_menu()
            choice = self.user_interface.get_user_input("Select option (1-7): ")
            
            if choice == '1':
                self.run_single_simulation()
            elif choice == '2':
                try:
                    num = int(self.user_interface.get_user_input("Number of simulations (1-10): "))
                    self.run_multiple_simulations(min(max(num, 1), 10))
                except ValueError:
                    print("❌ Invalid number")
            elif choice == '3':
                self.run_practice_mode()
            elif choice == '4':
                self.run_case_study_mode()
            elif choice == '5':
                self.display_overall_performance()
            elif choice == '6':
                stats = self.data_loader.get_statistics()
                print(f"\n📊 Dataset Statistics:")
                for key, value in stats.items():
                    print(f"  {key}: {value}")
            elif choice == '7':
                print("👋 Thank you for using ER Triage Simulation!")
                break
            else:
                print("❌ Invalid choice. Please select 1-7.")


def main():
    """Main entry point"""
    # Check if CSV file exists
    csv_path = "MIETIC-validate-samples.csv"
    if not os.path.exists(csv_path):
        print(f"❌ Error: {csv_path} not found in current directory")
        print("Please ensure the MIETIC validation samples CSV file is in the same directory.")
        sys.exit(1)
    
    # Run simulation
    simulation = ERTriageSimulation(csv_path)
    simulation.run()


if __name__ == "__main__":
    main()
