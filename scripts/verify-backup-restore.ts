import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Pool } from "pg";

const required = (name: string) => { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required`); return value; };
function pgEnv(databaseUrl: string): NodeJS.ProcessEnv { const url = new URL(databaseUrl); return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: url.pathname.slice(1), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get("sslmode") || "require" }; }
async function command(executable: string, args: string[], env: NodeJS.ProcessEnv) { await new Promise<void>((resolve, reject) => { const child = spawn(executable, args, { env, stdio: ["ignore", "ignore", "inherit"], windowsHide: true }); child.once("error", reject); child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${executable} exited with code ${code}`))); }); }
async function hash(file: string) { const digest = createHash("sha256"); for await (const chunk of createReadStream(file)) digest.update(chunk); return digest.digest("hex"); }

export async function verifyBackupRestore() {
  if (process.env.RESTORE_CONFIRM_ISOLATED !== "YES") throw new Error("RESTORE_CONFIRM_ISOLATED=YES is required");
  if (process.env.ERP_COMMAND_WORKER_ENABLED !== "false") throw new Error("ERP_COMMAND_WORKER_ENABLED=false is required during restore verification");
  const targetUrl = required("RESTORE_DATABASE_URL");
  if (process.env.DATABASE_URL && new URL(targetUrl).href === new URL(process.env.DATABASE_URL).href) throw new Error("Restore target must not be the source database");
  const bucket = required("BACKUP_S3_BUCKET"); const region = required("BACKUP_S3_REGION"); const manifestKey = required("RESTORE_MANIFEST_KEY");
  const s3 = new S3Client({ region, endpoint: process.env.BACKUP_S3_ENDPOINT || undefined });
  const manifestResponse = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: manifestKey }));
  if (!manifestResponse.Body) throw new Error("Backup manifest is missing");
  const manifest = JSON.parse(await manifestResponse.Body.transformToString());
  if (manifest.version !== 1 || !manifest.databaseObjectKey || !/^[a-f0-9]{64}$/.test(manifest.checksumSha256)) throw new Error("Backup manifest is invalid");
  const work = await mkdtemp(path.join(tmpdir(), "sail-restore-")); const dump = path.join(work, "database.dump");
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: manifest.databaseObjectKey }));
    if (!object.Body) throw new Error("Backup object is missing");
    await pipeline(object.Body as NodeJS.ReadableStream, createWriteStream(dump));
    if (await hash(dump) !== manifest.checksumSha256) throw new Error("Backup checksum mismatch");
    const executable = process.env.PG_RESTORE_PATH || "pg_restore";
    await command(executable, ["--list", dump], process.env);
    await command(executable, ["--exit-on-error", "--no-owner", "--no-acl", "--clean", "--if-exists", dump], pgEnv(targetUrl));
    const pool = new Pool({ connectionString: targetUrl });
    try {
      const requiredTables = ["app_crew_credentials", "app_crew_refresh_tokens", "app_crew_pending_changes", "app_crew_erp_commands", "app_crew_privacy_requests"];
      for (const table of requiredTables) { const result = await pool.query("SELECT to_regclass($1) AS name", [table]); if (!result.rows[0]?.name) throw new Error(`Restored table missing: ${table}`); }
    } finally { await pool.end(); }
    const exerciseUuid = randomUUID(); console.info(JSON.stringify({ event: "restore_verified", exerciseUuid, recoverySetUuid: manifest.recoverySetUuid, target: "isolated", checksumVerified: true }));
    return { exerciseUuid, recoverySetUuid: manifest.recoverySetUuid };
  } finally { await rm(work, { recursive: true, force: true }); }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) verifyBackupRestore().catch((error) => { console.error("Restore verification failed", { code: error?.code || "restore_failed", message: error?.message }); process.exitCode = 1; });
