"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SupportTicket, SupportMessage } from "@/lib/types/support";

export const supportKeys = {
  all: ["support"] as const,
  list: () => [...supportKeys.all, "list"] as const,
  detail: (id: string) => [...supportKeys.all, "detail", id] as const,
  adminList: () => [...supportKeys.all, "admin", "list"] as const,
  adminDetail: (id: string) => [...supportKeys.all, "admin", "detail", id] as const,
  stats: () => [...supportKeys.all, "admin", "stats"] as const,
};

export function useSupportTickets() {
  return useQuery({
    queryKey: supportKeys.list(),
    queryFn: async () => {
      const res = await fetch("/api/support");
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load support tickets");
      return json.data as SupportTicket[];
    },
    staleTime: 30_000,
  });
}

export function useSupportTicket(ticketId: string) {
  return useQuery({
    queryKey: supportKeys.detail(ticketId),
    queryFn: async () => {
      const res = await fetch(`/api/support/${ticketId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load ticket");
      return json.data as SupportTicket;
    },
    enabled: ticketId.length > 0,
    staleTime: 30_000,
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      subject: string;
      category: string;
      priority: string;
      message: string;
      screenshotUrl?: string;
    }) => {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to create ticket");
      return json.data as SupportTicket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.list() });
    },
  });
}

export function useAddSupportMessage(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { text: string; attachmentUrl?: string }) => {
      const res = await fetch(`/api/support/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to send message");
      return json.data as { success: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.detail(ticketId) });
    },
  });
}

export function useAdminSupportTickets(filters?: {
  status?: string;
  category?: string;
  assignedTo?: string;
  search?: string;
  limit?: number;
}) {
  const queryKey = [
    ...supportKeys.adminList(),
    filters?.status ?? "all",
    filters?.category ?? "all",
    filters?.assignedTo ?? "all",
    filters?.search ?? "",
    filters?.limit ?? 50,
  ] as const;

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.category) params.set("category", filters.category);
      if (filters?.assignedTo) params.set("assignedTo", filters.assignedTo);
      if (filters?.search) params.set("search", filters.search);
      if (filters?.limit) params.set("limit", String(filters.limit ?? 50));

      const res = await fetch(`/api/admin/support?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load admin support tickets");
      return json.data as SupportTicket[];
    },
    staleTime: 20_000,
  });
}

export function useAdminSupportStats() {
  return useQuery({
    queryKey: supportKeys.stats(),
    queryFn: async () => {
      const res = await fetch(`/api/admin/support/stats`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load support stats");
      return json.data as {
        totalOpen: number;
        totalInProgress: number;
        totalWaitingOnUser: number;
        totalResolved: number;
        unassigned: number;
      };
    },
    staleTime: 60_000,
  });
}

export function useAdminSupportTicket(ticketId: string) {
  return useQuery({
    queryKey: supportKeys.adminDetail(ticketId),
    queryFn: async () => {
      const res = await fetch(`/api/admin/support/${ticketId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load ticket details");
      return json.data as { ticket: SupportTicket; user: any };
    },
    enabled: ticketId.length > 0,
    staleTime: 30_000,
  });
}

export function useAdminUpdateSupportTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { status?: string; priority?: string; assignedTo?: string | null }) => {
      const res = await fetch(`/api/admin/support/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to update ticket");
      return json.data as SupportTicket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.adminDetail(ticketId) });
      queryClient.invalidateQueries({ queryKey: supportKeys.adminList() });
    },
  });
}

export function useAdminAddSupportMessage(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { text: string; isInternal?: boolean; attachmentUrl?: string }) => {
      const res = await fetch(`/api/admin/support/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to send message");
      return json.data as { success: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.adminDetail(ticketId) });
    },
  });
}
