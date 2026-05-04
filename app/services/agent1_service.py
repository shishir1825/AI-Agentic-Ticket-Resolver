from __future__ import annotations

"""Agent-1: Extraction + KB validation hints."""

import logging
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.run import Run
from app.models.document import Document
from app.models.artifact import Artifact
from app.agents.llm_client import generate_structured_json
from app.agents.prompts import AGENT1_SYSTEM_PROMPT, build_agent1_user_prompt
from app.schemas.agent_schemas import Agent1Output
from app.services import workflow_service

logger = logging.getLogger(__name__)


async def run_agent1(db: AsyncSession, run_id: UUID) -> Artifact:
    result = await db.execute(
        select(Run).where(Run.id == run_id).options(selectinload(Run.document))
    )
    run = result.scalar_one_or_none()
    if not run:
        raise ValueError(f"Run {run_id} not found")
    if run.status != "processing":
        raise ValueError(f"Run {run_id} is in state '{run.status}', expected 'processing'")

    doc = run.document
    if not doc or not doc.extracted_text:
        raise ValueError("Document text not available")

    user_prompt = build_agent1_user_prompt(doc.extracted_text, doc.filename)

    logger.info("Calling LLM for Agent-1 extraction on run %s", run_id)
    raw_output = await generate_structured_json(
        system_prompt=AGENT1_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        max_tokens=4096,
    )

    try:
        validated = Agent1Output.model_validate(raw_output)
        payload = validated.model_dump()
    except Exception:
        logger.warning("Agent-1 output failed schema validation, storing raw output")
        payload = raw_output

    _enrich_confidence(payload, doc.extracted_text)

    max_ver = await db.execute(
        select(func.coalesce(func.max(Artifact.version), 0)).where(Artifact.run_id == run_id)
    )
    next_version = max_ver.scalar() + 1

    artifact = Artifact(
        run_id=run_id,
        version=next_version,
        stage="agent1_output",
        json_payload=payload,
        created_by="agent1",
    )
    db.add(artifact)

    await workflow_service.transition(db, run, "agent1_done")

    logger.info("Agent-1 complete for run %s — artifact v%d", run_id, next_version)
    return artifact


def _enrich_confidence(payload: dict, full_text: str) -> None:
    """Heuristic: bump confidence for fields that have evidence spans."""
    confidence = payload.get("confidence", {})
    total_lines = len(full_text.split("\n"))

    for key in ["requirements", "acceptance_criteria", "stakeholders", "related_product_areas"]:
        items = payload.get(key, [])
        has_evidence = any(
            item.get("evidence") for item in items if isinstance(item, dict)
        )
        if has_evidence:
            confidence[key] = min(confidence.get(key, 0.5) + 0.2, 1.0)
        else:
            confidence[key] = max(confidence.get(key, 0.5) - 0.2, 0.0)

    if payload.get("title"):
        confidence["title"] = max(confidence.get("title", 0.5), 0.6)
    if payload.get("problem_statement") and len(payload["problem_statement"]) > 20:
        confidence["problem_statement"] = max(confidence.get("problem_statement", 0.5), 0.6)

    evidence_count = 0
    for key in ["requirements", "acceptance_criteria", "stakeholders", "related_product_areas"]:
        for item in payload.get(key, []):
            if isinstance(item, dict) and item.get("evidence"):
                evidence_count += len(item["evidence"])
    confidence["overall"] = min(0.4 + evidence_count * 0.05, 1.0)

    payload["confidence"] = confidence
