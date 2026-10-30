import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { findLatestCrewAppraisal } from "@/modules/vessel/vesselAppraisals";

// APD-51: the Vessel page Crew List finds a crew's appraisals by crew_uuid, or
// by emp_no for older rows. Both are the same on every server. It opens them by
// appraisal_uuid, never by a serial id.

const CREW = { crewUuid: "c0000000-0000-4000-8000-000000000051", crewEmpNo: "A100051" };
const OTHER_CREW = "c0000000-0000-4000-8000-000000000052";

const row = (appraisalUuid: string, crewMemberId: string | null, updatedAt: string | null, createdAt = "2026-01-01T00:00:00Z") => ({
  appraisalUuid,
  crewMemberId,
  updatedAt,
  createdAt,
});

describe("APD-51 findLatestCrewAppraisal", () => {
  it("finds a row by crew_uuid", () => {
    const rows = [row("a1", CREW.crewUuid, "2026-10-01T00:00:00Z")];
    expect(findLatestCrewAppraisal(rows, CREW)?.appraisalUuid).toBe("a1");
  });

  it("finds an older row stored by emp_no", () => {
    const rows = [row("a1", CREW.crewEmpNo, "2026-10-01T00:00:00Z")];
    expect(findLatestCrewAppraisal(rows, CREW)?.appraisalUuid).toBe("a1");
  });

  it("ignores other crew's rows", () => {
    const rows = [
      row("mine", CREW.crewUuid, "2026-10-01T00:00:00Z"),
      row("theirs", OTHER_CREW, "2026-10-20T00:00:00Z"),
    ];
    expect(findLatestCrewAppraisal(rows, CREW)?.appraisalUuid).toBe("mine");
  });

  it("does not match rows with no crew when the crew has no emp_no", () => {
    const rows = [row("blank", "", "2026-10-01T00:00:00Z"), row("null", null, "2026-10-01T00:00:00Z")];
    expect(findLatestCrewAppraisal(rows, { crewUuid: CREW.crewUuid, crewEmpNo: "" })).toBeNull();
    expect(findLatestCrewAppraisal(rows, { crewUuid: "", crewEmpNo: "" })).toBeNull();
  });

  it("picks the newest row across both keys, by updatedAt then createdAt", () => {
    const rows = [
      row("old-uuid", CREW.crewUuid, "2026-10-01T00:00:00Z"),
      row("new-empno-draft", CREW.crewEmpNo, "2026-10-29T00:00:00Z"),
      row("created-only", CREW.crewUuid, null, "2026-10-15T00:00:00Z"),
    ];
    expect(findLatestCrewAppraisal(rows, CREW)?.appraisalUuid).toBe("new-empno-draft");
    expect(findLatestCrewAppraisal(rows.filter((r) => r.appraisalUuid !== "new-empno-draft"), CREW)?.appraisalUuid).toBe(
      "created-only",
    );
  });

  it("returns null when the crew has no appraisals", () => {
    expect(findLatestCrewAppraisal([], CREW)).toBeNull();
  });
});

describe("APD-51 Vessel page uses portable keys only", () => {
  const source = readFileSync(join(__dirname, "../../client/src/modules/vessel/VesselModule_v2.tsx"), "utf-8");

  it("both Appraisal cells use the shared lookup", () => {
    expect(source.match(/findLatestCrewAppraisal\(allAppraisals, planning\)/g)).toHaveLength(2);
    expect(source).not.toMatch(/a\.crewMemberId\s*===\s*planning\./);
  });

  it("never opens an appraisal by its serial id", () => {
    expect(source).not.toMatch(/latestAppraisal\??\.id\b/);
  });
});
