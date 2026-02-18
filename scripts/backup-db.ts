import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const BACKUPS_DIR = path.resolve(process.cwd(), "backups");

function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
}

function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is not set.");
    console.error("Set it before running: export DATABASE_URL=postgresql://user:pass@host:port/dbname");
    process.exit(1);
  }

  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const timestamp = getTimestamp();
  const filename = `full-backup-${timestamp}.sql`;
  const filepath = path.join(BACKUPS_DIR, filename);

  console.log(`Starting full database backup...`);
  console.log(`Output: ${filepath}`);

  try {
    execSync(`pg_dump "${databaseUrl}" --no-owner --no-acl --if-exists --clean > "${filepath}"`, {
      stdio: ["pipe", "pipe", "inherit"],
      timeout: 120000,
    });

    const stats = fs.statSync(filepath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Backup completed successfully! (${sizeMB} MB)`);
    console.log(`File: ${filepath}`);
    console.log(`\nTo restore: psql "$DATABASE_URL" < "${filepath}"`);
  } catch (error: any) {
    console.error("Backup failed:", error.message);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    process.exit(1);
  }
}

main();
