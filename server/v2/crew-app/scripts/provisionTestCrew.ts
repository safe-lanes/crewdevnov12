/**
 * Creates or resets one clearly labeled crew-app account for development.
 * Plaintext is printed exactly once and is never stored.
 *
 * Usage:
 *   npm run crew-app:provision-test -- --domain=local --confirm-development
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { and, eq, isNull } from "drizzle-orm";
import { tenantConnectionManager } from "../../../utils/tenantConnectionManager";
import { runInCrewAppTenant } from "../tenantContext";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { appCrewCredentials, appCrewRefreshTokens } from "../../../../shared/v2/crew-app/schema";

const args = process.argv.slice(2);
const domain = args.find((arg) => arg.startsWith("--domain="))?.slice("--domain=".length);
const confirmed = args.includes("--confirm-development");
const provisioningGate = process.env.CREW_APP_ALLOW_TEST_PROVISIONING;
const empNo = "REPLIT TEST";
const passwordChars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generatePassword(length = 14): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => passwordChars[byte % passwordChars.length]).join("");
}

async function run() {
  if (
    process.env.NODE_ENV === "production" ||
    !confirmed ||
    provisioningGate !== "I_UNDERSTAND_THIS_RESETS_A_PASSWORD"
  ) {
    throw new Error(
      "Test provisioning requires NODE_ENV=development, --confirm-development, and the explicit CREW_APP_ALLOW_TEST_PROVISIONING safety gate",
    );
  }
  if (!domain) {
    throw new Error("Usage: npm run crew-app:provision-test -- --domain=<domain> --confirm-development");
  }

  await tenantConnectionManager.init();
  await runInCrewAppTenant(domain, async () => {
    const db = getDb();
    let crew = (
      await db.select().from(crewMembersV2).where(eq(crewMembersV2.empNo, empNo)).limit(1)
    )[0];

    if (!crew) {
      const inserted = await db
        .insert(crewMembersV2)
        .values({
          crewUuid: uuidv4(),
          empNo,
          firstName: "Replit",
          familyName: "Tester",
          status: "Development Test",
        })
        .returning();
      crew = inserted[0];
    }

    const temporaryPassword = generatePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const existing = (
      await db
        .select()
        .from(appCrewCredentials)
        .where(eq(appCrewCredentials.crewUuid, crew.crewUuid))
        .limit(1)
    )[0];

    if (existing) {
      await db.transaction(async (tx: any) => {
        await tx
          .update(appCrewCredentials)
          .set({
            domain,
            empNo,
            passwordHash,
            isActive: true,
            mustResetPassword: true,
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(appCrewCredentials.id, existing.id));
        await tx
          .update(appCrewRefreshTokens)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(appCrewRefreshTokens.crewCredentialId, existing.id),
              isNull(appCrewRefreshTokens.revokedAt),
            ),
          );
      });
    } else {
      await db.insert(appCrewCredentials).values({
        credentialUuid: uuidv4(),
        crewUuid: crew.crewUuid,
        domain,
        empNo,
        passwordHash,
        mustResetPassword: true,
      });
    }

    console.log("Development crew-app credential created.");
    console.log(`Domain: ${domain}`);
    console.log(`Employee number: ${empNo}`);
    console.log(`Temporary password (shown once): ${temporaryPassword}`);
  });
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });