import type { Request } from "express";
import { resolveRequestRole } from "../../auth/roleResolutionService";
import { signAssistantIdentity } from "../assistantIdentityToken";

/**
 * Mints the short-lived identity token the shared chat widget sends to the central assistant.
 *
 * Identity comes ONLY from the verified login (req.user, set by authMiddleware after jwt.verify) and the
 * server-side role lookup (resolveRequestRole: master_users -> adm_rolemaster_ac). Browser headers, the
 * userProfile and any client-supplied role are never read. Every refusal fails closed.
 *
 * Stage 1 policy (Ghazi, 19-Oct-2026): Office-type users whose resolved role is in ASSISTANT_ALLOWED_ROLES
 * (default "Sail Admin") only. Ship-type users and unresolved roles are refused.
 */
export type MintResult =
  | { ok: true; token: string; expiresInSec: number }
  | { ok: false; status: number; error: string; message: string };

const TTL_SEC = 60;

export function allowedRoles(): string[] {
  return (process.env.ASSISTANT_ALLOWED_ROLES || "Sail Admin")
    .split(",")
    .map((r) => r.trim().toLocaleLowerCase())
    .filter(Boolean);
}

export async function mintAssistantToken(req: Request): Promise<MintResult> {
  const instanceId = (process.env.ASSISTANT_INSTANCE_ID || "").trim();
  const signingKey = (process.env.ASSISTANT_IDENTITY_SIGNING_KEY || "").trim();
  if (!instanceId || !signingKey) {
    return { ok: false, status: 503, error: "assistant_not_configured", message: "The assistant is not configured for this installation" };
  }

  const user = req.user;
  if (!user || user.id === undefined || user.id === null || !String(user.id).trim()) {
    return { ok: false, status: 401, error: "unauthorized", message: "Missing verified login" };
  }

  if ((user.userType || "").trim().toLocaleLowerCase() !== "office") {
    return { ok: false, status: 403, error: "user_type_not_allowed", message: "The assistant is available to office users only" };
  }

  const resolution = await resolveRequestRole(req);
  if (!resolution.ok) {
    return { ok: false, status: 403, error: "role_unresolved", message: `Role could not be resolved (${resolution.reason})` };
  }
  if (!allowedRoles().includes(resolution.role.roleName.trim().toLocaleLowerCase())) {
    return { ok: false, status: 403, error: "role_not_allowed", message: "Your role is not allowed to use the assistant" };
  }

  const token = signAssistantIdentity(
    {
      userId: String(user.id),
      role: resolution.role.roleName.trim(),
      userType: "Office",
      iss: instanceId,
      tenantDomain: typeof user.domain === "string" && user.domain.trim() ? user.domain.trim() : null,
      tuid: req.tenantId ?? null,
    },
    signingKey,
    TTL_SEC,
  );
  return { ok: true, token, expiresInSec: TTL_SEC };
}
