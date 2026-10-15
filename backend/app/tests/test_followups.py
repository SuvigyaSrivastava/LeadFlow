from datetime import UTC, datetime

import pytest

from app.core.enums import Attention
from app.services.leads import attention_for
from app.tests.helpers import create_lead, get_lead, in_, log_discussion


def _schedule(client, clock, lead_id, **delta) -> str:
    body = log_discussion(client, lead_id, "note", follow_up_at=in_(clock, **delta)).json()
    return body["discussion"]["follow_up"]["id"]


def test_reschedule_pending_follow_up_recalculates_next(client, clock):
    lead = create_lead(client)
    soon = _schedule(client, clock, lead["id"], days=1)
    later = _schedule(client, clock, lead["id"], days=4)
    assert get_lead(client, lead["id"])["next_follow_up_id"] == soon

    response = client.patch(f"/api/follow-ups/{soon}", json={"scheduled_at": in_(clock, days=7)})
    assert response.status_code == 200
    assert response.json()["scheduled_at"].startswith("2026-10-22")
    assert response.json()["lead"]["name"] == "Ada Lovelace"
    assert get_lead(client, lead["id"])["next_follow_up_id"] == later


def test_overdue_follow_up_stays_pending_until_the_user_acts(client, clock):
    lead = create_lead(client)
    follow_up = _schedule(client, clock, lead["id"], hours=1)
    clock.advance(days=2)
    queue = client.get("/api/follow-ups").json()
    assert [(f["id"], f["state"]) for f in queue] == [(follow_up, "overdue")]
    assert get_lead(client, lead["id"])["attention"] == "follow_up_overdue"


def test_overdue_follow_up_can_be_rescheduled(client, clock):
    lead = create_lead(client)
    follow_up = _schedule(client, clock, lead["id"], hours=1)
    clock.advance(days=2)
    response = client.patch(
        f"/api/follow-ups/{follow_up}", json={"scheduled_at": in_(clock, days=1)}
    )
    assert response.status_code == 200 and response.json()["state"] == "upcoming"
    assert get_lead(client, lead["id"])["overdue_follow_up_count"] == 0


