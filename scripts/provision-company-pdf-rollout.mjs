// Explicit, one-time user-approved acceptance fixture. Reruns reuse the record.
import fs from "node:fs/promises";
import pg from "pg";
if (!process.argv.includes("--approved-rollout-fixture") || process.env.NODE_ENV !== "development")
  throw Error("Explicit development acceptance registration is required.");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const base = JSON.parse(await fs.readFile("docs/company-forms/pdf-layout-fixtures.json", "utf8"));
  const path = "docs/company-forms/pdf-rollout-fixtures.json";
  const identity = (await db.query(`SELECT system_identifier::text AS clusterid,
    (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS databaseoid FROM pg_control_system()`)).rows[0];
  if (JSON.stringify(identity) !== JSON.stringify(base.databaseIdentity)) throw Error("Wrong acceptance database.");
  const enc = x => Buffer.from(JSON.stringify(x)).toString("base64url");
  const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: 24, userType: "Office", domain: "test" })}.devsig`;
  async function api(method, path, body) {
    const r = await fetch(`https://${process.env.REPLIT_DEV_DOMAIN}/api/v2${path}`, {
      method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw Error(`Fixture operation refused: ${r.status} ${await r.text()}`);
    return r.json();
  }
  let f;
  try { f = JSON.parse(await fs.readFile(path, "utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; }
  if (!f) {
    const formUuid = "a4120000-0000-4000-8000-000000000411";
    const form = (await db.query(`INSERT INTO adm_forms_v2(form_uuid,name,category,subject_type,rank_group,version_no,version_date)
      VALUES($1,'TEST ONLY Approved PDF automatic rollout','dynamic','crew_assignment','','00','20-Oct-2026') RETURNING id`,
      [formUuid])).rows[0];
    await db.query(`INSERT INTO frm_form_parts(form_part_uuid,form_uuid,part_code,part_title,part_type)
      VALUES('a4120000-0000-4000-8000-000000000481',$1,'ROLLOUT','Automatic stored copy','configurable')`, [formUuid]);
    f = { databaseIdentity: identity, formUuid, formId: form.id,
      crewUuid: base.crewUuid, assignmentUuid: base.joiningAssignmentUuid, vesselUuid: base.vesselUuid,
      sectionUuid: "a4120000-0000-4000-8000-000000000421" };
    await fs.writeFile(path, JSON.stringify(f, null, 2) + "\n");
    await fs.appendFile("docs/company-form-regression-fixtures.md", `\n### Approved PDF rollout acceptance fixture (20-Oct-2026)\n\nOne new form ${formUuid}, template part a4120000-0000-4000-8000-000000000481, section ${f.sectionUuid}; existing crew ${f.crewUuid}, assignment ${f.assignmentUuid}, fixture-only vessel ${f.vesselUuid} reused. Full retained descendants are registered in [the rollout manifest](company-forms/pdf-rollout-fixtures.json). No new crew, vessel, assignment or grant. The released rule must be conditional on this fixture-only vessel in every set. It is deliberately NOT a registered PDF sample: ordinary generation must prepare it automatically. Normal reruns reuse this form.\n`);
  }
  if (!f.versionUuid) {
    const v = await api("POST", `/admin/forms/${f.formId}/versions`, {
      versionNo: "01", versionDate: "20-Oct-2026", configuration: "{}", stageKey: "before_joining",
    });
    f.versionUuid = v.fvUuid; f.versionId = v.id;
    const part = (await db.query("SELECT form_part_uuid FROM frm_form_parts WHERE form_version_uuid=$1", [v.fvUuid])).rows[0];
    f.partUuid = part.form_part_uuid;
    await db.query(`INSERT INTO frm_sections(section_uuid,form_version_uuid,form_part_uuid,section_code,section_title,
      responsible_mode,signature_officer_required,signature_seafarer_required)
      VALUES($1,$2,$3,'SIGNED_ROLLOUT','Approval and witnessed signing','seafarer',true,true)`,
      [f.sectionUuid, f.versionUuid, f.partUuid]);
    await fs.writeFile(path, JSON.stringify(f, null, 2) + "\n");
  }
  if (!f.released) {
    await import("./verification-guard.mjs");
    await api("PUT", `/admin/form-versions/${f.versionId}/applicability`, {
      mode: "conditional", obligation: "optional", effectiveKind: "on_release",
      sets: [{ conditions: [{ dimensionKey: "vessel", operator: "in", value: [f.vesselUuid] }] }],
    });
    await api("POST", `/admin/form-versions/${f.versionId}/release`, {});
    f.released = true;
    await fs.writeFile(path, JSON.stringify(f, null, 2) + "\n");
  }
  if (!f.submissionUuid) {
    const started = await api("POST", `/company-form-submissions/subjects/crew_assignment/${f.assignmentUuid}/submissions`,
      { formUuid: f.formUuid, formVersionUuid: f.versionUuid });
    f.submissionUuid = started.submissionUuid;
    await fs.writeFile(path, JSON.stringify(f, null, 2) + "\n");
  }
  console.log(JSON.stringify(f, null, 2));
} finally { await db.end(); }
