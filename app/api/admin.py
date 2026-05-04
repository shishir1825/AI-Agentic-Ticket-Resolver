from __future__ import annotations

"""Admin endpoints for scoring config and team ownership mapping."""

from uuid import UUID
from typing import Any, Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.scoring_config import ScoringConfig, TeamOwnershipMap

router = APIRouter(prefix="/api/admin", tags=["admin"])


class ScoringConfigRequest(BaseModel):
    weights: Dict[str, Any]
    thresholds: Dict[str, Any]
    updated_by: str


class ScoringConfigResponse(BaseModel):
    id: UUID
    weights: Dict[str, Any]
    thresholds: Dict[str, Any]
    updated_by: str

    model_config = {"from_attributes": True}


class TeamMappingRequest(BaseModel):
    product_area: str
    owning_team: str
    jira_component: Optional[str] = None


class TeamMappingResponse(BaseModel):
    id: UUID
    product_area: str
    owning_team: str
    jira_component: Optional[str] = None

    model_config = {"from_attributes": True}


@router.get("/scoring-config", response_model=Optional[ScoringConfigResponse])
async def get_scoring_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScoringConfig).order_by(ScoringConfig.updated_at.desc()).limit(1))
    return result.scalar_one_or_none()


@router.put("/scoring-config", response_model=ScoringConfigResponse)
async def upsert_scoring_config(body: ScoringConfigRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScoringConfig).order_by(ScoringConfig.updated_at.desc()).limit(1))
    existing = result.scalar_one_or_none()
    if existing:
        existing.weights = body.weights
        existing.thresholds = body.thresholds
        existing.updated_by = body.updated_by
        db.add(existing)
    else:
        existing = ScoringConfig(weights=body.weights, thresholds=body.thresholds, updated_by=body.updated_by)
        db.add(existing)
    await db.commit()
    await db.refresh(existing)
    return existing


@router.get("/team-mappings", response_model=List[TeamMappingResponse])
async def list_team_mappings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TeamOwnershipMap).order_by(TeamOwnershipMap.product_area))
    return result.scalars().all()


@router.post("/team-mappings", response_model=TeamMappingResponse)
async def create_team_mapping(body: TeamMappingRequest, db: AsyncSession = Depends(get_db)):
    mapping = TeamOwnershipMap(
        product_area=body.product_area,
        owning_team=body.owning_team,
        jira_component=body.jira_component,
    )
    db.add(mapping)
    await db.commit()
    await db.refresh(mapping)
    return mapping


@router.delete("/team-mappings/{mapping_id}")
async def delete_team_mapping(mapping_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TeamOwnershipMap).where(TeamOwnershipMap.id == mapping_id))
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    await db.delete(mapping)
    await db.commit()
    return {"status": "deleted"}
