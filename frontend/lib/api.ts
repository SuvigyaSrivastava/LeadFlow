import type {
  AppConfig,
  ConversationBrief,
  Discussion,
  DiscussionCreated,
  FollowUpScope,
  FollowUpWithLead,
  Lead,
  LeadDetail,
  LeadPage,
  LeadStatus,
  Overview,
} from "@/types";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: FieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetwork() {
    return this.code === "NETWORK_ERROR";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Can't reach the server. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    let body: { error?: { code?: string; message?: string; details?: { fields?: FieldError[] } } } =
      {};
    try {
      body = await response.json();
    } catch {
      // non-JSON error body: fall through to the generic message
    }
    throw new ApiError(
      response.status,
      body.error?.code ?? "HTTP_ERROR",
      body.error?.message ?? `Request failed (${response.status})`,
      body.error?.details?.fields ?? [],
    );
  }
  return (await response.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

export interface ListLeadsParams {
  q?: string;
  status?: LeadStatus | "All";
  limit?: number;
}

export const api = {
  getConfig: () => request<AppConfig>("/api/config"),

  listLeads: ({ q, status, limit = 100 }: ListLeadsParams, signal?: AbortSignal) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (q?.trim()) params.set("q", q.trim());
    if (status && status !== "All") params.set("status", status);
    return request<LeadPage>(`/api/leads?${params}`, { signal });
  },
  getOverview: (signal?: AbortSignal) => request<Overview>("/api/leads/overview", { signal }),
  getLead: (id: string, signal?: AbortSignal) =>
    request<LeadDetail>(`/api/leads/${id}`, { signal }),
  createLead: (input: {
    name: string;
    company: string | null;
    phone: string | null;
    status: LeadStatus;
  }) => request<Lead>("/api/leads", json("POST", input)),
  updateLeadStatus: (id: string, status: LeadStatus) =>
    request<Lead>(`/api/leads/${id}`, json("PATCH", { status })),

  listDiscussions: (id: string, signal?: AbortSignal) =>
    request<Discussion[]>(`/api/leads/${id}/discussions`, { signal }),
  createDiscussion: (
    id: string,
    input: { note: string; follow_up_at?: string; complete_follow_up_ids?: string[] },
  ) => request<DiscussionCreated>(`/api/leads/${id}/discussions`, json("POST", input)),

  listFollowUps: (scope: FollowUpScope, signal?: AbortSignal) =>
    request<FollowUpWithLead[]>(`/api/follow-ups?scope=${scope}`, { signal }),
  rescheduleFollowUp: (id: string, scheduled_at: string) =>
    request<FollowUpWithLead>(`/api/follow-ups/${id}`, json("PATCH", { scheduled_at })),
  closeFollowUp: (id: string, status: "completed" | "cancelled") =>
    request<FollowUpWithLead>(`/api/follow-ups/${id}`, json("PATCH", { status })),

  createBrief: (id: string) =>
    request<ConversationBrief>(`/api/leads/${id}/conversation-brief`, { method: "POST" }),
};
