import { describe, expect, it } from "vitest";
import { groupBriefingSectionsByPart } from "../../client/src/modules/crew-pool/components/BriefingLiveSubmissionHost";

describe("Briefing live submission part grouping", () => {
  it("keeps two configurable parts under their real part UUIDs", () => {
    const firstPartUuid = "11111111-1111-4111-8111-111111111111";
    const secondPartUuid = "22222222-2222-4222-8222-222222222222";
    const parts = [
      { form_part_uuid: firstPartUuid },
      { form_part_uuid: secondPartUuid },
    ];
    const sections = [
      { section_uuid: "section-one", form_part_uuid: firstPartUuid, section_title: "First" },
      { section_uuid: "section-two", form_part_uuid: secondPartUuid, section_title: "Second" },
    ] as any;

    expect(groupBriefingSectionsByPart(parts, sections)).toEqual({
      [firstPartUuid]: [sections[0]],
      [secondPartUuid]: [sections[1]],
    });
  });
});