import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// APD-48: appraisal_results_v2.crew_member_id names the crew by crew_uuid, or
// by emp_no in older rows. The Training Needs list also matched it against the
// serial crew id, which differs between ship and shore, so an old numeric value
// showed another crew member's name.

const source = readFileSync(
  join(__dirname, "../../server/v2/training-needs/repository.ts"),
  "utf-8",
);

// The crew name lookup inside the appraisal query.
const appraisalNameLookup = source.match(
  /FROM crew_members_v2 cm\s+WHERE cm\.is_deleted = FALSE\s+AND \(([\s\S]*?)\)\s+HAVING COUNT\(\*\) = 1/,
)![1];

describe("APD-48 Training Needs resolves an appraisal's crew by portable keys only", () => {
  it("matches emp_no and crew_uuid", () => {
    expect(appraisalNameLookup).toMatch(/cm\.emp_no = ar\.crew_member_id/);
    expect(appraisalNameLookup).toMatch(/cm\.crew_uuid = ar\.crew_member_id/);
  });

  it("never matches the serial crew id", () => {
    expect(appraisalNameLookup).not.toMatch(/cm\.id\b/);
    expect(source).not.toMatch(/cm\.id::text\s*=\s*ar\.crew_member_id/);
  });
});
