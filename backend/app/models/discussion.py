import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.timeutils import utcnow
from app.db.base import Base


class Discussion(Base):
    __tablename__ = "discussions"
    __table_args__ = (
        CheckConstraint("length(btrim(note)) > 0", name="note_not_blank"),
        Index("ix_discussions_lead_created", "lead_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"))
    note: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    lead = relationship("Lead", back_populates="discussions")
    # A discussion can create at most one follow-up (unique FK on follow_ups.discussion_id).
    follow_up = relationship("FollowUp", back_populates="discussion", uselist=False)
