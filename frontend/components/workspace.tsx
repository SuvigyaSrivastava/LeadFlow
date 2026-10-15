"use client";

import { Plus, Search, X } from "lucide-react";
import { useState } from "react";

import { AddLeadDialog } from "@/components/dialogs/add-lead-dialog";
import { FollowUpQueue } from "@/components/followups/follow-up-queue";
import { AppHeader } from "@/components/layout/app-header";
import { LeadList } from "@/components/leads/lead-list";
import { OverviewStrip } from "@/components/leads/overview-strip";
import { StatusFilter, type StatusFilterValue } from "@/components/leads/status-filter";
import { LeadPanel } from "@/components/timeline/lead-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import {
  useAppConfig,
  useDebouncedValue,
  useLeads,
  useNow,
  useOverview,
} from "@/hooks/use-app-data";

const PAGE_SIZE = 100;

export function Workspace() {
  const config = useAppConfig();
  const now = useNow();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilterValue>("All");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const query = useDebouncedValue(search, 250);
  const leads = useLeads({ q: query, status, limit });
  const overview = useOverview();

  const filtersActive = search.trim() !== "" || status !== "All";
  const clearFilters = () => {
    setSearch("");
    setStatus("All");
    setLimit(PAGE_SIZE);
  };

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Leads</h1>
            <p className="mt-1 max-w-prose text-sm text-muted">
              Every conversation, and the follow-up you promised, in one place.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Add lead
          </Button>
        </div>

        <OverviewStrip overview={overview.data} loading={overview.isLoading} />

        <FollowUpQueue
          query={query}
          status={status}
          timeZone={config.timezone}
          now={now}
          onOpenLead={setSelectedId}
        />

        <section aria-labelledby="leads-heading" className="space-y-3">
          <h2 id="leads-heading" className="sr-only">
            All leads
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:w-72">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <Input
                type="search"
                aria-label="Search leads by name or company"
                placeholder="Search by name or company"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setLimit(PAGE_SIZE);
                }}
                className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted hover:bg-canvas hover:text-ink"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
            <StatusFilter
              value={status}
              onChange={(value) => {
                setStatus(value);
                setLimit(PAGE_SIZE);
              }}
              counts={overview.data?.status_counts}
              total={overview.data?.total_leads}
            />
          </div>

          <LeadList
            page={leads.data}
            isLoading={leads.isLoading}
            isRefreshing={leads.isPlaceholderData}
            error={leads.error}
            filtersActive={filtersActive}
            timeZone={config.timezone}
            now={now}
            onOpen={(lead) => setSelectedId(lead.id)}
            onRetry={() => leads.refetch()}
            onClearFilters={clearFilters}
            onAddLead={() => setAddOpen(true)}
            onLoadMore={() => setLimit((l) => l + PAGE_SIZE)}
          />
        </section>
      </main>

      <AddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(lead) => {
          // Make sure the new lead is visible, then open it so the first note is one click away.
          clearFilters();
          setSelectedId(lead.id);
        }}
      />
      <LeadPanel leadId={selectedId} timeZone={config.timezone} onClose={() => setSelectedId(null)} />
    </>
  );
}
