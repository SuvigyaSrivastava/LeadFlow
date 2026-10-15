import type { Discussion, FollowUp, FollowUpWithLead, Lead, LeadDetail, Overview } from "@/types";

export const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
export const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

let counter = 0;
export const uid = (prefix: string) => `${prefix}-${++counter}`;

export function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: uid("lead"),
    name: "Priya Nair",
    company: "Meridian Wealth",
    phone: "555-0100",
    status: "Contacted",
    created_at: minutesAgo(60 * 24 * 9),
    updated_at: minutesAgo(120),
    discussion_count: 1,
    last_discussion_note: "Sent the pricing PDF.",
    last_discussion_at: minutesAgo(120),
    next_follow_up_id: null,
    next_follow_up_at: null,
    follow_up_state: null,
    pending_follow_up_count: 0,
    overdue_follow_up_count: 0,
    ...overrides,
  };
}

export function makeFollowUp(overrides: Partial<FollowUp> = {}): FollowUp {
  return {
    id: uid("fu"),
    lead_id: "lead-x",
    discussion_id: null,
    scheduled_at: minutesFromNow(60 * 24),
    status: "pending",
    state: "upcoming",
    created_at: minutesAgo(10),
    completed_at: null,
    ...overrides,
  };
}

export function makeQueueItem(lead: Lead, overrides: Partial<FollowUp> = {}): FollowUpWithLead {
  return {
    ...makeFollowUp({ lead_id: lead.id, ...overrides }),
    lead: { id: lead.id, name: lead.name, company: lead.company, status: lead.status },
  };
}

export function makeDetail(lead: Lead, overrides: Partial<LeadDetail> = {}): LeadDetail {
  return { ...lead, pending_follow_ups: [], attention: null, ...overrides };
}

export function makeDiscussion(leadId: string, note: string, minutes: number): Discussion {
  return {
    id: uid("disc"),
    lead_id: leadId,
    note,
    created_at: minutesAgo(minutes),
    follow_up: null,
  };
}

export const OVERVIEW: Overview = {
  due_today: 1,
  overdue: 2,
  active_leads: 5,
  total_leads: 7,
  status_counts: {
    New: 1,
    Contacted: 2,
    Qualified: 1,
    "Proposal Sent": 1,
    Won: 1,
    Lost: 1,
  },
};
