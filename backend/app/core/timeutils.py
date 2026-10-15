"""Single source of truth for time rules.

* Timestamps are stored and exchanged as timezone-aware UTC.
* "Which calendar day is it?" is always answered in the configured APP_TIMEZONE.
* A pending follow-up is OVERDUE when its instant is earlier than now.
* A pending follow-up is DUE TODAY when it is not overdue and falls on today's
  calendar date in APP_TIMEZONE. Anything later is UPCOMING.
"""

from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.core.enums import FollowUpState


def app_tz() -> ZoneInfo:
    return ZoneInfo(get_settings().app_timezone)


def utcnow() -> datetime:
    return datetime.now(UTC)


def to_utc(value: datetime) -> datetime:
    """Normalise to aware UTC. Naive values are interpreted in APP_TIMEZONE."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=app_tz())
    return value.astimezone(UTC)


def local_day_bounds_utc(now: datetime) -> tuple[datetime, datetime]:
    """[start, end) of the current local calendar day, expressed in UTC."""
    tz = app_tz()
    local_now = now.astimezone(tz)
    start_local = datetime.combine(local_now.date(), time.min, tzinfo=tz)
    end_local = datetime.combine(local_now.date() + timedelta(days=1), time.min, tzinfo=tz)
    return start_local.astimezone(UTC), end_local.astimezone(UTC)


def classify_follow_up(scheduled_at: datetime, now: datetime) -> FollowUpState:
    if scheduled_at < now:
        return FollowUpState.OVERDUE
    _, end_of_today = local_day_bounds_utc(now)
    if scheduled_at < end_of_today:
        return FollowUpState.TODAY
    return FollowUpState.UPCOMING
