/** Retained, test-owned subjects using the real released SL01 definition. */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { companyFormSubjectRegistry } from "../server/v2/company-forms/registry";
import { recordResolution } from "../server/v2/company-forms/requirementsRepository";
import { retainFixtureReferences } from "../tests/helpers/fixture-retention";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Development verification only.");
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Retain the complete graph of previous attempts, including a partially
    // prepared fixture or a journey whose screenshot assertion failed.
    const previous = (await db.query(`SELECT jsonb_build_object(
      'crew',c.crew_uuid,'assignment',a.assign_uuid,'vessel',a.vessel_uuid,
      'submission',s.submission_uuid,'requirement',r.requirement_uuid,
      'run',r.run_uuid,'history',h.history_uuid,'state',st.section_state_uuid,
      'signature',g.section_signature_uuid,'attachment',g.signature_att_uuid) AS refs
      FROM crew_members_v2 c JOIN crew_assignments a USING(crew_uuid)
      LEFT JOIN frm_requirements r ON r.subject_ref=a.assign_uuid
      LEFT JOIN frm_requirement_history h USING(requirement_uuid)
      LEFT JOIN frm_company_submissions s ON s.subject_ref=a.assign_uuid
      LEFT JOIN frm_section_states st ON st.submission_uuid=s.submission_uuid
      LEFT JOIN frm_section_signatures g USING(section_state_uuid)
      WHERE c.emp_no LIKE 'SL01-%' AND c.first_name='TEST ONLY'
      AND c.family_name='SL01 signature regression'`)).rows;
    retainFixtureReferences("SL01 previous main-preview attempt graphs retained", previous.map(row => row.refs));
    const version = (await db.query(`SELECT f.form_uuid,v.fv_uuid FROM adm_forms_v2 f
      JOIN adm_form_versions_v2 v ON v.form_id=f.id
      WHERE f.name='SL01 Pre-Joining Declaration' AND v.version_no='01' AND v.status='released'`)).rows[0];
    if (!version) throw new Error("The reported released SL01 version must exist.");
    const rank = (await db.query(`SELECT r.ar_uuid,r.name FROM crew_assignment_rule_context c
      JOIN adm_available_ranks_v2 r ON r.ar_uuid=c.contract_rank_uuid AND NOT r.is_deleted
      WHERE c.assign_uuid=$1`, ["042e9b59-37dc-46ad-b803-67583e9ab159"])).rows;
    if (rank.length !== 1) throw new Error("The original assignment must have one eligible captured contract rank.");
    const vessel = randomUUID(), crew = randomUUID(), assignment = randomUUID(), cycle = randomUUID();
    const event = randomUUID(), attempt = randomUUID();
    retainFixtureReferences("SL01 main-preview signing regression roots", [vessel, crew, assignment, cycle, event, attempt]);
    await db.query("INSERT INTO master_vessels(vessel_uuid,vessel,is_active,is_deleted) VALUES($1,'TEST ONLY SL01 signing',true,false)", [vessel]);
    await db.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,present_rank,is_deleted)
      VALUES($1,$2,'TEST ONLY','SL01 signature regression','Pumpman',false)`, [crew, `SL01-${crew.slice(0, 8)}`]);
    await db.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,is_deleted)
      VALUES($1,$2,$3,'Planned',false,false)`, [assignment, crew, vessel]);
    await db.query(`INSERT INTO crew_assignment_rule_context(assign_uuid,contract_rank_uuid,contract_rank_label,rank_source)
      VALUES($1,$2,'Pumpman','{"method":"retained_test_harness"}')`, [assignment, rank[0].ar_uuid]);
    const resolution = await recordResolution({
      adapter: companyFormSubjectRegistry.get("crew_assignment"), actor: { userId: 24 } as any,
      subjectType: "crew_assignment", subjectRef: assignment, stageKey: "before_joining", cycleUuid: cycle,
      eventKey: "required-dual-signature-main-preview", triggerAt: new Date().toISOString(),
      source: "retained_test_harness", outcome: "COMPLETED", evidence: { fixture: true },
      decisions: [{ formVersionUuid: version.fv_uuid, status: "OUTSTANDING", matchedSetUuids: [], values: {} }],
    });
    await db.query("INSERT INTO frm_stage_cycles(subject_ref,stage_key,cycle_uuid) VALUES($1,'before_joining',$2)", [assignment, cycle]);
    await db.query(`INSERT INTO frm_stage_events(event_uuid,subject_ref,stage_key,cycle_uuid,source,source_key,
      occurred_at,business_date,actor_uuid,snapshot)
      VALUES($1,$2,'before_joining',$3,'retained_test_harness',$1,now(),CURRENT_DATE,'24',
      '{"legacy":true,"facts":null,"candidates":[],"testHarness":true}')`, [event, assignment, cycle]);
    await db.query(`INSERT INTO frm_stage_attempts(attempt_uuid,event_uuid,actor_uuid,outcome,run_uuid)
      VALUES($1,$2,'24','COMPLETED',$3)`, [attempt, event, resolution.run.run_uuid]);
    const requirement = (await db.query("SELECT requirement_uuid FROM frm_requirements WHERE subject_ref=$1", [assignment])).rows[0].requirement_uuid;
    const fixture = { vessel, crew, assignment, cycle, event, attempt, requirement, version: version.fv_uuid, form: version.form_uuid };
    retainFixtureReferences("SL01 main-preview required signing ledger", Object.values(fixture));
    await mkdir(".local/verification/required-signing", { recursive: true });
    await writeFile(".local/verification/required-signing/fixture.json", JSON.stringify(fixture, null, 2));
    console.log("Retained test-owned SL01 assignment prepared; original assignment and definition unchanged.");
  } finally { await db.end(); }
  process.exit(0);
}
main().catch(error => { console.error(error); process.exit(1); });
