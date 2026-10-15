from enum import StrEnum


class LeadStatus(StrEnum):
    NEW = "New"
    CONTACTED = "Contacted"
    QUALIFIED = "Qualified"
    PROPOSAL_SENT = "Proposal Sent"
    WON = "Won"
    LOST = "Lost"


CLOSED_STATUSES = (LeadStatus.WON, LeadStatus.LOST)


class FollowUpStatus(StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class FollowUpState(StrEnum):
    """Time classification of a *pending* follow-up, relative to 'now'."""

    OVERDUE = "overdue"
    TODAY = "today"
    UPCOMING = "upcoming"


class Attention(StrEnum):
    """Deterministic, rule-based operational indicator (not a prediction)."""

    FOLLOW_UP_OVERDUE = "follow_up_overdue"
    FOLLOW_UP_SCHEDULED = "follow_up_scheduled"
    NO_RECENT_ACTIVITY = "no_recent_activity"
    RECENTLY_CONTACTED = "recently_contacted"
