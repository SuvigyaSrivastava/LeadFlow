"use client";

import { AlarmClock, CalendarClock, Check, CircleAlert, PartyPopper } from "lucide-react";
import { useMemo, useState } from "react";

import { RescheduleDialog, type RescheduleTarget } from "@/components/followups/reschedule-dialog";
import { StatusBadge } from "@/components/leads/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCloseFollowUp, useFollowUps } from "@/hooks/use-app-data";
import { durationLabel, formatDay, formatTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { FollowUpWithLead, LeadStatus } from "@/types";

interface QueueProps {
  query: string;
  status: LeadStatus | "All";
  timeZone: string;
  now: Date;
  onOpenLead: (leadId: string) => void;
}

type Tab = "attention" | "upcoming";

const RAIL = {
  overdue: "border-l-danger bg-danger-soft/50",
  today: "border-l-warn-line bg-warn-soft/60",
  upcoming: "border-l-line-strong",
} as const;

function QueueRow({
  item,
  timeZone,
  now,
  busy,
  onOpen,
  onReschedule,
  onComplete,
}: {
  item: FollowUpWithLead;
  timeZone: string;
  now: Date;
  busy: boolean;
  onOpen: () => void;
  onReschedule: () => void;
  onComplete: () => void;
}) {
  const state = item.state ?? "upcoming";
  const overdueFor = durationLabel(now.getTime() - new Date(item.scheduled_at).getTime());
  return (
    <li
      data-testid="queue-row"
      data-state={state}
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-2 border-l-[3px] py-2.5 pr-3 pl-1 sm:flex-nowrap", RAIL[state])}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${item.lead.name}`}
        className="flex w-full min-w-0 items-center gap-4 rounded-md px-3 py-1 text-left hover:bg-surface/70 sm:w-auto sm:flex-1"
      >
        <span className="w-24 shrink-0 sm:w-36">
          <span className="block text-sm font-semibold text-ink tabular-nums">
            {state === "today" ? formatTime(item.scheduled_at, timeZone) : formatDay(item.scheduled_at, timeZone, now)}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              state === "overdue" && "text-danger",
              state === "today" && "text-warn",
              state === "upcoming" && "text-muted",
            )}
          >
            {state === "overdue" && (
              <>
                <AlarmClock className="size-3.5" aria-hidden /> Overdue {overdueFor}
              </>
            )}
            {state === "today" && "Due today"}
            {state === "upcoming" && formatTime(item.scheduled_at, timeZone)}
          </span>
        </span>
        <span className="min-w-0">
          <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
            <span className="truncate text-sm font-semibold text-ink">{item.lead.name}</span>
            {item.lead.company && <span className="truncate text-sm text-muted">{item.lead.company}</span>}
          </span>
          <StatusBadge status={item.lead.status} className="mt-1" />
        </span>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-3 sm:pl-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReschedule}
          disabled={busy}
          aria-label={`Reschedule follow-up with ${item.lead.name}`}
        >
          <CalendarClock className="size-4" aria-hidden />
          <span className="hidden sm:inline">Reschedule</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onComplete}
          loading={busy}
          aria-label={`Mark follow-up with ${item.lead.name} as done`}
        >
          {!busy && <Check className="size-4 text-accent" aria-hidden />}
          Done
        </Button>
      </div>
    </li>
  );
}

export function FollowUpQueue({ query, status, timeZone, now, onOpenLead }: QueueProps) {
  const [tab, setTab] = useState<Tab>("attention");
  const [target, setTarget] = useState<RescheduleTarget | null>(null);
  const attention = useFollowUps("attention");
  const upcoming = useFollowUps("upcoming");
  const close = useCloseFollowUp();

  const needle = query.trim().toLowerCase();
  const matches = (item: FollowUpWithLead) =>
    (status === "All" || item.lead.status === status) &&
    (!needle ||
      item.lead.name.toLowerCase().includes(needle) ||
      (item.lead.company ?? "").toLowerCase().includes(needle));

  const attentionItems = useMemo(() => (attention.data ?? []).filter(matches), [attention.data, needle, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const upcomingItems = useMemo(() => (upcoming.data ?? []).filter(matches), [upcoming.data, needle, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = tab === "attention" ? attention : upcoming;
  const items = tab === "attention" ? attentionItems : upcomingItems;
  const filtered = status !== "All" || needle.length > 0;
  const overdueCount = attentionItems.filter((i) => i.state === "overdue").length;

  const complete = (item: FollowUpWithLead) =>
    close.mutate(
      { id: item.id, status: "completed" },
      {
        onSuccess: () => notifySuccess("Follow-up marked done", item.lead.name),
        onError: (error) => notifyError("Couldn't update follow-up", error),
      },
    );

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "attention", label: "Needs attention", count: attentionItems.length },
    { id: "upcoming", label: "Upcoming", count: upcomingItems.length },
  ];

  return (
    <section aria-labelledby="queue-heading" className="overflow-hidden rounded-lg border border-line bg-surface shadow-raised">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 pt-3">
        <h2 id="queue-heading" className="pb-2 text-sm font-semibold text-ink">
          Follow-ups
          {overdueCount > 0 && (
            <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
              {overdueCount} overdue
            </span>
          )}
        </h2>
        <div role="tablist" aria-label="Follow-up queue" className="-mb-px flex gap-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`queue-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="queue-panel"
              onClick={() => setTab(t.id)}
              className={cn(
                "border-b-2 pb-2 text-[13px] font-medium transition-colors",
                tab === t.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.label} <span className="tabular-nums text-muted">{t.count}</span>
            </button>
          ))}
        </div>
      </header>

      <div id="queue-panel" role="tabpanel" aria-labelledby={`queue-tab-${tab}`}>
        {active.isLoading ? (
          <div className="space-y-3 p-4" aria-busy>
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : active.error && !active.data ? (
          <div className="flex items-center gap-3 px-4 py-4 text-sm text-danger">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{active.error.message}</span>
            <Button variant="secondary" size="sm" onClick={() => active.refetch()}>
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-5 text-sm text-muted">
            <PartyPopper className="size-4 text-accent" aria-hidden />
            {filtered
              ? "No follow-ups match these filters."
              : tab === "attention"
                ? "You're all caught up. Nothing is due today."
                : "No upcoming follow-ups scheduled."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                timeZone={timeZone}
                now={now}
                busy={close.isPending && close.variables?.id === item.id}
                onOpen={() => onOpenLead(item.lead_id)}
                onReschedule={() => setTarget({ id: item.id, leadName: item.lead.name })}
                onComplete={() => complete(item)}
              />
            ))}
          </ul>
        )}
      </div>

      <RescheduleDialog target={target} timeZone={timeZone} onOpenChange={(open) => !open && setTarget(null)} />
    </section>
  );
}
