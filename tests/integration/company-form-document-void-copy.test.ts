import { afterAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { createRequirementFixture, requirementApi, requirementPool as db, requirementToken,
  requirementTokenFor } from "../helpers/company-form-requirement-fixtures";
import { grantCompanyFormFixture } from "../helpers/companyFormGrants";

const root = "/api/v2/company-form-submissions";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const post = (path: string, body = {}, token = requirementToken) => requirementApi.post(path)
  .set("Authorization", `Bearer ${token}`).send(body);
const get = (path: string, token = requirementToken) => requirementApi.get(path).set("Authorization", `Bearer ${token}`);
const download = (id: string, token = requirementToken) => get(`${root}/${id}/pdf`, token)
  .buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = []; res.on("data", c => chunks.push(c));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  });
async function actor(mode: "office" | "view" | "vessel" = "office") {
  const role = randomUUID(), name = `TEST ONLY void copy ${role}`;
  await db.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,is_active,is_deleted)
    VALUES($1,$2,$3,true,false)`, [role, name, mode === "vessel" ? "Ship" : "Office"]);
  const user = (await db.query(`INSERT INTO master_users(user_uuid,fullname,role,user_type,designation)
    VALUES($1,'Synthetic void officer',$2,$3,'Recorded office designation') RETURNING id,user_uuid`,
  [randomUUID(), name, mode === "vessel" ? "Ship" : "Office"])).rows[0];
  await grantCompanyFormFixture(db, role, mode);
  if (mode !== "vessel") return { ...user, token: requirementTokenFor(user.id) };
  const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  return { ...user, token: `${enc({alg:"none",typ:"JWT"})}.${enc({id:user.id,userType:"Ship",domain:"test",vessels:[]})}.devsig` };
}
async function completed() {
  const f = await createRequirementFixture("before_joining", { signatures: true });
  await f.record("void-copy-evidence", [{ formVersionUuid: f.version.fvUuid,
    status: "OUTSTANDING", matchedSetUuids: f.matchedSetUuids, values: {} }]);
  const req = (await db.query("SELECT requirement_uuid FROM frm_requirements WHERE subject_ref=$1", [f.assignUuid])).rows[0];
  const startPath = `${root}/subjects/crew_assignment/${f.assignUuid}/requirements/${req.requirement_uuid}/start`;
  const start = await post(startPath);
  expect(start.status, JSON.stringify(start.body)).toBe(201);
  const id = start.body.submissionUuid;
  for (const type of ["officer", "seafarer"]) {
    const response = await post(`${root}/${id}/sections/${f.section}/signatures`, {
      signatureType: type, method: type === "officer" ? "officer" : "witnessed",
      ...(type === "seafarer" ? { seafarerPresent: true } : {}), data: PNG,
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
  }
  expect((await post(`${root}/${id}/sections/${f.section}/submit`)).status).toBe(200);
  return { ...f, id, startPath, path: `${root}/${id}/pdf` };
}

describe("immutable void-aware PDF and separate handover", () => {
  afterAll(async () => { await db.end(); });

  it("keeps the original, freezes server identity, serializes downloads and preserves later replacement revisions", async () => {
    const f = await completed(), officer = await actor();
    expect((await post(`${f.path}/retry`)).status).toBe(200);
    const original = (await db.query("SELECT * FROM frm_document_files WHERE submission_uuid=$1", [f.id])).rows[0];
    expect((await post(`${f.path}/handover`, { fileSha256: original.file_sha256 })).status).toBe(201);
    const [voided, racingDownload] = await Promise.all([
      post(`${root}/${f.id}/void`, { reason: "Wrong section recorded; retain all original evidence." }, officer.token),
      download(f.id),
    ]);
    expect(voided.status, JSON.stringify(voided.body)).toBe(204);
    expect(racingDownload.status).toBe(200); // linearizes either before or after void
    const statuses = await Promise.all([get(`${f.path}/status`), get(`${f.path}/status`)]);
    for (const s of statuses) expect(s.body).toMatchObject({ status: "ready", voided: true, originalFileSha256: original.file_sha256 });
    const sha = statuses[0].body.fileSha256;
    expect(sha).not.toBe(original.file_sha256);
    const notice = (await db.query("SELECT * FROM frm_document_void_notices WHERE submission_uuid=$1 ORDER BY revision DESC", [f.id])).rows[0];
    expect(notice.evidence).toMatchObject({ actorUuid: String(officer.id), actorName: "Synthetic void officer",
      designation: "Recorded office designation", replacementSubmissionUuid: null, originalFileSha256: original.file_sha256 });
    const copies = await Promise.all([download(f.id), download(f.id)]);
    for (const copy of copies) {
      expect(copy.status).toBe(200); expect(hash(copy.body)).toBe(sha);
      expect(copy.headers["cache-control"]).toContain("no-store");
      expect((await PDFDocument.load(copy.body)).getPageCount()).toBe(original.page_count + 1);
    }
    expect((await post(`${f.path}/handover`, { fileSha256: sha })).status).toBe(409);
    expect((await post(`${f.path}/void-notice-handover`, { fileSha256: original.file_sha256 })).status).toBe(409);
    expect((await post(`${f.path}/void-notice-handover`, { fileSha256: sha, actorName: "Forged" })).status).toBe(400);
    const viewer = await actor("view"), ship = await actor("vessel");
    expect((await download(f.id, viewer.token)).status).toBe(200);
    expect((await post(`${f.path}/void-notice-handover`, { fileSha256: sha }, viewer.token)).status).toBe(403);
    expect((await download(f.id, ship.token)).status).toBe(403);
    expect((await get(`${f.path}/status`, ship.token)).status).toBe(403);
    expect((await post(`${f.path}/void-notice-handover`, { fileSha256: sha }, ship.token)).status).toBe(403);
    expect((await post(`${f.path}/void-notice-handover`, { fileSha256: sha }, officer.token)).status).toBe(201);
    const record = (await db.query("SELECT * FROM frm_document_void_handovers WHERE submission_uuid=$1", [f.id])).rows[0];
    expect(record).toMatchObject({ actor_uuid: officer.user_uuid, actor_name: "Synthetic void officer", file_sha256: sha });
    expect(record.recorded_at).toBeTruthy();
    await expect(db.query("UPDATE frm_document_void_notices SET evidence='{}' WHERE notice_uuid=$1", [notice.notice_uuid])).rejects.toMatchObject({code:"23514"});
    await expect(db.query("DELETE FROM frm_document_void_files WHERE notice_uuid=$1", [notice.notice_uuid])).rejects.toMatchObject({code:"23514"});
    await expect(db.query("DELETE FROM frm_document_void_handovers WHERE submission_uuid=$1", [f.id])).rejects.toMatchObject({code:"23514"});
    // Starting the required replacement links the exact record and creates another immutable notice.
    const replacement = await post(f.startPath);
    expect(replacement.status, JSON.stringify(replacement.body)).toBe(201);
    const later = await get(`${f.path}/status`);
    expect(later.body.fileSha256).not.toBe(sha);
    expect(later.body.handovers.find((h: any) => h.copyKind === "void_notice").currentNotice).toBe(false);
    const revisions = (await db.query(`SELECT n.*,f.file_sha256 FROM frm_document_void_notices n
      JOIN frm_document_void_files f USING(notice_uuid) WHERE n.submission_uuid=$1 ORDER BY revision`, [f.id])).rows;
    expect(revisions).toHaveLength(2);
    expect(revisions[0].file_sha256).toBe(sha);
    expect(revisions[1].evidence.replacementSubmissionUuid).toBe(replacement.body.submissionUuid);
    const kept = (await db.query("SELECT * FROM frm_document_files WHERE submission_uuid=$1", [f.id])).rows[0];
    expect(kept).toEqual(original);
  }, 60000);

  it("prepares a voided original from frozen evidence when void precedes PDF preparation", async () => {
    const f = await completed(), officer = await actor();
    const frozen = (await db.query("SELECT * FROM frm_document_snapshots WHERE submission_uuid=$1", [f.id])).rows[0];
    expect((await post(`${root}/${f.id}/void`, { reason: "Voided before copy preparation" }, officer.token)).status).toBe(204);
    expect((await post(`${f.path}/retry`)).status).toBe(200);
    const status = await get(`${f.path}/status`);
    expect(status.body).toMatchObject({status:"ready",voided:true});
    expect((await download(f.id)).status).toBe(200);
    expect((await db.query("SELECT * FROM frm_document_snapshots WHERE submission_uuid=$1", [f.id])).rows[0]).toEqual(frozen);
    expect((await db.query("SELECT count(*)::int AS n FROM frm_document_files WHERE submission_uuid=$1", [f.id])).rows[0].n).toBe(1);
  }, 60000);
});
