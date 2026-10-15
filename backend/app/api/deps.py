from datetime import datetime
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.timeutils import utcnow
from app.db.session import get_session

DbSession = Annotated[Session, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def get_now() -> datetime:
    """Current instant. A dependency so tests can freeze the clock."""
    return utcnow()


Now = Annotated[datetime, Depends(get_now)]
