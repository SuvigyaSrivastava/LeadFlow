from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import AppSettings, DbSession
from app.schemas.brief import AppConfig
from app.services.conversation_brief import ai_mode

router = APIRouter(tags=["meta"])


@router.get("/health")
def health(db: DbSession) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


@router.get("/config", response_model=AppConfig)
def config(settings: AppSettings) -> AppConfig:
    return AppConfig(
        timezone=settings.app_timezone,
        ai_mode=ai_mode(settings),
        ai_provider=settings.ai_provider,
    )
