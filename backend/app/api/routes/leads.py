import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import DbSession, Now
from app.core.enums import LeadStatus
from app.schemas.lead import LeadCreate, LeadDetail, LeadPage, LeadSummary, LeadUpdate, Overview
from app.services import leads as service

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=LeadPage)
def list_leads(
    db: DbSession,
    now: Now,
    q: Annotated[str | None, Query(max_length=100, description="Search name or company")] = None,
    status: Annotated[LeadStatus | None, Query(description="Filter by status")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> LeadPage:
    items, total = service.list_leads(db, q=q, status=status, limit=limit, offset=offset, now=now)
    return LeadPage(items=items, total=total, limit=limit, offset=offset)


@router.get("/overview", response_model=Overview)
def overview(db: DbSession, now: Now) -> Overview:
    return service.get_overview(db, now)


@router.post("", response_model=LeadSummary, status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreate, db: DbSession, now: Now) -> LeadSummary:
    return service.create_lead(db, payload, now)


@router.get("/{lead_id}", response_model=LeadDetail)
def get_lead(lead_id: uuid.UUID, db: DbSession, now: Now) -> LeadDetail:
    return service.get_lead_detail(db, lead_id, now)


@router.patch("/{lead_id}", response_model=LeadSummary)
def update_lead(lead_id: uuid.UUID, payload: LeadUpdate, db: DbSession, now: Now) -> LeadSummary:
    return service.update_lead(db, lead_id, payload, now)
