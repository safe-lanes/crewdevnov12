/** Development-only, retained subjects for main-preview checklist/report evidence. */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { companyFormSubjectRegistry } from "../server/v2/company-forms/registry";
import { recordResolution } from "../server/v2/company-forms/requirementsRepository";
import { retainFixtureReferences } from "../tests/helpers/fixture-retention";

async function main() {
  if (process.env.NODE_ENV === "production") throw Error("Development fixtures only.");
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  const root = ".local/verification/company-forms-checklist";
  const prefix = `CF391-${randomUUID().slice(0, 8)}`;
  const fixtures: any = { prefix, cases: {}, createdAt: new Date().toISOString() };
  try {
    const primary = (await db.query(`SELECT f.form_uuid,v.fv_uuid FROM adm_forms_v2 f
      JOIN adm_form_versions_v2 v ON v.form_id=f.id
      WHERE f.name='SL01 Pre-Joining Declaration' AND v.version_no='01' AND v.status='released'`)).rows[0];
    const versions = (await db.query(`SELECT f.form_uuid,v.fv_uuid,v.stage_key,p.obligation FROM adm_forms_v2 f
      JOIN adm_form_versions_v2 v ON v.form_id=f.id JOIN frm_version_applicability p ON p.version_uuid=v.fv_uuid
      WHERE f.name LIKE 'TEST%' AND v.status='released' AND p.mode<>'manual_only'
        AND p.effective_from<=CURRENT_DATE ORDER BY f.id`)).rows;
    const optional = versions.find(v => v.stage_key === "before_joining" && v.obligation === "optional");
    const extra = versions.find(v => v.stage_key === "before_joining" && v.obligation === "mandatory");
    const signoff = versions.find(v => v.stage_key === "at_sign_off");
    if (!primary || !optional || !extra || !signoff) throw Error("Registered released version fixtures required.");
    const rank = (await db.query(`SELECT r.ar_uuid,r.name FROM crew_assignment_rule_context c
      JOIN adm_available_ranks_v2 r ON r.ar_uuid=c.contract_rank_uuid AND NOT r.is_deleted
      WHERE c.assign_uuid='042e9b59-37dc-46ad-b803-67583e9ab159'`)).rows[0];
    if (!rank) throw Error("The reported captured rank fixture is required.");
    fixtures.rank = rank;
    for (const kind of ["required", "optional", "unresolved", "mixed", "failed", "pending", "signedoff", "race"]) {
      const c: any = { crew: randomUUID(), assignment: randomUUID(), vessel: randomUUID(),
        revision: randomUUID(), plan: randomUUID(), cycle: randomUUID(), event: randomUUID(),
        attempt: randomUUID(), name: `TEST ONLY ${prefix} ${kind}`, vesselName: `TEST ONLY ${prefix} vessel ${kind}` };
      fixtures.cases[kind] = c;
      retainFixtureReferences(`${prefix} checklist roots (${kind})`, Object.values(c));
      c.vesselId = (await db.query(`INSERT INTO master_vessels(vessel_uuid,vessel,is_active,is_deleted)
        VALUES($1,$2,true,false) RETURNING id`, [c.vessel, c.vesselName])).rows[0].id;
      await db.query(`INSERT INTO adm_vessel_revisions_v2(vr_uuid,vessel_id,revision,revision_date,revision_data,is_deleted)
        VALUES($1,$2,'TEST ONLY',CURRENT_DATE,$3,false)`, [c.revision, c.vessel,
        JSON.stringify([{ id: rank.ar_uuid, rankId: rank.ar_uuid, rank: rank.name, sortOrder: 1,
          officer: false, actualManningFlag: true, actualManning: 1 }])]);
      await db.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,present_rank,is_deleted)
        VALUES($1,$2,'TEST ONLY',$3,'Bosun',false)`, [c.crew, `${prefix}-${kind}`, `${prefix} ${kind}`]);
      await db.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,sign_off_date,is_current,is_deleted)
        VALUES($1,$2,$3,$4,$5,false,false)`, [c.assignment, c.crew, c.vessel,
        kind === "signedoff" ? "OnBoard" : "Planned", kind === "signedoff" ? new Date().toISOString().slice(0, 10) : null]);
      await db.query(`INSERT INTO crew_assignment_rule_context(assign_uuid,contract_rank_uuid,contract_rank_label,rank_source)
        VALUES($1,$2,$3,'{"method":"retained_test_harness"}')`, [c.assignment, rank.ar_uuid, rank.name]);
      await db.query(`INSERT INTO vessel_planning_v2(plan_uuid,vessel_uuid,rank_id,rank,reliever_crew_uuid,
        reliever_assign_uuid,joining_status,deployment_checklist_completed,is_deleted)
        VALUES($1,$2,$3,$4,$5,$6,'Deployed',false,false)`, [c.plan, c.vessel, rank.ar_uuid, rank.name, c.crew, c.assignment]);
      const stage = kind === "signedoff" ? "at_sign_off" : "before_joining";
      const pin = kind === "optional" || kind === "race" ? optional : kind === "signedoff" ? signoff : primary;
      const decisions: any[] = ["failed", "pending"].includes(kind) ? [] : [{
        formVersionUuid: pin.fv_uuid, status: kind === "unresolved" ? "UNRESOLVED" : "OUTSTANDING",
        matchedSetUuids: [], values: {}, unresolvedReason: kind === "unresolved" ? "first_ever is missing" : undefined,
      }];
      if (kind === "mixed") decisions.push({ formVersionUuid: extra.fv_uuid, status: "UNRESOLVED",
        matchedSetUuids: [], values: {}, unresolvedReason: "first_in_rank is missing" });
      const resolution = await recordResolution({
        adapter: companyFormSubjectRegistry.get("crew_assignment"), actor: { userId: 24 } as any,
        subjectType: "crew_assignment", subjectRef: c.assignment, stageKey: stage, cycleUuid: c.cycle,
        eventKey: `${prefix}-${kind}`, triggerAt: new Date().toISOString(), source: "retained_test_harness",
        outcome: "COMPLETED", evidence: { fixture: true, syntheticStatus: kind }, decisions,
      });
      c.requirements = resolution.requirements ?? (await db.query("SELECT * FROM frm_requirements WHERE subject_ref=$1", [c.assignment])).rows;
      await db.query(`INSERT INTO frm_stage_cycles(subject_ref,stage_key,cycle_uuid) VALUES($1,$2,$3)`,
        [c.assignment, stage, c.cycle]);
      await db.query(`INSERT INTO frm_stage_events(event_uuid,subject_ref,stage_key,cycle_uuid,source,source_key,
        occurred_at,business_date,actor_uuid,snapshot) VALUES($1,$2,$3,$4,'retained_test_harness',$1,
        now(),CURRENT_DATE,'24','{"legacy":true,"facts":null,"candidates":[],"testHarness":true}')`,
        [c.event, c.assignment, stage, c.cycle]);
      if (kind !== "pending") await db.query(`INSERT INTO frm_stage_attempts(attempt_uuid,event_uuid,actor_uuid,outcome,reason,run_uuid)
        VALUES($1,$2,'24',$3,$4,$5)`, [c.attempt, c.event, kind === "failed" ? "FAILED" : "COMPLETED",
        kind === "failed" ? "TEST ONLY transient check failure" : null, resolution.run.run_uuid]);
    }
    const role = randomUUID(), userUuid = randomUUID();
    retainFixtureReferences(`${prefix} parent-owned ship role and master-user fixture`, [role, userUuid]);
    const shipRoleName = `TEST ONLY ${prefix} ship`;
    await db.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,is_active,is_deleted,parent_owned)
      VALUES($1,$2,'Ship',true,false,true)`, [role, shipRoleName]);
    const ship = (await db.query(`INSERT INTO master_users(user_uuid,firstname,lastname,fullname,role,user_type,vessel_ids)
      VALUES($1,'TEST ONLY',$2,$2,$3,'Ship',$4) RETURNING id`,
      [userUuid, `${prefix} vessel report viewer`, shipRoleName, String(fixtures.cases.optional.vesselId)])).rows[0];
    fixtures.ship = { id: ship.id, roleId: role, role: shipRoleName, userType: "Ship", userUuid };
    retainFixtureReferences(`${prefix} resolved fixture graphs`, Object.values(fixtures.cases));
    await mkdir(root, { recursive: true });
    await writeFile(`${root}/fixture.json`, JSON.stringify(fixtures, null, 2));
    console.log(JSON.stringify({ fixture: `${root}/fixture.json`, prefix, cases: Object.keys(fixtures.cases) }));
  } finally {
    // Also register partial attempts: root registration precedes the first insert,
    // and descendants are discovered even when preparation stops halfway.
    const rows = (await db.query(`SELECT row_to_json(r) AS refs FROM frm_resolution_runs r
      WHERE subject_ref IN(SELECT a.assign_uuid FROM crew_assignments a JOIN crew_members_v2 c USING(crew_uuid)
        WHERE c.emp_no LIKE 'CF391-%')
      UNION ALL SELECT row_to_json(h) FROM frm_requirement_history h WHERE requirement_uuid IN(
        SELECT r.requirement_uuid FROM frm_requirements r JOIN crew_assignments a ON a.assign_uuid=r.subject_ref
          JOIN crew_members_v2 c USING(crew_uuid) WHERE c.emp_no LIKE 'CF391-%')
      UNION ALL SELECT row_to_json(r) FROM frm_requirements r WHERE subject_ref IN(
        SELECT a.assign_uuid FROM crew_assignments a JOIN crew_members_v2 c USING(crew_uuid) WHERE c.emp_no LIKE 'CF391-%')`)).rows;
    retainFixtureReferences(`${prefix} including retained partial preparation descendants`, rows.map(r => r.refs));
    await db.end();
  }
}
main().catch(error => { console.error(error); process.exit(1); });
