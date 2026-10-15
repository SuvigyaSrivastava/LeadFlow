import uuid

from fastapi import APIRouter, status

from app.api.deps import AppSettings, DbSession, Now
from app.schemas.brief import ConversationBrief
from app.schemas.discussion import DiscussionCreate, DiscussionCreated, DiscussionOut
from app.services import conversation_brief
from app.services import discussions as service

router = APIRouter(prefix="/leads/{lead_id}", tags=["discussions"])


@router.get("/discussions", response_model=list[DiscussionOut])
def list_discussions(lead_id: uuid.UUID, db: DbSession, now: Now) -> list[DiscussionOut]:
    return service.list_discussions(db, lead_id, now)


@router.post("/discussions", response_model=DiscussionCreated, status_code=status.HTTP_201_CREATED)
def create_discussion(
    lead_id: uuid.UUID, payload: DiscussionCreate, db: DbSession, now: Now
) -> DiscussionCreated:
    return service.create_discussion(db, lead_id, payload, now)


@router.post("/conversation-brief", response_model=ConversationBrief, tags=["ai"])
def conversation_brief_endpoint(
    lead_id: uuid.UUID, db: DbSession, now: Now, settings: AppSettings
) -> ConversationBrief:
    return conversation_brief.generate_brief(db, lead_id, settings, now)
