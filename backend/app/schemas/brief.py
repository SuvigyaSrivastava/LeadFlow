from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class BriefContent(BaseModel):
    """Structure the model (or the demo generator) must produce."""

    summary: str
    recorded_interests: list[str] = Field(default_factory=list)
    open_items: list[str] = Field(default_factory=list)
    suggested_questions: list[str] = Field(default_factory=list)
    draft_message: str


class ConversationBrief(BriefContent):
    mode: Literal["llm", "demo"]
    provider: str
    model: str | None
    generated_at: datetime
    discussion_count: int
    notice: str


class AppConfig(BaseModel):
    timezone: str
    ai_mode: Literal["llm", "demo", "unavailable"]
    ai_provider: str
