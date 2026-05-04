"""Chargebee Knowledge Base Data Validator.

Checks whether a reported issue is likely data-specific (affecting one merchant
due to their configuration/data) or a systemic code bug (affecting all merchants
under the same conditions).

Uses the LLM with Chargebee domain context to make this determination.
"""

from __future__ import annotations

import json
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

_KB_ANALYSIS_PROMPT = """\
You are a Chargebee platform expert. Given a reported issue, determine whether
it is likely a DATA-SPECIFIC problem (unique to one merchant's configuration,
data state, or edge case) or a SYSTEMIC BUG (a code defect affecting all
merchants under the same conditions).

Consider these Chargebee domain factors:
- Chargebee is a subscription billing platform with multi-tenant architecture.
- Each merchant (site) has independent configurations: billing rules, invoice
  templates, payment gateways, tax rules, dunning settings, addon/plan configs.
- Common data-specific issues include:
  * Stale or misconfigured invoice templates (published but not set as "In Use")
  * Gateway-specific payment failures (wrong credentials or gateway version)
  * Tax rule misconfigurations for specific regions
  * Subscription data inconsistencies from migrations or bulk imports
  * Custom field or metadata conflicts unique to a merchant's setup
  * Consolidated invoices with edge-case subscription modifications
- Common systemic bugs include:
  * PDF rendering engine defects affecting all templates
  * API endpoint bugs returning wrong status codes
  * Race conditions in concurrent subscription updates
  * Billing calculation errors in the core engine
  * UI components broken across all merchants

Respond ONLY with valid JSON matching this schema:
{
  "is_data_specific": boolean,
  "confidence": number (0-100),
  "reasoning": "brief explanation",
  "data_factors": ["list of data/config factors that could cause this"],
  "systemic_factors": ["list of factors suggesting a code bug"],
  "recommendation": "what to investigate next — data audit or code fix",
  "affected_scope": "single_merchant | few_merchants | all_merchants | unknown"
}
"""


async def validate_data_vs_systemic(
    problem: str,
    product_areas: str,
    severity: str,
    classification: str,
    code_context: str = "",
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Query the LLM to determine if the issue is data-specific or systemic."""
    if not api_key:
        return _fallback("No API key configured")

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=api_key)

        user_prompt = (
            f"Analyze this reported Chargebee issue:\n\n"
            f"Classification: {classification}\n"
            f"Severity: {severity}\n"
            f"Product Areas: {product_areas}\n"
            f"Problem: {problem}\n"
        )
        if code_context:
            user_prompt += f"\nCode context found during investigation:\n{code_context[:2000]}\n"

        resp = await client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": _KB_ANALYSIS_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=1024,
        )

        content = resp.choices[0].message.content or "{}"
        result = json.loads(content)
        result["error"] = None
        return result

    except Exception as e:
        logger.error("KB data validation failed: %s", e)
        return _fallback(str(e))


def _fallback(reason: str) -> Dict[str, Any]:
    return {
        "is_data_specific": None,
        "confidence": 0,
        "reasoning": f"Could not determine — {reason}",
        "data_factors": [],
        "systemic_factors": [],
        "recommendation": "Manual investigation required",
        "affected_scope": "unknown",
        "error": reason,
    }
