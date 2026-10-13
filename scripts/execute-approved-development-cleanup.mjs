import pg from "pg";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { identitySQL, sameIdentity } from "./test-database-guard.mjs";

// One authorized maintenance transaction. No production or test target allowed.
if (!process.argv.includes("--execute-approved")) throw Error("Explicit approval flag required.");
if (process.env.MASTER_DATABASE_URL) throw Error("This inventory covers the single development tenant only.");
const directory = "generated-artifacts/private-db-backups";
const manifest = JSON.parse(await fs.readFile(`${directory}/cleanup-dry-run.json`, "utf8"));
const suite = JSON.parse(await fs.readFile("test-results/results.json", "utf8"));
if (suite.testResults?.length !== 150 || !Number.isInteger(suite.numFailedTests) ||
    suite.numFailedTests > 163 || suite.numPendingTests > 67) throw Error("Pre-deletion suite gate failed.");
if (manifest.conflicts.length || !manifest.tables.frm_stage_events.every(r => r.decision === "REMOVE"))
  throw Error("Unresolved inventory or partial stage reset.");
const backup = JSON.parse(await fs.readFile(`${directory}/restore-proof-2026-10-13T03-55-23-357Z.json`, "utf8"));
if (backup.differences?.length !== 0 || !backup.scratchDropped || backup.tableCount !== 2736)
  throw Error("Verified restore proof is missing.");
await fs.access(backup.backupPath);
const quote = value => `"${value.replaceAll('"', '""')}"`;
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const strings = value => typeof value === "string" ? [value] : Array.isArray(value) ?
  value.flatMap(strings) : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];
