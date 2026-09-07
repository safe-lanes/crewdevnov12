import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@server/v2/db", () => ({ getDb: getDbMock }));

import {
  authorizeDebriefingRead,
  DebriefingError,
  debriefingService,
  isDebriefingSectionApplicable,
  isMandatoryDebriefingAnswerPresent,
  parseDebriefingRankGroupRanks,
  resolveDebriefingCreationTarget,
  serializeFormParts,
} from "@server/v2/debriefings/service";

const FORM_UUID = "10000000-0000-4000-8000-000000000001";
const VERSION_UUID = "20000000-0000-4000-8000-000000000001";

function result(rows: unknown[]) {
  const chain: any = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.where.mockResolvedValue(rows);
  return chain;
}

function rankResolutionExecutor(groups: unknown[], versions: unknown[] | unknown[][]) {
  const versionLists = Array.isArray(versions[0]) ? versions as unknown[][] : [versions as unknown[]];
  return {
    select: vi.fn()
      .mockReturnValueOnce(result(groups))
      .mockImplementation(() => result(versionLists.shift() ?? [])),
  };
}

function request(userType: string): Request {
  return { user: { id: 42, domain: "tenant", userType } } as Request;
}

function masterUser(userType: string) {
  const query: any = { from: vi.fn(), where: vi.fn(), limit: vi.fn() };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.limit.mockResolvedValue([{ id: 42, userType }]);
  getDbMock.mockReturnValue({
    select: vi.fn().mockReturnValue(query),
  });
}

describe("debriefing rank resolution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a null G2 rank with a clear error before querying rank groups", async () => {
    const executor = { select: vi.fn() };
    await expect(resolveDebriefingCreationTarget({ rankServed: null }, executor))
      .rejects.toMatchObject<Partial<DebriefingError>>({
        statusCode: 400, message: expect.stringContaining("no rank served"),
      });
    expect(executor.select).not.toHaveBeenCalled();
  });

  it("names an unmatched rank", async () => {
    await expect(resolveDebriefingCreationTarget({ rankServed: "Unassigned Rank" },
      rankResolutionExecutor([], []))).rejects.toMatchObject<Partial<DebriefingError>>({
      statusCode: 404, message: expect.stringContaining("rank Unassigned Rank"),
    });
  });

  it("uses actual rank-group rows and the released version tied to that group", async () => {
    const target = await resolveDebriefingCreationTarget({ rankServed: "Master" },
      rankResolutionExecutor([{
        form: { id: 9, formUuid: FORM_UUID },
        group: { id: 4, name: "Deck Officers", ranks: '["Master","Chief Officer"]' },
      }], [{
        id: 12, fvUuid: VERSION_UUID, versionNo: "2", status: "released",
      }]));
    expect(target).toEqual({
      formUuid: FORM_UUID, formVersionId: 12, formVersionUuid: VERSION_UUID,
      rank: "Master", rankGroupName: "Deck Officers",
    });
  });

  it("rejects a matched actual group without a released version", async () => {
    await expect(resolveDebriefingCreationTarget({ rankServed: "Master" },
      rankResolutionExecutor([{
        form: { id: 9, formUuid: FORM_UUID },
        group: { id: 4, name: "Deck Officers", ranks: '["Master"]' },
      }], []))).rejects.toMatchObject<Partial<DebriefingError>>({
        statusCode: 404, message: expect.stringContaining("No released Debriefing form version"),
      });
  });

  it("uses the same JSON rank-array convention as Forms and ignores malformed values", () => {
    expect(parseDebriefingRankGroupRanks('["Master", 7]')).toEqual(["Master", "7"]);
    expect(parseDebriefingRankGroupRanks("Master,Chief Officer")).toEqual([]);
  });

  it("gives literal rank matches precedence over base-rank matches", async () => {
    const target = await resolveDebriefingCreationTarget({ rankServed: "AB_3" },
      rankResolutionExecutor([
        { form: { id: 1, formUuid: "base-form" }, group: { id: 1, name: "Base", ranks: '["AB"]' } },
        { form: { id: 2, formUuid: "literal-form" }, group: { id: 2, name: "Literal", ranks: '["AB_3"]' } },
      ], [{ id: 7, fvUuid: VERSION_UUID, versionNo: "1", status: "released" }]));
    expect(target).toMatchObject({ formUuid: "literal-form", rankGroupName: "Literal" });
  });

  it("skips an earlier unreleased literal group for a later released literal group", async () => {
    const target = await resolveDebriefingCreationTarget({ rankServed: "Master" },
      rankResolutionExecutor([
        { form: { id: 1, formUuid: "first" }, group: { id: 1, name: "Unreleased", ranks: '["Master"]' } },
        { form: { id: 2, formUuid: "second" }, group: { id: 2, name: "Released", ranks: '["Master"]' } },
      ], [[], [{ id: 8, fvUuid: VERSION_UUID, versionNo: "1", status: "released" }]]));
    expect(target).toMatchObject({ formUuid: "second", rankGroupName: "Released" });
  });

  it("uses candidate order as the deterministic same-status tie-break", async () => {
    const target = await resolveDebriefingCreationTarget({ rankServed: "Master" },
      rankResolutionExecutor([
        { form: { id: 1, formUuid: "first" }, group: { id: 1, name: "First", ranks: '["Master"]' } },
        { form: { id: 2, formUuid: "second" }, group: { id: 2, name: "Second", ranks: '["Master"]' } },
      ], [[{ id: 7, fvUuid: VERSION_UUID, versionNo: "1", status: "released" }]]));
    expect(target).toMatchObject({ formUuid: "first", rankGroupName: "First" });
  });
});

describe("debriefing read policy and form helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fails closed when JWT and master user are not both Office", async () => {
    masterUser("Ship");
    await expect(authorizeDebriefingRead(request("Office")))
      .rejects.toMatchObject<Partial<DebriefingError>>({ statusCode: 403 });
    await expect(authorizeDebriefingRead({} as Request))
      .rejects.toMatchObject<Partial<DebriefingError>>({ statusCode: 403 });
  });

  it("rejects Ship callers before create and every tested mutation path", async () => {
    masterUser("Ship");
    const ship = request("Ship");
    await expect(debriefingService.create({ debriefingUuid: "10000000-0000-4000-8000-000000000001" }, ship))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(debriefingService.savePartA("10000000-0000-4000-8000-000000000001", { debriefingDate: null, modeOfDebriefing: null }, ship))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(debriefingService.saveAnswers("10000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000001", [], undefined, ship))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(debriefingService.submit("10000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000001", undefined, ship))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it("evaluates applicability and mandatory values", () => {
    expect(isDebriefingSectionApplicable("[]", null)).toBe(true);
    expect(isDebriefingSectionApplicable('["tanker"]', null)).toBe(false);
    expect(isMandatoryDebriefingAnswerPresent("multi_select", "[]")).toBe(false);
    expect(isMandatoryDebriefingAnswerPresent("multi_select", '["selected"]')).toBe(true);
    expect(isMandatoryDebriefingAnswerPresent("checkbox", "false")).toBe(true);
  });

  it("serializes reusable form part metadata", () => {
    expect(serializeFormParts([{ formPartUuid: "part", partCode: "C", partTitle: "Review",
      partType: "fixed", isOfficeOnly: true, sortOrder: 3 }])).toEqual([{
      form_part_uuid: "part", part_code: "C", part_title: "Review",
      part_type: "fixed", is_office_only: true, sort_order: 3,
    }]);
  });
});