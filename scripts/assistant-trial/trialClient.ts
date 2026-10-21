/**
 * PILOT TRIAL helper: mint signed identities and call the live-data endpoints DIRECTLY (no assistant, no widget).
 * Secrets come from a local-only env file (TRIAL_SECRETS_FILE) and are never printed.
 */
import { readFileSync } from "fs";
import { signAssistantIdentity, type AssistantIdentity } from "../../server/v2/assistant/assistantIdentityToken";

export const TRIAL_SECRETS_FILE = process.env.TRIAL_SECRETS_FILE || "C:/Users/GhaziAnwer/local-only/crewing-livedata-trial.env";

export function secrets(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(TRIAL_SECRETS_FILE, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

export interface Target {
  base: string; // e.g. http://127.0.0.1:6101/api/v2
  iss: string;
  key: string;
  secret: string;
}

export function targets() {
  const s = secrets();
  return {
    single: { base: "http://127.0.0.1:6100/api/v2", iss: "crewing-pilot", key: s.PILOT_SIGNING_KEY, secret: s.PILOT_SERVICE_SECRET } as Target,
    mt: { base: "http://127.0.0.1:6101/api/v2", iss: "crewing-pilotmt", key: s.PILOTMT_SIGNING_KEY, secret: s.PILOTMT_SERVICE_SECRET } as Target,
  };
}

export type Who = Partial<AssistantIdentity> & { ttlSec?: number };

export function mint(t: Target, who: Who = {}): string {
  const { ttlSec, ...rest } = who;
  return signAssistantIdentity(
    { userId: "1", role: "Sail Admin", userType: "Office", iss: t.iss, tenantDomain: null, tuid: null, ...rest } as AssistantIdentity,
    t.key,
    ttlSec ?? 60,
  );
}

export async function call(t: Target, tool: string, args: unknown, opts: { token?: string | null; secret?: string | null; who?: Who } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = opts.secret === undefined ? t.secret : opts.secret;
  if (secret !== null) headers["x-service-secret"] = secret;
  const token = opts.token === undefined ? mint(t, opts.who) : opts.token;
  if (token !== null) headers["x-assistant-identity"] = token;
  const started = Date.now();
  const r = await fetch(`${t.base}/assistant/execute`, { method: "POST", headers, body: JSON.stringify({ tool, args, requestId: "trial" }) });
  const text = await r.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  // authenticated responses are {ok:true, data}; tests read the data (raw kept for envelope checks)
  const raw = body as Record<string, any>;
  const inner = raw && typeof raw === "object" && raw.ok === true && "data" in raw ? raw.data : raw;
  return { status: r.status, body: inner as Record<string, any>, raw, ms: Date.now() - started };
}

export async function manifest(t: Target, secret: string | null = t.secret) {
  const r = await fetch(`${t.base}/assistant/manifest`, { headers: secret ? { "x-service-secret": secret } : {} });
  return { status: r.status, body: (await r.json().catch(() => null)) as Record<string, any> | null };
}
