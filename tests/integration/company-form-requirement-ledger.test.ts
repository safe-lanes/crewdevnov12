import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { createRequirementFixture, requirementPool } from "../helpers/company-form-requirement-fixtures";
import { readRequirements } from "../../server/v2/company-forms/requirementsRepository";
import { retainFixtureReferences } from "../helpers/fixture-retention";

describe("retained requirement recording harness", () => {
  let fixture: Awaited<ReturnType<typeof createRequirementFixture>>;
  beforeAll(async () => { fixture = await createRequirementFixture(); });
  afterAll(async () => { await requirementPool.end(); });
  it("records empty checks and retries without creating forms", async () => {
    expect((await readRequirements("crew_assignment", fixture.assignUuid)).runs).toHaveLength(0);
    const first = await fixture.record("empty");
    retainFixtureReferences("empty requirement run", [first.run.run_uuid]);
    expect(first.run.outcome).toBe("COMPLETED");
    expect((await fixture.record("empty")).retried).toBe(true);
    expect((await readRequirements("crew_assignment", fixture.assignUuid)).requirements).toHaveLength(0);
  });
  it("creates one pinned obligation, freezes evidence and appends only history", async () => {
    const run = await fixture.record("matched", [{ formVersionUuid: fixture.version.fvUuid,
      status: "OUTSTANDING", matchedSetUuids: [], values: { reliefIncluded: true } }]);
    const data = await readRequirements("crew_assignment", fixture.assignUuid);
    expect(data.requirements).toHaveLength(1);
    const r = data.requirements[0];
    retainFixtureReferences("pinned requirement and resolution", [run.run.run_uuid, r.requirement_uuid]);
    expect(r.form_version_uuid).toBe(fixture.version.fvUuid);
    expect(r.status).toBe("OUTSTANDING"); expect(r.mandatory).toBe(true);
    expect(r.history).toHaveLength(1);
    await fixture.record("matched-again", [{ formVersionUuid: fixture.version.fvUuid,
      status: "OUTSTANDING", matchedSetUuids: [], values: {} }]);
    expect((await readRequirements("crew_assignment", fixture.assignUuid)).requirements).toHaveLength(1);
    await expect(requirementPool.query("UPDATE frm_requirements SET deciding_evidence='{}' WHERE requirement_uuid=$1",
      [r.requirement_uuid])).rejects.toMatchObject({ code: "23514" });
    await expect(requirementPool.query("UPDATE frm_requirement_history SET event='forged' WHERE requirement_uuid=$1",
      [r.requirement_uuid])).rejects.toMatchObject({ code: "23514" });
    expect((await requirementPool.query("SELECT count(*)::int n FROM frm_company_submissions WHERE form_uuid=$1", [fixture.formUuid])).rows[0].n).toBe(0);
  });
});
