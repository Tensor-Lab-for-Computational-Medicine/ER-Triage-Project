from __future__ import annotations

import json
import re
from typing import Any

from backend.llm.client import LLMClient, LLMMessage, LLMResult
from backend.personas.templates import system_prompt


_STABLE_CLAIM = re.compile(r"\b(stable|normal vitals|vitals are normal|comfortable|looks well|doing fine)\b", re.I)
_VITAL_LABEL = re.compile(
    r"\b(spo2|oxygen saturation|sat(?:s)?|hr|heart rate|bp|blood pressure|rr|respiratory rate|pain|temp(?:erature)?)\b",
    re.I,
)
_VITAL_PATTERNS = {
    "spo2": [
        re.compile(r"\b(?:spo2|oxygen saturation|sat(?:s)?)\D{0,24}(\d{2,3})\s*%?", re.I),
        re.compile(r"\b(\d{2,3})\s*%\D{0,24}(?:spo2|oxygen saturation|sat(?:s)?)\b", re.I),
    ],
    "hr": [re.compile(r"\b(?:hr|heart rate)\D{0,24}(\d{2,3})\b", re.I)],
    "rr": [re.compile(r"\b(?:rr|respiratory rate|respirations)\D{0,24}(\d{1,3})\b", re.I)],
    "pain": [re.compile(r"\bpain\D{0,24}(\d{1,2})\b", re.I)],
}
_BP_PATTERN = re.compile(r"\b(?:bp|blood pressure)?\D{0,16}(\d{2,3})\s*/\s*(\d{2,3})\b", re.I)


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
        return result.model_copy(update={"text": _guard_state_consistency(role, context, text)})

    messages = build_persona_messages(role, context, student_text)
    tier = "strong" if role == "consultant" else "cheap"
    result = await client.complete(messages, tier, f"{role}_dialogue")
    return result.model_copy(update={"text": _guard_state_consistency(role, context, result.text)})


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


def _guard_state_consistency(role: str, context: dict, text: str) -> str:
    vitals = context.get("current_vitals")
    if not isinstance(vitals, dict):
        return text
    if _claims_stable_when_unstable(text, vitals):
        return _state_anchored_response(role, context)
    if _VITAL_LABEL.search(text) and _vital_number_conflicts(text, vitals):
        return _state_anchored_response(role, context)
    return text


def _claims_stable_when_unstable(text: str, vitals: dict[str, Any]) -> bool:
    return bool(_STABLE_CLAIM.search(text)) and _vitals_are_unstable(vitals)


def _vitals_are_unstable(vitals: dict[str, Any]) -> bool:
    return any(
        [
            _numeric(vitals.get("spo2")) is not None and _numeric(vitals.get("spo2")) < 92,
            _numeric(vitals.get("hr")) is not None and _numeric(vitals.get("hr")) > 110,
            _numeric(vitals.get("rr")) is not None and _numeric(vitals.get("rr")) > 22,
            _numeric(vitals.get("sbp")) is not None and _numeric(vitals.get("sbp")) < 90,
            _numeric(vitals.get("pain")) is not None and _numeric(vitals.get("pain")) >= 7,
        ]
    )


def _vital_number_conflicts(text: str, vitals: dict[str, Any]) -> bool:
    for vital, patterns in _VITAL_PATTERNS.items():
        current = _numeric(vitals.get(vital))
        if current is None:
            continue
        for pattern in patterns:
            for match in pattern.finditer(text):
                if _numeric(match.group(1)) != current:
                    return True

    current_sbp = _numeric(vitals.get("sbp"))
    current_dbp = _numeric(vitals.get("dbp"))
    if current_sbp is not None and current_dbp is not None:
        for match in _BP_PATTERN.finditer(text):
            if (_numeric(match.group(1)), _numeric(match.group(2))) != (current_sbp, current_dbp):
                return True
    return False


def _state_anchored_response(role: str, context: dict) -> str:
    vitals = context.get("current_vitals") or {}
    appearance = str(context.get("appearance") or "").strip()
    vital_line = _render_vitals(vitals)
    if role == "patient":
        suffix = f" I feel {appearance[0].lower() + appearance[1:]}" if appearance else " I can tell you how I feel."
        return "I do not know the monitor numbers." + suffix
    if role == "nurse":
        return f"Current vitals from the monitor: {vital_line}. {appearance}".strip()
    if role == "consultant":
        return f"I will reason from the supplied state: {vital_line}."
    return vital_line


def _render_vitals(vitals: dict[str, Any]) -> str:
    parts = [
        f"HR {vitals.get('hr')}",
        f"BP {vitals.get('sbp')}/{vitals.get('dbp')}",
        f"RR {vitals.get('rr')}",
        f"SpO2 {vitals.get('spo2')}%",
    ]
    if vitals.get("temp_c") is not None:
        parts.append(f"Temp {vitals.get('temp_c')} C")
    if vitals.get("pain") is not None:
        parts.append(f"Pain {vitals.get('pain')}/10")
    return ", ".join(parts)


def _numeric(value: Any) -> int | float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number.is_integer():
        return int(number)
    return number
