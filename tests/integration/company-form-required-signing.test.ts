import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
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
    const detail = await requirementApi.get(`${prefix}/${submission}/form`).set("Authorization", `Bearer ${requirementToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.systemFields.find((field: any) => field.key === "rank").value).toBe("Not recorded");
    expect((await requirementPool.query("SELECT status FROM frm_requirements WHERE requirement_uuid=$1", [requirement])).rows[0].status).toBe("COMPLETED");
  });

  it("keeps Not recorded when capture happens between the representative and witnessed signatures", async () => {
    const f = await createRequirementFixture("before_joining", { signatures: true, unresolvedContractRank: true, rankSystemField: true });
    const prefix = "/api/v2/company-form-submissions";
    await f.record("rank-capture-between-signatures", [{
      formVersionUuid: f.version.fvUuid, status: "OUTSTANDING", matchedSetUuids: f.matchedSetUuids, values: {},
    }]);
    const requirement = (await requirementPool.query("SELECT requirement_uuid FROM frm_requirements WHERE subject_ref=$1", [f.assignUuid])).rows[0].requirement_uuid;
    const start = await requirementApi.post(`${prefix}/subjects/crew_assignment/${f.assignUuid}/requirements/${requirement}/start`)
      .set("Authorization", `Bearer ${requirementToken}`).send({});
    expect(start.status, JSON.stringify(start.body)).toBe(201);
    const submission = start.body.submissionUuid;
    retainFixtureReferences("contract capture between signatures", [submission, requirement]);
    const section = `${prefix}/${submission}/sections/${f.section}`;
    const officer = await requirementApi.post(`${section}/signatures`).set("Authorization", `Bearer ${requirementToken}`)
      .send({ signatureType: "officer", method: "officer", data: PNG });
    expect(officer.status, JSON.stringify(officer.body)).toBe(201);
    await requirementPool.query(`UPDATE crew_assignment_rule_context SET contract_rank_uuid=$2,contract_rank_label=$3
      WHERE assign_uuid=$1`, [f.assignUuid, f.rank.ar_uuid, f.rank.name]);
    const seafarer = await requirementApi.post(`${section}/signatures`).set("Authorization", `Bearer ${requirementToken}`)
      .send({ signatureType: "seafarer", method: "witnessed", seafarerPresent: true, data: PNG });
    expect(seafarer.status, JSON.stringify(seafarer.body)).toBe(201);
    const submitted = await requirementApi.post(`${section}/submit`).set("Authorization", `Bearer ${requirementToken}`).send({});
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200);
    expect(submitted.body.completed).toBe(true);
    const view = await requirementApi.get(`${prefix}/${submission}/form`).set("Authorization", `Bearer ${requirementToken}`);
    expect(view.body.systemFields.find((field: any) => field.key === "rank").value).toBe("Not recorded");
    const signatures = (await requirementPool.query(`SELECT g.* FROM frm_section_signatures g JOIN frm_section_states st
      USING(section_state_uuid) WHERE st.submission_uuid=$1`, [submission])).rows;
    retainFixtureReferences("capture-between-signatures retained children", signatures);
    expect(signatures.find(s => s.signature_type === "seafarer").signer_rank).toBe("Not recorded");
  });

  it("shows the frozen missing signature rank on an older form without rewriting its profile-derived snapshot", async () => {
    const f = await createRequirementFixture("before_joining", { signatures: true, unresolvedContractRank: true, rankSystemField: true });
    await f.record("legacy-profile-rank-snapshot", [{
      formVersionUuid: f.version.fvUuid, status: "OUTSTANDING", matchedSetUuids: f.matchedSetUuids, values: {},
    }]);
    const requirement = (await requirementPool.query("SELECT requirement_uuid FROM frm_requirements WHERE subject_ref=$1", [f.assignUuid])).rows[0].requirement_uuid;
    const prefix = "/api/v2/company-form-submissions";
    const started = await requirementApi.post(`${prefix}/subjects/crew_assignment/${f.assignUuid}/requirements/${requirement}/start`)
      .set("Authorization", `Bearer ${requirementToken}`).send({});
    expect(started.status).toBe(201);
    const submission = started.body.submissionUuid, snapshotUuid = randomUUID();
    const question = (await requirementPool.query("SELECT question_uuid FROM frm_questions WHERE section_uuid=$1 AND system_field_key='rank'", [f.section])).rows[0].question_uuid;
    retainFixtureReferences("legacy rank snapshot retained provenance", [submission, requirement, snapshotUuid, question]);
    await requirementPool.query(`INSERT INTO frm_company_submission_system_snapshots
      (snapshot_uuid,submission_uuid,field_key,section_uuid,question_uuid,value,system_value,created_by_uuid)
      VALUES($1,$2,'rank',$3,$4,'TEST ONLY LEGACY PROFILE RANK','legacy-profile-reference','24')`,
    [snapshotUuid, submission, f.section, question]);
    await requirementPool.query(`UPDATE frm_company_submissions SET system_snapshot_at=now(),system_snapshot_event='signature'
      WHERE submission_uuid=$1`, [submission]);
    for (const signature of [
      { signatureType: "officer", method: "officer" },
      { signatureType: "seafarer", method: "witnessed", seafarerPresent: true },
    ]) {
      const result = await requirementApi.post(`${prefix}/${submission}/sections/${f.section}/signatures`)
        .set("Authorization", `Bearer ${requirementToken}`).send({ ...signature, data: PNG });
      expect(result.status, JSON.stringify(result.body)).toBe(201);
    }
    const result = await requirementApi.post(`${prefix}/${submission}/sections/${f.section}/submit`)
      .set("Authorization", `Bearer ${requirementToken}`).send({});
    expect(result.body.completed).toBe(true);
    const view = await requirementApi.get(`${prefix}/${submission}/form`).set("Authorization", `Bearer ${requirementToken}`);
    const field = view.body.systemFields.find((field: any) => field.key === "rank");
    expect(field).toMatchObject({ value: "Not recorded", valueOrigin: "frozen_signature" });
    const point = view.body.parts.flatMap((part: any) => part.sections).flatMap((section: any) => section.questions)
      .find((point: any) => point.questionUuid === question);
    expect(point.systemField).toMatchObject({ value: "Not recorded", valueOrigin: "frozen_signature" });
    expect((await requirementPool.query("SELECT value FROM frm_company_submission_system_snapshots WHERE snapshot_uuid=$1", [snapshotUuid])).rows[0].value)
      .toBe("TEST ONLY LEGACY PROFILE RANK");
  });
});
