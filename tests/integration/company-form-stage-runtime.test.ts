import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequirementFixture, requirementPool as db, requirementApi as api, requirementToken, requirementTokenFor } from "../helpers/company-form-requirement-fixtures";
import { retainFixtureReferences } from "../helpers/fixture-retention";
import { grantCompanyFormFixture } from "../helpers/companyFormGrants";
import { rotationDeployService } from "../../server/v2/rotation/services";
import { vesselPlanningService } from "../../server/v2/vessel/services/vesselPlanningService";
import * as rules from "../../server/v2/company-forms/evaluateRule";

const uid = () => randomUUID();
const day = new Date().toISOString().slice(0, 10);
const roots: any = { vessel: uid(), draft: uid(), entries: [], assignments: [], plans: [] };
let forms: Awaited<ReturnType<typeof createRequirementFixture>>[];
let rank: any, filler: number, authorOnly: number;
async function call(method: "get"|"post"|"patch", path: string, body = {}, actorToken = requirementToken) {
  const r = await api[method](`/api/v2${path}`).set("Authorization", `Bearer ${actorToken}`).send(body);
  if (r.status >= 400) throw Error(`${path}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
async function deploy(crewUuid: string, rankName = rank.name, rankId = rank.ar_uuid) {
  const entry = uid();
  roots.entries.push(entry);
  retainFixtureReferences("retained stage-trigger rotation entry", [entry, crewUuid, roots.vessel, roots.draft]);
  await db.query(`INSERT INTO rotation_entries_v2(entry_uuid,draft_uuid,vessel_uuid,rank_id,rank,crew_uuid,sign_on_date,
    contract_period,proposal_status,is_deleted) VALUES($1,$2,$3,$4,$5,$6,$7,4,'Proposed',false)`,
    [entry, roots.draft, roots.vessel, rankId, rankName, crewUuid, day]);
  const result = await call("post", `/rotation/entries/${entry}/deploy`);
  const p = (await db.query("SELECT * FROM vessel_planning_v2 WHERE plan_uuid=$1", [result.planUuid])).rows[0];
  roots.plans.push(p.plan_uuid); roots.assignments.push(p.reliever_assign_uuid);
  return p;
}
const ledger = async (assignment: string) => call("get", `/company-form-submissions/subjects/crew_assignment/${assignment}/requirements`);
async function signOn(plan: string) {
  return call("post", `/vessel/planning/${plan}/sign-on`, { signOnDate: day, joiningStatus: "SignedOn" });
}
async function registerGraph() {
  for (const assignment of roots.assignments) {
    const refs = (await db.query(`SELECT event_uuid AS ref FROM frm_stage_events WHERE subject_ref=$1
      UNION SELECT cycle_uuid FROM frm_stage_cycles WHERE subject_ref=$1
      UNION SELECT run_uuid FROM frm_resolution_runs WHERE subject_ref=$1
      UNION SELECT requirement_uuid FROM frm_requirements WHERE subject_ref=$1
      UNION SELECT history_uuid FROM frm_requirement_history WHERE requirement_uuid IN
        (SELECT requirement_uuid FROM frm_requirements WHERE subject_ref=$1)
      UNION SELECT attempt_uuid FROM frm_stage_attempts WHERE event_uuid IN
        (SELECT event_uuid FROM frm_stage_events WHERE subject_ref=$1)
      UNION SELECT audit_uuid FROM frm_stage_audit WHERE subject_ref=$1
      UNION SELECT plan_uuid FROM vessel_planning_v2 WHERE crew_assign_uuid=$1 OR reliever_assign_uuid=$1`, [assignment])).rows;
    retainFixtureReferences("retained stage-trigger evidence graph", refs.map(x => x.ref));
  }
}
describe("Company Form immutable stage lifecycle, additive relief cycles and scoped retry", () => {
  beforeAll(async () => {
    retainFixtureReferences("retained stage-trigger vessel and draft", [roots.vessel, roots.draft]);
    rank = (await db.query("SELECT ar_uuid,rank_id,name,id FROM adm_available_ranks_v2 WHERE NOT is_deleted ORDER BY id LIMIT 1")).rows[0];
    await db.query("INSERT INTO master_vessels(vessel_uuid,vessel,is_active,is_deleted) VALUES($1,$2,true,false)",
      [roots.vessel, `TEST ONLY Stage vessel ${roots.vessel.slice(0,8)}`]);
    await db.query(`INSERT INTO rotation_drafts_v2(draft_uuid,draft_id,plan_from_date,plan_to_date,plan_status,is_deleted)
      VALUES($1,$2,$3,$3,'Proposed',false)`, [roots.draft, `TEST ONLY Stage ${roots.draft.slice(0,8)}`, day]);
    forms = [await createRequirementFixture(), await createRequirementFixture("on_board"),
      await createRequirementFixture("at_sign_off"), await createRequirementFixture("at_sign_off")];
    const role = uid(), authorRole = uid();
    retainFixtureReferences("retained scoped retry parent roles", [role, authorRole]);
    for (const [id, name] of [[role, "TEST ONLY Stage Fill in"], [authorRole, "TEST ONLY Stage Author only"]]) {
      await db.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,is_active,is_deleted)
        VALUES($1,$2,'Office',true,false)`, [id, `${name} ${id.slice(0,8)}`]);
    }
    await grantCompanyFormFixture(db, role, "vessel"); // View/Fill in/witness, no Forms authoring.
    await grantCompanyFormFixture(db, authorRole, "view");
    const menu = (await db.query("SELECT muid FROM adm_menumaster_ac WHERE route='/admin/forms' AND NOT is_deleted LIMIT 1")).rows[0];
    await db.query(`INSERT INTO adm_roleaccess_ac(rauid,role_id,menu_id,canview,canedit,cancreate,candelete)
      VALUES($1,$2,$3,true,true,true,false)`, [uid(), authorRole, menu.muid]);
    filler = (await db.query("INSERT INTO master_users(user_type,role) VALUES('Office',$1) RETURNING id",
      [`TEST ONLY Stage Fill in ${role.slice(0,8)}`])).rows[0].id;
    authorOnly = (await db.query("INSERT INTO master_users(user_type,role) VALUES('Office',$1) RETURNING id",
      [`TEST ONLY Stage Author only ${authorRole.slice(0,8)}`])).rows[0].id;
    retainFixtureReferences("retained retry users", [filler, authorOnly]);
  }, 60000);
  afterAll(async () => { await registerGraph(); await mkdir("test-logs", { recursive: true });
    await writeFile("test-logs/stage-runtime-fixtures.json", JSON.stringify({ ...roots, forms, filler, authorOnly, day, rank }, null, 2));
    await db.end();
  });
  it("Deploy, vacant sign-on, first Planned and Confirmed use one immutable event per stage", async () => {
    const p = await deploy(forms[0].crewUuid);
    const before = await ledger(p.reliever_assign_uuid);
    expect(before.requirements.some((r: any) => r.form_uuid === forms[0].formUuid && r.status === "OUTSTANDING")).toBe(true);
    expect(before.stageChecks.stages.find((s: any) => s.stage_key === "before_joining").outcome).toBe("COMPLETED");
    await signOn(p.plan_uuid);
    let onboard = await ledger(p.reliever_assign_uuid);
    expect(onboard.requirements.some((r: any) => r.form_uuid === forms[1].formUuid)).toBe(true);
    await call("patch", `/vessel/planning/${p.plan_uuid}`, { reliefStatus: "Planned" });
    const relief = await ledger(p.reliever_assign_uuid);
    const event = relief.stageChecks.stages.find((s: any) => s.stage_key === "at_sign_off");
    expect(event.outcome).toBe("COMPLETED");
    await call("patch", `/vessel/planning/${p.plan_uuid}`, { reliefStatus: "Confirmed" });
    expect((await ledger(p.reliever_assign_uuid)).stageChecks.stages.find((s: any) => s.stage_key === "at_sign_off").event_uuid).toBe(event.event_uuid);
    roots.main = { plan: p.plan_uuid, assignment: p.reliever_assign_uuid, crew: forms[0].crewUuid };
  });
  it("deferral withdraws only unstarted requirements, keeps started ones, and replan is additive", async () => {
    const subject = `/company-form-submissions/subjects/crew_assignment/${roots.main.assignment}`;
    const before = await ledger(roots.main.assignment);
    const kept = before.requirements.find((r: any) => r.form_uuid === forms[2].formUuid);
    const withdrawn = before.requirements.find((r: any) => r.form_uuid === forms[3].formUuid);
    await call("post", `${subject}/requirements/${kept.requirement_uuid}/start`);
    await call("post", `/vessel/planning/${roots.main.plan}/defer-relief`, { reason: "TEST ONLY Voyage extension; relief deferred" });
    const deferred = await ledger(roots.main.assignment);
    expect(deferred.requirements.find((r: any) => r.requirement_uuid === kept.requirement_uuid).status).toBe("STARTED");
    expect(deferred.requirements.find((r: any) => r.requirement_uuid === withdrawn.requirement_uuid).status).toBe("WITHDRAWN");
    expect(deferred.stageChecks.stages.find((s: any) => s.stage_key === "at_sign_off").deferred).toBe(true);
    await call("patch", `/vessel/planning/${roots.main.plan}`, { reliefStatus: "Planned" });
    const replanned = await ledger(roots.main.assignment);
    expect(replanned.requirements.find((r: any) => r.requirement_uuid === kept.requirement_uuid).status).toBe("STARTED");
    expect(replanned.requirements.filter((r: any) => r.form_uuid === forms[3].formUuid && r.status === "OUTSTANDING")).toHaveLength(1);
    expect(replanned.stageChecks.stages.find((s: any) => s.stage_key === "at_sign_off").cycle_uuid)
      .not.toBe(before.stageChecks.stages.find((s: any) => s.stage_key === "at_sign_off").cycle_uuid);
  });
  it("a failed Deploy check leaves Deploy committed; Fill in can retry its frozen facts, authoring alone cannot", async () => {
    const entry = uid();
    roots.entries.push(entry);
    retainFixtureReferences("retained failed-check rotation entry", [entry]);
    await db.query(`INSERT INTO rotation_entries_v2(entry_uuid,draft_uuid,vessel_uuid,rank_id,rank,crew_uuid,sign_on_date,
      contract_period,proposal_status,is_deleted) VALUES($1,$2,$3,$4,$5,$6,$7,4,'Proposed',false)`,
      [entry, roots.draft, roots.vessel, rank.ar_uuid, rank.name, forms[1].crewUuid, day]);
    const nationality = (await db.query("SELECT nat_uuid FROM master_nationalities WHERE NOT is_deleted LIMIT 1")).rows[0];
    await db.query("UPDATE crew_members_v2 SET nationality_uuid=$1 WHERE crew_uuid=$2", [nationality.nat_uuid, forms[1].crewUuid]);
    const fail = vi.spyOn(rules, "evaluateRule").mockImplementationOnce(() => { throw Error("TEST ONLY Simulated rule check failure"); });
    let result: any;
    try { result = await rotationDeployService.deployEntry(entry, "24"); } finally { fail.mockRestore(); }
    const p = (await db.query("SELECT * FROM vessel_planning_v2 WHERE plan_uuid=$1", [result.planUuid])).rows[0];
    roots.plans.push(p.plan_uuid); roots.assignments.push(p.reliever_assign_uuid);
    expect(p.reliever_assign_uuid).toBeTruthy();
    const failed = await ledger(p.reliever_assign_uuid);
    const event = failed.stageChecks.stages.find((s: any) => s.stage_key === "before_joining");
    expect(event.outcome).toBe("FAILED");
    const frozen = (await db.query("SELECT snapshot FROM frm_stage_events WHERE event_uuid=$1", [event.event_uuid])).rows[0].snapshot;
    await db.query("UPDATE crew_members_v2 SET nationality_uuid=NULL WHERE crew_uuid=$1", [forms[1].crewUuid]);
    const path = `/api/v2/company-form-submissions/subjects/crew_assignment/${p.reliever_assign_uuid}/checks/${event.event_uuid}/retry`;
    const factsUrl = `/api/v2/company-form-submissions/subjects/crew_assignment/${p.reliever_assign_uuid}/requirements`;
    const fillRead = await api.get(factsUrl).set("Authorization", `Bearer ${requirementTokenFor(filler)}`);
    expect(fillRead.status, JSON.stringify(fillRead.body)).toBe(200);
    expect(fillRead.body.stageChecks.canRetry).toBe(true);
    expect((await api.get(`/api/v2/admin/form-versions/${forms[1].version.id}/applicability`)
      .set("Authorization", `Bearer ${requirementTokenFor(filler)}`)).status).toBe(403);
    expect((await api.get(`/api/v2/admin/form-versions/${forms[1].version.id}/applicability`)
      .set("Authorization", `Bearer ${requirementTokenFor(authorOnly)}`)).status).toBe(200);
    expect((await api.post(path).set("Authorization", `Bearer ${requirementTokenFor(authorOnly)}`).send({})).status).toBe(403);
    expect((await api.post(path).set("Authorization", `Bearer ${requirementTokenFor(filler)}`).send({ actorUuid: "forged" })).status).toBe(400);
    expect((await api.post(path).set("Authorization", `Bearer ${requirementTokenFor(filler)}`).send({})).status).toBe(200);
    expect((await ledger(p.reliever_assign_uuid)).stageChecks.stages.find((s: any) => s.stage_key === "before_joining").outcome).toBe("COMPLETED");
    expect((await db.query("SELECT snapshot FROM frm_stage_events WHERE event_uuid=$1", [event.event_uuid])).rows[0].snapshot).toEqual(frozen);
    roots.failed = { plan: p.plan_uuid, assignment: p.reliever_assign_uuid, crew: forms[1].crewUuid };
  });
  it("sign-off without any qualifying relief transition resolves once at the actual sign-off", async () => {
    await signOn(roots.failed.plan); // occupied branch moves the earlier incumbent, no form-trigger sign-off.
    const currentPlan = (await db.query(`SELECT plan_uuid FROM vessel_planning_v2
      WHERE crew_assign_uuid=$1 AND NOT is_archived AND NOT is_deleted`, [roots.failed.assignment])).rows;
    expect(currentPlan).toHaveLength(1);
    roots.failed.plan = currentPlan[0].plan_uuid;
    await call("post", `/vessel/planning/${roots.failed.plan}/sign-off`, { signOffDate: day, signOffReason: "TEST ONLY direct sign-off" });
    const state = await ledger(roots.failed.assignment);
    expect(state.stageChecks.stages.find((s: any) => s.stage_key === "at_sign_off").outcome).toBe("COMPLETED");
    const events = (await db.query("SELECT source,business_date FROM frm_stage_events WHERE subject_ref=$1 AND stage_key='at_sign_off'", [roots.failed.assignment])).rows;
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("sign_off");
    expect(new Date(events[0].business_date).toISOString().slice(0,10)).toBe(day);
  });
  it("the rank-change sign-off path creates no at-sign-off stage event", async () => {
    const p = await deploy(forms[2].crewUuid, `${rank.name} TEST ONLY rank-change slot`, rank.ar_uuid + "-test-slot");
    await signOn(p.plan_uuid);
    await vesselPlanningService.signOffForRankChange(p.plan_uuid, { signOffDate: day, auditUserUuid: "24" });
    expect((await db.query("SELECT 1 FROM frm_stage_events WHERE subject_ref=$1 AND stage_key='at_sign_off'",
      [p.reliever_assign_uuid])).rows).toHaveLength(0);
    roots.rankChange = { plan: p.plan_uuid, assignment: p.reliever_assign_uuid, crew: forms[2].crewUuid };
  });
  it("planning created already Planned resolves on its supplied, server-verified incumbent assignment", async () => {
    const assignment = uid();
    roots.assignments.push(assignment);
    retainFixtureReferences("retained created-Planned incumbent assignment", [assignment, forms[3].crewUuid, roots.vessel]);
    await db.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,is_deleted,sign_on_date)
      VALUES($1,$2,$3,'OnBoard',true,false,$4)`, [assignment, forms[3].crewUuid, roots.vessel, day]);
    const p = await call("post", `/vessel/${roots.vessel}/planning`, { vesselUuid: roots.vessel, crewUuid: forms[3].crewUuid,
      crewAssignUuid: assignment, rankId: rank.ar_uuid + "-creation", rank: rank.name + " TEST ONLY creation",
      reliefStatus: "Planned", signOnDate: day });
    roots.plans.push(p.planUuid);
    expect(p.crewAssignUuid).toBe(assignment);
    const state = await ledger(assignment);
    expect(state.stageChecks.stages.find((s: any) => s.stage_key === "at_sign_off").outcome).toBe("COMPLETED");
    expect(state.requirements.some((r: any) => r.form_uuid === forms[2].formUuid)).toBe(true);
  });
});
