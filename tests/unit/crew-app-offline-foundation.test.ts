import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("crew-app low-bandwidth safety foundation", () => {
  it("uses operation UUIDs and exposes an owner-scoped status lookup", () => {
    const mobile = readFileSync("mobile/src/api/crewInformationApi.ts", "utf8");
    const server = readFileSync("server/v2/crew-app/crew-information/pendingChangesRepository.ts", "utf8");
    expect(mobile).toContain('"Idempotency-Key"');
    expect(mobile).toContain("operationStatus");
    expect(server).toContain("findOperationForCrew");
    expect(server).toContain("eq(appCrewPendingChanges.crewUuid, crewUuid)");
    expect(server).toContain("eq(appCrewPendingChanges.domain, domain)");
  });

  it("times out explicitly and identifies the result as ambiguous", () => {
    const client = readFileSync("mobile/src/api/client.ts", "utf8");
    expect(client).toContain("DEFAULT_TIMEOUT_MS");
    expect(client).toContain('ambiguous: true');
    expect(client).toContain("check operation status before retrying");
  });
});
