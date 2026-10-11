import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { createRequirementFixture, formCall, requirementApi, requirementPool, requirementToken } from "../../helpers/company-form-requirement-fixtures";
import { readRequirements } from "../../../server/v2/company-forms/requirementsRepository";
import { retainFixtureReferences } from "../../helpers/fixture-retention";

describe("pinned required and unchanged manual starting", () => {
  let f: Awaited<ReturnType<typeof createRequirementFixture>>, requirement: any;
  let manual: Awaited<ReturnType<typeof createRequirementFixture>>;
  const base = () => `/api/v2/company-form-submissions/subjects/crew_assignment/${f.assignUuid}`;
  beforeAll(async () => {
    f = await createRequirementFixture(); manual = await createRequirementFixture();
    await f.record("required-start-evidence", [{ formVersionUuid: f.version.fvUuid, status: "OUTSTANDING",
      matchedSetUuids: [], values: { firstEver: true } }]);
    requirement = (await readRequirements("crew_assignment", f.assignUuid)).requirements[0];
    retainFixtureReferences("required start obligation", [requirement.requirement_uuid]);
    const copy = await formCall("post", `/forms/${f.formId}/versions`, {
      versionNo: "01", versionDate: "11-Oct-2026", configuration: "{}", stageKey: "before_joining",
    });
    expect(copy.status).toBe(200);
    retainFixtureReferences("newer release for old-pin start", [copy.body.fvUuid]);
    expect((await formCall("post", `/form-versions/${copy.body.id}/release`)).status).toBe(200);
  });
  afterAll(async () => { await requirementPool.end(); });
  it("keeps manual starts available without any stage run", async () => {
    const result = await requirementApi.post(`/api/v2/company-form-submissions/subjects/crew_assignment/${manual.assignUuid}/submissions`)
      .set("Authorization", `Bearer ${requirementToken}`).send({ formUuid: manual.formUuid, formVersionUuid: manual.version.fvUuid });
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    expect(result.body.origin).toBe("MANUAL"); expect(result.body.requirementUuid).toBeNull();
    retainFixtureReferences("manual without stage check", [result.body.submissionUuid]);
  });
  it("rejects browser pins and manual bypass, and starts the older pinned version", async () => {
    const url = `${base()}/requirements/${requirement.requirement_uuid}/start`;
    expect((await requirementApi.post(url).set("Authorization", `Bearer ${requirementToken}`)
      .send({ formVersionUuid: f.version.fvUuid, actorUuid: "forged" })).status).toBe(400);
    const manual = await requirementApi.post(`${base()}/submissions`).set("Authorization", `Bearer ${requirementToken}`)
      .send({ formUuid: f.formUuid, formVersionUuid: f.version.fvUuid });
    expect(manual.status).toBe(409);
    const start = await requirementApi.post(url).set("Authorization", `Bearer ${requirementToken}`).send({});
    expect(start.status, JSON.stringify(start.body)).toBe(201);
    expect(start.body.formVersionUuid).toBe(f.version.fvUuid);
    expect(start.body.origin).toBe("REQUIRED");
    expect(start.body.requirementUuid).toBe(requirement.requirement_uuid);
    retainFixtureReferences("required old-pin form", [start.body.submissionUuid]);
    expect((await readRequirements("crew_assignment", f.assignUuid)).requirements[0].status).toBe("STARTED");
    expect((await requirementApi.post(url).set("Authorization", `Bearer ${requirementToken}`).send({})).status).toBe(409);
  });
});
