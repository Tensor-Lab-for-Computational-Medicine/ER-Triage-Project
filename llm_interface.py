"""
LLM Interface for Patient Interaction
Handles OpenRouter/OpenAI-compatible API calls for patient responses
"""

import os
import json
from typing import Dict, Optional, Generator
from dotenv import load_dotenv
from data_loader import Case

try:
    from openai import OpenAI
    legacy_openai = None
except ImportError:
    OpenAI = None
    import openai as legacy_openai


class PatientLLM:
    """Handles LLM-powered patient responses grounded in MIETIC data"""
    
    def __init__(self):
        """Initialize the OpenAI-compatible client with API settings from .env"""
        load_dotenv()
        self.provider = os.getenv('LLM_PROVIDER', 'openrouter').lower()
        self.openrouter_api_key = os.getenv('OPENROUTER_API_KEY')
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        self.base_url = os.getenv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
        self.model = os.getenv('OPENROUTER_MODEL') or os.getenv('OPENAI_MODEL') or 'openai/gpt-4o-mini'
        self.legacy_openai = None
        
        if self.provider == 'openai':
            api_key = self.openai_api_key
            base_url = None
            provider_label = 'OpenAI'
        else:
            api_key = self.openrouter_api_key
            base_url = self.base_url
            provider_label = 'OpenRouter'

        if not api_key:
            print(f"{provider_label} API key not found. Using local case-grounded patient responses.")
            self.client = None
        elif OpenAI is None:
            print(f"Using legacy OpenAI Python client for {provider_label}.")
            legacy_openai.api_key = api_key
            if base_url:
                legacy_openai.api_base = base_url
            self.client = None
            self.legacy_openai = legacy_openai
        else:
            client_kwargs = {'api_key': api_key}
            if base_url:
                client_kwargs['base_url'] = base_url
                client_kwargs['default_headers'] = {
                    'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:3000'),
                    'X-OpenRouter-Title': os.getenv('OPENROUTER_APP_TITLE', 'ED Triage Trainer')
                }
            self.client = OpenAI(**client_kwargs)
            print(f"Using {provider_label} model: {self.model}")
    
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
        if self.client is None and self.legacy_openai is None:
            return self._fallback_response(case, user_question, "chief_complaint")

        try:
            if self.legacy_openai is not None:
                response = self.legacy_openai.ChatCompletion.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": self._create_system_prompt(case)},
                        {"role": "user", "content": user_question}
                    ],
                    temperature=0.7,
                    max_tokens=150
                )
                return response["choices"][0]["message"]["content"].strip()
            else:
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
        if self.client is None and self.legacy_openai is None:
            return self._fallback_response(case, user_question, "history")

        try:
            if self.legacy_openai is not None:
                response = self.legacy_openai.ChatCompletion.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": self._create_system_prompt(case)},
                        {"role": "user", "content": user_question}
                    ],
                    temperature=0.7,
                    max_tokens=150
                )
                return response["choices"][0]["message"]["content"].strip()
            else:
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
    
    def ask_with_streaming(self, case: Case, user_question: str) -> Generator[str, None, None]:
        """
        Get patient's response with streaming support
        
        Args:
            case: Patient case data from MIETIC
            user_question: The nurse's question
            
        Yields:
            Chunks of the patient's response as they're generated
        """
        if self.client is None and self.legacy_openai is None:
            response = self._fallback_response(case, user_question, "interview")
            for word in response.split(" "):
                yield f"{word} "
            return

        try:
            if self.legacy_openai is not None:
                stream = self.legacy_openai.ChatCompletion.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": self._create_system_prompt(case)},
                        {"role": "user", "content": user_question}
                    ],
                    temperature=0.7,
                    max_tokens=150,
                    stream=True
                )

                for chunk in stream:
                    delta = chunk["choices"][0].get("delta", {})
                    if delta.get("content") is not None:
                        yield delta["content"]
            else:
                stream = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": self._create_system_prompt(case)},
                        {"role": "user", "content": user_question}
                    ],
                    temperature=0.7,
                    max_tokens=150,
                    stream=True
                )
                
                for chunk in stream:
                    if chunk.choices[0].delta.content is not None:
                        yield chunk.choices[0].delta.content
                    
        except Exception as e:
            yield f"[Error communicating with patient: {str(e)}]"

    def ask_tutor_question(self, case: Case, feedback: Dict, user_question: str) -> str:
        """
        Answer a post-case teaching question using only case and debrief context.

        Args:
            case: Patient case data from MIETIC
            feedback: Generated feedback object for the completed session
            user_question: Learner's post-case question

        Returns:
            Tutor response as a string
        """
        structured_answer = self._structured_intervention_answer(feedback, user_question)
        if structured_answer:
            return structured_answer

        if self.client is None and self.legacy_openai is None:
            return self._fallback_tutor_response(feedback, user_question)

        messages = [
            {"role": "system", "content": self._create_tutor_system_prompt(case, feedback)},
            {"role": "user", "content": user_question}
        ]

        try:
            if self.legacy_openai is not None:
                response = self.legacy_openai.ChatCompletion.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.3,
                    max_tokens=450
                )
                return response["choices"][0]["message"]["content"].strip()
            else:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.3,
                    max_tokens=450
                )
                return response.choices[0].message.content.strip()
        except Exception as e:
            return f"[Error from clinical tutor: {str(e)}]"

    def _create_tutor_system_prompt(self, case: Case, feedback: Dict) -> str:
        """Create a bounded clinical tutoring prompt for post-case questions."""
        case_context = {
            "age": case.demographics.age,
            "sex": case.demographics.sex,
            "arrival_transport": case.demographics.transport,
            "chief_complaint": case.complaint,
            "history": case.history,
            "reference_esi": case.acuity,
            "disposition": case.disposition,
            "feedback": feedback
        }

        return f"""You are a clinical educator for an emergency department triage training app.

Use only the case data and debrief context below. Do not invent diagnoses, tests, or medications that are not documented. If the data does not prove why an intervention occurred, say what the intervention generally signals and what evidence in this case supports or does not support it.

Keep learner-selected actions separate from reference ED actions. If a learner asks why a reference action happened, answer from feedback.clinical_feedback. If that exact reference action is not present, say it was not recorded.

Teach in concise, practical language for a medical learner. Explain ESI reasoning, resource needs, and safety risks. This is educational support, not patient-specific medical advice.

Case and debrief context:
{json.dumps(case_context, default=str, indent=2)}
"""

    def _structured_intervention_answer(self, feedback: Dict, user_question: str) -> Optional[str]:
        """Answer direct intervention questions from structured feedback first."""
        question = (user_question or "").lower()
        clinical = feedback.get("clinical_feedback", []) or []

        intervention_keywords = {
            "invasive_ventilation": ["intubat", "ventilat", "airway"],
            "intravenous": ["iv", "intravenous", "access"],
            "intravenous_fluids": ["fluid", "fluids"],
            "intramuscular": ["im ", "intramuscular"],
            "oral_medications": ["oral", "by mouth", "po "],
            "nebulized_medications": ["neb", "nebulized", "breathing treatment"],
            "tier1_med_usage_1h": ["emergency medication", "tier 1"],
            "tier2_med_usage": ["urgent medication", "tier 2"],
            "tier3_med_usage": ["stabilizing medication", "tier 3"],
            "tier4_med_usage": ["routine medication", "tier 4"],
            "critical_procedure": ["critical procedure", "procedure"],
            "psychotropic_med_within_120min": ["psychotropic", "agitation", "behavioral"]
        }

        matched_value = None
        for value, keywords in intervention_keywords.items():
            if any(keyword in f" {question} " for keyword in keywords):
                matched_value = value
                break

        if not matched_value:
            return None

        found = next((item for item in clinical if item.get("value") == matched_value), None)
        if found:
            return (
                f"The reference record includes this action: {found['name']}. "
                f"{found['explanation']} The dataset does not specify the exact bedside reasoning or medication name, "
                "so treat this as an educational signal rather than proof of a specific indication."
            )

        label = matched_value.replace("_", " ").replace("medications", "medication")
        return (
            f"That action was not recorded in the reference ED intervention fields for this case "
            f"({label}). If you selected it, compare your reasoning against the actual reference actions and the ESI resource estimate."
        )

    def _fallback_tutor_response(self, feedback: Dict, user_question: str) -> str:
        """Return a deterministic tutor answer if no LLM client is configured."""
        question = (user_question or "").lower()
        triage = feedback.get("triage_analysis", {})
        clinical = feedback.get("clinical_feedback", [])

        if "intubat" in question:
            found = next((item for item in clinical if item.get("value") == "invasive_ventilation"), None)
            if found:
                return found["explanation"]
            return "This case did not record endotracheal intubation. In general, intubation is tied to airway protection, respiratory failure, or inability to ventilate safely."

        if "iv" in question or "intravenous" in question:
            found = next((item for item in clinical if item.get("value") == "intravenous"), None)
            if found:
                return found["explanation"]
            return "This case did not record IV access in the tracked intervention fields. In triage reasoning, IV access usually signals likely labs, medications, fluids, imaging contrast, or risk of deterioration."

        reasoning = triage.get("reference_reasoning", [])
        if reasoning:
            return " ".join(reasoning)

        return "Review the reference ESI, vital signs, complaint risk, and recorded ED interventions together. Strong triage reasoning connects all four."

    def _fallback_response(self, case: Case, user_question: str, context: str) -> str:
        """Return a deterministic response when the OpenAI client is not configured."""
        question = (user_question or "").lower()

        if context == "history" or any(
            term in question
            for term in ["history", "medical", "medicine", "medication", "allerg", "before"]
        ):
            history = self._brief_text(case.history)
            return f"I can tell you what I know: {history}"

        complaint = str(case.complaint).strip()
        if complaint:
            return f"I came in because of {complaint.lower()}."

        return "I'm not sure how to explain it, but I do not feel well and need to be checked."

    @staticmethod
    def _brief_text(value: str, limit: int = 260) -> str:
        """Keep fallback patient responses short enough for triage practice."""
        text = " ".join(str(value or "").split())
        if not text:
            return "I am not sure about my medical history."
        if len(text) <= limit:
            return text
        return f"{text[:limit].rstrip()}..."

