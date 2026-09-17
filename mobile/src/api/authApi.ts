import { rawPost, apiFetch } from "./client";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  mustResetPassword: boolean;
  crew: {
    crewUuid: string;
    empNo: string | null;
    mobile: string | null;
    email: string | null;
    userType: string;
    firstName: string | null;
    familyName: string | null;
  };
}

export const authApi = {
  login(body: { identifier: string; password: string; domain: string; deviceId?: string; deviceLabel?: string }) {
    return rawPost<LoginResponse>("/api/crew-app/auth/login", body);
  },

  async logout(body: { refreshToken?: string; allDevices?: boolean }): Promise<void> {
    // Best-effort — the caller clears local tokens regardless of the outcome.
    await apiFetch("/api/crew-app/auth/logout", { method: "POST", body: JSON.stringify(body) }).catch(() => {});
  },

  async setPassword(body: { currentPassword: string; newPassword: string }): Promise<void> {
    const res = await apiFetch("/api/crew-app/auth/set-password", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Failed to set password");
    }
  },
};
