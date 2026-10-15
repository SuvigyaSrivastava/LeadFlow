"""Lead queries and commands.

The lead list is one SQL statement (no N+1): latest discussion, discussion count,
next pending follow-up and pending/overdue counts are joined in as subqueries.

List ordering (documented rule):
  1. leads whose next pending follow-up is OVERDUE, oldest overdue first
  2. leads whose next pending follow-up is due TODAY, earliest first
  3. everyone else, most recent activity first (last discussion, else created)
"""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import case, func, or_, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.orm import Session

from app.core.enums import CLOSED_STATUSES, Attention, FollowUpStatus, LeadStatus
from app.core.errors import NotFoundError
from app.core.timeutils import classify_follow_up, local_day_bounds_utc
from app.models import Discussion, FollowUp, Lead
from app.schemas.lead import LeadCreate, LeadDetail, LeadSummary, LeadUpdate, Overview
from app.services import followups as followups_service

PREVIEW_CHARS = 300
STALE_AFTER = timedelta(days=14)
RECENT_WITHIN = timedelta(days=3)

PENDING = FollowUpStatus.PENDING.value


def attention_for(
    *,
    status: str,
    last_activity_at: datetime | None,
    pending_count: int,
    overdue_count: int,
    now: datetime,
) -> Attention | None:
    """Rule-based operational indicator. Deterministic; not a conversion prediction."""
    if overdue_count > 0:
        return Attention.FOLLOW_UP_OVERDUE
    if pending_count > 0:
        return Attention.FOLLOW_UP_SCHEDULED
    if status in CLOSED_STATUSES:
        return None
    if last_activity_at is None or now - last_activity_at > STALE_AFTER:
        return Attention.NO_RECENT_ACTIVITY
    if now - last_activity_at <= RECENT_WITHIN:
        return Attention.RECENTLY_CONTACTED
    return None


def _filters(q: str | None, status: LeadStatus | None) -> list:
    conditions = []
    if status is not None:
        conditions.append(Lead.status == status.value)
    if q and q.strip():
        term = q.strip()
        conditions.append(
            or_(
                Lead.name.icontains(term, autoescape=True),
                Lead.company.icontains(term, autoescape=True),
            )
        )
    return conditions


def _summary_statement(now: datetime):
    _, end_of_today = local_day_bounds_utc(now)

    latest = (
        select(
            Discussion.lead_id.label("lead_id"),
            Discussion.note.label("note"),
            Discussion.created_at.label("created_at"),
        )
        .ext(distinct_on(Discussion.lead_id))
        .order_by(Discussion.lead_id, Discussion.created_at.desc(), Discussion.id.desc())
        .subquery("latest")
    )
    counts = (
        select(Discussion.lead_id.label("lead_id"), func.count().label("n"))
        .group_by(Discussion.lead_id)
        .subquery("dcount")
    )
    nxt = (
        select(
            FollowUp.lead_id.label("lead_id"),
            FollowUp.id.label("id"),
            FollowUp.scheduled_at.label("scheduled_at"),
        )
        .where(FollowUp.status == PENDING)
        .ext(distinct_on(FollowUp.lead_id))
        .order_by(FollowUp.lead_id, FollowUp.scheduled_at, FollowUp.id)
        .subquery("nextfu")
    )
    pending = (
        select(
            FollowUp.lead_id.label("lead_id"),
            func.count().label("pending"),
            func.count().filter(FollowUp.scheduled_at < now).label("overdue"),
        )
        .where(FollowUp.status == PENDING)
        .group_by(FollowUp.lead_id)
        .subquery("pcount")
    )

    group = case(
        (nxt.c.scheduled_at < now, 0),
        (nxt.c.scheduled_at < end_of_today, 1),
        else_=2,
    )
    attention_sort = case((group < 2, nxt.c.scheduled_at), else_=None)
    activity = func.coalesce(latest.c.created_at, Lead.created_at)

    stmt = (
        select(
            Lead,
            func.left(latest.c.note, PREVIEW_CHARS).label("last_note"),
            latest.c.created_at.label("last_at"),
            func.coalesce(counts.c.n, 0).label("discussion_count"),
            nxt.c.id.label("next_id"),
            nxt.c.scheduled_at.label("next_at"),
            func.coalesce(pending.c.pending, 0).label("pending_count"),
            func.coalesce(pending.c.overdue, 0).label("overdue_count"),
        )
        .outerjoin(latest, latest.c.lead_id == Lead.id)
        .outerjoin(counts, counts.c.lead_id == Lead.id)
        .outerjoin(nxt, nxt.c.lead_id == Lead.id)
        .outerjoin(pending, pending.c.lead_id == Lead.id)
    )
    order = (group, attention_sort.asc(), activity.desc(), Lead.id)
    return stmt, order


