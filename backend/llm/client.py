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


class LLMConfigurationError(ValueError):
    """Raised when an in-loop AI surface is invoked without a real configured provider."""


def _default_provider() -> str:
    explicit = os.getenv("ED_SIM_LLM_PROVIDER", "").strip()
    if explicit:
        return explicit
    if os.getenv("OPENAI_API_KEY") or os.getenv("ED_SIM_LLM_API_KEY"):
        return "openai_responses"
    return "unconfigured"


def _default_api_key() -> str:
    return os.getenv("ED_SIM_LLM_API_KEY", "") or os.getenv("OPENAI_API_KEY", "")


def _default_base_url() -> str:
    return os.getenv("ED_SIM_LLM_BASE_URL", "")


@dataclass
class LLMConfig:
    provider: str = field(default_factory=_default_provider)
    cheap_model: str = field(default_factory=lambda: os.getenv("ED_SIM_CHEAP_MODEL", "gpt-5.4-mini"))
    strong_model: str = field(default_factory=lambda: os.getenv("ED_SIM_STRONG_MODEL", "gpt-5.5"))
    cheap_cost_per_1k: float = field(default_factory=lambda: float(os.getenv("ED_SIM_CHEAP_COST_PER_1K", "0")))
    strong_cost_per_1k: float = field(default_factory=lambda: float(os.getenv("ED_SIM_STRONG_COST_PER_1K", "0")))
    base_url: str = field(default_factory=_default_base_url)
    api_key: str = field(default_factory=_default_api_key)
    timeout_seconds: float = field(default_factory=lambda: float(os.getenv("ED_SIM_LLM_TIMEOUT_SECONDS", "30")))


class LLMClient:
    """Thin provider boundary for in-loop personas and the validated grader."""

    def __init__(self, config: LLMConfig | None = None, transport: httpx.AsyncBaseTransport | None = None):
        self.config = config or LLMConfig()
        self.transport = transport
        self.usage_log: list[LLMResult] = []

    def provider_name(self) -> str:
        return self.config.provider.strip().lower().replace("-", "_")

    def is_configured(self) -> bool:
        provider = self.provider_name()
        if provider == "mock":
            return True
        if provider in {"openai", "openai_responses", "responses"}:
            return bool(self.config.api_key)
        if provider in {"openai_compatible", "chat_completions"}:
            return bool(self.config.api_key and self.config.base_url)
        return False

    def status(self) -> dict[str, object]:
        provider = self.provider_name()
        missing: list[str] = []
        if provider == "unconfigured":
            missing.append("provider")
        if provider in {"openai", "openai_responses", "responses"} and not self.config.api_key:
            missing.append("api_key")
        if provider in {"openai_compatible", "chat_completions"}:
            if not self.config.api_key:
                missing.append("api_key")
            if not self.config.base_url:
                missing.append("base_url")
        return {
            "configured": self.is_configured(),
            "provider": provider,
            "cheap_model": self.config.cheap_model,
            "strong_model": self.config.strong_model,
            "base_url": self.config.base_url if provider in {"openai_compatible", "chat_completions"} else "",
            "missing": missing,
        }

    async def complete(self, messages: list[LLMMessage], tier: Tier, purpose: str) -> LLMResult:
        model = self.config.cheap_model if tier == "cheap" else self.config.strong_model
        provider = self.provider_name()
        if provider == "mock":
            result = self._result_from_text(messages, _mock_response(messages, purpose), tier, model, purpose)
        elif provider in {"openai", "openai_responses", "responses"}:
            result = await self._complete_openai_responses(messages, tier, model, purpose)
        elif provider in {"openai_compatible", "chat_completions"}:
            result = await self._complete_chat_completions(messages, tier, model, purpose)
        elif provider == "unconfigured":
            raise LLMConfigurationError(
                "AI provider is not configured. Add an OpenAI key in AI Settings or set ED_SIM_LLM_PROVIDER, ED_SIM_LLM_API_KEY, and model environment variables."
            )
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

    async def _complete_openai_responses(
        self,
        messages: list[LLMMessage],
        tier: Tier,
        model: str,
        purpose: str,
    ) -> LLMResult:
        if not self.config.api_key:
            raise LLMConfigurationError("OPENAI_API_KEY or ED_SIM_LLM_API_KEY is required for AI dialogue.")

        endpoint = (self.config.base_url or "https://api.openai.com/v1/responses").rstrip("/")
        instructions = "\n\n".join(message.content for message in messages if message.role == "system")
        input_messages = [
            {
                "role": "assistant" if message.role == "assistant" else "user",
                "content": message.content,
            }
            for message in messages
            if message.role != "system"
        ]
        payload = {
            "model": model,
            "instructions": instructions,
            "input": input_messages,
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
            prompt_tokens=usage.get("input_tokens") or usage.get("prompt_tokens"),
            completion_tokens=usage.get("output_tokens") or usage.get("completion_tokens"),
        )

    async def _complete_chat_completions(
        self,
        messages: list[LLMMessage],
        tier: Tier,
        model: str,
        purpose: str,
    ) -> LLMResult:
        if not self.config.base_url:
            raise LLMConfigurationError("ED_SIM_LLM_BASE_URL is required when ED_SIM_LLM_PROVIDER is openai_compatible.")
        if not self.config.api_key:
            raise LLMConfigurationError("ED_SIM_LLM_API_KEY is required when ED_SIM_LLM_PROVIDER is openai_compatible.")

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
    output_text = data.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    response_parts = _extract_responses_output_text(data.get("output"))
    if response_parts:
        return response_parts

    choice = (data.get("choices") or [{}])[0]
    content = (choice.get("message") or {}).get("content")
    text = _extract_content_text(content)
    if text:
        return text

    raise ValueError("LLM provider response did not contain assistant text.")


def _extract_responses_output_text(output: object) -> str:
    if not isinstance(output, list):
        return ""

    parts: list[str] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        if isinstance(item.get("text"), str):
            parts.append(item["text"])
        text = _extract_content_text(item.get("content"))
        if text:
            parts.append(text)
    return "".join(parts).strip()


def _extract_content_text(content: object) -> str:
    if isinstance(content, str):
        return content.strip()

    if not isinstance(content, list):
        return ""

    parts: list[str] = []
    for part in content:
        if isinstance(part, str):
            parts.append(part)
            continue
        if not isinstance(part, dict):
            continue
        text = part.get("text") or part.get("content") or part.get("refusal") or ""
        if isinstance(text, str):
            parts.append(text)
    return "".join(parts).strip()
