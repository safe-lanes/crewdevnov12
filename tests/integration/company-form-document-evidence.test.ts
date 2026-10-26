import { afterAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import {
  createRequirementFixture, requirementApi, requirementPool, requirementToken, requirementTokenFor,
} from "../helpers/company-form-requirement-fixtures";
import { retainFixtureReferences } from "../helpers/fixture-retention";
import { grantCompanyFormFixture } from "../helpers/companyFormGrants";
import { drizzle } from "drizzle-orm/node-postgres";
import { tenantConnectionManager } from "../../server/utils/tenantConnectionManager";
import { getDb } from "../../server/v2/db";
import { readDocumentEvidenceStatus } from "../../server/v2/company-forms/documentEvidenceRepository";
import { createDocumentPreparationQueue, prepareDocument } from "../../server/v2/company-forms/documentArchive";

const prefix = "/api/v2/company-form-submissions";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=";
const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const post = (path: string, body = {}) => requirementApi.post(path)
  .set("Authorization", `Bearer ${requirementToken}`).send(body);

async function start(missingRank = false) {
  const f = await createRequirementFixture("before_joining", {
    signatures: true, unresolvedContractRank: missingRank, rankSystemField: true,
  });
  await f.record("document-evidence", [{
    formVersionUuid: f.version.fvUuid, status: "OUTSTANDING",
    matchedSetUuids: f.matchedSetUuids, values: {},
  }]);
  const r = (await requirementPool.query(
    "SELECT requirement_uuid FROM frm_requirements WHERE subject_ref=$1", [f.assignUuid],
  )).rows[0];
  const response = await post(`${prefix}/subjects/crew_assignment/${f.assignUuid}/requirements/${r.requirement_uuid}/start`);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  const submission = response.body.submissionUuid;
  retainFixtureReferences("isolated document evidence fixtures", [submission, r.requirement_uuid, f.assignUuid]);
  return { ...f, submission, sectionPath: `${prefix}/${submission}/sections/${f.section}` };
}
type Fixture = Awaited<ReturnType<typeof start>>;
async function sign(f: Fixture, type: "officer" | "seafarer") {
  const response = await post(`${f.sectionPath}/signatures`, {
    signatureType: type, method: type === "officer" ? "officer" : "witnessed",
    ...(type === "seafarer" ? { seafarerPresent: true } : {}), data: PNG,
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
}
async function read(f: Fixture) {
  const response = await requirementApi.get(`${prefix}/${f.submission}/form`)
    .set("Authorization", `Bearer ${requirementToken}`);
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body;
}

describe("registered sample PDF archive", () => {
  it("authorizes branding by explicit management grant, versions it, and freezes the selected logo independently", async () => {
    const role = randomUUID(), name = `TEST ONLY PDF manager ${role.slice(0, 8)}`;
    await requirementPool.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,parent_owned)
      VALUES($1,$2,'Office',true)`, [role, name]);
    const user = (await requirementPool.query(`INSERT INTO master_users(user_uuid,fullname,role,user_type)
      VALUES($1,'Synthetic PDF manager',$2,'Office') RETURNING id`, [randomUUID(), name])).rows[0];
    await requirementPool.query(`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
      VALUES($1,'access_control','manage',true)`, [role]);
    const auth = `Bearer ${requirementTokenFor(user.id)}`;
    const url = `${prefix}/settings/branding`;
    try {
      expect((await requirementApi.post(url).set("Authorization", auth)
        .send({ companyName: "Sample company", dataUrl: PNG, actor: "Forged" })).status).toBe(400);
      const first = await requirementApi.post(url).set("Authorization", auth).send({ companyName: "Sample company", dataUrl: PNG });
      expect(first.status, JSON.stringify(first.body)).toBe(200);
      expect(first.body.realGenerationEnabled).toBe(true);
      expect(first.body.logoDataUrl).toBe(PNG);
      const version = first.body.logoVersionUuid;
      const f = await start(true);
      await sign(f, "officer");
      const second = await requirementApi.post(url).set("Authorization", auth).send({ companyName: "Sample company", dataUrl: null });
      expect(second.status).toBe(200);
      expect(second.body.logoVersionUuid).not.toBe(version);
      expect(second.body.logoDataUrl).toBeNull();
      expect(second.body.history[0].actorName).toBe("Synthetic PDF manager");
      const header = (await requirementPool.query("SELECT evidence FROM frm_document_headers WHERE submission_uuid=$1", [f.submission])).rows[0].evidence;
      expect(header.branding.logoVersionUuid).toBe(version);
      expect(header.branding.asset.bytesBase64).toBe(PNG.split(",")[1]);
      expect(header.branding.mode).toBe("logo");
      expect(header.documentReference).toMatch(/^CF-\d{4}-\d{6,}$/);
      const crew = (await requirementPool.query(`SELECT c.emp_no,n.nationality FROM crew_members_v2 c
        LEFT JOIN master_nationalities n ON n.nat_uuid=c.nationality_uuid WHERE c.crew_uuid=$1`, [f.crewUuid])).rows[0];
      expect(header.subject.fields).toContainEqual({ label: "Crew ID", value: crew.emp_no });
      expect(header.subject.fields).toContainEqual({ label: "Nationality", value: crew.nationality ?? null });
      await requirementPool.query("UPDATE crew_members_v2 SET emp_no=$1,nationality_uuid=NULL WHERE crew_uuid=$2",
        [`UPDATED-${f.submission}`, f.crewUuid]);
      await sign(f, "seafarer");
      expect((await post(`${f.sectionPath}/submit`)).status).toBe(200);
      const snapshot = (await requirementPool.query("SELECT input FROM frm_document_snapshots WHERE submission_uuid=$1", [f.submission])).rows[0].input;
      expect(snapshot.header.branding).toEqual(header.branding);
      expect(snapshot.header.documentReference).toBe(header.documentReference);
      expect(snapshot.header.subject).toEqual(header.subject);
      const other = await start(true);
      await sign(other, "officer");
      const otherHeader = (await requirementPool.query("SELECT evidence FROM frm_document_headers WHERE submission_uuid=$1", [other.submission])).rows[0].evidence;
      expect(otherHeader.documentReference).not.toBe(header.documentReference);
      await requirementPool.query("UPDATE adm_resource_action_grants SET allowed=false WHERE role_id=$1 AND resource='access_control'", [role]);
      expect((await requirementApi.get(url).set("Authorization", auth)).status).toBe(403);
    } finally {
      // Normal teardown is allowed only in the independently registered test DB.
      expect(process.env.TEST_DATABASE_VERIFIED).toBe("true");
      const client = await requirementPool.connect();
      try {
        await client.query("BEGIN");
        await client.query("ALTER TABLE frm_document_branding DISABLE TRIGGER USER");
        await client.query("DELETE FROM frm_document_branding WHERE actor->>'masterUserId'=$1", [String(user.id)]);
        await client.query("ALTER TABLE frm_document_branding ENABLE TRIGGER USER");
        await client.query("DELETE FROM adm_resource_action_grants WHERE role_id=$1", [role]);
        await client.query("DELETE FROM master_users WHERE id=$1", [user.id]);
        await client.query("DELETE FROM adm_rolemaster_ac WHERE ruid=$1", [role]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    }
  });
  it("drains disabled-period requests from frozen evidence only after the server enables generation", async () => {
    const f = await start(true);
    await sign(f, "officer");
    await sign(f, "seafarer");
    expect((await post(`${f.sectionPath}/submit`)).status).toBe(200);
    const snapshot = (await requirementPool.query(
      "SELECT input,frozen_record_sha256 FROM frm_document_snapshots WHERE submission_uuid=$1",
      [f.submission])).rows[0];
    // Simulate the disabled period, then drain using the approved default.
    await createDocumentPreparationQueue(() => false).drain(getDb(), f.submission);
    expect((await requirementPool.query("SELECT 1 FROM frm_document_files WHERE submission_uuid=$1",
      [f.submission])).rowCount).toBe(0);
    await requirementPool.query("UPDATE crew_members_v2 SET first_name='Changed after signing' WHERE crew_uuid=$1", [f.crewUuid]);
    const enabled = createDocumentPreparationQueue();
    await enabled.drain(getDb(), f.submission);
    const file = (await requirementPool.query(
      "SELECT file_sha256,frozen_record_sha256,pdf_bytes FROM frm_document_files WHERE submission_uuid=$1",
      [f.submission])).rows[0];
    expect(file).toBeDefined();
    expect(file.frozen_record_sha256).toBe(snapshot.frozen_record_sha256);
    expect(digest(file.pdf_bytes)).toBe(file.file_sha256);
    const after = (await requirementPool.query("SELECT input FROM frm_document_snapshots WHERE submission_uuid=$1",
      [f.submission])).rows[0].input;
    expect(after).toEqual(snapshot.input);
    await enabled.drain(getDb(), f.submission);
    expect((await requirementPool.query(
      "SELECT file_sha256 FROM frm_document_files WHERE submission_uuid=$1", [f.submission])).rows)
      .toEqual([{ file_sha256: file.file_sha256 }]);
    expect((await requirementPool.query(
      "SELECT 1 FROM frm_document_preparation_events WHERE submission_uuid=$1 AND outcome='READY'",
      [f.submission])).rowCount).toBe(1);
  });

  it("publishes non-sample forms once, serves identical bytes, and records a server-derived handover", async () => {
    const f = await start(true);
    await sign(f, "officer");
    await sign(f, "seafarer");
    expect((await post(`${f.sectionPath}/submit`)).status).toBe(200);
    const path = `${prefix}/${f.submission}/pdf`;
    expect((await requirementApi.get(`${path}/status`).set("Authorization", `Bearer ${requirementToken}`)).body.status).toBe("pending");
    const results = await Promise.all([post(`${path}/retry`), post(`${path}/retry`)]);
    for (const result of results) expect(result.status, JSON.stringify(result.body)).toBe(200);
    const file = (await requirementPool.query("SELECT * FROM frm_document_files WHERE submission_uuid=$1", [f.submission])).rows[0];
    expect(file.file_sha256).toBe(digest(file.pdf_bytes));
    expect(file.page_count).toBeGreaterThan(0);
    expect(file.pdf_bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const before = digest(file.pdf_bytes);
    await prepareDocument(f.submission);
    const again = (await requirementPool.query("SELECT * FROM frm_document_files WHERE submission_uuid=$1", [f.submission])).rows;
    expect(again).toHaveLength(1);
    expect(digest(again[0].pdf_bytes)).toBe(before);
    const download = await requirementApi.get(path).set("Authorization", `Bearer ${requirementToken}`)
      .buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = []; res.on("data", chunk => chunks.push(chunk));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(digest(download.body)).toBe(before);
    expect((await post(`${path}/handover`, { fileSha256: before, actorName: "Forged", actor_uuid: "999" })).status).toBe(400);
    expect((await post(`${path}/handover`, { fileSha256: "0".repeat(64) })).status).toBe(409);
    const handover = await post(`${path}/handover`, { fileSha256: before });
    expect(handover.status, JSON.stringify(handover.body)).toBe(201);
    const record = (await requirementPool.query("SELECT * FROM frm_document_handovers WHERE submission_uuid=$1", [f.submission])).rows[0];
    const user = (await requirementPool.query("SELECT * FROM master_users WHERE id=24")).rows[0];
    expect(record.actor_uuid).toBe(user.user_uuid ?? "24");
    expect(record.actor_name).toBe(user.fullname || user.display_name || `${user.firstname} ${user.lastname}`);
    expect(record.file_sha256).toBe(before);
    await expect(requirementPool.query("UPDATE frm_document_files SET file_sha256=$1 WHERE submission_uuid=$2", [before, f.submission])).rejects.toMatchObject({ code: "23514" });
    await expect(requirementPool.query("DELETE FROM frm_document_handovers WHERE submission_uuid=$1", [f.submission])).rejects.toMatchObject({ code: "23514" });
  });
});

describe("immutable Company Form document evidence in the registered test database", () => {
  afterAll(async () => { await requirementPool.end(); });

  it("freezes the first header and definition, then completes with recorded signatures, bytes and Not recorded", async () => {
    const f = await start(true);
    expect((await read(f)).documentEvidence.status).toBe("not_started");
    await sign(f, "officer");
    const before = (await requirementPool.query("SELECT * FROM frm_document_headers WHERE submission_uuid=$1", [f.submission])).rows[0];
    expect(before.actor_uuid).toBe("24");
    expect(before.capture_event).toBe("signature");
    expect(before.evidence.branding).toEqual({ logoVersionUuid: null, assetSha256: null, mode: "company_name" });
    expect(before.evidence.subject.fields.find((field: any) => field.label === "Contract rank").value).toBe("Not recorded");
    expect(before.evidence.definition.applicability[0].policy.mode).toBe("conditional");
    expect(before.evidence.definition.applicability[0].sets[0].conditions[0].dimension_key).toBe("vessel");
    expect((await read(f)).documentEvidence.status).toBe("frozen");
    await requirementPool.query("UPDATE crew_members_v2 SET first_name='Changed after header freeze' WHERE crew_uuid=$1", [f.crewUuid]);
    await requirementPool.query(`UPDATE crew_assignment_rule_context SET contract_rank_uuid=$2,contract_rank_label=$3 WHERE assign_uuid=$1`,
      [f.assignUuid, f.rank.ar_uuid, f.rank.name]);
    await sign(f, "seafarer");
    const completed = await post(`${f.sectionPath}/submit`);
    expect(completed.status, JSON.stringify(completed.body)).toBe(200);
    expect(completed.body.completed).toBe(true);
    const snapshot = (await requirementPool.query("SELECT * FROM frm_document_snapshots WHERE submission_uuid=$1", [f.submission])).rows[0];
    expect(snapshot.input.header).toEqual(before.evidence);
    expect(snapshot.frozen_record_sha256).toBe(digest(snapshot.canonical_input));
    expect(snapshot.input.source.origin).toBe("REQUIRED");
    expect(snapshot.input.source.versionUuid).toBe(f.version.fvUuid);
    expect(snapshot.input.signatures).toHaveLength(2);
    const seafarer = snapshot.input.signatures.find((s: any) => s.record.signatureType === "seafarer");
    expect(seafarer.record.signerRank).toBe("Not recorded");
    expect(seafarer.record.witnessName).toBeTruthy();
    expect(seafarer.record.witnessUserId).toBe(24);
    for (const signature of snapshot.input.signatures) {
      const bytes = Buffer.from(signature.asset.bytesBase64, "base64");
      expect(signature.asset.sha256).toBe(digest(bytes));
      expect(signature.asset.byteLength).toBe(bytes.length);
      expect(bytes).toEqual(Buffer.from(PNG.split(",")[1], "base64"));
    }
    const view = await read(f);
    expect(view.documentEvidence).toMatchObject({ status: "pending", frozenRecordSha256: snapshot.frozen_record_sha256 });
    expect(JSON.stringify(view)).not.toContain(PNG.split(",")[1]);
    expect(view.systemFields.find((field: any) => field.key === "rank").value).toBe("Not recorded");
    expect((await requirementPool.query("SELECT status FROM frm_requirements WHERE current_submission_uuid=$1", [f.submission])).rows[0].status).toBe("COMPLETED");
  });

  it("rejects evidence changes and stores one durable request across concurrent final submits and later retries", async () => {
    const f = await start();
    await sign(f, "officer"); await sign(f, "seafarer");
    const responses = await Promise.all([post(`${f.sectionPath}/submit`), post(`${f.sectionPath}/submit`)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    for (const table of ["frm_document_headers", "frm_document_assets", "frm_document_snapshots", "frm_document_preparation_requests"]) {
      await expect(requirementPool.query(`UPDATE ${table} SET actor_uuid='forged' WHERE submission_uuid=$1`, [f.submission]))
        .rejects.toMatchObject({ code: "23514" });
      await expect(requirementPool.query(`DELETE FROM ${table} WHERE submission_uuid=$1`, [f.submission]))
        .rejects.toMatchObject({ code: "23514" });
    }
    const requests = (await requirementPool.query("SELECT * FROM frm_document_preparation_requests WHERE submission_uuid=$1", [f.submission])).rows;
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ outcome: "PENDING", actor_uuid: "24", reason_code: null });
    expect((await post(`${f.sectionPath}/submit`)).status).toBe(409);
    // A fresh connection represents a reader after the completing connection/process is gone.
    const client = await requirementPool.connect();
    try {
      expect((await client.query("SELECT * FROM frm_document_preparation_requests WHERE submission_uuid=$1", [f.submission])).rows).toEqual(requests);
    } finally { client.release(); }
  });

  it("rolls back form, section, requirement, snapshot and request together when recording fails", async () => {
    const f = await start();
    await sign(f, "officer"); await sign(f, "seafarer");
    const sectionBefore = (await requirementPool.query("SELECT * FROM frm_section_states WHERE submission_uuid=$1", [f.submission])).rows;
    // Isolated DB only: inject a failure after the snapshot INSERT, before request persistence.
    const suffix = randomUUID().replaceAll("-", "");
    const fn = `test_document_failure_${suffix}`;
    await requirementPool.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.submission_uuid='${f.submission}' THEN RAISE EXCEPTION 'Synthetic request failure'; END IF;
      RETURN NEW; END $$;
      CREATE TRIGGER ${fn} BEFORE INSERT ON frm_document_preparation_requests FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
    try {
      expect((await post(`${f.sectionPath}/submit`)).status).toBe(500);
      expect((await requirementPool.query("SELECT status FROM frm_company_submissions WHERE submission_uuid=$1", [f.submission])).rows[0].status).toBe("in_progress");
      expect((await requirementPool.query("SELECT status FROM frm_requirements WHERE current_submission_uuid=$1", [f.submission])).rows[0].status).toBe("STARTED");
      expect((await requirementPool.query("SELECT * FROM frm_document_snapshots WHERE submission_uuid=$1", [f.submission])).rows).toHaveLength(0);
      expect((await requirementPool.query("SELECT * FROM frm_document_preparation_requests WHERE submission_uuid=$1", [f.submission])).rows).toHaveLength(0);
      expect((await requirementPool.query("SELECT * FROM frm_section_states WHERE submission_uuid=$1", [f.submission])).rows).toEqual(sectionBefore);
    } finally {
      await requirementPool.query(`DROP TRIGGER ${fn} ON frm_document_preparation_requests; DROP FUNCTION ${fn}()`);
    }
    expect((await post(`${f.sectionPath}/submit`)).status).toBe(200);
  });

  it("completes a historical form without fabricating its missing header or exposing raw errors", async () => {
    const f = await start();
    // Emulate an already-frozen pre-feature record. No old evidence is deleted.
    await requirementPool.query(`UPDATE frm_company_submissions SET system_snapshot_at=now(),system_snapshot_event='signature'
      WHERE submission_uuid=$1`, [f.submission]);
    expect((await read(f)).documentEvidence.status).toBe("unavailable");
    await sign(f, "officer"); await sign(f, "seafarer");
    expect((await post(`${f.sectionPath}/submit`)).status).toBe(200);
    expect((await requirementPool.query("SELECT * FROM frm_document_headers WHERE submission_uuid=$1", [f.submission])).rows).toHaveLength(0);
    expect((await requirementPool.query("SELECT * FROM frm_document_snapshots WHERE submission_uuid=$1", [f.submission])).rows).toHaveLength(0);
    const r = (await requirementPool.query("SELECT * FROM frm_document_preparation_requests WHERE submission_uuid=$1", [f.submission])).rows[0];
    expect(r).toMatchObject({ outcome: "UNAVAILABLE", reason_code: "HISTORICAL_HEADER_MISSING", snapshot_uuid: null });
    const view = await read(f);
    expect(view.submission.status).toBe("completed");
    expect(view.documentEvidence.status).toBe("unavailable");
    expect(view.documentEvidence.message).toContain("Ask the office");
    expect(view.documentEvidence.message).not.toMatch(/HISTORICAL_HEADER|SELECT|server_error/);
  });

  it("captures answers and section comments at section-first completion without a signature", async () => {
    const f = await createRequirementFixture();
    await f.record("answers-document", [{ formVersionUuid: f.version.fvUuid,
      status: "OUTSTANDING", matchedSetUuids: [], values: {} }]);
    const r = (await requirementPool.query("SELECT requirement_uuid FROM frm_requirements WHERE subject_ref=$1", [f.assignUuid])).rows[0];
    const started = await post(`${prefix}/subjects/crew_assignment/${f.assignUuid}/requirements/${r.requirement_uuid}/start`);
    expect(started.status).toBe(201);
    const submission = started.body.submissionUuid;
    const path = `${prefix}/${submission}/sections/${f.section}`;
    const answers = await requirementApi.put(`${path}/answers`).set("Authorization", `Bearer ${requirementToken}`)
      .send({ answers: [{ questionUuid: f.question, value: "Frozen answer", comment: "Frozen point comment" }],
        sectionComment: "Frozen section comment" });
    expect(answers.status, JSON.stringify(answers.body)).toBe(204);
    const result = await post(`${path}/submit`);
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    const snapshot = (await requirementPool.query("SELECT input FROM frm_document_snapshots WHERE submission_uuid=$1", [submission])).rows[0].input;
    expect(snapshot.header.captureEvent).toBe("section_submission");
    expect(snapshot.answers[0]).toMatchObject({ answerValue: "Frozen answer", answerComment: "Frozen point comment" });
    expect(snapshot.sectionStates[0].sectionComment).toBe("Frozen section comment");
    expect(snapshot.signatures).toEqual([]);
  });

  it("exposes evidence through View without Forms authoring and rejects a vessel user outside the subject vessel", async () => {
    const f = await start();
    await sign(f, "officer"); await sign(f, "seafarer");
    expect((await post(`${f.sectionPath}/submit`)).status).toBe(200);
    const role = randomUUID(), label = `TEST ONLY Document View ${role}`;
    await requirementPool.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,is_active,is_deleted)
      VALUES($1,$2,'Office',true,false)`, [role, label]);
    const office = (await requirementPool.query("INSERT INTO master_users(user_type,role) VALUES('Office',$1) RETURNING id", [label])).rows[0];
    await grantCompanyFormFixture(requirementPool, role, "view");
    const token = (id: number, userType: string) => {
      const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
      return `${enc({alg:"none",typ:"JWT"})}.${enc({id,userType,domain:"test",vessels:[]})}.devsig`;
    };
    const view = await requirementApi.get(`${prefix}/${f.submission}/form`)
      .set("Authorization", `Bearer ${token(office.id, "Office")}`);
    expect(view.status, JSON.stringify(view.body)).toBe(200);
    expect(view.body.documentEvidence.status).toBe("pending");
    expect((await requirementPool.query(`SELECT * FROM adm_roleaccess_ac WHERE role_id=$1 AND NOT is_deleted`, [role])).rows).toHaveLength(0);
    const shipRole = randomUUID(), shipLabel = `TEST ONLY Document Ship ${shipRole}`;
    await requirementPool.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,is_active,is_deleted)
      VALUES($1,$2,'Ship',true,false)`, [shipRole, shipLabel]);
    const ship = (await requirementPool.query("INSERT INTO master_users(user_type,role) VALUES('Ship',$1) RETURNING id", [shipLabel])).rows[0];
    await grantCompanyFormFixture(requirementPool, shipRole, "vessel");
    const denied = await requirementApi.get(`${prefix}/${f.submission}/form`)
      .set("Authorization", `Bearer ${token(ship.id, "Ship")}`);
    expect(denied.status).toBe(403);
    expect(denied.body).not.toHaveProperty("documentEvidence");
    retainFixtureReferences("isolated evidence readers", [office.id, role, ship.id, shipRole]);
  });

  it("reads identically named records only from the trusted tenant executor, never a public fallback", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const schemas = [`doc_tenant_a_${suffix}`, `doc_tenant_b_${suffix}`];
    const clients = await Promise.all([requirementPool.connect(), requirementPool.connect()]);
    const uuid = randomUUID();
    retainFixtureReferences("isolated tenant document status schemas", [...schemas, uuid]);
    try {
      for (let index = 0; index < clients.length; index++) {
        const client = clients[index], schema = schemas[index];
        await client.query("BEGIN");
        await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema};
          CREATE TABLE frm_document_headers(submission_uuid text);
          CREATE TABLE frm_document_preparation_requests(submission_uuid text,snapshot_uuid text,outcome text,reason_code text);
          CREATE TABLE frm_document_snapshots(snapshot_uuid text,frozen_record_sha256 text);`);
        if (index === 0) {
          await client.query("INSERT INTO frm_document_preparation_requests VALUES($1,$1,'PENDING',NULL)", [uuid]);
          await client.query("INSERT INTO frm_document_snapshots VALUES($1,$2)", [uuid, "a".repeat(64)]);
        }
      }
      const statuses = await Promise.all(clients.map((client, index) =>
        tenantConnectionManager.tenantStorage.run({ db: drizzle(client), tenantId: schemas[index] },
          () => readDocumentEvidenceStatus(getDb(), { submissionUuid: uuid, status: "completed" }))));
      expect(statuses[0]).toMatchObject({ status: "pending", frozenRecordSha256: "a".repeat(64) });
      expect(statuses[1]).toMatchObject({ status: "unavailable", frozenRecordSha256: null });
    } finally {
      for (const client of clients) { await client.query("ROLLBACK"); client.release(); }
    }
  });
});
