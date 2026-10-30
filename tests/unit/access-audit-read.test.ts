import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@server/v2/db", () => ({ getDb: () => ({ execute }) }));
import { readAccessAuditPage } from "@server/v2/admin/services/accessAuditRead";
const request = (query: Record<string, string>) => ({ query }) as unknown as Request;
const rows = Array.from({ length: 251 }, (_, i) => ({
  id: String(251 - i), event: "grant_change", actor: { roleName: "Admin", masterUserId: 24 },
  role_name: "Office", recorded_at: "2026-10-20T03:58:00Z", resource: "company_forms",
  action: i === 250 ? "void_completed" : "witness", before_value: false, after_value: true,
}));
beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValueOnce({ rows: rows.slice(0, 250) }).mockResolvedValueOnce({ rows: rows.slice(250) });
});
describe("read-only audit pagination and sentence search", () => {
  it("does not construct Intl formatters per row during a complete sentence search", async () => {
    const constructor = vi.spyOn(Intl, "DateTimeFormat");
    try {
      const result = await readAccessAuditPage(request({ page: "1", search: "witness" }));
      expect(result.total).toBe(250);
      expect(result.items).toHaveLength(20);
      expect(constructor).not.toHaveBeenCalled();
    } finally { constructor.mockRestore(); }
  });
  it("returns twenty rows and an exact total, scanning bounded batches", async () => {
    const result = await readAccessAuditPage(request({ page: "2" }));
    expect(result.items).toHaveLength(20);
    expect(result.items[0].id).toBe("231");
    expect(result.total).toBe(251);
    expect(result.pageSize).toBe(20);
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it("searches resolved sentences beyond the first batch, case-insensitively", async () => {
    const result = await readAccessAuditPage(request({ page: "1", search: "VOID COMPLETED" }));
    expect(result.total).toBe(1);
    expect(result.items[0].sentence).toContain("Void completed");
  });
  it("exports every matching entry, not just the visible page or first batch", async () => {
    const result = await readAccessAuditPage(request({ page: "2", export: "all" }));
    expect(result.total).toBe(251);
    expect(result.items).toHaveLength(251);
    expect(result.items.at(-1)?.id).toBe("1");
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it("applies the same sentence search to exports", async () => {
    const result = await readAccessAuditPage(request({ page: "1", export: "all", search: "void completed" }));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].action).toBe("void_completed");
  });
  it("returns an empty export when no sentences match", async () => {
    const result = await readAccessAuditPage(request({ page: "1", export: "all", search: "unmatched phrase" }));
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
  it.each([{ page: "0" }, { page: "1", pageSize: "51" }, { page: "1", from: "2026-02-30" },
    { page: "1", from: "2026-10-23", to: "2026-10-20" }])("refuses invalid filters %j", async query => {
    await expect(readAccessAuditPage(request(query))).rejects.toMatchObject({ status: 400 });
    expect(execute).not.toHaveBeenCalled();
  });
});
