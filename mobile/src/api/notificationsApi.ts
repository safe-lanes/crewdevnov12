import { z } from "zod";
import { apiFetch, parseOrThrow } from "./client";
import { Page, pageQuery, pageSchema } from "./pagination";

const appNotificationSchema = z.object({
  notificationUuid: z.string(),
  notificationType: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  sourceRefUuid: z.string().nullable(),
  isRead: z.boolean().nullable(),
  createdAt: z.string().nullable(),
});
export type AppNotification = z.infer<typeof appNotificationSchema>;
const notificationPageSchema = pageSchema(appNotificationSchema);
const unreadCountSchema = z.object({ count: z.number() });

export const notificationsApi = {
  async list(page?: { limit?: number; offset?: number }): Promise<Page<AppNotification>> {
    const res = await apiFetch(`/api/crew-app/notifications${pageQuery(page)}`);
    return parseOrThrow(res, "Failed to load notifications", notificationPageSchema);
  },

  async unreadCount(): Promise<number> {
    const res = await apiFetch("/api/crew-app/notifications/unread-count");
    const data = await parseOrThrow(res, "Failed to load unread count", unreadCountSchema);
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
