import { describe, expect, it, vi } from "vitest";
import { groupInterviewSectionsByPart, interviewCreationErrorMessage, isPersistedInterviewItemUuid, openOrCreateInterview, reconcileSavedInterviewItem } from "../../client/src/modules/recruitment/components/InterviewLiveSubmissionHost";
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

  it("enables only persisted B6 interview UUIDs regardless of outcome fields", () => {
    expect(isPersistedInterviewItemUuid("5bf5b41b-3d0e-4522-8cc5-e590792410f0")).toBe(true);
    expect(isPersistedInterviewItemUuid(String(Date.now()))).toBe(false);
  });

  it("surfaces the server's actual creation error", () => {
    expect(interviewCreationErrorMessage(new Error('400: {"error":"No Interview rank group covers 3rd Officer"}')))
      .toBe("No Interview rank group covers 3rd Officer");
    expect(interviewCreationErrorMessage(new Error("Network unavailable"))).toBe("Network unavailable");
  });

  it("replaces a temporary B6 row id immediately with the saved int_uuid", () => {
    const rows = [{ id: "temporary", date: "2026-09-07" }, { id: "existing", date: "" }];
    const saved = reconcileSavedInterviewItem(rows, "temporary", {
      id: 91,
      intUuid: "5bf5b41b-3d0e-4522-8cc5-e590792410f0",
    });
    expect(saved[0]).toMatchObject({
      id: "5bf5b41b-3d0e-4522-8cc5-e590792410f0",
      serverId: 91,
    });
    expect(isPersistedInterviewItemUuid(saved[0].id)).toBe(true);
  });
});