def test_complete_follow_up_removes_it_from_queue_and_keeps_history(client, clock):
    lead = create_lead(client)
    follow_up = _schedule(client, clock, lead["id"], hours=2)
    response = client.patch(f"/api/follow-ups/{follow_up}", json={"status": "completed"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed" and body["state"] is None
    assert body["completed_at"] is not None
    assert client.get("/api/follow-ups?scope=pending").json() == []
    detail = get_lead(client, lead["id"])
    assert detail["next_follow_up_at"] is None and detail["pending_follow_ups"] == []
    # The historical reminder is still attached to its discussion.
    timeline = client.get(f"/api/leads/{lead['id']}/discussions").json()
    assert timeline[0]["follow_up"]["status"] == "completed"


def test_cancel_follow_up(client, clock):
    lead = create_lead(client)
    follow_up = _schedule(client, clock, lead["id"], days=1)
    response = client.patch(f"/api/follow-ups/{follow_up}", json={"status": "cancelled"})
    assert response.status_code == 200 and response.json()["status"] == "cancelled"
    assert response.json()["completed_at"] is None
    assert client.get("/api/follow-ups?scope=pending").json() == []


def test_closed_follow_ups_cannot_be_changed_again(client, clock):
    lead = create_lead(client)
    follow_up = _schedule(client, clock, lead["id"], days=1)
    client.patch(f"/api/follow-ups/{follow_up}", json={"status": "completed"})
    for payload in ({"status": "cancelled"}, {"scheduled_at": in_(clock, days=3)}):
        response = client.patch(f"/api/follow-ups/{follow_up}", json=payload)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "FOLLOW_UP_NOT_PENDING"


def test_follow_up_patch_validation_and_not_found(client, clock):
    lead = create_lead(client)
    follow_up = _schedule(client, clock, lead["id"], days=1)
    url = f"/api/follow-ups/{follow_up}"
    assert client.patch(url, json={}).status_code == 422
    assert client.patch(url, json={"status": "pending"}).status_code == 422
    both = {"status": "completed", "scheduled_at": in_(clock, days=2)}
    assert client.patch(url, json=both).status_code == 422
    past = client.patch(url, json={"scheduled_at": in_(clock, hours=-3)})
    assert past.status_code == 422
    assert past.json()["error"]["details"]["fields"][0]["field"] == "scheduled_at"
    missing = "00000000-0000-0000-0000-000000000000"
    assert (
        client.patch(f"/api/follow-ups/{missing}", json={"status": "completed"}).status_code == 404
    )


def test_tomorrow_is_not_due_today_and_scopes_split_correctly(client, clock):
    a = create_lead(client, "A")
    b = create_lead(client, "B")
    c = create_lead(client, "C")
    _schedule(client, clock, a["id"], hours=1)  # 13:00 IST today
    _schedule(client, clock, b["id"], hours=12)  # 00:00 IST tomorrow (starts the next day)
    _schedule(client, clock, c["id"], days=2)
    attention = client.get("/api/follow-ups?scope=attention").json()
    upcoming = client.get("/api/follow-ups?scope=upcoming").json()
    assert [f["lead"]["name"] for f in attention] == ["A"]
    assert [f["state"] for f in attention] == ["today"]
    assert [f["lead"]["name"] for f in upcoming] == ["B", "C"]
    assert all(f["state"] == "upcoming" for f in upcoming)
    assert len(client.get("/api/follow-ups?scope=pending").json()) == 3
    assert client.get("/api/follow-ups?scope=bogus").status_code == 422


def test_reminders_near_midnight_use_the_configured_timezone(client, clock):
    # 23:55 IST on 2026-10-15 == 18:25 UTC.
    clock.now = datetime(2026, 10, 15, 18, 25, tzinfo=UTC)
    lead = create_lead(client)
    late_tonight = _schedule(client, clock, lead["id"], minutes=4)  # 23:59 IST: today
    after_midnight = _schedule(client, clock, lead["id"], minutes=15)  # 00:10 IST: tomorrow
    states = {f["id"]: f["state"] for f in client.get("/api/follow-ups?scope=pending").json()}
    assert states[late_tonight] == "today"
    assert states[after_midnight] == "upcoming"

    # Two minutes after local midnight: the 23:59 reminder is overdue, the 00:10 one is due today.
    clock.now = datetime(2026, 10, 15, 18, 32, tzinfo=UTC)
    states = {f["id"]: f["state"] for f in client.get("/api/follow-ups?scope=pending").json()}
    assert states[late_tonight] == "overdue"
    assert states[after_midnight] == "today"


def test_global_queue_orders_oldest_overdue_first_then_today(client, clock):
    a, b, c = (create_lead(client, n) for n in "ABC")
    _schedule(client, clock, a["id"], hours=3)
    _schedule(client, clock, b["id"], hours=1)
    _schedule(client, clock, c["id"], hours=2)
    clock.advance(hours=2, minutes=30)  # B and C overdue, A due today
    queue = client.get("/api/follow-ups").json()
    assert [(f["lead"]["name"], f["state"]) for f in queue] == [
        ("B", "overdue"),
        ("C", "overdue"),
        ("A", "today"),
    ]


def test_queue_can_be_filtered_by_lead(client, clock):
    a, b = create_lead(client, "A"), create_lead(client, "B")
    _schedule(client, clock, a["id"], hours=1)
    _schedule(client, clock, b["id"], hours=1)
    queue = client.get("/api/follow-ups", params={"lead_id": a["id"]}).json()
    assert [f["lead"]["name"] for f in queue] == ["A"]


def test_lead_with_only_historical_follow_ups_has_none_pending(client, clock):
    lead = create_lead(client)
    done = _schedule(client, clock, lead["id"], days=1)
    gone = _schedule(client, clock, lead["id"], days=2)
    client.patch(f"/api/follow-ups/{done}", json={"status": "completed"})
    client.patch(f"/api/follow-ups/{gone}", json={"status": "cancelled"})
    item = client.get("/api/leads").json()["items"][0]
    assert item["next_follow_up_at"] is None and item["follow_up_state"] is None
    assert item["pending_follow_up_count"] == 0


NOW = datetime(2026, 10, 15, 6, 30, tzinfo=UTC)


@pytest.mark.parametrize(
    ("kwargs", "expected"),
    [
        (
            dict(status="Contacted", last_activity_at=NOW, pending_count=1, overdue_count=1),
            Attention.FOLLOW_UP_OVERDUE,
        ),
        (
            dict(status="Contacted", last_activity_at=NOW, pending_count=1, overdue_count=0),
            Attention.FOLLOW_UP_SCHEDULED,
        ),
        (
            dict(status="Contacted", last_activity_at=None, pending_count=0, overdue_count=0),
            Attention.NO_RECENT_ACTIVITY,
        ),
        (
            dict(
                status="New",
                last_activity_at=NOW.replace(month=9),
                pending_count=0,
                overdue_count=0,
            ),
            Attention.NO_RECENT_ACTIVITY,
        ),
        (
            dict(
                status="Qualified",
                last_activity_at=NOW.replace(hour=1),
                pending_count=0,
                overdue_count=0,
            ),
            Attention.RECENTLY_CONTACTED,
        ),
        (
            dict(
                status="Qualified",
                last_activity_at=NOW.replace(day=9),
                pending_count=0,
                overdue_count=0,
            ),
            None,
        ),
        (dict(status="Won", last_activity_at=None, pending_count=0, overdue_count=0), None),
    ],
)
def test_attention_indicator_rules(kwargs, expected):
    assert attention_for(now=NOW, **kwargs) == expected
