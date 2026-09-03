import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCrewByUuid, getFormForRank } = vi.hoisted(() => ({
  getCrewByUuid: vi.fn(),
  getFormForRank: vi.fn(),
}));

vi.mock("@server/v2/crew-pool/services/crewMembersService", () => ({
  crewMembersService: { getByUuid: getCrewByUuid },
}));

vi.mock("@server/v2/admin/services/formsService", () => ({
  formsService: { getFormForRank },
}));

import {
  BriefingError,
  resolveBriefingCreationTarget,
} from "@server/v2/briefings/service";

const FORM_UUID = "10000000-0000-4000-8000-000000000001";

function resolvedForm(
  rankGroupName: string,
  formVersionId: number,
  formVersionUuid: string,
) {
  return {
    formUuid: FORM_UUID,
    rankGroupName,
    formVersionId,
    formVersionUuid,
    noReleasedVersion: false,
  };
}

describe("briefing creation rank resolution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves a Master through formsService and returns its released rank-group version", async () => {
    getCrewByUuid.mockResolvedValue({ presentRank: "Master" });
    getFormForRank.mockResolvedValue(
      resolvedForm(
        "Senior Deck Officers",
        42,
        "20000000-0000-4000-8000-000000000042",
      ),
    );

    await expect(
      resolveBriefingCreationTarget({ formUuid: FORM_UUID, crewUuid: "crew-master" }),
    ).resolves.toEqual({
      formUuid: FORM_UUID,
      formVersionId: 42,
      formVersionUuid: "20000000-0000-4000-8000-000000000042",
      rank: "Master",
      rankGroupName: "Senior Deck Officers",
    });
    expect(getFormForRank).toHaveBeenCalledWith("Master", "briefing");
  });

  it("rejects a rank not covered by a rank group and names the rank", async () => {
    getCrewByUuid.mockResolvedValue({ presentRank: "Unassigned Rank" });
    getFormForRank.mockResolvedValue({
      formUuid: FORM_UUID,
      rankGroupName: null,
      noReleasedVersion: true,
    });

    await expect(
      resolveBriefingCreationTarget({ formUuid: FORM_UUID, crewUuid: "crew-unassigned" }),
    ).rejects.toMatchObject<Partial<BriefingError>>({
      statusCode: 404,
      message: "No Briefing Rank Group assigned from Admin Module for rank Unassigned Rank. Please configure rank groups in Admin > Forms Configuration.",
    });
  });

  it("rejects a matching rank group that has no released version", async () => {
    getCrewByUuid.mockResolvedValue({ presentRank: "Chief Officer" });
    getFormForRank.mockResolvedValue({
      formUuid: FORM_UUID,
      rankGroupName: "Deck Officers",
      formVersionId: null,
      formVersionUuid: null,
      noReleasedVersion: true,
    });

    await expect(
      resolveBriefingCreationTarget({ formUuid: FORM_UUID, crewUuid: "crew-chief" }),
    ).rejects.toMatchObject<Partial<BriefingError>>({
      statusCode: 404,
      message: "No released Briefing form version exists for rank group Deck Officers (rank Chief Officer). Please release a version in Admin > Forms Configuration.",
    });
  });

  it("resolves differently configured ranks to different groups and versions", async () => {
    getCrewByUuid
      .mockResolvedValueOnce({ presentRank: "Master" })
      .mockResolvedValueOnce({ presentRank: "Chief Engineer" });
    getFormForRank
      .mockResolvedValueOnce(
        resolvedForm(
          "Senior Deck Officers",
          42,
          "20000000-0000-4000-8000-000000000042",
        ),
      )
      .mockResolvedValueOnce(
        resolvedForm(
          "Senior Engine Officers",
          73,
          "20000000-0000-4000-8000-000000000073",
        ),
      );

    const master = await resolveBriefingCreationTarget({
      formUuid: FORM_UUID,
      crewUuid: "crew-master",
    });
    const engineer = await resolveBriefingCreationTarget({
      formUuid: FORM_UUID,
      crewUuid: "crew-engineer",
    });

    expect(master).toMatchObject({
      rankGroupName: "Senior Deck Officers",
      formVersionId: 42,
    });
    expect(engineer).toMatchObject({
      rankGroupName: "Senior Engine Officers",
      formVersionId: 73,
    });
  });

  it("never accepts a version resolved from another briefing form", async () => {
    getCrewByUuid.mockResolvedValue({ presentRank: "Master" });
    getFormForRank.mockResolvedValue({
      ...resolvedForm(
        "Other Form Group",
        99,
        "20000000-0000-4000-8000-000000000099",
      ),
      formUuid: "10000000-0000-4000-8000-000000000099",
    });

    await expect(
      resolveBriefingCreationTarget({ formUuid: FORM_UUID, crewUuid: "crew-master" }),
    ).rejects.toThrow("No Briefing Rank Group assigned from Admin Module for rank Master.");
  });
});