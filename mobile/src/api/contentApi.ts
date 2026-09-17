import { apiFetch } from "./client";

export type ContentPageKey = "about_us" | "contact_us" | "forum";

export interface ContentPage {
  contentUuid: string;
  pageKey: string;
  title: string | null;
  bodyHtml: string | null;
  isPublished: boolean | null;
}

async function parseOrThrow<T>(res: Response, fallbackError: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || fallbackError);
  }
  return data as T;
}

export const contentApi = {
  async getPage(pageKey: ContentPageKey): Promise<ContentPage> {
    const res = await apiFetch(`/api/crew-app/content/${pageKey}`);
    return parseOrThrow<ContentPage>(res, "Failed to load page");
  },

  async listAllForAdmin(): Promise<ContentPage[]> {
    const res = await apiFetch("/api/crew-app/content");
    return parseOrThrow<ContentPage[]>(res, "Failed to load content pages");
  },

  async upsertPage(
    pageKey: ContentPageKey,
    body: { title: string; bodyHtml: string; isPublished?: boolean },
  ): Promise<ContentPage> {
    const res = await apiFetch(`/api/crew-app/content/${pageKey}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return parseOrThrow<ContentPage>(res, "Failed to save page");
  },
};
