from __future__ import annotations

"""Pydantic models mirroring the Agent-1 and Agent-2 JSON output schemas."""

from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class EvidenceSpan(BaseModel):
    start_line: int
    end_line: int


class Requirement(BaseModel):
    type: str = Field(description="functional | non_functional | unknown")
    text: str
    evidence: List[EvidenceSpan] = []


class AcceptanceCriterion(BaseModel):
    text: str
    evidence: List[EvidenceSpan] = []


class Impact(BaseModel):
    severity_hint: str = ""
    who_is_affected: str = ""
    evidence: List[EvidenceSpan] = []


class Stakeholder(BaseModel):
    name: str
    role: str = ""
    evidence: List[EvidenceSpan] = []


class ProductArea(BaseModel):
    name: str
    evidence: List[EvidenceSpan] = []


class KBRef(BaseModel):
    ref_id: str = ""
    title: str = ""


class KBValidation(BaseModel):
    is_likely_supported_already: str = Field(default="unknown", description="yes | no | unknown")
    supporting_kb_refs: List[KBRef] = []
    notes: str = ""


class ConfidenceScores(BaseModel):
    overall: float = 0.0
    title: float = 0.0
    problem_statement: float = 0.0


class Agent1Output(BaseModel):
    title: str = ""
    request_type_hint: str = Field(default="unknown", description="feature_request | cri | bug | production_bug | unknown")
    problem_statement: str = ""
    requirements: List[Requirement] = []
    acceptance_criteria: List[AcceptanceCriterion] = []
    impact: Impact = Impact()
    stakeholders: List[Stakeholder] = []
    related_product_areas: List[ProductArea] = []
    kb_validation: KBValidation = KBValidation()
    questions_to_ask: List[str] = []
    confidence: ConfidenceScores = ConfidenceScores()


class ScoreBreakdown(BaseModel):
    arr: float = 0.0
    escalation: float = 0.0
    strategic: float = 0.0
    severity: float = 0.0
    affected_customers: float = 0.0


class Agent2Output(BaseModel):
    classification: str = Field(default="unknown", description="feature_request | cri | bug | production_bug")
    priority: str = Field(default="medium", description="low | medium | high")
    priority_score: float = 0.0
    score_breakdown: ScoreBreakdown = ScoreBreakdown()
    owner_team_suggestion: str = ""
    rationale: str = ""
    assumptions: List[str] = []


class ApprovalRequest(BaseModel):
    approved_by: str
    comments: Optional[str] = None
    edits: Optional[Dict] = None
    overrides: Optional[Dict] = None
