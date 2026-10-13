import { deferFailedStageActivation } from "../../server/v2/company-forms/stageUpgradeFailure";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { retainFixtureReferences } from "../helpers/fixture-retention";

describe("Company Form tenant-local go-live upgrade", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schemas = [0, 1, 2].map(() => `test_stage_${randomUUID().replaceAll("-", "")}`);
  const assignments = schemas.map(() => randomUUID());
  let upgrade: string;
  async function query(index: number, text: string, params: any[] = []) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemas[index]}",public`);
      return await client.query(text, params);
    } finally { client.release(); }
  }
  async function activate(index: number) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL search_path TO "${schemas[index]}",public`);
      await client.query(upgrade);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  beforeAll(async () => {
    upgrade = await fs.readFile("migrations/0249_company_form_tenant_go_live.sql", "utf8");
    const foundation = await fs.readFile("migrations/0248_company_form_stage_events.sql", "utf8");
    retainFixtureReferences("tenant-local go-live isolated retained upgrade schemas", assignments);
    for (let i = 0; i < schemas.length; i++) {
      await pool.query(`CREATE SCHEMA "${schemas[i]}"`);
      await query(i, `
        CREATE TABLE crew_assignments(assign_uuid text,assignment_type text,sign_on_date text,sign_off_date text,is_deleted boolean DEFAULT false);
        CREATE TABLE vessel_planning_v2(crew_assign_uuid text,relief_status text,is_deleted boolean DEFAULT false);
        CREATE TABLE frm_resolution_runs(run_uuid text PRIMARY KEY,subject_type text,subject_ref text,stage_key text,
          cycle_uuid text,event_key text,trigger_at timestamptz,outcome text,actor_uuid text,source text,evidence jsonb);
        CREATE FUNCTION frm_ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS
          $$ BEGIN RAISE EXCEPTION 'append-only' USING ERRCODE='23514'; END $$;
      `);
      await query(i, foundation);
      await query(i, "INSERT INTO crew_assignments VALUES($1,'OnBoard',$2,NULL,false)",
        [assignments[i], i === 2 ? "2026-99-99" : "2020-01-01"]);
    }
  });
  afterAll(async () => {
    for (const schema of schemas) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
  });
  it("activates only the tenant upgraded, with recorded empty checks and no retrospective requirements", async () => {
    await activate(0);
    const a = (await query(0, "SELECT * FROM frm_stage_rollout")).rows[0];
    const b = (await query(1, "SELECT * FROM frm_stage_rollout")).rows[0];
    expect(a.enforcement_enabled).toBe(true); expect(a.completed_at).not.toBeNull();
    expect(b.enforcement_enabled).toBe(false); expect(b.completed_at).toBeNull();
    const events = (await query(0, "SELECT * FROM frm_stage_events ORDER BY stage_key")).rows;
    expect(events).toHaveLength(2);
    expect(events.every(e => e.snapshot.legacy && e.snapshot.candidates.length === 0)).toBe(true);
    expect(events.find(e => e.stage_key === "on_board").business_date).toBeTruthy();
    expect(events.find(e => e.stage_key === "before_joining").business_date).toBeNull();
    expect((await query(0, "SELECT * FROM frm_stage_attempts WHERE outcome='COMPLETED'")).rows).toHaveLength(2);
    retainFixtureReferences("tenant go-live complete retained event/run/attempt graph",
      [...events, ...(await query(0, "SELECT * FROM frm_stage_attempts")).rows,
        ...(await query(0, "SELECT * FROM frm_resolution_runs")).rows]);
  });
  it("a failed tenant upgrade leaves enforcement off and resumes without duplicate events", async () => {
    let failure: unknown;
    try { await activate(2); } catch (error) { failure = error; }
    expect(failure).toBeTruthy();
    expect(await deferFailedStageActivation("0249_company_form_tenant_go_live.sql",
      { query: (text: string, args: any[]) => query(2, text, args) }, failure)).toBe(true);
    expect((await query(2, "SELECT actor_uuid,event,evidence FROM frm_stage_audit WHERE event='GO_LIVE_FAILED'")).rows[0])
      .toMatchObject({ actor_uuid: "tenant-upgrade", event: "GO_LIVE_FAILED" });
    expect(await deferFailedStageActivation("unrelated.sql", { query: () => { throw Error("must not write"); } }, failure)).toBe(false);
    expect((await query(2, "SELECT * FROM frm_stage_rollout")).rows[0].enforcement_enabled).toBe(false);
    expect((await query(2, "SELECT * FROM frm_stage_events")).rows).toHaveLength(0);
    await query(2, "UPDATE crew_assignments SET sign_on_date='2020-01-01'");
    await activate(2); await activate(2);
    expect((await query(2, "SELECT * FROM frm_stage_events")).rows).toHaveLength(2);
    expect((await query(2, "SELECT * FROM frm_stage_audit WHERE event='GO_LIVE_COMPLETED'")).rows).toHaveLength(1);
    retainFixtureReferences("resumed tenant go-live retained events", (await query(2, "SELECT * FROM frm_stage_events")).rows);
  });
  it("keeps events and attempts append-only", async () => {
    await expect(query(0, "UPDATE frm_stage_events SET snapshot='{}'")).rejects.toMatchObject({ code: "23514" });
    await expect(query(0, "DELETE FROM frm_stage_attempts")).rejects.toMatchObject({ code: "23514" });
  });
});
