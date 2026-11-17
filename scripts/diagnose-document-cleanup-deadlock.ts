// Diagnostic only: actual test helper, empty DML, and transactions always rolled back.
import fs from "node:fs/promises";
import pg from "pg";
import { prepareTestEnvironment } from "./test-database-guard.mjs";
import { clearCompanyFormDocumentFixtures } from "../tests/helpers/companyFormDocumentCleanup";

await prepareTestEnvironment();
process.env.NODE_ENV = "test";
const out = "generated-artifacts/fixture-cleanup-deadlock";
await fs.mkdir(out, { recursive: true });
const clients = ["cleanup", "archive-writer", "observer"].map(name =>
  new pg.Client({ connectionString: process.env.TEST_DATABASE_URL, application_name: `cleanup_diagnostic_${name}` }));
const [cleanup, writer, observer] = clients;
await Promise.all(clients.map(c => c.connect()));
const report: any = { diagnostic: "controlled reproduction, not a historical server-log recovery", emptyDmlOnly: true };
let cleanWork: Promise<unknown> | undefined, writeWork: Promise<unknown> | undefined;
const settle = (work: Promise<unknown>) => work.then(() => ({ ok: true }), (error: any) => ({
  ok: false, code: error.code, message: error.message, detail: error.detail, hint: error.hint,
}));
async function waitFor(test: () => Promise<boolean>) {
  const deadline = Date.now() + 2000;
  while (!await test()) {
    if (Date.now() > deadline) throw Error("Expected diagnostic lock was not observed.");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
try {
  const a = (await cleanup.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  const b = (await writer.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  report.pids = { cleanup: a, writer: b };
  await cleanup.query("BEGIN");
  await writer.query("BEGIN");
  await cleanup.query("SET LOCAL deadlock_timeout='3s'");
  await writer.query("SET LOCAL deadlock_timeout='3s'");
  // Same RowExclusive table lock as prepareDocument's file INSERT, but no rows.
  await writer.query("INSERT INTO frm_document_files SELECT * FROM frm_document_files WHERE false");
  cleanWork = settle(clearCompanyFormDocumentFixtures(cleanup, []));
  await waitFor(async () => (await observer.query(
    "SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE pid=$1", [a])).rows[0]?.waiting === true);
  // Same next table written by prepareDocument; again insert zero rows.
  writeWork = settle(writer.query("INSERT INTO frm_document_preparation_events SELECT * FROM frm_document_preparation_events WHERE false"));
  await waitFor(async () => (await observer.query(
    "SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE pid=$1", [b])).rows[0]?.waiting === true);
  report.activity = (await observer.query(`SELECT pid,backend_xid::text,wait_event_type,wait_event,query,
    pg_blocking_pids(pid) AS blocked_by FROM pg_stat_activity WHERE pid=ANY($1::int[]) ORDER BY pid`, [[a,b]])).rows;
  report.locks = (await observer.query(`SELECT l.pid,l.mode,l.granted,l.relation::regclass::text AS relation
    FROM pg_locks l WHERE l.pid=ANY($1::int[]) AND l.locktype='relation'
    AND l.relation IN ('frm_document_files'::regclass,'frm_document_preparation_events'::regclass)
    ORDER BY l.pid,l.relation,l.granted DESC,l.mode`, [[a,b]])).rows;
  report.outcomes = await Promise.all([cleanWork, writeWork]);
  if (!report.outcomes.some((r: any) => r.code === "40P01")) throw Error("The expected PostgreSQL deadlock did not reproduce.");
} finally {
  await Promise.all(clients.slice(0,2).map(c => c.query("ROLLBACK").catch(() => undefined)));
  await Promise.allSettled([cleanWork, writeWork].filter(Boolean));
  report.triggerStates = (await observer.query(`SELECT c.relname,t.tgname,t.tgenabled FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relname IN
    ('frm_document_files','frm_document_preparation_events') ORDER BY c.relname,t.tgname`)).rows;
  await fs.writeFile(`${out}/controlled-reproduction.json`, JSON.stringify(report, null, 2));
  await Promise.all(clients.map(c => c.end()));
}
console.log(JSON.stringify(report, null, 2));
