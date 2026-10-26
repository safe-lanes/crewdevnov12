// @ts-ignore Development acceptance-only guard.
import "./verification-guard.mjs";
import { Pool } from "pg";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { companyFormSubjectRegistry } from "../server/v2/company-forms/registry";
import { recordResolution } from "../server/v2/company-forms/requirementsRepository";

async function main() {
  const fixture = JSON.parse(await readFile("docs/training-compliance-slice-4-fixtures.json", "utf8"));
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  const root = ".local/verification/training-slice5";
  await mkdir(root, { recursive: true });
  const token = [Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ id: 24, userType: "Office", domain: "test" })).toString("base64url"), "devsig"].join(".");
  const api = async (method: string, path: string, body?: unknown) => {
    const response = await fetch(`https://${process.env.REPLIT_DEV_DOMAIN}/api/v2${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!response.ok) throw Error(`Fixture API refused ${path}: ${response.status} ${await response.text()}`);
    return response.json();
  };
  try {
    // Reuse the registered company-name PDF form: original pinned samples stay unchanged.
    const formUuid = "a4120000-0000-4000-8000-000000000012";
    let version = (await db.query(`SELECT v.* FROM adm_form_versions_v2 v
      JOIN frm_version_applicability p ON p.version_uuid=v.fv_uuid
      WHERE v.form_id=5297 AND v.stage_key='before_joining' AND p.obligation='mandatory'
      ORDER BY v.id DESC LIMIT 1`)).rows[0];
    if (!version) {
      const draft = (await db.query(`SELECT * FROM adm_form_versions_v2
        WHERE form_id=5297 AND status='draft' AND stage_key='before_joining' ORDER BY id DESC LIMIT 1`)).rows[0];
      if (!draft) throw Error("Author the registered fixture draft once through Forms Configuration; automated version creation is refused.");
      await api("PUT", `/admin/form-versions/${draft.id}/applicability`, {
        mode: "conditional", obligation: "mandatory", effectiveKind: "on_release",
        sets: [{ conditions: [{ dimensionKey: "vessel", operator: "in", value: [fixture.vesselUuid] }] }],
      });
      version = (await db.query("SELECT * FROM adm_form_versions_v2 WHERE id=$1", [draft.id])).rows[0];
    }
    const manifest: any = { fixture, formUuid, formId: 5297, versionId: version.id, versionUuid: version.fv_uuid,
      source: "explicit registered acceptance resolution harness, not an operational trigger",
      eventKey: "a4250000-0000-4000-8000-000000000001" };
    await writeFile(`${root}/fixture.json`, JSON.stringify(manifest, null, 2));
    if (process.argv.includes("--resolve")) {
      if (version.status !== "released") {
        // The copied on-board sample contains a Vessel Management signature,
        // which is correctly prohibited before joining. Only the NEW DRAFT
        // fixture copy is adjusted; the released sample is never rewritten.
        const parts = (await db.query("SELECT form_part_uuid FROM frm_form_parts WHERE form_version_uuid=$1",
          [version.fv_uuid])).rows;
        for (const part of parts) {
          const path = `/admin/form-versions/${version.fv_uuid}/parts/${part.form_part_uuid}/structure`;
          const tree = await api("GET", path);
          await api("PUT", path, { ...tree, sections: tree.sections.map((section: any) => ({
            ...section, signature_vessel_management_required: false, vessel_signature_role_uuids: [],
          })) });
        }
        await api("POST", `/admin/form-versions/${version.id}/release`, {});
      }
      const sets = (await db.query("SELECT set_uuid FROM frm_applicability_sets WHERE version_uuid=$1", [version.fv_uuid])).rows;
      const cycle = (await db.query(`SELECT cycle_uuid FROM frm_stage_cycles
        WHERE subject_ref=$1 AND stage_key='before_joining'`, [fixture.assignmentUuid])).rows[0];
      if (!cycle || sets.length !== 1) throw Error("Existing registered stage and fixture-only policy required.");
      // Explicit harness, current date, not retrospective resolution of a real contract.
      const result = await recordResolution({
        adapter: companyFormSubjectRegistry.get("crew_assignment"), actor: {
          kind: "office", userId: 24, roleId: "d57dd06b-7c4f-4152-8902-c8af0422b3e6", roleName: "Admin", roleType: "Office",
        }, subjectType: "crew_assignment", subjectRef: fixture.assignmentUuid, stageKey: "before_joining",
        cycleUuid: cycle.cycle_uuid, eventKey: manifest.eventKey, triggerAt: new Date().toISOString(),
        source: "registered_training_checklist_acceptance_harness", outcome: "COMPLETED",
        evidence: { fixtureOnly: true, purpose: "combined Company Forms and training gate refusal" },
        decisions: [{ formVersionUuid: version.fv_uuid, status: "OUTSTANDING",
          matchedSetUuids: sets.map(s => s.set_uuid), values: { fixtureOnlyVessel: fixture.vesselUuid } }],
      });
      manifest.runUuid = result.run.run_uuid;
      manifest.requirements = (await db.query(`SELECT requirement_uuid,status FROM frm_requirements
        WHERE subject_ref=$1 AND form_uuid=$2 AND stage_key='before_joining'`, [fixture.assignmentUuid, formUuid])).rows;
      await writeFile(`${root}/fixture.json`, JSON.stringify(manifest, null, 2));
    }
    console.log(JSON.stringify(manifest));
  } finally { await db.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
