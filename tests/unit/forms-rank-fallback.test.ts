import { beforeEach, describe, expect, it, vi } from "vitest";

const { findAll, findByFormId } = vi.hoisted(() => ({
  findAll: vi.fn(),
  findByFormId: vi.fn(),
}));

vi.mock("@server/v2/admin/repositories/formsRepository", () => ({
  FormsRepository: class { findAll = findAll; },
}));
vi.mock("@server/v2/admin/repositories/rankGroupsRepository", () => ({
  RankGroupsRepository: class { findByFormId = findByFormId; },
}));

import { formsService } from "@server/v2/admin/services/formsService";

describe("getFormForRank unmatched-rank behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findAll.mockResolvedValue([
      { id: 414, formUuid: "d93f78dd-a98d-4f88-8ed6-9d634a4cf512", name: "Structure rank group", category: "briefing" },
      { id: 7, formUuid: "dc55bb34-ebfe-40d6-8583-b5de6ac4729d", name: "Crew Briefing Form", category: "briefing" },
    ]);
    findByFormId.mockResolvedValue([{ id: 1, ranks: "[]", name: "Empty group" }]);
  });

  it("returns null instead of the newest unrelated form when no group covers the rank", async () => {
    expect(await formsService.getFormForRank("Wiper", "briefing")).toBeNull();
    expect(findByFormId).toHaveBeenCalledWith(414, false);
    expect(findByFormId).toHaveBeenCalledWith(7, false);
  });

  it("returns null if there are no forms in the requested category", async () => {
    expect(await formsService.getFormForRank("Wiper", "interview")).toBeNull();
    expect(findByFormId).not.toHaveBeenCalled();
  });
});