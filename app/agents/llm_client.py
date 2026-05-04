from __future__ import annotations

"""Thin wrapper around Anthropic / OpenAI APIs for structured JSON generation."""

import json
import logging
from typing import Any, Dict


class LLMClient:
    """Simple class-based wrapper for use by services (RCA, code analysis)."""

    async def generate_text(self, prompt: str, max_tokens: int = 2048) -> str:
        """Call the LLM and return raw text (not JSON)."""
        from app.config import get_settings
        settings = get_settings()

        if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
            try:
                return await _call_anthropic_text(prompt, max_tokens)
            except Exception as e:
                logger.error("Anthropic text error: %s", e)
                return f"[LLM unavailable — {e}]"
        elif settings.llm_provider == "openai" and settings.openai_api_key:
            try:
                return await _call_openai_text(prompt, max_tokens)
            except Exception as e:
                logger.error("OpenAI text error: %s", e)
                return f"[LLM unavailable — {e}]"
        return "[No LLM configured — add OPENAI_API_KEY to .env]"

from app.config import get_settings

logger = logging.getLogger(__name__)


async def generate_structured_json(
    system_prompt: str,
    user_prompt: str,
    json_schema_description: str = "",
    max_tokens: int = 4096,
) -> Dict[str, Any]:
    """Call the configured LLM and return parsed JSON.

    Falls back to mock if no API key is configured or if the API returns an error.
    """
    settings = get_settings()

    if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
        try:
            return await _call_anthropic(system_prompt, user_prompt, max_tokens)
        except Exception as e:
            logger.error("Anthropic API error: %s — falling back to mock", e)
            return _mock_response(user_prompt)
    elif settings.llm_provider == "openai" and settings.openai_api_key:
        try:
            return await _call_openai(system_prompt, user_prompt, max_tokens)
        except Exception as e:
            logger.error("OpenAI API error: %s — falling back to mock", e)
            return _mock_response(user_prompt)
    else:
        logger.warning("No LLM API key configured — returning mock response")
        return _mock_response(user_prompt)


async def _call_anthropic_text(prompt: str, max_tokens: int) -> str:
    import anthropic
    from app.config import get_settings
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


async def _call_openai_text(prompt: str, max_tokens: int) -> str:
    from openai import AsyncOpenAI
    from app.config import get_settings
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model="gpt-4o",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content or ""


async def _call_anthropic(system_prompt: str, user_prompt: str, max_tokens: int) -> Dict[str, Any]:
    import anthropic

    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    text = message.content[0].text
    return _parse_json_from_text(text)


async def _call_openai(system_prompt: str, user_prompt: str, max_tokens: int) -> Dict[str, Any]:
    from openai import AsyncOpenAI

    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    response = await client.chat.completions.create(
        model="gpt-4o",
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    text = response.choices[0].message.content or "{}"
    return json.loads(text)


def _parse_json_from_text(text: str) -> Dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        json_lines = []
        inside = False
        for line in lines:
            if line.strip().startswith("```") and not inside:
                inside = True
                continue
            elif line.strip().startswith("```") and inside:
                break
            elif inside:
                json_lines.append(line)
        text = "\n".join(json_lines)
    return json.loads(text)


def _mock_response(user_prompt: str) -> Dict[str, Any]:
    """Return a plausible mock for development without a working API key."""
    if "classification" in user_prompt.lower() or "agent-2" in user_prompt.lower() or "agent2" in user_prompt.lower():
        return {
            "classification": "feature_request",
            "owner_team_suggestion": "Billing Team",
            "rationale": "[MOCK] This appears to be a feature request related to billing functionality. "
                         "Configure a valid LLM API key for real classification.",
            "assumptions": [
                "[MOCK] No real LLM analysis performed — using heuristic fallback",
                "ARR data not provided — estimated as medium tier",
            ],
        }
    return {
        "title": "[MOCK] Feature Request — extracted from uploaded document",
        "request_type_hint": "feature_request",
        "problem_statement": "[MOCK] Configure a valid LLM API key (OpenAI or Anthropic) in backend/.env for real AI extraction. "
                             "This is a placeholder response.",
        "requirements": [
            {"type": "functional", "text": "[MOCK] Requirement placeholder — real extraction requires LLM API key", "evidence": [{"start_line": 1, "end_line": 3}]}
        ],
        "acceptance_criteria": [
            {"text": "[MOCK] Acceptance criterion placeholder", "evidence": [{"start_line": 1, "end_line": 2}]}
        ],
        "impact": {"severity_hint": "medium", "who_is_affected": "End users", "evidence": [{"start_line": 1, "end_line": 2}]},
        "stakeholders": [{"name": "Customer", "role": "Requester", "evidence": [{"start_line": 1, "end_line": 1}]}],
        "related_product_areas": [{"name": "Billing", "evidence": [{"start_line": 1, "end_line": 1}]}],
        "kb_validation": {
            "is_likely_supported_already": "unknown",
            "supporting_kb_refs": [],
            "notes": "[MOCK] No KB validation — LLM not available.",
        },
        "questions_to_ask": ["[MOCK] Set OPENAI_API_KEY or ANTHROPIC_API_KEY in backend/.env for real extraction"],
        "confidence": {"overall": 0.3, "title": 0.3, "problem_statement": 0.3},
    }
