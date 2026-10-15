"use client";

import { CalendarClock, Check, X } from "lucide-react";
import { useState } from "react";

import { FollowUpChip } from "@/components/followups/follow-up-chip";
import { RescheduleDialog, type RescheduleTarget } from "@/components/followups/reschedule-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCloseFollowUp } from "@/hooks/use-app-data";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/toast";
import type { FollowUp } from "@/types";

interface Props {
  leadName: string;
  followUps: FollowUp[];
  timeZone: string;
  now: Date;
}

export function PendingFollowUps({ leadName, followUps, timeZone, now }: Props) {
  const close = useCloseFollowUp();
  const [reschedule, setReschedule] = useState<RescheduleTarget | null>(null);
  const [cancelling, setCancelling] = useState<FollowUp | null>(null);

  if (followUps.length === 0) return null;

  const complete = (id: string) =>
    close.mutate(
      { id, status: "completed" },
      {
        onSuccess: () => notifySuccess("Follow-up marked done"),
        onError: (e) => notifyError("Couldn't update follow-up", e),
      },
    );

  return (
    <section aria-labelledby="pending-heading">
      <h3 id="pending-heading" className="mb-2 text-sm font-semibold text-ink">
        Pending follow-ups
      </h3>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
        {followUps.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 bg-surface px-3 py-2">
            {f.state && <FollowUpChip iso={f.scheduled_at} state={f.state} timeZone={timeZone} now={now} />}
            <span className="min-w-[7rem] flex-1 text-xs text-muted">
              {f.state === "overdue" ? `Was due ${formatDateTime(f.scheduled_at, timeZone, now)}` : ""}
            </span>
            <span className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReschedule({ id: f.id, leadName })}
              aria-label={`Reschedule follow-up for ${formatDateTime(f.scheduled_at, timeZone, now)}`}
            >
              <CalendarClock className="size-4" aria-hidden />
              Reschedule
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={close.isPending && close.variables?.id === f.id && close.variables.status === "completed"}
              onClick={() => complete(f.id)}
              aria-label={`Mark follow-up for ${formatDateTime(f.scheduled_at, timeZone, now)} as done`}
            >
              <Check className="size-4 text-accent" aria-hidden />
              Done
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCancelling(f)}
              aria-label={`Cancel follow-up for ${formatDateTime(f.scheduled_at, timeZone, now)}`}
            >
              <X className="size-4" aria-hidden />
            </Button>
            </span>
          </li>
        ))}
      </ul>

      <RescheduleDialog target={reschedule} timeZone={timeZone} onOpenChange={(o) => !o && setReschedule(null)} />
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Cancel this follow-up?"
        description={
          cancelling
            ? `The reminder for ${formatDateTime(cancelling.scheduled_at, timeZone, now)} will be cancelled. It stays in the timeline as cancelled.`
            : ""
        }
        confirmLabel="Cancel follow-up"
        cancelLabel="Keep follow-up"
        loading={close.isPending && close.variables?.status === "cancelled"}
        onConfirm={() => {
          if (!cancelling) return;
          close.mutate(
            { id: cancelling.id, status: "cancelled" },
            {
              onSuccess: () => {
                notifySuccess("Follow-up cancelled");
                setCancelling(null);
              },
              onError: (e) => notifyError("Couldn't cancel follow-up", e),
            },
          );
        }}
      />
    </section>
  );
}
