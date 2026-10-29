// @vitest-environment node
// Opt-in, disposable PostgreSQL cluster only. Never reads DATABASE_URL or .env.
// PowerShell: $env:TRAINING_REF_PG_BIN='C:\Program Files\PostgreSQL\18\bin'
// npx vitest run tests/integration/training-attachment-reference.test.ts --reporter=dot
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, getTableColumns, getTableName } from "drizzle-orm";
import * as schema from "../../shared/v2/crew-pool/schema";
import { ensureTrainingAttachmentReference } from "../../server/v2/crew-pool/services/trainingAttachmentReference";

vi.mock("../../server/v2/db", () => ({ getDb: () => { throw new Error("Application DB must not be accessed"); } }));

const pgBin = process.env.TRAINING_REF_PG_BIN;
const suite = pgBin ? describe : describe.skip;
const tables = [schema.crewMembersV2, schema.crewDocuments, schema.crewVisas, schema.crewEducation,
  schema.crewLicenses, schema.crewTrainingCourses, schema.crewSeaService, schema.crewPreJoiningMedicals,
  schema.crewDoctorVisits, schema.crewBriefings, schema.crewDebriefings];

suite("training reference allocation on disposable PostgreSQL", () => {
  let directory: string;
  let started = false;
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;
  const pg = (name: string, args: string[]) => execFileSync(
    join(pgBin!, process.platform === "win32" ? `${name}.exe` : name), args,
    // pg_ctl's detached Windows child can inherit pipe handles and keep
    // spawnSync waiting after startup. Its server output already goes to -l.
    { windowsHide: true, timeout: 45000, stdio: name === "pg_ctl" ? "ignore" : "pipe" },
  );

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "sail-training-ref-pg-"));
    const listener = createServer();
    await new Promise<void>((resolve, reject) => {
      listener.once("error", reject);
      listener.listen(0, "127.0.0.1", resolve);
    });
    const port = (listener.address() as { port: number }).port;
    await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
    pg("initdb", ["-D", join(directory, "data"), "-U", "codex_training_test", "--auth=trust", "--no-locale", "--encoding=UTF8"]);
    // Attempt cleanup even if startup times out after launching the server.
    started = true;
    pg("pg_ctl", ["-D", join(directory, "data"), "-l", join(directory, "postgres.log"),
      "-o", `-h 127.0.0.1 -p ${port} -F`, "-w", "start"]);
    pool = new Pool({ host: "127.0.0.1", port, user: "codex_training_test", password: "", database: "postgres", max: 8 });
    db = drizzle(pool);
    // Build the columns used by production Drizzle queries, in this empty cluster.
    // No application migrations, user tables or external connections are involved.
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map(column =>
        `"${column.name}" ${column.getSQLType()}${column.name === "is_deleted" ? " DEFAULT false" : ""}`,
      );
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(", ")})`);
    }
  }, 60000);

  afterAll(async () => {
    await pool?.end();
    if (started) pg("pg_ctl", ["-D", join(directory, "data"), "-m", "fast", "-w", "stop"]);
    // Only the directory created above, never an application/database directory.
    if (directory) await rm(directory, { recursive: true, force: true });
  }, 60000);

  beforeEach(async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const table of tables) await pool.query(`TRUNCATE TABLE "${getTableName(table)}"`);
    await db.insert(schema.crewMembersV2).values({ crewUuid: "crew-1", empNo: "K 1027" });
  });
  afterEach(() => vi.restoreAllMocks());

  const seed = async (trainUuid: string, extra: Partial<typeof schema.crewTrainingCourses.$inferInsert> = {}) => {
    const [row] = await db.insert(schema.crewTrainingCourses).values({
      trainUuid, crewUuid: "crew-1", trainingCourse: "Advanced Fire Fighting", abbr: "AFF",
      attachmentRef: null, certificateNo: "CERT-123", ...extra,
    }).returning();
    return row;
  };

  it("executes allocation SQL, preserves training fields and remains idempotent", async () => {
    const row = await seed("first");
    const first = await ensureTrainingAttachmentReference(row, db);
    const repeat = await ensureTrainingAttachmentReference(row, db);
    expect(first.attachmentRef).toBe("K 1027-T_AFF");
    expect(repeat.attachmentRef).toBe(first.attachmentRef);
    const [stored] = await db.select().from(schema.crewTrainingCourses);
    expect(stored).toMatchObject({ certificateNo: "CERT-123", trainingCourse: "Advanced Fire Fighting", attachmentRef: "K 1027-T_AFF" });
  });

  it("reserves a conflicting reference for only one simultaneous training save", async () => {
    const rows = await Promise.all([seed("a"), seed("b")]);
    const result = await Promise.all(rows.map(row => ensureTrainingAttachmentReference(row, db)));
    expect(result.filter(row => row.attachmentRef === "K 1027-T_AFF")).toHaveLength(1);
    expect(result.filter(row => row.attachmentRef === null)).toHaveLength(1);
    expect(await db.select().from(schema.crewTrainingCourses)).toHaveLength(2);
  });

  it("concurrent retries on one record return the same stored reference", async () => {
    const row = await seed("a");
    const results = await Promise.all(Array.from({ length: 6 }, () => ensureTrainingAttachmentReference(row, db)));
    expect(results.every(result => result.attachmentRef === "K 1027-T_AFF")).toBe(true);
  });

  it("recognizes case/whitespace conflicts in a different attachment section", async () => {
    await db.insert(schema.crewVisas).values({ visaUuid: "visa", crewUuid: "crew-1", attachmentRef: "\t k 1027-t_aff\n" });
    expect((await ensureTrainingAttachmentReference(await seed("a"), db)).attachmentRef).toBeNull();
  });

  it("uses persisted fields after partial edits and preserves non-null references", async () => {
    const stale = await seed("a");
    await db.update(schema.crewTrainingCourses).set({ abbr: " ", trainingCourse: "Chemical Tanker" })
      .where(eq(schema.crewTrainingCourses.trainUuid, "a"));
    expect((await ensureTrainingAttachmentReference(stale, db)).attachmentRef).toBe("K 1027-T_Chemical Tanker");
    await db.update(schema.crewTrainingCourses).set({ attachmentRef: "", abbr: "CHANGED" })
      .where(eq(schema.crewTrainingCourses.trainUuid, "a"));
    expect((await ensureTrainingAttachmentReference(stale, db)).attachmentRef).toBe("");
  });

  it("times out reference lock contention without losing saved training data", async () => {
    const row = await seed("a");
    const blocker = await pool.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock(29102026, hashtext($1))", ["crew-1"]);
      const result = await ensureTrainingAttachmentReference(row, db);
      expect(result).toEqual(row);
      expect(console.warn).toHaveBeenCalled();
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
    }
    expect(await db.select().from(schema.crewTrainingCourses)).toHaveLength(1);
    expect((await ensureTrainingAttachmentReference(row, db)).attachmentRef).toBe("K 1027-T_AFF");
  });

  it("applies the existing backfill twice without altering non-null references", async () => {
    await seed("a", { trainingCourse: "Chemical Tanker" });
    await seed("b", { attachmentRef: "EXISTING" });
    await seed("c", { attachmentRef: "" });
    await seed("d", { trainingCourse: null });
    const migration = await readFile(new URL("../../migrations/0202_backfill_training_attachment_ref.sql", import.meta.url), "utf8");
    await pool.query(migration);
    const first = await pool.query("SELECT train_uuid, attachment_ref FROM crew_training_courses ORDER BY train_uuid");
    await pool.query(migration);
    const second = await pool.query("SELECT train_uuid, attachment_ref FROM crew_training_courses ORDER BY train_uuid");
    expect(second.rows).toEqual(first.rows);
    expect(second.rows.map(row => row.attachment_ref)).toEqual(["crew-1-T_Chemical Tanker", "EXISTING", "", null]);
  });
});
