import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("backup and restore automation boundaries", () => {
  const backup = readFileSync("scripts/backup-db.ts", "utf8");
  const restore = readFileSync("scripts/verify-backup-restore.ts", "utf8");
  it("does not put database credentials in a shell command", () => {
    expect(backup).toContain("PGPASSWORD"); expect(backup).toContain("spawn("); expect(backup).not.toContain('execSync(`pg_dump');
  });
  it("requires a KMS-encrypted private vault and checksum manifest", () => {
    for (const value of ["BACKUP_S3_BUCKET", "BACKUP_S3_KMS_KEY_ID", "checksumSha256", 'ServerSideEncryption: "aws:kms"']) expect(backup).toContain(value);
  });
  it("cleans temporary backup and restore material", () => {
    expect(backup).toContain("finally { await rm(work"); expect(restore).toContain("finally { await rm(work");
  });
  it("refuses unsafe restore targets and keeps ERP dispatch disabled", () => {
    expect(restore).toContain("RESTORE_CONFIRM_ISOLATED"); expect(restore).toContain('ERP_COMMAND_WORKER_ENABLED !== "false"'); expect(restore).toContain("Restore target must not be the source database");
  });
  it("verifies checksum, archive readability, restore success, and required tables", () => {
    for (const value of ["Backup checksum mismatch", '"--list"', '"--exit-on-error"', "to_regclass", "app_crew_erp_commands"]) expect(restore).toContain(value);
  });
});
