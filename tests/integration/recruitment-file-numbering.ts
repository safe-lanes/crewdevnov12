// Development-only PostgreSQL check. Creates candidate-only synthetic rows and
// removes them in finally; no production data or schema changes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../../server/v2/db";
import { recruitmentCandidatesV2 as candidates } from "../../shared/v2/recruitment/schema";
import { CandidateRepository } from "../../server/v2/recruitment/repositories/candidateRepository";
import { candidateFingerprint, persistCandidate, writeCandidate } from "../../server/v2/recruitment/import/persistence";
import { nextRecruitmentFileNumber, recruitmentSubmissionDate } from "../../server/v2/recruitment/services/candidateNumbering";

async function main() {
  if (process.env.NODE_ENV !== "development") throw new Error("This check is development-only.");
  let db: any;
  for (let i = 0; i < 40; i++) {
    try { db = getDb(); break; } catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  if (!db) throw new Error("Database not ready.");
  const repo = new CandidateRepository();
  const suffix = randomUUID().replace(/[^a-f]/g, "");
  const parsed = (letter: string): any => ({
    isValid: true, data: { candidate: [{ firstName: `ExcelImportNumbering${letter}${suffix}`, familyName: "Test" }], address: [], documents: [] },
  });
  const a = parsed("A"), b = parsed("B"), rollback = parsed("Rollback");
  const manualUuid = randomUUID(), sameRowUuid = randomUUID(), createUuid = randomUUID();
  const tracked = [a, b, rollback].map(candidateFingerprint).concat(manualUuid, sameRowUuid, createUuid);
  try {
    const first = await nextRecruitmentFileNumber(db);
    const lastDash = first.lastIndexOf("-");
    const prefix = first.slice(0, lastDash + 1);
    const baseNumber = Number(first.slice(lastDash + 1));
    await assert.rejects(db.transaction(async (tx: any) => {
      await writeCandidate(tx, rollback, null);
      throw new Error("RollbackSentinel");
    }), /RollbackSentinel/);
    assert.equal((await db.select().from(candidates).where(eq(candidates.recCanUuid, candidateFingerprint(rollback)))).length, 0);
    assert.equal(await nextRecruitmentFileNumber(db), first, "Rollback must not reserve a number");
    await repo.create({ recCanUuid: manualUuid, firstName: `ExcelImportNumberingManual${suffix}`, familyName: "Test", status: "Draft" });
    const today = recruitmentSubmissionDate();
    const concurrent = await Promise.allSettled([
      persistCandidate(a, null), persistCandidate(b, null),
      repo.updateByUuid(manualUuid, { status: "Applied", fileNo: first, screeningDate: today }),
    ]);
    for (const result of concurrent) assert.equal(result.status, "fulfilled", "Concurrent import/submission must succeed");
    const rows = await db.select().from(candidates).where(inArray(candidates.recCanUuid, tracked));
    assert.equal(rows.length, 3);
    const numbers = rows.map((row: any) => Number(row.fileNo.slice(prefix.length))).sort((x: number, y: number) => x - y);
    assert.deepEqual(numbers, [baseNumber, baseNumber + 1, baseNumber + 2], "Concurrent writers must share the existing sequence");
    for (const row of rows) {
      assert.equal(row.status, "Applied");
      assert.equal(row.screeningDate, today);
    }
    const beforeDuplicate = await nextRecruitmentFileNumber(db);
    await assert.rejects(persistCandidate(a, null), /already imported/);
    assert.equal(await nextRecruitmentFileNumber(db), beforeDuplicate);
    const original = rows.find((row: any) => row.recCanUuid === candidateFingerprint(a));
    const preserved = await repo.updateByUuid(original.recCanUuid, { fileNo: `${prefix}9999`, screeningDate: "2099-01-01", status: "Applied" });
    assert.equal(preserved?.fileNo, original.fileNo);
    assert.equal(preserved?.screeningDate, today);
    const byId = await repo.update(original.id, { fileNo: null, screeningDate: null });
    assert.equal(byId?.fileNo, original.fileNo);
    assert.equal(byId?.screeningDate, today);
    await repo.create({ recCanUuid: sameRowUuid, firstName: `ExcelImportNumberingRepeat${suffix}`, familyName: "Test", status: "Draft" });
    const repeated = await Promise.allSettled([
      repo.updateByUuid(sameRowUuid, { screeningDate: today, status: "Applied" }),
      repo.updateByUuid(sameRowUuid, { screeningDate: "2099-01-01", status: "Applied" }),
    ]);
    for (const result of repeated) assert.equal(result.status, "fulfilled");
    const one = await repo.findByUuid(sameRowUuid);
    assert.equal(one?.fileNo, beforeDuplicate);
    const nextAfterRepeat = await nextRecruitmentFileNumber(db);
    assert.equal(Number(nextAfterRepeat.slice(prefix.length)), baseNumber + 4, "Same-row resubmission must allocate once");
    const created = await repo.create({ recCanUuid: createUuid, firstName: `ExcelImportNumberingCreate${suffix}`, familyName: "Test", status: "Applied", fileNo: first, screeningDate: today });
    assert.equal(created.fileNo, nextAfterRepeat, "Create must not trust a stale browser number");
    console.log(JSON.stringify({ success: true, continuedExistingSequence: true, concurrentImportAndSubmission: true, firstSubmissionPreserved: true, duplicateAndRollbackNoAllocation: true }));
  } finally {
    const rows = await db.select().from(candidates).where(inArray(candidates.recCanUuid, tracked));
    for (const row of rows) {
      if (!row.firstName?.startsWith("ExcelImportNumbering") || row.familyName !== "Test") throw new Error("Refusing to clean a non-synthetic candidate.");
    }
    await db.delete(candidates).where(inArray(candidates.recCanUuid, tracked));
    console.log("Removed only this check's candidate-only synthetic rows.");
  }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
