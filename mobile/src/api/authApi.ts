import { z } from "zod";
import { rawPost, apiFetch, parseOrThrow } from "./client";

const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  mustResetPassword: z.boolean(),
  crew: z.object({
    crewUuid: z.string(),
    empNo: z.string().nullable(),
    mobile: z.string().nullable(),
    email: z.string().nullable(),
    userType: z.string(),
    firstName: z.string().nullable(),
    familyName: z.string().nullable(),
  }),
});
type LoginResponse = z.infer<typeof loginResponseSchema>;

export const authApi = {
  login(body: { identifier: string; password: string; domain: string; deviceId?: string; deviceLabel?: string; mfaCode?: string }) {
    return rawPost<LoginResponse>("/api/crew-app/auth/login", body, loginResponseSchema);
  },

  async beginMfa(): Promise<{ secret: string; uri: string }> {
    const res = await apiFetch("/api/crew-app/auth/mfa/enroll", { method: "POST", body: "{}" });
    return parseOrThrow(res, "Unable to begin MFA enrollment", z.object({ secret: z.string(), uri: z.string() }));
  },

  async confirmMfa(code: string): Promise<{ recoveryCodes: string[] }> {
    const res = await apiFetch("/api/crew-app/auth/mfa/confirm", { method: "POST", body: JSON.stringify({ code }) });
    return parseOrThrow(res, "Unable to confirm MFA enrollment", z.object({ recoveryCodes: z.array(z.string()) }));
  },

  async logout(body: { refreshToken?: string; allDevices?: boolean }): Promise<void> {
    // Best-effort — the caller clears local tokens regardless of the outcome.
    await apiFetch("/api/crew-app/auth/logout", { method: "POST", body: JSON.stringify(body) }).catch(() => {});
  },

  async setPassword(body: { currentPassword: string; newPassword: string }): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await apiFetch("/api/crew-app/auth/set-password", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return parseOrThrow(res, "Failed to set password", z.object({ success: z.boolean(), accessToken: z.string(), refreshToken: z.string() }));
  },
};
