import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID as uuid } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import express from "express";
import request from "supertest";
import * as engine from "../../shared/v2/forms-engine/schema";
import * as companyTables from "../../shared/v2/forms-engine/submissions";
import { admFormsV2, admFormVersionsV2 } from "../../shared/v2/admin/schema";
import { masterUsers } from "../../shared/schema";

const context = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../server/v2/db", () => ({ getDb: () => context.db }));
vi.mock("../../server/v2/crew-pool/services/crewMembersService", () => ({
  crewMembersService: { getByUuid: async () => ({ firstName: "Fixture", nationalityUuid: null }) },
}));
// Verified identity enters here; authentication/token processing is unchanged.
// Signature access is unrelated to the answer save endpoint under test.
vi.mock("../../server/v2/shared/standardSignatureAccess", () => ({
  standardSignatureAccess: () => (_req: any, _res: any, next: any) => next(),
  authorizeStandardSignature: async () => {},
}));
vi.mock("../../server/v2/company-forms/documentEvidenceRepository", () => ({
  readDocumentEvidenceStatus: async () => null,
}));
import briefingRoutes from "../../server/v2/briefings/routes";
import debriefingRoutes from "../../server/v2/debriefings/routes";
import interviewRoutes from "../../server/v2/interviews/routes";
import companyRoutes from "../../server/v2/company-forms/routes";
import { companyFormSubmissionsService } from "../../server/v2/company-forms/submissionsService";
import { companyFormSubmissionRenderRepository } from "../../server/v2/company-forms/submissionRenderRepository";
import { CompanyFormPermissionError } from "../../server/v2/company-forms/errors";

