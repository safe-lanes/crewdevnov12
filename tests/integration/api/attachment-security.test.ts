import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID, createHash } from "node:crypto";
import { bootstrapMissingTestTables } from "../../helpers/private-schema";
import { crewAttachmentOwners, type AttachmentOwner } from "@server/v2/shared/attachmentAccess";
import { recruitmentAttachmentOwners } from "@server/v2/shared/recruitmentAttachmentAccess";
import { planningAttachmentOwner, drugAlcoholAttachmentOwner, promotionAttachmentOwner } from "@server/v2/shared/operationalAttachmentAccess";
import { fileStorageService } from "@server/v2/shared/fileStorageService";
import { standardSignatureParents, type SignatureFamily } from "@server/v2/shared/standardSignatureAccess";

// Only the connection provider is substituted. Authorization, signed-JWT
// verification, role/grant lookup, ownership joins and handlers are real.
vi.mock("@server/v2/db", async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const context = new AsyncLocalStorage();
  return { getDb: () => {
    const db = context.getStore();
    if (!db) throw new Error("Missing isolated attachment test tenant");
    return db;
  }, attachmentTestContext: context };
});

const secret = "isolated-attachment-security-test-key";
const schemas = [`att_a_${randomUUID().replaceAll("-", "")}`, `att_b_${randomUUID().replaceAll("-", "")}`];
const control = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const pools: Pool[] = [];
const prior = { secret: process.env.JWT_SECRET, bypass: process.env.AUTH_BYPASS };
let app: express.Express;
const crew = randomUUID(), vessel = randomUUID(), otherVessel = randomUUID();
const users = { office: 880001, ship: 880002, other: 880003, denied: 880004 };
type Case = { name: string; path: string; owner: AttachmentOwner; attachment: string; parent: string; state?: string; assignment?: string };
const cases: Case[] = [];
const paths: string[] = [];
const specs: { name: string; owner: AttachmentOwner; path: string; standard?: SignatureFamily; company?: boolean }[] = [
  ...["asset", "pdf"].map(kind => ({ name: `company/${kind}`, company: true,
    path: kind === "asset" ? "/api/v2/company-form-submissions/:submission/attachments/:att/raw"
      : "/api/v2/company-form-submissions/:submission/pdf",
    owner: { table: kind === "asset" ? "frm_signature_attachments" : "frm_document_files",
      key: kind === "asset" ? "sig_att_uuid" : "file_uuid",
      parent: "frm_company_submissions", parentKey: "submission_uuid", menu: "Crew Database" },
  })),
  ...Object.entries(standardSignatureParents).map(([name, config]) => ({
    name, standard: name as SignatureFamily, path: `/api/v2/${name}/signatures/:att/raw`,
    owner: { table: "frm_signature_attachments", key: "sig_att_uuid", parent: config.table,
      parentKey: config.key, menu: config.menu, subject: config.candidate ? "candidate" as const : undefined },
  })),
  { name: "promotion", owner: promotionAttachmentOwner, path: "/api/v2/promotions/attachments/:att/raw" },
  { name: "drugs-alcohol", owner: drugAlcoholAttachmentOwner, path: "/api/v2/drugs-alcohol/attachments/:att/raw" },
  { name: "planning", owner: planningAttachmentOwner, path: "/api/v2/vessel/planning/attachments/:att/raw" },
  ...Object.entries(crewAttachmentOwners).map(([name, owner]) => ({
    name: `crew/${name}`, owner, path: `/api/v2/crew-pool/${["briefing", "debriefing"].includes(name)
      ? `${name}-attachments/:att/raw` : `${name}/attachments/:att/raw`}`,
  })),
  ...Object.entries(recruitmentAttachmentOwners).map(([name, owner]) => ({
    name: `recruitment/${name}`, owner, path: `/api/v2/recruitment/${name}/attachments/:att/raw`,
  })),
];
const ident = (s: string) => {
  if (!/^[a-z][a-z0-9_]*$/.test(s)) throw new Error("Invalid test identifier");
  return `"${s}"`;
};

