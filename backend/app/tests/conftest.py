import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

# Point the app at the TEST database before anything imports app settings.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://leadflow:leadflow@localhost:5432/leadflow_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["APP_TIMEZONE"] = "Asia/Kolkata"
os.environ["AI_PROVIDER"] = "demo"
os.environ["AI_API_KEY"] = ""
os.environ["CORS_ORIGINS"] = "http://localhost:3000"

import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from alembic import command  # noqa: E402
from app.api.deps import get_now  # noqa: E402
from app.db.session import get_session  # noqa: E402
from app.main import app  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Clock:
    """Frozen, controllable 'now'. Default: 2026-10-15 12:00 in Asia/Kolkata."""

    def __init__(self) -> None:
        self.now = datetime(2026, 10, 15, 6, 30, tzinfo=UTC)

    def advance(self, **kwargs) -> datetime:
        self.now += timedelta(**kwargs)
        return self.now


@pytest.fixture(scope="session")
def engine():
    # Never touch anything that is not clearly a test database.
    database = make_url(TEST_DATABASE_URL).database or ""
    assert database.endswith("_test"), f"Refusing to run tests against '{database}'"
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL.replace("%", "%%"))
    # Rebuild from migrations: also proves a clean database can be reproduced.
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    eng = create_engine(TEST_DATABASE_URL)
    yield eng
    eng.dispose()


@pytest.fixture(autouse=True)
def _clean_tables(engine):
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE follow_ups, discussions, leads RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def db(engine) -> Session:
    with sessionmaker(bind=engine, expire_on_commit=False)() as session:
        yield session


@pytest.fixture
def client(engine, clock):
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    def _session():
        with factory() as session:
            yield session

    app.dependency_overrides[get_session] = _session
    app.dependency_overrides[get_now] = lambda: clock.now
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()
