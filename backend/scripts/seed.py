"""Seed demo data (fictional people and companies).

Idempotent: every demo lead has a deterministic UUID (uuid5 of its name). On each run
the demo leads are deleted (discussions and follow-ups cascade) and re-created with
timestamps relative to *now*, so "due today" and "overdue" are never stale and
re-running never creates duplicates. Leads you created yourself are left untouched.

Usage (from backend/):  python -m scripts.seed
"""

import uuid
from datetime import datetime, time, timedelta

from sqlalchemy import delete

from app.core.config import get_settings
from app.core.enums import FollowUpStatus, LeadStatus
from app.core.timeutils import app_tz, to_utc, utcnow
from app.db.session import SessionLocal
from app.models import Discussion, FollowUp, Lead

NAMESPACE = uuid.UUID("5b0d3d0c-3a41-4a6c-9a3e-1f0f6f1d9b11")


def _lead_id(name: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, name)


def build(now: datetime):
    tz = app_tz()
    local_now = now.astimezone(tz)

    def ago(days: int = 0, hours: int = 0) -> datetime:
        return now - timedelta(days=days, hours=hours)

    def local_at(day_offset: int, hour: int, minute: int = 0) -> datetime:
        day = local_now.date() + timedelta(days=day_offset)
        return to_utc(datetime.combine(day, time(hour, minute)))

    # Due-today slot: 4 PM local, but always still in the future (and still today).
    today_slot = min(
        max(local_at(0, 16), now + timedelta(minutes=10)),
        local_at(0, 23, 59),
    )

    # Each discussion is (created_at, note, follow_up | None) where
    # follow_up = (scheduled_at, status, completed_at | None).
    pending = FollowUpStatus.PENDING.value
    done = FollowUpStatus.COMPLETED.value
    cancelled = FollowUpStatus.CANCELLED.value
    return [
        dict(
            name="Priya Nair",
            company="Meridian Wealth Partners",
            phone="+91 98765 43210",
            status=LeadStatus.PROPOSAL_SENT,
            discussions=[
                (ago(9), "Lead created from the website enquiry form.", None),
                (
                    ago(6),
                    "Discovery call. Team of 12 advisors is tracking prospects in spreadsheets. "
                    "Pain points: dropped follow-ups and no shared view of conversations.",
                    (ago(5), done, ago(5)),
                ),
                (
                    ago(3),
                    "Sent the pricing tier PDF. Priya said she would review it with her managing "
                    "partner and asked whether we can import an existing contact list.",
                    (local_at(-1, 15), pending, None),
                ),
            ],
        ),
        dict(
            name="Daniel Okafor",
            company="Brightwater Capital",
            phone="555-0142",
            status=LeadStatus.QUALIFIED,
            discussions=[
                (
                    ago(5),
                    "Intro call. Interested in a lightweight tool for his two-person team. "
                    "Priority is a clear daily list of who to call.",
                    None,
                ),
                (
                    ago(1, 2),
                    "Demo done. Daniel wants to see how reminders work on mobile. "
                    "Will confirm budget with finance and send a decision date.",
                    (today_slot, pending, None),
                ),
            ],
        ),
        dict(
            name="Meera Kapoor",
            company="Lakeside Advisory",
            phone="+91 99100 20030",
            status=LeadStatus.CONTACTED,
            discussions=[
                (
                    ago(2),
                    "Left a voicemail and sent a short intro email. "
                    "Meera is travelling this week, so try again after she is back.",
                    (local_at(3, 11), pending, None),
                ),
            ],
        ),
        dict(
            name="Arjun Mehta",
            company="Northpoint Family Office",
            phone=None,
            status=LeadStatus.NEW,
            discussions=[],
        ),
        dict(
            name="Elena Rossi",
            company="Ostra Financial",
            phone="555-0188",
            status=LeadStatus.WON,
            discussions=[
                (
                    ago(30),
                    "Initial call. Needs a shared pipeline for 8 relationship managers.",
                    None,
                ),
                (ago(24), "Sent proposal and a short onboarding plan.", (ago(21), done, ago(21))),
                (ago(18), "Contract signed. Welcome package sent; kickoff booked.", None),
            ],
        ),
        dict(
            name="Tom Hargrove",
            company="Crestline Advisors",
            phone="555-0167",
            status=LeadStatus.LOST,
            discussions=[
                (ago(40), "Discovery call. Comparing us with two other tools.", None),
                (
                    ago(33),
                    "Follow-up call. They are staying with their current system for now.",
                    (ago(28), cancelled, None),
                ),
            ],
        ),
        dict(
            name="Kavya Reddy",
            company="Harborview Planning",
            phone="+91 98200 11122",
            status=LeadStatus.CONTACTED,
            discussions=[
                (
                    ago(8),
                    "First call. Looking for a way to log client conversations in one place. "
                    "Needs to check data-handling requirements with compliance.",
                    (ago(2), pending, None),
                ),
                (
                    ago(4),
                    "Sent our security overview. Kavya will share it with the compliance officer. "
                    "Wants a second call next week.",
                    (local_at(5, 10, 30), pending, None),
                ),
            ],
        ),
    ]


def seed() -> None:
    now = utcnow()
    specs = build(now)
    ids = [_lead_id(s["name"]) for s in specs]
    with SessionLocal() as db:
        db.execute(delete(Lead).where(Lead.id.in_(ids)))
        for spec, lead_id in zip(specs, ids, strict=True):
            created = min([d[0] for d in spec["discussions"]] or [now - timedelta(hours=2)])
            db.add(
                Lead(
                    id=lead_id,
                    name=spec["name"],
                    company=spec["company"],
                    phone=spec["phone"],
                    status=spec["status"].value,
                    created_at=created,
                    updated_at=max([d[0] for d in spec["discussions"]] or [created]),
                )
            )
            db.flush()
            for created_at, note, follow_up in spec["discussions"]:
                discussion = Discussion(lead_id=lead_id, note=note, created_at=created_at)
                db.add(discussion)
                db.flush()
                if follow_up:
                    scheduled_at, status, completed_at = follow_up
                    db.add(
                        FollowUp(
                            lead_id=lead_id,
                            discussion_id=discussion.id,
                            scheduled_at=scheduled_at,
                            status=status,
                            created_at=created_at,
                            updated_at=completed_at or created_at,
                            completed_at=completed_at,
                        )
                    )
        db.commit()
    print(f"Seeded {len(specs)} demo leads (timezone {get_settings().app_timezone}).")


if __name__ == "__main__":
    seed()
