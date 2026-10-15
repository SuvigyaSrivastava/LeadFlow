import pytest

from app.core.enums import LeadStatus
from app.tests.helpers import create_lead, get_lead, in_, log_discussion, names


def test_create_lead_with_only_name_defaults_to_new(client):
    response = client.post("/api/leads", json={"name": "Grace Hopper"})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Grace Hopper"
    assert body["status"] == "New"
    assert body["company"] is None and body["phone"] is None
    assert body["discussion_count"] == 0
    assert body["next_follow_up_at"] is None


def test_create_lead_trims_inputs_and_blank_optionals_become_null(client):
    body = create_lead(client, "  Grace Hopper  ", company="   ", phone=" 555-0123 ")
    assert body["name"] == "Grace Hopper"
    assert body["company"] is None
    assert body["phone"] == "555-0123"


@pytest.mark.parametrize("name", ["", "   ", "\t\n"])
def test_create_lead_rejects_empty_or_whitespace_name(client, name):
    response = client.post("/api/leads", json={"name": name})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["details"]["fields"][0] == {"field": "name", "message": "Name is required"}
    assert client.get("/api/leads").json()["total"] == 0


def test_create_lead_missing_name_and_unknown_fields_are_422(client):
    assert client.post("/api/leads", json={}).status_code == 422
    assert client.post("/api/leads", json={"name": "A", "color": "red"}).status_code == 422


def test_create_lead_rejects_invalid_status_and_phone(client):
    bad_status = client.post("/api/leads", json={"name": "A", "status": "Maybe"})
    assert bad_status.status_code == 422
    assert bad_status.json()["error"]["details"]["fields"][0]["field"] == "status"
    bad_phone = client.post("/api/leads", json={"name": "A", "phone": "call me"})
    assert bad_phone.status_code == 422


def test_create_lead_accepts_explicit_status(client):
    assert create_lead(client, "A", status="Qualified")["status"] == "Qualified"


@pytest.mark.parametrize("status", [s.value for s in LeadStatus])
def test_filter_by_each_status(client, status):
    for s in LeadStatus:
        create_lead(client, f"Lead {s.value}", status=s.value)
    page = client.get("/api/leads", params={"status": status}).json()
    assert names(page) == [f"Lead {status}"]
    assert page["total"] == 1


def test_filter_rejects_unknown_status(client):
    assert client.get("/api/leads", params={"status": "Nope"}).status_code == 422


def test_search_by_name_and_company_is_case_insensitive(client):
    create_lead(client, "Priya Nair", company="Meridian Wealth")
    create_lead(client, "Daniel Okafor", company="Brightwater Capital")
    assert names(client.get("/api/leads", params={"q": "priya"}).json()) == ["Priya Nair"]
    assert names(client.get("/api/leads", params={"q": "BRIGHTWATER"}).json()) == ["Daniel Okafor"]
    assert client.get("/api/leads", params={"q": "zzz"}).json()["items"] == []


def test_search_and_status_filter_combine(client):
    create_lead(client, "Anna Lee", status="New")
    create_lead(client, "Anna Smith", status="Won")
    create_lead(client, "Bob Stone", status="Won")
    page = client.get("/api/leads", params={"q": "anna", "status": "Won"}).json()
    assert names(page) == ["Anna Smith"]


def test_search_treats_wildcards_literally(client):
    create_lead(client, "Anna Lee")
    assert client.get("/api/leads", params={"q": "%"}).json()["items"] == []
    assert client.get("/api/leads", params={"q": "_nna"}).json()["items"] == []


def test_patch_status_persists(client):
    lead = create_lead(client)
    response = client.patch(f"/api/leads/{lead['id']}", json={"status": "Proposal Sent"})
    assert response.status_code == 200
    assert response.json()["status"] == "Proposal Sent"
    assert get_lead(client, lead["id"])["status"] == "Proposal Sent"
    assert names(client.get("/api/leads", params={"status": "Proposal Sent"}).json()) == [
        "Ada Lovelace"
    ]


def test_patch_rejects_invalid_status_empty_body_and_blank_name(client):
    lead = create_lead(client)
    url = f"/api/leads/{lead['id']}"
    assert client.patch(url, json={"status": "Maybe"}).status_code == 422
    assert client.patch(url, json={}).status_code == 422
    assert client.patch(url, json={"name": "   "}).status_code == 422
    assert get_lead(client, lead["id"])["status"] == "New"


def test_patch_can_clear_optional_fields(client):
    lead = create_lead(client, company="Acme", phone="555-0123")
    body = client.patch(f"/api/leads/{lead['id']}", json={"company": None}).json()
    assert body["company"] is None and body["phone"] == "555-0123"


