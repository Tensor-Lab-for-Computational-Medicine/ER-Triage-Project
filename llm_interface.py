"""
LLM Interface for Patient Interaction
Handles OpenAI API calls for natural language patient responses
"""

import os
from typing import Dict, Optional
from openai import OpenAI
from dotenv import load_dotenv
from data_loader import Case


class PatientLLM:
    """Handles LLM-powered patient responses grounded in MIETIC data"""
    
    def __init__(self):
        """Initialize the OpenAI client with API key from .env"""
        load_dotenv()
        self.api_key = os.getenv('OPENAI_API_KEY')
        self.model = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
        
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY not found in .env file")
        
        self.client = OpenAI(api_key=self.api_key)
    
    def _create_system_prompt(self, case: Case) -> str:
        """Create system prompt grounding LLM in patient data"""
        return f"""You are a patient in an emergency department. A triage nurse is asking you questions.

Your information:
- Age: {case.demographics.age:.0f}, Sex: {case.demographics.sex}
- Chief Complaint: {case.complaint}
- Medical History: {case.history}
- Arrival Method: {case.demographics.transport}

Guidelines:
1. Answer ONLY as the patient would - use layperson language
2. Base ALL answers on the provided data - do NOT invent conditions or symptoms
3. You do NOT know your vital signs or medical test results
4. If asked something you don't know, say "I'm not sure" or "I don't know"
5. Stay in character - politely redirect off-topic questions
6. Be brief and realistic - typical triage responses (1-3 sentences)

Respond naturally to the nurse's question."""
    
    def ask_chief_complaint(self, case: Case, user_question: str) -> str:
        """
        Get patient's response to chief complaint question
        
        Args:
            case: Patient case data from MIETIC
            user_question: The nurse's question
            
        Returns:
            Patient's response as a string
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._create_system_prompt(case)},
                    {"role": "user", "content": user_question}
                ],
                temperature=0.7,
                max_tokens=150
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            return f"[Error communicating with patient: {str(e)}]"
    
    def ask_medical_history(self, case: Case, user_question: str) -> str:
        """
        Get patient's response to medical history question
        
        Args:
            case: Patient case data from MIETIC
            user_question: The nurse's question
            
        Returns:
            Patient's response as a string
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._create_system_prompt(case)},
                    {"role": "user", "content": user_question}
                ],
                temperature=0.7,
                max_tokens=150
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            return f"[Error communicating with patient: {str(e)}]"

