"""
Multi-model AI Router for Vulpine Engine.
Routes tasks to the optimal model based on cost, capability, and task type.
"""

import json
import hashlib
from typing import Optional, Literal
from dataclasses import dataclass, field
from enum import Enum

import httpx
from loguru import logger

from shared.config import settings


class TaskType(str, Enum):
    REASONING = "reasoning"       # Scoring, classification, complex analysis
    WRITING = "writing"           # Email generation, proposals, outreach
    CHEAP = "cheap"               # Simple extraction, normalization, validation
    EMBEDDING = "embedding"       # Vector embeddings for search
    VISION = "vision"             # Plan/image analysis


@dataclass
class AIMessage:
    role: str  # system, user, assistant
    content: str


@dataclass
class AIResponse:
    content: str
    model: str
    usage: dict = field(default_factory=dict)
    cost_estimate: float = 0.0
    cached: bool = False


class AIRouter:
    """Routes AI tasks to the best available model based on task type and cost."""

    def __init__(self):
        self._cache: dict[str, AIResponse] = {}

    def _cache_key(self, messages: list[AIMessage], model: str) -> str:
        raw = model + "::" + json.dumps([{"role": m.role, "content": m.content} for m in messages])
        return hashlib.sha256(raw.encode()).hexdigest()

    # ── Anthropic (Claude) ──────────────────────────────────

    async def _call_claude(
        self, messages: list[AIMessage], model: str, max_tokens: int = 4096, temperature: float = 0.3
    ) -> AIResponse:
        system_msg = ""
        user_messages = []
        for m in messages:
            if m.role == "system":
                system_msg = m.content
            else:
                user_messages.append({"role": m.role, "content": m.content})

        body = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": user_messages,
        }
        if system_msg:
            body["system"] = system_msg

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["content"][0]["text"]
        usage = {
            "input_tokens": data["usage"]["input_tokens"],
            "output_tokens": data["usage"]["output_tokens"],
        }
        # Claude Sonnet pricing ~$3/$15 per 1M tokens
        cost = (usage["input_tokens"] / 1_000_000 * 3.0) + (usage["output_tokens"] / 1_000_000 * 15.0)

        return AIResponse(content=content, model=model, usage=usage, cost_estimate=cost)

    # ── OpenAI ─────────────────────────────────────────────

    async def _call_openai(
        self, messages: list[AIMessage], model: str, max_tokens: int = 4096, temperature: float = 0.3
    ) -> AIResponse:
        body = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"]["content"]
        usage = {
            "input_tokens": data["usage"]["prompt_tokens"],
            "output_tokens": data["usage"]["completion_tokens"],
        }
        # GPT-4o-mini ~$0.15/$0.60 per 1M
        cost = (usage["input_tokens"] / 1_000_000 * 0.15) + (usage["output_tokens"] / 1_000_000 * 0.60)

        return AIResponse(content=content, model=model, usage=usage, cost_estimate=cost)

    # ── DeepSeek ───────────────────────────────────────────

    async def _call_deepseek(
        self, messages: list[AIMessage], model: str = "deepseek-chat", max_tokens: int = 4096, temperature: float = 0.3
    ) -> AIResponse:
        body = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.deepseek_api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"]["content"]
        usage = {
            "input_tokens": data["usage"]["prompt_tokens"],
            "output_tokens": data["usage"]["completion_tokens"],
        }
        cost = (usage["input_tokens"] / 1_000_000 * 0.27) + (usage["output_tokens"] / 1_000_000 * 1.10)

        return AIResponse(content=content, model=model, usage=usage, cost_estimate=cost)

    # ── Embeddings ─────────────────────────────────────────

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings via OpenAI."""
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": settings.embedding_model, "input": texts},
            )
            resp.raise_for_status()
            data = resp.json()
        return [item["embedding"] for item in data["data"]]

    # ── Main Router ────────────────────────────────────────

    async def complete(
        self,
        messages: list[AIMessage],
        task: TaskType = TaskType.REASONING,
        model: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.3,
        use_cache: bool = True,
    ) -> AIResponse:
        """Route a completion to the appropriate model."""

        # Model selection
        if model is None:
            if task == TaskType.REASONING:
                model = settings.reasoning_model
            elif task == TaskType.WRITING:
                model = settings.writing_model
            elif task == TaskType.CHEAP:
                model = settings.cheap_model
            else:
                model = settings.reasoning_model

        # Check cache
        if use_cache:
            ck = self._cache_key(messages, model)
            if ck in self._cache:
                cached = self._cache[ck]
                cached.cached = True
                logger.debug(f"AI cache hit: {model}")
                return cached

        # Route to provider
        logger.info(f"AI call: model={model}, task={task.value}, msgs={len(messages)}")

        if model.startswith("claude"):
            result = await self._call_claude(messages, model, max_tokens, temperature)
        elif model.startswith("gpt") or model.startswith("o1") or model.startswith("o3"):
            result = await self._call_openai(messages, model, max_tokens, temperature)
        elif model.startswith("deepseek"):
            result = await self._call_deepseek(messages, model, max_tokens, temperature)
        else:
            # Fallback to Claude
            logger.warning(f"Unknown model {model}, falling back to Claude")
            result = await self._call_claude(messages, settings.reasoning_model, max_tokens, temperature)

        # Cache
        if use_cache:
            ck = self._cache_key(messages, model)
            self._cache[ck] = result

        logger.info(f"AI complete: model={model}, cost=${result.cost_estimate:.4f}, cached={result.cached}")
        return result

    async def complete_json(
        self,
        messages: list[AIMessage],
        task: TaskType = TaskType.REASONING,
        model: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> dict:
        """Complete and parse JSON response."""
        # Add JSON instruction to system prompt
        augmented = list(messages)
        if augmented and augmented[0].role == "system":
            augmented[0] = AIMessage(
                role="system",
                content=augmented[0].content + "\n\nYou MUST respond with valid JSON only. No markdown, no explanation.",
            )

        response = await self.complete(augmented, task=task, model=model, max_tokens=max_tokens)
        content = response.content.strip()

        # Strip markdown code fences if present
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:]) if len(lines) > 1 else content
            if content.endswith("```"):
                content = content[:-3]

        return json.loads(content)


# Singleton
ai = AIRouter()
