import { CalendarClock, CircleCheck, CircleX, MessageSquareText } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Discussion, FollowUp } from "@/types";

function FollowUpNote({ followUp, timeZone, now }: { followUp: FollowUp; timeZone: string; now: Date }) {
  const when = formatDateTime(followUp.scheduled_at, timeZone, now);
  if (followUp.status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-accent-ink">
        <CircleCheck className="size-3.5" aria-hidden /> Follow-up for {when} completed
      </span>
    );
  }
  if (followUp.status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <CircleX className="size-3.5" aria-hidden /> Follow-up for {when} cancelled
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        followUp.state === "overdue" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-ink",
      )}
    >
      <CalendarClock className="size-3.5" aria-hidden />
      {followUp.state === "overdue" ? "Follow-up overdue since" : "Follow-up set for"} {when}
    </span>
  );
}

interface Props {
  discussions: Discussion[];
  timeZone: string;
  now: Date;
}

/** Newest first. The API orders the entries; this only renders them. */
export function Timeline({ discussions, timeZone, now }: Props) {
  if (discussions.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="No discussions yet"
        description="Log your first conversation below. Add a follow-up date so it shows up in your queue."
        className="py-8"
      />
    );
  }
  return (
    <ol aria-label="Discussion history, newest first" className="relative space-y-4">
      <span aria-hidden className="absolute top-2 bottom-2 left-[5px] w-px bg-line" />
      {discussions.map((d, index) => (
        <li key={d.id} className="relative pl-6" data-testid="timeline-entry">
          <span
            aria-hidden
            className={cn(
              "absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-surface",
              index === 0 ? "bg-accent" : "bg-line-strong",
            )}
          />
          <p className="text-xs text-muted">
            <time dateTime={d.created_at}>{formatDateTime(d.created_at, timeZone, now)}</time>
            <span className="ml-1.5">({timeAgo(d.created_at, now)})</span>
          </p>
          <div className="mt-1.5 rounded-lg border border-line bg-surface px-3.5 py-3">
            <p className="text-sm leading-6 break-words whitespace-pre-wrap text-ink">{d.note}</p>
            {d.follow_up && (
              <p className="mt-2">
                <FollowUpNote followUp={d.follow_up} timeZone={timeZone} now={now} />
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
