from __future__ import annotations

"""Approval endpoints, agent triggers, and JIRA MCP integration endpoints."""

from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.run import Run
from app.models.artifact import Artifact
from app.models.approval import Approval
from app.schemas.agent_schemas import ApprovalRequest
from app.services import workflow_service

router = APIRouter(prefix="/api/runs", tags=["approvals"])


# --- Agent triggers ---

@router.post("/{run_id}/agent1")
async def trigger_agent1(
    run_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    run = await workflow_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "processing":
        raise HTTPException(status_code=400, detail=f"Run is in state '{run.status}', expected 'processing'")

    background_tasks.add_task(_run_agent1_bg, run_id)
    return {"status": "agent1_triggered", "run_id": str(run_id)}


async def _run_agent1_bg(run_id: UUID):
    from app.services.agent1_service import run_agent1
    from app.database import async_session
    async with async_session() as db:
        try:
            await run_agent1(db, run_id)
        except Exception as e:
            run = await workflow_service.get_run(db, run_id)
            if run:
                await workflow_service.fail_run(db, run, str(e))


# --- Uploader approval ---

@router.post("/{run_id}/approve/uploader")
async def approve_uploader(
    run_id: UUID,
    body: ApprovalRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    run = await workflow_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "awaiting_uploader":
        raise HTTPException(status_code=400, detail=f"Run is in state '{run.status}', expected 'awaiting_uploader'")

    result = await db.execute(
        select(Artifact)
        .where(Artifact.run_id == run_id, Artifact.stage == "agent1_output")
        .order_by(Artifact.version.desc())
        .limit(1)
    )
    latest_artifact = result.scalar_one_or_none()
    if not latest_artifact:
        raise HTTPException(status_code=400, detail="No agent1 artifact found")

    payload = latest_artifact.json_payload.copy()
    if body.edits:
        payload.update(body.edits)

    max_ver = await db.execute(
        select(func.coalesce(func.max(Artifact.version), 0))
        .where(Artifact.run_id == run_id)
    )
    next_version = max_ver.scalar() + 1

    verified_artifact = Artifact(
        run_id=run_id,
        version=next_version,
        stage="verified_v1",
        json_payload=payload,
        created_by=body.approved_by,
    )
    db.add(verified_artifact)

    approval = Approval(
        run_id=run_id,
        stage="uploader",
        approved_by=body.approved_by,
        comments=body.comments,
    )
    db.add(approval)

    run = await workflow_service.transition(db, run, "uploader_approved")

    background_tasks.add_task(_run_agent2_bg, run_id)
    return {"status": "approved", "run_status": run.status}


@router.post("/{run_id}/reject/uploader")
async def reject_uploader(
    run_id: UUID,
    body: ApprovalRequest,
    db: AsyncSession = Depends(get_db),
):
    """GTM rejects the extraction — run goes to failed."""
    run = await workflow_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "awaiting_uploader":
        raise HTTPException(status_code=400, detail=f"Run is in state '{run.status}', expected 'awaiting_uploader'")

    approval = Approval(
        run_id=run_id,
        stage="uploader_rejected",
        approved_by=body.approved_by,
        comments=body.comments,
    )
    db.add(approval)

    run = await workflow_service.transition(db, run, "uploader_rejected")
    return {"status": "rejected", "run_status": run.status}


async def _run_agent2_bg(run_id: UUID):
    from app.services.agent2_service import run_agent2
    from app.database import async_session
    async with async_session() as db:
        try:
            await run_agent2(db, run_id)
        except Exception as e:
            run = await workflow_service.get_run(db, run_id)
            if run:
                await workflow_service.fail_run(db, run, str(e))


# --- PM approval ---

@router.post("/{run_id}/approve/pm")
async def approve_pm(
    run_id: UUID,
    body: ApprovalRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    run = await workflow_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "awaiting_pm":
        raise HTTPException(status_code=400, detail=f"Run is in state '{run.status}', expected 'awaiting_pm'")

    result = await db.execute(
        select(Artifact)
        .where(Artifact.run_id == run_id, Artifact.stage == "agent2_output")
        .order_by(Artifact.version.desc())
        .limit(1)
    )
    latest_artifact = result.scalar_one_or_none()
    if not latest_artifact:
        raise HTTPException(status_code=400, detail="No agent2 artifact found")

    payload = latest_artifact.json_payload.copy()
    if body.overrides:
        payload.update(body.overrides)

    max_ver = await db.execute(
        select(func.coalesce(func.max(Artifact.version), 0))
        .where(Artifact.run_id == run_id)
    )
    next_version = max_ver.scalar() + 1

    pm_artifact = Artifact(
        run_id=run_id,
        version=next_version,
        stage="pm_verified",
        json_payload=payload,
        created_by=body.approved_by,
    )
    db.add(pm_artifact)

    approval = Approval(
        run_id=run_id,
        stage="pm",
        approved_by=body.approved_by,
        comments=body.comments,
    )
    db.add(approval)

    run = await workflow_service.transition(db, run, "pm_approved")

    background_tasks.add_task(_create_jira_bg, run_id)
    return {"status": "approved", "run_status": run.status}


@router.post("/{run_id}/reject/pm")
async def reject_pm(
    run_id: UUID,
    body: ApprovalRequest,
    db: AsyncSession = Depends(get_db),
):
    """PM rejects the classification — sends back to GTM review."""
    run = await workflow_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "awaiting_pm":
        raise HTTPException(status_code=400, detail=f"Run is in state '{run.status}', expected 'awaiting_pm'")

    approval = Approval(
        run_id=run_id,
        stage="pm_rejected",
        approved_by=body.approved_by,
        comments=body.comments,
    )
    db.add(approval)

    run = await workflow_service.transition(db, run, "pm_rejected")
    return {"status": "rejected", "run_status": run.status}


async def _create_jira_bg(run_id: UUID):
    from app.services.jira_service import prepare_and_create_jira, JiraCredentialsMissing
    from app.database import async_session
    import logging
    _log = logging.getLogger(__name__)
    async with async_session() as db:
        try:
            await prepare_and_create_jira(db, run_id)
        except JiraCredentialsMissing as e:
            _log.warning("JIRA credentials missing for run %s — run stays in creating_jira: %s", run_id, e)
        except Exception as e:
            _log.error("JIRA creation failed for run %s: %s", run_id, e)
            run = await workflow_service.get_run(db, run_id)
            if run:
                await workflow_service.fail_run(db, run, f"JIRA creation failed: {e}")


# --- JIRA payload & recording ---

@router.get("/{run_id}/jira-payload")
async def get_jira_payload(run_id: UUID, db: AsyncSession = Depends(get_db)):
    """Return the prepared JIRA payload for MCP-based creation."""
    result = await db.execute(
        select(Artifact)
        .where(Artifact.run_id == run_id, Artifact.stage == "jira_payload")
        .order_by(Artifact.version.desc())
        .limit(1)
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="No JIRA payload prepared yet")
    return artifact.json_payload


class RecordJiraRequest(BaseModel):
    jira_key: str
    jira_url: Optional[str] = None


@router.post("/{run_id}/retry-jira")
async def retry_jira(
    run_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Reset a failed/stuck run back to creating_jira and retry JIRA creation."""
    from app.models.run import Run as RunModel
    result = await db.execute(select(RunModel).where(RunModel.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    # Also allow retrying done runs that somehow have no JIRA ticket
    if run.status not in ("failed", "creating_jira", "done"):
        raise HTTPException(status_code=400, detail=f"Run is in state '{run.status}', cannot retry JIRA")

    # Reset to creating_jira state
    run.status = "creating_jira"
    run.current_step = "jira"
    run.error_message = None
    await db.commit()

    background_tasks.add_task(_create_jira_bg, run_id)
    return {"status": "retrying", "run_id": str(run_id)}


@router.post("/{run_id}/record-jira")
async def record_jira(
    run_id: UUID,
    body: RecordJiraRequest,
    db: AsyncSession = Depends(get_db),
):
    """Record a JIRA ticket created externally (via Atlassian MCP server)."""
    from app.services.jira_service import record_jira_ticket
    link = await record_jira_ticket(db, run_id, body.jira_key, body.jira_url)
    return {
        "status": "recorded",
        "jira_key": link.jira_key,
        "jira_url": link.jira_url,
        "run_id": str(run_id),
    }


# --- Agent-3: Code Analysis + PR ---

@router.post("/{run_id}/analyze-code")
async def analyze_code(
    run_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Trigger Agent-3: search GitHub for relevant code, generate RCA, raise draft PR."""
    from app.models.run import Run as RunModel
    from app.models.jira_link import JiraLink
    result = await db.execute(
        select(RunModel).where(RunModel.id == run_id).options(
            selectinload(RunModel.artifacts),
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    # Accept both new flow (awaiting_code_fix) and legacy runs (done)
    if run.status not in ("awaiting_code_fix", "done"):
        raise HTTPException(status_code=400, detail=f"Code analysis not available in state '{run.status}'")

    jira_result = await db.execute(select(JiraLink).where(JiraLink.run_id == run_id))
    jira_link = jira_result.scalar_one_or_none()
    jira_key = jira_link.jira_key if jira_link else None

    background_tasks.add_task(_analyze_code_bg, run_id, jira_key)
    return {"status": "analyzing", "run_id": str(run_id)}


async def _analyze_code_bg(run_id: UUID, jira_key: Optional[str]):
    from app.agents.code_analysis_agent import run as run_analysis
    from app.services.rca_service import generate_and_post_rca
    from app.database import async_session
    from sqlalchemy import select as _select
    from app.models.artifact import Artifact as ArtifactModel
    import logging
    _log = logging.getLogger(__name__)

    async with async_session() as db:
        try:
            arts = await db.execute(
                _select(ArtifactModel).where(ArtifactModel.run_id == run_id)
            )
            all_arts = arts.scalars().all()

            pm_arts = sorted([a for a in all_arts if a.stage == "pm_verified"], key=lambda a: a.version, reverse=True)
            v1_arts = sorted([a for a in all_arts if a.stage == "verified_v1"], key=lambda a: a.version, reverse=True)

            agent2 = pm_arts[0].json_payload if pm_arts else {}
            verified = v1_arts[0].json_payload if v1_arts else {}

            analysis_result = await run_analysis(verified, agent2, jira_key)

            max_ver = await db.execute(
                _select(func.coalesce(func.max(ArtifactModel.version), 0))
                .where(ArtifactModel.run_id == run_id)
            )
            next_version = max_ver.scalar() + 1

            artifact = ArtifactModel(
                run_id=run_id,
                version=next_version,
                stage="code_analysis",
                json_payload=analysis_result,
                created_by="agent3",
            )
            db.add(artifact)
            await db.commit()

            # Transition to awaiting_eng_review if in the new flow
            run = await workflow_service.get_run(db, run_id)
            if run and run.status == "awaiting_code_fix":
                await workflow_service.transition(db, run, "code_analyzed")

            if jira_key and verified and agent2:
                await generate_and_post_rca(jira_key, verified, agent2)

            if jira_key and analysis_result.get("pr_url"):
                from app.services.rca_service import post_jira_comment
                pr_comment = (
                    f"h3. Auto-Fix PR Raised by Agent-3\n"
                    f"*PR:* [{analysis_result['pr_title']}|{analysis_result['pr_url']}]\n"
                    f"*Root Cause:* {analysis_result.get('root_cause', 'N/A')}\n"
                    f"*Fix:* {analysis_result.get('fix_description', 'N/A')}\n\n"
                    f"_This is a draft PR — please review before merging._"
                )
                await post_jira_comment(jira_key, pr_comment)

            _log.info("Agent-3 complete for run %s — valid=%s pr=%s",
                      run_id, analysis_result.get("is_valid_issue"), analysis_result.get("pr_url"))

        except Exception as e:
            _log.error("Agent-3 failed for run %s: %s", run_id, e)
            run = await workflow_service.get_run(db, run_id)
            if run and run.status == "awaiting_code_fix":
                await workflow_service.fail_run(db, run, f"Agent-3 failed: {e}")


# --- Engineer Review ---

class EngReviewRequest(BaseModel):
    status: str  # "approved" | "request_changes" | "rejected"
    reviewer: str
    comments: Optional[str] = None


@router.post("/{run_id}/review/engineer")
async def engineer_review(
    run_id: UUID,
    body: EngReviewRequest,
    db: AsyncSession = Depends(get_db),
):
    """Engineer submits review of the code fix."""
    run = await workflow_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "awaiting_eng_review":
        raise HTTPException(status_code=400, detail=f"Run is in state '{run.status}', expected 'awaiting_eng_review'")

    max_ver = await db.execute(
        select(func.coalesce(func.max(Artifact.version), 0))
        .where(Artifact.run_id == run_id)
    )
    next_version = max_ver.scalar() + 1

    review_artifact = Artifact(
        run_id=run_id,
        version=next_version,
        stage="eng_review",
        json_payload={"status": body.status, "reviewer": body.reviewer, "comments": body.comments},
        created_by=body.reviewer,
    )
    db.add(review_artifact)

    approval = Approval(
        run_id=run_id,
        stage="engineer",
        approved_by=body.reviewer,
        comments=body.comments,
    )
    db.add(approval)

    if body.status == "approved":
        run = await workflow_service.transition(db, run, "eng_approved")
    else:
        run = await workflow_service.transition(db, run, "eng_rejected")

    return {"status": body.status, "run_status": run.status}


# --- EM Sign-off ---

class EMSignoffRequest(BaseModel):
    manager: str
    comments: Optional[str] = None
    action: str = "approve"  # "approve" | "reject"


@router.post("/{run_id}/signoff/em")
async def em_signoff(
    run_id: UUID,
    body: EMSignoffRequest,
    db: AsyncSession = Depends(get_db),
):
    """EM signs off — this is the final step before 'done'."""
    run = await workflow_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "awaiting_em_signoff":
        raise HTTPException(status_code=400, detail=f"Run is in state '{run.status}', expected 'awaiting_em_signoff'")

    max_ver = await db.execute(
        select(func.coalesce(func.max(Artifact.version), 0))
        .where(Artifact.run_id == run_id)
    )
    next_version = max_ver.scalar() + 1

    signoff_artifact = Artifact(
        run_id=run_id,
        version=next_version,
        stage="em_signoff",
        json_payload={"manager": body.manager, "comments": body.comments, "action": body.action},
        created_by=body.manager,
    )
    db.add(signoff_artifact)

    approval = Approval(
        run_id=run_id,
        stage="em",
        approved_by=body.manager,
        comments=body.comments,
    )
    db.add(approval)

    if body.action == "approve":
        run = await workflow_service.transition(db, run, "em_signed_off")
    else:
        run = await workflow_service.transition(db, run, "em_rejected")

    return {"status": body.action, "run_status": run.status}
