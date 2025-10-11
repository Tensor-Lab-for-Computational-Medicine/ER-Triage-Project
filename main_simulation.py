"""
Main Simulation Loop for ER Triage Simulation
Integrates all components to provide structured triage workflow
"""

import sys
import os
from typing import Optional, List
from data_loader import DataLoader, Case
from user_interface import UserInterface
from feedback_engine import FeedbackEngine, SimulationSession
from llm_interface import PatientLLM
from structured_triage import StructuredTriageWorkflow


class ERTriageSimulation:
    """Main simulation class that orchestrates all components"""
    
    def __init__(self, csv_path: str = "MIETIC-validate-samples.csv"):
        """Initialize the simulation with data source"""
        self.csv_path = csv_path
        self.data_loader: Optional[DataLoader] = None
        self.user_interface = UserInterface()
        self.feedback_engine = FeedbackEngine()
        self.session_history: List[SimulationSession] = []
        
        # Initialize LLM interface
        try:
            self.llm = PatientLLM()
        except ValueError as e:
            print(f"Error initializing LLM: {e}")
            print("Please create a .env file with your OPENAI_API_KEY")
            sys.exit(1)
        
        # Initialize structured workflow
        self.workflow = StructuredTriageWorkflow(
            self.user_interface, 
            self.llm,
            self.feedback_engine
        )
        
        # Initialize data loader
        try:
            self.data_loader = DataLoader(csv_path)
            print(f"Data loaded successfully: {len(self.data_loader.cases)} cases available")
        except Exception as e:
            print(f"Error loading data: {e}")
            sys.exit(1)
    
    def run_single_simulation(self, case: Optional[Case] = None) -> Optional[SimulationSession]:
        """Run a single structured triage simulation"""
        # Get case
        if case is None:
            case = self.data_loader.get_random_case()
        
        if case is None:
            print("No cases available")
            return None
        
        # Reset UI state for new simulation
        self.user_interface.checked_vitals = []
        self.user_interface.chief_complaint_question = None
        self.user_interface.medical_history_question = None
        
        # Run the structured workflow
        session = self.workflow.run_complete_workflow(case)
        
        if session:
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
