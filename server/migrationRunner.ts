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

export async function runMigrations() {
  // Only run migrations if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.log("⏭️  Skipping migrations: DATABASE_URL not set (using file storage)");
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔄 Starting automatic database migrations...");

    // Create migrations tracking table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get list of already applied migrations
    const appliedResult = await pool.query<MigrationRecord>(
      "SELECT filename FROM schema_migrations ORDER BY filename"
    );
    const appliedMigrations = new Set(appliedResult.rows.map(row => row.filename));

    // Read migration files from migrations/ directory
    const migrationsDir = join(__dirname, "../migrations");
    const files = await readdir(migrationsDir);
    
    // Filter and sort SQL files (exclude documentation and scripts)
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Lexicographic order

    if (sqlFiles.length === 0) {
      console.log("✅ No migration files found");
      return;
    }

    // Track migrations to apply
    let appliedCount = 0;
    let skippedCount = 0;

    // Apply each migration that hasn't been applied yet
    for (const filename of sqlFiles) {
      if (appliedMigrations.has(filename)) {
        console.log(`⏭️  Skipping ${filename} (already applied)`);
        skippedCount++;
        continue;
      }

      console.log(`🔧 Applying migration: ${filename}`);

      const client = await pool.connect();
      try {
        // Read migration file
        const migrationPath = join(migrationsDir, filename);
        const migrationSQL = await readFile(migrationPath, "utf-8");
        
        let migrationHadNonFatalError = false;
        
        // Try to execute the migration in a transaction
        try {
          await client.query("BEGIN");
          await client.query(migrationSQL);
          await client.query("COMMIT");
        } catch (sqlError: any) {
          // Rollback the transaction
          await client.query("ROLLBACK");
          
          // Check if error is due to objects already existing (idempotent migrations)
          const errorCode = sqlError.code;
          const isAlreadyExistsError = 
            errorCode === '42P07' || // relation already exists
            errorCode === '42710' || // object already exists
            errorCode === '42P16' || // table already exists
            errorCode === '42723';   // duplicate operator
          
          if (isAlreadyExistsError) {
            // Objects already exist - this is OK for initial migration on existing database
            console.log(`   ℹ️  Some objects already exist (this is OK for existing databases)`);
            migrationHadNonFatalError = true;
          } else {
            // Re-throw other errors
            throw sqlError;
          }
        }

        // Record migration as applied (in a new transaction)
        await client.query("BEGIN");
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [filename]
        );
        await client.query("COMMIT");
        
        console.log(`✅ Successfully applied: ${filename}`);
        appliedCount++;
      } catch (error) {
        // Rollback on error (if transaction is still open)
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          // Ignore rollback errors (transaction might already be aborted)
        }
        console.error(`❌ Failed to apply migration ${filename}:`, error);
        throw new Error(`Migration failed: ${filename}. ${error}`);
      } finally {
        client.release();
      }
    }

    // Summary
    console.log("\n📊 Migration Summary:");
    console.log(`   ✅ Applied: ${appliedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📁 Total: ${sqlFiles.length}`);
    console.log("✅ Database migrations completed successfully!\n");

  } catch (error) {
    console.error("❌ Migration runner failed:", error);
    throw error; // Stop application startup if migrations fail
  } finally {
    await pool.end();
  }
}
