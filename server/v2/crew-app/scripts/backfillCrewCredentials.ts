/**
 * One-off backfill: create app_crew_credentials rows for existing crew_members_v2
 * rows in a tenant that don't have a mobile-app credential yet.
 *
 * Uses emp_no as the login identifier and a random temporary password
 * (must_reset_password: true forces the app's first-login reset screen).
 * Idempotent — only inserts rows that don't already exist.
 *
 * Usage:
 *   npx tsx server/v2/crew-app/scripts/backfillCrewCredentials.ts --domain=<domain> [--dry-run] [--verbose] [--limit=N]
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { tenantConnectionManager } from "../../../utils/tenantConnectionManager";
import { runInCrewAppTenant } from "../tenantContext";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { appCrewCredentials } from "../../../../shared/v2/crew-app/schema";

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes("--dry-run");
const VERBOSE = ARGS.includes("--verbose") || ARGS.includes("-v");
const DOMAIN = ARGS.find((a) => a.startsWith("--domain="))?.split("=")[1];
const LIMIT_RAW = ARGS.find((a) => a.startsWith("--limit="))?.split("=")[1];
const LIMIT = LIMIT_RAW ? parseInt(LIMIT_RAW, 10) : undefined;

const BCRYPT_SALT_ROUNDS = 12;
const TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateTempPassword(length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_CHARS[bytes[i] % TEMP_PASSWORD_CHARS.length];
  }
  return out;
}

async function run() {
  if (!DOMAIN) {
    console.error("Usage: npx tsx server/v2/crew-app/scripts/backfillCrewCredentials.ts --domain=<domain> [--dry-run] [--verbose]");
    process.exit(1);
  }

  await tenantConnectionManager.init();
  await runInCrewAppTenant(DOMAIN!, async () => {
      const db = getDb();

      const crewRows = await db
        .select()
        .from(crewMembersV2)
        .where(eq(crewMembersV2.isDeleted, false));

      const existingCredentials = await db
        .select({ crewUuid: appCrewCredentials.crewUuid })
        .from(appCrewCredentials)
        .where(eq(appCrewCredentials.domain, DOMAIN!));
      const existingCrewUuids = new Set(existingCredentials.map((r: { crewUuid: string }) => r.crewUuid));

      const allMissing = crewRows.filter((c: { crewUuid: string }) => !existingCrewUuids.has(c.crewUuid));
      const missing = LIMIT !== undefined ? allMissing.slice(0, LIMIT) : allMissing;

      console.log(`Domain: ${DOMAIN}`);
      console.log(`Active crew members: ${crewRows.length}`);
      console.log(`Already have app credentials: ${existingCrewUuids.size}`);
      console.log(
        `To backfill: ${missing.length} of ${allMissing.length} missing${LIMIT !== undefined ? ` (--limit=${LIMIT})` : ""}${DRY_RUN ? " (dry run — no writes)" : ""}`,
      );

      let created = 0;
      for (const crew of missing) {
        const tempPassword = generateTempPassword();

        if (VERBOSE) {
          // Sensitive one-time output — this is the only place the plaintext temp
          // password is ever visible. Do not run --verbose against stdout that gets
          // logged/retained in a production environment.
          console.log(`  ${crew.crewUuid} (${crew.empNo ?? "no empNo"}): temp password = ${tempPassword}`);
        }

        if (!DRY_RUN) {
          const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_SALT_ROUNDS);
          await db.insert(appCrewCredentials).values({
            credentialUuid: uuidv4(),
            crewUuid: crew.crewUuid,
            domain: DOMAIN!,
            empNo: crew.empNo,
            passwordHash,
            mustResetPassword: true,
          });
        }
        created++;
      }

      console.log(`${DRY_RUN ? "Would create" : "Created"} ${created} app_crew_credentials row(s).`);
    });

  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
