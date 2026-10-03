import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveInsideCurrentTenantRoot } from "@server/v2/shared/fileStorageService";
import { tenantConnectionManager } from "@server/utils/tenantConnectionManager";

function inTenant<T>(domain: string, fn: () => T): T {
  return tenantConnectionManager.tenantStorage.run({ db: {} as any, tenantId: domain, domain }, fn);
}

describe("crew-app tenant-bound file paths", () => {
  it("accepts only a path below the authenticated tenant root", () => {
    const resolved = inTenant("tenant-a.example", () => resolveInsideCurrentTenantRoot("tenant-a_example/crew-pool/documents/file.pdf"));
    expect(resolved).toContain(path.join(".private", "tenant-a_example", "crew-pool", "documents", "file.pdf"));
  });

  it("denies metadata pointing at another tenant file", () => {
    expect(() => inTenant("tenant-a.example", () => resolveInsideCurrentTenantRoot("tenant-b_example/crew-pool/documents/file.pdf")))
      .toThrow(/outside the authenticated tenant root/);
  });

  it.each(["../tenant-b/file.pdf", "tenant-a_example/../../tenant-b/file.pdf", "C:/tenant-b/file.pdf"])("denies traversal or absolute path %s", value => {
    expect(() => inTenant("tenant-a.example", () => resolveInsideCurrentTenantRoot(value))).toThrow(/Access Denied/);
  });
});
