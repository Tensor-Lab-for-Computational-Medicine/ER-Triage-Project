"""
Structured Triage Workflow Manager
Manages the 7-step triage process with LLM integration
"""

from typing import Dict, List, Optional
from data_loader import Case
from simulation_engine import SimulationEngine
from user_interface import UserInterface
from llm_interface import PatientLLM
from feedback_engine import FeedbackEngine, SimulationSession


class StructuredTriageWorkflow:
    """Manages the structured 7-step triage workflow"""
    
    def __init__(self, ui: UserInterface, llm: PatientLLM, feedback_engine: FeedbackEngine):
        """Initialize workflow with required components"""
        self.ui = ui
        self.llm = llm
        self.feedback_engine = feedback_engine
    
    def step1_patient_identification(self, case: Case):
        """Step 1: Display patient identification"""
        print("\n" + "="*60)
        print("PATIENT ARRIVAL")
        print("="*60)
        print(f"Age: {case.demographics.age:.0f} years")
        print(f"Sex: {case.demographics.sex}")
        print(f"Arrival Transport: {case.demographics.transport}")
        print("="*60)
    
    def step2_chief_complaint(self, case: Case) -> str:
        """Step 2: Ask about chief complaint (single Q&A)"""
        print("\n" + "="*60)
        print("STEP 1: CHIEF COMPLAINT")
        print("="*60)
        print("Ask the patient about their chief complaint.")
        
        question = self.ui.prompt_chief_complaint_question()
        self.ui.chief_complaint_question = question
        
        print("\nAsking patient...")
        response = self.llm.ask_chief_complaint(case, question)
        self.ui.display_llm_response(response)
        
        return question
    
    def step3_vital_signs(self, case: Case) -> List[Dict]:
        """Step 3: Measure vital signs (multi-select, one chance)"""
        print("\n" + "="*60)
        print("STEP 2: VITAL SIGNS MEASUREMENT")
        print("="*60)
        print("Select which vital signs you want to measure.")
        print("You can select multiple vitals at once.")
        
        # Get all available vitals
        vitals_data = []
        vitals = case.vitals
        
        available_vitals = []
        if vitals.hr is not None:
            available_vitals.append(("Heart Rate", f"{vitals.hr} bpm"))
        if vitals.sbp is not None or vitals.dbp is not None:
            sbp_str = str(int(vitals.sbp)) if vitals.sbp is not None else '?'
            dbp_str = str(int(vitals.dbp)) if vitals.dbp is not None else '?'
            available_vitals.append(("Blood Pressure", f"{sbp_str}/{dbp_str} mmHg"))
        if vitals.rr is not None:
            available_vitals.append(("Respiratory Rate", f"{vitals.rr} breaths/min"))
        if vitals.o2 is not None:
            available_vitals.append(("Oxygen Saturation", f"{vitals.o2}%"))
        if vitals.temp is not None:
            available_vitals.append(("Temperature", f"{vitals.temp}°F"))
        if vitals.pain is not None:
            available_vitals.append(("Pain Level", f"{vitals.pain}/10"))
        
        selected_indices = self.ui.prompt_vitals_selection(available_vitals)
        
        # Get results for selected vitals
        for idx in selected_indices:
            name, value = available_vitals[idx]
            vitals_data.append({"name": name, "value": value})
        
        self.ui.checked_vitals = vitals_data
        self.ui.display_all_vital_results(vitals_data)
        
        return vitals_data
    
    def step4_medical_history(self, case: Case) -> str:
        """Step 4: Ask about medical history (single Q&A)"""
        print("\n" + "="*60)
        print("STEP 3: MEDICAL HISTORY")
        print("="*60)
        print("Ask the patient one question about their medical history.")
        
        question = self.ui.prompt_medical_history_question()
        self.ui.medical_history_question = question
        
        print("\nAsking patient...")
        response = self.llm.ask_medical_history(case, question)
        self.ui.display_llm_response(response)
        
        return question
    
    def step5_triage_assignment(self) -> int:
        """Step 5: Assign triage level"""
        print("\n" + "="*60)
        print("STEP 4: TRIAGE ASSIGNMENT")
        print("="*60)
        
        self.ui.display_triage_options()
        triage_level = self.ui.get_triage_classification()
        
        if triage_level:
            print(f"\n[SUCCESS] Triage Level {triage_level} assigned.")
        
        return triage_level
    
    def step6_interventions(self, simulation: SimulationEngine) -> List[str]:
        """Step 6: Order interventions (multi-select, one chance)"""
        print("\n" + "="*60)
        print("STEP 5: INTERVENTION ORDERING")
        print("="*60)
        print("Select which interventions you want to perform.")
        print("You can select multiple interventions at once.")
        
        available_interventions = simulation.get_available_interventions()
        
        if not available_interventions:
            print("\nNo interventions available.")
            return []
        
        selected_interventions = self.ui.prompt_intervention_selection(available_interventions)
        
        # Perform selected interventions
        performed = []
        for intervention in selected_interventions:
            result = simulation.perform_intervention(intervention)
            if result['success']:
                performed.append(intervention.value)
        
        if performed:
            print(f"\n[SUCCESS] {len(performed)} intervention(s) performed.")
        else:
            print("\nNo interventions performed.")
        
        return performed
    
    def step7_feedback(self, session: SimulationSession, case: Case, simulation: SimulationEngine):
        """Step 7: Display feedback report"""
        print("\n" + "="*60)
        print("GENERATING FEEDBACK REPORT")
        print("="*60)
        
        feedback = self.feedback_engine.generate_comprehensive_feedback(
            session, case, simulation
        )
        self.feedback_engine.display_feedback(feedback)
    
    def run_complete_workflow(self, case: Case) -> Optional[SimulationSession]:
        """
        Run the complete 7-step triage workflow
        
        Returns:
            SimulationSession with all collected data, or None if quit
        """
        try:
            # Create simulation engine
            simulation = SimulationEngine(case)
            
            # Step 1: Patient Identification
            self.step1_patient_identification(case)
            
            # Step 2: Chief Complaint
            complaint_question = self.step2_chief_complaint(case)
            
            # Step 3: Vital Signs
            vitals_checked = self.step3_vital_signs(case)
            
            # Step 4: Medical History
            history_question = self.step4_medical_history(case)
            
            # Step 5: Triage Assignment
            triage_level = self.step5_triage_assignment()
            
            if not triage_level:
                print("\nSimulation cancelled.")
                return None
            
            # Step 6: Interventions
            interventions = self.step6_interventions(simulation)
            
            # Create session record
            user_actions = [
                {'action': 'chief_complaint_question', 'question': complaint_question},
                {'action': 'medical_history_question', 'question': history_question},
                {'action': 'triage', 'level': triage_level}
            ]
            
            session = self.feedback_engine.create_session_record(
                case, simulation, triage_level, user_actions, vitals_checked
            )
            
            # Add questions to session
            session.chief_complaint_question = complaint_question
            session.medical_history_question = history_question
            
            # Step 7: Feedback
            self.step7_feedback(session, case, simulation)
            
            # Save session
            self.feedback_engine.save_session(session)
            
            return session
            
        except KeyboardInterrupt:
            print("\n\nSimulation interrupted by user.")
            return None
        except Exception as e:
            print(f"\n\nError during simulation: {e}")
            return None

