import { apiRequest } from "@/lib/queryClient";

const BASE = "/api/v2/admin/users";

export interface AdminUserDto {
  id: number;
  uuid: string | null;
  username: string;
  email: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  designation: string | null;
  department: string | null;
  preferredAuthMethod: "TOTP" | "NA" | null;
  userType: "Office" | "Vessel" | string;
  roleId: string | null;
  roleName: string | null;
  domain: string | null;
  isActive: boolean;
  isLocked: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  assignedVesselIds: string[];
}

export interface CreateUserPayload {
  username: string;
  password: string;
  email?: string | null;
  firstName: string;
  lastName?: string | null;
  designation?: string | null;
  department?: string | null;
  preferredAuthMethod?: "TOTP" | "NA";
  userType: "Office" | "Vessel";
  roleId?: string | null;
  isActive?: boolean;
  assignedVesselIds?: string[];
}

export type UpdateUserPayload = Partial<CreateUserPayload> & { password?: string };

export const adminUsersApiV2 = {
  async list(params: { search?: string; type?: "Office" | "Vessel" } = {}): Promise<AdminUserDto[]> {
    const sp = new URLSearchParams();
    if (params.search) sp.set("search", params.search);
    if (params.type) sp.set("type", params.type);
    const qs = sp.toString();
    const res = await fetch(`${BASE}${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  },

  async get(uuid: string): Promise<AdminUserDto> {
    const res = await fetch(`${BASE}/${encodeURIComponent(uuid)}`);
    if (!res.ok) throw new Error("Failed to fetch user");
    return res.json();
  },

  async usernameAvailable(username: string, excludeUuid?: string): Promise<boolean> {
    const sp = new URLSearchParams({ username });
    if (excludeUuid) sp.set("excludeUuid", excludeUuid);
    const res = await fetch(`${BASE}/username-available?${sp.toString()}`);
    if (!res.ok) {
      // Server-side error (e.g. no tenant domain in dev) — surface as unknown,
      // not as "taken", so the form caller can fall back to "idle".
      throw new Error(`username-available failed: ${res.status}`);
    }
    const data = await res.json();
    return !!data.available;
  },

  async create(payload: CreateUserPayload): Promise<AdminUserDto> {
    const res = await apiRequest("POST", BASE, payload);
    return res.json();
  },

  async update(uuid: string, payload: UpdateUserPayload): Promise<AdminUserDto> {
    const res = await apiRequest("PATCH", `${BASE}/${encodeURIComponent(uuid)}`, payload);
    return res.json();
  },
};
