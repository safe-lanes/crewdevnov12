import { describe, expect, it } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { formStructureInputSchema } from "@shared/v2/forms-engine/schema";

const validOption = () => ({
  option_label: "Yes",
  option_value: "yes",
});

const validQuestion = () => ({
  question_code: "Q1",
  question_text: "Is the point understood?",
  response_type: "single_select",
  options: [validOption()],
});

const validSection = () => ({
  section_code: "B1",
  section_title: "Briefing point",
  applicable_vessel_types: [],
  responsible_mode: "not_applicable",
  questions: [validQuestion()],
});

describe("form structure request contract", () => {
  it("accepts a full nested structure and defaults omitted booleans", () => {
    const result = formStructureInputSchema.safeParse({ sections: [validSection()] });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sections[0].comment_box_required).toBe(false);
      expect(result.data.sections[0].questions[0].is_mandatory).toBe(false);
    }
  });

  it("requires options for single-select and multi-select questions", () => {
    const payload = validSection();
    payload.questions[0].options = [];

    const result = formStructureInputSchema.safeParse({ sections: [payload] });

    expect(result.success).toBe(false);
  });

  it("rejects options for response types that do not support them", () => {
    const payload = validSection();
    payload.questions[0].response_type = "free_text";

    const result = formStructureInputSchema.safeParse({ sections: [payload] });

    expect(result.success).toBe(false);
  });

  it("requires a department target for department responsibility", () => {
    const payload = validSection();
    payload.responsible_mode = "department";

    const result = formStructureInputSchema.safeParse({ sections: [payload] });

    expect(result.success).toBe(false);
  });

  it("requires a role UUID for role responsibility", () => {
    const payload = validSection();
    payload.responsible_mode = "role";
    payload.responsible_role_uuid = uuidv4();

    const result = formStructureInputSchema.safeParse({ sections: [payload] });

    expect(result.success).toBe(true);
  });
});