import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request } from "express";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@server/v2/db", () => ({ getDb: getDbMock }));

import {
  authorizeBriefingRead,
  BriefingError,
  isBriefingSectionApplicable,
  isMandatoryBriefingAnswerPresent,
  formatBriefingDate,
  serializeFormParts,
} from "@server/v2/briefings/service";

function request(userType: string): Request {
  return { user: { id: 42, domain: "tenant", userType } } as Request;
}

function masterUser(userType: string) {
  const query = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue([{ id: 42, userType }]),
  };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  getDbMock.mockReturnValue({ select: vi.fn().mockReturnValue(query) });
}

describe("briefing read authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts Office case-insensitively only when JWT and master user agree", async () => {
    masterUser(" oFfIcE ");
    await expect(authorizeBriefingRead(request("Office"))).resolves.toBeUndefined();
  });

  it("rejects Ship callers", async () => {
    masterUser("Ship");
    await expect(authorizeBriefingRead(request("Ship"))).rejects.toMatchObject<Partial<BriefingError>>({ statusCode: 403 });
  });

  it("fails closed when the JWT and master user types disagree", async () => {
    masterUser("Ship");
    await expect(authorizeBriefingRead(request("Office"))).rejects.toMatchObject<Partial<BriefingError>>({ statusCode: 403 });
  });
});

describe("briefing vessel applicability", () => {
  it("treats an empty vessel list as applicable even without a vessel type", () => {
    expect(isBriefingSectionApplicable("[]", null)).toBe(true);
  });

  it("treats a constrained list as not applicable without a vessel type", () => {
    expect(isBriefingSectionApplicable('["tanker"]', null)).toBe(false);
  });
});

describe("mandatory briefing answer presence", () => {
  it("rejects an empty multi-select answer", () => {
    expect(isMandatoryBriefingAnswerPresent("multi_select", "[]")).toBe(false);
  });

  it("accepts a non-empty multi-select answer", () => {
    expect(isMandatoryBriefingAnswerPresent("multi_select", '["selected"]')).toBe(true);
  });

  it("keeps false as a valid checkbox answer", () => {
    expect(isMandatoryBriefingAnswerPresent("checkbox", "false")).toBe(true);
  });
});

describe("briefing date presentation", () => {
  it("renders an ISO G1 text date as DD-MMM-YYYY", () => {
    expect(formatBriefingDate("2026-05-31")).toBe("31-May-2026");
  });

  it("does not guess malformed or impossible G1 dates", () => {
    expect(formatBriefingDate("31/05/2026")).toBeNull();
    expect(formatBriefingDate("2026-02-31")).toBeNull();
  });
});

describe("briefing form-parts response", () => {
  it("serializes general form metadata without Briefing-specific fields", () => {
    expect(serializeFormParts([{
      formPartUuid: "11111111-1111-4111-8111-111111111111",
      partCode: "D",
      partTitle: "Additional review",
      partType: "fixed",
      isOfficeOnly: true,
      sortOrder: 4,
    }])).toEqual([{
      form_part_uuid: "11111111-1111-4111-8111-111111111111",
      part_code: "D",
      part_title: "Additional review",
      part_type: "fixed",
      is_office_only: true,
      sort_order: 4,
    }]);
  });
});