import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("crew privacy request foundation", () => {
  it("scopes requests to authenticated tenant and crew", () => {
    const routes = readFileSync("server/v2/crew-app/privacy/routes.ts", "utf8");
    expect(routes).toContain("req.crewUser!.domain"); expect(routes).toContain("req.crewUser!.crewUuid");
    expect(routes).toContain("requireCurrentCrew");
  });
  it("does not claim deletion on submission", () => {
    const routes = readFileSync("server/v2/crew-app/privacy/routes.ts", "utf8");
    expect(routes).toContain("does not mean ERP records have been deleted or changed");
  });
  it("supports legal hold and partial completion without invented retention periods", () => {
    const migration = readFileSync("migrations/0220_mobile_privacy_requests.sql", "utf8");
    expect(migration).toContain("partially_completed"); expect(migration).toContain("legal_hold");
  });
});
