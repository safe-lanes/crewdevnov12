import { describe, expect, it, vi } from "vitest";
import {
  debriefingCreationErrorMessage,
  debriefingLayout,
  attachDebriefingQuestionOptions,
  groupDebriefingSectionsByPart,
  isPersistedDebriefingUuid,
  mergeDebriefingPendingItem,
  openOrCreateDebriefing,
  reconcileSavedDebriefingUuid,
} from "../../client/src/modules/crew-pool/components/DebriefingLiveSubmissionHost";
import { apiRequest } from "@/lib/queryClient";
import {
  buildDebriefingPartAPayload,
  buildDebriefingPartCPayload,
} from "../../client/src/modules/crew-pool/components/DebriefingFixedParts";

vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));

describe("Debriefing submission helpers", () => {
  it("groups only real submission sections by form_part_uuid", () => {
    const parts = [{ form_part_uuid: "part-a" }, { form_part_uuid: "part-b" }];
    const sections = [
      { form_part_uuid: "part-a", section_uuid: "section-a" },
      { form_part_uuid: "part-b", section_uuid: "section-b" },
      { form_part_uuid: "other", section_uuid: "section-other" },
    ] as any;

    expect(groupDebriefingSectionsByPart(parts, sections)).toEqual({
      "part-a": [sections[0]],
      "part-b": [sections[1]],
    });
  });

  it("uses matrix layout only for eligible compact select questions", () => {
    const section = { layout_preference: "auto", default_option_set_uuid: "options" };
    const questions = [
      { response_type: "single_select", option_set_uuid: "options", options: [{ option_label: "Yes" }, { option_label: "No" }] },
      { response_type: "multi_select", option_set_uuid: "options", options: [{ option_label: "Yes" }, { option_label: "No" }] },
    ];
    expect(debriefingLayout(section, questions)).toBe("matrix");
    expect(debriefingLayout({ ...section, layout_preference: "list" }, questions)).toBe("list");
    expect(debriefingLayout(section, [{ ...questions[0], response_type: "free_text" }])).toBe("list");
  });

  it("inherits a section default option set when a question has no option set", () => {
    const section = { layout_preference: "auto", default_option_set_uuid: "section-options" };
    const optionSet = [
      { option_uuid: "yes", option_label: "Yes", option_value: "yes" },
      { option_uuid: "no", option_label: "No", option_value: "no" },
    ];
    const optionsBySet = new Map([["section-options", optionSet]]);
    const question = { response_type: "single_select", option_set_uuid: null };
    const enriched = { ...question, options: attachDebriefingQuestionOptions(question, section, optionsBySet) };
    expect(enriched.options).toEqual(optionSet);
    expect(debriefingLayout(section, [enriched])).toBe("matrix");
  });

  it("merges a failed batch without overwriting newer answer, comment, or section-comment edits", () => {
    const older = { answers: { q1: { value: "old", comment: "old comment" }, q2: { value: "kept" } }, sectionComment: "old section" };
    const newer = { answers: { q1: { value: "new", comment: "new comment" } }, sectionComment: "" };
    expect(mergeDebriefingPendingItem(older, newer)).toEqual({
      answers: { q1: { value: "new", comment: "new comment" }, q2: { value: "kept" } },
      sectionComment: "",
    });
    expect(mergeDebriefingPendingItem(older, { answers: { q2: { value: "newer" } } }).sectionComment).toBe("old section");
  });

  it("enables the action only for a persisted G2 UUID", () => {
    expect(isPersistedDebriefingUuid("5bf5b41b-3d0e-4522-8cc5-e590792410f0")).toBe(true);
    expect(isPersistedDebriefingUuid(String(Date.now()))).toBe(false);
  });

  it("reopens an existing submission without creating another", async () => {
    await expect(openOrCreateDebriefing("row", "submission")).resolves.toBe("submission");
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("creates a submission and returns its server UUID", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ json: async () => ({ debriefing_submission_uuid: "created-submission" }) } as Response);
    await expect(openOrCreateDebriefing("row")).resolves.toBe("created-submission");
    expect(apiRequest).toHaveBeenCalledWith("POST", "/api/v2/debriefings/submissions", { debriefingUuid: "row" });
  });

  it("shows the server's creation error", () => {
    expect(debriefingCreationErrorMessage(new Error('400: {"error":"No Debriefing rank group covers 3rd Officer"}')))
      .toBe("No Debriefing rank group covers 3rd Officer");
  });

  it("builds the exact Part A PUT contract for every API mode", () => {
    expect(buildDebriefingPartAPayload("2025-02-14", "company_office")).toEqual({
      debriefingDate: "2025-02-14",
      modeOfDebriefing: "company_office",
    });
    expect(buildDebriefingPartAPayload("2025-02-14", "manning_agent")).toEqual({
      debriefingDate: "2025-02-14",
      modeOfDebriefing: "manning_agent",
    });
    expect(buildDebriefingPartAPayload("2025-02-14", "video_call")).toEqual({
      debriefingDate: "2025-02-14",
      modeOfDebriefing: "video_call",
    });
  });

  it("builds the exact Part C PUT contract and preserves null for an empty review", () => {
    expect(buildDebriefingPartCPayload("Reviewed and accepted")).toEqual({
      officeReviewComments: "Reviewed and accepted",
    });
    expect(buildDebriefingPartCPayload("")).toEqual({ officeReviewComments: null });
  });

  it("reconciles a newly saved G2 UUID into its local row", () => {
    const rows = [{ id: "temporary", vessel: "Example" }, { id: "existing", vessel: "Other" }];
    expect(reconcileSavedDebriefingUuid(rows, "temporary", { debriefing_uuid: "5bf5b41b-3d0e-4522-8cc5-e590792410f0" })[0])
      .toMatchObject({ id: "temporary", debriefingUuid: "5bf5b41b-3d0e-4522-8cc5-e590792410f0" });
  });
});