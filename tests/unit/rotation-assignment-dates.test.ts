import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { rotationAssignmentsForSave } from "../../client/src/modules/rotation/assignmentDates";
import { relieverJoiningDate } from "../../client/src/modules/vessel/relieverJoiningDate";

describe("Rotation's persisted joining date", () => {
  it.each(["Asia/Kolkata", "America/Los_Angeles", "UTC"])(
    "preserves the selected calendar day and initial compliance in %s",
    timeZone => {
      // A real child process applies TZ to Date/date-fns, independently of
      // Vitest's DOM/worker clock. Import only pure modules: no DB or app boot.
      const output = execFileSync(process.execPath, [
        "--import", "tsx", "--input-type=module", "-e", `
          import { rotationAssignmentsForSave } from "./client/src/modules/rotation/assignmentDates.ts";
          import { calculateTrainingCompliance } from "./server/v2/shared/training-compliance/calculator.ts";
          import { format, parseISO } from "date-fns";
          const selected = new Date(2026, 10, 16);
          const assignments = [{ joiningDate: selected.toISOString(), crewUuid: "reliever", contractPeriod: 3 }];
          const input = {
            assignmentUuid: "assignment", vesselUuid: "vessel", contractRankUuid: "captured-rank",
            plannedJoiningDate: assignments[0].joiningDate, contractPeriodMonths: 3, certificates: [],
            matrix: { revisionUuid: "revision", revision: "R0", equivalents: [],
              requirements: Array.from({ length: 14 }, (_, i) => ({
                courseUuid: "course-" + i, name: "Training " + i, obligation: "mandatory"
              })) }
          };
          const before = calculateTrainingCompliance(input);
          const saved = rotationAssignmentsForSave(assignments);
          const initial = calculateTrainingCompliance({ ...input, plannedJoiningDate: saved[0].joiningDate });
          const afterNoChangeSave = calculateTrainingCompliance({
            ...input, plannedJoiningDate: rotationAssignmentsForSave(saved)[0].joiningDate
          });
          console.log(JSON.stringify({ original: assignments[0].joiningDate, saved: saved[0],
            reopenedDay: format(parseISO(saved[0].joiningDate), "yyyy-MM-dd"),
            before: { status: before.status, courses: before.courses.length, issues: before.issues.map(i => i.code) },
            initial, afterNoChangeSave }));
        `,
      ], { cwd: process.cwd(), env: { ...process.env, TZ: timeZone }, encoding: "utf8" });
      const result = JSON.parse(output);
      // This reproduces the old persisted timestamp -> empty/incomplete result.
      expect(result.before).toMatchObject({ status: "incomplete", courses: 0 });
      expect(result.before.issues).toContain("INVALID_JOINING_DATE");
      expect(result.saved).toEqual({ joiningDate: "2026-11-16", crewUuid: "reliever", contractPeriod: 3 });
      expect(result.original).toContain("T");
      expect(result.reopenedDay).toBe("2026-11-16");
      expect(result.initial).toMatchObject({
        status: "complete", joiningDate: "2026-11-16", contractEnd: "2027-02-16",
        summary: { mandatory: { status: "gap", count: 14 }, recommended: { status: "valid", count: 0 } },
      });
      expect(result.initial.courses).toHaveLength(14);
      expect(result.initial.courses.every((c: { state: string }) => c.state === "Not held")).toBe(true);
      expect(result.afterNoChangeSave).toEqual(result.initial);
    },
  );

  it("leaves calendar dates and all non-date assignment facts unchanged without mutating input", () => {
    const input = Object.freeze([Object.freeze({
      joiningDate: "2026-11-16", crewUuid: "reliever", vesselUuid: "vessel",
      rankId: "rank", contractPeriod: 3,
    })]);
    const saved = rotationAssignmentsForSave(input);
    expect(saved).toEqual(input);
    expect(saved).not.toBe(input);
    expect(saved[0]).not.toBe(input[0]);
    expect(rotationAssignmentsForSave(saved)).toEqual(saved);
  });

  it("refuses invalid dates rather than substituting today or saving an invalid value", () => {
    expect(() => rotationAssignmentsForSave([{ joiningDate: "not-a-date" }])).toThrow();
  });
});

describe("Reliever form date identity", () => {
  it("never fills a missing reliever date with the incumbent's joining date", () => {
    expect(relieverJoiningDate({
      crewUuid: "incumbent", relieverCrewUuid: "reliever", signOnDate: "2026-06-23",
    })).toBeUndefined();
  });

  it("retains an explicitly recorded reliever date", () => {
    expect(relieverJoiningDate({
      crewUuid: "incumbent", relieverCrewUuid: "reliever",
      signOnDate: "2026-06-23", relieverSignOnDate: "2026-11-16",
    })).toBe("2026-11-16");
  });

  it("retains the date on a separate row positively identified as the reliever", () => {
    expect(relieverJoiningDate({
      crewUuid: "reliever", relieverCrewId: "reliever", signOnDate: "2026-11-16",
    })).toBe("2026-11-16");
  });

  it("does not assume an unlinked crew row is the reliever", () => {
    expect(relieverJoiningDate({ crewUuid: "unknown", signOnDate: "2026-06-23" })).toBeUndefined();
  });
});
