"use client";

import { Building2, CircleAlert, Phone, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { PendingFollowUps } from "@/components/timeline/pending-follow-ups";
import { StatusSelect } from "@/components/leads/status-select";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DialogClose, DialogTitle, Sheet } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationBriefCard } from "@/components/timeline/conversation-brief";
import { DiscussionComposer } from "@/components/timeline/discussion-composer";
import { RelationshipSummary } from "@/components/timeline/relationship-summary";
import { Timeline } from "@/components/timeline/timeline";
import { useDiscussions, useLead, useNow, useUpdateLeadStatus } from "@/hooks/use-app-data";
import { notifyError, notifySuccess } from "@/lib/toast";
import type { LeadStatus } from "@/types";

interface Props {
  leadId: string | null;
  timeZone: string;
  onClose: () => void;
}

function PanelBody({ leadId, timeZone, onRequestClose, onDirtyChange }: {
  leadId: string;
  timeZone: string;
  onRequestClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const now = useNow();
  const lead = useLead(leadId);
  const discussions = useDiscussions(leadId);
  const updateStatus = useUpdateLeadStatus(leadId);
  const scroller = useRef<HTMLDivElement>(null);

  const dueFollowUps = (lead.data?.pending_follow_ups ?? []).filter(
    (f) => f.state === "overdue" || f.state === "today",
  );

  const changeStatus = (status: LeadStatus) =>
    updateStatus.mutate(status, {
      onSuccess: () => notifySuccess("Status updated", `Now ${status}`),
      onError: (error) => notifyError("Couldn't update the status", error),
    });

  const scrollToTop = useCallback(() => scroller.current?.scrollTo({ top: 0, behavior: "smooth" }), []);

  if (lead.isLoading) {
    return (
      <>
        <DialogTitle className="sr-only">Loading lead</DialogTitle>
        <div className="space-y-4 p-6" aria-busy>
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-16" />
          <Skeleton className="h-32" />
        </div>
      </>
    );
  }

  if (lead.error || !lead.data) {
    return (
      <>
        <DialogTitle className="sr-only">Lead unavailable</DialogTitle>
        <EmptyState
          tone="danger"
          icon={CircleAlert}
          title="Couldn't load this lead"
          description={lead.error?.message ?? "It may have been removed."}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onRequestClose}>
                Close
              </Button>
              <Button onClick={() => lead.refetch()}>Try again</Button>
            </div>
          }
        />
      </>
    );
  }

  const data = lead.data;
  const shownStatus = updateStatus.isPending && updateStatus.variables ? updateStatus.variables : data.status;

  return (
    <>
      <header className="flex flex-wrap items-start gap-x-3 gap-y-3 border-b border-line px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1 basis-3/5">
          <DialogTitle className="truncate text-lg font-semibold text-ink">{data.name}</DialogTitle>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {data.company && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5" aria-hidden />
                {data.company}
              </span>
            )}
            {data.phone && (
              <a href={`tel:${data.phone}`} className="inline-flex items-center gap-1.5 hover:text-ink hover:underline">
                <Phone className="size-3.5" aria-hidden />
                {data.phone}
              </a>
            )}
            {!data.company && !data.phone && <span>No company or phone on file</span>}
          </p>
        </div>
        <div className="order-last w-full sm:order-none sm:w-40 sm:shrink-0">
          <StatusSelect
            aria-label="Lead status"
            value={shownStatus}
            disabled={updateStatus.isPending}
            onChange={changeStatus}
            className="h-9"
          />
        </div>
        <DialogClose
          aria-label="Close lead"
          onClick={(event) => {
            event.preventDefault();
            onRequestClose();
          }}
          className="grid size-9 shrink-0 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </DialogClose>
      </header>

      <div ref={scroller} className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <RelationshipSummary lead={data} timeZone={timeZone} now={now} />
        <PendingFollowUps leadName={data.name} followUps={data.pending_follow_ups} timeZone={timeZone} now={now} />
        <ConversationBriefCard key={leadId} leadId={leadId} discussionCount={data.discussion_count} />
        <section aria-labelledby="timeline-heading">
          <h3 id="timeline-heading" className="mb-3 text-sm font-semibold text-ink">
            Discussion history
          </h3>
          {discussions.isLoading ? (
            <div className="space-y-3" aria-busy>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : discussions.error ? (
            <EmptyState
              tone="danger"
              icon={CircleAlert}
              title="Couldn't load the history"
              description={discussions.error.message}
              action={<Button onClick={() => discussions.refetch()}>Try again</Button>}
              className="py-6"
            />
          ) : (
            <Timeline discussions={discussions.data ?? []} timeZone={timeZone} now={now} />
          )}
        </section>
      </div>

      <DiscussionComposer
        leadId={leadId}
        timeZone={timeZone}
        dueFollowUps={dueFollowUps}
        onSaved={scrollToTop}
        onDirtyChange={onDirtyChange}
      />
    </>
  );
}

export function LeadPanel({ leadId, timeZone, onClose }: Props) {
  const dirty = useRef(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const requestClose = useCallback(() => {
    if (dirty.current) setConfirmDiscard(true);
    else onClose();
  }, [onClose]);

  return (
    <>
      <Sheet
        open={leadId !== null}
        onOpenChange={(open) => !open && requestClose()}
        onEscapeKeyDown={(event) => {
          // Never throw away a half-written note on a stray Escape.
          if (dirty.current) {
            event.preventDefault();
            requestClose();
          }
        }}
      >
        {leadId && (
          <PanelBody
            key={leadId}
            leadId={leadId}
            timeZone={timeZone}
            onRequestClose={requestClose}
            onDirtyChange={(value) => {
              dirty.current = value;
            }}
          />
        )}
      </Sheet>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this note?"
        description="You have an unsaved discussion. Closing the panel will lose it."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          dirty.current = false;
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}
