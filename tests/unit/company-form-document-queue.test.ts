import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const state = vi.hoisted(() => ({
  multi: false,
  execute: vi.fn(async (_query: any) => ({ rows: [] })),
  tenants: vi.fn(async () => ["tenant-one", "tenant-two"]),
  context: vi.fn(async (_tenant: string, callback: () => Promise<unknown>) => callback()),
}));
vi.mock("../../server/v2/db", () => ({ getDb: () => ({ execute: state.execute }) }));
vi.mock("../../server/utils/tenantConnectionManager", () => ({
  tenantConnectionManager: {
    get isMultiTenantEnabled() { return state.multi; },
    getActiveTenants: state.tenants,
    runInTenantContext: state.context,
  },
}));
import { createDocumentPreparationQueue, REAL_FORM_PDF_GENERATION_ENABLED } from "../../server/v2/company-forms/documentArchive";

beforeEach(() => { state.multi = false; vi.clearAllMocks(); });
describe("server-controlled document preparation queue", () => {
  it("retains the registered-sample restriction under an explicitly disabled policy", async () => {
    await createDocumentPreparationQueue(() => false).drainTenants();
    const query = new PgDialect().sqlToQuery(state.execute.mock.calls[0][0]);
    expect(query.params).toContain(false);
    expect(query.sql).toContain("frm_document_samples");
    expect(query.sql).toContain("LIMIT 10");
  });
  it("enables the approved default rollout for real forms", async () => {
    expect(REAL_FORM_PDF_GENERATION_ENABLED).toBe(true);
    await createDocumentPreparationQueue().drainTenants();
    expect(new PgDialect().sqlToQuery(state.execute.mock.calls[0][0]).params).toEqual([true]);
  });
  it("selects all pending missing-file requests when enabled, with no sample-only join", async () => {
    await createDocumentPreparationQueue(() => true).drainTenants();
    const query = new PgDialect().sqlToQuery(state.execute.mock.calls[0][0]);
    expect(query.params).toEqual([true]);
    expect(query.sql).toContain("FROM frm_document_preparation_requests r");
    expect(query.sql).toContain("f.file_uuid IS NULL");
  });
  it("visits every active tenant in its own context even if a previous tenant fails", async () => {
    state.multi = true;
    state.context.mockRejectedValueOnce(new Error("Unavailable tenant"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await createDocumentPreparationQueue(() => true).drainTenants();
      expect(state.context.mock.calls.map(call => call[0])).toEqual(["tenant-one", "tenant-two"]);
      expect(state.execute).toHaveBeenCalledTimes(1);
    } finally { log.mockRestore(); }
  });
  it("does not visit production tenant queues while disabled", async () => {
    state.multi = true;
    await createDocumentPreparationQueue(() => false).drainTenants();
    expect(state.context).not.toHaveBeenCalled();
    expect(state.execute).not.toHaveBeenCalled();
  });
});
