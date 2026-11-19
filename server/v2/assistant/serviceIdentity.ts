/**
 * Verification side of the assistant identity token (stage 2 live data, PILOT TRIAL).
 *
 * The central assistant forwards, unmodified, the token this server minted at GET /api/v2/assistant/token
 * (assistantIdentityToken.ts), together with the shared service secret. Same wire format and rules as the
 * Technical module (server/modules/assistant-api/identityToken.ts in the Technical repo):
 *   token = b64url(JSON payload) + "." + b64url(HMAC-SHA256(payloadB64, key)), clock leeway 90 s both ways.
 */
import { createHmac, timingSafeEqual } from "crypto";

const CLOCK_LEEWAY_SEC = parseInt(process.env.IDENTITY_CLOCK_LEEWAY_SEC || "90", 10);

export interface VerifiedIdentity {
  userId: string;
  role: string;
  userType: string;
  iss: string;
  tenantDomain: string | null;
  tuid: string | null;
  iat?: number;
  exp?: number;
}

export type IdentityCheck =
  | { ok: true; identity: VerifiedIdentity }
  | { ok: false; reason: "missing" | "malformed" | "bad-signature" | "expired" | "future-dated" | "wrong-issuer" };

export function serviceSecretMatches(given: unknown): boolean {
  const expected = (process.env.ASSISTANT_SERVICE_SECRET || "").trim();
  if (!expected || typeof given !== "string" || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyAssistantIdentity(token: unknown, key: string, instanceId: string): IdentityCheck {
  if (!token || typeof token !== "string" || !key) return { ok: false, reason: "missing" };
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "malformed" };
  const body = token.slice(0, dot);
  const expected = createHmac("sha256", key).update(body).digest();
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad-signature" };
  }
  let identity: VerifiedIdentity;
  try {
    identity = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (!identity.exp || identity.exp + CLOCK_LEEWAY_SEC < now) return { ok: false, reason: "expired" };
  if (identity.iat && identity.iat - CLOCK_LEEWAY_SEC > now) return { ok: false, reason: "future-dated" };
  if (!identity.userId || !identity.role || !identity.userType) return { ok: false, reason: "malformed" };
  if (!instanceId || identity.iss !== instanceId) return { ok: false, reason: "wrong-issuer" };
  return { ok: true, identity };
}
