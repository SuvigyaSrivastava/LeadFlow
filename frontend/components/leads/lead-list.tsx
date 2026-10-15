"use client";

import { CircleAlert, SearchX, UserPlus } from "lucide-react";

import { LeadRow } from "@/components/leads/lead-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Lead, LeadPage } from "@/types";

interface LeadListProps {
  page?: LeadPage;
  isLoading: boolean;
  isRefreshing: boolean;
  error: ApiError | Error | null;
  filtersActive: boolean;
  timeZone: string;
  now: Date;
  onOpen: (lead: Lead) => void;
  onRetry: () => void;
  onClearFilters: () => void;
  onAddLead: () => void;
  onLoadMore: () => void;
}

function ListSkeleton() {
  return (
    <ul aria-label="Loading leads" aria-busy className="divide-y divide-line">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-4 px-4 py-4">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
          <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
        </li>
      ))}
    </ul>
  );
}

export function LeadList(props: LeadListProps) {
  const { page, isLoading, isRefreshing, error, filtersActive, timeZone, now } = props;

  let body;
  if (isLoading) {
    body = <ListSkeleton />;
  } else if (error && !page) {
    body = (
      <EmptyState
        tone="danger"
        icon={CircleAlert}
        title="Couldn't load your leads"
        description={error.message}
        action={<Button onClick={props.onRetry}>Try again</Button>}
      />
    );
  } else if (page && page.items.length === 0) {
    body = filtersActive ? (
      <EmptyState
        icon={SearchX}
        title="No leads match these filters"
        description="Try a different name or company, or show every status."
        action={
          <Button variant="secondary" onClick={props.onClearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={UserPlus}
        title="Add your first lead"
        description="Track every conversation and never miss a promised follow-up."
        action={
          <Button onClick={props.onAddLead}>
            <UserPlus className="size-4" aria-hidden />
            Add lead
          </Button>
        }
      />
    );
  } else if (page) {
    body = (
      <>
        <ul className={cn("divide-y divide-line transition-opacity", isRefreshing && "opacity-60")}>
          {page.items.map((lead) => (
            <LeadRow key={lead.id} lead={lead} timeZone={timeZone} now={now} onOpen={props.onOpen} />
          ))}
        </ul>
        {page.total > page.items.length && (
          <div className="border-t border-line p-3 text-center">
            <p className="mb-2 text-xs text-muted">
              Showing {page.items.length} of {page.total} leads
            </p>
            <Button variant="secondary" size="sm" onClick={props.onLoadMore}>
              Show more
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-line bg-surface shadow-raised"
      aria-live="polite"
    >
      {body}
    </div>
  );
}
