import { randomUUID } from "node:crypto";
import { retainFixtureReferences } from "./fixture-retention";

/** Explicit test harness for tests of starts/writes, not a production trigger or API. */
export async function openHarnessStages(db: { query: (...args: any[]) => Promise<any> }, assignUuid: string,
  stages = ["before_joining", "on_board", "at_sign_off"]) {
  const ids: string[] = [assignUuid];
  for (const stage of stages) {
    const cycle = randomUUID(), event = randomUUID(), attempt = randomUUID(), run = randomUUID();
    const old = await db.query("SELECT 1 FROM frm_stage_cycles WHERE subject_ref=$1 AND stage_key=$2", [assignUuid, stage]);
    if (old.rows.length) continue;
    ids.push(cycle, event, attempt, run);
    retainFixtureReferences("explicit retained ready-stage harness", ids);
    await db.query("INSERT INTO frm_stage_cycles(subject_ref,stage_key,cycle_uuid) VALUES($1,$2,$3)", [assignUuid, stage, cycle]);
    await db.query(`INSERT INTO frm_stage_events(event_uuid,subject_ref,stage_key,cycle_uuid,source,source_key,
      occurred_at,actor_uuid,snapshot) VALUES($1,$2,$3,$4,'retained_test_harness',$1,now(),'24',
      '{"legacy":true,"facts":null,"candidates":[],"testHarness":true}')`, [event, assignUuid, stage, cycle]);
    await db.query(`INSERT INTO frm_resolution_runs(run_uuid,subject_type,subject_ref,stage_key,cycle_uuid,
      event_key,trigger_at,outcome,actor_uuid,source,evidence)
      VALUES($1,'crew_assignment',$2,$3,$4,$5,now(),'COMPLETED','24','retained_test_harness','{"testHarness":true}')`,
      [run, assignUuid, stage, cycle, event]);
    await db.query(`INSERT INTO frm_stage_attempts(attempt_uuid,event_uuid,actor_uuid,outcome,run_uuid)
      VALUES($1,$2,'24','COMPLETED',$3)`, [attempt, event, run]);
  }
}
