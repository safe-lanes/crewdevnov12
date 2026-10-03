import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runbook = readFileSync("docs/security/crew-mobile-incident-response-runbooks.md", "utf8");

describe("crew mobile incident runbook", () => {
  it.each([
    "Stolen phone", "Stolen access or refresh token", "Compromised crew or office account",
    "Exposed passport, medical record, or other crew document", "Cross-tenant exposure",
    "Malicious or compromised administrator", "BFF database compromise",
    "Mobile application vulnerability", "Supplier or SDK compromise",
  ])("covers %s", scenario => expect(runbook).toContain(scenario));

  it.each(["Detection", "Containment", "Revocation", "Investigation and evidence", "Escalation", "Recovery", "Post-incident review"])(
    "defines %s for every scenario",
    heading => expect(runbook.match(new RegExp(`\\*\\*${heading}(?: and evidence)?:\\*\\*`, "g"))).toHaveLength(9),
  );

  it("preserves the frozen ERP boundary and avoids invented contacts", () => {
    expect(runbook).toContain("frozen dependency");
    expect(runbook).toContain("[ERP_OWNER]");
    expect(runbook).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  });
});
