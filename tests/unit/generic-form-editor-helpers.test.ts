import { describe, expect, it } from "vitest";
import { genericFormEditorTestUtils } from "../../client/src/components/GenericFormEditor";

describe("generic configurable-form editor helpers", () => {
  it("generates hidden option values only when adding new options and suffixes same-question collisions", () => {
    const first = genericFormEditorTestUtils.createOption("Ready to sail");
    const second = genericFormEditorTestUtils.createOption("Ready to sail", [first]);

    expect(first.option_value).toBe("ready_to_sail");
    expect(second.option_value).toBe("ready_to_sail_2");

    // A label rename keeps the original value; the save payload preserves it.
    const payload = genericFormEditorTestUtils.toPayload([{
      clientKey: "section",
      section_code: "B1",
      section_title: "Briefing",
      applicable_vessel_types: [],
      responsible_mode: "not_applicable",
      responsible_role_uuid: null,
      responsible_department: null,
      comment_box_required: false,
      signature_required: false,
      questions: [{
        clientKey: "question",
        question_code: "B1.1",
        question_text: "Are you ready?",
        response_type: "single_select",
        is_mandatory: false,
        comment_enabled: true,
        options: [{ ...first, option_label: "Ready and checked" }],
      }],
    }]);

    expect(payload.sections[0].questions[0].options[0]).toMatchObject({
      option_label: "Ready and checked",
      option_value: "ready_to_sail",
    });
  });

  it("derives independent section and point codes from the parent part code", () => {
    const sections = [{
      clientKey: "one",
      section_code: "",
      section_title: "First",
      applicable_vessel_types: [],
      responsible_mode: "not_applicable" as const,
      responsible_role_uuid: null,
      responsible_department: null,
      comment_box_required: false,
      signature_required: false,
      questions: [{
        clientKey: "point-one",
        question_code: "",
        question_text: "Point",
        response_type: "yes_no",
        is_mandatory: false,
        comment_enabled: true,
        options: [],
      }],
    }, {
      clientKey: "two",
      section_code: "",
      section_title: "Second",
      applicable_vessel_types: [],
      responsible_mode: "not_applicable" as const,
      responsible_role_uuid: null,
      responsible_department: null,
      comment_box_required: false,
      signature_required: false,
      questions: [],
    }];

    const partD = genericFormEditorTestUtils.renumberSections("D", sections);
    expect(partD.map((section) => section.section_code)).toEqual(["D1", "D2"]);
    expect(partD[0].questions[0].question_code).toBe("D1.1");
  });

  it("requires a discard confirmation before replacing a dirty version tree", () => {
    expect(genericFormEditorTestUtils.shouldConfirmVersionChange(true, "current", "next")).toBe(true);
    expect(genericFormEditorTestUtils.shouldConfirmVersionChange(false, "current", "next")).toBe(false);
    expect(genericFormEditorTestUtils.shouldConfirmVersionChange(true, "current", "current")).toBe(false);
  });

  it("accepts the master-data string[] department response and serializes the chosen department", () => {
    expect(genericFormEditorTestUtils.departmentOption("Marine Operations")).toEqual({
      value: "Marine Operations",
      label: "Marine Operations",
    });

    const payload = genericFormEditorTestUtils.toPayload([{
      clientKey: "section",
      section_code: "B1",
      section_title: "Department owner",
      applicable_vessel_types: [],
      responsible_mode: "department",
      responsible_role_uuid: null,
      responsible_department: "Marine Operations",
      comment_box_required: false,
      signature_required: false,
      questions: [],
    }]);
    expect(payload.sections[0].responsible_department).toBe("Marine Operations");
  });
});