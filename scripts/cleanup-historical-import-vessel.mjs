import pg from "pg";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { identitySQL, sameIdentity } from "./test-database-guard.mjs";

// Narrow, explicitly approved development maintenance. Never a test-fixture helper.
const execute = process.argv.includes("--execute-approved");
const proofPath = process.argv[process.argv.indexOf("--restore-proof") + 1];
if (!process.argv.includes("--restore-proof")) throw Error("Fresh restore proof required.");
if (process.env.MASTER_DATABASE_URL) throw Error("Single development tenant only.");
const proof = JSON.parse(await fs.readFile(proofPath, "utf8"));
if (!Array.isArray(proof.differences) || proof.differences.length || !proof.scratchDropped ||
    Date.now() - Date.parse(proof.finishedAt) > 60 * 60 * 1000)
  throw Error("A successful fresh restore proof, with scratch dropped, is required.");
await fs.access(proof.backupPath);
const expectedIdentity = { clusterid: "7586633721581772821", databaseoid: "16384" };
const vessel = "744535d0-841a-11ed-aa7c-7003bca91a866";
const assignmentUuids = [
  "d111aa07-3525-40f8-a6a6-5ecf2ffc104d",
  "1cd29a20-4fd7-4f8f-94d6-f0dc78f25a97",
  "5d09e503-5a52-4008-9c3c-feb4104c6154",
];
const planningIds = [1647,1700,1772,1843,1934,2020,2089,2162,2235,2308,2381,2475,
  2557,2636,2715,2794,2861,2940,3114,3162,3210,3258,3325,3415];
const q = s => `"${s.replaceAll('"', '""')}"`;
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const fingerprints = rows => rows.map(r => sha(r.raw)).sort();
const selected = (table, row) =>
  table === "master_vessels" ? row.id === 876 && row.vessel_uuid === vessel :
  table === "crew_assignments" ? assignmentUuids.includes(row.assign_uuid) :
  table === "crew_assignment_rule_context" ? assignmentUuids.includes(row.assign_uuid) :
  table === "vessel_planning_v2" ? planningIds.includes(row.id) && row.vessel_uuid === vessel : false;
const run = { runUuid: crypto.randomUUID(), mode: execute ? "EXECUTE" : "READ_ONLY",
  startedAt: new Date().toISOString(), head: execFileSync("git", ["rev-parse", "HEAD"],
    { encoding: "utf8" }).trim(), backupPath: proof.backupPath, restoreProof: proofPath,
  status: "STARTING", counts: {}, protected: ["planning 1112", "rotation 473",
    "archive 414", "fixture seafarer 1266", "all three established seafarers"] };
