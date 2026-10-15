import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.follow_up import FollowUpOut
from app.schemas.lead import LeadSummary


class DiscussionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: str = Field(max_length=5000)
    # Aware datetimes are used as-is; naive ones are read in APP_TIMEZONE.
    follow_up_at: datetime | None = None
    # Explicit user choice to close pending reminders while logging this discussion.
    complete_follow_up_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)

    @field_validator("note", mode="before")
    @classmethod
    def _strip_note(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("note")
    @classmethod
    def _note_required(cls, value: str) -> str:
        if not value:
            raise ValueError("Discussion note cannot be empty")
        return value


class DiscussionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_id: uuid.UUID
    note: str
    created_at: datetime
    follow_up: FollowUpOut | None = None


class DiscussionCreated(BaseModel):
    discussion: DiscussionOut
    lead: LeadSummary
