"""create leads, discussions and follow_ups

Revision ID: 0001
Revises:
Create Date: 2026-10-15 05:59:32.186466
"""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'New'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost')",
            name=op.f("ck_leads_status_valid"),
        ),
        sa.CheckConstraint("length(btrim(name)) > 0", name=op.f("ck_leads_name_not_blank")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_leads")),
    )
    op.create_index(op.f("ix_leads_status"), "leads", ["status"], unique=False)
    op.create_table(
        "discussions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("length(btrim(note)) > 0", name=op.f("ck_discussions_note_not_blank")),
        sa.ForeignKeyConstraint(
            ["lead_id"], ["leads.id"], name=op.f("fk_discussions_lead_id_leads"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_discussions")),
    )
    op.create_index(
        "ix_discussions_lead_created", "discussions", ["lead_id", "created_at"], unique=False
    )
    op.create_table(
        "follow_ups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=False),
        sa.Column("discussion_id", sa.Uuid(), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status", sa.String(length=10), server_default=sa.text("'pending'"), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'completed', 'cancelled')",
            name=op.f("ck_follow_ups_status_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["discussion_id"],
            ["discussions.id"],
            name=op.f("fk_follow_ups_discussion_id_discussions"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["lead_id"], ["leads.id"], name=op.f("fk_follow_ups_lead_id_leads"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_follow_ups")),
        sa.UniqueConstraint("discussion_id", name=op.f("uq_follow_ups_discussion_id")),
    )
    op.create_index(
        "ix_follow_ups_lead_status",
        "follow_ups",
        ["lead_id", "status", "scheduled_at"],
        unique=False,
    )
    op.create_index(
        "ix_follow_ups_pending_scheduled",
        "follow_ups",
        ["scheduled_at"],
        unique=False,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_follow_ups_pending_scheduled",
        table_name="follow_ups",
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.drop_index("ix_follow_ups_lead_status", table_name="follow_ups")
    op.drop_table("follow_ups")
    op.drop_index("ix_discussions_lead_created", table_name="discussions")
    op.drop_table("discussions")
    op.drop_index(op.f("ix_leads_status"), table_name="leads")
    op.drop_table("leads")
