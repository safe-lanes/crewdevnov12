import { apiFetch } from "./client";

export interface Notice {
  noticeUuid: string;
  title: string;
  body: string;
  isPublished: boolean | null;
  publishedAt: string | null;
  createdAt: string | null;
}

async function parseOrThrow<T>(res: Response, fallbackError: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || fallbackError);
  }
  return data as T;
}

export const noticesApi = {
  async list(): Promise<Notice[]> {
    const res = await apiFetch("/api/crew-app/notices");
    return parseOrThrow<Notice[]>(res, "Failed to load notices");
  },

  async listAllForAdmin(): Promise<Notice[]> {
    const res = await apiFetch("/api/crew-app/notices/admin");
    return parseOrThrow<Notice[]>(res, "Failed to load notices");
  },

  async get(noticeUuid: string): Promise<Notice> {
    const res = await apiFetch(`/api/crew-app/notices/${noticeUuid}`);
    return parseOrThrow<Notice>(res, "Failed to load notice");
  },

  async create(body: { title: string; body: string; isPublished?: boolean }): Promise<Notice> {
    const res = await apiFetch("/api/crew-app/notices", { method: "POST", body: JSON.stringify(body) });
    return parseOrThrow<Notice>(res, "Failed to create notice");
  },

  async update(
    noticeUuid: string,
    body: { title?: string; body?: string; isPublished?: boolean },
  ): Promise<Notice> {
    const res = await apiFetch(`/api/crew-app/notices/${noticeUuid}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return parseOrThrow<Notice>(res, "Failed to update notice");
  },

  async remove(noticeUuid: string): Promise<void> {
    const res = await apiFetch(`/api/crew-app/notices/${noticeUuid}`, { method: "DELETE" });
    await parseOrThrow(res, "Failed to delete notice");
  },
};
