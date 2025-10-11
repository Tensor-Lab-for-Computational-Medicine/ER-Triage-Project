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
            print(f"Data loaded successfully: {len(self.data_loader.cases)} cases available")
        except Exception as e:
            print(f"Error loading data: {e}")
            sys.exit(1)
    
    def run_single_simulation(self, case: Optional[Case] = None) -> Optional[SimulationSession]:
        """Run a single simulation session"""
        # Get case
        if case is None:
            case = self.data_loader.get_random_case()
        
        if case is None:
            print("No cases available")
            return None
        
        self.current_case = case
        self.current_simulation = SimulationEngine(case)
        
        # Reset tracked vitals for new simulation
        self.user_interface.checked_vitals = []
        
        # Display case summary
        self.user_interface.display_case_summary(case)
        
        # Display available commands
        self.user_interface.display_commands()
        
        # Run interactive session
        user_actions = []
        self.user_interface.current_simulation = self.current_simulation
        
        try:
            # Main interaction loop
            while True:
                if self.current_simulation.patient_state.dead:
                    print("Patient has died. Simulation ending.")
                    break
                
                # Display status summary before each command
                self.user_interface.display_status_summary(self.current_simulation)
                
                command = self.user_interface.get_user_input("\nEnter your next command: ")
                
                if command == 'help':
                    self.user_interface.display_help()
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
                        print(f"[SUCCESS] Triage Level {triage_level} assigned.")
                        user_actions.append({
                            'action': 'triage',
                            'level': triage_level
                        })
                        break
                    else:
                        continue
                elif command == 'quit':
                    print("Exiting simulation...")
                    return None
                else:
                    print("Unknown command. Type 'help' for available commands.")
        
        except KeyboardInterrupt:
            print("\nSimulation interrupted by user.")
            return None
        
        # Create session record
        if user_actions:
            last_triage_action = next((a for a in reversed(user_actions) if a['action'] == 'triage'), None)
            if last_triage_action:
                triage_level = last_triage_action['level']
            else:
                print("[WARNING] No triage level assigned. Using suggested level.")
                triage_level = self.triage_classifier.suggest_triage_level(case, self.current_simulation)
        else:
            print("[WARNING] No actions taken. Using suggested triage level.")
            triage_level = self.triage_classifier.suggest_triage_level(case, self.current_simulation)
        
        session = self.feedback_engine.create_session_record(
            case, self.current_simulation, triage_level, user_actions,
            self.user_interface.checked_vitals
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
    
    def display_overall_performance(self):
        """Display recent sessions"""
        if not self.session_history:
            print("No sessions completed yet.")
            return
        
        print(f"\n{'='*60}")
        print("RECENT SESSIONS")
        print(f"{'='*60}")
        
        for i, session in enumerate(self.session_history[-5:], 1):
            status = "[CORRECT]" if session.correct_triage else "[INCORRECT]"
            print(f"  {i}. User: Level {session.user_triage_level} | Expert: Level {session.ground_truth_level} {status}")
    
    def run(self):
        """Main simulation loop - continuous practice until user exits"""
        self.user_interface.display_welcome()
        
        while True:
            # Run a single simulation
            session = self.run_single_simulation()
            
            # If user quit during simulation, exit
            if session is None:
                print("\nThank you for using ER Triage Simulation!")
                break
            
            # Ask if user wants to continue
            print("\n" + "="*60)
            choice = self.user_interface.get_user_input("Start another simulation? (yes/no): ")
            
            if choice in ['n', 'no', 'quit', 'exit', 'q']:
                print("\nThank you for using ER Triage Simulation!")
                # Display overall performance before exiting
                if self.session_history:
                    self.display_overall_performance()
                break
            elif choice not in ['y', 'yes', '']:
                print("Invalid input. Starting new simulation...")
            
            # Continue to next simulation
            print("\n" + "="*60)


def main():
    """Main entry point"""
    # Check if CSV file exists
    csv_path = "MIETIC-validate-samples.csv"
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found in current directory")
        print("Please ensure the MIETIC validation samples CSV file is in the same directory.")
        sys.exit(1)
    
    # Run simulation
    simulation = ERTriageSimulation(csv_path)
    simulation.run()


if __name__ == "__main__":
    main()
