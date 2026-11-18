// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, is, and } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import express from "express";
import request from "supertest";
import * as admin from "../../shared/v2/admin/schema";
import * as engine from "../../shared/v2/forms-engine/schema";
import { masterUsers } from "../../shared/schema";
import { crewBriefings } from "../../shared/v2/crew-pool/schema";
import { recruitmentCandidatesV2, screeningB6Interviews, screeningB6InterviewItems } from "../../shared/v2/recruitment/schema";

const state = vi.hoisted(() => ({ db: null as any, authorized: true }));
vi.mock("../../server/v2/db", () => ({ getDb: () => state.db }));
vi.mock("../../server/v2/auth/roleResolutionService", () => ({
  resolveRequestRole: async () => state.authorized
    ? { ok: true, role: { roleId: "test-role" } } : { ok: false, reason: "missing_identity" },
}));
import { formsService } from "../../server/v2/admin/services/formsService";
import { formStructureRepository } from "../../server/v2/admin/repositories/formStructureRepository";
import { formsController } from "../../server/v2/admin/controllers/formsController";
import { requirePermission } from "../../server/middleware/requirePermission";
import { registerLegacyCases } from "./legacyCases";
import { registerReleasedResolutionCases } from "./releasedResolutionCases";

const tables = [...new Map([...Object.values(admin), ...Object.values(engine),
  masterUsers, crewBriefings, recruitmentCandidatesV2, screeningB6Interviews, screeningB6InterviewItems]
  .filter((t): t is PgTable => is(t, PgTable)).map(t => [getTableConfig(t).name, t])).values()];
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
let pool: Pool, directory: string;
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "initial-standard-draft-"));
  execFileSync("initdb", ["-D", join(directory, "data"), "-U", "form_test", "-A", "trust", "--no-locale"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", join(directory, "data"), "-l", join(directory, "postgres.log"),
    "-o", `-k ${directory} -p 55447 -c listen_addresses=''`, "-w", "start"], { stdio: "pipe" });
  pool = new Pool({ host: directory, port: 55447, user: "form_test", database: "postgres" });
  state.db = drizzle(pool);
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
}, 60000);
afterAll(async () => {
  if (pool) await pool.end();
  if (directory) {
    try { execFileSync("pg_ctl", ["-D", join(directory, "data"), "-m", "immediate", "-w", "stop"], { stdio: "pipe" }); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  }
});
beforeEach(async () => {
  vi.restoreAllMocks();
  state.authorized = true;
  await pool.query(`TRUNCATE ${tables.map(t => quote(getTableConfig(t).name)).join(",")} RESTART IDENTITY`);
});
async function fixture(category = "briefing", templates = true) {
  const [form] = await state.db.insert(admin.admFormsV2).values({
    formUuid: randomUUID(), name: "Fixture " + randomUUID(), category,
    rankGroup: "Deck", versionNo: "00", versionDate: "01-Nov-2026", isLockForm: false,
  }).returning();
  const [group] = await state.db.insert(admin.admRankGroupsV2).values({
    rgUuid: randomUUID(), formId: form.id, name: "Deck", ranks: "[]", configuration: '{"preserved":true}',
  }).returning();
  if (templates) await state.db.insert(engine.frmFormParts).values([
    { formPartUuid: randomUUID(), formUuid: form.formUuid, partCode: "FIXED", partTitle: "Identity", partType: "fixed", isOfficeOnly: true, sortOrder: 0 },
    { formPartUuid: randomUUID(), formUuid: form.formUuid, partCode: "B", partTitle: "Configuration", partType: "configurable", isOfficeOnly: false, sortOrder: 1 },
  ]);
  return { form, group };
}
const versions = () => state.db.select().from(admin.admFormVersionsV2);
const parts = () => state.db.select().from(engine.frmFormParts);
registerLegacyCases(() => state.db, fixture);
registerReleasedResolutionCases(() => state.db, fixture);

describe("scoped first-draft transaction", () => {
  it.each(["briefing", "debriefing", "interview"])("initializes %s once, preserves templates, releases and copies normally", async category => {
    const { form, group } = await fixture(category);
    const before = await parts();
    const [first, concurrent] = await Promise.all([
      formsService.ensureInitialStandardDraft(form.id, group.id),
      formsService.ensureInitialStandardDraft(form.id, group.id),
    ]);
    expect(concurrent.fvUuid).toBe(first.fvUuid);
    expect(first).toMatchObject({ status: "draft", versionNo: "01", configuration: '{"preserved":true}' });
    expect(await versions()).toHaveLength(1);
    const owned = (await parts()).filter((p: any) => p.formVersionUuid === first.fvUuid);
    expect(owned.map((p: any) => [p.partCode, p.partType, p.isOfficeOnly, p.sortOrder]))
      .toEqual(before.map((p: any) => [p.partCode, p.partType, p.isOfficeOnly, p.sortOrder]));
    expect(owned.every((p: any) => before.every((t: any) => t.formPartUuid !== p.formPartUuid))).toBe(true);
    expect((await parts()).filter((p: any) => !p.formVersionUuid)).toEqual(before);
    await state.db.update(admin.admFormVersionsV2).set({ configuration: '{"edited":true}' }).where(eq(admin.admFormVersionsV2.id, first.id));
    const resumed = await formsService.ensureInitialStandardDraft(form.id, group.id);
    expect(resumed.configuration).toBe('{"edited":true}');
    await formsService.releaseVersionById(first.id);
    expect((await formsService.ensureInitialStandardDraft(form.id, group.id)).status).toBe("released");
    expect(await versions()).toHaveLength(1);
    const next = await formsService.createVersionByFormId(form.id, { rankGroupId: group.id, configuration: '{"next":true}' } as any);
    expect(next).toMatchObject({ versionNo: "02", status: "draft" });
    expect((await parts()).filter((p: any) => p.formVersionUuid === next.fvUuid)).toHaveLength(2);
  });
  it.each(["appraisal", "promotion", "dynamic", "other"])("rejects excluded %s without writes", async category => {
    const { form, group } = await fixture(category);
    await expect(formsService.ensureInitialStandardDraft(form.id, group.id)).rejects.toThrow("not supported");
    expect(await versions()).toEqual([]);
  });
  it("adds a usable configurable part only to a fresh draft when templates are absent", async () => {
    const { form, group } = await fixture("interview", false);
    const draft = await formsService.ensureInitialStandardDraft(form.id, group.id);
    expect(await parts()).toMatchObject([{ partType: "configurable", formVersionUuid: draft.fvUuid }]);
    expect(await formsService.ensureInitialStandardDraft(form.id, group.id)).toMatchObject({ fvUuid: draft.fvUuid });
    expect(await parts()).toHaveLength(1);
  });
  it("rolls back the new version when part initialization fails", async () => {
    const { form, group } = await fixture();
    vi.spyOn(formStructureRepository, "initializePartsFromTemplates").mockRejectedValueOnce(new Error("fixture failure"));
    await expect(formsService.ensureInitialStandardDraft(form.id, group.id)).rejects.toThrow("fixture failure");
    expect(await versions()).toEqual([]);
    expect((await parts()).every((p: any) => !p.formVersionUuid)).toBe(true);
  });
  it("rejects cross-form, archived and deleted rank groups", async () => {
    const a = await fixture(), b = await fixture();
    await expect(formsService.ensureInitialStandardDraft(a.form.id, b.group.id)).rejects.toThrow("active rank group");
    await state.db.update(admin.admRankGroupsV2).set({ archivedAt: new Date() }).where(eq(admin.admRankGroupsV2.id, a.group.id));
    await expect(formsService.ensureInitialStandardDraft(a.form.id, a.group.id)).rejects.toThrow("active rank group");
    await state.db.update(admin.admRankGroupsV2).set({ isDeleted: true }).where(eq(admin.admRankGroupsV2.id, b.group.id));
    await expect(formsService.ensureInitialStandardDraft(b.form.id, b.group.id)).rejects.toThrow("active rank group");
    expect(await versions()).toEqual([]);
  });
  it("rejects archived forms and refuses to recycle deleted version history", async () => {
    const { form, group } = await fixture();
    await state.db.update(admin.admFormsV2).set({ archivedAt: new Date() }).where(eq(admin.admFormsV2.id, form.id));
    await expect(formsService.ensureInitialStandardDraft(form.id, group.id)).rejects.toThrow("archived");
    await state.db.update(admin.admFormsV2).set({ archivedAt: null }).where(eq(admin.admFormsV2.id, form.id));
    await state.db.insert(admin.admFormVersionsV2).values({ fvUuid: randomUUID(), formId: form.id, rankGroupId: group.id,
      versionNo: "09", versionDate: "01-Nov-2026", status: "released", isDeleted: true });
    await expect(formsService.ensureInitialStandardDraft(form.id, group.id)).rejects.toThrow("archived version history");
    expect(await versions()).toHaveLength(1);
  });
  it.each(["appraisal", "promotion", "briefing", "dynamic"])("does not relax strict normal copying for a %s source without owned parts", async category => {
    const { form, group } = await fixture(category, false);
    // Company Forms are ungrouped; all other versions retain same-group ownership.
    await state.db.insert(admin.admFormVersionsV2).values({
      fvUuid: randomUUID(), formId: form.id, rankGroupId: category === "dynamic" ? null : group.id,
      versionNo: "09", versionDate: "01-Nov-2026", status: "released", configuration: '{"untouched":true}',
    });
    await expect(formsService.createVersionByFormId(form.id, {
      rankGroupId: category === "dynamic" ? null : group.id, configuration: '{"attempt":true}',
    } as any)).rejects.toThrow(["appraisal", "promotion"].includes(category)
      ? "cannot safely create a draft" : "no version-owned parts");
    expect(await versions()).toMatchObject([{ versionNo: "09", status: "released", configuration: '{"untouched":true}' }]);
  });
});

// Run the existing template/copy regression suite against this same disposable
// PostgreSQL cluster rather than requiring access to the application's database.
await import("../integration/form-version-template-init.test");

describe("initialization API and existing Forms permissions", () => {
  function app() {
    const app = express();
    app.use(express.json());
    app.post("/forms/:id/initial-draft", requirePermission("Forms", "create"), requirePermission("Forms", "edit"),
      formsController.ensureInitialStandardDraft);
    return app;
  }
  async function grants(create: boolean, edit: boolean) {
    await state.db.insert(admin.admMenuMasterAc).values({ muid: "forms-menu", name: "Forms", route: "/forms", isActive: true, isDeleted: false });
    await state.db.insert(admin.admRoleAccessAc).values({ rauid: randomUUID(), roleId: "test-role", menuId: "forms-menu",
      canview: true, cancreate: create, canedit: edit, candelete: false, isDeleted: false });
  }
  it.each([[false, true], [true, false], [false, false]])("denies create=%s edit=%s", async (create, edit) => {
    const { form, group } = await fixture();
    await grants(create, edit);
    expect((await request(app()).post(`/forms/${form.id}/initial-draft`).send({ rankGroupId: group.id })).status).toBe(403);
    expect(await versions()).toEqual([]);
  });
  it("permits the scoped operation, ignores no caller audit identity, and rejects extra fields", async () => {
    const { form, group } = await fixture();
    await grants(true, true);
    expect((await request(app()).post(`/forms/${form.id}/initial-draft`).send({ rankGroupId: group.id, auditUserUuid: "forged" })).status).toBe(400);
    const result = await request(app()).post(`/forms/${form.id}/initial-draft`).send({ rankGroupId: group.id });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ formId: form.id, rankGroupId: group.id, versionNo: "01" });
    const source = readFileSync("server/v2/admin/routes.ts", "utf8");
    expect(source).toContain('router.post("/forms/:id/initial-draft", requirePermission("Forms", "create"), requirePermission("Forms", "edit"), formsController.ensureInitialStandardDraft)');
  });
});
