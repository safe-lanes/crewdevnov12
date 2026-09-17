import { apiFetch } from "./client";

export type CrewInformation = { sections: Record<string, any>; permissions: { writableSingletons: string[]; writableCollections: string[]; attachments: boolean } };
export type MasterOption = { value: string; label: string };
export type CrewInformationMasters = Record<"nationalities" | "countries" | "languages" | "vesselTypes" | "vessels", MasterOption[]>;

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
};