/**
 * One-off: promote an existing crew-app credential to the Admin role
 * (app_crew_credentials.user_type = 'Admin'). This is the only way to mint
 * an Admin — there is no in-app "promote another user" flow, deliberately
 * (rare, high-privilege operation; see the Phase 2 plan for the reasoning).
 *
 * Usage:
 *   npx tsx server/v2/crew-app/scripts/promoteCrewAdmin.ts --domain=<domain> --identifier=<empNo|mobile|email> [--dry-run]
 */
import "dotenv/config";
import { tenantConnectionManager } from "../../../utils/tenantConnectionManager";
import { CrewCredentialsRepository } from "../auth/repositories";

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes("--dry-run");
const DOMAIN = ARGS.find((a) => a.startsWith("--domain="))?.split("=")[1];
const IDENTIFIER = ARGS.find((a) => a.startsWith("--identifier="))?.split("=")[1];

async function run() {
  if (!DOMAIN || !IDENTIFIER) {
    console.error(
      "Usage: npx tsx server/v2/crew-app/scripts/promoteCrewAdmin.ts --domain=<domain> --identifier=<empNo|mobile|email> [--dry-run]",
    );
    process.exit(1);
  }

  await tenantConnectionManager.init();
  const { tuid } = await tenantConnectionManager.resolveTenant(DOMAIN!);

  await tenantConnectionManager.runInTenantContext(
    tuid,
    async () => {
      const repo = new CrewCredentialsRepository();
      const credential = await repo.findByIdentifierAndDomain(IDENTIFIER!, DOMAIN!);

      if (!credential) {
        console.error(`No app_crew_credentials row found for identifier "${IDENTIFIER}" in domain "${DOMAIN}".`);
        process.exitCode = 1;
        return;
      }

      if (credential.userType === "Admin") {
        console.log(`${IDENTIFIER} (${credential.crewUuid}) is already an Admin. No change.`);
        return;
      }

      console.log(
        `${DRY_RUN ? "Would promote" : "Promoting"} ${IDENTIFIER} (${credential.crewUuid}, currently "${credential.userType}") to Admin in domain "${DOMAIN}".`,
      );

      if (!DRY_RUN) {
        await repo.setUserType(credential.id, "Admin");
        console.log("Done.");
      }
    },
    DOMAIN,
  );

  process.exit(0);
}

run().catch((err) => {
  console.error("promoteCrewAdmin failed:", err);
  process.exit(1);
});
