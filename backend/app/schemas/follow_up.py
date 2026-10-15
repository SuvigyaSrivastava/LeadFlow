import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator

from app.core.enums import FollowUpState, FollowUpStatus, LeadStatus


class FollowUpOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_id: uuid.UUID
    discussion_id: uuid.UUID | None
    scheduled_at: datetime
    status: FollowUpStatus
    # Only set while pending: overdue | today | upcoming.
    state: FollowUpState | None = None
    created_at: datetime
    completed_at: datetime | None


class LeadRef(BaseModel):
    id: uuid.UUID
    name: str
    company: str | None
    status: LeadStatus


class FollowUpWithLead(FollowUpOut):
    lead: LeadRef


class FollowUpUpdate(BaseModel):
    """Reschedule (scheduled_at) OR close (status). Not both at once."""

    model_config = ConfigDict(extra="forbid")

    scheduled_at: datetime | None = None
    status: Literal["completed", "cancelled"] | None = None

    @model_validator(mode="after")
    def _exactly_one(self) -> "FollowUpUpdate":
        provided = [f for f in ("scheduled_at", "status") if getattr(self, f) is not None]
        if not provided:
            raise ValueError("Provide scheduled_at to reschedule or status to complete/cancel")
        if len(provided) > 1:
            raise ValueError("Reschedule and complete/cancel in separate requests")
        return self
