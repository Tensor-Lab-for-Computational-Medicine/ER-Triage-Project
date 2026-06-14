from __future__ import annotations

import json

from backend.llm.client import LLMClient, LLMMessage, LLMResult
from backend.personas.templates import system_prompt


def build_persona_messages(role: str, context: dict, student_text: str) -> list[LLMMessage]:
    safe_context = json.dumps(context, sort_keys=True)
    return [
        LLMMessage(role="system", content=system_prompt(role)),
        LLMMessage(role="system", content=f"Permitted context JSON:\n{safe_context}"),
        LLMMessage(role="user", content=student_text),
    ]


async def answer_persona(role: str, context: dict, student_text: str, client: LLMClient) -> LLMResult:
    if client.config.provider == "mock":
        text = _deterministic_response(role, context, student_text)
        messages = build_persona_messages(role, context, student_text)
        result = await client.complete(messages, "strong" if role == "consultant" else "cheap", f"{role}_dialogue")
        return result.model_copy(update={"text": text})

    messages = build_persona_messages(role, context, student_text)
    tier = "strong" if role == "consultant" else "cheap"
    return await client.complete(messages, tier, f"{role}_dialogue")


def _deterministic_response(role: str, context: dict, student_text: str) -> str:
    lowered = student_text.lower()
    if role == "patient":
        for fact in context.get("hpi_facts", []):
            if any(trigger in lowered for trigger in fact.get("triggers", [])):
                return fact["lay_response"]
        if any(term in lowered for term in ["diagnosis", "what do i have", "esi", "disposition", "admit"]):
            return "I do not know that. I can only tell you what I am feeling."
        return "I feel short of breath and the chest pain is worse when I breathe in."

    if role == "nurse":
        vitals = context.get("current_vitals", {})
        vital_line = (
            f"Current vitals: HR {vitals.get('hr')}, BP {vitals.get('sbp')}/{vitals.get('dbp')}, "
            f"RR {vitals.get('rr')}, SpO2 {vitals.get('spo2')}%."
        )
        if any(term in lowered for term in ["diagnosis", "esi", "disposition"]):
            return f"{vital_line} I do not have a diagnosis or disposition to reveal."
        orders = context.get("active_orders", [])
        order_line = f" Active orders: {len(orders)}." if orders else " No active orders yet."
        return vital_line + order_line

    if role == "consultant":
        resulted = context.get("resulted_orders", [])
        if any(term in lowered for term in ["diagnosis", "ground truth", "answer"]):
            return "I can only reason from the information you have provided and resulted studies."
        return (
            f"I have {len(resulted)} resulted study set(s) to review. Stabilize abnormal vitals first, "
            "then tell me the working concern and what question you want me to answer."
        )

    raise ValueError(f"unknown persona role: {role}")
