# LeadFlow

A lightweight lead workspace for sales reps and financial advisors: track leads, log every discussion, and never miss a promised follow-up. Built for the PravarAI full-stack assessment with **Next.js + FastAPI + PostgreSQL**.

![Lead list with the follow-up queue](screenshots/01-lead-list.png)

A short walkthrough video is in [`screenshots/demo.webm`](screenshots/demo.webm).

## Features

**Required**
- Lead list with name, company, status badge, last discussion note and time since the last discussion.
- Filter by status (New, Contacted, Qualified, Proposal Sent, Won, Lost), and search by name or company. Search and filter work together.
- Today's follow-ups pinned above the list. Overdue follow-ups are highlighted in red and come first.
- Lead timeline in a dialog (a right-hand panel on desktop, full screen on phones), not a new page. Discussions are newest first, with a form at the bottom for a note and an optional follow-up date and time.
- Saving a discussion with a follow-up updates the lead and the list immediately. The status can be changed in the dialog and persists after a reload.
- Add lead: name required, company and phone optional, status defaults to New.

**Bonus**
- Search, overdue highlighting, status filters, seed script (7 leads, 13 discussions) and Docker Compose.
- Reschedule, complete or cancel follow-ups, from the queue or the lead dialog.
- **Prepare for next conversation**: an optional brief built only from the recorded notes (see [AI brief](#ai-conversation-brief)).
- Accessible dialogs (focus trap, Escape, focus returns to the opener), toasts, loading, empty and error states, responsive layout, reduced-motion support.

| Follow-up queue | Lead timeline |
| --- | --- |
| ![Queue](screenshots/02-follow-up-queue.png) | ![Timeline](screenshots/03-lead-timeline.png) |

| Add lead | Conversation brief | Mobile |
| --- | --- | --- |
| ![Add lead](screenshots/05-add-lead.png) | ![Brief](screenshots/04-conversation-brief.png) | ![Mobile](screenshots/07-mobile-timeline.png) |

## Tech stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, Radix Dialog, TanStack Query, react-hook-form + zod, Lucide icons.
- **Backend:** FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, PostgreSQL 16.
- **Tests:** pytest, Vitest + Testing Library, Playwright.

See [docs/architecture.md](docs/architecture.md) for design decisions and [docs/api.md](docs/api.md) for the API.

```
leadflow/
  backend/    FastAPI app (api/, services/, schemas/, models/, core/), alembic/, scripts/seed.py
  frontend/   Next.js app (app/, components/, hooks/, lib/, tests/, e2e/)
  docs/       architecture.md, api.md
  screenshots/
  docker-compose.yml, .env.example
```

## Setup without Docker

Prerequisites: Python 3.12+, Node.js 22+, PostgreSQL 16.

```bash
cp .env.example .env

# 1. Database (adjust the superuser to your machine)
psql -U postgres -c "CREATE USER leadflow WITH PASSWORD 'leadflow';"
psql -U postgres -c "CREATE DATABASE leadflow OWNER leadflow;"
psql -U postgres -c "CREATE DATABASE leadflow_test OWNER leadflow;"   # used by the tests only

# 2. Backend (http://localhost:8000, API docs at /docs)
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
alembic upgrade head                                   # create the schema
python -m scripts.seed                                 # demo data
uvicorn app.main:app --reload --port 8000

# 3. Frontend, in a second terminal (http://localhost:3000)
cd frontend
npm install
npm run dev
```

The seed script is safe to re-run. It replaces only its own demo leads, with timestamps relative to now, so "due today" and "overdue" are never stale. Leads you create yourself are left alone.

## Setup with Docker Compose

```bash
cp .env.example .env
docker compose up --build        # db, backend (runs migrations on start), frontend
docker compose exec backend python -m scripts.seed
```

Open http://localhost:3000. `NEXT_PUBLIC_API_URL` is baked into the frontend image at build time and must be reachable from your **browser**.

> **Verification status:** `docker-compose.yml` passes `docker compose config`, but the stack was **not started** while this was written (the authoring sandbox has no Docker daemon). The non-Docker setup above is what was run and tested. If compose misbehaves on your machine, please use the non-Docker steps.

## Environment variables

All are listed in [`.env.example`](.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `leadflow` | Database credentials (Docker Compose) |
| `DATABASE_URL` | `postgresql+psycopg://leadflow:leadflow@localhost:5432/leadflow` | Backend DB URL when running outside Docker |
| `APP_TIMEZONE` | `Asia/Kolkata` | Timezone for "due today" and "overdue" |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed browser origins |
| `LOG_LEVEL` | `INFO` | Backend log level |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | API base URL used by the browser |
| `AI_PROVIDER` | `demo` | `demo`, `anthropic`, `openai` or `none` |
| `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_TIMEOUT_SECONDS` | empty / `30` | Real-provider settings (optional) |

## Tests

```bash
# Backend: rebuilds leadflow_test from the migrations, then runs 82 tests
cd backend && pytest

# Frontend unit and integration tests (38)
cd frontend && npm test
npm run lint                      # TypeScript check

# End-to-end (needs the app running and seeded; first run: npx playwright install chromium)
cd frontend && npm run build && npm start      # in one terminal
cd frontend && npm run e2e                     # in another
```

Results from the final run while preparing this submission: backend 82 passed; frontend 38 passed; Playwright 3 passed (against a production build and a seeded database); `tsc --noEmit` and `ruff check` clean.

The tests refuse to run against any database whose name does not end in `_test`.

## AI Conversation Brief

"Prepare for next conversation" in the lead dialog summarises the recorded notes, lists interests and open items found in them, suggests questions and drafts a follow-up message. It never invents facts, never gives financial advice and never sends anything.

- `AI_PROVIDER=demo` (default): deterministic rules over your notes. It is labelled **Demo mode** and no model is called, so the project runs with no API key.
- `AI_PROVIDER=anthropic` or `openai` plus `AI_API_KEY`: a real model call from the backend (the key never reaches the browser). The UI tells the user that the notes are sent to the provider.
- Not configured, or the provider fails: a clear error, never a made-up brief.

The real-provider path is covered by tests with a mocked HTTP transport (request shape, parsing, failures). **It has not been run against a live provider**, because no API key was available.

## Assumptions and limitations

- No authentication. The assessment marks login optional. Authentication, authorization and tenant isolation would be required before storing real customer data. Seed data is fictional.
- Follow-ups are in-app reminders only: no email, push or calendar integration.
- Search is a case-insensitive substring match on name and company. At larger scale it would need a trigram index.
- The lead list loads 100 leads at a time ("Show more" loads more).
- Dates use the browser's native date and time pickers, so their look varies by browser.
- A follow-up date without a time defaults to 9:00 in `APP_TIMEZONE`.
- Not built: deleting leads or discussions, editing discussions, activity log, pagination of the timeline.

## AI usage disclosure

This project was built with AI assistance. The code, tests, docs and screenshots were produced by Claude (Anthropic) working in an agentic coding environment from a detailed specification, and then run and verified as described under [Tests](#tests). The submitting candidate should review the code and edit this section so it accurately reflects their own involvement.