async function insert(table: string, supplied: Record<string, unknown>) {
  const columns = (await pools[0].query(`SELECT column_name,data_type FROM information_schema.columns
    WHERE table_schema=$1 AND table_name=$2 AND is_nullable='NO' AND column_default IS NULL
      AND is_identity='NO'`, [schemas[0], table])).rows;
  const data = { ...supplied };
  for (const col of columns) if (!(col.column_name in data)) {
    data[col.column_name] = ["integer", "bigint"].includes(col.data_type) ? 1
      : col.data_type === "boolean" ? false : col.data_type.includes("timestamp") ? new Date()
      : col.data_type === "date" ? "2026-10-20" : randomUUID();
  }
  const keys = Object.keys(data);
  await pools[0].query(`INSERT INTO ${ident(table)} (${keys.map(ident).join(",")})
    VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(data));
}
async function addCase(name: string, path: string, owner: AttachmentOwner) {
  const parent = randomUUID(), attachment = randomUUID();
  await insert(owner.parent, { [owner.parentKey]: parent,
    [owner.subjectColumn ?? (owner.subject === "candidate" ? "rec_can_uuid" : "crew_uuid")]:
      owner.subject === "vessel" ? vessel : owner.crewKey ? "ATTACHMENT-CREW" : crew });
  const via = owner.via ? randomUUID() : parent;
  if (owner.via) await insert(owner.via.table, { [owner.via.key]: via, [owner.via.parentKey]: parent });
  const hasData = (await pools[0].query(`SELECT 1 FROM information_schema.columns
    WHERE table_schema=$1 AND table_name=$2 AND column_name='file_data'`, [schemas[0], owner.table])).rowCount;
  let content: Record<string, string> = { file_data: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y=" };
  if (!hasData) {
    const filePath = await fileStorageService.writeAttachment("attachment-security", "evidence.pdf", Buffer.from("%PDF-1.4\n%%EOF"));
    paths.push(filePath);
    content = { file_path: filePath };
  }
  await insert(owner.table, { att_uuid: attachment, [owner.key]: via,
    file_name: "evidence.pdf", file_type: "application/pdf",
    ...content });
  cases.push({ name, path: path.replace(":att", attachment), owner, attachment, parent });
}
async function addStandardCase(spec: typeof specs[number]) {
  const config = standardSignatureParents[spec.standard!];
  const parent = randomUUID(), attachment = randomUUID(), state = randomUUID();
  await insert(config.table, { [config.key]: parent, [config.candidate ? "rec_can_uuid" : "crew_uuid"]: crew,
    ...(spec.standard === "briefings" ? { vessel_uuid: vessel } : {}) });
  const filePath = await fileStorageService.writeAttachment("attachment-security", "signature.pdf", Buffer.from("%PDF-1.4\n%%EOF"));
  paths.push(filePath);
  await insert("frm_signature_attachments", { sig_att_uuid: attachment, file_path: filePath });
  await insert("frm_section_states", { section_state_uuid: state, submission_uuid: parent });
  await insert("frm_section_signatures", { section_state_uuid: state, signature_att_uuid: attachment,
    signature_type: "officer", signature_method: "officer" });
  cases.push({ ...spec, path: spec.path.replace(":att", attachment), attachment, parent, state });
}
async function addCompanyCase(spec: typeof specs[number]) {
  const parent = randomUUID(), attachment = randomUUID(), state = randomUUID(), assignment = randomUUID();
  const form = randomUUID(), version = randomUUID(), part = randomUUID(), section = randomUUID();
  await insert("crew_assignments", { assign_uuid: assignment, crew_uuid: crew, vessel_uuid: vessel,
    assignment_type: "OnBoard", is_current: true });
  await insert("frm_company_submissions", { submission_uuid: parent, subject_type: "crew_assignment",
    subject_ref: assignment, form_uuid: form, form_version_uuid: version, stage_key: "on_board",
    status: "completed", completed_at: new Date() });
  if (spec.name.endsWith("asset")) {
    await insert("frm_form_parts", { form_part_uuid: part, form_uuid: form, form_version_uuid: version, part_type: "configurable" });
    await insert("frm_sections", { section_uuid: section, form_part_uuid: part, form_version_uuid: version });
    await insert("frm_section_states", { section_state_uuid: state, submission_uuid: parent, section_uuid: section });
    const filePath = await fileStorageService.writeAttachment("attachment-security", "signature.pdf", Buffer.from("%PDF-1.4\n%%EOF"));
    paths.push(filePath);
    await insert("frm_signature_attachments", { sig_att_uuid: attachment, file_path: filePath });
    await insert("frm_section_signatures", { section_state_uuid: state, signature_att_uuid: attachment,
      signature_type: "officer", signature_method: "officer" });
  } else {
    const bytes = Buffer.from("%PDF-1.4\n%%EOF");
    await insert("frm_document_files", { file_uuid: attachment, submission_uuid: parent, pdf_bytes: bytes,
      file_sha256: createHash("sha256").update(bytes).digest("hex"), frozen_record_sha256: "a".repeat(64),
      byte_length: bytes.length, page_count: 1 });
  }
  cases.push({ ...spec, path: spec.path.replace(":submission", parent).replace(":att", attachment),
    attachment, parent, state, assignment });
}
function call(path: string, actor: keyof typeof users = "office", domain = "a") {
  const token = jwt.sign({ id: users[actor], userType: actor === "office" || actor === "denied" ? "Office" : "Ship",
    domain, vessels: [vessel] }, secret, { expiresIn: "1h" });
  return request(app).get(path).set("Authorization", `Bearer ${token}`);
}

beforeAll(async () => {
  expect(process.env.TEST_DATABASE_VERIFIED).toBe("true");
  for (const schema of schemas) {
    await control.query(`CREATE SCHEMA ${ident(schema)}`);
    await bootstrapMissingTestTables(control, schema);
    pools.push(new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` }));
  }
  await insert("crew_members_v2", { crew_uuid: crew, emp_no: "ATTACHMENT-CREW", first_name: "Synthetic", family_name: "Attachment Evidence" });
  await insert("recruitment_candidates_v2", { rec_can_uuid: crew });
  await insert("master_vessels", { id: 880001, vessel_uuid: vessel, vessel: "TEST ONLY Attachment Own", is_active: true, is_deleted: false });
  await insert("master_vessels", { id: 880002, vessel_uuid: otherVessel, vessel: "TEST ONLY Attachment Other", is_active: true, is_deleted: false });
  await insert("crew_assignments", { assign_uuid: randomUUID(), crew_uuid: crew, vessel_uuid: vessel,
    is_current: true, assignment_type: "OnBoard", sign_on_date: "2026-10-01" });
  const menus: string[] = [];
  for (const name of new Set(specs.map(s => s.owner.menu))) {
    const menu = randomUUID();
    await insert("adm_menumaster_ac", { muid: menu, name, is_active: true, is_deleted: false });
    menus.push(menu);
  }
  for (const [name, id] of Object.entries(users)) {
    const role = randomUUID(), ship = name === "ship" || name === "other";
    await insert("adm_rolemaster_ac", { ruid: role, assigned_role: `Attachment ${name}`, roletype: ship ? "Ship" : "Office", is_active: true, is_deleted: false });
    await insert("master_users", { id, user_type: ship ? "Ship" : "Office", role: `Attachment ${name}`,
      vessel_ids: ship ? (name === "ship" ? "880001" : "880002") : null });
    for (const menu of menus) await insert("adm_roleaccess_ac", { role_id: role, menu_id: menu, canview: name !== "denied", is_deleted: false });
    await insert("adm_resource_action_grants", { role_id: role, resource: "company_forms", action: "view", allowed: name !== "denied" });
  }
  for (const spec of specs) {
    if (spec.company) await addCompanyCase(spec);
    else if (spec.standard) await addStandardCase(spec);
    else await addCase(spec.name, spec.path, spec.owner);
  }
  process.env.JWT_SECRET = secret;
  delete process.env.AUTH_BYPASS;
  const { attachmentTestContext } = await import("@server/v2/db") as any;
  const { authMiddleware } = await import("@server/middleware/authMiddleware");
  const { default: crewRoutes } = await import("@server/v2/crew-pool/routes");
  const { default: recruitmentRoutes } = await import("@server/routes/v2/recruitment");
  const { default: vesselRoutes } = await import("@server/v2/vessel/routes");
  const { default: drugRoutes } = await import("@server/v2/drugs-alcohol/routes");
  const { default: promotionRoutes } = await import("@server/v2/promotions/routes");
  const { default: briefingRoutes } = await import("@server/v2/briefings/routes");
  const { default: debriefingRoutes } = await import("@server/v2/debriefings/routes");
  const { default: interviewRoutes } = await import("@server/v2/interviews/routes");
  const { default: companyRoutes } = await import("@server/v2/company-forms/routes");
  app = express();
  // Select separate real database schemas as tenants; no connection can fall
  // through to public. The production auth middleware still verifies each JWT.
  app.use((req, res, next) => {
    const token = req.headers.authorization?.slice(7);
    const domain = token ? (jwt.decode(token) as any)?.domain : "a";
    const index = domain === "a" ? 0 : domain === "b" ? 1 : -1;
    if (index < 0) { res.sendStatus(403); return; }
    attachmentTestContext.run(drizzle(pools[index]), next);
  });
  app.use(authMiddleware);
  app.use("/api/v2/crew-pool", crewRoutes);
  app.use("/api/v2/recruitment", recruitmentRoutes);
  app.use("/api/v2/vessel", vesselRoutes);
  app.use("/api/v2/drugs-alcohol", drugRoutes);
  app.use("/api/v2/promotions", promotionRoutes);
  app.use("/api/v2/briefings", briefingRoutes);
  app.use("/api/v2/debriefings", debriefingRoutes);
  app.use("/api/v2/interviews", interviewRoutes);
  app.use("/api/v2/company-form-submissions", companyRoutes);
}, 120000);

