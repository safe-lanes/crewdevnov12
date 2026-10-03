import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadPending: vi.fn(), transition: vi.fn(), execute: vi.fn(), load: vi.fn(), validate: vi.fn(), reconcile: vi.fn(),
}));

vi.mock("../../server/v2/crew-app/erp-commands/commandRepository", () => ({
  erpCommandRepository: {
    loadPending: mocks.loadPending,
    transition: mocks.transition,
    leaseNext: vi.fn(),
  },
}));
vi.mock("../../server/v2/crew-app/erp-commands/handlerRegistry", async importOriginal => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    validateApprovedPayload: (_type: string, payload: any) => payload,
    getCommandHandler: (type: string) => type === "UPDATE_DOCUMENTS" ? {
      classification: "SAFE_WITH_RECONCILIATION",
      validateTarget: mocks.validate,
      loadAuthoritativeState: mocks.load,
      canonicalizeApprovedPayload: (x: any) => x,
      canonicalizeAuthoritativeState: (x: any) => x,
      compare: (payload: any, state: any) => payload.value === state.value,
      execute: mocks.execute,
      reconcile: mocks.reconcile,
    } : undefined,
  };
});
vi.mock("../../server/v2/crew-app/monitoring/securityEvents", () => ({ emitCrewSecurityEvent: vi.fn() }));
vi.mock("../../server/utils/tenantConnectionManager", () => ({
  tenantConnectionManager: { isMultiTenantEnabled: false },
}));
vi.mock("../../server/v2/crew-app/tenantContext", () => ({ runInCrewAppTenant: vi.fn() }));

import { processLeasedCommand } from "../../server/v2/crew-app/erp-commands/worker";

const pending: any = {
  pendingUuid: "p1", operationUuid: "o1", domain: "a.example", crewUuid: "crew1",
  section: "documents", action: "update", targetUuid: "doc1", payload: '{"value":"approved"}',
  status: "approved", isDeleted: false,
};
const command = (type = "UPDATE_DOCUMENTS"): any => ({
  commandUuid: "c1", pendingUuid: "p1", operationUuid: "o1", domain: "a.example", crewUuid: "crew1",
  commandType: type, status: "leased", attemptCount: 1, leaseOwner: "w1", recoveryMode: "execute",
});

describe("ERP command worker behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadPending.mockResolvedValue(pending);
    mocks.validate.mockResolvedValue(undefined);
    mocks.load.mockResolvedValue({ value: "old", crewUuid: "crew1" });
    mocks.execute.mockResolvedValue(undefined);
    mocks.reconcile.mockResolvedValue("matches");
    mocks.transition.mockImplementation(async (row: any, status: string, values: any = {}) => ({ ...row, ...values, status }));
  });

  it.each(["CREATE_DOCUMENTS", "DELETE_DOCUMENTS", "SYNC_VESSEL_TYPES"])("never executes blocked command %s", async type => {
    const result = await processLeasedCommand(command(type));
    expect(result.status).toMatch(/blocked|manual_reconciliation_required/);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.loadPending).not.toHaveBeenCalled();
  });

  it("does not mutate when authoritative state already matches", async () => {
    mocks.load.mockResolvedValue({ value: "approved", crewUuid: "crew1" });
    const result = await processLeasedCommand(command());
    expect(result.status).toBe("applied");
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("requires post-mutation reconciliation before applied", async () => {
    const result = await processLeasedCommand(command());
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("applied");
  });

  it("reconciles rather than blindly retrying when mutation throws", async () => {
    mocks.execute.mockRejectedValue(Object.assign(new Error("connection lost"), { code: "ECONNRESET" }));
    mocks.reconcile.mockResolvedValue("conflicts");
    const result = await processLeasedCommand(command());
    expect(result.status).toBe("reconciliation_required");
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("does not execute during expired ambiguous-work recovery", async () => {
    const result = await processLeasedCommand({ ...command(), status: "verifying", recoveryMode: "verify" });
    expect(result.status).toBe("applied");
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("dead-letters exhausted safe pre-mutation retries", async () => {
    mocks.validate.mockRejectedValue(Object.assign(new Error("transient"), { code: "ECONNRESET" }));
    const result = await processLeasedCommand(command(), 1);
    expect(result.status).toBe("dead_letter");
    expect(result.errorCode).toBe("MAX_ATTEMPTS_EXCEEDED");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
