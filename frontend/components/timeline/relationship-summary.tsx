import { FollowUpChip } from "@/components/followups/follow-up-chip";
import { formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Attention, LeadDetail } from "@/types";

const ATTENTION: Record<Attention, { label: string; tone: string }> = {
  follow_up_overdue: { label: "Follow-up overdue", tone: "bg-danger-soft text-danger" },
  follow_up_scheduled: { label: "Follow-up scheduled", tone: "bg-accent-soft text-accent-ink" },
  no_recent_activity: { label: "No recent activity", tone: "bg-warn-soft text-warn" },
  recently_contacted: { label: "Recently contacted", tone: "bg-accent-soft text-accent-ink" },
};

interface Props {
  lead: LeadDetail;
  timeZone: string;
  now: Date;
}

export function RelationshipSummary({ lead, timeZone, now }: Props) {
  const attention = lead.attention ? ATTENTION[lead.attention] : null;
  const label =
    lead.attention === "no_recent_activity" && lead.discussion_count === 0
      ? "No activity yet"
      : attention?.label;

  return (
    <section aria-label="Relationship summary" className="space-y-3">
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
        <div className="bg-surface px-3 py-2.5">
          <dt className="text-xs text-muted">Discussions</dt>
          <dd className="mt-0.5 text-sm font-semibold text-ink tabular-nums" data-testid="discussion-count">
            {lead.discussion_count}
          </dd>
        </div>
        <div className="bg-surface px-3 py-2.5">
          <dt className="text-xs text-muted">Last interaction</dt>
          <dd className="mt-0.5 text-sm font-semibold text-ink">
            {lead.last_discussion_at ? timeAgo(lead.last_discussion_at, now) : "None yet"}
          </dd>
        </div>
        <div className="bg-surface px-3 py-2.5">
          <dt className="text-xs text-muted">Next follow-up</dt>
          <dd className="mt-0.5 text-sm font-semibold text-ink">
            {lead.next_follow_up_at && lead.follow_up_state ? (
              <span title={formatDateTime(lead.next_follow_up_at, timeZone, now)}>
                {formatDateTime(lead.next_follow_up_at, timeZone, now)}
              </span>
            ) : (
              <span className="font-normal text-muted">Not scheduled</span>
            )}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        {attention && (
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", attention.tone)}>{label}</span>
        )}
        {lead.overdue_follow_up_count > 0 && (
          <span className="text-xs text-danger">
            {lead.overdue_follow_up_count} overdue {lead.overdue_follow_up_count === 1 ? "reminder" : "reminders"}
          </span>
        )}
        {lead.next_follow_up_at && lead.follow_up_state && lead.pending_follow_up_count === 1 && (
          <FollowUpChip iso={lead.next_follow_up_at} state={lead.follow_up_state} timeZone={timeZone} now={now} />
        )}
      </div>
    </section>
  );
}
