from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel


Tier = Literal["cheap", "strong"]


class LLMMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class LLMResult(BaseModel):
    text: str
    tier: Tier
    model: str
    prompt_tokens: int
    completion_tokens: int
    estimated_cost_usd: float
    purpose: str


@dataclass
class LLMConfig:
    provider: str = field(default_factory=lambda: os.getenv("ED_SIM_LLM_PROVIDER", "mock"))
    cheap_model: str = field(default_factory=lambda: os.getenv("ED_SIM_CHEAP_MODEL", "mock-cheap"))
    strong_model: str = field(default_factory=lambda: os.getenv("ED_SIM_STRONG_MODEL", "mock-strong"))
    cheap_cost_per_1k: float = field(default_factory=lambda: float(os.getenv("ED_SIM_CHEAP_COST_PER_1K", "0")))
    strong_cost_per_1k: float = field(default_factory=lambda: float(os.getenv("ED_SIM_STRONG_COST_PER_1K", "0")))


class LLMClient:
    """Thin provider boundary; default mock keeps local tests deterministic."""

    def __init__(self, config: LLMConfig | None = None):
        self.config = config or LLMConfig()
        self.usage_log: list[LLMResult] = []

    async def complete(self, messages: list[LLMMessage], tier: Tier, purpose: str) -> LLMResult:
        model = self.config.cheap_model if tier == "cheap" else self.config.strong_model
        prompt = "\n".join(message.content for message in messages)
        prompt_tokens = _estimate_tokens(prompt)
        if self.config.provider != "mock":
            raise NotImplementedError(
                "Configure a provider adapter for ED_SIM_LLM_PROVIDER; the simulator core does not hardcode a vendor."
            )

        text = _mock_response(messages, purpose)
        completion_tokens = _estimate_tokens(text)
        cost_per_1k = self.config.cheap_cost_per_1k if tier == "cheap" else self.config.strong_cost_per_1k
        result = LLMResult(
            text=text,
            tier=tier,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated_cost_usd=round((prompt_tokens + completion_tokens) / 1000 * cost_per_1k, 6),
            purpose=purpose,
        )
        self.usage_log.append(result)
        return result


def get_client() -> LLMClient:
    return LLMClient()


def _estimate_tokens(text: str) -> int:
    return max(1, round(len(text.split()) * 1.25))


def _mock_response(messages: list[LLMMessage], purpose: str) -> str:
    user = next((message.content for message in reversed(messages) if message.role == "user"), "")
    if purpose.startswith("grader"):
        return "Structured feedback generated from package, rubric, and supplied evidence."
    if purpose.startswith("consultant"):
        return "From the information provided, I would focus on immediate stabilization, reviewed results, and the next management decision."
    if purpose.startswith("nurse"):
        return "I can repeat vitals, confirm active orders, and carry out the interventions you specify."
    if purpose.startswith("patient"):
        return "I can answer what I am feeling, but I do not know the diagnosis or disposition."
    return f"Mock response to: {user[:160]}"
