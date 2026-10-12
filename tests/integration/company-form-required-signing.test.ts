import { afterAll, describe, expect, it } from "vitest";
import { createRequirementFixture, requirementApi, requirementPool, requirementToken } from "../helpers/company-form-requirement-fixtures";
import { retainFixtureReferences } from "../helpers/fixture-retention";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

describe("required before-joining form: representative, witnessed seafarer, then Submit", () => {
  afterAll(async () => { await requirementPool.end(); });

  it("uses the captured contract UUID, not the mutable crew rank, and completes the pinned requirement", async () => {
    const f = await createRequirementFixture("before_joining", { signatures: true, rankSystemField: true });
    await f.record("required-signing-regression", [{
      formVersionUuid: f.version.fvUuid, status: "OUTSTANDING", matchedSetUuids: f.matchedSetUuids, values: {},
    }]);
    await requirementPool.query("UPDATE crew_members_v2 SET present_rank='TEST ONLY DIFFERENT CURRENT RANK' WHERE crew_uuid=$1", [f.crewUuid]);
    const requirement = (await requirementPool.query(
      "SELECT requirement_uuid FROM frm_requirements WHERE subject_ref=$1", [f.assignUuid],
    )).rows[0].requirement_uuid;
    const prefix = "/api/v2/company-form-submissions";
    const start = await requirementApi.post(
      `${prefix}/subjects/crew_assignment/${f.assignUuid}/requirements/${requirement}/start`,
    ).set("Authorization", `Bearer ${requirementToken}`).send({});
    expect(start.status, JSON.stringify(start.body)).toBe(201);
    const submission = start.body.submissionUuid;
    retainFixtureReferences("required dual-signature regression submission", [submission, requirement]);
    const section = `${prefix}/${submission}/sections/${f.section}`;
    for (const signature of [
      { signatureType: "officer", method: "officer" },
      { signatureType: "seafarer", method: "witnessed", seafarerPresent: true },
    ]) {
      const result = await requirementApi.post(`${section}/signatures`)
        .set("Authorization", `Bearer ${requirementToken}`).send({ ...signature, data: PNG });
      expect(result.status, `${signature.signatureType}: ${JSON.stringify(result.body)}`).toBe(201);
    }
    const submit = await requirementApi.post(`${section}/submit`)
      .set("Authorization", `Bearer ${requirementToken}`).send({});
    expect(submit.status, JSON.stringify(submit.body)).toBe(200);
    expect(submit.body.completed).toBe(true);
    const result = (await requirementPool.query(`SELECT r.status,s.status AS form_status,
      r.current_submission_uuid FROM frm_requirements r
      JOIN frm_company_submissions s ON s.submission_uuid=r.current_submission_uuid
      WHERE r.requirement_uuid=$1`, [requirement])).rows[0];
    expect(result).toEqual({ status: "COMPLETED", form_status: "completed", current_submission_uuid: submission });
    const signatures = (await requirementPool.query(`SELECT g.* FROM frm_section_signatures g
      JOIN frm_section_states st USING(section_state_uuid) WHERE st.submission_uuid=$1`, [submission])).rows;
    retainFixtureReferences("required dual-signature regression retained children", signatures);
    expect(signatures).toHaveLength(2);
    expect(signatures.find(s => s.signature_type === "seafarer").signer_rank).toBe(f.rank.name);
    const snapshot = (await requirementPool.query(`SELECT value,system_value FROM frm_company_submission_system_snapshots
      WHERE submission_uuid=$1 AND field_key='rank'`, [submission])).rows[0];
    expect(snapshot.value).toBe(f.rank.name);
    expect(snapshot.system_value).toBe(f.rank.ar_uuid);
  });

  it("saves missing rank as Not recorded, completes, and keeps signature and System field frozen after later capture", async () => {
    const f = await createRequirementFixture("before_joining", { signatures: true, unresolvedContractRank: true, rankSystemField: true });
    await f.record("required-signing-unknown-rank", [{
      formVersionUuid: f.version.fvUuid, status: "OUTSTANDING",
      matchedSetUuids: f.matchedSetUuids, values: {},
    }]);
    await requirementPool.query("UPDATE crew_members_v2 SET present_rank=$2 WHERE crew_uuid=$1", [f.crewUuid, f.rank.ar_uuid]);
    const requirement = (await requirementPool.query("SELECT requirement_uuid FROM frm_requirements WHERE subject_ref=$1", [f.assignUuid])).rows[0].requirement_uuid;
    const prefix = "/api/v2/company-form-submissions";
    const started = await requirementApi.post(`${prefix}/subjects/crew_assignment/${f.assignUuid}/requirements/${requirement}/start`)
      .set("Authorization", `Bearer ${requirementToken}`).send({});
    expect(started.status).toBe(201);
    const submission = started.body.submissionUuid;
    retainFixtureReferences("required signing unknown-rank submission", [submission, requirement]);
    const section = `${prefix}/${submission}/sections/${f.section}`;
    for (const signature of [
      { signatureType: "officer", method: "officer" },
      { signatureType: "seafarer", method: "witnessed", seafarerPresent: true },
    ]) {
      const result = await requirementApi.post(`${section}/signatures`).set("Authorization", `Bearer ${requirementToken}`)
        .send({ ...signature, data: PNG });
      expect(result.status, JSON.stringify(result.body)).toBe(201);
    }
    const submit = await requirementApi.post(`${section}/submit`).set("Authorization", `Bearer ${requirementToken}`).send({});
    expect(submit.status, JSON.stringify(submit.body)).toBe(200);
    expect(submit.body.completed).toBe(true);
    await requirementPool.query(`UPDATE crew_assignment_rule_context SET contract_rank_uuid=$2,contract_rank_label=$3
      WHERE assign_uuid=$1`, [f.assignUuid, f.rank.ar_uuid, f.rank.name]);
    const signature = (await requirementPool.query(`SELECT g.* FROM frm_section_signatures g JOIN frm_section_states st
      USING(section_state_uuid) WHERE st.submission_uuid=$1 AND g.signature_type='seafarer'`, [submission])).rows[0];
    retainFixtureReferences("missing rank witnessed signature frozen after capture", [signature]);
    expect(signature.signer_rank).toBe("Not recorded");
    const detail = await requirementApi.get(`${prefix}/${submission}/render`).set("Authorization", `Bearer ${requirementToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.systemFields.find((field: any) => field.key === "rank").value).toBe("Not recorded");
    expect((await requirementPool.query("SELECT status FROM frm_requirements WHERE requirement_uuid=$1", [requirement])).rows[0].status).toBe("COMPLETED");
  });
});
