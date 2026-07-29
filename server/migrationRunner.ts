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
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (sqlFiles.length === 0) {
    return { applied: 0, skipped: 0, total: 0 };
  }

  // Guard: two files sharing the same numeric prefix signal a merge-time
  // numbering collision.  We distinguish:
  //
  //  • Known legacy collisions (explicit allowlist below): pairs that have
  //    existed in the repository for a long time and are tracked correctly via
  //    full-filename keys.  These are safe and we only warn, regardless of DB
  //    state (so fresh databases also start cleanly).
  //
  //  • Any new collision (at least one filename not in the allowlist): the new
  //    file would run in an undefined position relative to its sibling — fail
  //    loudly so the developer must rename before the app can start.
  //
  // To add to the allowlist: copy both filenames for a known-safe pair here
  // and create a follow-up task to rename one of them (see Task #201).
  const KNOWN_LEGACY_COLLISION_FILES = new Set<string>([
    // prefix 0017
    "0017_add_forms_shared_config.sql",
    "0017_allow_null_file_no.sql",
    // prefix 0018
    "0018_add_is_system_rank_column.sql",
    "0018_remove_redundant_vessel_name_columns.sql",
    // prefix 0095
    "0095_add_previous_plan_status_to_rotation_drafts.sql",
    "0095_create_access_control_tables.sql",
    // prefix 0100
    "0100_add_is_reliever_archived.sql",
    "0100_add_rh_lock_unlock_menus.sql",
    // prefix 0110
    "0110_create_training_needs_other.sql",
    "0110_seed_initial_released_form_versions.sql",
    // prefix 0111
    "0111_create_training_needs_source_overlay.sql",
    "0111_reset_crew_appraisal_form_versions.sql",
    // prefix 0178
    "0178_add_source_to_cand_visas.sql",
    "0178_backfill_wage_scale_vessel_type_uuid.sql",
  ]);

  const prefixMap = new Map<string, string[]>();
  for (const f of sqlFiles) {
    const match = f.match(/^(\d+)/);
    const prefix = match ? match[1] : f;
    const existing = prefixMap.get(prefix) ?? [];
    existing.push(f);
    prefixMap.set(prefix, existing);
  }
  const allCollisions = [...prefixMap.entries()].filter(([, names]) => names.length > 1);
  if (allCollisions.length > 0) {
    const legacyCollisions = allCollisions.filter(([, names]) =>
      names.every(n => KNOWN_LEGACY_COLLISION_FILES.has(n)),
    );
    const newCollisions = allCollisions.filter(([, names]) =>
      names.some(n => !KNOWN_LEGACY_COLLISION_FILES.has(n)),
    );

    if (legacyCollisions.length > 0) {
      // Known legacy pairs — warn but do not block startup.
      const detail = legacyCollisions
        .map(([prefix, names]) => `  prefix ${prefix}: ${names.join(", ")}`)
        .join("\n");
      console.warn(
        `⚠️  [${label}] Migration numbering collisions detected (known legacy pairs — safe, tracked by full filename; see Task #201 to rename):\n${detail}`,
      );
    }

    if (newCollisions.length > 0) {
      const detail = newCollisions
        .map(([prefix, names]) => `  prefix ${prefix}: ${names.join(", ")}`)
        .join("\n");
      throw new Error(
        `Migration numbering collision detected — a new migration shares its numeric prefix with an existing file.\n${detail}\nRename the new file to use the next unused number before starting the application.`,
      );
    }
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
