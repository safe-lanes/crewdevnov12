import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { getDb } from "../server/v2/db";
import { recordResolution } from "../server/v2/company-forms/requirementsRepository";
import { companyFormSubjectRegistry } from "../server/v2/company-forms/registry";
import { retainFixtureReferences } from "../tests/helpers/fixture-retention";

async function main() {
  if (process.env.NODE_ENV === "production") throw Error("Development fixture only");
  const fixture = JSON.parse(await readFile(".local/verification/company-forms-checklist/fixture.json", "utf8"));
  const c = fixture.cases.race, db = getDb();
  const actor: any = (await db.execute(sql`SELECT u.id,r.ruid FROM master_users u JOIN adm_rolemaster_ac r
    ON r.assigned_role=u.role WHERE u.id=24 AND r.is_active AND NOT r.is_deleted LIMIT 1`)).rows[0];
  const pin: any = (await db.execute(sql`SELECT v.fv_uuid FROM adm_form_versions_v2 v JOIN adm_forms_v2 f ON f.id=v.form_id
    WHERE f.name='SL01 Pre-Joining Declaration' AND v.version_no='01' AND v.status='released'`)).rows[0];
  const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const token = `${encode({alg:"none"})}.${encode({id:actor.id,roleId:actor.ruid,userType:"Office",domain:"test"})}.devsig`;
  let request: Promise<Response> | undefined;
  await db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT assign_uuid FROM crew_assignments WHERE assign_uuid=${c.assignment} FOR UPDATE`);
    const pid = (await tx.execute(sql`SELECT pg_backend_pid() AS pid`)).rows[0].pid;
    request = fetch(`https://${process.env.REPLIT_DEV_DOMAIN}/api/v2/vessel/planning/${c.plan}`, {
      method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
      body:JSON.stringify({deploymentChecklistCompleted:true}),
    });
    let waiting = false;
    for (let i=0; i<50; i++) {
      const row = (await db.execute(sql`SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE ${pid} = ANY(pg_blocking_pids(pid))`)).rows[0];
      if (row.n) { waiting=true; break; }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if (!waiting) throw Error("Main-preview checklist request did not queue on the subject lock.");
    const result = await recordResolution({
      adapter:companyFormSubjectRegistry.get("crew_assignment"),actor:{userId:24} as any,
      subjectType:"crew_assignment",subjectRef:c.assignment,stageKey:"before_joining",cycleUuid:c.cycle,
      eventKey:`${fixture.prefix}-race-required`,triggerAt:new Date().toISOString(),source:"retained_test_harness",
      outcome:"COMPLETED",evidence:{fixture:true,realChecklistRace:true},
      decisions:[{formVersionUuid:pin.fv_uuid,status:"OUTSTANDING",matchedSetUuids:[],values:{}}],
    },tx);
    retainFixtureReferences(`${fixture.prefix} checklist lock race`, [result]);
  });
  const response = await request!, body = await response.json();
  if (response.status!==409 || body.canOverride || !/SL01 Pre-Joining Declaration.*must be completed/.test(body.message))
    throw Error(`Queued checklist did not re-read committed requirement: ${response.status}`);
  console.log(JSON.stringify({passed:true,mainRequestQueued:true,afterCommitStatus:response.status}));
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);});
