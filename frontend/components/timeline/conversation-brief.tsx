"use client";

import { Copy, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppConfig, useConversationBrief } from "@/hooks/use-app-data";
import { cn } from "@/lib/utils";
import type { ConversationBrief } from "@/types";

function Section({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        {title}
        {tag && <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] font-medium text-muted">{tag}</span>}
      </h4>
      {children}
    </section>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted italic">{empty}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-soft marker:text-line-strong">
      {items.map((item) => (
        <li key={item} className="break-words">
          {item}
        </li>
      ))}
    </ul>
  );
}

function BriefResult({ brief }: { brief: ConversationBrief }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(brief.draft_message);
      toast.success("Draft copied");
    } catch {
      toast.error("Couldn't copy", { description: "Select the text and copy it manually." });
    }
  };
  return (
    <div className="space-y-4" data-testid="brief-result">
      <p className="flex items-start gap-2 rounded-md bg-canvas px-3 py-2 text-xs text-muted">
        <span
          className={cn(
            "mt-px shrink-0 rounded px-1.5 py-0.5 font-medium",
            brief.mode === "demo" ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent-ink",
          )}
        >
          {brief.mode === "demo" ? "Demo mode" : "AI generated"}
        </span>
        {brief.notice}
      </p>
      <Section title="Relationship so far" tag="From your notes">
        <p className="text-sm leading-6 break-words text-soft">{brief.summary}</p>
      </Section>
      <Section title="Interests recorded" tag="From your notes">
        <BulletList items={brief.recorded_interests} empty="No interests or priorities are recorded in the notes." />
      </Section>
      <Section title="Open items" tag="From your notes">
        <BulletList items={brief.open_items} empty="No open commitments or questions are recorded." />
      </Section>
      <Section title="Questions to ask next" tag="Suggestion">
        <BulletList items={brief.suggested_questions} empty="No suggestions." />
      </Section>
      <Section title="Draft follow-up message" tag="Suggestion">
        <pre className="rounded-md border border-line bg-canvas/60 px-3 py-2.5 font-sans text-sm leading-6 break-words whitespace-pre-wrap text-soft">
          {brief.draft_message}
        </pre>
        <Button variant="secondary" size="sm" onClick={copy}>
          <Copy className="size-4" aria-hidden />
          Copy draft
        </Button>
        <p className="text-xs text-muted">LeadFlow never sends messages. Review and send it yourself.</p>
      </Section>
    </div>
  );
}

export function ConversationBriefCard({ leadId, discussionCount }: { leadId: string; discussionCount: number }) {
  const config = useAppConfig();
  const mutation = useConversationBrief(leadId);
  const unavailable = config.ai_mode === "unavailable";
  const noNotes = discussionCount === 0;

  const disclosure = unavailable
    ? "Not available. No AI provider is configured on the server. The rest of LeadFlow works normally."
    : config.ai_mode === "demo"
      ? "Demo mode: builds a brief from your notes with simple rules. No AI model is called and nothing leaves this server."
      : "Sends this lead's discussion notes to the configured AI provider to write the brief.";

  return (
    <section aria-labelledby="brief-heading" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h3 id="brief-heading" className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Sparkles className="size-4 text-accent" aria-hidden />
            Prepare for next conversation
          </h3>
          <p className="mt-0.5 text-xs text-muted">{disclosure}</p>
        </div>
        {mutation.data ? (
          <Button variant="secondary" size="sm" onClick={() => mutation.mutate()} loading={mutation.isPending}>
            {!mutation.isPending && <RefreshCw className="size-4" aria-hidden />}
            Regenerate
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={unavailable || noNotes}
            title={noNotes ? "Log a discussion first" : undefined}
          >
            {mutation.isPending ? "Preparing" : "Prepare brief"}
          </Button>
        )}
      </div>
      {noNotes && !unavailable && (
        <p className="border-t border-line px-4 py-3 text-sm text-muted">
          Log a discussion first. The brief is built only from what you have recorded.
        </p>
      )}
      {mutation.isPending && !mutation.data && (
        <div className="space-y-2 border-t border-line px-4 py-4" aria-busy aria-live="polite">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      )}
      {mutation.isError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-t border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
          <span>{mutation.error.message}</span>
          <Button variant="secondary" size="sm" onClick={() => mutation.mutate()}>
            Try again
          </Button>
        </div>
      )}
      {mutation.data && (
        <div className={cn("border-t border-line px-4 py-4", mutation.isPending && "opacity-60")}>
          <BriefResult brief={mutation.data} />
        </div>
      )}
    </section>
  );
}
