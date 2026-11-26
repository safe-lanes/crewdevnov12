// Which sync instance this server is (SYN-01). Stamped on every field log.
//
// Precedence, same as Technical's field logger:
//   1. sync_settings.instance_id in the database
//   2. env SYNC_INSTANCE_ID
//   3. neither: throw. A log is never stamped with a placeholder, because the
//      engine reads only its own instance id and would never send it.
// Resolved once and cached; the sink runs on every write.

import { sql } from "drizzle-orm";

const PLACEHOLDERS = new Set(["UNKNOWN", "SHIP-VESSELNAME", "CHANGEME"]);

let cached: string | null = null;

type Queryable = { execute: (q: any) => Promise<any> };

async function readDbInstanceId(db: Queryable): Promise<string> {
  try {
    const res = await db.execute(sql`SELECT value FROM sync_settings WHERE key = 'instance_id'`);
    const rows = (res as any)?.rows ?? res;
    return String(rows?.[0]?.value ?? "").trim();
  } catch {
    return ""; // table missing or DB unavailable: fall back to env
  }
}

export async function getEffectiveInstanceId(db: Queryable): Promise<string> {
  if (cached) return cached;
  const dbId = await readDbInstanceId(db);
  const envId = (process.env.SYNC_INSTANCE_ID || "").trim();
  const resolved = dbId || envId;
  if (!resolved || PLACEHOLDERS.has(resolved.toUpperCase())) {
    throw new Error(
      `Sync instance id is ${resolved ? `a placeholder ('${resolved}')` : "NOT configured"}. ` +
        "Set sync_settings.instance_id or the SYNC_INSTANCE_ID env var to a real id " +
        "(for example SHIP-GASMIA or OFFICE-HQ).",
    );
  }
  if (dbId && envId && dbId !== envId) {
    console.warn(
      `[Sync] DB sync_settings.instance_id ('${dbId}') and env SYNC_INSTANCE_ID ('${envId}') differ; the DB value is used.`,
    );
  }
  cached = resolved;
  return resolved;
}

export function isShipInstance(instanceId: string): boolean {
  return instanceId.toUpperCase().startsWith("SHIP-");
}

// For tests.
export function resetInstanceIdCache(): void {
  cached = null;
}
