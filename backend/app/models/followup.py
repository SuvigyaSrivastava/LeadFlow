import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import FollowUpStatus
from app.core.timeutils import utcnow
from app.db.base import Base

_STATUS_LIST = ", ".join(f"'{s.value}'" for s in FollowUpStatus)


class FollowUp(Base):
    """One reminder. A lead may have many (historical + pending)."""

    __tablename__ = "follow_ups"
    __table_args__ = (
        CheckConstraint(f"status IN ({_STATUS_LIST})", name="status_valid"),
        Index("ix_follow_ups_lead_status", "lead_id", "status", "scheduled_at"),
        Index(
            "ix_follow_ups_pending_scheduled",
            "scheduled_at",
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"))
    discussion_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("discussions.id", ondelete="CASCADE"), unique=True
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        String(10),
        default=FollowUpStatus.PENDING.value,
        server_default=text(f"'{FollowUpStatus.PENDING.value}'"),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    lead = relationship("Lead", back_populates="follow_ups")
    discussion = relationship("Discussion", back_populates="follow_up")
