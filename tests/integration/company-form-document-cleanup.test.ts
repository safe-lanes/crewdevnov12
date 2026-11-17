import { afterAll, describe, expect, it } from "vitest";
import pg from "pg";
import { clearCompanyFormDocumentFixtures } from "../helpers/companyFormDocumentCleanup";

const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
afterAll(() => pool.end());

describe("Company Form document teardown lock order", () => {
  it("waits on files without holding the preparation-event trigger lock", async () => {
    const cleanup = await pool.connect(), writer = await pool.connect();
    const query = cleanup.query.bind(cleanup);
    let reachedFile!: () => void;
    const fileAttempt = new Promise<void>(resolve => { reachedFile = resolve; });
    let work: Promise<void> | undefined;
    // Observe the real helper's SQL without changing the SQL or its result.
    cleanup.query = ((...args: any[]) => {
      const result = (query as any)(...args);
      if (args[0] === "ALTER TABLE frm_document_files DISABLE TRIGGER USER") reachedFile();
      return result;
    }) as any;
    try {
      await cleanup.query("BEGIN");
      await writer.query("BEGIN");
      const pid = (await query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      // Acquires the archive writer's real relation locks, inserting no rows.
      await writer.query("INSERT INTO frm_document_files SELECT * FROM frm_document_files WHERE false");
      work = clearCompanyFormDocumentFixtures(cleanup, []);
      await fileAttempt;
      const locks = await pool.query(`SELECT 1 FROM pg_locks
        WHERE pid=$1 AND relation='frm_document_preparation_events'::regclass
          AND mode='ShareRowExclusiveLock' AND granted`, [pid]);
      expect(locks.rowCount).toBe(0);
      await writer.query("INSERT INTO frm_document_preparation_events SELECT * FROM frm_document_preparation_events WHERE false");
      await writer.query("COMMIT");
      await work;
    } finally {
      await writer.query("ROLLBACK");
      await work?.catch(() => undefined);
      await query("ROLLBACK");
      cleanup.query = query as any;
      cleanup.release(); writer.release();
    }
  });
});
