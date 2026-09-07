import { describe, expect, it, vi } from "vitest";
import { groupInterviewSectionsByPart, openOrCreateInterview } from "../../client/src/modules/recruitment/components/InterviewLiveSubmissionHost";
import { apiRequest } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));

describe("Interview submission helpers", () => {
  it("groups only real submission sections by form_part_uuid", () => {
    const parts = [{ form_part_uuid: "part-a" }, { form_part_uuid: "part-b" }];
    const sections = [
      { form_part_uuid: "part-a", section_uuid: "section-a" },
      { form_part_uuid: "part-b", section_uuid: "section-b" },
      { form_part_uuid: "not-pinned", section_uuid: "section-x" },
    ] as any;
    expect(groupInterviewSectionsByPart(parts, sections)).toEqual({ "part-a": [sections[0]], "part-b": [sections[1]] });
  });

  it("reopens a persisted submission without creating another one", async () => {
    await expect(openOrCreateInterview("item", "submission")).resolves.toBe("submission");
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("creates an interview and returns the API submission UUID", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ json: async () => ({ interview_submission_uuid: "created-submission" }) } as Response);
    await expect(openOrCreateInterview("item")).resolves.toBe("created-submission");
    expect(apiRequest).toHaveBeenCalledWith("POST", "/api/v2/interviews/submissions", { interviewItemUuid: "item" });
  });
});