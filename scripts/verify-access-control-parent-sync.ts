// Development fixture harness, not a parent integration or an alternate app server.
// Exercise the production transition transaction against ONLY test-owned role UUIDs.
import { sql } from "drizzle-orm";
import { getDb } from "../server/v2/db";
import { parentSyncActor, roleSyncTransition } from "../server/v2/admin/services/accessControlParentSync";
import { readFile } from "node:fs/promises";
import type { Request } from "express";

if (process.env.NODE_ENV === "production" || process.env.AUTH_BYPASS !== "true")
  throw Error("Development-only fixture harness requires the existing dev authentication bypass.");
const fixture = JSON.parse(await readFile(".local/verification/access-control-management/fixture.json", "utf8"));
const db = getDb();
const actor = await parentSyncActor({ user: { id: fixture.support.id, userType: fixture.support.userType } } as Request,
  "development-fixture-harness");
const role = (await db.execute(sql`SELECT ruid,assigned_role FROM adm_rolemaster_ac WHERE ruid=${fixture.ordinary.roleUuid}`)).rows[0];
if (!role?.assigned_role.startsWith("TEST ONLY AC MANAGER ")) throw Error("Refuse to mutate a non-test-owned role.");
await roleSyncTransition(db, actor, async tx => {
  await tx.execute(sql`UPDATE adm_rolemaster_ac SET is_active=false WHERE ruid=${fixture.ordinary.roleUuid}`);
});
console.log("Production parent-sync transition exercised: test-only manager deactivated; retained decision and recovery event committed.");
process.exit(0);
