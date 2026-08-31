-- Compatibility migration for the legacy sources read by 0038 and 0089.
-- Fresh tenants need these tables before 0038. Existing tenants have already
-- passed 0038 and 0094, so this migration must not recreate dropped V1 tables.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM schema_migrations
    WHERE filename = '0038_migrate_vessel_ids_to_external_api.sql'
  ) THEN
    CREATE TABLE IF NOT EXISTS training_matrix_vessel_drafts (
      id SERIAL PRIMARY KEY,
      vessel_id TEXT NOT NULL,
      revision TEXT NOT NULL DEFAULT 'R1',
      draft_data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS training_matrix_vessel_revisions (
      id SERIAL PRIMARY KEY,
      vessel_id TEXT NOT NULL,
      revision TEXT NOT NULL,
      revision_date TEXT NOT NULL,
      revision_data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  END IF;
END
$$;