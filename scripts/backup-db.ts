import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function required(name: string): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required`); return value; }
function pgEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
  const url = new URL(databaseUrl);
  if (!url.protocol.startsWith("postgres")) throw new Error("BACKUP_DATABASE_URL must be PostgreSQL");
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: url.pathname.slice(1), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get("sslmode") || process.env.PGSSLMODE || "require" };
}
async function command(executable: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { env, stdio: ["ignore", "ignore", "inherit"], windowsHide: true });
    child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${executable} exited with code ${code}`)));
  });
}
async function sha256(file: string): Promise<string> { const hash = createHash("sha256"); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest("hex"); }

export async function createVaultBackup(): Promise<{ recoverySetUuid: string; objectKey: string; manifestKey: string }> {
  const databaseUrl = required("BACKUP_DATABASE_URL");
  const bucket = required("BACKUP_S3_BUCKET");
  const region = required("BACKUP_S3_REGION");
  const kmsKey = required("BACKUP_S3_KMS_KEY_ID");
  const retentionDays = Number(required("BACKUP_RETENTION_DAYS"));
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw new Error("BACKUP_RETENTION_DAYS must be between 1 and 3650");
  const recoverySetUuid = randomUUID();
  const tenantLabel = (process.env.BACKUP_TENANT_LABEL || "bff").replace(/[^a-zA-Z0-9_-]/g, "_");
  const prefix = (process.env.BACKUP_S3_PREFIX || "crew-bff").replace(/^\/+|\/+$/g, "");
  const work = await mkdtemp(path.join(tmpdir(), "sail-backup-"));
  const dump = path.join(work, "database.dump");
  const manifestFile = path.join(work, "manifest.json");
  try {
    await command(process.env.PG_DUMP_PATH || "pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", dump], pgEnvironment(databaseUrl));
    const info = await stat(dump); if (info.size === 0) throw new Error("pg_dump produced an empty backup");
    const checksumSha256 = await sha256(dump);
    const objectKey = `${prefix}/${tenantLabel}/${recoverySetUuid}/database.dump`;
    const manifestKey = `${prefix}/${tenantLabel}/${recoverySetUuid}/manifest.json`;
    const retainUntil = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
    const manifest = { version: 1, recoverySetUuid, tenantLabel, createdAt: new Date().toISOString(), databaseObjectKey: objectKey, checksumSha256, sizeBytes: info.size, format: "postgres-custom", encryption: "aws:kms", kmsKeyId: kmsKey, applicationVersion: process.env.APP_VERSION || "unknown", migrationVersion: process.env.MIGRATION_VERSION || "unknown", retentionClass: process.env.BACKUP_RETENTION_CLASS || "unapproved", retainUntil: retainUntil.toISOString() };
    await writeFile(manifestFile, JSON.stringify(manifest));
    const s3 = new S3Client({ region, endpoint: process.env.BACKUP_S3_ENDPOINT || undefined });
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: createReadStream(dump), ContentLength: info.size, ContentType: "application/octet-stream", ServerSideEncryption: "aws:kms", SSEKMSKeyId: kmsKey, ObjectLockMode: "COMPLIANCE", ObjectLockRetainUntilDate: retainUntil }));
    const manifestBody = await readFile(manifestFile);
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: manifestKey, Body: manifestBody, ContentType: "application/json", ServerSideEncryption: "aws:kms", SSEKMSKeyId: kmsKey, ObjectLockMode: "COMPLIANCE", ObjectLockRetainUntilDate: retainUntil }));
    console.info(JSON.stringify({ event: "backup_completed", recoverySetUuid, tenantLabel, sizeBytes: info.size, checksumSha256 }));
    return { recoverySetUuid, objectKey, manifestKey };
  } finally { await rm(work, { recursive: true, force: true }); }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) createVaultBackup().catch((error) => { console.error("Backup failed", { code: error?.code || "backup_failed", message: error?.message }); process.exitCode = 1; });
