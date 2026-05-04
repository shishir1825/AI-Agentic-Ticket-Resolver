"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_pgvector() -> bool:
    """Check if pgvector extension is available in this Postgres installation."""
    try:
        conn = op.get_bind()
        result = conn.execute(sa.text(
            "SELECT 1 FROM pg_available_extensions WHERE name = 'vector'"
        ))
        return result.scalar() is not None
    except Exception:
        return False


def upgrade() -> None:
    use_vector = _has_pgvector()
    if use_vector:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("uploader_user_id", sa.String(255), nullable=False),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("mime_type", sa.String(128), nullable=False),
        sa.Column("storage_uri", sa.String(1024), nullable=False),
        sa.Column("extracted_text", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    chunk_columns = [
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("chunk_index", sa.Integer, nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("start_line", sa.Integer, nullable=False),
        sa.Column("end_line", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    ]
    if use_vector:
        from pgvector.sqlalchemy import Vector
        chunk_columns.insert(-1, sa.Column("embedding", Vector(1536), nullable=True))

    op.create_table("document_chunks", *chunk_columns)

    op.create_table(
        "runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("current_step", sa.String(50), nullable=False),
        sa.Column("error_message", sa.String(2048), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "artifacts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("runs.id"), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("stage", sa.String(50), nullable=False),
        sa.Column("json_payload", JSONB, nullable=False),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "approvals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("runs.id"), nullable=False),
        sa.Column("stage", sa.String(50), nullable=False),
        sa.Column("approved_by", sa.String(255), nullable=False),
        sa.Column("comments", sa.Text, nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "jira_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("runs.id"), nullable=False, unique=True),
        sa.Column("jira_key", sa.String(50), nullable=False),
        sa.Column("jira_url", sa.String(1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "scoring_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("weights", JSONB, nullable=False),
        sa.Column("thresholds", JSONB, nullable=False),
        sa.Column("updated_by", sa.String(255), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "team_ownership_map",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("product_area", sa.String(255), nullable=False, unique=True),
        sa.Column("owning_team", sa.String(255), nullable=False),
        sa.Column("jira_component", sa.String(255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.execute("""
        INSERT INTO scoring_config (id, weights, thresholds, updated_by, updated_at)
        VALUES (
            gen_random_uuid(),
            '{"arr": 30, "escalation": 25, "strategic": 20, "severity": 15, "affected_customers": 10}'::jsonb,
            '{"high": 70, "medium": 40}'::jsonb,
            'system',
            NOW()
        )
    """)


def downgrade() -> None:
    op.drop_table("team_ownership_map")
    op.drop_table("scoring_config")
    op.drop_table("jira_links")
    op.drop_table("approvals")
    op.drop_table("artifacts")
    op.drop_table("runs")
    op.drop_table("document_chunks")
    op.drop_table("documents")
