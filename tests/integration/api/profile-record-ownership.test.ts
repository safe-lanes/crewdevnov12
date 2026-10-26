import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import express from "express";
import request from "supertest";

vi.mock("@server/v2/db", () => ({ getDb: vi.fn() }));
vi.mock("@server/v2/crew-pool/services", async () => ({
  crewDocumentsService: (await import("@server/v2/crew-pool/services/crewDocumentsService")).crewDocumentsService,
  crewVisasService: (await import("@server/v2/crew-pool/services/crewVisasService")).crewVisasService,
  crewCertificatesService: (await import("@server/v2/crew-pool/services/crewCertificatesService")).crewCertificatesService,
  crewMedicalService: (await import("@server/v2/crew-pool/services/crewMedicalService")).crewMedicalService,
}));
import { getDb } from "@server/v2/db";
import { crewDocumentsController } from "@server/v2/crew-pool/controllers/crewDocumentsController";
import { crewVisasController } from "@server/v2/crew-pool/controllers/crewVisasController";
import { crewLicensesController } from "@server/v2/crew-pool/controllers/crewLicensesController";
import { crewMedicalController } from "@server/v2/crew-pool/controllers/crewMedicalController";
import * as recruitmentController from "@server/v2/recruitment/controllers/documentsController";
import { crewDocumentsService, crewVisasService, crewCertificatesService, crewMedicalService } from "@server/v2/crew-pool/services";
import { documentsService as recruitmentService } from "@server/v2/recruitment/services/documentsService";
import { CrewDocumentsRepository } from "@server/v2/crew-pool/repositories/crewDocumentsRepository";
import { CrewVisasRepository } from "@server/v2/crew-pool/repositories/crewVisasRepository";
import { CrewLicensesRepository } from "@server/v2/crew-pool/repositories/crewLicensesRepository";
import { CrewMedicalRepository } from "@server/v2/crew-pool/repositories/crewMedicalRepository";
import { TrainingCoursesRepository } from "@server/v2/recruitment/repositories/documentsRepository";
import { CertificateOwnershipError } from "@server/v2/crew-pool/utils/certificateOwnership";

const schema = `profile_owner_${randomUUID().replaceAll("-", "")}`;
const owner = randomUUID(), other = randomUUID();
const documents = new CrewDocumentsRepository(), visas = new CrewVisasRepository();
const licences = new CrewLicensesRepository(), medical = new CrewMedicalRepository();
const recruitment = new TrainingCoursesRepository();
type Family = {
  name: string; table: string; uuidColumn: string; param: string;
  field: string; column: string; uuid: string; create: any; update: any;
  service: (key: any, data: any) => Promise<any>;
  repository: (key: any, data: any) => Promise<any>;
  reconcile?: (items: any[]) => Promise<any>;
};
const families: Family[] = [
  { name: "Travel document", table: "crew_documents", uuidColumn: "doc_uuid", param: "docUuid",
    create: crewDocumentsController.create, update: crewDocumentsController.update,
    service: (k,d) => crewDocumentsService.update(k,d), repository: (k,d) => documents.update(k,d),
    reconcile: items => crewDocumentsService.reconcileWithAttachments(owner,items) },
  { name: "Visa", table: "crew_visas", uuidColumn: "visa_uuid", param: "visaUuid",
    create: crewVisasController.create, update: crewVisasController.update,
    service: (k,d) => crewVisasService.update(k,d), repository: (k,d) => visas.update(k,d),
    reconcile: items => crewVisasService.reconcileWithAttachments(owner,items) },
  { name: "Licence", table: "crew_licenses", uuidColumn: "lic_uuid", param: "licUuid",
    create: crewLicensesController.create, update: crewLicensesController.update,
    service: (k,d) => crewCertificatesService.updateLicense(k,d), repository: (k,d) => licences.update(k,d),
    reconcile: items => crewCertificatesService.reconcileLicensesWithAttachments(owner,items) },
  { name: "Medical record", table: "crew_pre_joining_medicals", uuidColumn: "med_uuid", param: "medUuid",
    create: crewMedicalController.createMedical, update: crewMedicalController.updateMedical,
    service: (k,d) => crewMedicalService.updateMedical(k,d), repository: (k,d) => medical.updateMedical(k,d),
    reconcile: items => crewMedicalService.reconcileMedicalsWithAttachments(owner,items) },
  { name: "Doctor visit", table: "crew_doctor_visits", uuidColumn: "visit_uuid", param: "visitUuid",
    create: crewMedicalController.createDoctorVisit, update: crewMedicalController.updateDoctorVisit,
    service: (k,d) => crewMedicalService.updateVisit(k,d), repository: (k,d) => medical.updateVisit(k,d),
    reconcile: items => crewMedicalService.reconcileVisitsWithAttachments(owner,items) },
  { name: "Recruitment training record", table: "cand_training_courses", uuidColumn: "train_uuid", param: "id",
    create: recruitmentController.createTrainingCourse, update: recruitmentController.updateTrainingCourse,
    service: (k,d) => recruitmentService.updateTrainingCourse(k,d), repository: (k,d) => recruitment.update(k,d) },
].map(f => ({ ...f, field: f.param === "id" ? "recCanUuid" : "crewUuid",
  column: f.param === "id" ? "rec_can_uuid" : "crew_uuid", uuid: randomUUID() }));