def _row_to_summary(row, now: datetime) -> LeadSummary:
    lead: Lead = row.Lead
    return LeadSummary(
        id=lead.id,
        name=lead.name,
        company=lead.company,
        phone=lead.phone,
        status=lead.status,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        discussion_count=row.discussion_count,
        last_discussion_note=row.last_note,
        last_discussion_at=row.last_at,
        next_follow_up_id=row.next_id,
        next_follow_up_at=row.next_at,
        follow_up_state=classify_follow_up(row.next_at, now) if row.next_at else None,
        pending_follow_up_count=row.pending_count,
        overdue_follow_up_count=row.overdue_count,
    )


def list_leads(
    db: Session,
    *,
    q: str | None,
    status: LeadStatus | None,
    limit: int,
    offset: int,
    now: datetime,
) -> tuple[list[LeadSummary], int]:
    conditions = _filters(q, status)
    stmt, order = _summary_statement(now)
    rows = db.execute(stmt.where(*conditions).order_by(*order).limit(limit).offset(offset)).all()
    total = db.scalar(select(func.count()).select_from(Lead).where(*conditions)) or 0
    return [_row_to_summary(r, now) for r in rows], total


def get_lead_summary(db: Session, lead_id: uuid.UUID, now: datetime) -> LeadSummary:
    stmt, _ = _summary_statement(now)
    row = db.execute(stmt.where(Lead.id == lead_id)).first()
    if row is None:
        raise NotFoundError("Lead")
    return _row_to_summary(row, now)


def get_lead_detail(db: Session, lead_id: uuid.UUID, now: datetime) -> LeadDetail:
    summary = get_lead_summary(db, lead_id, now)
    pending = followups_service.list_follow_ups(db, scope="pending", now=now, lead_id=lead_id)
    attention = attention_for(
        status=summary.status.value,
        last_activity_at=summary.last_discussion_at,
        pending_count=summary.pending_follow_up_count,
        overdue_count=summary.overdue_follow_up_count,
        now=now,
    )
    return LeadDetail(
        **summary.model_dump(),
        pending_follow_ups=[p.model_dump(exclude={"lead"}) for p in pending],
        attention=attention,
    )


def create_lead(db: Session, payload: LeadCreate, now: datetime) -> LeadSummary:
    lead = Lead(
        name=payload.name,
        company=payload.company,
        phone=payload.phone,
        status=payload.status.value,
        created_at=now,
        updated_at=now,
    )
    try:
        db.add(lead)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return get_lead_summary(db, lead.id, now)


def update_lead(db: Session, lead_id: uuid.UUID, payload: LeadUpdate, now: datetime) -> LeadSummary:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise NotFoundError("Lead")
    try:
        for field in payload.model_fields_set:
            value = getattr(payload, field)
            setattr(lead, field, value.value if isinstance(value, LeadStatus) else value)
        lead.updated_at = now
        db.commit()
    except Exception:
        db.rollback()
        raise
    return get_lead_summary(db, lead_id, now)


def get_overview(db: Session, now: datetime) -> Overview:
    _, end_of_today = local_day_bounds_utc(now)
    overdue, due_today = db.execute(
        select(
            func.count().filter(FollowUp.scheduled_at < now),
            func.count().filter(FollowUp.scheduled_at >= now, FollowUp.scheduled_at < end_of_today),
        ).where(FollowUp.status == PENDING)
    ).one()

    by_status = dict(db.execute(select(Lead.status, func.count()).group_by(Lead.status)).all())
    status_counts = {s.value: by_status.get(s.value, 0) for s in LeadStatus}
    total = sum(status_counts.values())
    closed = sum(status_counts[s.value] for s in CLOSED_STATUSES)
    return Overview(
        due_today=due_today,
        overdue=overdue,
        active_leads=total - closed,
        total_leads=total,
        status_counts=status_counts,
    )
