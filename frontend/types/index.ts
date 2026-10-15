export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Won",
  "Lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type FollowUpStatus = "pending" | "completed" | "cancelled";
export type FollowUpState = "overdue" | "today" | "upcoming";
export type FollowUpScope = "attention" | "upcoming" | "pending";
export type Attention =
  | "follow_up_overdue"
  | "follow_up_scheduled"
  | "no_recent_activity"
  | "recently_contacted";

export interface FollowUp {
  id: string;
  lead_id: string;
  discussion_id: string | null;
  scheduled_at: string;
  status: FollowUpStatus;
  state: FollowUpState | null;
  created_at: string;
  completed_at: string | null;
}

export interface LeadRef {
  id: string;
  name: string;
  company: string | null;
  status: LeadStatus;
}

export interface FollowUpWithLead extends FollowUp {
  lead: LeadRef;
}

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  discussion_count: number;
  last_discussion_note: string | null;
  last_discussion_at: string | null;
  next_follow_up_id: string | null;
  next_follow_up_at: string | null;
  follow_up_state: FollowUpState | null;
  pending_follow_up_count: number;
  overdue_follow_up_count: number;
}

export interface LeadDetail extends Lead {
  pending_follow_ups: FollowUp[];
  attention: Attention | null;
}

export interface LeadPage {
  items: Lead[];
  total: number;
  limit: number;
  offset: number;
}

export interface Overview {
  due_today: number;
  overdue: number;
  active_leads: number;
  total_leads: number;
  status_counts: Record<LeadStatus, number>;
}

export interface Discussion {
  id: string;
  lead_id: string;
  note: string;
  created_at: string;
  follow_up: FollowUp | null;
}

export interface DiscussionCreated {
  discussion: Discussion;
  lead: Lead;
}

export interface ConversationBrief {
  summary: string;
  recorded_interests: string[];
  open_items: string[];
  suggested_questions: string[];
  draft_message: string;
  mode: "llm" | "demo";
  provider: string;
  model: string | null;
  generated_at: string;
  discussion_count: number;
  notice: string;
}

export interface AppConfig {
  timezone: string;
  ai_mode: "llm" | "demo" | "unavailable";
  ai_provider: string;
}
