import { apiFetch, refreshCrewSession } from "./client";
import { API_BASE_URL } from "../config";
import { tokenStore } from "../auth/tokenStore";

export type AttachmentRules = { readableCollections: string[]; writableCollections: string[]; allowedMimeTypes: string[]; maxBytes: number };
export type CrewInformation = { sections: Record<string, any>; permissions: { writableSingletons: string[]; writableCollections: string[]; attachments: boolean; attachmentRules?: AttachmentRules } };
export type MasterOption = { value: string; label: string };
export type CrewInformationMasters = Record<"nationalities" | "countries" | "languages" | "vesselTypes" | "vessels", MasterOption[]>;
export type CrewAttachment = { attUuid: string; fileName: string; fileType: string | null; fileSize: string | null; createdAt: string | null; canDelete: boolean };
export type LocalCrewFile = { uri: string; name: string; type: string; size?: number; file?: File };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/crew-app/crew-information${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || body.error || "Unable to load crew information") as Error & { status?: number; details?: unknown };
    error.status = response.status;
    error.details = body.details;
    throw error;
  }
  return body as T;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const crewInformationApi = {
  get: () => request<CrewInformation>(""),
  getMasters: () => request<CrewInformationMasters>("/masters"),
  updateSection: (section: string, body: any) => request<any>(`/${section}`, json("PUT", body)),
  list: (collection: string) => request<any[]>(`/${collection}`),
  create: (collection: string, body: any) => request<any>(`/${collection}`, json("POST", body)),
  update: (collection: string, uuid: string, body: any) => request<any>(`/${collection}/${uuid}`, json("PATCH", body)),
  remove: async (collection: string, uuid: string) => {
    await request<unknown>(`/${collection}/${uuid}`, { method: "DELETE" });
  },
  listAttachments: (collection: string, uuid: string) => request<CrewAttachment[]>(`/${collection}/${uuid}/attachments`),
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
          if (xhr && xhr.status >= 200 && xhr.status < 300) return resolve(body as CrewAttachment);
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