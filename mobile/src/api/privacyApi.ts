import { z } from "zod";
import { apiFetch, parseOrThrow } from "./client";

const item = z.object({ requestUuid: z.string(), requestType: z.string(), status: z.string(), legalHold: z.boolean().optional(), resolutionNotes: z.string().nullable().optional(), createdAt: z.union([z.string(), z.date()]).nullable().optional(), completedAt: z.union([z.string(), z.date()]).nullable().optional() });
export type PrivacyRequest = z.infer<typeof item>;

export const privacyApi = {
  async list(): Promise<PrivacyRequest[]> { return parseOrThrow(await apiFetch("/api/crew-app/privacy-requests"), "Unable to load privacy requests", z.array(item)); },
  async create(requestType: "access" | "export" | "correction" | "deletion", reason?: string) {
    return parseOrThrow(await apiFetch("/api/crew-app/privacy-requests", { method: "POST", body: JSON.stringify({ requestType, reason }) }), "Unable to submit privacy request");
  },
};
