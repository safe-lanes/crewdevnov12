import { describe, expect, it } from "vitest";
import { companyFormErrorMessage } from "@/lib/companyFormErrors";
import { companyFormValidationProblems } from "@/lib/companyFormValidation";

const sectionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const pointId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const context = {
  partLabel: "Part 1 — Safety",
  references: {
    [sectionId]: "Part 1 — Safety · Section 1.1 — Emergency response",
    [pointId]: "Part 1 — Safety · Section 1.1 · Point 1.1.1 — Muster",
    "Emergency response": "Part 1 — Safety · Section 1.1 — Emergency response",
  },
  locationForPath: (path: Array<string | number>) =>
    path.includes("questions") ? "Part 1 — Safety · Section 1.1 · Point 1.1.1 — Muster" : "Part 1 — Safety · Section 1.1",
};
const error = (body: unknown, status = 400) => new Error(`${status}: ${JSON.stringify(body)}`);

describe("Company Form validation explanations", () => {
  it("keeps every returned issue with its readable position", () => {
    const result = companyFormErrorMessage(error({
      error: "Invalid form structures", details: [
        { path: ["parts", 0, "structure", "sections", 0, "questions", 0, "options"], message: "System fields cannot contain answer options" },
        { path: ["parts", 0, "structure", "sections", 0, "responsible_department"], message: "responsible_department must be empty when responsible_mode is role" },
      ],
    }), "editorSave", context);
    expect(result.split("\n")).toEqual([
      "Part 1 — Safety · Section 1.1 · Point 1.1.1 — Muster: Remove the answer choices from this System Field.",
      "Part 1 — Safety · Section 1.1: Clear the department when a role is responsible for this section.",
    ]);
    expect(result).not.toMatch(/could not be saved|responsible_|Invalid form/);
  });
  it("splits joined lifecycle failures without splitting the corrective instruction", () => {
    const result = companyFormErrorMessage(error({ error:
      'Section "Emergency response" requires at least one permitted vessel role. Section "Emergency response" requires submission but has no responsible party. Assign a role, department, or seafarer.',
    }), "release", context);
    expect(result.split("\n")).toHaveLength(2);
    expect(result).toContain("Section 1.1 — Emergency response");
    expect(result).toContain("Assign a role, department, or seafarer.");
    expect(result).not.toContain("could not be released");
  });
  it("keeps an unfamiliar but readable service explanation", () => {
    expect(companyFormErrorMessage(error({ error: "Choose a signing role before releasing this section." }), "release"))
      .toBe("Choose a signing role before releasing this section.");
  });
  it("resolves internal references, or identifies the part without exposing an unknown reference", () => {
    const resolved = companyFormValidationProblems(error({ error: `question_uuid does not belong to this draft: ${pointId}` }), context);
    expect(resolved[0]).toContain("Point 1.1.1 — Muster");
    expect(resolved[0]).not.toMatch(/uuid|bbbbbbbb/i);
    const unknown = companyFormValidationProblems(error({ error: "option_set_uuid does not belong to this form version: cccccccc-cccc-4ccc-8ccc-cccccccccccc" }), context);
    expect(unknown[0]).toContain("Part 1 — Safety");
    expect(unknown[0]).not.toMatch(/uuid|cccccccc/i);
    const section = companyFormValidationProblems(error({ error: `Section "${sectionId}" requires at least one permitted vessel role.` }), context);
    expect(section[0]).toContain("Section 1.1 — Emergency response");
    expect(section[0]).not.toContain(sectionId);
  });
  it("turns schema-type diagnostics into field instructions, with one item per failure", () => {
    const problems = companyFormValidationProblems(error({ details: [
      { path: ["questions", 0, "question_text"], message: "String must contain at most 2000 character(s)" },
      { path: ["responsible_role_uuid"], message: "Invalid uuid" },
      { path: ["response_type"], message: "Invalid enum value. Expected 'free_text', received 'broken'" },
    ] }), context);
    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toContain("Point wording: use no more than 2000 characters");
    expect(problems.join("\n")).not.toMatch(/question_text|responsible_role_uuid|response_type|free_text|Invalid enum/);
  });
  it("uses the fallback only when there is no safe specific explanation", () => {
    for (const body of [{ error: "Invalid form structure" }, { error: "server_error" }, {}]) {
      expect(companyFormErrorMessage(error(body), "release")).toBe("This form version could not be released. Review the draft requirements and try again.");
    }
    expect(companyFormErrorMessage(error({ error: "Failed to save form structures" }, 500), "editorSave"))
      .toBe("Form settings could not be saved. Check the draft and try again.");
    expect(companyFormValidationProblems(error({ error: "SQLSTATE 23514: column frm_questions invalid" }))).toEqual([]);
  });
  it("does not discard multiple issue details in favour of a top-level code", () => {
    expect(companyFormErrorMessage(error({ code: "FORBIDDEN", details: [
      { message: "Choose a signing role." }, { message: "Enter a department." },
    ] }), "editorSave").split("\n")).toEqual(["Choose a signing role.", "Enter a department."]);
  });
});
