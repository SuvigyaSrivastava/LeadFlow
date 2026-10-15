import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import DbSession, Now
from app.schemas.follow_up import FollowUpUpdate, FollowUpWithLead
from app.services import followups as service

router = APIRouter(prefix="/follow-ups", tags=["follow-ups"])


@router.get("", response_model=list[FollowUpWithLead])
def list_follow_ups(
    db: DbSession,
    now: Now,
    scope: Annotated[
        service.Scope,
        Query(description="attention = overdue + due today, upcoming = after today, pending = all"),
    ] = "attention",
    lead_id: uuid.UUID | None = None,
) -> list[FollowUpWithLead]:
    return service.list_follow_ups(db, scope=scope, now=now, lead_id=lead_id)


@router.patch("/{follow_up_id}", response_model=FollowUpWithLead)
def update_follow_up(
    follow_up_id: uuid.UUID, payload: FollowUpUpdate, db: DbSession, now: Now
) -> FollowUpWithLead:
    return service.update_follow_up(db, follow_up_id, payload, now)
