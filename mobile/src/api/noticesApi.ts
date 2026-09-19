import { z } from "zod";
import { apiFetch, parseOrThrow } from "./client";
import { Page, pageQuery, pageSchema } from "./pagination";

const noticeSchema = z.object({
  noticeUuid: z.string(),
  title: z.string(),
  body: z.string(),
  isPublished: z.boolean().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
});
export type Notice = z.infer<typeof noticeSchema>;
const noticePageSchema = pageSchema(noticeSchema);

export const noticesApi = {
  async list(page?: { limit?: number; offset?: number }): Promise<Page<Notice>> {
    const res = await apiFetch(`/api/crew-app/notices${pageQuery(page)}`);
    return parseOrThrow(res, "Failed to load notices", noticePageSchema);
  },

  async listAllForAdmin(page?: { limit?: number; offset?: number }): Promise<Page<Notice>> {
    const res = await apiFetch(`/api/crew-app/notices/admin${pageQuery(page)}`);
    return parseOrThrow(res, "Failed to load notices", noticePageSchema);
  },

  async get(noticeUuid: string): Promise<Notice> {
    const res = await apiFetch(`/api/crew-app/notices/${noticeUuid}`);
    return parseOrThrow(res, "Failed to load notice", noticeSchema);
  },

  async create(body: { title: string; body: string; isPublished?: boolean }): Promise<Notice> {
    const res = await apiFetch("/api/crew-app/notices", { method: "POST", body: JSON.stringify(body) });
    return parseOrThrow(res, "Failed to create notice", noticeSchema);
  },

  async update(
    noticeUuid: string,
    body: { title?: string; body?: string; isPublished?: boolean },
  ): Promise<Notice> {
    const res = await apiFetch(`/api/crew-app/notices/${noticeUuid}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return parseOrThrow(res, "Failed to update notice", noticeSchema);
  },

  async remove(noticeUuid: string): Promise<void> {
    const res = await apiFetch(`/api/crew-app/notices/${noticeUuid}`, { method: "DELETE" });
    await parseOrThrow(res, "Failed to delete notice");
  },
};
