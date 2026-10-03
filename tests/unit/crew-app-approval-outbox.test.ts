import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("crew-app approval outbox security contract", () => {
  it("does not mutate authoritative records in the approval request", () => {
    const service = readFileSync("server/v2/crew-app/crew-information/pendingChangesService.ts", "utf8");
    const approval = service.slice(service.indexOf("export async function approveChange"), service.indexOf("export async function rejectChange"));
    expect(approval).toContain("approveAndEnqueue");
    expect(approval).not.toContain("applyPendingChange(");
  });

  it("claims pending state and writes review plus command in one transaction", () => {
    const repository = readFileSync("server/v2/crew-app/crew-information/pendingChangesRepository.ts", "utf8");
    const approval = repository.slice(repository.indexOf("async approveAndEnqueue"), repository.indexOf("async findByUuid"));
    expect(approval).toContain("transaction(async");
    expect(approval).toContain('eq(appCrewPendingChanges.status, "pending")');
    expect(approval).toContain("appCrewPendingReviews");
    expect(approval).toContain("appCrewErpCommands");
  });

  it("adds database uniqueness for operation and one command per pending change", () => {
    const migration = readFileSync("migrations/0218_mobile_approval_outbox.sql", "utf8");
    expect(migration).toContain("app_crew_pending_tenant_crew_operation_uq");
    expect(migration).toMatch(/pending_uuid text NOT NULL UNIQUE/);
    expect(migration).toContain("FOREIGN KEY (pending_uuid)");
  });
});
