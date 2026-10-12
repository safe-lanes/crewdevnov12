/** Retained development/test harness, never a production resolution endpoint. */
import { Pool } from "pg";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { retainFixtureReferences } from "./fixture-retention";
import { companyFormSubjectRegistry } from "../../server/v2/company-forms/registry";
import { recordResolution, readRequirements } from "../../server/v2/company-forms/requirementsRepository";

export const requirementPool = new Pool({ connectionString: process.env.DATABASE_URL });
const enc = (x: object) => Buffer.from(JSON.stringify(x)).toString("base64url");
export const requirementTokenFor = (id: number) =>
  `${enc({ alg: "none", typ: "JWT" })}.${enc({ id, userType: "Office", domain: "test" })}.devsig`;
export const requirementToken = requirementTokenFor(24);
export const requirementApi = request("http://127.0.0.1:5000");
export const formCall = (method: "get" | "post" | "put", path: string, body: object = {}) =>
  requirementApi[method](`/api/v2/admin${path}`).set("Authorization", `Bearer ${requirementToken}`).send(body);

export async function createRequirementFixture(stageKey = "before_joining") {
  if (process.env.NODE_ENV === "production") throw new Error("Fixture harness is not permitted in production");
  const crewUuid = randomUUID(), assignUuid = randomUUID(), formUuid = randomUUID(), templatePart = randomUUID();
  retainFixtureReferences("requirement harness roots", [crewUuid, assignUuid, formUuid, templatePart]);
  const vessel = (await requirementPool.query("SELECT vessel_uuid FROM master_vessels WHERE NOT is_deleted AND is_active LIMIT 1")).rows[0];
  const rank = (await requirementPool.query("SELECT ar_uuid,name FROM adm_available_ranks_v2 WHERE NOT is_deleted LIMIT 1")).rows[0];
  await requirementPool.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,present_rank)
    VALUES($1,$2,'TEST ONLY','Requirement ledger',$3)`, [crewUuid, `REQ-${crewUuid.slice(0, 8)}`, rank.name]);
  await requirementPool.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current)
    VALUES($1,$2,$3,'Planned',false)`, [assignUuid, crewUuid, vessel.vessel_uuid]);
  const f = (await requirementPool.query(`INSERT INTO adm_forms_v2(form_uuid,name,category,subject_type,rank_group,version_no,version_date)
    VALUES($1,$2,'dynamic','crew_assignment','','00','11-Oct-2026') RETURNING id`,
    [formUuid, `TEST ONLY Requirement form ${formUuid.slice(0, 8)}`])).rows[0];
  await requirementPool.query(`INSERT INTO frm_form_parts(form_part_uuid,form_uuid,part_code,part_title,part_type)
    VALUES($1,$2,'MAIN','Requirement evidence','configurable')`, [templatePart, formUuid]);
  const v = (await formCall("post", `/forms/${f.id}/versions`, {
    versionNo: "00", versionDate: "11-Oct-2026", configuration: "{}", stageKey,
  })).body;
  if (!v.fvUuid) throw new Error(`Fixture version failed: ${JSON.stringify(v)}`);
  const part = (await requirementPool.query("SELECT form_part_uuid FROM frm_form_parts WHERE form_version_uuid=$1", [v.fvUuid])).rows[0].form_part_uuid;
  const section = randomUUID(), question = randomUUID();
  retainFixtureReferences("requirement harness pinned content", [v.fvUuid, part, section, question]);
  await requirementPool.query(`INSERT INTO frm_sections(section_uuid,form_version_uuid,form_part_uuid,section_code,section_title,responsible_mode)
    VALUES($1,$2,$3,'REQ','Form evidence','seafarer')`, [section, v.fvUuid, part]);
  await requirementPool.query(`INSERT INTO frm_questions(question_uuid,section_uuid,question_code,question_text,response_type)
    VALUES($1,$2,'ANSWER','Retained requirement evidence','free_text')`, [question, section]);
  const policy = await formCall("put", `/form-versions/${v.id}/applicability`, { mode: "all", obligation: "mandatory" });
  if (policy.status !== 200) throw new Error(JSON.stringify(policy.body));
  const released = await formCall("post", `/form-versions/${v.id}/release`);
  if (released.status !== 200) throw new Error(JSON.stringify(released.body));
  const cycleUuid = randomUUID();
  const base = { adapter: companyFormSubjectRegistry.get("crew_assignment"),
    actor: { userId: 24 } as any, subjectType: "crew_assignment", subjectRef: assignUuid,
    stageKey, cycleUuid, triggerAt: new Date().toISOString(),
    source: "retained_test_harness", outcome: "COMPLETED" as const,
    evidence: { fixture: true }, decisions: [] };
  return { crewUuid, assignUuid, formUuid, formId: f.id, version: v, section, question, cycleUuid, base,
    record: async (eventKey: string, decisions: Parameters<typeof recordResolution>[0]["decisions"] = []) => {
      const result = await recordResolution({ ...base, eventKey, decisions });
      const stage = await requirementPool.query("SELECT 1 FROM frm_stage_cycles WHERE subject_ref=$1 AND stage_key=$2",
        [assignUuid, base.stageKey]);
      if (!stage.rows.length) {
        const event = randomUUID(), attempt = randomUUID();
        retainFixtureReferences("requirement harness recorded stage readiness", [event, attempt, cycleUuid]);
        await requirementPool.query("INSERT INTO frm_stage_cycles(subject_ref,stage_key,cycle_uuid) VALUES($1,$2,$3)",
          [assignUuid, base.stageKey, cycleUuid]);
        await requirementPool.query(`INSERT INTO frm_stage_events(event_uuid,subject_ref,stage_key,cycle_uuid,source,
          source_key,occurred_at,business_date,actor_uuid,snapshot)
          VALUES($1,$2,$3,$4,'retained_test_harness',$1,now(),CURRENT_DATE,'24','{"legacy":true,"facts":null,"candidates":[],"testHarness":true}')`,
          [event, assignUuid, base.stageKey, cycleUuid]);
        await requirementPool.query(`INSERT INTO frm_stage_attempts(attempt_uuid,event_uuid,actor_uuid,outcome,run_uuid)
          VALUES($1,$2,'24','COMPLETED',$3)`, [attempt, event, result.run.run_uuid]);
      }
      const ledger = await readRequirements("crew_assignment", assignUuid);
      retainFixtureReferences("requirement harness complete ledger graph",
        [...ledger.runs, ...ledger.requirements]);
      return result;
    } };
}
