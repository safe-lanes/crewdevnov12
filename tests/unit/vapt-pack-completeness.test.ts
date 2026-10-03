import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { createManifest } from "../../scripts/create-vapt-evidence-manifest.mjs";

const read = (name: string) => fs.readFileSync(`docs/security/${name}`, "utf8");

describe("independent VAPT preparation pack", () => {
  it("requires explicit written authorization, staging scope and stop conditions", () => {
    const roe = read("vapt-rules-of-engagement-template.md");
    for (const term of ["not authorization", "Two isolated staging tenants", "Excluded unless separately approved", "Stop and notify", "Signatures"]) expect(roe).toContain(term);
    expect(roe).toContain("Production systems or real crew/client data");
  });

  it("covers mobile, API, tenant, MFA, file, privacy, offline and ERP risks", () => {
    const matrix = read("vapt-test-matrix.md");
    for (let id = 1; id <= 20; id += 1) expect(matrix).toContain(`VAPT-${String(id).padStart(2, "0")}`);
    for (const term of ["BOLA", "MFA", "Tenant isolation", "Uploads/files", "Offline outbox", "Approval/ERP", "Privacy", "Resilience"]) expect(matrix).toContain(term);
  });

  it("does not represent preparation artifacts as completed independent testing", () => {
    const closure = read("vapt-evidence-and-closure.md");
    expect(closure).toContain("becomes release evidence only when completed and signed");
    expect(closure).toContain("Zero open critical or high findings");
    expect(closure).toContain("independently retested");
  });

  it("binds evidence to SHA-256 hashes and a source commit", () => {
    const manifest = createManifest(["mobile/app.json"], { assessmentId: "VAPT-TEST", sourceCommit: "a".repeat(40) });
    expect(manifest.assessmentId).toBe("VAPT-TEST");
    expect(manifest.sourceCommit).toBe("a".repeat(40));
    expect(manifest.files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.files[0].name).toBe("app.json");
  });
});
