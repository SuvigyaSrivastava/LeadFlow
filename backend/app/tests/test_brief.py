import json

import httpx
import pytest

from app.api.routes import discussions as discussions_routes  # noqa: F401
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.main import app
from app.services.conversation_brief import generate_brief, parse_model_json
from app.tests.helpers import create_lead, in_, log_discussion

NOTES = [
    "Discovery call. They need a CRM for 50 reps. Pain points include dropped leads.",
    "Sent pricing PDF. She said she would review it with her boss. Asked about data import?",
]


def _lead_with_notes(client, clock):
    lead = create_lead(client, "Sarah Connor", company="Acme Corp", status="Proposal Sent")
    for note in NOTES:
        log_discussion(client, lead["id"], note)
        clock.advance(days=1)
    log_discussion(client, lead["id"], "Waiting on reply.", follow_up_at=in_(clock, days=2))
    return lead


def _settings(**overrides) -> Settings:
    base = dict(database_url="postgresql+psycopg://x/x_test", ai_provider="demo", ai_api_key="")
    return Settings(_env_file=None, **{**base, **overrides})


def test_demo_brief_is_grounded_and_clearly_labelled(client, clock):
    lead = _lead_with_notes(client, clock)
    response = client.post(f"/api/leads/{lead['id']}/conversation-brief")
    assert response.status_code == 200
    brief = response.json()
    assert brief["mode"] == "demo" and brief["provider"] == "demo" and brief["model"] is None
    assert "No AI model was called" in brief["notice"]
    assert brief["discussion_count"] == 3
    assert "Proposal Sent" in brief["summary"]
    assert "Waiting on reply." in brief["summary"]
    # Every recorded interest/open item is taken verbatim from the notes (or the schedule).
    corpus = " ".join(NOTES + ["Waiting on reply."])
    for item in brief["recorded_interests"]:
        assert item.rstrip("…") in corpus
    assert any("CRM for 50 reps" in i for i in brief["recorded_interests"])
    assert any("review it with her boss" in i for i in brief["open_items"])
    assert brief["suggested_questions"] and brief["draft_message"].startswith("Hi Sarah")
    assert "[Your name]" in brief["draft_message"]


def test_brief_requires_discussions(client):
    lead = create_lead(client)
    response = client.post(f"/api/leads/{lead['id']}/conversation-brief")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "NO_DISCUSSIONS"


@pytest.mark.parametrize(
    "overrides",
    [dict(ai_provider="none"), dict(ai_provider="anthropic"), dict(ai_provider="openai")],
)
def test_brief_is_unavailable_without_provider_or_key(client, clock, overrides):
    lead = _lead_with_notes(client, clock)
    app.dependency_overrides[get_settings] = lambda: _settings(**overrides)
    response = client.post(f"/api/leads/{lead['id']}/conversation-brief")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AI_UNAVAILABLE"
    assert client.get("/api/config").json()["ai_mode"] == "unavailable"


def _anthropic_payload(text: str) -> dict:
    return {"content": [{"type": "text", "text": text}]}


GOOD = {
    "summary": "Two calls so far.",
    "recorded_interests": ["CRM for 50 reps"],
    "open_items": ["Review pricing with her boss"],
    "suggested_questions": ["Any update from her boss?"],
    "draft_message": "Hi Sarah,\n\nChecking in.\n\n[Your name]",
}


def _call(db, lead_id, clock, handler, **settings):
    seen = {}

    def wrapped(request: httpx.Request) -> httpx.Response:
        seen["request"] = request
        return handler(request)

    factory = lambda: httpx.Client(transport=httpx.MockTransport(wrapped))  # noqa: E731
    cfg = _settings(ai_provider="anthropic", ai_api_key="test-key", **settings)
    return generate_brief(db, lead_id, cfg, clock.now, factory), seen


def test_llm_brief_success_sends_notes_and_returns_parsed_content(client, clock, db):
    lead = _lead_with_notes(client, clock)
    brief, seen = _call(
        db,
        lead["id"],
        clock,
        lambda r: httpx.Response(200, json=_anthropic_payload(json.dumps(GOOD))),
    )
    assert brief.mode == "llm" and brief.provider == "anthropic"
    assert brief.summary == "Two calls so far." and brief.discussion_count == 3
    assert "AI model" in brief.notice

    request = seen["request"]
    assert request.headers["x-api-key"] == "test-key"
    body = json.loads(request.content)
    assert "Never invent" in body["system"]
    user_prompt = body["messages"][0]["content"]
    assert "<notes>" in user_prompt and "CRM for 50 reps" in user_prompt
    assert "Sarah Connor" in user_prompt


def test_llm_brief_accepts_fenced_json(client, clock, db):
    lead = _lead_with_notes(client, clock)
    fenced = "```json\n" + json.dumps(GOOD) + "\n```"
    brief, _ = _call(
        db, lead["id"], clock, lambda r: httpx.Response(200, json=_anthropic_payload(fenced))
    )
    assert brief.open_items == ["Review pricing with her boss"]


def test_llm_failure_is_an_error_never_a_made_up_brief(client, clock, db):
    lead = _lead_with_notes(client, clock)
    with pytest.raises(AppError) as exc:
        _call(db, lead["id"], clock, lambda r: httpx.Response(500, json={"error": "boom"}))
    assert exc.value.status_code == 502 and exc.value.code == "AI_UPSTREAM_ERROR"

    def network_down(request):
        raise httpx.ConnectError("no route")

    with pytest.raises(AppError) as exc:
        _call(db, lead["id"], clock, network_down)
    assert exc.value.code == "AI_UPSTREAM_ERROR"


def test_llm_garbage_output_is_rejected(client, clock, db):
    lead = _lead_with_notes(client, clock)
    for text in ["I cannot help with that", json.dumps({"summary": "only this"})]:
        with pytest.raises(AppError) as exc:
            _call(
                db,
                lead["id"],
                clock,
                lambda r, t=text: httpx.Response(200, json=_anthropic_payload(t)),
            )
        assert exc.value.code == "AI_BAD_RESPONSE" and exc.value.status_code == 502


def test_openai_compatible_provider(client, clock, db):
    lead = _lead_with_notes(client, clock)
    handler = lambda r: httpx.Response(  # noqa: E731
        200, json={"choices": [{"message": {"content": json.dumps(GOOD)}}]}
    )
    cfg = _settings(ai_provider="openai", ai_api_key="k", ai_base_url="https://gateway.test/v1")
    seen = {}

    def wrapped(request):
        seen["url"] = str(request.url)
        return handler(request)

    brief = generate_brief(
        db, lead["id"], cfg, clock.now, lambda: httpx.Client(transport=httpx.MockTransport(wrapped))
    )
    assert brief.provider == "openai" and seen["url"] == "https://gateway.test/v1/chat/completions"


def test_parse_model_json_rejects_non_objects():
    with pytest.raises(ValueError):
        parse_model_json("[]")
