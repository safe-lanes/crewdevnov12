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
    const uuid = "11111111-1111-4111-8111-111111111111";
    const executor: any = { execute: async () => ({ rows: [{ contract_rank_uuid: uuid, rank: "Pumpman" }] }) };
    const adapter = createCrewAssignmentSubject();
    const context = { submission: { dateOfDeclaration: null } };
    expect(await adapter.resolveSystemField("rank", { crewUuid: "synthetic" } as any, context, executor)).toBe("Pumpman");
    expect(await adapter.resolveSystemField("rank", { crewUuid: "synthetic" } as any, { ...context, raw: true }, executor)).toBe(uuid);
  });

  it.each([{ rows: [] }, { rows: [{ contract_rank_uuid: null, contract_rank_label: "Pumpman", rank: null }] }])(
    "shows Not recorded when no contract rank is captured: %j",
    async ({ rows }) => {
      const executor: any = { execute: async () => ({ rows }) };
      expect(await createCrewAssignmentSubject().resolveSystemField("rank", { crewUuid: "synthetic" } as any,
        { submission: { dateOfDeclaration: null } }, executor)).toBe("Not recorded");
    },
  );

  it("does not match a crew profile rank by display label", async () => {
    const executor: any = { execute: async () => ({ rows: [] }), select: () => { throw Error("Mutable profile must not be read"); } };
    expect(await createCrewAssignmentSubject().resolveSystemField("rank", { crewUuid: "synthetic" } as any,
      { submission: { dateOfDeclaration: null } }, executor)).toBe("Not recorded");
  });

  it("refuses ambiguous masters instead of choosing a signature identity", async () => {
    const executor: any = { execute: async () => ({ rows: [
      { contract_rank_uuid: "uuid", rank: "Pumpman" }, { contract_rank_uuid: "uuid", rank: "Pumpman" },
    ] }) };
    await expect(createCrewAssignmentSubject().resolveSystemField("rank", { crewUuid: "synthetic" } as any,
      { submission: { dateOfDeclaration: null } }, executor)).rejects.toMatchObject({
      statusCode: 400, code: "RANK_NOT_ELIGIBLE",
    });
  });
});