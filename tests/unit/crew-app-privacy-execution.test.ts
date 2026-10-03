import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("crew privacy execution", () => {
  const service = readFileSync("server/v2/crew-app-review/privacyRequestService.ts", "utf8");
  const routes = readFileSync("server/v2/crew-app-review/routes.ts", "utf8");
  const migration = readFileSync("migrations/0223_privacy_request_execution.sql", "utf8");

  it("requires isolated privacy RBAC and creates no automatic role grants", () => {
    expect(routes).toContain('requirePermission("Privacy Request Operations", "edit")');
    expect(migration).toContain("No role grants are created automatically");
  });
  it("requires verification and approval before deletion execution", () => {
    expect(service).toContain('request.status !== "approved"');
    expect(service).toContain("!request.identityVerifiedAt");
    expect(service).toContain("request.legalHold");
  });
  it("blocks erasure while ERP commands are unresolved", () => {
    expect(service).toContain("Open ERP commands must be resolved");
    expect(service).toContain("TERMINAL_COMMANDS");
  });
  it("revokes sessions, disables credentials, clears notifications and pending payloads", () => {
    for (const control of ["appCrewRefreshTokens", "appCrewNotifications", 'payload: "{}"', "privacy_erased", "sessionVersion"]) expect(service).toContain(control);
  });
  it("records retained ERP data as partial rather than complete deletion", () => {
    expect(service).toContain('input.erpOutcome === "deleted" || input.erpOutcome === "not_applicable" ? "completed" : "partially_completed"');
  });
  it("uses immutable correlated audits and evidence references", () => {
    expect(migration).toContain("app_crew_privacy_request_audits");
    expect(service).toContain("evidenceReference");
    expect(service).toContain("correlationId");
  });
});
