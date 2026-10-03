import { tenantConnectionManager } from "../../../utils/tenantConnectionManager";
import { runErpCommandWorkerOnce } from "../erp-commands/worker";

async function main() {
  await tenantConnectionManager.init();
  const processed = await runErpCommandWorkerOnce();
  console.info(`[crew-erp-worker] completed one drain pass; processed=${processed}`);
}

main().catch(error => {
  console.error("[crew-erp-worker] fatal", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
