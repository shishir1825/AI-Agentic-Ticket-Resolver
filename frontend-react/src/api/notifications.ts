import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./client";

export interface NotificationItem {
  id: string;
  run_id: string;
  target_role: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications(role: string) {
  return useQuery<NotificationItem[]>({
    queryKey: ["notifications", role],
    queryFn: () =>
      api.get(`/api/notifications?role=${role}`).then((r) => r.data),
    refetchInterval: 10000,
  });
}

export function useUnreadCount(role: string) {
  return useQuery<NotificationItem[]>({
    queryKey: ["notifications-unread", role],
    queryFn: () =>
      api.get(`/api/notifications?role=${role}&unread=true`).then((r) => r.data),
    refetchInterval: 10000,
    select: (data) => data,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      api.post(`/api/notifications/${notificationId}/read`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: string) =>
      api.post(`/api/notifications/read-all?role=${role}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });
}
