import { describe, expect, it } from "vitest";
import {
  sectionRequiresSubmission,
  validateCompanyFormLifecycle,
  type LifecycleSection,
} from "@server/v2/company-forms/lifecyclePolicy";

function section(overrides: Partial<LifecycleSection> = {}): LifecycleSection {
  return {
    sectionTitle: "Example",
    responsibleMode: "seafarer",
    signatureOfficerRequired: false,
    signatureSeafarerRequired: false,
    questions: [],
    ...overrides,
  };
}

describe("Company Form content-derived section lifecycle", () => {
  it.each(["content", "system_field", "info_only"])(
    "treats a section with only %s points as informational without signatures",
    (responseType) => {
      const definition = section({ questions: [{ responseType }] });
      expect(sectionRequiresSubmission(definition)).toBe(false);
      expect(validateCompanyFormLifecycle([definition])).toContain(
        "Company Form versions must contain at least one section requiring submission.",
      );
    },
  );

  it.each(["yes_no", "single_select", "free_text", "date", "number", "checkbox"])(
    "requires submission for an answerable %s point",
    (responseType) => {
      expect(sectionRequiresSubmission(section({ questions: [{ responseType }] }))).toBe(true);
    },
  );

  it("requires submission for signatures even when every point is informational", () => {
    expect(sectionRequiresSubmission(section({
      questions: [{ responseType: "content" }, { responseType: "system_field" }],
      signatureOfficerRequired: true,
    }))).toBe(true);
  });

  it.each([
    ["role", { responsibleRoleUuid: "role-uuid" }],
    ["department", { responsibleDepartment: "Crewing" }],
    ["seafarer", {}],
  ])("accepts a valid %s responsible party for a submission section", (responsibleMode, fields) => {
    expect(validateCompanyFormLifecycle([section({
      responsibleMode,
      questions: [{ responseType: "free_text" }],
      ...fields,
    })])).toEqual([]);
  });

  it.each([
    ["not_applicable", {}],
    ["role", {}],
    ["role", { responsibleRoleUuid: "  " }],
    ["department", { responsibleDepartment: "  " }],
  ])("rejects submission sections without a valid %s responsible party", (responsibleMode, fields) => {
    expect(validateCompanyFormLifecycle([section({
      responsibleMode,
      questions: [{ responseType: "free_text" }],
      ...fields,
    })])).toEqual([expect.stringContaining('Section "Example" requires submission but has no responsible party.')]);
  });
});