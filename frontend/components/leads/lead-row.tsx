import { ChevronRight } from "lucide-react";
import type { Ref } from "react";

import { FollowUpChip } from "@/components/followups/follow-up-chip";
import { StatusBadge } from "@/components/leads/status-badge";
import { timeAgo } from "@/lib/format";
import { cn, initials } from "@/lib/utils";
import type { Lead } from "@/types";

interface LeadRowProps {
  lead: Lead;
  timeZone: string;
  now: Date;
  onOpen: (lead: Lead) => void;
  ref?: Ref<HTMLButtonElement>;
}

export function LeadRow({ lead, timeZone, now, onOpen, ref }: LeadRowProps) {
  const closed = lead.status === "Won" || lead.status === "Lost";
  const extra = lead.pending_follow_up_count - 1;

  return (
    <li>
      <button
        ref={ref}
        type="button"
        onClick={() => onOpen(lead)}
        aria-label={`Open ${lead.name}${lead.company ? `, ${lead.company}` : ""}`}
        className={cn(
          "group relative flex w-full items-start gap-3 border-l-[3px] border-transparent px-4 py-3.5 text-left transition-colors hover:bg-canvas/70 sm:items-center sm:gap-4",
          lead.follow_up_state === "overdue" && "border-l-danger",
          lead.follow_up_state === "today" && "border-l-warn-line",
          closed && "opacity-80",
        )}
      >
        <span
          aria-hidden
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink sm:mt-0"
        >
          {initials(lead.name)}
        </span>

        <span className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-6">
          <span className="min-w-0">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-[15px] font-semibold text-ink">{lead.name}</span>
              {lead.company && <span className="truncate text-sm text-muted">{lead.company}</span>}
            </span>
            <span className="mt-0.5 flex items-baseline gap-2 text-sm">
              {lead.last_discussion_note ? (
                <>
                  <span className="sr-only">Last note:</span>
                  <span className="truncate text-soft">{lead.last_discussion_note}</span>
                  {lead.last_discussion_at && (
                    <span className="shrink-0 text-xs text-muted">
                      {timeAgo(lead.last_discussion_at, now)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="truncate text-muted italic">No discussions yet</span>
                  <span className="shrink-0 text-xs text-muted">
                    Added {timeAgo(lead.created_at, now)}
                  </span>
                </>
              )}
            </span>
          </span>

          <span className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
            <StatusBadge status={lead.status} />
            {lead.next_follow_up_at && lead.follow_up_state && (
              <span className="flex items-center gap-1.5">
                <FollowUpChip
                  iso={lead.next_follow_up_at}
                  state={lead.follow_up_state}
                  timeZone={timeZone}
                  now={now}
                />
                {extra > 0 && <span className="text-xs text-muted">+{extra} more</span>}
              </span>
            )}
          </span>
        </span>

        <ChevronRight
          className="mt-2 size-4 shrink-0 text-line-strong transition-transform group-hover:translate-x-0.5 group-hover:text-muted sm:mt-0"
          aria-hidden
        />
      </button>
    </li>
  );
}
