from sqlalchemy import func, select

from app.models import Discussion, FollowUp
from app.tests.helpers import create_lead, get_lead, in_, log_discussion


def _counts(db):
    return (
        db.scalar(select(func.count()).select_from(Discussion)),
        db.scalar(select(func.count()).select_from(FollowUp)),
    )


def test_discussions_are_returned_newest_first(client, clock):
    lead = create_lead(client)
    for note in ["first", "second", "third"]:
        log_discussion(client, lead["id"], note)
        clock.advance(minutes=5)
    notes = [d["note"] for d in client.get(f"/api/leads/{lead['id']}/discussions").json()]
    assert notes == ["third", "second", "first"]


def test_empty_timeline_is_an_empty_list(client):
    lead = create_lead(client)
    response = client.get(f"/api/leads/{lead['id']}/discussions")
    assert response.status_code == 200 and response.json() == []


def test_create_discussion_without_follow_up(client):
    lead = create_lead(client)
    response = log_discussion(client, lead["id"], "  Intro call went well.  ")
    assert response.status_code == 201
    body = response.json()
    assert body["discussion"]["note"] == "Intro call went well."
    assert body["discussion"]["follow_up"] is None
    # The response carries the refreshed lead so the list can update immediately.
    assert body["lead"]["last_discussion_note"] == "Intro call went well."
    assert body["lead"]["discussion_count"] == 1
    assert body["lead"]["next_follow_up_at"] is None


def test_create_discussion_with_follow_up_updates_lead(client, clock):
    lead = create_lead(client)
    when = in_(clock, days=1)
    body = log_discussion(client, lead["id"], "Sent pricing.", follow_up_at=when).json()
    follow_up = body["discussion"]["follow_up"]
    assert follow_up["status"] == "pending" and follow_up["state"] == "upcoming"
    assert follow_up["discussion_id"] == body["discussion"]["id"]
    assert body["lead"]["next_follow_up_id"] == follow_up["id"]
    assert body["lead"]["follow_up_state"] == "upcoming"
    assert get_lead(client, lead["id"])["pending_follow_ups"][0]["id"] == follow_up["id"]


def test_naive_follow_up_time_is_interpreted_in_app_timezone(client):
    lead = create_lead(client)
    # 2026-10-16 14:00 in Asia/Kolkata (UTC+05:30) == 08:30 UTC.
    body = log_discussion(client, lead["id"], "x", follow_up_at="2026-10-16T14:00").json()
    assert body["discussion"]["follow_up"]["scheduled_at"] == "2026-10-16T08:30:00Z"


def test_blank_note_is_rejected_and_nothing_is_stored(client, db):
    lead = create_lead(client)
    for note in ["", "   ", "\n\t"]:
        response = log_discussion(client, lead["id"], note, follow_up_at="2026-10-16T14:00")
        assert response.status_code == 422
        assert response.json()["error"]["details"]["fields"][0]["field"] == "note"
    assert _counts(db) == (0, 0)


def test_past_follow_up_is_rejected_atomically(client, clock, db):
    lead = create_lead(client)
    response = log_discussion(client, lead["id"], "x", follow_up_at=in_(clock, hours=-2))
    assert response.status_code == 422
    assert response.json()["error"]["details"]["fields"][0]["field"] == "follow_up_at"
    assert _counts(db) == (0, 0)


def test_discussion_and_follow_up_are_atomic_when_follow_up_creation_fails(
    client, monkeypatch, clock, db
):
    lead = create_lead(client)

    def boom(*args, **kwargs):
        raise RuntimeError("database exploded: secret-connection-string")

    monkeypatch.setattr("app.services.discussions.followups_service.add_follow_up", boom)
    response = log_discussion(
        client, lead["id"], "will be rolled back", follow_up_at=in_(clock, days=1)
    )
    assert response.status_code == 500
    error = response.json()["error"]
    assert error["code"] == "INTERNAL_ERROR"
    assert "secret" not in response.text and "RuntimeError" not in response.text
    assert _counts(db) == (0, 0)  # the discussion row was rolled back too
    assert get_lead(client, lead["id"])["discussion_count"] == 0


def test_multiple_follow_ups_coexist_and_are_never_overwritten(client, clock):
    lead = create_lead(client)
    later = log_discussion(client, lead["id"], "a", follow_up_at=in_(clock, days=5)).json()
    sooner = log_discussion(client, lead["id"], "b", follow_up_at=in_(clock, days=2)).json()
    detail = get_lead(client, lead["id"])
    assert detail["pending_follow_up_count"] == 2
    assert [f["id"] for f in detail["pending_follow_ups"]] == [
        sooner["discussion"]["follow_up"]["id"],
        later["discussion"]["follow_up"]["id"],
    ]
    assert detail["next_follow_up_id"] == sooner["discussion"]["follow_up"]["id"]


def test_timeline_lists_follow_up_metadata_per_discussion(client, clock):
    lead = create_lead(client)
    log_discussion(client, lead["id"], "no reminder")
    clock.advance(minutes=1)
    log_discussion(client, lead["id"], "with reminder", follow_up_at=in_(clock, days=1))
    timeline = client.get(f"/api/leads/{lead['id']}/discussions").json()
    assert timeline[0]["follow_up"]["status"] == "pending"
    assert timeline[1]["follow_up"] is None


def test_logging_a_discussion_can_explicitly_complete_pending_follow_ups(client, clock):
    lead = create_lead(client)
    first = log_discussion(client, lead["id"], "a", follow_up_at=in_(clock, minutes=5)).json()
    follow_up_id = first["discussion"]["follow_up"]["id"]
    clock.advance(hours=1)  # now overdue
    assert get_lead(client, lead["id"])["overdue_follow_up_count"] == 1

    body = log_discussion(
        client, lead["id"], "Called back", complete_follow_up_ids=[follow_up_id]
    ).json()
    assert body["lead"]["overdue_follow_up_count"] == 0
    assert body["lead"]["next_follow_up_at"] is None
    timeline = client.get(f"/api/leads/{lead['id']}/discussions").json()
    original = next(d for d in timeline if d["note"] == "a")
    assert original["follow_up"]["status"] == "completed"
    assert original["follow_up"]["completed_at"] is not None


def test_invalid_follow_up_ids_to_complete_roll_everything_back(client, clock, db):
    lead = create_lead(client)
    other = create_lead(client, "Other Lead")
    foreign = log_discussion(client, other["id"], "x", follow_up_at=in_(clock, days=1)).json()
    before = _counts(db)
    response = log_discussion(
        client,
        lead["id"],
        "should not persist",
        follow_up_at=in_(clock, days=2),
        complete_follow_up_ids=[foreign["discussion"]["follow_up"]["id"]],
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_FOLLOW_UP"
    assert _counts(db) == before


def test_note_longer_than_limit_is_rejected(client):
    lead = create_lead(client)
    assert log_discussion(client, lead["id"], "x" * 5001).status_code == 422
