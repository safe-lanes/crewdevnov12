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

  it("preserves option identities only for their original set and omits them for duplicated or custom sets", () => {
    const original = {
      clientKey: "original-option",
      option_uuid: "11111111-1111-4111-8111-111111111111",
      option_label: "Ready",
      option_value: "ready",
    };
    const copied = genericFormEditorTestUtils.cloneOptions([original], true);
    expect(copied[0]).not.toHaveProperty("option_uuid");
    expect(copied[0].option_value).toBe("ready");

    const payload = genericFormEditorTestUtils.toPayload([{
      clientKey: "section",
      section_code: "B1",
      section_title: "Scale",
      applicable_vessel_types: [],
      responsible_mode: "not_applicable",
      responsible_role_uuid: null,
      responsible_department: null,
      comment_box_required: false,
      signature_required: false,
      default_option_set_uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      layout_preference: "auto" as const,
      questions: [{
        clientKey: "question",
        question_code: "B1.1",
        question_text: "Rate readiness",
        response_type: "single_select",
        is_mandatory: false,
        comment_enabled: true,
        option_set_uuid: null,
        options: [original],
      }],
    }], [
      {
        clientKey: "named",
        option_set_uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        option_set_name: "Assessment Scale",
        options: [original],
      },
      {
        clientKey: "copied",
        option_set_uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        option_set_name: "Assessment Scale (copy)",
        options: copied,
      },
      {
        clientKey: "custom",
        option_set_uuid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        option_set_name: null,
        options: genericFormEditorTestUtils.cloneOptions([original], true),
      },
    ]);

    expect(payload.option_sets[0].options[0].option_uuid).toBe(original.option_uuid);
    expect(payload.option_sets[1].options[0]).not.toHaveProperty("option_uuid");
    expect(payload.option_sets[2].options[0]).not.toHaveProperty("option_uuid");
    expect(payload.sections[0].questions[0].options).toEqual([]);
  });

  it("builds a server-valid numeric-scale payload with stable numeric values and validates bad ranges", () => {
    const scale = genericFormEditorTestUtils.buildNumericScaleOptions("1", "10", "Poor", "Excellent");
    expect(scale.error).toBeUndefined();
    expect(scale.options).toHaveLength(10);
    expect(scale.options?.[0]).toMatchObject({ option_label: "1", option_value: "1" });
    expect(scale.options?.[9]).toMatchObject({ option_label: "10", option_value: "10" });
    expect(scale.lowEndLabel).toBe("Poor");
    expect(scale.highEndLabel).toBe("Excellent");
    expect(scale.options?.every((option) => !option.option_uuid)).toBe(true);
    expect(scale.options?.map((option) => option.option_value)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);

    expect(genericFormEditorTestUtils.buildNumericScaleOptions("10", "1").error).toContain("greater");
    expect(genericFormEditorTestUtils.buildNumericScaleOptions("4", "4").error).toContain("at least two");
    expect(genericFormEditorTestUtils.buildNumericScaleOptions("one", "10").error).toContain("whole-number");
  });

  it("round-trips default-backed points as inherited while preserving a distinct named-set override", () => {
    const defaults = genericFormEditorTestUtils.normalizeTree({
      option_sets: [
        {
          option_set_uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          option_set_name: "Assessment Scale",
          options: [{ option_uuid: "11111111-1111-4111-8111-111111111111", option_label: "Good", option_value: "good" }],
        },
        {
          option_set_uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          option_set_name: "Alternate Scale",
          options: [{ option_uuid: "22222222-2222-4222-8222-222222222222", option_label: "Pass", option_value: "pass" }],
        },
      ],
      sections: [{
        section_code: "B1",
        section_title: "Rating",
        applicable_vessel_types: [],
        responsible_mode: "not_applicable",
        responsible_role_uuid: null,
        responsible_department: null,
        comment_box_required: false,
        signature_required: false,
        default_option_set_uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        layout_preference: "auto",
        questions: [
          { question_code: "B1.1", question_text: "Inherited", response_type: "single_select", is_mandatory: false, comment_enabled: true, option_set_uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", options: [] },
          { question_code: "B1.2", question_text: "Overridden", response_type: "single_select", is_mandatory: false, comment_enabled: true, option_set_uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", options: [] },
        ],
      }],
    }, "B");

    expect(defaults[0].questions[0].option_set_uuid).toBeNull();
    expect(defaults[0].questions[0].options[0].option_value).toBe("good");
    expect(defaults[0].questions[1].option_set_uuid).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(genericFormEditorTestUtils.isNamedOptionSet({ option_set_name: "" })).toBe(true);
    expect(genericFormEditorTestUtils.isNamedOptionSet({ option_set_name: null })).toBe(false);
  });

  it("persists an inherited option edit through the section default instead of a discarded point-local array", () => {
    const payload = genericFormEditorTestUtils.toPayload([{
      clientKey: "section",
      section_code: "B1",
      section_title: "Rating",
      applicable_vessel_types: [],
      responsible_mode: "not_applicable",
      responsible_role_uuid: null,
      responsible_department: null,
      comment_box_required: false,
      signature_required: false,
      default_option_set_uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      layout_preference: "auto" as const,
      questions: [{
        clientKey: "inherited",
        question_code: "B1.1",
        question_text: "Rate readiness",
        response_type: "single_select",
        is_mandatory: false,
        comment_enabled: true,
        option_set_uuid: null,
        options: [{ clientKey: "local-copy", option_label: "Changed only locally", option_value: "ready" }],
      }],
    }], [{
      clientKey: "default-set",
      option_set_uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      option_set_name: "Assessment Scale",
      options: [{ clientKey: "persisted-edit", option_uuid: "11111111-1111-4111-8111-111111111111", option_label: "Changed on default", option_value: "ready" }],
    }]);

    expect(payload.sections[0].questions[0].options).toEqual([]);
    expect(payload.option_sets[0].options[0]).toMatchObject({
      option_uuid: "11111111-1111-4111-8111-111111111111",
      option_label: "Changed on default",
      option_value: "ready",
    });
  });

  it("resolves immediate Preview layout from the current unsaved draft", () => {
    const sharedOptions = [
      { clientKey: "one", option_label: "1", option_value: "1" },
      { clientKey: "two", option_label: "2", option_value: "2" },
    ];
    const section = {
      clientKey: "section",
      section_code: "B1",
      section_title: "Ratings",
      applicable_vessel_types: [],
      responsible_mode: "not_applicable" as const,
      responsible_role_uuid: null,
      responsible_department: null,
      comment_box_required: false,
      signature_required: false,
      default_option_set_uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      layout_preference: "auto" as const,
      questions: [
        { clientKey: "one", question_code: "B1.1", question_text: "One", response_type: "single_select", is_mandatory: false, comment_enabled: true, option_set_uuid: null, options: sharedOptions },
        { clientKey: "two", question_code: "B1.2", question_text: "Two", response_type: "multi_select", is_mandatory: false, comment_enabled: true, option_set_uuid: null, options: sharedOptions },
      ],
    };

    expect(genericFormEditorTestUtils.resolveDraftEffectiveLayout(section)).toBe("matrix");
    expect(genericFormEditorTestUtils.resolveDraftEffectiveLayout({ ...section, layout_preference: "list" })).toBe("list");
    expect(genericFormEditorTestUtils.resolveDraftEffectiveLayout({
      ...section,
      questions: [{ ...section.questions[0], response_type: "free_text", option_set_uuid: null, options: [] }],
    })).toBe("list");
  });

  it("explains every matrix eligibility fallback without relying on the saved server layout", () => {
    const base = {
      clientKey: "section",
      section_code: "B1",
      section_title: "Ratings",
      applicable_vessel_types: [],
      responsible_mode: "not_applicable" as const,
      responsible_role_uuid: null,
      responsible_department: null,
      comment_box_required: false,
      signature_required: false,
      default_option_set_uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      layout_preference: "matrix" as const,
      questions: [{
        clientKey: "one",
        question_code: "B1.1",
        question_text: "One",
        response_type: "single_select",
        is_mandatory: false,
        comment_enabled: true,
        option_set_uuid: null,
        options: Array.from({ length: 7 }, (_, index) => ({
          clientKey: `option-${index}`,
          option_label: String(index + 1),
          option_value: String(index + 1),
        })),
      }],
    };

    expect(genericFormEditorTestUtils.matrixIneligibilityReason({
      ...base,
      questions: [{ ...base.questions[0], response_type: "free_text" }],
    })).toBe("the section includes a non-select point");
    expect(genericFormEditorTestUtils.matrixIneligibilityReason({
      ...base,
      questions: [{ ...base.questions[0], option_set_uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, base.questions[0]],
    })).toBe("points use mixed option sets");
    expect(genericFormEditorTestUtils.matrixIneligibilityReason({
      ...base,
      questions: [{ ...base.questions[0], options: Array.from({ length: 13 }, (_, index) => ({
        clientKey: `option-${index}`, option_label: String(index + 1), option_value: String(index + 1),
      })) }],
    })).toBe("the shared option set has more than 12 options");
    expect(genericFormEditorTestUtils.matrixIneligibilityReason({
      ...base,
      questions: [{ ...base.questions[0], options: base.questions[0].options.map((option, index) => index === 0
        ? { ...option, option_label: "Very poor" }
        : option) }],
    })).toBe("the shared option set has labels longer than four characters");
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

  it("PASS: keeps Configure and Preview scroll positions independent across view switches", () => {
    const afterConfigureScroll = genericFormEditorTestUtils.captureViewScrollPosition(
      { configure: 0, preview: 0 },
      "configure",
      800,
    );
    const afterPreviewScroll = genericFormEditorTestUtils.captureViewScrollPosition(
      afterConfigureScroll,
      "preview",
      200,
    );

    expect(afterPreviewScroll).toEqual({ configure: 800, preview: 200 });
    expect(afterPreviewScroll.configure).toBe(800);
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

  it("uses role titles, sorts selectable roles, and preserves stale assignment warnings", () => {
    const roles = [
      { ruid: "zulu", assignedRole: "Zulu Officer", isActive: true, isDeleted: false },
      { ruid: "alpha", assignedRole: "Alpha Officer", isActive: true, isDeleted: false },
      { ruid: "inactive", assignedRole: "Former Master", isActive: false, isDeleted: false },
      { ruid: "deleted", assignedRole: "Removed Officer", isActive: false, isDeleted: true },
    ];

    expect(genericFormEditorTestUtils.selectableRoles(roles).map((role) => role.assignedRole)).toEqual([
      "Alpha Officer",
      "Zulu Officer",
    ]);
    expect(genericFormEditorTestUtils.roleSummary(roles, "inactive")).toEqual({
      title: "Former Master",
      status: "inactive",
    });
    expect(genericFormEditorTestUtils.roleSummary(roles, "deleted")).toEqual({
      title: "Removed Officer",
      status: "deleted",
    });
    expect(genericFormEditorTestUtils.roleSummary(roles, "missing")).toEqual({
      title: "Unknown role (missing)",
      status: "missing",
    });

    const payload = genericFormEditorTestUtils.toPayload([{
      clientKey: "role-owned-section",
      section_code: "B1",
      section_title: "Role owner",
      applicable_vessel_types: [],
      responsible_mode: "role",
      responsible_role_uuid: "alpha",
      responsible_department: null,
      comment_box_required: false,
      signature_required: false,
      questions: [],
    }]);
    expect(payload.sections[0].responsible_role_uuid).toBe("alpha");
  });
});