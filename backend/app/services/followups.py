"""Follow-up (reminder) business rules."""

import uuid
from datetime import datetime, timedelta
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import FollowUpStatus
from app.core.errors import ConflictError, NotFoundError, ValidationFailed
from app.core.timeutils import classify_follow_up, local_day_bounds_utc, to_utc
from app.models import FollowUp
from app.schemas.follow_up import FollowUpOut, FollowUpUpdate, FollowUpWithLead, LeadRef

# Minute-granular pickers can land a few seconds in the past; tolerate that.
PAST_GRACE = timedelta(seconds=60)

Scope = Literal["attention", "upcoming", "pending"]


def validate_future(scheduled_at: datetime, now: datetime, field: str = "follow_up_at") -> datetime:
    value = to_utc(scheduled_at)
    if value < now - PAST_GRACE:
        raise ValidationFailed(field, "Follow-up must be scheduled for a future date and time")
    return value


def add_follow_up(
    db: Session,
    *,
    lead_id: uuid.UUID,
    discussion_id: uuid.UUID | None,
    scheduled_at: datetime,
    now: datetime,
) -> FollowUp:
    """Create a pending reminder. Caller owns the transaction (no commit here)."""
    follow_up = FollowUp(
        lead_id=lead_id,
        discussion_id=discussion_id,
        scheduled_at=scheduled_at,
        status=FollowUpStatus.PENDING.value,
        created_at=now,
        updated_at=now,
    )
    db.add(follow_up)
    db.flush()
    return follow_up


def to_out(follow_up: FollowUp, now: datetime) -> FollowUpOut:
    out = FollowUpOut.model_validate(follow_up)
    if follow_up.status == FollowUpStatus.PENDING.value:
        out.state = classify_follow_up(follow_up.scheduled_at, now)
    return out


def to_out_with_lead(follow_up: FollowUp, now: datetime) -> FollowUpWithLead:
    base = to_out(follow_up, now)
    lead = follow_up.lead
    return FollowUpWithLead(
        **base.model_dump(),
        lead=LeadRef(id=lead.id, name=lead.name, company=lead.company, status=lead.status),
    )


def list_follow_ups(
    db: Session, *, scope: Scope, now: datetime, lead_id: uuid.UUID | None = None
) -> list[FollowUpWithLead]:
    """Pending reminders, soonest first (so oldest-overdue leads the queue).

    attention = overdue + due today; upcoming = after today; pending = all pending.
    """
    _, end_of_today = local_day_bounds_utc(now)
    stmt = (
        select(FollowUp)
        .options(joinedload(FollowUp.lead))
        .where(FollowUp.status == FollowUpStatus.PENDING.value)
        .order_by(FollowUp.scheduled_at, FollowUp.id)
    )
    if scope == "attention":
        stmt = stmt.where(FollowUp.scheduled_at < end_of_today)
    elif scope == "upcoming":
        stmt = stmt.where(FollowUp.scheduled_at >= end_of_today)
    if lead_id:
        stmt = stmt.where(FollowUp.lead_id == lead_id)
    return [to_out_with_lead(f, now) for f in db.scalars(stmt).all()]


def update_follow_up(
    db: Session, follow_up_id: uuid.UUID, payload: FollowUpUpdate, now: datetime
) -> FollowUpWithLead:
    follow_up = db.scalar(
        select(FollowUp).options(joinedload(FollowUp.lead)).where(FollowUp.id == follow_up_id)
    )
    if follow_up is None:
        raise NotFoundError("Follow-up")
    if follow_up.status != FollowUpStatus.PENDING.value:
        raise ConflictError(
            f"This follow-up is already {follow_up.status} and can no longer be changed",
            code="FOLLOW_UP_NOT_PENDING",
        )

    try:
        if payload.scheduled_at is not None:
            follow_up.scheduled_at = validate_future(payload.scheduled_at, now, "scheduled_at")
        else:
            follow_up.status = payload.status
            if payload.status == FollowUpStatus.COMPLETED.value:
                follow_up.completed_at = now
        follow_up.updated_at = now
        follow_up.lead.updated_at = now
        db.commit()
    except Exception:
        db.rollback()
        raise
    return to_out_with_lead(follow_up, now)
