/**
 * Explicit private-schema dependencies, all within the verified disposable
 * database. No search_path fallback and no reads from a development database.
 */
export async function bootstrapMissingTestTables(db: { query: (...args: any[]) => Promise<any> }, schema: string) {
  if (process.env.TEST_DATABASE_VERIFIED !== "true" || !/^[a-z0-9_]+$/.test(schema))
    throw new Error("Private test schema bootstrap requires verified isolation.");
  const missing = (await db.query(`SELECT tablename FROM pg_tables p WHERE p.schemaname='public'
    AND NOT EXISTS(SELECT 1 FROM pg_tables t WHERE t.schemaname=$1 AND t.tablename=p.tablename)`, [schema])).rows;
  for (const { tablename } of missing) {
    if (!/^[a-z0-9_]+$/.test(tablename)) throw new Error("Unsafe table name.");
    await db.query(`CREATE TABLE "${schema}"."${tablename}" (LIKE public."${tablename}" INCLUDING ALL)`);
    if (tablename.startsWith("master_") || ["adm_available_ranks_v2", "adm_company_ranks_v2",
      "adm_permission_actions", "frm_subject_types", "frm_subject_stages"].includes(tablename))
      await db.query(`INSERT INTO "${schema}"."${tablename}" SELECT * FROM public."${tablename}"`);
  }
}
