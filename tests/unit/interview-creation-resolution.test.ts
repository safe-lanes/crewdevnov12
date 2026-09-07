import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFormForRank } = vi.hoisted(() => ({ getFormForRank: vi.fn() }));
vi.mock("@server/v2/admin/services/formsService", () => ({
  formsService: { getFormForRank },
}));
import { InterviewError, resolveInterviewCreationTarget } from "@server/v2/interviews/service";

const FORM_UUID = "10000000-0000-4000-8000-000000000001";
describe("Crew Interview creation rank resolution", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses rank applied for and returns the released rank group/version", async () => {
    getFormForRank.mockResolvedValue({ formUuid: FORM_UUID, rankGroupName: "Deck Officers", formVersionId: 4, formVersionUuid: "20000000-0000-4000-8000-000000000004", noReleasedVersion: false });
    await expect(resolveInterviewCreationTarget("Master")).resolves.toEqual({ formUuid: FORM_UUID, rankGroupName: "Deck Officers", formVersionId: 4, formVersionUuid: "20000000-0000-4000-8000-000000000004", rank: "Master" });
    expect(getFormForRank).toHaveBeenCalledWith("Master", "interview");
  });
  it("rejects an unmatched rank while naming it", async () => {
    getFormForRank.mockResolvedValue({ formUuid: FORM_UUID, rankGroupName: null, noReleasedVersion: true });
    await expect(resolveInterviewCreationTarget("Unassigned Rank")).rejects.toMatchObject<Partial<InterviewError>>({ statusCode: 404, message: expect.stringContaining("rank Unassigned Rank") });
  });
  it("rejects a rank group without a released version", async () => {
    getFormForRank.mockResolvedValue({ formUuid: FORM_UUID, rankGroupName: "Deck Officers", formVersionId: null, formVersionUuid: null, noReleasedVersion: true });
    await expect(resolveInterviewCreationTarget("Chief Officer")).rejects.toMatchObject<Partial<InterviewError>>({ statusCode: 404, message: expect.stringContaining("No released Crew Interview form version") });
  });
});