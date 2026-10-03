let mockStored: any[] = [];
let mockAuth: any = { domain: "tenant-a", crewUuid: "crew-a", accessToken: "token" };
let mockOnline = true;
let mockUuid = 0;
const mockUpdateSection = jest.fn();
const mockUpdate = jest.fn();
const mockOperationStatus = jest.fn();

jest.mock("../../auth/tokenStore", () => ({ tokenStore: { get: () => mockAuth, subscribe: jest.fn(() => jest.fn()) } }));
jest.mock("expo-network", () => ({ addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })), getNetworkStateAsync: jest.fn() }));
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(async (_: string, input: string) => input),
  randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, "0")}`),
}));
jest.mock("../../queryClient", () => ({ queryClient: { invalidateQueries: jest.fn(async () => undefined) } }));

import { configureOutboxForTests, mobileOutbox } from "../outbox";

const mockStore = {
  load: jest.fn(async () => structuredClone(mockStored)),
  save: jest.fn(async (items: any[]) => { mockStored = structuredClone(items); }),
};
const mockApi: any = { updateSection: mockUpdateSection, update: mockUpdate, operationStatus: mockOperationStatus };

const input = { kind: "UPDATE_SINGLETON" as const, section: "particulars", payload: { firstName: "Ada" } };
const makeItem = (overrides: any = {}) => ({
  version: 1, localId: "local", operationId: "operation", owner: { domain: "tenant-a", crewUuid: "crew-a" },
  ...input, fingerprint: "fp", status: "QUEUED", attempts: 0, confirmationFailures: 0,
  nextAttemptAt: 0, createdAt: Date.now(), updatedAt: Date.now(), ...overrides,
});

describe("durable mobile outbox", () => {
  beforeEach(() => {
    mockStored = []; mockUuid = 0; mockOnline = true;
    mockAuth = { domain: "tenant-a", crewUuid: "crew-a", accessToken: "token" };
    jest.clearAllMocks(); mockOperationStatus.mockReset().mockResolvedValue({ status: "COMPLETED" }); mockUpdateSection.mockReset().mockResolvedValue({}); mockUpdate.mockReset().mockResolvedValue({});
    configureOutboxForTests({ api: mockApi, store: mockStore as any, networkState: async () => ({ isConnected: mockOnline, isInternetReachable: mockOnline } as any) });
  });
  afterEach(() => { mobileOutbox.stop(); });

  it("1. persists SENDING before the first network attempt", async () => {
    mockUpdateSection.mockImplementation(async () => expect(mockStored[0].status).toBe("SENDING"));
    await mobileOutbox.enqueue(input); await mobileOutbox.syncNow();
    expect(mockStore.save).toHaveBeenCalled();
  });
  it("2. reuses the persisted operation ID after retry", async () => {
    mockStored = [makeItem()]; mockUpdateSection.mockRejectedValueOnce(new Error("offline"));
    await mobileOutbox.syncNow(); const id = mockStored[0].operationId; mockStored[0].nextAttemptAt = 0; mockOperationStatus.mockRejectedValueOnce(Object.assign(new Error(), { status: 404 }));
    await mobileOutbox.syncNow(); expect(mockUpdateSection.mock.calls.at(-1)?.[2]).toBe(id);
  });
  it("3. timeout never creates a second operation ID", async () => {
    mockStored = [makeItem()]; mockUpdateSection.mockRejectedValue(Object.assign(new Error(), { code: "request_timeout" }));
    await mobileOutbox.syncNow(); expect(mockStored).toHaveLength(1); expect(mockStored[0].operationId).toBe("operation");
  });
  it("4. timeout recovery performs operation-status lookup", async () => {
    mockStored = [makeItem()]; mockUpdateSection.mockRejectedValueOnce(Object.assign(new Error(), { code: "request_timeout" }));
    await mobileOutbox.syncNow(); mockStored[0].nextAttemptAt = 0; await mobileOutbox.syncNow(); expect(mockOperationStatus).toHaveBeenCalledWith("operation");
  });
  it("5. completed status prevents a resend", async () => {
    mockStored = [makeItem({ status: "AWAITING_CONFIRMATION" })]; await mobileOutbox.syncNow(); expect(mockUpdateSection).not.toHaveBeenCalled(); expect(mockStored[0].status).toBe("COMPLETED");
  });
  it("6. processing status waits without resend", async () => {
    mockStored = [makeItem({ status: "AWAITING_CONFIRMATION" })]; mockOperationStatus.mockResolvedValue({ status: "PROCESSING" }); await mobileOutbox.syncNow();
    expect(mockUpdateSection).not.toHaveBeenCalled(); expect(mockStored[0].status).toBe("AWAITING_CONFIRMATION");
  });
  it("7. NOT_FOUND retries with the same operation ID", async () => {
    mockStored = [makeItem({ status: "AWAITING_CONFIRMATION" })]; mockOperationStatus.mockRejectedValueOnce(Object.assign(new Error(), { status: 404 })); await mobileOutbox.syncNow();
    expect(mockUpdateSection).toHaveBeenCalledWith("particulars", input.payload, "operation");
  });
  it("8. crash-left SENDING checks status before any resend", async () => {
    mockStored = [makeItem({ status: "SENDING" })]; await mobileOutbox.syncNow(); expect(mockOperationStatus).toHaveBeenCalled(); expect(mockUpdateSection).not.toHaveBeenCalled();
  });
  it("9. restart-like reload recovers the persisted queue", async () => {
    mockStored = [makeItem()]; expect(await mobileOutbox.listCurrent()).toHaveLength(1); await mobileOutbox.syncNow(); expect(mockUpdateSection).toHaveBeenCalledTimes(1); expect(mockStored[0].status).toBe("COMPLETED"); expect(mockStored[0].operationId).toBe("operation");
  });
  it("10. logout pauses without deleting the queue", async () => {
    mockStored = [makeItem()]; mockAuth = { domain: null, crewUuid: null, accessToken: null }; await mobileOutbox.syncNow(); expect(mockUpdateSection).not.toHaveBeenCalled(); expect(mockStored).toHaveLength(1);
  });
  it("11. account switch cannot process or list the old user's queue", async () => {
    mockStored = [makeItem()]; mockAuth = { domain: "tenant-a", crewUuid: "crew-b", accessToken: "token" }; await mobileOutbox.syncNow(); expect(mockUpdateSection).not.toHaveBeenCalled(); expect(await mobileOutbox.listCurrent()).toEqual([]);
  });
  it("12. refreshed session resumes the same operation", async () => {
    mockStored = [makeItem()]; mockAuth.accessToken = "refreshed-token"; await mobileOutbox.syncNow(); expect(mockUpdateSection).toHaveBeenCalledWith("particulars", input.payload, "operation");
  });
  it("13. duplicate taps collapse to one pending logical operation", async () => {
    const first = await mobileOutbox.enqueue(input); const second = await mobileOutbox.enqueue(input); expect(second.operationId).toBe(first.operationId); expect(mockStored).toHaveLength(1);
  });
  it("17. backoff is positive and bounded", async () => {
    mockStored = [makeItem({ attempts: 100 })]; mockUpdateSection.mockRejectedValue(new Error("network")); await mobileOutbox.syncNow();
    expect(mockStored[0].nextAttemptAt - Date.now()).toBeGreaterThan(0); expect(mockStored[0].nextAttemptAt - Date.now()).toBeLessThanOrEqual(375_000);
  });
  it("18. known offline state avoids a request loop", async () => {
    mockStored = [makeItem()]; mockOnline = false; await mobileOutbox.syncNow(); await mobileOutbox.syncNow(); expect(mockUpdateSection).not.toHaveBeenCalled();
  });
  it("19. processing resumes safely when connectivity returns", async () => {
    mockStored = [makeItem()]; mockOnline = false; await mobileOutbox.syncNow(); mockOnline = true; await mobileOutbox.syncNow(); expect(mockUpdateSection).toHaveBeenCalledTimes(1);
  });
  it("20. expired completed entries are cleaned up", async () => {
    mockStored = [makeItem({ status: "COMPLETED", completedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 })]; await mobileOutbox.syncNow(); expect(mockStored).toEqual([]);
  });
  it("21. pending and ambiguous entries are never retention-deleted", async () => {
    mockStored = [makeItem({ status: "AWAITING_CONFIRMATION", createdAt: 0, nextAttemptAt: Date.now() + 10000 })]; await mobileOutbox.syncNow(); expect(mockStored).toHaveLength(1);
  });
  it("22. queue capacity rejects without discarding existing work", async () => {
    mockStored = Array.from({ length: 100 }, (_, index) => makeItem({ localId: `l${index}`, fingerprint: `f${index}` }));
    await expect(mobileOutbox.enqueue(input)).rejects.toThrow("queue is full"); expect(mockStored).toHaveLength(100);
  });
  it("23. processor emits no payloads, tokens, or PII to logs", async () => {
    const spies = ["log", "info", "warn", "error"].map((method) => jest.spyOn(console, method as any).mockImplementation(() => undefined));
    mockStored = [makeItem()]; await mobileOutbox.syncNow();
    spies.forEach((spy) => { expect(spy).not.toHaveBeenCalled(); spy.mockRestore(); });
  });
});
