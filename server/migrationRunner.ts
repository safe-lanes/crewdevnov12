import { Pool } from "pg";
import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MigrationRecord {
  id: number;
  filename: string;
  applied_at: Date;
}

const MIGRATION_FILENAME_PATTERN = /^\d{4}_.+\.sql$/;

async function runMigrationsOnPool(pool: Pool, label: string): Promise<{ applied: number; skipped: number; total: number }> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedResult = await pool.query<MigrationRecord>(
    "SELECT filename FROM schema_migrations ORDER BY filename"
  );
  const appliedMigrations = new Set(appliedResult.rows.map(row => row.filename));

  const migrationsDir = join(__dirname, "../migrations");
  let files: string[];
  try {
    files = await readdir(migrationsDir);
  } catch {
    return { applied: 0, skipped: 0, total: 0 };
  }

  const sqlFiles = files
    .filter(f => MIGRATION_FILENAME_PATTERN.test(f))
    .sort();

  if (sqlFiles.length === 0) {
    return { applied: 0, skipped: 0, total: 0 };
  }

  let appliedCount = 0;
  let skippedCount = 0;

  for (const filename of sqlFiles) {
    if (appliedMigrations.has(filename)) {
      skippedCount++;
      continue;
    }

    console.log(`🔧 [${label}] Applying migration: ${filename}`);

    const client = await pool.connect();
    try {
      const migrationPath = join(migrationsDir, filename);
      const migrationSQL = await readFile(migrationPath, "utf-8");

      try {
        await client.query("BEGIN");
        await client.query(migrationSQL);
        await client.query("COMMIT");
      } catch (sqlError: any) {
        await client.query("ROLLBACK");

        const errorCode = sqlError.code;
        const isAlreadyExistsError =
          errorCode === '42P07' ||
          errorCode === '42710' ||
          errorCode === '42P16' ||
          errorCode === '42723';

        if (!isAlreadyExistsError) {
          throw sqlError;
        }
        console.log(`   ℹ️  [${label}] Some objects already exist (OK for existing databases)`);
      }

      await client.query("BEGIN");
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [filename]
      );
      await client.query("COMMIT");

      console.log(`✅ [${label}] Applied: ${filename}`);
      appliedCount++;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
      }
      console.error(`❌ [${label}] Failed to apply migration ${filename}:`, error);
      throw new Error(`Migration failed: ${filename}. ${error}`);
    } finally {
      client.release();
    }
  }

  return { applied: appliedCount, skipped: skippedCount, total: sqlFiles.length };
}

export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    if (process.env.MASTER_DATABASE_URL) {
      console.log("⏭️  Skipping startup migrations — in multi-tenant mode, migrations run per tenant on first connection");
    } else {
      console.log("⏭️  Skipping migrations: no database configured (standalone dev mode)");
    }
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔄 Starting automatic database migrations...");

    const result = await runMigrationsOnPool(pool, "main");

    console.log("\n📊 Migration Summary:");
    console.log(`   ✅ Applied: ${result.applied}`);
    console.log(`   ⏭️  Skipped: ${result.skipped}`);
    console.log(`   📁 Total: ${result.total}`);
    console.log("✅ Database migrations completed successfully!\n");
  } catch (error) {
    console.error("❌ Migration runner failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

function maskLabel(label: string): string {
  if (label === "main") return label;
  if (label.length <= 8) return label.substring(0, 4) + "***";
  return label.substring(0, 8) + "***";
}

export async function runMigrationsForTenant(connectionString: string, tuid: string): Promise<void> {
  const requiresSsl =
    connectionString.includes("sslmode=require") || connectionString.includes("ssl=true");

  const pool = new Pool({
    connectionString,
    ssl: requiresSsl
      ? { rejectUnauthorized: false, checkServerIdentity: () => undefined }
      : false,
    max: 2,
    connectionTimeoutMillis: 10000,
  });

  const safeLabel = maskLabel(tuid);

  try {
    const result = await runMigrationsOnPool(pool, safeLabel);

    if (result.applied > 0) {
      console.log(`📊 [${safeLabel}] Tenant migration: ${result.applied} applied, ${result.skipped} skipped, ${result.total} total`);
    }
  } finally {
    await pool.end();
  }
}
