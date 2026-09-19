import { z } from "zod";
import { apiFetch, parseOrThrow } from "./client";

export type ContentPageKey = "about_us" | "contact_us" | "forum";

const contentPageSchema = z.object({
  contentUuid: z.string(),
  pageKey: z.string(),
  title: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  isPublished: z.boolean().nullable(),
});
export type ContentPage = z.infer<typeof contentPageSchema>;
const contentPageListSchema = z.array(contentPageSchema);

export const contentApi = {
  async getPage(pageKey: ContentPageKey): Promise<ContentPage> {
    const res = await apiFetch(`/api/crew-app/content/${pageKey}`);
    return parseOrThrow(res, "Failed to load page", contentPageSchema);
  },

  async listAllForAdmin(): Promise<ContentPage[]> {
    const res = await apiFetch("/api/crew-app/content");
    return parseOrThrow(res, "Failed to load content pages", contentPageListSchema);
  },

  async upsertPage(
    pageKey: ContentPageKey,
    body: { title: string; bodyHtml: string; isPublished?: boolean },
  ): Promise<ContentPage> {
    const res = await apiFetch(`/api/crew-app/content/${pageKey}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return parseOrThrow(res, "Failed to save page", contentPageSchema);
  },
};