let pool: Pool, directory: string;
const tables = [...new Map([...Object.values(engine), ...Object.values(companyTables), admFormsV2, admFormVersionsV2, masterUsers]
  .filter((t): t is PgTable => is(t, PgTable)).map(t => [getTableConfig(t).name, t])).values()];
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
beforeAll(async () => {
  // A new, socket-only PostgreSQL CLUSTER, never a tenant URL or a fallback.
  directory = mkdtempSync(join(tmpdir(), "draft-save-db-"));
  execFileSync("initdb", ["-D", join(directory, "data"), "-U", "draft_test", "-A", "trust", "--no-locale"]);
  execFileSync("pg_ctl", ["-D", join(directory, "data"), "-l", join(directory, "postgres.log"),
    "-o", `-k ${directory} -p 55449 -c listen_addresses=''`, "-w", "start"]);
  pool = new Pool({ host: directory, port: 55449, user: "draft_test", database: "postgres" });
  const cluster = execFileSync("pg_controldata", [join(directory, "data")], { encoding: "utf8" })
    .match(/Database system identifier:\s*(\d+)/)?.[1];
  const identity = (await pool.query("SELECT system_identifier::text AS id FROM pg_control_system()")).rows[0];
  if (!cluster || identity.id !== cluster) throw new Error("Disposable test cluster identity mismatch");
  context.db = drizzle(pool);
  for (const table of tables) {
    const config = getTableConfig(table);
    const columns = config.columns.map((c: any) => {
      let text = `${quote(c.name)} ${c.getSQLType()}`;
      if (c.primary) text += " PRIMARY KEY"; else if (c.isUnique) text += " UNIQUE";
      if (c.notNull) text += " NOT NULL";
      if (c.default !== undefined && !/serial/i.test(c.getSQLType())) {
        if (typeof c.default === "string") text += ` DEFAULT '${c.default.replaceAll("'", "''")}'`;
        else if (["boolean", "number"].includes(typeof c.default)) text += ` DEFAULT ${c.default}`;
        else if (c.dataType === "date") text += " DEFAULT now()";
      }
      return text;
    });
    await pool.query(`CREATE TABLE ${quote(config.name)} (${columns.join(",")})`);
  }
  await pool.query("CREATE UNIQUE INDEX answer_identity ON frm_answers(submission_uuid,question_uuid)");
  // Exercise the actual additive migration twice from the previous schema.
  await pool.query("ALTER TABLE frm_section_states DROP COLUMN last_draft_saved_at, DROP COLUMN last_draft_saved_by_uuid, DROP COLUMN last_draft_saved_by_name");
  const migration = readFileSync("migrations/0271_live_form_explicit_draft_save.sql", "utf8");
  await pool.query(migration); await pool.query(migration);
  await context.db.insert(masterUsers).values([
    { id: 1, userUuid: uuid(), fullname: "First Saver", userType: "Office", role: "admin" },
    { id: 2, userUuid: uuid(), fullname: "Second Saver", userType: "Office", role: "admin" },
    { id: 3, userUuid: uuid(), fullname: "Other Department", userType: "Office", role: "staff", department: "Other" },
  ]);
}, 60000);
afterAll(async () => {
  vi.restoreAllMocks();
  if (pool) await pool.end();
  if (directory) {
    try { execFileSync("pg_ctl", ["-D", join(directory, "data"), "-m", "immediate", "-w", "stop"]); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  }
});

async function fixture(family: string) {
  const submissionUuid = uuid(), sectionUuid = uuid(), otherSection = uuid(), questionUuid = uuid(), formVersionUuid = uuid();
  const [form] = await context.db.insert(admFormsV2).values({
    formUuid: uuid(), name: "Draft fixture", category: family === "company" ? "dynamic" : family,
    subjectType: family === "company" ? "crew_assignment" : null, rankGroup: "Deck",
    versionNo: "01", versionDate: "20-Nov-2026", isLockForm: false,
  }).returning();
  await context.db.insert(admFormVersionsV2).values({ fvUuid: formVersionUuid, formId: form.id, versionNo: "01", versionDate: "20-Nov-2026", status: "released" });
  const [part] = await context.db.insert(engine.frmFormParts).values({
    formPartUuid: uuid(), formUuid: form.formUuid, formVersionUuid, partCode: "B", partTitle: "Points", partType: "configurable",
  }).returning();
  for (const id of [sectionUuid, otherSection]) {
    await context.db.insert(engine.frmSections).values({
      sectionUuid: id, formPartUuid: part.formPartUuid, formVersionUuid, sectionCode: id === sectionUuid ? "B1" : "B2",
      sectionTitle: "Fixture section", applicableVesselTypes: "[]", responsibleMode: "department", responsibleDepartment: "Crewing",
      vesselSignatureRoleUuids: [],
    });
    await context.db.insert(engine.frmSectionStates).values({
      sectionStateUuid: uuid(), submissionUuid, sectionUuid: id, sectionComment: "Do not clear",
    });
  }
  await context.db.insert(engine.frmQuestions).values({
    questionUuid, sectionUuid, questionCode: "B1.1", questionText: "Comment", responseType: "free_text", commentEnabled: true,
  });
  const parent = { formUuid: form.formUuid, formVersionUuid };
  if (family === "briefing") await context.db.insert(engine.crewBriefingSubmissions).values({ ...parent, briefingSubmissionUuid: submissionUuid, crewUuid: uuid() });
  if (family === "debriefing") await context.db.insert(engine.crewDebriefingSubmissions).values({ ...parent, debriefingSubmissionUuid: submissionUuid, crewUuid: uuid() });
  if (family === "interview") await context.db.insert(engine.crewInterviewSubmissions).values({ ...parent, interviewSubmissionUuid: submissionUuid, recCanUuid: uuid() });
  const subjectRef = uuid();
  if (family === "company") await context.db.insert(companyTables.frmCompanySubmissions).values({
    ...parent, submissionUuid, subjectType: "crew_assignment", subjectRef, stageKey: "on_board",
  });
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { id: Number(req.headers["x-fixture-actor"] || 1), domain: "fixture", userType: "Office" };
    next();
  });
  const base = family === "company" ? "/company" : `/${family}`;
  app.use(base, { briefing: briefingRoutes, debriefing: debriefingRoutes, interview: interviewRoutes, company: companyRoutes }[family]!);
  if (family === "company") {
    // Supply a disposable subject/authorization adapter while exercising the
    // actual route, service, section policy, transactions, and read repository.
    vi.spyOn(companyFormSubmissionsService, "authorizeSubmission").mockImplementation(async (req: any) => {
      const actor = req.user.id;
      if (![1, 2].includes(actor)) throw new CompanyFormPermissionError();
      const submission = (await context.db.select().from(companyTables.frmCompanySubmissions)
        .where(eq(companyTables.frmCompanySubmissions.submissionUuid, submissionUuid)))[0];
      const subject = { subjectRef, context: {} };
      return { submission, subject, principal: { kind: "office", userId: actor, roleName: "Admin" },
        adapter: {
          lockForStart: async () => subject, canStart: () => true, lookup: async () => subject,
          authorize: async () => true, systemFields: [], signatories: [],
          loadStages: async () => [{ stageKey: "on_board", label: "On board" }],
        } } as any;
    });
    vi.spyOn(companyFormSubmissionsService as any, "authorize").mockResolvedValue(undefined);
    await context.db.update(engine.frmSections).set({ responsibleMode: "not_applicable" }).where(eq(engine.frmSections.sectionUuid, sectionUuid));
  }
  const url = family === "company" ? `${base}/${submissionUuid}` : `${base}/submissions/${submissionUuid}`;
  const put = (body: any, actor = 1) => request(app).put(`${url}/sections/${sectionUuid}/answers`).set("x-fixture-actor", String(actor)).send(body);
  const state = async (id = sectionUuid) => (await context.db.select().from(engine.frmSectionStates)
    .where(and(eq(engine.frmSectionStates.submissionUuid, submissionUuid), eq(engine.frmSectionStates.sectionUuid, id))))[0];
  return { app, url, put, state, sectionUuid, questionUuid, submissionUuid, otherSection };
}

