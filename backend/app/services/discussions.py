"""Discussion timeline commands."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import FollowUpStatus
from app.core.errors import AppError, NotFoundError
from app.models import Discussion, FollowUp, Lead
from app.schemas.discussion import DiscussionCreate, DiscussionCreated, DiscussionOut
from app.services import followups as followups_service
from app.services import leads as leads_service


def _ensure_lead(db: Session, lead_id: uuid.UUID) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise NotFoundError("Lead")
    return lead


def _to_out(discussion: Discussion, now: datetime) -> DiscussionOut:
    follow_up = (
        followups_service.to_out(discussion.follow_up, now) if discussion.follow_up else None
    )
    return DiscussionOut(
        id=discussion.id,
        lead_id=discussion.lead_id,
        note=discussion.note,
        created_at=discussion.created_at,
        follow_up=follow_up,
    )


def list_discussions(db: Session, lead_id: uuid.UUID, now: datetime) -> list[DiscussionOut]:
    """Newest first; id breaks ties so the order is deterministic."""
    _ensure_lead(db, lead_id)
    rows = db.scalars(
        select(Discussion)
        .options(selectinload(Discussion.follow_up))
        .where(Discussion.lead_id == lead_id)
        .order_by(Discussion.created_at.desc(), Discussion.id.desc())
    ).all()
    return [_to_out(d, now) for d in rows]


def create_discussion(
    db: Session, lead_id: uuid.UUID, payload: DiscussionCreate, now: datetime
) -> DiscussionCreated:
    """Create the discussion, its optional follow-up and any explicit completions
    in ONE transaction: either everything is stored or nothing is."""
    lead = _ensure_lead(db, lead_id)

    scheduled_at = None
    if payload.follow_up_at is not None:
        scheduled_at = followups_service.validate_future(payload.follow_up_at, now)

    try:
        to_complete = _load_follow_ups_to_complete(db, lead_id, payload.complete_follow_up_ids)

        discussion = Discussion(lead_id=lead_id, note=payload.note, created_at=now)
        db.add(discussion)
        db.flush()

        if scheduled_at is not None:
            followups_service.add_follow_up(
                db,
                lead_id=lead_id,
                discussion_id=discussion.id,
                scheduled_at=scheduled_at,
                now=now,
            )
        for follow_up in to_complete:
            follow_up.status = FollowUpStatus.COMPLETED.value
            follow_up.completed_at = now
            follow_up.updated_at = now

        lead.updated_at = now
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(discussion)
    return DiscussionCreated(
        discussion=_to_out(discussion, now),
        lead=leads_service.get_lead_summary(db, lead_id, now),
    )


def _load_follow_ups_to_complete(
    db: Session, lead_id: uuid.UUID, ids: list[uuid.UUID]
) -> list[FollowUp]:
    unique_ids = list(dict.fromkeys(ids))
    if not unique_ids:
        return []
    found = db.scalars(
        select(FollowUp).where(
            FollowUp.id.in_(unique_ids),
            FollowUp.lead_id == lead_id,
            FollowUp.status == FollowUpStatus.PENDING.value,
        )
    ).all()
    if len(found) != len(unique_ids):
        raise AppError(
            "One or more follow-ups to complete are not pending follow-ups of this lead",
            code="INVALID_FOLLOW_UP",
        )
    return list(found)