const app = express();
app.use(express.json());
for (const f of families) {
  const ownerParam = f.param === "id" ? "recCanUuid" : "crewUuid";
  app.post(`/${f.table}/:${ownerParam}`, f.create);
  app.patch(`/${f.table}/:${ownerParam}/:${f.param}`, f.update);
}
let control: Pool, pool: Pool;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_VERIFIED !== "true")
    throw Error("Registered, identity-verified TEST_DATABASE_URL required.");
  control = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await control.query(`CREATE SCHEMA "${schema}"`);
  for (const table of ["crew_members_v2", ...families.map(f => f.table)]) {
    await control.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING DEFAULTS)`);
    await control.query(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN id DROP DEFAULT`);
    await control.query(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (START WITH 100)`);
  }
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` });
  vi.mocked(getDb).mockReturnValue(drizzle(pool) as any);
  await pool.query(`INSERT INTO crew_members_v2(id,crew_uuid,emp_no,first_name,is_deleted)
    VALUES(1,$1,'TEST-PROFILE-OWNER','TEST ONLY Owner',false),(2,$2,'TEST-PROFILE-OTHER','TEST ONLY Other',false)`, [owner,other]);
  // A trigger detects even an UPDATE assigning the owner to its existing value:
  // same-owner success therefore proves the owner was excluded from SQL.
  await pool.query(`CREATE FUNCTION reject_owner_write() RETURNS trigger LANGUAGE plpgsql AS
    $$ BEGIN RAISE EXCEPTION 'Owner must not be part of UPDATE'; END $$`);
  for (const f of families) await pool.query(`CREATE TRIGGER owner_not_in_update
    BEFORE UPDATE OF "${f.column}" ON "${f.table}" FOR EACH ROW EXECUTE FUNCTION reject_owner_write()`);
});
beforeEach(async () => {
  for (const f of families) {
    await pool.query(`DELETE FROM "${f.table}"`);
    await pool.query(`INSERT INTO "${f.table}"(id,"${f.uuidColumn}","${f.column}",sort_order,is_deleted)
      VALUES(1,$1,$2,0,false)`, [f.uuid,owner]);
  }
});
afterAll(async () => {
  await pool?.end();
  if (control) { await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await control.end(); }
});
const key = (f: Family) => f.param === "id" ? 1 : f.uuid;
const path = (f: Family) => `/${f.table}/${owner}/${key(f)}`;
const stored = async (f: Family) => (await pool.query(`SELECT * FROM "${f.table}" WHERE id=1`)).rows[0];

describe.each(families)("$name ownership", f => {
  it.each([other, null, ""])("refuses PATCH owner %s without saving anything", async value => {
    const before = await stored(f);
    const res = await request(app).patch(path(f)).send({ [f.field]: value, sortOrder: 99 });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(`${f.name} ownership cannot be changed. Delete the ${f.name.toLowerCase()} and re-create it against the correct seafarer.`);
    expect(await stored(f)).toEqual(before);
  });
  it("ordinary edits still succeed", async () => {
    const res = await request(app).patch(path(f)).send({ sortOrder: 99 });
    expect(res.status).toBe(200);
    expect(await stored(f)).toMatchObject({ [f.column]: owner, sort_order: 99 });
  });
  it("accepts the same owner and excludes it from SQL", async () => {
    const res = await request(app).patch(path(f)).send({ [f.field]: owner, sortOrder: 100 });
    expect(res.status).toBe(200);
    expect(await stored(f)).toMatchObject({ [f.column]: owner, sort_order: 100 });
  });
  it("creation still sets the normal owner", async () => {
    const required: Record<string, object> = {
      crew_documents: { documentName: "TEST ONLY travel document" },
      crew_visas: { visaType: "TEST ONLY visa" },
      crew_licenses: { certificateDocument: "TEST ONLY licence" },
    };
    const res = await request(app).post(`/${f.table}/${other}`).send({ ...required[f.table], sortOrder: 5 });
    expect(res.status).toBe(201);
    expect((await pool.query(`SELECT * FROM "${f.table}" WHERE "${f.column}"=$1`, [other])).rows)
      .toHaveLength(1);
  });
  it("direct service calls cannot transfer ownership", async () => {
    const before = await stored(f);
    await expect(f.service(key(f), { [f.field]: other, sortOrder: 99 })).rejects.toBeInstanceOf(CertificateOwnershipError);
    expect(await stored(f)).toEqual(before);
  });
  it("direct repository calls cannot transfer ownership and strip the same owner", async () => {
    const before = await stored(f);
    await expect(f.repository(key(f), { [f.field]: other, sortOrder: 99 })).rejects.toBeInstanceOf(CertificateOwnershipError);
    expect(await stored(f)).toEqual(before);
    await f.repository(key(f), { [f.field]: owner, sortOrder: 100 });
    expect(await stored(f)).toMatchObject({ [f.column]: owner, sort_order: 100 });
  });
});

describe.each(families.filter(f => f.reconcile))("$name reconciliation", f => {
  it("rejects an injected owner and rolls back earlier changes", async () => {
    const before = await stored(f);
    await expect(f.reconcile!([
      { [f.param]: f.uuid, data: { sortOrder: 99 } },
      { [f.param]: f.uuid, data: { [f.field]: other, sortOrder: 100 } },
    ])).rejects.toBeInstanceOf(CertificateOwnershipError);
    expect(await stored(f)).toEqual(before);
  });
});
it("recruitment courseId and trainUuid remain editable", async () => {
  const f = families.find(f => f.param === "id")!, replacementUuid = randomUUID();
  const res = await request(app).patch(path(f)).send({ courseId: "TEST-CHANGED", trainUuid: replacementUuid });
  expect(res.status).toBe(200);
  expect(await stored(f)).toMatchObject({ course_id: "TEST-CHANGED", train_uuid: replacementUuid, rec_can_uuid: owner });
});