for (const family of ["briefing", "debriefing", "interview", "company"]) describe(family, () => {
  it("persists only explicit saves, resolves the actual saver, supports repeat/no-change saves and reads the stored state", async () => {
    const f = await fixture(family);
    const answer = { questionUuid: f.questionUuid, value: "Saved response", comment: "Saved comment" };
    expect((await f.put({ answers: [answer] })).status).toBe(204);
    expect((await f.state()).lastDraftSavedAt).toBeNull();
    const saved = await f.put({ answers: [], explicitDraftSave: true });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.lastDraftSavedByName).toBe("First Saver");
    expect((await f.state()).status).toBe("not_started");
    expect((await f.state()).sectionComment).toBe("Do not clear");
    expect((await f.state(f.otherSection)).lastDraftSavedAt).toBeNull();
    await f.put({ answers: [{ ...answer, comment: "" }] }, 2);
    expect((await f.state()).lastDraftSavedByName).toBe("First Saver");
    expect((await f.put({ answers: [], explicitDraftSave: true }, 2)).body.lastDraftSavedByName).toBe("Second Saver");
    if (family !== "company") {
      const read = await request(f.app).get(f.url);
      expect(read.status, JSON.stringify(read.body)).toBe(200);
      expect(read.body.section_states.find((s: any) => s.section_uuid === f.sectionUuid).last_draft_saved_by_name).toBe("Second Saver");
    } else {
      const data = await companyFormSubmissionRenderRepository.readPinnedRenderData(f.submissionUuid);
      expect(data!.states.find((s: any) => s.sectionUuid === f.sectionUuid).lastDraftSavedByName).toBe("Second Saver");
      const read = await request(f.app).get(`${f.url}/form`);
      expect(read.status, JSON.stringify(read.body)).toBe(200);
      expect(read.body.states.find((s: any) => s.sectionUuid === f.sectionUuid).lastDraftSavedByName).toBe("Second Saver");
    }
  });
  it("rejects forged saver fields, invalid answers, denied actors and submitted sections without stamping metadata", async () => {
    const f = await fixture(family);
    expect((await f.put({ answers: [], explicitDraftSave: true, lastDraftSavedByName: "Forged" })).status).toBe(400);
    expect((await f.put({ answers: [], explicitDraftSave: true }, 3)).status).toBe(403);
    expect((await f.put({ answers: [{ questionUuid: uuid(), value: "bad" }], explicitDraftSave: true })).status).toBe(400);
    expect((await f.state()).lastDraftSavedAt).toBeNull();
    await context.db.update(engine.frmSectionStates).set({ status: "submitted" }).where(eq(engine.frmSectionStates.sectionUuid, f.sectionUuid));
    expect((await f.put({ answers: [], explicitDraftSave: true })).status).toBe(409);
    expect((await f.state()).lastDraftSavedAt).toBeNull();
  });
  it("rolls back answers as well as saved metadata when the final database write fails", async () => {
    const f = await fixture(family);
    await pool.query(`CREATE OR REPLACE FUNCTION reject_draft_stamp() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.submission_uuid = '${f.submissionUuid}' AND NEW.last_draft_saved_at IS NOT NULL
        THEN RAISE EXCEPTION 'Fixture write failure'; END IF; RETURN NEW; END $$`);
    await pool.query("CREATE TRIGGER reject_draft_stamp BEFORE UPDATE ON frm_section_states FOR EACH ROW EXECUTE FUNCTION reject_draft_stamp()");
    try {
      const failed = await f.put({ answers: [{ questionUuid: f.questionUuid, value: "Must roll back" }], explicitDraftSave: true });
      expect(failed.status).toBe(500);
      expect((await f.state()).lastDraftSavedAt).toBeNull();
      const answers = await context.db.select().from(engine.frmAnswers).where(eq(engine.frmAnswers.submissionUuid, f.submissionUuid));
      expect(answers).toHaveLength(0);
    } finally { await pool.query("DROP TRIGGER reject_draft_stamp ON frm_section_states"); }
  });
  it("rechecks submitted state after a concurrent parent-locked submission and rejects completed parents", async () => {
    const f = await fixture(family);
    const table = { briefing: "crew_briefing_submissions", debriefing: "crew_debriefing_submissions", interview: "crew_interview_submissions", company: "frm_company_submissions" }[family];
    const key = family === "company" ? "submission_uuid" : `${family}_submission_uuid`;
    const lock = await pool.connect();
    try {
      await lock.query("BEGIN");
      await lock.query(`SELECT 1 FROM ${table} WHERE ${key}=$1 FOR UPDATE`, [f.submissionUuid]);
      const saving = f.put({ answers: [], explicitDraftSave: true }).then(response => response);
      // Independently observe that the real request is waiting on our lock.
      let blocked = false;
      for (let n = 0; n < 100 && !blocked; n++) {
        blocked = Number((await pool.query("SELECT count(*) AS n FROM pg_stat_activity WHERE wait_event='transactionid'")).rows[0].n) > 0;
        if (!blocked) await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      await lock.query("UPDATE frm_section_states SET status='submitted' WHERE submission_uuid=$1", [f.submissionUuid]);
      await lock.query("COMMIT");
      expect((await saving).status).toBe(409);
      expect((await f.state()).lastDraftSavedAt).toBeNull();
    } finally { await lock.query("ROLLBACK"); lock.release(); }
    await pool.query("UPDATE frm_section_states SET status='not_started' WHERE submission_uuid=$1", [f.submissionUuid]);
    await pool.query(`UPDATE ${table} SET status='completed' WHERE ${key}=$1`, [f.submissionUuid]);
    expect((await f.put({ answers: [], explicitDraftSave: true })).status).toBe(409);
    expect((await f.state()).lastDraftSavedAt).toBeNull();
  });
});
