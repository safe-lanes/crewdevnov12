/** Disposable test evidence only. No application/preview caller may use this. */
export async function clearCompanyFormDocumentFixtures(db: any, submissions: string[]) {
  if (process.env.NODE_ENV !== "test" || process.env.TEST_DATABASE_VERIFIED !== "true") {
    throw new Error("Document fixture teardown requires the registered isolated test database.");
  }
  const expected = JSON.parse(process.env.TEST_DATABASE_IDENTITY!);
  const actual = (await db.query(`SELECT system_identifier::text AS clusterid,
    (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS databaseoid
    FROM pg_control_system()`)).rows[0];
  if (actual.clusterid !== expected.clusterid || actual.databaseoid !== expected.databaseoid) {
    throw new Error("Document fixture teardown refused an unregistered database.");
  }
  // Requires the caller's transaction. On any error the savepoint also restores
  // trigger state; never leave live immutability disabled after failed teardown.
  await db.query("SAVEPOINT document_fixture_cleanup");
  try {
    for (const table of ["frm_document_handovers", "frm_document_preparation_events", "frm_document_files",
      "frm_document_samples", "frm_document_preparation_requests", "frm_document_snapshots", "frm_document_assets", "frm_document_headers",
      "frm_document_references"]) {
      await db.query(`ALTER TABLE ${table} DISABLE TRIGGER USER`);
      await db.query(`DELETE FROM ${table} WHERE submission_uuid=ANY($1::text[])`, [submissions]);
      await db.query(`ALTER TABLE ${table} ENABLE TRIGGER USER`);
    }
    await db.query("RELEASE SAVEPOINT document_fixture_cleanup");
  } catch (error) {
    await db.query("ROLLBACK TO SAVEPOINT document_fixture_cleanup");
    throw error;
  }
}
