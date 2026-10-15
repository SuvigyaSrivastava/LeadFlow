import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.enums import Attention, FollowUpState, LeadStatus
from app.schemas.follow_up import FollowUpOut

_PHONE_RE = re.compile(r"^[0-9+\-().\s]{3,30}$")


def _strip(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _blank_to_none(value: object) -> object:
    value = _strip(value)
    return None if value == "" else value


def _check_phone(value: str | None) -> str | None:
    if value is not None and not _PHONE_RE.match(value):
        raise ValueError("Enter a valid phone number, e.g. +91 98765 43210 or 555-0123")
    return value


class LeadCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=200)
    company: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    status: LeadStatus = LeadStatus.NEW

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, value: object) -> object:
        return _strip(value)

    @field_validator("name")
    @classmethod
    def _name_required(cls, value: str) -> str:
        if not value:
            raise ValueError("Name is required")
        return value

    @field_validator("company", "phone", mode="before")
    @classmethod
    def _optional(cls, value: object) -> object:
        return _blank_to_none(value)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return _check_phone(value)


class LeadUpdate(BaseModel):
    """PATCH semantics: only fields that are present are changed."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    status: LeadStatus | None = None

    @field_validator("name", "company", "phone", mode="before")
    @classmethod
    def _strip_values(cls, value: object) -> object:
        return _blank_to_none(value)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return _check_phone(value)

    @model_validator(mode="after")
    def _check_fields(self) -> "LeadUpdate":
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("Name cannot be empty")
        if "status" in self.model_fields_set and self.status is None:
            raise ValueError("Status cannot be empty")
        return self


class LeadSummary(BaseModel):
    """Row of the lead list. Everything the list needs, computed in one query."""

    id: uuid.UUID
    name: str
    company: str | None
    phone: str | None
    status: LeadStatus
    created_at: datetime
    updated_at: datetime
    discussion_count: int
    last_discussion_note: str | None
    last_discussion_at: datetime | None
    next_follow_up_id: uuid.UUID | None
    next_follow_up_at: datetime | None
    follow_up_state: FollowUpState | None
    pending_follow_up_count: int
    overdue_follow_up_count: int


class LeadDetail(LeadSummary):
    pending_follow_ups: list[FollowUpOut]
    attention: Attention | None


class LeadPage(BaseModel):
    items: list[LeadSummary]
    total: int
    limit: int
    offset: int


class Overview(BaseModel):
    due_today: int
    overdue: int
    active_leads: int
    total_leads: int
    status_counts: dict[str, int]