afterAll(async () => {
  for (const pool of pools) await pool.end();
  for (const filePath of paths) await fileStorageService.deleteAttachment(filePath);
  for (const schema of schemas) await control.query(`DROP SCHEMA IF EXISTS ${ident(schema)} CASCADE`);
  await control.end();
  if (prior.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = prior.secret;
  if (prior.bypass === undefined) delete process.env.AUTH_BYPASS; else process.env.AUTH_BYPASS = prior.bypass;
});

describe.each(specs)("attachment $name", ({ name, owner, standard, company }) => {
  const fixture = () => cases.find(c => c.name === name)!;
  it("allows authenticated office and own-vessel users to read actual bytes", async () => {
    for (const actor of (owner.subject === "candidate" ? ["office"] : ["office", "ship"]) as ("office" | "ship")[]) {
      const response = await call(fixture().path, actor);
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("application/pdf");
      expect(response.body.length).toBeGreaterThan(0);
    }
    if (owner.subject === "candidate") expect((await call(fixture().path, "ship")).status).toBe(403);
  });
  it("refuses other vessel, other tenant, missing grant, no JWT and forged JWT", async () => {
    expect((await call(fixture().path, "other")).status).toBe(403);
    expect((await call(fixture().path, "office", "b")).status).toBeGreaterThanOrEqual(400);
    expect((await call(fixture().path, "denied")).status).toBe(403);
    expect((await request(app).get(fixture().path)).status).toBe(401);
    const forged = jwt.sign({ id: users.office, domain: "a", userType: "Office" }, "wrong-key");
    expect((await request(app).get(fixture().path).set("Authorization", `Bearer ${forged}`)).status).toBe(401);
  });
  it("refuses deleted attachment, deleted parent, deleted crew and orphaned parent", async () => {
    const f = fixture();
    if (company) {
      const deletions = [
        ["frm_company_submissions", "submission_uuid", f.parent],
        ["crew_assignments", "assign_uuid", f.assignment!],
        ["crew_members_v2", "crew_uuid", crew],
      ];
      if (name.endsWith("asset")) deletions.push(["frm_signature_attachments", "sig_att_uuid", f.attachment]);
      for (const [table, key, value] of deletions) {
        await pools[0].query(`UPDATE ${ident(table)} SET is_deleted=true WHERE ${ident(key)}=$1`, [value]);
        try { expect((await call(f.path)).status).toBe(404); }
        finally { await pools[0].query(`UPDATE ${ident(table)} SET is_deleted=false WHERE ${ident(key)}=$1`, [value]); }
      }
      await pools[0].query("UPDATE frm_company_submissions SET subject_ref=$1 WHERE submission_uuid=$2", [randomUUID(), f.parent]);
      try { expect((await call(f.path)).status).toBe(404); }
      finally { await pools[0].query("UPDATE frm_company_submissions SET subject_ref=$1 WHERE submission_uuid=$2", [f.assignment, f.parent]); }
      return;
    }
    const deletionCases = [[owner.table, standard ? "sig_att_uuid" : "att_uuid", f.attachment], [owner.parent, owner.parentKey, f.parent]];
    if (standard) deletionCases.push(["frm_section_states", "section_state_uuid", f.state!],
      ["frm_section_signatures", "signature_att_uuid", f.attachment]);
    if (owner.subject !== "vessel") deletionCases.push(
      [owner.subject === "candidate" ? "recruitment_candidates_v2" : "crew_members_v2",
        owner.subject === "candidate" ? "rec_can_uuid" : "crew_uuid", crew]);
    for (const [table, key, value] of deletionCases) {
      await pools[0].query(`UPDATE ${ident(table)} SET is_deleted=true WHERE ${ident(key)}=$1`, [value]);
      try { expect((await call(f.path)).status).toBe(404); }
      finally { await pools[0].query(`UPDATE ${ident(table)} SET is_deleted=false WHERE ${ident(key)}=$1`, [value]); }
    }
    if (standard) {
      await pools[0].query("UPDATE frm_section_states SET submission_uuid=$1 WHERE section_state_uuid=$2", [randomUUID(), f.state]);
      try { expect((await call(f.path)).status).toBe(404); }
      finally { await pools[0].query("UPDATE frm_section_states SET submission_uuid=$1 WHERE section_state_uuid=$2", [f.parent, f.state]); }
      return;
    }
    const originalKey = (await pools[0].query(`SELECT ${ident(owner.key)} AS key FROM ${ident(owner.table)} WHERE att_uuid=$1`, [f.attachment])).rows[0].key;
    await pools[0].query(`UPDATE ${ident(owner.table)} SET ${ident(owner.key)}=$1 WHERE att_uuid=$2`, [randomUUID(), f.attachment]);
    try { expect((await call(f.path)).status).toBe(404); }
    finally { await pools[0].query(`UPDATE ${ident(owner.table)} SET ${ident(owner.key)}=$1 WHERE att_uuid=$2`, [originalKey, f.attachment]); }
  });
});

describe("secondary attachment response paths", () => {
  it("crew profile and collections require grants and own-vessel ownership", async () => {
    for (const path of [`/api/v2/crew-pool/crew/${crew}/training`, `/api/v2/crew-pool/crew/${crew}/profile`,
      `/api/v2/crew-pool/crew/by-emp-no/ATTACHMENT-CREW`]) {
      expect((await call(path, "other")).status).toBe(403);
      expect((await call(path, "denied")).status).toBe(403);
    }
    const own = await call(`/api/v2/crew-pool/crew/${crew}/training`, "ship");
    expect(own.status).toBe(200);
    expect(JSON.stringify(own.body)).not.toContain("fileData");
    expect(JSON.stringify(own.body)).not.toContain("filePath");
  });
  it("recruitment metadata cannot bypass the Office permission boundary", async () => {
    const f = cases.find(c => c.name === "recruitment/training")!;
    for (const path of [`/api/v2/recruitment/training/${f.parent}/attachments`,
      `/api/v2/recruitment/candidates/${crew}/training`]) {
      expect((await call(path, "ship")).status).toBe(403);
      expect((await call(path, "denied")).status).toBe(403);
      const result = await call(path);
      expect(result.status).toBe(200);
      expect(JSON.stringify(result.body)).not.toContain("fileData");
      expect(JSON.stringify(result.body)).not.toContain("filePath");
    }
  });
  it("planning attachment metadata has the same vessel boundary as raw bytes", async () => {
    const f = cases.find(c => c.name === "planning")!;
    const path = `/api/v2/vessel/planning/${f.parent}/attachments`;
    expect((await call(path, "other")).status).toBe(403);
    expect((await call(path, "denied")).status).toBe(403);
    const own = await call(path, "ship");
    expect(own.status).toBe(200);
    expect(JSON.stringify(own.body)).not.toContain("fileData");
    expect(JSON.stringify(own.body)).not.toContain("filePath");
  });
});
