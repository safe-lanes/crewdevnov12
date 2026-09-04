import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFormForRank } = vi.hoisted(() => ({
  getFormForRank: vi.fn(),
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

  it("resolves the G1 joining rank through formsService and returns its released rank-group version", async () => {
    getFormForRank.mockResolvedValue(
      resolvedForm(
        "Senior Deck Officers",
        42,
        "20000000-0000-4000-8000-000000000042",
      ),
    );

    await expect(
      resolveBriefingCreationTarget({ joiningRank: "Master" }),
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
    getFormForRank.mockResolvedValue({
      formUuid: FORM_UUID,
      rankGroupName: null,
      noReleasedVersion: true,
    });

    await expect(
      resolveBriefingCreationTarget({ joiningRank: "Unassigned Rank" }),
    ).rejects.toMatchObject<Partial<BriefingError>>({
      statusCode: 404,
      message: "No Briefing Rank Group assigned from Admin Module for rank Unassigned Rank. Please configure rank groups in Admin > Forms Configuration.",
    });
  });

  it("rejects a matching rank group that has no released version", async () => {
    getFormForRank.mockResolvedValue({
      formUuid: FORM_UUID,
      rankGroupName: "Deck Officers",
      formVersionId: null,
      formVersionUuid: null,
      noReleasedVersion: true,
    });

    await expect(
      resolveBriefingCreationTarget({ joiningRank: "Chief Officer" }),
    ).rejects.toMatchObject<Partial<BriefingError>>({
      statusCode: 404,
      message: "No released Briefing form version exists for rank group Deck Officers (rank Chief Officer). Please release a version in Admin > Forms Configuration.",
    });
  });

  it("resolves differently configured ranks to different groups and versions", async () => {
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
      joiningRank: "Master",
    });
    const engineer = await resolveBriefingCreationTarget({
      joiningRank: "Chief Engineer",
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

  it("rejects a G1 row with no joining rank and never falls back to present rank", async () => {
    await expect(
      resolveBriefingCreationTarget({ joiningRank: null }),
    ).rejects.toMatchObject<Partial<BriefingError>>({
      statusCode: 400,
      message: "The selected G1 row has no joining rank. Set the joining rank before creating a Briefing submission.",
    });
    expect(getFormForRank).not.toHaveBeenCalled();
  });
});