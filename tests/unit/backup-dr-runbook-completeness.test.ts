import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const design = readFileSync("docs/security/crew-mobile-backup-disaster-recovery.md", "utf8");

describe("crew mobile backup and DR design", () => {
  it.each([
    "app_crew_credentials", "app_crew_refresh_tokens", "app_crew_pending_changes",
    "app_crew_pending_reviews", "app_crew_erp_commands", "app_crew_privacy_requests",
    "Private attachments and quarantine", "PITR", "KMS", "immutability",
    "Tenant-level restore", "ERP reconciliation",
  ])("covers %s", item => expect(design).toContain(item));

  it("does not invent current recovery commitments or ERP coverage", () => {
    expect(design).toContain("Current approved RPO: **NOT DEFINED**");
    expect(design).toContain("Current approved RTO: **NOT DEFINED**");
    expect(design).toContain("ERP backup, point-in-time recovery, high availability, and restore capability are **NOT VERIFIED**");
    expect(design).toContain("planning options, not current commitments");
  });

  it.each([
    "Authorization and preparation", "Validate recovery material", "Restore database and files",
    "Integrity and tenant validation", "ERP reconciliation", "Functional recovery checks", "Measure and close",
  ])("defines restore step: %s", step => expect(design).toContain(step));
});
