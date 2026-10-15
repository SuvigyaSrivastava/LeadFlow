from datetime import UTC, datetime

from app.core.enums import FollowUpState
from app.core.timeutils import classify_follow_up, local_day_bounds_utc, to_utc

NOW = datetime(2026, 10, 15, 6, 30, tzinfo=UTC)  # 12:00 in Asia/Kolkata


def test_naive_datetimes_are_read_in_the_app_timezone():
    assert to_utc(datetime(2026, 10, 16, 14, 0)) == datetime(2026, 10, 16, 8, 30, tzinfo=UTC)


def test_aware_datetimes_are_converted_not_reinterpreted():
    assert to_utc(datetime(2026, 10, 16, 14, 0, tzinfo=UTC)) == datetime(
        2026, 10, 16, 14, 0, tzinfo=UTC
    )


def test_day_bounds_follow_the_local_calendar_day():
    start, end = local_day_bounds_utc(NOW)
    assert start == datetime(2026, 10, 14, 18, 30, tzinfo=UTC)  # 00:00 IST
    assert end == datetime(2026, 10, 15, 18, 30, tzinfo=UTC)  # 00:00 IST next day


def test_day_bounds_roll_over_at_local_midnight_not_utc_midnight():
    # 00:30 IST on Oct 16 is still Oct 15 in UTC.
    start, _ = local_day_bounds_utc(datetime(2026, 10, 15, 19, 0, tzinfo=UTC))
    assert start == datetime(2026, 10, 15, 18, 30, tzinfo=UTC)


def test_classification():
    assert (
        classify_follow_up(datetime(2026, 10, 15, 6, 29, tzinfo=UTC), NOW) == FollowUpState.OVERDUE
    )
    assert classify_follow_up(NOW, NOW) == FollowUpState.TODAY  # not earlier than now
    assert (
        classify_follow_up(datetime(2026, 10, 15, 18, 29, tzinfo=UTC), NOW) == FollowUpState.TODAY
    )
    assert (
        classify_follow_up(datetime(2026, 10, 15, 18, 30, tzinfo=UTC), NOW)
        == FollowUpState.UPCOMING
    )
