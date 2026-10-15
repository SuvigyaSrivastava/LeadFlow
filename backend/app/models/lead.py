import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import LeadStatus
from app.core.timeutils import utcnow
from app.db.base import Base

_STATUS_LIST = ", ".join(f"'{s.value}'" for s in LeadStatus)


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (
        CheckConstraint(f"status IN ({_STATUS_LIST})", name="status_valid"),
        CheckConstraint("length(btrim(name)) > 0", name="name_not_blank"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    company: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(
        String(20),
        default=LeadStatus.NEW.value,
        server_default=text(f"'{LeadStatus.NEW.value}'"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    discussions = relationship(
        "Discussion", back_populates="lead", cascade="all, delete-orphan", passive_deletes=True
    )
    follow_ups = relationship(
        "FollowUp", back_populates="lead", cascade="all, delete-orphan", passive_deletes=True
    )
