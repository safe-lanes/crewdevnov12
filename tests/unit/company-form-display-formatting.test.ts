import { describe, expect, it } from "vitest";
import { sailDate, sailUtcTimestamp } from "../../shared/v2/forms-engine/displayFormatting";
import { createCrewAssignmentSubject } from "../../server/v2/company-forms/subjects/crewAssignmentSubject";

describe("Company Form readable system values", () => {
  it("formats calendar/release dates in SAIL format with no browser-local shift", () => {
    expect(sailDate("2026-10-02")).toBe("02-Oct-2026");
    expect(sailDate("2026-10-02T23:30:00Z")).toBe("02-Oct-2026");
    expect(sailUtcTimestamp("2026-10-02T23:30:00Z")).toBe("02-Oct-2026 23:30:00 UTC");
    expect(sailDate(null)).toBe("Unavailable");
  });
  it("resolves both date system fields readably and preserves the raw calendar date", async () => {
    const adapter = createCrewAssignmentSubject();
    const subject = { signOnDate: "2026-10-15" } as any;
    const context = { submission: { dateOfDeclaration: "2026-10-02" } };
    expect(await adapter.resolveSystemField("sign_on_date", subject, context)).toBe("15-Oct-2026");
    expect(await adapter.resolveSystemField("date_of_declaration", subject, context)).toBe("02-Oct-2026");
    expect(await adapter.resolveSystemField("sign_on_date", subject, { ...context, raw: true })).toBe("2026-10-15");
  });
  it("returns the master rank name and separately resolves the code, never guessing", async () => {
    const rows = [[{ presentRank: "R017" }], [{ rank: "Pumpman" }], [{ presentRank: "R017" }]];
    const executor: any = { select: () => executor, from: () => executor, where: () => executor, limit: async () => rows.shift() };
    const adapter = createCrewAssignmentSubject();
    const context = { submission: { dateOfDeclaration: null } };
    expect(await adapter.resolveSystemField("rank", { crewUuid: "synthetic" } as any, context, executor)).toBe("Pumpman");
    expect(await adapter.resolveSystemField("rank", { crewUuid: "synthetic" } as any, { ...context, raw: true }, executor)).toBe("R017");
  });

  it.each(["11111111-1111-4111-8111-111111111111", "R017"])(
    "resolves a base-rank UUID or ID only through an eligible master: %s",
    async reference => {
      const rows = [[{ presentRank: reference }], [], [{ rank: "Pumpman" }]];
      const executor: any = { select: () => executor, from: () => executor, where: () => executor, limit: async () => rows.shift() };
      expect(await createCrewAssignmentSubject().resolveSystemField("rank", { crewUuid: "synthetic" } as any,
        { submission: { dateOfDeclaration: null } }, executor)).toBe("Pumpman");
    },
  );

  it("does not match a crew profile rank by display label", async () => {
    const rows = [[{ presentRank: "Pumpman" }], [], []];
    const executor: any = { select: () => executor, from: () => executor, where: () => executor, limit: async () => rows.shift() };
    await expect(createCrewAssignmentSubject().resolveSystemField("rank", { crewUuid: "synthetic" } as any,
      { submission: { dateOfDeclaration: null } }, executor)).rejects.toMatchObject({ statusCode: 400, code: "RANK_NOT_ELIGIBLE" });
  });

  it("refuses ambiguous masters instead of choosing a signature identity", async () => {
    const rows = [[{ presentRank: "R017" }], [{ rank: "Pumpman" }, { rank: "Pumpman" }]];
    const executor: any = { select: () => executor, from: () => executor, where: () => executor, limit: async () => rows.shift() };
    await expect(createCrewAssignmentSubject().resolveSystemField("rank", { crewUuid: "synthetic" } as any,
      { submission: { dateOfDeclaration: null } }, executor)).rejects.toMatchObject({
      statusCode: 400, code: "RANK_NOT_ELIGIBLE",
    });
  });
});