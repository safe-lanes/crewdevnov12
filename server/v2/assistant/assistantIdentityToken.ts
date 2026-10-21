/**
 * Signed identity token for the central SAIL assistant (shared chat widget).
 *
 * Same wire format as the Technical module and the assistant (docs/ASSISTANT-API.md in the Technical repo):
 *   token = b64url(JSON payload) + "." + b64url(HMAC-SHA256(payloadB64, key))
 * The assistant verifies it with the key registered for `iss` (ASSISTANT_INSTANCE_ID, e.g. "crewing-dev").
 * The key never leaves this server.
 */
import { createHmac } from "crypto";

export interface AssistantIdentity {
  userId: string;
  role: string;
  userType: "Office";
  iss: string;
  tenantDomain: string | null;
  tuid: string | null;
  vesselId?: string | null;
}

export function signAssistantIdentity(identity: AssistantIdentity, key: string, ttlSec = 60): string {
  if (!key) throw new Error("signing key required");
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...identity, iat: now, exp: now + ttlSec })).toString("base64url");
  const mac = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${mac}`;
}
