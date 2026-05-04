from __future__ import annotations

"""Agent-2: Classification + Prioritization + Team suggestion."""

import logging
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.run import Run
from app.models.artifact import Artifact
from app.models.scoring_config import ScoringConfig, TeamOwnershipMap
from app.agents.llm_client import generate_structured_json
from app.agents.prompts import AGENT2_SYSTEM_PROMPT, build_agent2_user_prompt
from app.services.scoring_engine import compute_priority_score, estimate_inputs_from_artifact
from app.services import workflow_service

logger = logging.getLogger(__name__)


async def run_agent2(db: AsyncSession, run_id: UUID) -> Artifact:
    result = await db.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise ValueError(f"Run {run_id} not found")
    if run.status != "running_agent2":
        raise ValueError(f"Run {run_id} is in state '{run.status}', expected 'running_agent2'")

    verified_result = await db.execute(
        select(Artifact)
        .where(Artifact.run_id == run_id, Artifact.stage == "verified_v1")
        .order_by(Artifact.version.desc())
        .limit(1)
    )
    verified = verified_result.scalar_one_or_none()
    if not verified:
        raise ValueError("No verified artifact found for Agent-2")

    artifact_payload = verified.json_payload

    # Load team mappings
    tm_result = await db.execute(select(TeamOwnershipMap))
    team_mappings_raw = tm_result.scalars().all()
    team_mappings = [
        {"product_area": t.product_area, "owning_team": t.owning_team, "jira_component": t.jira_component}
        for t in team_mappings_raw
    ]

    # LLM classification
    user_prompt = build_agent2_user_prompt(artifact_payload, team_mappings or None)
    logger.info("Calling LLM for Agent-2 classification on run %s", run_id)
    llm_output = await generate_structured_json(
        system_prompt=AGENT2_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        max_tokens=2048,
    )

    # Deterministic scoring — feed LLM scoring signals into the engine
    sc_result = await db.execute(select(ScoringConfig).order_by(ScoringConfig.updated_at.desc()).limit(1))
    scoring_config = sc_result.scalar_one_or_none()
    weights    = scoring_config.weights    if scoring_config else None
    thresholds = scoring_config.thresholds if scoring_config else None

    llm_signals = llm_output.get("scoring_signals") or {}
    scoring_inputs = estimate_inputs_from_artifact(artifact_payload, llm_hints=llm_signals)
    scoring_result = compute_priority_score(scoring_inputs, weights, thresholds)

    logger.info(
        "Agent-2 scoring for run %s — inputs=%s score=%.1f priority=%s signals=%s",
        run_id, scoring_inputs, scoring_result["priority_score"],
        scoring_result["priority"], llm_signals,
    )

    # Module: Agent-2 refines what Agent-1 extracted (and GTM possibly overrode)
    agent1_module = artifact_payload.get("module", "")
    agent2_module = llm_output.get("module", "")
    VALID_MODULES = {"Invoices", "Taxes", "Subscriptions", "UBB", "Payments"}
    final_module = agent2_module if agent2_module in VALID_MODULES else (
        agent1_module if agent1_module in VALID_MODULES else "Invoices"
    )

    # Merge LLM classification + deterministic scoring
    final_payload = {
        "classification":      llm_output.get("classification", "feature_request"),
        "module":              final_module,
        "priority":            scoring_result["priority"],
        "priority_score":      scoring_result["priority_score"],
        "score_breakdown":     scoring_result["score_breakdown"],
        "normalized_inputs":   scoring_result["normalized_inputs"],
        "owner_team_suggestion": llm_output.get("owner_team_suggestion", ""),
        "rationale":           llm_output.get("rationale", ""),
        "assumptions":         llm_output.get("assumptions", []),
        "scoring_signals":     llm_signals,
    }

    max_ver = await db.execute(
        select(func.coalesce(func.max(Artifact.version), 0)).where(Artifact.run_id == run_id)
    )
    next_version = max_ver.scalar() + 1

    artifact = Artifact(
        run_id=run_id,
        version=next_version,
        stage="agent2_output",
        json_payload=final_payload,
        created_by="agent2",
    )
    db.add(artifact)

    await workflow_service.transition(db, run, "agent2_done")

    logger.info("Agent-2 complete for run %s — artifact v%d", run_id, next_version)
    return artifact
