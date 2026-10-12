import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "../server/v2/db";
import { retainFixtureReferences } from "../tests/helpers/fixture-retention";

async function main() {
  if (process.env.NODE_ENV === "production") throw Error("Development fixture only");
  const fixture=JSON.parse(await readFile(".local/verification/company-forms-checklist/fixture.json","utf8"));
  const db=getDb(), c=fixture.cases.race, auditUuid=randomUUID();
  const actor:any=(await db.execute(sql`SELECT u.id,u.user_uuid,r.ruid FROM master_users u JOIN adm_rolemaster_ac r
    ON r.assigned_role=u.role WHERE u.id=24 AND r.is_active AND NOT r.is_deleted LIMIT 1`)).rows[0];
  retainFixtureReferences(`${fixture.prefix} original-capture failure and recovery`,[auditUuid,c.assignment]);
  await db.execute(sql`INSERT INTO frm_stage_audit(audit_uuid,actor_uuid,subject_ref,stage_key,event,evidence)
    VALUES(${auditUuid},${actor.user_uuid},${c.assignment},'before_joining','CAPTURE_FAILED',
    ${JSON.stringify({source:"deploy",sourceKey:`${fixture.prefix}-capture-failure`,businessDate:"2026-10-12",fixture:true})}::jsonb)`);
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString("base64url");
  const token=`${encode({alg:"none"})}.${encode({id:24,roleId:actor.ruid,userType:"Office",domain:"test"})}.devsig`;
  const base=`https://${process.env.REPLIT_DEV_DOMAIN}/api/v2/company-form-submissions`;
  const headers={Authorization:`Bearer ${token}`,"Content-Type":"application/json"};
  const list=await (await fetch(`${base}/outstanding?seafarer=${fixture.prefix}`,{headers})).json();
  if (!list.rows?.some((r:any)=>r.subjectRef===c.assignment&&r.eventUuid===auditUuid&&r.status==="Rules check failed"))
    throw Error("Unrecorded capture failure missing from report.");
  const count=async()=>Number((await db.execute(sql`SELECT count(*) AS n FROM frm_resolution_runs
    WHERE subject_ref=${c.assignment}`)).rows[0].n);
  const before=await count();
  const response=await fetch(`${base}/subjects/crew_assignment/${c.assignment}/checks/${auditUuid}/retry`,
    {method:"POST",headers,body:"{}"});
  const body=await response.json();
  if(response.status!==200||body.outcome!=="FAILED")throw Error(`Capture retry must remain visibly failed: ${response.status} ${JSON.stringify(body)}`);
  const event:any=(await db.execute(sql`SELECT * FROM frm_stage_events WHERE event_uuid=${auditUuid}`)).rows[0];
  if(event.snapshot.facts!==null||event.snapshot.candidates.length||!event.snapshot.captureError||await count()!==before)
    throw Error("Capture retry reconstructed facts or created requirements.");
  const children=(await db.execute(sql`SELECT row_to_json(a) AS refs FROM frm_stage_attempts a WHERE event_uuid=${auditUuid}`)).rows;
  retainFixtureReferences(`${fixture.prefix} retained capture recovery graph`,[event,...children]);
  console.log(JSON.stringify({passed:3,auditUuid,retryOutcome:body.outcome,factsReconstructed:false}));
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);});
