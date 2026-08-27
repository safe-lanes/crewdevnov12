import { describe, expect, it } from "vitest";
import { resolveEffectiveLayout } from "@server/v2/admin/services/formStructureService";

function effective(
  preference: "auto" | "list" | "matrix",
  labels: string[],
  responseTypes: string[] = ["single_select", "multi_select"],
  splitSets = false,
) {
  const questions = responseTypes.map((responseType, index) => ({
    responseType,
    optionSetUuid: splitSets && index > 0 ? "set-2" : "set-1",
  }));
  const sets = new Map([
    ["set-1", { optionSetUuid: "set-1" }],
    ["set-2", { optionSetUuid: "set-2" }],
  ]);
  const options = new Map([
    ["set-1", labels.map((optionLabel) => ({ optionLabel }))],
    ["set-2", labels.map((optionLabel) => ({ optionLabel }))],
  ]);
  return resolveEffectiveLayout(preference, questions, null, sets, options);
}

describe("effective form section layout", () => {
  it("uses matrix through six options regardless of label length", () => {
    expect(effective("auto", Array.from({ length: 6 }, (_, i) => `Long label ${i}`))).toBe("matrix");
  });

  it("uses matrix for seven through twelve options only when every label is at most four characters", () => {
    expect(effective("matrix", Array.from({ length: 7 }, (_, i) => `A${i}`))).toBe("matrix");
    expect(effective("auto", Array.from({ length: 12 }, (_, i) => String(i).padStart(2, "0")))).toBe("matrix");
    expect(effective("auto", ["ABCDE", ...Array.from({ length: 6 }, (_, i) => `${i}`)])).toBe("list");
  });

  it("returns list for explicit list, more than twelve options, mixed sets, and non-select points", () => {
    expect(effective("list", ["Y", "N"])).toBe("list");
    expect(effective("auto", Array.from({ length: 13 }, (_, i) => `${i}`))).toBe("list");
    expect(effective("auto", ["Y", "N"], ["single_select", "multi_select"], true)).toBe("list");
    expect(effective("matrix", ["Y", "N"], ["single_select", "free_text"])).toBe("list");
  });
});