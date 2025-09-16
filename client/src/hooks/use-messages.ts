import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Message, NewMessage } from "@/lib/types";

export function useMessageThread(
  coachId: string | null,
  clientId: string | null,
  options?: { enabled?: boolean; limit?: number; refetchIntervalMs?: number }
) {
  const enabled = Boolean(coachId && clientId) && (options?.enabled ?? true);
  const limit = options?.limit;
  const refetchInterval = options?.refetchIntervalMs ?? 4000; // light polling for near-realtime
  return useQuery<Message[]>({
    queryKey: ["/api/messages/thread", coachId, clientId, limit ?? "all"],
    queryFn: async () => {
      const url = `/api/messages/thread/${coachId}/${clientId}${limit ? `?limit=${limit}` : ""}`;
      const res = await apiRequest("GET", url);
      return (await res.json()) as Message[];
    },
    enabled,
    refetchOnWindowFocus: true,
    refetchInterval: enabled ? refetchInterval : false,
  });
}

export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { coachId: string; clientId: string }) => {
      const res = await apiRequest("POST", `/api/messages/thread/${payload.coachId}/${payload.clientId}/mark-read`, {});
      return await res.json();
    },
    onSuccess: (_data, variables) => {
      // Refresh thread queries to update readAt flags
      qc.invalidateQueries({ queryKey: ["/api/messages/thread", variables.coachId, variables.clientId], exact: false });
    },
  });
}

type SendMessageInput = NewMessage & { senderId: string };

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SendMessageInput) => {
      const { senderId: _omit, ...postBody } = payload;
      const res = await apiRequest("POST", `/api/messages/thread/${payload.coachId}/${payload.clientId}`, postBody);
      return (await res.json()) as Message;
    },
    onMutate: async (payload) => {
      // Optimistically add the message to the cache
      const keyPrefix = ["/api/messages/thread", payload.coachId, payload.clientId];
      // Cancel outgoing refetches
      await qc.cancelQueries({ queryKey: keyPrefix });

      const previous = qc.getQueriesData<Message[]>({ queryKey: keyPrefix });

      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
        coachId: payload.coachId,
        clientId: payload.clientId,
        senderId: payload.senderId,
        body: payload.body,
        createdAt: new Date().toISOString(),
        readAt: null,
      } as Message;

      // Update all matching queries (e.g., with different limits)
      previous.forEach(([qk, data]) => {
        const next = [...(data ?? []), optimistic];
        qc.setQueryData<Message[]>(qk as any, next);
      });

      return { previous };
    },
    onError: (_err, payload, context) => {
      // Rollback on error
      const keyPrefix = ["/api/messages/thread", payload.coachId, payload.clientId];
      context?.previous?.forEach(([qk, data]: any) => {
        qc.setQueryData<Message[]>(qk, data);
      });
    },
    onSettled: (_data, _error, payload) => {
      // Invalidate to get server-truth
      qc.invalidateQueries({ queryKey: ["/api/messages/thread", payload.coachId, payload.clientId], exact: false });
    },
  });
}
