import { openHarnessStages } from "../../helpers/company-form-stage-fixtures";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequirementFixture, requirementApi, requirementPool, requirementToken, requirementTokenFor } from "../../helpers/company-form-requirement-fixtures";
import { readRequirements, withdrawNotStarted } from "../../../server/v2/company-forms/requirementsRepository";
import { retainFixtureReferences } from "../../helpers/fixture-retention";

describe("atomic required form lifecycle and preserved cancellation history", () => {
  let f: Awaited<ReturnType<typeof createRequirementFixture>>, r: any, submissionUuid: string;
  let voidActorId: number;
  const base = () => `/api/v2/company-form-submissions/subjects/crew_assignment/${f.assignUuid}`;
  const post = (path: string, body: object = {}) => requirementApi.post(path).set("Authorization", `Bearer ${requirementToken}`).send(body);
  beforeAll(async () => {
    const actor = (await requirementPool.query(`SELECT u.id FROM master_users u JOIN adm_rolemaster_ac r
      ON r.assigned_role=u.role AND NOT r.is_deleted AND r.is_active JOIN adm_resource_action_grants g ON g.role_id=r.ruid
      WHERE g.resource='company_forms' AND g.action='void_completed' AND g.allowed AND lower(r.roletype)='office'
      AND NULLIF(btrim(u.fullname),'') IS NOT NULL
      ORDER BY u.id LIMIT 1`)).rows[0];
    if (!actor) throw new Error("A retained Office actor with Void completed is required; do not broaden existing grants.");
    voidActorId = actor.id;
    f = await createRequirementFixture();
    await f.record("lifecycle", [{ formVersionUuid: f.version.fvUuid, status: "OUTSTANDING", matchedSetUuids: [], values: {} }]);
    r = (await readRequirements("crew_assignment", f.assignUuid)).requirements[0];
    retainFixtureReferences("required lifecycle obligation", [r.requirement_uuid]);
  }, 60000);
  afterAll(async () => { await requirementPool.end(); });
  it("serializes concurrent starts and preserves the signed/started pin on re-resolution", async () => {
    const starts = await Promise.all([post(`${base()}/requirements/${r.requirement_uuid}/start`),
      post(`${base()}/requirements/${r.requirement_uuid}/start`)]);
    expect(starts.map(s => s.status).sort()).toEqual([201, 409]);
    submissionUuid = starts.find(s => s.status === 201)!.body.submissionUuid;
    retainFixtureReferences("lifecycle initial form", [submissionUuid]);
    await withdrawNotStarted({ ...f.base, reason: "Retained deferral evidence" });
    expect((await readRequirements("crew_assignment", f.assignUuid)).requirements[0].status).toBe("STARTED");
    await f.record("additive", [{ formVersionUuid: f.version.fvUuid, status: "OUTSTANDING", matchedSetUuids: [], values: {} }]);
    expect((await readRequirements("crew_assignment", f.assignUuid)).requirements).toHaveLength(1);
  });
  it("completes atomically, refuses false status, then voids to OUTSTANDING", async () => {
    const answer = await requirementApi.put(`/api/v2/company-form-submissions/${submissionUuid}/sections/${f.section}/answers`)
      .set("Authorization", `Bearer ${requirementToken}`).send({ answers: [{ questionUuid: f.question, value: "Retained completion evidence" }] });
    expect(answer.status, JSON.stringify(answer.body)).toBe(204);
    const completed = await post(`/api/v2/company-form-submissions/${submissionUuid}/sections/${f.section}/submit`);
    expect(completed.status, JSON.stringify(completed.body)).toBe(200);
    expect((await readRequirements("crew_assignment", f.assignUuid)).requirements[0].status).toBe("COMPLETED");
    await expect(requirementPool.query("UPDATE frm_requirements SET status='OUTSTANDING',current_submission_uuid=NULL WHERE requirement_uuid=$1",
      [r.requirement_uuid])).rejects.toMatchObject({ code: "23514" });
    const voided = await requirementApi.post(`/api/v2/company-form-submissions/${submissionUuid}/void`)
      .set("Authorization", `Bearer ${requirementTokenFor(voidActorId)}`).send({ reason: "Retained required replacement evidence" });
    expect(voided.status, JSON.stringify(voided.body)).toBe(204);
    const after = (await readRequirements("crew_assignment", f.assignUuid)).requirements[0];
    expect(after.status).toBe("OUTSTANDING"); expect(after.current_submission_uuid).toBeNull();
    expect(after.history.map((h: any) => h.event)).toEqual(["RESOLVED", "STARTED", "COMPLETED", "OUTSTANDING"]);
    expect(after.history.at(-1).reason).toBe("Retained required replacement evidence");
    expect(after.history.at(-1).actor_uuid).toBe(String(voidActorId));
  });
  it("attaches replacement to the same pin and requirement, then excludes cancellation from outstanding", async () => {
    const replacement = await post(`${base()}/requirements/${r.requirement_uuid}/start`);
    expect(replacement.status, JSON.stringify(replacement.body)).toBe(201);
    expect(replacement.body.requirementUuid).toBe(r.requirement_uuid);
    expect(replacement.body.formVersionUuid).toBe(f.version.fvUuid);
    expect(replacement.body.replacesSubmissionUuid).toBe(submissionUuid);
    retainFixtureReferences("required replacement form", [replacement.body.submissionUuid]);
    await requirementPool.query("UPDATE crew_assignments SET assignment_type='Cancelled' WHERE assign_uuid=$1", [f.assignUuid]);
    const history = await requirementApi.get(`${base()}/requirements`).set("Authorization", `Bearer ${requirementToken}`);
    expect(history.status).toBe(200); expect(history.body.outstandingEligible).toBe(false);
    expect(history.body.activeRequirements).toEqual([]);
    expect(history.body.requirements[0].history).toHaveLength(5);
    expect((await post(`${base()}/requirements/${r.requirement_uuid}/start`)).status).toBe(409);
  });
  it("never substitutes manual fulfillment, and records unresolved decisions and failed checks", async () => {
    const manual = await createRequirementFixture();
    await openHarnessStages(requirementPool, manual.assignUuid, ["before_joining"]);
    const root = `/api/v2/company-form-submissions/subjects/crew_assignment/${manual.assignUuid}`;
    const started = await post(`${root}/submissions`, { formUuid: manual.formUuid, formVersionUuid: manual.version.fvUuid });
    expect(started.status).toBe(201);
    const recorded = await manual.record("later-cycle", [{ formVersionUuid: manual.version.fvUuid,
      status: "OUTSTANDING", matchedSetUuids: [], values: { existingManual: true } }]);
    let data = await readRequirements("crew_assignment", manual.assignUuid);
    expect(data.requirements[0].status).toBe("OUTSTANDING");
    expect(data.requirements[0].existing_form.origin).toBe("MANUAL");
    expect((await post(`${root}/requirements/${data.requirements[0].requirement_uuid}/start`)).status).toBe(409);
    retainFixtureReferences("earlier manual collision", [started.body.submissionUuid, recorded.run.run_uuid, data.requirements[0].requirement_uuid]);
    expect((await post(`/api/v2/company-form-submissions/${started.body.submissionUuid}/void`, { reason: "Explicitly remove earlier manual conflict" })).status).toBe(204);
    const required = await post(`${root}/requirements/${data.requirements[0].requirement_uuid}/start`);
    expect(required.status).toBe(201);
    retainFixtureReferences("manual conflict required replacement", [required.body.submissionUuid]);
    const unresolved = await createRequirementFixture();
    await unresolved.record("missing", [{ formVersionUuid: unresolved.version.fvUuid,
      status: "UNRESOLVED", matchedSetUuids: [], values: { nationality: null }, unresolvedReason: "Nationality is missing" }]);
    data = await readRequirements("crew_assignment", unresolved.assignUuid);
    retainFixtureReferences("unresolved obligation", [data.requirements[0].requirement_uuid]);
    expect(data.requirements[0].status).toBe("UNRESOLVED");
    const root2 = `/api/v2/company-form-submissions/subjects/crew_assignment/${unresolved.assignUuid}`;
    expect((await post(`${root2}/requirements/${data.requirements[0].requirement_uuid}/start`)).status).toBe(409);
    const checked = await unresolved.record("facts-now-known", [{ formVersionUuid: unresolved.version.fvUuid,
      status: "OUTSTANDING", matchedSetUuids: [], values: { nationality: "Verified by retained harness" } }]);
    const verified = (await readRequirements("crew_assignment", unresolved.assignUuid)).requirements[0];
    expect(verified.requirement_uuid).toBe(data.requirements[0].requirement_uuid);
    expect(verified.form_version_uuid).toBe(unresolved.version.fvUuid);
    expect(verified.status).toBe("OUTSTANDING");
    expect(verified.history.at(-1).run_uuid).toBe(checked.run.run_uuid);
    const { recordResolution } = await import("../../../server/v2/company-forms/requirementsRepository");
    const failed = await recordResolution({ ...unresolved.base, cycleUuid: randomUUID(), eventKey: "failed",
      outcome: "FAILED", failureReason: "Retained failed-check evidence", decisions: [] });
    retainFixtureReferences("failed run", [failed.run.run_uuid]);
    expect(failed.run.outcome).toBe("FAILED");
  });
});
