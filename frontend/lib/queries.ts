import type { QueryClient } from "@tanstack/react-query";

import type { Lead, LeadPage } from "@/types";

export const keys = {
  config: ["config"] as const,
  leads: (q: string, status: string, limit: number) => ["leads", { q, status, limit }] as const,
  leadsRoot: ["leads"] as const,
  overview: ["overview"] as const,
  followUps: (scope: string) => ["follow-ups", scope] as const,
  followUpsRoot: ["follow-ups"] as const,
  lead: (id: string) => ["lead", id] as const,
  discussions: (id: string) => ["discussions", id] as const,
};

/** Everything that can change when a lead, discussion or follow-up changes. */
export function invalidateLeadData(qc: QueryClient, leadId?: string) {
  const tasks = [
    qc.invalidateQueries({ queryKey: keys.leadsRoot }),
    qc.invalidateQueries({ queryKey: keys.overview }),
    qc.invalidateQueries({ queryKey: keys.followUpsRoot }),
  ];
  if (leadId) {
    tasks.push(qc.invalidateQueries({ queryKey: keys.lead(leadId) }));
    tasks.push(qc.invalidateQueries({ queryKey: keys.discussions(leadId) }));
  }
  return Promise.all(tasks);
}

/** Swap one lead into every cached list so the UI updates before the refetch lands. */
export function patchLeadInLists(qc: QueryClient, lead: Lead) {
  qc.setQueriesData<LeadPage>({ queryKey: keys.leadsRoot }, (page) =>
    page ? { ...page, items: page.items.map((i) => (i.id === lead.id ? lead : i)) } : page,
  );
}
