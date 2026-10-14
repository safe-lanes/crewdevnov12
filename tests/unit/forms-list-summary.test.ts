import { describe, it, expect } from "vitest";
import { attachFormListSummaries } from "../../server/v2/admin/services/formsListSummary";
import type { AdmFormV2 } from "../../shared/v2/admin/types";

const forms = [
  { id: 1, formUuid: "one", category: "appraisal" },
  { id: 2, formUuid: "two", category: "dynamic" },
  { id: 3, formUuid: "three", category: "dynamic" },
] as AdmFormV2[];
const version = (formId: number) => ({
  id: formId, formId, rankGroupId: null, versionNo: "09", versionDate: "17-Apr-2026", status: "released",
});
const ok = <T>(value: T): PromiseFulfilledResult<T> => ({ status: "fulfilled", value });

describe("Batched Forms Configuration summaries", () => {
  it("includes real versions independently and distinguishes successful empty lists", () => {
    const result = attachFormListSummaries(forms, {
      versions: ok([version(1), version(2)]), rankGroups: ok([]), parts: ok([]),
    });
    expect(result[0].versionSummary).toEqual({ state: "loaded", versions: [version(1)] });
    expect(result[1].versionSummary).toEqual({ state: "loaded", versions: [version(2)] });
    expect(result[2].versionSummary).toEqual({ state: "loaded", versions: [] });
  });
  it("isolates an invalid form's summary without losing the inventory or healthy rows", () => {
    const result = attachFormListSummaries(forms, {
      versions: ok([version(1), { ...version(2), status: null } as any, version(3)]),
      rankGroups: ok([]), parts: ok([]),
    });
    expect(result.map(f => f.id)).toEqual([1, 2, 3]);
    expect(result[0].versionSummary.state).toBe("loaded");
    expect(result[1].versionSummary).toEqual({ state: "error" });
    expect(result[2].versionSummary.state).toBe("loaded");
  });
  it("keeps the inventory on a failed bulk read and never returns exception text or invented versions", () => {
    const result = attachFormListSummaries(forms, {
      versions: { status: "rejected", reason: new Error("private SQL stack") },
      rankGroups: ok([]), parts: ok([]),
    });
    expect(result).toHaveLength(3);
    expect(result.every(f => f.versionSummary.state === "error")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private SQL stack");
  });
  it("does not turn a failed rank-group lookup into a successful Standard version", () => {
    const result = attachFormListSummaries(forms, {
      versions: ok([version(1), version(2)]),
      rankGroups: { status: "rejected", reason: new Error("unavailable") }, parts: ok([]),
    });
    expect(result[0].versionSummary.state).toBe("error");
    expect(result[1].versionSummary.state).toBe("loaded");
  });
});