const out = `generated-artifacts/private-db-backups/import-vessel-${run.mode.toLowerCase()}-${run.runUuid}.json`;
await fs.writeFile(out, JSON.stringify(run, null, 2), { mode: 0o600 });
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
let committed = false;
try {
  await c.connect();
  await c.query(execute ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await c.query("SET LOCAL lock_timeout='15s'");
  const identity = (await c.query(identitySQL)).rows[0];
  const testIdentity = JSON.parse(await fs.readFile(".local/test-database-identity.json", "utf8"));
  if (!sameIdentity(identity, expectedIdentity) || !sameIdentity(identity, proof.developmentIdentity) ||
      sameIdentity(identity, testIdentity)) throw Error("Wrong development database identity.");
  run.identity = identity;
  const tables = (await c.query(`SELECT tablename FROM pg_tables
    WHERE schemaname='public' ORDER BY tablename`)).rows.map(r => r.tablename);
  if (execute) await c.query(`LOCK TABLE ${tables.map(t => `public.${q(t)}`).join(",")} IN ACCESS EXCLUSIVE MODE`);
  const before = new Map();
  for (const table of tables) {
    const rows = (await c.query(`SELECT ctid::text tid,row_to_json(t)::text raw FROM public.${q(table)} t`)).rows;
    for (const row of rows) row.data = JSON.parse(row.raw);
    before.set(table, rows);
    if (String(rows.length) !== proof.before[`public.${table}`])
      throw Error(`Counts changed since fresh backup: ${table}`);
  }
  const roots = before.get("crew_assignments").filter(r => selected("crew_assignments", r.data));
  const owners = new Set(["94de4a52-70af-47a4-bff3-155b1704d4a7",
    "c39d6a76-6015-4fa4-9339-1a2b37801ec9","93cbfc40-d544-4c76-a03e-5b9651f1b2d4"]);
  if (roots.length !== 3 || roots.some(r => r.data.vessel_uuid !== vessel || r.data.is_current ||
      !owners.has(r.data.crew_uuid) ||
      !(r.data.id === 116 && r.data.assignment_type === "Planned" && r.data.is_deleted ||
        r.data.id === 117 && r.data.assignment_type === "Planned" && r.data.is_deleted ||
        r.data.id === 118 && r.data.assignment_type === "Cancelled")))
    throw Error("Reviewed assignment identities/states changed.");
  if (!before.get("master_vessels").some(r => selected("master_vessels",r.data) && r.data.vessel === `Import-${vessel}`))
    throw Error("Reviewed vessel identity/name changed.");
  const plans = before.get("vessel_planning_v2").filter(r => selected("vessel_planning_v2", r.data));
  if (plans.length !== 24 || plans.some(r => r.data.rank !== "Test Officer" ||
      r.data.crew_uuid || r.data.reliever_crew_uuid || r.data.crew_assign_uuid || r.data.reliever_assign_uuid))
    throw Error("Vessel-owned planning rows are no longer empty; deletion refused.");
  const removedUuids = [vessel, ...assignmentUuids, ...plans.map(r => r.data.plan_uuid)];
  for (const [table, rows] of before) {
    const remove = rows.filter(r => selected(table, r.data));
    run.counts[table] = { before: rows.length, removed: remove.length, after: rows.length - remove.length };
    // Search nested JSON and free-text references as well as declared FKs.
    if (rows.some(r => !selected(table, r.data) && removedUuids.some(id => r.raw.includes(id))))
      throw Error(`An unapproved kept reference exists in ${table}; nothing removed.`);
  }
  const intended = { master_vessels: 1, crew_assignments: 3,
    crew_assignment_rule_context: 1, vessel_planning_v2: 24 };
  for (const [table, counts] of Object.entries(run.counts))
    if (counts.removed !== (intended[table] ?? 0)) throw Error(`Unexpected deletion count: ${table}`);
  // Validate every declared FK targeting a removal, including integer keys.
  const fks = (await c.query(`SELECT child.relname child,parent.relname parent,
    ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY x(num,n)
      JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=x.num ORDER BY x.n) child_columns,
    ARRAY(SELECT a.attname::text FROM unnest(k.confkey) WITH ORDINALITY x(num,n)
      JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=x.num ORDER BY x.n) parent_columns,
    cn.nspname child_schema
    FROM pg_constraint k JOIN pg_class child ON child.oid=k.conrelid
    JOIN pg_class parent ON parent.oid=k.confrelid
    JOIN pg_namespace cn ON cn.oid=child.relnamespace
    JOIN pg_namespace pn ON pn.oid=parent.relnamespace
    WHERE k.contype='f' AND pn.nspname='public'`)).rows;
  for (const fk of fks) {
    const removed = (before.get(fk.parent) ?? []).filter(r => selected(fk.parent, r.data));
    if (!removed.length) continue;
    if (fk.child_schema !== "public") throw Error("Cross-schema reference needs review.");
    for (const child of before.get(fk.child) ?? []) {
      if (selected(fk.child, child.data)) continue;
      if (removed.some(parent => fk.child_columns.every((column, n) =>
        child.data[column] != null && String(child.data[column]) === String(parent.data[fk.parent_columns[n]]))))
        throw Error(`Kept foreign-key reference in ${fk.child}; nothing removed.`);
    }
  }
  for (const [table, id] of [["vessel_planning_v2",1112],["rotation_entries_v2",473],
    ["rotation_archive_v2",414],["crew_members_v2",1266]]) {
    if (!before.get(table).some(r => r.data.id === id && !selected(table, r.data)))
      throw Error("Explicitly protected record missing or selected.");
  }
  const triggerSQL = `SELECT c.relname,t.tgname,t.tgenabled FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`;
  const constraintSQL = `SELECT k.conname,k.contype,k.convalidated,c.relname,
    pg_get_constraintdef(k.oid) definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname`;
  const triggers = (await c.query(triggerSQL)).rows;
  const constraints = (await c.query(constraintSQL)).rows;
  if (execute) {
    const suite = JSON.parse(await fs.readFile("test-results/results.json", "utf8"));
    if (!Number.isInteger(suite.numFailedTests) || !Number.isInteger(suite.numPendingTests) ||
        suite.numFailedTests > 163 || suite.numPendingTests > 67) throw Error("Standing suite ceiling failed.");
    // A frozen historical context has a user DELETE guard. Suspend ONLY its
    // user triggers within this locked transaction; never disable FK triggers.
    const contextTriggers = triggers.filter(t => t.relname === "crew_assignment_rule_context" && t.tgenabled !== "D");
    run.contextTriggersTemporarilySuspended = contextTriggers.map(t=>t.tgname);
    for (const t of contextTriggers)
      await c.query(`ALTER TABLE crew_assignment_rule_context DISABLE TRIGGER ${q(t.tgname)}`);
    for (const table of ["crew_assignment_rule_context","vessel_planning_v2","crew_assignments","master_vessels"]) {
      const tids = before.get(table).filter(r => selected(table, r.data)).map(r => r.tid);
      const deleted = await c.query(`DELETE FROM public.${q(table)} WHERE ctid=ANY($1::tid[])`, [tids]);
      if (deleted.rowCount !== intended[table]) throw Error(`Deletion count mismatch: ${table}`);
    }
    for (const t of contextTriggers) {
      const mode = t.tgenabled === "A" ? "ENABLE ALWAYS" : t.tgenabled === "R" ? "ENABLE REPLICA" : "ENABLE";
      await c.query(`ALTER TABLE crew_assignment_rule_context ${mode} TRIGGER ${q(t.tgname)}`);
    }
    let keptRows = 0;
    for (const [table, old] of before) {
      const current = (await c.query(`SELECT row_to_json(t)::text raw FROM public.${q(table)} t`)).rows;
      const kept = old.filter(r => !selected(table, r.data));
      const beforeKept = JSON.stringify(fingerprints(kept));
      const afterKept = JSON.stringify(fingerprints(current));
      run.counts[table].beforeKeptFingerprint = sha(beforeKept);
      run.counts[table].afterKeptFingerprint = sha(afterKept);
      if (afterKept !== beforeKept)
        throw Error(`Kept content changed or unexpected cascading deletion: ${table}`);
      if (current.some(r => removedUuids.some(id => r.raw.includes(id))))
        throw Error(`Remaining reference to removed identity: ${table}`);
      keptRows += current.length;
    }
    if (JSON.stringify(triggers) !== JSON.stringify((await c.query(triggerSQL)).rows) ||
        JSON.stringify(constraints) !== JSON.stringify((await c.query(constraintSQL)).rows))
      throw Error("Trigger or constraint state changed.");
    run.keptFingerprintsUnchanged = true;
    run.keptRowsCompared = keptRows;
    run.referencesToRemovedRows = 0;
    run.tablesCompared = tables.length;
    run.vesselList = (await c.query("SELECT vessel FROM master_vessels ORDER BY vessel")).rows.map(r => r.vessel);
    if (JSON.stringify(run.vesselList) !== JSON.stringify(Array.from({length:9},(_,n)=>`vessel ${String(n+2).padStart(2,"0")}`)))
      throw Error("Final vessel list is not exactly vessel 02 through vessel 10.");
    run.status = "READY_TO_COMMIT";
    await fs.writeFile(out, JSON.stringify(run, null, 2), { mode: 0o600 });
    await c.query("COMMIT"); committed = true;
    run.status = "COMMITTED";
  } else {
    await c.query("ROLLBACK");
    run.status = "DRY_RUN_PASSED";
  }
  run.completedAt = new Date().toISOString();
  await fs.writeFile(out, JSON.stringify(run, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ runUuid: run.runUuid, status: run.status, report: out,
    removals: Object.fromEntries(Object.entries(run.counts).filter(([,v])=>v.removed).map(([t,v])=>[t,v.removed])),
    keptRowsCompared: run.keptRowsCompared, keptFingerprintsUnchanged: run.keptFingerprintsUnchanged,
    referencesToRemovedRows: run.referencesToRemovedRows, vesselList: run.vesselList }, null, 2));
} catch (error) {
  await c.query("ROLLBACK").catch(()=>{});
  run.status = committed ? "COMMITTED_REPORT_FAILURE" : "ROLLED_BACK";
  run.error = error.message;
  await fs.writeFile(out, JSON.stringify(run, null, 2), { mode: 0o600 });
  throw error;
} finally { await c.end(); }
