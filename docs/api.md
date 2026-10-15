# API reference

Base URL `http://localhost:8000`. Interactive docs: `/docs` (Swagger UI) and `/openapi.json`.

## Error envelope

Every error uses the same shape. Stack traces, SQL and secrets are never returned.

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Name is required",
             "details": { "fields": [ { "field": "name", "message": "Name is required" } ] } } }
```

| Status | When | Example `code` |
| --- | --- | --- |
| 200 | Read or update succeeded | |
| 201 | Lead or discussion created | |
| 400 | Valid request that the business rules reject | `NO_DISCUSSIONS`, `INVALID_FOLLOW_UP` |
| 404 | Lead or follow-up does not exist, or unknown route | `NOT_FOUND` |
| 405 | Wrong HTTP method | `METHOD_NOT_ALLOWED` |
| 409 | State conflict (follow-up already completed or cancelled) | `FOLLOW_UP_NOT_PENDING` |
| 422 | Request validation failed (bad body, query, UUID, past follow-up) | `VALIDATION_ERROR` |
| 502 | AI provider failed or returned unusable output | `AI_UPSTREAM_ERROR`, `AI_BAD_RESPONSE` |
| 503 | AI brief not configured | `AI_UNAVAILABLE` |
| 500 | Unexpected server error | `INTERNAL_ERROR` |

## Endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /health`, `GET /api/health` | Liveness plus a database check |
| `GET /api/config` | `{timezone, ai_mode, ai_provider}` for the UI |
| `GET /api/leads` | List leads. Query: `q` (name or company), `status`, `limit` (1-200, default 100), `offset`. Returns `{items, total, limit, offset}`. |
| `GET /api/leads/overview` | `{due_today, overdue, active_leads, total_leads, status_counts}`. Active means not Won or Lost. Counts are pending reminders. |
| `POST /api/leads` | Create. Body: `name` (required), `company`, `phone`, `status` (default `New`). Returns 201. |
| `GET /api/leads/{id}` | Lead detail with pending follow-ups and the rule-based `attention` indicator |
| `PATCH /api/leads/{id}` | Update `status`, `name`, `company` or `phone` |
| `GET /api/leads/{id}/discussions` | Timeline, newest first, with each discussion's follow-up |
| `POST /api/leads/{id}/discussions` | Body: `note` (required), `follow_up_at` (optional), `complete_follow_up_ids` (optional). Returns `{discussion, lead}`. Atomic. |
| `GET /api/follow-ups` | Pending reminders with their lead, soonest first. `scope=attention` (overdue and due today, default), `upcoming`, or `pending`. Optional `lead_id`. |
| `PATCH /api/follow-ups/{id}` | Send either `scheduled_at` (reschedule) or `status` (`completed` or `cancelled`), never both |
| `POST /api/leads/{id}/conversation-brief` | Optional AI brief built from recorded notes |

Lead list items include `last_discussion_note`, `last_discussion_at`, `discussion_count`, `next_follow_up_id`, `next_follow_up_at`, `follow_up_state`, `pending_follow_up_count` and `overdue_follow_up_count`.

## Example

```bash
curl -X POST localhost:8000/api/leads -H 'content-type: application/json' \
  -d '{"name": "Grace Hopper", "company": "Navy Labs"}'

curl -X POST localhost:8000/api/leads/<id>/discussions -H 'content-type: application/json' \
  -d '{"note": "Intro call went well.", "follow_up_at": "2026-10-20T11:00"}'
```
