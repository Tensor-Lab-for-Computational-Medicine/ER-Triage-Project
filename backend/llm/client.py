from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Literal

import httpx
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
    base_url: str = field(default_factory=lambda: os.getenv("ED_SIM_LLM_BASE_URL", ""))
    api_key: str = field(default_factory=lambda: os.getenv("ED_SIM_LLM_API_KEY", ""))
    timeout_seconds: float = field(default_factory=lambda: float(os.getenv("ED_SIM_LLM_TIMEOUT_SECONDS", "30")))


class LLMClient:
    """Thin provider boundary; default mock keeps local tests deterministic."""

    def __init__(self, config: LLMConfig | None = None, transport: httpx.AsyncBaseTransport | None = None):
        self.config = config or LLMConfig()
        self.transport = transport
        self.usage_log: list[LLMResult] = []

    async def complete(self, messages: list[LLMMessage], tier: Tier, purpose: str) -> LLMResult:
        model = self.config.cheap_model if tier == "cheap" else self.config.strong_model
        provider = self.config.provider.strip().lower().replace("-", "_")
        if provider == "mock":
            result = self._result_from_text(messages, _mock_response(messages, purpose), tier, model, purpose)
        elif provider in {"openai_compatible", "chat_completions"}:
            result = await self._complete_chat_completions(messages, tier, model, purpose)
        else:
            raise ValueError(f"Unsupported ED_SIM_LLM_PROVIDER: {self.config.provider}")

        self.usage_log.append(result)
        return result

    def _result_from_text(
        self,
        messages: list[LLMMessage],
        text: str,
        tier: Tier,
        model: str,
        purpose: str,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
    ) -> LLMResult:
        prompt = "\n".join(message.content for message in messages)
        prompt_count = prompt_tokens if prompt_tokens is not None else _estimate_tokens(prompt)
        completion_count = completion_tokens if completion_tokens is not None else _estimate_tokens(text)
        cost_per_1k = self.config.cheap_cost_per_1k if tier == "cheap" else self.config.strong_cost_per_1k
        return LLMResult(
            text=text,
            tier=tier,
            model=model,
            prompt_tokens=prompt_count,
            completion_tokens=completion_count,
            estimated_cost_usd=round((prompt_count + completion_count) / 1000 * cost_per_1k, 6),
            purpose=purpose,
        )

    async def _complete_chat_completions(
        self,
        messages: list[LLMMessage],
        tier: Tier,
        model: str,
        purpose: str,
    ) -> LLMResult:
        if not self.config.base_url:
            raise ValueError("ED_SIM_LLM_BASE_URL is required when ED_SIM_LLM_PROVIDER is openai_compatible.")
        if not self.config.api_key:
            raise ValueError("ED_SIM_LLM_API_KEY is required when ED_SIM_LLM_PROVIDER is openai_compatible.")

        endpoint = self.config.base_url.rstrip("/")
        payload = {
            "model": model,
            "messages": [message.model_dump(mode="json") for message in messages],
        }
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(transport=self.transport, timeout=self.config.timeout_seconds) as client:
            response = await client.post(endpoint, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        text = _extract_chat_text(data)
        usage = data.get("usage") or {}
        return self._result_from_text(
            messages=messages,
            text=text,
            tier=tier,
            model=model,
            purpose=purpose,
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
        )


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


def _extract_chat_text(data: dict) -> str:
    if isinstance(data.get("output_text"), str):
        return data["output_text"].strip()

    choice = (data.get("choices") or [{}])[0]
    content = (choice.get("message") or {}).get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = [
            part.get("text") or part.get("content") or ""
            for part in content
            if isinstance(part, dict)
        ]
        text = "".join(parts).strip()
        if text:
            return text

    raise ValueError("LLM provider response did not contain assistant text.")
