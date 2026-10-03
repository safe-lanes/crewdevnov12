import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ERP worker mutation boundary", () => {
  const root = process.cwd();
  const worker = readFileSync(resolve(root, "server/v2/crew-app/erp-commands/worker.ts"), "utf8");
  const registry = readFileSync(resolve(root, "server/v2/crew-app/erp-commands/handlerRegistry.ts"), "utf8");
  const lease = readFileSync(resolve(root, "server/v2/crew-app/erp-commands/commandRepository.ts"), "utf8");

  it("does not call the generic pending mutation function", () => {
    expect(worker).not.toContain("applyPendingChange");
    expect(registry).not.toMatch(/\.create\(/);
    expect(registry).not.toContain("removeRecordAndAttachments");
    expect(registry).not.toContain("syncVesselTypes");
  });

  it("uses a server-owned allowlist before resolving a handler", () => {
    expect(registry).toContain("if (!policy.automated) return undefined");
    expect(worker).toContain("if (!policy.automated)");
  });

  it("leases atomically with row locks and recovers ambiguous expired work into verification", () => {
    expect(lease).toContain("FOR UPDATE SKIP LOCKED");
    expect(lease).toContain("status IN ('applying','verifying')");
    expect(lease).toContain("THEN 'verifying'");
  });

  it("requires authoritative read-back before APPLIED", () => {
    expect(worker).toContain("handler.loadAuthoritativeState");
    expect(worker).toContain("handler.reconcile");
    expect(worker).not.toMatch(/execute[\s\S]{0,200}transition\(command, "applied"/);
  });
});