def test_unknown_lead_is_404_with_error_envelope(client):
    missing = "00000000-0000-0000-0000-000000000000"
    for method, url in [
        ("get", f"/api/leads/{missing}"),
        ("patch", f"/api/leads/{missing}"),
        ("get", f"/api/leads/{missing}/discussions"),
        ("post", f"/api/leads/{missing}/discussions"),
        ("post", f"/api/leads/{missing}/conversation-brief"),
    ]:
        payload = {"status": "Won"} if method == "patch" else {"note": "x"}
        kwargs = {} if method == "get" or url.endswith("conversation-brief") else {"json": payload}
        response = getattr(client, method)(url, **kwargs)
        assert response.status_code == 404, (method, url, response.text)
        error = response.json()["error"]
        assert error["code"] == "NOT_FOUND" and error["message"] == "Lead not found"


def test_malformed_lead_id_is_422(client):
    assert client.get("/api/leads/not-a-uuid").status_code == 422


def test_list_includes_last_note_count_and_times(client, clock):
    lead = create_lead(client)
    log_discussion(client, lead["id"], "First call")
    clock.advance(hours=2)
    log_discussion(client, lead["id"], "Second call")
    item = client.get("/api/leads").json()["items"][0]
    assert item["last_discussion_note"] == "Second call"
    assert item["discussion_count"] == 2
    assert item["last_discussion_at"].startswith("2026-10-15T08:30")


def test_list_order_overdue_then_today_then_recent_activity(client, clock):
    quiet_old = create_lead(client, "Quiet Old")
    log_discussion(client, quiet_old["id"], "Ancient note")
    clock.advance(days=1)
    recent = create_lead(client, "Recent Activity")
    log_discussion(client, recent["id"], "Fresh note")
    overdue_old = create_lead(client, "Overdue Oldest")
    overdue_new = create_lead(client, "Overdue Newer")
    today_late = create_lead(client, "Today Late")
    today_early = create_lead(client, "Today Early")
    upcoming = create_lead(client, "Upcoming Tomorrow")

    # Schedule while the clock is earlier, then jump forward so some become overdue.
    log_discussion(client, overdue_old["id"], "x", follow_up_at=in_(clock, hours=1))
    log_discussion(client, overdue_new["id"], "x", follow_up_at=in_(clock, hours=2))
    log_discussion(client, today_late["id"], "x", follow_up_at=in_(clock, hours=9))
    log_discussion(client, today_early["id"], "x", follow_up_at=in_(clock, hours=5))
    log_discussion(client, upcoming["id"], "x", follow_up_at=in_(clock, days=1, hours=5))
    clock.advance(hours=3)  # the first two reminders are now overdue; the rest are due today

    page = client.get("/api/leads").json()
    order = names(page)
    assert order[:2] == ["Overdue Oldest", "Overdue Newer"]
    assert order[2:4] == ["Today Early", "Today Late"]
    states = {i["name"]: i["follow_up_state"] for i in page["items"]}
    assert states["Overdue Oldest"] == "overdue"
    assert states["Today Early"] == "today"
    assert states["Upcoming Tomorrow"] == "upcoming"
    assert states["Quiet Old"] is None
    # Remaining leads: most recent activity first.
    assert order.index("Recent Activity") < order.index("Quiet Old")


def test_multiple_pending_follow_ups_do_not_duplicate_the_lead(client, clock):
    lead = create_lead(client)
    log_discussion(client, lead["id"], "a", follow_up_at=in_(clock, days=3))
    log_discussion(client, lead["id"], "b", follow_up_at=in_(clock, days=1))
    page = client.get("/api/leads").json()
    assert page["total"] == 1 and len(page["items"]) == 1
    item = page["items"][0]
    assert item["pending_follow_up_count"] == 2
    assert item["next_follow_up_at"].startswith("2026-10-16")  # the earliest one


def test_pagination(client):
    for i in range(5):
        create_lead(client, f"Lead {i}")
    first = client.get("/api/leads", params={"limit": 2, "offset": 0}).json()
    second = client.get("/api/leads", params={"limit": 2, "offset": 2}).json()
    assert first["total"] == 5 and len(first["items"]) == 2 and len(second["items"]) == 2
    assert not set(names(first)) & set(names(second))
    assert client.get("/api/leads", params={"limit": 0}).status_code == 422
    assert client.get("/api/leads", params={"limit": 201}).status_code == 422


def test_overview_counts(client, clock):
    create_lead(client, "New one")
    create_lead(client, "Won one", status="Won")
    create_lead(client, "Lost one", status="Lost")
    due = create_lead(client, "Due")
    late = create_lead(client, "Late")
    log_discussion(client, late["id"], "x", follow_up_at=in_(clock, minutes=5))
    log_discussion(client, due["id"], "x", follow_up_at=in_(clock, hours=4))
    clock.advance(minutes=10)
    overview = client.get("/api/leads/overview").json()
    assert overview["overdue"] == 1
    assert overview["due_today"] == 1
    assert overview["total_leads"] == 5
    assert overview["active_leads"] == 3  # everything except Won and Lost
    assert overview["status_counts"]["Won"] == 1
