// Deliberate one-time acceptance fixture registration, NOT an automated test.
// Normal verification uses verify-company-pdf-layout-preview.mjs and reuses these.
import fs from "node:fs/promises";
import pg from "pg";
import { chromium } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { checkLifecycle } from "../server/v2/company-forms/stageResolutionService.ts";

if (!process.argv.includes("--provision-approved-layout-fixtures") ||
    process.env.TEST_DATABASE_VERIFIED === "true" || process.env.NODE_ENV === "production") {
  throw Error("Only explicitly approved main-preview layout fixture provisioning is allowed.");
}
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const identity = (await db.query(`SELECT system_identifier::text AS clusterid,
 (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS databaseoid FROM pg_control_system()`)).rows[0];
if (identity.clusterid !== "7586633721581772821" || identity.databaseoid !== "16384")
  throw Error("Refusing a database other than the approved main-preview development identity.");
const file = "docs/company-forms/pdf-layout-fixtures.json";
const prior = JSON.parse(await fs.readFile(file, "utf8"));
const revise = process.argv.includes("--revise-approved-layout");
if (prior.forms?.length && !prior.provisioning && (!revise || prior.layoutRevision === 3)) {
  console.log("Registered layout fixtures already exist; use the verification command. No new fixtures created.");
  await db.end(); process.exit(0);
}
const id = suffix => `a4120000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const registry = revise && !prior.provisioning && prior.layoutRevision !== 3
  ? { ...prior, priorSamples: [...(prior.priorSamples ?? []), ...prior.forms],
    forms: [], layoutRevision: 3, provisioning: true }
  : prior.provisioning ? prior : {
  databaseIdentity: identity, vesselUuid: id(1), assignmentUuid: id(2),
  crewUuid: "424584fc-dc59-4f85-aa14-30781eb8477e",
  vesselRoleUuid: id(52), vesselUserId: 412002,
  forms: [], provisionedBy: "approved PDF layout acceptance fixture setup",
};
const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = (user = 24, type = "Office") => `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: user, userType: type, domain: "test" })}.devsig`;
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
async function api(method, path, body, user = 24, type = "Office") {
  const response = await fetch(`${origin}/api/v2${path}`, {
    method, headers: { authorization: `Bearer ${token(user, type)}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw Error(`${method} ${path} refused (${response.status}): ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
const fixture = (await db.query("SELECT first_name FROM crew_members_v2 WHERE crew_uuid=$1 AND id=1266", [registry.crewUuid])).rows[0];
if (!fixture?.first_name.startsWith("TEST ONLY")) throw Error("The retained registered fixture seafarer is unavailable.");
const browser = await chromium.launch({ executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
const images = await page.evaluate(() => {
  const logo = document.createElement("canvas"); logo.width = 420; logo.height = 140;
  const l = logo.getContext("2d"); l.fillStyle = "#143b55"; l.fillRect(0, 0, 420, 140);
  l.fillStyle = "#fff"; l.font = "bold 32px sans-serif"; l.fillText("SAMPLE COMPANY", 24, 61);
  l.font = "18px sans-serif"; l.fillText("PDF LAYOUT REVIEW", 24, 100);
  const signature = document.createElement("canvas"); signature.width = 480; signature.height = 110;
  const s = signature.getContext("2d"); s.fillStyle = "#fff"; s.fillRect(0, 0, 480, 110);
  s.fillStyle = "#1c3654"; s.font = "italic 39px serif"; s.fillText("Sample signature", 16, 60);
  s.font = "13px sans-serif"; s.fillText("SYNTHETIC — NOT AN ACTUAL SIGNATURE", 16, 92);
  return { logo: logo.toDataURL(), signature: signature.toDataURL() };
});
await browser.close();
try {
  await db.query("BEGIN");
  await db.query("SELECT pg_advisory_xact_lock(412,2)");
  await db.query(`INSERT INTO master_vessels(vessel_uuid,vessel,is_active,is_deleted)
    SELECT $1,'TEST ONLY PDF layout review',true,false
    WHERE NOT EXISTS(SELECT 1 FROM master_vessels WHERE vessel_uuid=$1)`, [registry.vesselUuid]);
  const vesselId = (await db.query("SELECT id FROM master_vessels WHERE vessel_uuid=$1", [registry.vesselUuid])).rows[0].id;
  await db.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,sign_on_date)
    VALUES($1,$2,$3,'OnBoard',false,'2026-10-01') ON CONFLICT(assign_uuid) DO NOTHING`, [registry.assignmentUuid, registry.crewUuid, registry.vesselUuid]);
  registry.joiningAssignmentUuid = id(3);
  await db.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current)
    VALUES($1,$2,$3,'Planned',false) ON CONFLICT(assign_uuid) DO NOTHING`, [registry.joiningAssignmentUuid, registry.crewUuid, registry.vesselUuid]);
  registry.joiningPlanningUuid = id(6);
  const rank = (await db.query("SELECT ar_uuid,name FROM adm_available_ranks_v2 WHERE NOT is_deleted LIMIT 1")).rows[0];
  if (!rank) throw Error("A master rank is required for the registered fixture Planning row.");
  await db.query(`INSERT INTO vessel_planning_v2
    (plan_uuid,vessel_uuid,rank_id,rank,reliever_crew_uuid,reliever_assign_uuid,reliever_sign_on_date)
    VALUES($1,$2,$3,$4,$5,$6,'2026-10-23') ON CONFLICT(plan_uuid) DO NOTHING`,
    [registry.joiningPlanningUuid, registry.vesselUuid, rank.ar_uuid, rank.name, registry.crewUuid, registry.joiningAssignmentUuid]);
  registry.retainedPreparationAssignmentUuid = id(2);
  registry.onboardCrewUuid = id(4);
  registry.assignmentUuid = id(5);
  await db.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,present_rank)
    VALUES($1,'PDF-LAYOUT-412','TEST ONLY','PDF Layout Seafarer','Sample profile rank')
    ON CONFLICT(crew_uuid) DO NOTHING`, [registry.onboardCrewUuid]);
  await db.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,sign_on_date)
    VALUES($1,$2,$3,'OnBoard',true,'2026-10-01') ON CONFLICT(assign_uuid) DO NOTHING`,
    [registry.assignmentUuid, registry.onboardCrewUuid, registry.vesselUuid]);
  await db.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,parent_owned)
    VALUES($1,'PDF Layout Review Vessel','Ship',true) ON CONFLICT(ruid) DO NOTHING`, [registry.vesselRoleUuid]);
  await db.query(`INSERT INTO master_users(id,user_uuid,role,user_type,fullname,designation,vessel_ids)
    VALUES($1,$2,'PDF Layout Review Vessel','Ship','Sample Vessel Signer','Master',$3) ON CONFLICT(id) DO NOTHING`,
    [registry.vesselUserId, id(62), String(vesselId)]);
  await db.query("COMMIT");
  await fs.writeFile(file, JSON.stringify({ ...registry, provisioning: true }, null, 2) + "\n");
  await fs.writeFile("docs/company-form-verification-vessels.json", JSON.stringify({ vesselUuids: [registry.vesselUuid] }, null, 2) + "\n");
  // The register identifies all roots before guarded releases may inspect them.
  if (!(await fs.readFile("docs/company-form-regression-fixtures.md", "utf8")).includes("## PDF layout approval fixtures"))
    await fs.appendFile("docs/company-form-regression-fixtures.md", `\n## PDF layout approval fixtures (registered 2026-10-20)\n\nDedicated fixture-only vessel ${registry.vesselUuid} (TEST ONLY PDF layout review); assignment ${registry.assignmentUuid}; existing fixture crew ${registry.crewUuid} (id 1266) reused without changing his protected vessel-02 assignment/rotations. Vessel role ${registry.vesselRoleUuid}, synthetic Ship user ${registry.vesselUserId} / ${id(62)}. Detailed form/version/section/question/submission/branding/stage identifiers are recorded in [the layout manifest](company-forms/pdf-layout-fixtures.json). These fixtures are retained and reused. Real-form generation remains disabled. Sample branding is isolated from tenant settings; no real Access Control grants are changed.\n`);
  if (!(await fs.readFile("docs/company-form-regression-fixtures.md", "utf8")).includes(registry.joiningAssignmentUuid))
    await fs.appendFile("docs/company-form-regression-fixtures.md", `\nAdditional joining-stage layout fixture assignment: ${registry.joiningAssignmentUuid}; same registered fixture seafarer and fixture-only vessel, not his protected vessel-02 assignment.\n`);
  if (!(await fs.readFile("docs/company-form-regression-fixtures.md", "utf8")).includes(registry.onboardCrewUuid))
    await fs.appendFile("docs/company-form-regression-fixtures.md", `\nDedicated synthetic on-board layout seafarer ${registry.onboardCrewUuid} (TEST ONLY PDF Layout Seafarer, PDF-LAYOUT-412), current assignment ${registry.assignmentUuid}. A separate crew member is necessary because the retained seafarer's protected vessel-02 assignment remains current and unchanged. Preparation assignment ${registry.retainedPreparationAssignmentUuid} is retained, noncurrent and unused by the PDFs. No new fixture is created by normal verification.\n`);
  if (!revise) await api("PUT", `/admin/access-control/roles/${registry.vesselRoleUuid}/action-permissions`, {
    grants: { view: true, fill_in: true, witness: true, sign_representative: false, void: false,
      void_completed: false, override_checklist: false },
  });
  // Open only this synthetic assignment's historical stage, through the real
  // recorded rules check. No rule released today can apply to its 1 October date.
  await checkLifecycle({ subjectRef: registry.assignmentUuid, stage: "on_board", source: "sign_on",
    sourceKey: "pdf-layout-review-fixture", actor: "24", businessDate: "2026-10-01" });
  await checkLifecycle({ subjectRef: registry.joiningAssignmentUuid, stage: "before_joining", source: "deploy",
    sourceKey: "pdf-layout-review-joining-fixture", actor: "24", businessDate: "2026-10-01" });
  for (const [index, kind] of ["logo", "company-name"].entries()) {
    if (registry.forms.some(f => f.kind === kind)) continue;
    const offset = registry.layoutRevision === 3 ? 300 : registry.layoutRevision === 2 ? 200 : 0;
    const formUuid = id(offset + 11 + index), templatePart = id(offset + 81 + index);
    const form = (await db.query(`INSERT INTO adm_forms_v2(form_uuid,name,category,subject_type,rank_group,version_no,version_date)
      VALUES($1,$2,'dynamic','crew_assignment','','00','20-Oct-2026') RETURNING id`,
      [formUuid, `SAMPLE PDF layout review — ${kind}${registry.layoutRevision === 3 ? " — final glance" : registry.layoutRevision === 2 ? " — revised" : ""}`])).rows[0];
    await db.query(`INSERT INTO frm_form_parts(form_part_uuid,form_uuid,part_code,part_title,part_type)
      VALUES($1,$2,$3,'Recorded form and signatures','configurable')`, [templatePart, formUuid, `PDF_${index}`]);
    const version = await api("POST", `/admin/forms/${form.id}/versions`, {
      versionNo: "01", versionDate: "20-Oct-2026", configuration: "{}", stageKey: "on_board",
    });
    const part = (await db.query("SELECT form_part_uuid FROM frm_form_parts WHERE form_version_uuid=$1", [version.fvUuid])).rows[0];
    const section = id(offset + 21 + index), question = id(offset + 31 + index),
      rankQuestion = id(offset + 41 + index), content = id(offset + 91 + index);
    await db.query(`INSERT INTO frm_sections(section_uuid,form_version_uuid,form_part_uuid,section_code,section_title,
      responsible_mode,signature_officer_required,signature_seafarer_required,signature_vessel_management_required,vessel_signature_role_uuids)
      VALUES($1,$2,$3,'SIGNED_RECORD','Recorded answers and signatures','seafarer',true,true,true,$4)`,
      [section, version.fvUuid, part.form_part_uuid, [registry.vesselRoleUuid]]);
    await db.query(`INSERT INTO frm_questions(question_uuid,section_uuid,question_code,question_text,response_type,sort_order)
      VALUES($1,$2,'CONTENT','Purpose of this sample','content',0)`, [content, section]);
    await db.query(`UPDATE frm_questions SET content_html=$1 WHERE question_uuid=$2`,
      ["<p>This is a synthetic layout-review sample, not a real crew document. It demonstrates the frozen record, a long answer, the recorded missing contract rank and all three signature types.</p>", content]);
    await db.query(`INSERT INTO frm_questions(question_uuid,section_uuid,question_code,question_text,response_type,is_mandatory,sort_order)
      VALUES($1,$2,'LONG_ANSWER','Long recorded answer','free_text',true,1)`, [question, section]);
    await db.query(`INSERT INTO frm_questions(question_uuid,section_uuid,question_code,question_text,response_type,system_field_key,sort_order)
      VALUES($1,$2,'RANK','Contract rank at signing','system_field','rank',2)`, [rankQuestion, section]);
    registry.forms.push({ kind, formUuid, formId: form.id, versionUuid: version.fvUuid, versionId: version.id,
      templatePart, partUuid: part.form_part_uuid, sectionUuid: section, questionUuid: question,
      rankQuestionUuid: rankQuestion, contentQuestionUuid: content,
      assignmentUuid: registry.assignmentUuid, vesselUuid: registry.vesselUuid });
  }
  for (const f of registry.forms) {
    if (f.kind === "company-name" && !f.submissionUuid) f.assignmentUuid = registry.assignmentUuid;
    if (f.stageReady) continue;
    f.assignmentUuid = f.kind === "logo" ? registry.joiningAssignmentUuid : registry.assignmentUuid;
    const stage = f.kind === "logo" ? "before_joining" : "on_board";
    const current = (await db.query("SELECT * FROM adm_form_versions_v2 WHERE id=$1", [f.versionId])).rows[0];
    if (current.status.toLowerCase() === "released") {
      f.priorVersions = [...(f.priorVersions ?? []), { versionUuid: f.versionUuid, versionId: f.versionId,
        sectionUuid: f.sectionUuid, questionUuid: f.questionUuid, rankQuestionUuid: f.rankQuestionUuid,
        contentQuestionUuid: f.contentQuestionUuid, partUuid: f.partUuid }];
      const version = await api("POST", `/admin/forms/${f.formId}/versions`,
        { versionNo: "02", versionDate: "20-Oct-2026", configuration: "{}", stageKey: stage });
      f.versionUuid = version.fvUuid; f.versionId = version.id;
      const section = (await db.query("SELECT section_uuid,form_part_uuid FROM frm_sections WHERE form_version_uuid=$1", [f.versionUuid])).rows[0];
      f.sectionUuid = section.section_uuid; f.partUuid = section.form_part_uuid;
      const questions = (await db.query("SELECT question_uuid,question_code FROM frm_questions WHERE section_uuid=$1", [f.sectionUuid])).rows;
      for (const [key, code] of Object.entries({ questionUuid: "LONG_ANSWER", rankQuestionUuid: "RANK", contentQuestionUuid: "CONTENT" }))
        f[key] = questions.find(q => q.question_code === code).question_uuid;
    }
    await db.query("UPDATE adm_form_versions_v2 SET stage_key=$1 WHERE id=$2 AND lower(status)='draft'", [stage, f.versionId]);
    await db.query(`UPDATE frm_sections SET signature_officer_required=$1,signature_vessel_management_required=$2
      WHERE section_uuid=$3`, [f.kind === "logo", f.kind !== "logo", f.sectionUuid]);
    f.stageReady = true;
    await fs.writeFile(file, JSON.stringify({ ...registry, provisioning: true }, null, 2) + "\n");
  }
  await fs.writeFile(file, JSON.stringify({ ...registry, provisioning: true }, null, 2) + "\n");
  // From here the shared release guard enforces the registered fixture-only vessel.
  await import("./verification-guard.mjs");
  for (const f of registry.forms) {
    const released = (await db.query("SELECT status FROM adm_form_versions_v2 WHERE id=$1", [f.versionId])).rows[0].status;
    if (released.toLowerCase() !== "released") {
      await api("PUT", `/admin/form-versions/${f.versionId}/applicability`, {
        mode: "conditional", obligation: "optional", sets: [{ conditions: [
          { dimensionKey: "vessel", operator: "in", value: [registry.vesselUuid] },
        ] }],
      });
      await api("POST", `/admin/form-versions/${f.versionId}/release`, {});
    }
    if (!f.submissionUuid) {
      const started = await api("POST", `/company-form-submissions/subjects/crew_assignment/${f.assignmentUuid}/submissions`,
        { formUuid: f.formUuid, formVersionUuid: f.versionUuid }, f.kind === "logo" ? 24 : registry.vesselUserId, f.kind === "logo" ? "Office" : "Ship");
      f.submissionUuid = started.submissionUuid;
      f.brandingVersionUuid = randomUUID();
      await fs.writeFile(file, JSON.stringify({ ...registry, provisioning: true }, null, 2) + "\n");
    }
    const logoBytes = f.kind === "logo" ? Buffer.from(images.logo.split(",")[1], "base64") : null;
    await db.query("BEGIN");
    await db.query(`INSERT INTO frm_document_branding(version_uuid,company_name,media_type,bytes_base64,sha256,actor)
      VALUES($1,'Sample Shipping Company — layout review',$2,$3,$4,$5) ON CONFLICT(version_uuid) DO NOTHING`,
      [f.brandingVersionUuid, logoBytes ? "image/png" : null, logoBytes?.toString("base64") ?? null,
        logoBytes ? createHash("sha256").update(logoBytes).digest("hex") : null,
        { masterUserId: 24, name: "Registered layout fixture setup", source: "approved_acceptance_fixture" }]);
    await db.query("INSERT INTO frm_document_samples(submission_uuid,registration) VALUES($1,$2) ON CONFLICT(submission_uuid) DO NOTHING", [f.submissionUuid, f]);
    await db.query("COMMIT");
    await fs.writeFile(file, JSON.stringify({ ...registry, provisioning: true }, null, 2) + "\n");
    const path = `/company-form-submissions/${f.submissionUuid}/sections/${f.sectionUuid}`;
    const saved = (await db.query("SELECT status,system_snapshot_at FROM frm_company_submissions WHERE submission_uuid=$1", [f.submissionUuid])).rows[0];
    const actorId = f.kind === "logo" ? 24 : registry.vesselUserId, actorType = f.kind === "logo" ? "Office" : "Ship";
    if (!saved.system_snapshot_at) await api("PUT", `${path}/answers`, { answers: [{
      questionUuid: f.questionUuid, value: Array.from({ length: 32 }, (_, i) =>
        `Sample paragraph ${i + 1}. This answer was frozen when the form was signed. The stored PDF preserves the recorded words and does not look up current crew information. This deliberately long text checks wrapping, page breaks and continuation onto later pages.`
      ).join("\n\n"), comment: "A retained sample answer comment." }], sectionComment: "Synthetic layout review only." }, actorId, actorType);
    const signatures = (await db.query(`SELECT s.signature_type FROM frm_section_signatures s
      JOIN frm_section_states st USING(section_state_uuid) WHERE st.submission_uuid=$1 AND st.section_uuid=$2`,
      [f.submissionUuid, f.sectionUuid])).rows.map(s => s.signature_type);
    if (f.kind === "logo" && !signatures.includes("officer")) await api("POST", `${path}/signatures`, { signatureType: "officer", method: "officer", data: images.signature });
    if (!signatures.includes("seafarer")) await api("POST", `${path}/signatures`, { signatureType: "seafarer", method: "witnessed", seafarerPresent: true, data: images.signature }, actorId, actorType);
    if (f.kind !== "logo" && !signatures.includes("vessel_management")) await api("POST", `${path}/signatures`, { signatureType: "vessel_management", method: "vessel_management", data: images.signature }, registry.vesselUserId, "Ship");
    if (saved.status !== "completed") await api("POST", `${path}/submit`, {}, actorId, actorType);
    await api("POST", `/company-form-submissions/${f.submissionUuid}/pdf/retry`, {}, actorId, actorType);
  }
  registry.stageRecords = {};
  for (const table of ["frm_stage_cycles", "frm_stage_events", "frm_resolution_runs"])
    registry.stageRecords[table] = (await db.query(`SELECT * FROM ${table} WHERE subject_ref=ANY($1::text[])`,
      [[registry.assignmentUuid, registry.joiningAssignmentUuid, registry.retainedPreparationAssignmentUuid]])).rows;
  delete registry.provisioning;
  await fs.writeFile(file, JSON.stringify(registry, null, 2) + "\n");
  console.log(JSON.stringify({ vessel: registry.vesselUuid, assignment: registry.assignmentUuid,
    forms: registry.forms.map(f => ({ kind: f.kind, formId: f.formId, submissionUuid: f.submissionUuid })) }, null, 2));
} finally { await db.end(); }
