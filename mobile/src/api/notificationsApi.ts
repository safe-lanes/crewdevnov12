import { apiFetch } from "./client";

export interface AppNotification {
  notificationUuid: string;
  notificationType: string;
  title: string;
  body: string | null;
  sourceRefUuid: string | null;
  isRead: boolean | null;
  createdAt: string | null;
}

async function parseOrThrow<T>(res: Response, fallbackError: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || fallbackError);
  }
  return data as T;
}

export const notificationsApi = {
  async list(): Promise<AppNotification[]> {
    const res = await apiFetch("/api/crew-app/notifications");
    return parseOrThrow<AppNotification[]>(res, "Failed to load notifications");
  },

  async unreadCount(): Promise<number> {
    const res = await apiFetch("/api/crew-app/notifications/unread-count");
    const data = await parseOrThrow<{ count: number }>(res, "Failed to load unread count");
    return data.count;
  },

  async markRead(notificationUuid: string): Promise<void> {
    const res = await apiFetch(`/api/crew-app/notifications/${notificationUuid}/read`, { method: "POST" });
    await parseOrThrow(res, "Failed to mark notification read");
  },

  async markAllRead(): Promise<void> {
    const res = await apiFetch("/api/crew-app/notifications/read-all", { method: "POST" });
    await parseOrThrow(res, "Failed to mark all notifications read");
  },
};