const countHashes = hashes => {
  const counts = new Map();
  for (const hash of hashes) counts.set(hash, (counts.get(hash) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
};
const run = { runUuid: crypto.randomUUID(), startedAt: new Date().toISOString(),
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  status: "STARTING", tenant: manifest.identity, counts: {}, deletionOrder: [] };
const path = `${directory}/cleanup-execution-${run.runUuid}.json`;
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
let committed = false;
const deletions = new Map();
const before = new Map();
const foreignColumns = new Map();
for (const fk of manifest.foreignKeys) {
  if (!foreignColumns.has(fk.child)) foreignColumns.set(fk.child, new Set());
  for (const column of fk.child_columns) foreignColumns.get(fk.child).add(column);
}
const removedIdentities = new Set();
for (const [table, entries] of Object.entries(manifest.tables))
  for (const e of entries.filter(e => e.decision === "REMOVE"))
    for (const [key, value] of Object.entries(e.key)) {
      if (typeof value === "string" && value &&
          !foreignColumns.get(table)?.has(key) &&
          !["crew_assign_uuid", "reliever_assign_uuid", "deployed_to_plan_uuid"].includes(key) &&
          (key !== "crew_uuid" || table === "crew_members_v2") &&
          (/(?:uuid|ruid|uid|rank_id)$/.test(key) ||
           /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value))) removedIdentities.add(value.toLowerCase());
    }
await fs.writeFile(path, JSON.stringify(run, null, 2), { mode: 0o600 });
try {
  await c.connect();
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout='15s'");
  const identity = (await c.query(identitySQL)).rows[0];
  if (!sameIdentity(identity, manifest.identity) ||
      !sameIdentity(identity, { clusterid: "7586633721581772821", databaseoid: "16384" }))
    throw Error("Development identity mismatch.");
  const registered = JSON.parse(await fs.readFile(".local/test-database-identity.json", "utf8"));
  if (sameIdentity(identity, registered)) throw Error("Refusing registered test database.");
  await c.query(`LOCK TABLE ${Object.keys(manifest.tables).map(t => `public.${quote(t)}`).join(",")} IN ACCESS EXCLUSIVE MODE`);
  const triggers = (await c.query(`SELECT t.tgname,t.tgenabled,p.relname
    FROM pg_trigger t JOIN pg_class p ON p.oid=t.tgrelid JOIN pg_namespace n ON n.oid=p.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY p.relname,t.tgname`)).rows;
  const constraintsSQL = `SELECT k.conname,k.contype,k.convalidated,p.relname,pg_get_constraintdef(k.oid) definition
    FROM pg_constraint k JOIN pg_class p ON p.oid=k.conrelid JOIN pg_namespace n ON n.oid=p.relnamespace
    WHERE n.nspname='public' ORDER BY p.relname,k.conname`;
  const constraints = (await c.query(constraintsSQL)).rows;
  for (const [table, expected] of Object.entries(manifest.tables)) {
    if (expected.some(e => !e.sqlSha256)) throw Error(`Missing exact SQL fingerprint: ${table}`);
    const rows = (await c.query(`SELECT ctid::text AS tid,row_to_json(t)::text AS raw FROM public.${quote(table)} t`)).rows;
    if (JSON.stringify(countHashes(rows.map(r => sha(r.raw)))) !==
        JSON.stringify(countHashes(expected.map(e => e.sqlSha256))))
      throw Error(`Inventory changed before deletion: ${table}`);
    const remove = new Set(expected.filter(e => e.decision === "REMOVE").map(e => e.sqlSha256));
    before.set(table, rows.map(r => JSON.parse(r.raw)));
    for (const r of rows.filter(r => !remove.has(sha(r.raw))))
      if (strings(JSON.parse(r.raw)).some(v => removedIdentities.has(v.toLowerCase())))
        throw Error(`Kept ${table} references a proposed removal.`);
    deletions.set(table, rows.filter(r => remove.has(sha(r.raw))).map(r => r.tid));
    run.counts[table] = { before: rows.length, removed: 0, afterCleanup: null, afterGoLive: null };
  }
  const cross = await c.query(`SELECT k.conname FROM pg_constraint k
    JOIN pg_class a ON a.oid=k.conrelid JOIN pg_class b ON b.oid=k.confrelid
    JOIN pg_namespace an ON an.oid=a.relnamespace JOIN pg_namespace bn ON bn.oid=b.relnamespace
    WHERE k.contype='f' AND an.nspname='public' AND bn.nspname=ANY($1::text[])`, [manifest.schemasToRemove]);
  if (cross.rowCount) throw Error("Kept public foreign key depends on a test schema.");
  // Immutable-history guards are suspended only inside the locked maintenance
  // transaction. FK/constraint triggers stay enabled; every original state is restored.
  for (const trigger of triggers)
    if (deletions.get(trigger.relname)?.length && trigger.tgenabled !== "D")
      await c.query(`ALTER TABLE public.${quote(trigger.relname)} DISABLE TRIGGER ${quote(trigger.tgname)}`);
  const pending = new Set([...deletions].filter(([, tids]) => tids.length).map(([table]) => table));
  while (pending.size) {
    let progress = false;
    for (const table of [...pending]) {
      await c.query("SAVEPOINT cleanup_delete");
      try {
        const result = await c.query(`DELETE FROM public.${quote(table)} WHERE ctid=ANY($1::tid[])`, [deletions.get(table)]);
        run.counts[table].removed += result.rowCount;
        run.deletionOrder.push(table);
        pending.delete(table); progress = true;
        await c.query("RELEASE SAVEPOINT cleanup_delete");
      } catch (error) {
        await c.query("ROLLBACK TO SAVEPOINT cleanup_delete");
        if (error.code !== "23503") throw error;
      }
    }
    if (!progress && pending.has("frm_company_submissions") && pending.has("frm_requirements")) {
      // The two-way current-submission/requirement link uses RESTRICT. Delete
      // both in one SQL statement, so its end-of-statement FK checks see both
      // removals. This was proved with the same cyclic RESTRICT links in the
      // registered test database; no FK is disabled or weakened here.
      const result = await c.query(`WITH submissions AS (
        DELETE FROM frm_company_submissions WHERE ctid=ANY($1::tid[]) RETURNING 1),
        requirements AS (
        DELETE FROM frm_requirements WHERE ctid=ANY($2::tid[]) RETURNING 1)
        SELECT (SELECT count(*) FROM submissions)::int submissions,
          (SELECT count(*) FROM requirements)::int requirements`,
      [deletions.get("frm_company_submissions"), deletions.get("frm_requirements")]);
      run.counts.frm_company_submissions.removed += result.rows[0].submissions;
      run.counts.frm_requirements.removed += result.rows[0].requirements;
      run.deletionOrder.push("frm_company_submissions + frm_requirements (one statement)");
      pending.delete("frm_company_submissions"); pending.delete("frm_requirements");
      progress = true;
    }
    if (!progress) throw Error(`Deletion dependency cycle; nothing committed: ${[...pending].join(",")}`);
  }
  for (const schema of manifest.schemasToRemove) {
    if (!/^(test_stage|test_ac|cf_dimensions|cf_lock|cf_verified_history|cf_crew_import)_[0-9a-f]+$/.test(schema))
      throw Error("Unapproved schema.");
    await c.query(`DROP SCHEMA ${quote(schema)} CASCADE`);
  }
  for (const trigger of triggers)
    if (deletions.get(trigger.relname)?.length && trigger.tgenabled !== "D") {
      const mode = trigger.tgenabled === "A" ? "ENABLE ALWAYS" :
        trigger.tgenabled === "R" ? "ENABLE REPLICA" : "ENABLE";
      await c.query(`ALTER TABLE public.${quote(trigger.relname)} ${mode} TRIGGER ${quote(trigger.tgname)}`);
    }
  for (const [table, expected] of Object.entries(manifest.tables)) {
    const current = (await c.query(`SELECT row_to_json(t)::text AS raw FROM public.${quote(table)} t`)).rows;
    const kept = expected.filter(e => e.decision !== "REMOVE");
    if (JSON.stringify(countHashes(current.map(r => sha(r.raw)))) !==
        JSON.stringify(countHashes(kept.map(e => e.sqlSha256))))
      throw Error(`Kept content changed or removal remains: ${table}`);
    run.counts[table].afterCleanup = current.length;
    run.counts[table].removed = run.counts[table].before - current.length;
  }
  if ((await c.query("SELECT 1 FROM adm_forms_v2 WHERE category='dynamic'")).rowCount)
    throw Error("Company Forms remain.");
  // Reuse the tenant-local item-30 implementation, restricted to open current
  // assignments. Previous-stage entry points already reached are opened too.
  let goLive = await fs.readFile("migrations/0249_company_form_tenant_go_live.sql", "utf8");
  const original = "WHERE NOT ca.is_deleted AND ca.assignment_type<>'Cancelled'";
  if (!goLive.includes(original)) throw Error("Go-live implementation changed; review required.");
  goLive = goLive.replace(original,
    "WHERE NOT ca.is_deleted AND ca.is_current AND ca.assignment_type IN('Planned','OnBoard')");
  goLive = goLive.replaceAll("'tenant-upgrade'", "'approved-development-cleanup'");
  await c.query(goLive);
  const availability = (await c.query(`WITH current_stages AS (
    SELECT a.assign_uuid,CASE WHEN a.assignment_type='Planned' THEN 'before_joining'
      WHEN EXISTS(SELECT 1 FROM vessel_planning_v2 p WHERE p.crew_assign_uuid=a.assign_uuid
        AND NOT p.is_deleted AND p.relief_status IN('Planned','Confirmed')) THEN 'at_sign_off'
      ELSE 'on_board' END stage_key FROM crew_assignments a
    WHERE NOT a.is_deleted AND a.is_current AND a.assignment_type IN('Planned','OnBoard'))
    SELECT count(*)::int total,count(*) FILTER(WHERE EXISTS(
      SELECT 1 FROM frm_stage_cycles c JOIN frm_stage_events e
      ON e.subject_ref=c.subject_ref AND e.stage_key=c.stage_key AND e.cycle_uuid=c.cycle_uuid
      JOIN frm_stage_attempts t ON t.event_uuid=e.event_uuid AND t.outcome='COMPLETED'
      WHERE c.subject_ref=s.assign_uuid AND c.stage_key=s.stage_key AND NOT c.deferred))::int opened
    FROM current_stages s`)).rows[0];
  if (availability.total !== availability.opened) throw Error("A current stage remains closed.");
  if ((await c.query("SELECT 1 FROM frm_requirements")).rowCount) throw Error("Go-live created requirements.");
  if (!(await c.query("SELECT enforcement_enabled FROM frm_stage_rollout WHERE singleton")).rows[0]?.enforcement_enabled)
    throw Error("Tenant enforcement is not enabled.");
  for (const [table, expected] of Object.entries(manifest.tables)) {
    const current = (await c.query(`SELECT row_to_json(t)::text AS raw FROM public.${quote(table)} t`)).rows;
    const hashes = new Set(current.map(r => sha(r.raw)));
    if (expected.some(e => e.decision !== "REMOVE" && !hashes.has(e.sqlSha256)))
      throw Error(`Go-live changed kept content: ${table}`);
    if (current.some(r => strings(JSON.parse(r.raw)).some(v => removedIdentities.has(v.toLowerCase()))))
      throw Error(`Remaining semantic reference to removed row: ${table}`);
    run.counts[table].afterGoLive = current.length;
  }
  const afterTriggers = (await c.query(`SELECT t.tgname,t.tgenabled,p.relname FROM pg_trigger t
    JOIN pg_class p ON p.oid=t.tgrelid JOIN pg_namespace n ON n.oid=p.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY p.relname,t.tgname`)).rows;
  if (JSON.stringify(triggers) !== JSON.stringify(afterTriggers)) throw Error("Trigger state changed.");
  if (JSON.stringify(constraints) !== JSON.stringify((await c.query(constraintsSQL)).rows))
    throw Error("Public constraints changed.");
  run.availability = availability;
  run.keptFingerprintsUnchanged = true;
  run.referencesToRemovedRows = 0;
  run.schemasRemoved = manifest.schemasToRemove.length;
  await c.query(`INSERT INTO frm_stage_audit(actor_uuid,event,evidence)
    VALUES ('approved-development-cleanup','DEVELOPMENT_CLEANUP_COMPLETED',$1::jsonb)`,
    [JSON.stringify({ runUuid: run.runUuid, head: run.head, tenantIdentity: identity,
      stages: availability, keptFingerprintsUnchanged: true, referencesToRemovedRows: 0,
      schemasRemoved: run.schemasRemoved })]);
  run.counts.frm_stage_audit.afterGoLive++;
  run.status = "READY_TO_COMMIT";
  await fs.writeFile(path, JSON.stringify(run, null, 2), { mode: 0o600 });
  await c.query("COMMIT");
  committed = true;
  run.status = "COMMITTED"; run.completedAt = new Date().toISOString();
  await fs.writeFile(path, JSON.stringify(run, null, 2), { mode: 0o600 });
  await fs.writeFile(`${directory}/cleanup-execution-latest.json`, JSON.stringify(run, null, 2), { mode: 0o600 });
  const csv = "table,before,removed,after_cleanup,after_go_live\n" +
    Object.entries(run.counts).map(([t, n]) =>
      `${t},${n.before},${n.removed},${n.afterCleanup},${n.afterGoLive}`).join("\n") + "\n";
  await fs.writeFile("generated-artifacts/cleanup-before-after-counts.csv", csv);
  console.log(JSON.stringify({ runUuid: run.runUuid, status: run.status, availability,
    keptFingerprintsUnchanged: true, referencesToRemovedRows: 0,
    schemasRemoved: run.schemasRemoved, report: path }, null, 2));
} catch (error) {
  await c.query("ROLLBACK").catch(() => {});
  run.status = committed ? "COMMITTED_REPORT_FAILURE" : "ROLLED_BACK"; run.error = error.message;
  await fs.writeFile(path, JSON.stringify(run, null, 2), { mode: 0o600 });
  throw error;
} finally {
  await c.end();
}
