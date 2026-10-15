"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api, type ListLeadsParams } from "@/lib/api";
import { DEFAULT_TIMEZONE } from "@/lib/format";
import { invalidateLeadData, keys, patchLeadInLists } from "@/lib/queries";
import type { AppConfig, FollowUpScope, LeadStatus } from "@/types";

const REFRESH_MS = 60_000;

const FALLBACK_CONFIG: AppConfig = {
  timezone: DEFAULT_TIMEZONE,
  ai_mode: "unavailable",
  ai_provider: "none",
};

export function useAppConfig(): AppConfig {
  const { data } = useQuery({
    queryKey: keys.config,
    queryFn: api.getConfig,
    staleTime: Infinity,
    retry: 2,
  });
  return data ?? FALLBACK_CONFIG;
}

/** Re-render on an interval so relative times ("2 hours ago", "Overdue 3 days") stay fresh. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function useLeads({ q = "", status = "All", limit = 100 }: ListLeadsParams) {
  return useQuery({
    queryKey: keys.leads(q.trim(), status, limit),
    queryFn: ({ signal }) => api.listLeads({ q, status, limit }, signal),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });
}

export function useOverview() {
  return useQuery({
    queryKey: keys.overview,
    queryFn: ({ signal }) => api.getOverview(signal),
    refetchInterval: REFRESH_MS,
  });
}

export function useFollowUps(scope: FollowUpScope) {
  return useQuery({
    queryKey: keys.followUps(scope),
    queryFn: ({ signal }) => api.listFollowUps(scope, signal),
    refetchInterval: REFRESH_MS,
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: keys.lead(id),
    queryFn: ({ signal }) => api.getLead(id, signal),
    refetchInterval: REFRESH_MS,
  });
}

export function useDiscussions(id: string) {
  return useQuery({
    queryKey: keys.discussions(id),
    queryFn: ({ signal }) => api.listDiscussions(id, signal),
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof api.createLead>[0]) => api.createLead(input),
    onSuccess: () => invalidateLeadData(qc),
  });
}

export function useUpdateLeadStatus(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: LeadStatus) => api.updateLeadStatus(leadId, status),
    onSuccess: (lead) => {
      patchLeadInLists(qc, lead);
      return invalidateLeadData(qc, leadId);
    },
  });
}

export function useCreateDiscussion(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof api.createDiscussion>[1]) =>
      api.createDiscussion(leadId, input),
    onSuccess: ({ discussion, lead }) => {
      // Reflect the saved entry and the refreshed lead right away; refetches reconcile after.
      qc.setQueryData(keys.discussions(leadId), (old: unknown) =>
        Array.isArray(old) ? [discussion, ...old] : [discussion],
      );
      patchLeadInLists(qc, lead);
      return invalidateLeadData(qc, leadId);
    },
  });
}

export function useRescheduleFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      api.rescheduleFollowUp(id, scheduledAt),
    onSuccess: (followUp) => invalidateLeadData(qc, followUp.lead_id),
  });
}

export function useCloseFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "completed" | "cancelled" }) =>
      api.closeFollowUp(id, status),
    onSuccess: (followUp) => invalidateLeadData(qc, followUp.lead_id),
  });
}

export function useConversationBrief(leadId: string) {
  return useMutation({ mutationFn: () => api.createBrief(leadId) });
}
