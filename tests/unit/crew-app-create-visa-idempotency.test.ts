import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn(), listAttachments: vi.fn(), addAttachment: vi.fn() }));

vi.mock("../../server/v2/crew-app/crew-information/adapters", () => ({
  collections: { visas: { get: mocks.get, create: mocks.create } },
  attachmentAdapters: { visas: { add: mocks.addAttachment } },
  listCollectionAttachments: mocks.listAttachments,
  collectionSchemas: { visas: { parse: (value: unknown) => value } },
  getCurrentValues: vi.fn(),
  particularsSchema: { parse: (value: unknown) => value },
  applySingletonSection: vi.fn(),
}));

import { getCommandHandler, validateApprovedPayload } from "../../server/v2/crew-app/erp-commands/handlerRegistry";

const pending = {
  operationUuid: "8f314f9b-864b-4b3f-ac23-841ca819a934",
  crewUuid: "crew-1",
  stagedAttachments: "[]",
} as any;
const payload = { visaType: "C1/D", serialNo: "V-123" };

describe("idempotent CREATE_VISAS handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(undefined);
    mocks.listAttachments.mockResolvedValue([]);
  });

  it("uses the durable operation UUID as the canonical visa UUID", async () => {
    mocks.get.mockRejectedValueOnce(new Error("Visa not found"));
    mocks.create.mockResolvedValue({ ...payload, visaUuid: pending.operationUuid, crewUuid: pending.crewUuid });
    const handler = getCommandHandler("CREATE_VISAS")!;

    expect(await handler.loadAuthoritativeState(pending)).toEqual({});
    await handler.execute(pending, validateApprovedPayload("CREATE_VISAS", payload));

    expect(mocks.create).toHaveBeenCalledWith(pending.crewUuid, payload, pending.operationUuid);
  });

  it("reconciles a retry against that same UUID without another create", async () => {
    mocks.get.mockResolvedValue({ ...payload, visaUuid: pending.operationUuid, crewUuid: pending.crewUuid });
    const handler = getCommandHandler("CREATE_VISAS")!;

    expect(await handler.reconcile(pending, payload)).toBe("matches");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("resumes missing staged attachments with their original UUIDs", async () => {
    const withAttachment = { ...pending, stagedAttachments: JSON.stringify([{ attUuid: "att-1", fileName: "visa.pdf", filePath: "tenant/visa.pdf", fileType: "application/pdf", fileSize: "100" }]) };
    mocks.get.mockResolvedValue({ ...payload, visaUuid: pending.operationUuid, crewUuid: pending.crewUuid });
    mocks.listAttachments.mockResolvedValue([]);
    const handler = getCommandHandler("CREATE_VISAS")!;

    await handler.execute(withAttachment, payload);

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.addAttachment).toHaveBeenCalledWith(pending.operationUuid, expect.objectContaining({ fileName: "visa.pdf" }), "att-1");
  });
});
