import { z } from "zod";
import { apiFetch, parseOrThrow, refreshCrewSession } from "./client";
import { API_BASE_URL } from "../config";
import { tokenStore } from "../auth/tokenStore";

const attachmentRulesSchema = z.object({
  readableCollections: z.array(z.string()),
  writableCollections: z.array(z.string()),
  allowedMimeTypes: z.array(z.string()),
  maxBytes: z.number(),
});
export type AttachmentRules = z.infer<typeof attachmentRulesSchema>;

// `sections` deliberately stays a loose record rather than an exhaustive
// per-field schema: it's a flexible passthrough bag across 11+ different
// collections (particulars, documents, medicals, ...) whose individual
// shapes are already handled defensively at the point of use (optional
// chaining) — this still catches the actual failure mode the review flagged
// (sections/permissions missing or non-object entirely), just without
// becoming a maintenance burden that breaks on every legitimate field the
// server adds.
const crewInformationSchema = z.object({
  sections: z.record(z.string(), z.any()),
  permissions: z.object({
    writableSingletons: z.array(z.string()),
    writableCollections: z.array(z.string()),
    attachments: z.boolean(),
    attachmentRules: attachmentRulesSchema.optional(),
  }),
});
export type CrewInformation = z.infer<typeof crewInformationSchema>;

const masterOptionSchema = z.object({ value: z.string(), label: z.string() });
export type MasterOption = z.infer<typeof masterOptionSchema>;
const crewInformationMastersSchema = z.object({
  nationalities: z.array(masterOptionSchema),
  countries: z.array(masterOptionSchema),
  languages: z.array(masterOptionSchema),
  vesselTypes: z.array(masterOptionSchema),
  vessels: z.array(masterOptionSchema),
});
export type CrewInformationMasters = z.infer<typeof crewInformationMastersSchema>;

const crewAttachmentSchema = z.object({
  attUuid: z.string(),
  fileName: z.string(),
  fileType: z.string().nullable(),
  fileSize: z.string().nullable(),
  createdAt: z.string().nullable(),
  canDelete: z.boolean(),
});
export type CrewAttachment = z.infer<typeof crewAttachmentSchema>;
const crewAttachmentListSchema = z.array(crewAttachmentSchema);

// Collection rows (documents, visas, licenses, ...) vary in shape per
// collection — validated only as "an array of objects", not field-by-field.
const collectionRowsSchema = z.array(z.record(z.string(), z.any()));

export type LocalCrewFile = { uri: string; name: string; type: string; size?: number; file?: File };

async function request<T>(path: string, options: RequestInit | undefined, schema?: z.ZodType<T>): Promise<T> {
  const response = await apiFetch(`/api/crew-app/crew-information${path}`, options);
  return parseOrThrow(response, "Unable to load crew information", schema);
}

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const crewInformationApi = {
  get: () => request("", undefined, crewInformationSchema),
  getMasters: () => request("/masters", undefined, crewInformationMastersSchema),
  updateSection: (section: string, body: any) => request<any>(`/${section}`, json("PUT", body)),
  list: (collection: string) => request(`/${collection}`, undefined, collectionRowsSchema),
  create: (collection: string, body: any) => request<any>(`/${collection}`, json("POST", body)),
  update: (collection: string, uuid: string, body: any) => request<any>(`/${collection}/${uuid}`, json("PATCH", body)),
  remove: async (collection: string, uuid: string) => {
    await request<unknown>(`/${collection}/${uuid}`, { method: "DELETE" });
  },
  listAttachments: (collection: string, uuid: string) => request(`/${collection}/${uuid}/attachments`, undefined, crewAttachmentListSchema),
  removeAttachment: (collection: string, uuid: string, attUuid: string) => request<void>(`/${collection}/${uuid}/attachments/${attUuid}`, { method: "DELETE" }),
  attachmentPath: (collection: string, uuid: string, attUuid: string) => `/api/crew-app/crew-information/${collection}/${uuid}/attachments/${attUuid}/raw`,
  authorizedAttachmentUrl: (collection: string, uuid: string, attUuid: string) => {
    const accessToken = tokenStore.get().accessToken;
    return {
      url: `${API_BASE_URL}${crewInformationApi.attachmentPath(collection, uuid, attUuid)}`,
      headers: (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) as Record<string, string>,
    };
  },
  uploadAttachment(collection: string, uuid: string, file: LocalCrewFile, onProgress: (value: number) => void) {
    let xhr: XMLHttpRequest | null = null;
    let cancelled = false;
    const promise = new Promise<CrewAttachment>((resolve, reject) => {
      const send = (refreshed: boolean) => {
        if (cancelled) return reject(Object.assign(new Error("Upload cancelled"), { cancelled: true }));
        xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE_URL}/api/crew-app/crew-information/${collection}/${uuid}/attachments`);
        const accessToken = tokenStore.get().accessToken;
        if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onerror = () => reject(Object.assign(new Error("Upload status is unknown. Reconnect to check before retrying."), { ambiguous: true }));
        xhr.onabort = () => reject(Object.assign(new Error("Upload cancelled"), { cancelled: true }));
        xhr.onload = async () => {
          let body: any = {};
          try { body = JSON.parse(xhr?.responseText || "{}"); } catch {}
          if (xhr && xhr.status >= 200 && xhr.status < 300) {
            const parsed = crewAttachmentSchema.safeParse(body);
            if (!parsed.success) return reject(new Error("Upload succeeded but the server's response was unexpected."));
            return resolve(parsed.data);
          }
          if (xhr?.status === 401 && !refreshed && await refreshCrewSession()) {
            send(true);
            return;
          }
          reject(Object.assign(new Error(body.message || body.error || "Upload failed"), { status: xhr?.status }));
        };
        const data = new FormData();
        data.append("file", file.file ?? ({ uri: file.uri, name: file.name, type: file.type } as any));
        xhr.send(data);
      };
      send(false);
    });
    return { promise, cancel: () => { cancelled = true; xhr?.abort(); } };
  },
};