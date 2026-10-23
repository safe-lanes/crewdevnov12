// Explicit development-only lifecycle check against PostgreSQL, with synthetic-only cleanup.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../../server/v2/db";
import { recruitmentCandidatesV2 as candidates, candAdditionalInfo } from "../../shared/v2/recruitment/schema";
import { CandidateRepository } from "../../server/v2/recruitment/repositories/candidateRepository";
import { candidateFingerprint, DuplicateImportError, persistCandidate, writeCandidate } from "../../server/v2/recruitment/import/persistence";
import { nextRecruitmentFileNumber, recruitmentSubmissionDate } from "../../server/v2/recruitment/services/candidateNumbering";
import { cleanupSyntheticImports, importSnapshot } from "../helpers/recruitmentImportLifecycle";

async function main() {
  if (process.env.NODE_ENV !== "development") throw new Error("This check is development-only.");
  let db: any;
  for (let i = 0; i < 40; i++) {
    try { db = getDb(); break; } catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  if (!db) throw new Error("Database not ready.");
  const repo = new CandidateRepository(), suffix = randomUUID().replace(/[^a-f]/g, "");
  const name = `ExcelImportLifecycle${suffix}`, otherName = `${name}Other`, minimalName = `${name}Minimal`;
  const data: any = { isValid: true, data: {
    candidate: [{ firstName: name, familyName: "Test", dob: "1990-01-01" }],
    personal: [{ heightCm: "180" }], address: [{ addressLine1: "Original address", email: `${suffix}@example.invalid` }],
    family: [{ maritalStatus: "Single" }], nok: [{ firstName: "Next" }], children: [{ firstName: "Child" }],
    vesselTypes: [{ vesselTypeUuid: "synthetic-vessel-type" }], documents: [{ documentName: "Passport", number: `REIMPORT${suffix}` }],
    visas: [{ serialNo: "Visa" }], education: [{ qualifications: "Degree" }],
    licenses: [{ certificateDocument: "License" }], training: [{ trainingCourse: "Safety" }],
    sea: [{ vesselName: "Synthetic Vessel", fromDate: "2021-01-01", toDate: "2021-04-01" }],
    additional: [{ information: "Notice", response: "Original" }],
  } };
  // Mirror the parser's row anchors for repeatable records.
  for (const rows of Object.values(data.data) as Record<string, string>[][]) {
    rows.forEach((row, index) => { row.__row = String(index); });
  }
  const history = new Map<string, any>();
  const get = async (uuid: string) => (await db.select().from(candidates).where(eq(candidates.recCanUuid, uuid)))[0];
  const archive = async (uuid: string) => {
    assert.equal(await repo.softDeleteByUuid(uuid), true);
    history.set(uuid, await importSnapshot(db, uuid));
    assert.equal(await repo.findByUuid(uuid), undefined);
  };
  const expectDuplicate = async (workbook: any) => {
    const before = await nextRecruitmentFileNumber(db);
    await assert.rejects(persistCandidate(workbook, null), DuplicateImportError);
    assert.equal(await nextRecruitmentFileNumber(db), before, "Duplicate must not allocate a File No");
  };
  try {
    const legacyUuid = await persistCandidate(data, null);
    assert.equal(legacyUuid, candidateFingerprint(data), "Legacy first-generation identity must remain compatible");
    // Make the synthetic old submission date distinct, then freeze its deleted history.
    await db.update(candidates).set({ screeningDate: "2021-02-03" }).where(eq(candidates.recCanUuid, legacyUuid));
    const old = await get(legacyUuid);
    await expectDuplicate(data);
    await archive(legacyUuid);
    const expectedNumber = await nextRecruitmentFileNumber(db);
    const simultaneous = await Promise.allSettled([persistCandidate(data, null), persistCandidate(data, null)]);
    const winners = simultaneous.filter(result => result.status === "fulfilled");
    const losers = simultaneous.filter(result => result.status === "rejected");
    assert.equal(winners.length, 1);
    assert.equal(losers.length, 1);
    assert(losers[0].status === "rejected" && losers[0].reason instanceof DuplicateImportError);
    let activeUuid = (winners[0] as PromiseFulfilledResult<string>).value;
    assert.notEqual(activeUuid, legacyUuid);
    const fresh = await get(activeUuid);
    assert.equal(fresh.fileNo, expectedNumber);
    assert.notEqual(fresh.fileNo, old.fileNo);
    assert.equal(fresh.screeningDate, recruitmentSubmissionDate());
    assert.equal(fresh.status, "Applied");
    const snapshot = await importSnapshot(db, activeUuid);
    for (const rows of Object.values(snapshot)) assert.equal(rows.length, 1, "Each of 14 imported groups gets its own row");
    assert.equal(snapshot.cand_addresses[0].addressLine1, "Original address");
    await expectDuplicate(data);

    const changed = structuredClone(data);
    changed.data.address[0].addressLine1 = "Edited workbook";
    await expectDuplicate(changed); // Active name/DOB despite changed fingerprint.
    changed.data.candidate[0].firstName = otherName;
    await expectDuplicate(changed); // Active email.
    changed.data.address[0].email = `other${suffix}@example.invalid`;
    await expectDuplicate(changed); // Active passport.
    await archive(activeUuid);

    const nextBeforeFailure = await nextRecruitmentFileNumber(db);
    await assert.rejects(db.transaction(async (tx: any) => writeCandidate({
      execute: (query: any) => tx.execute(query),
      select: (fields?: any) => tx.select(fields),
      insert: (table: any) => table === candAdditionalInfo
        ? { values: async () => { throw new Error("Late child failure"); } }
        : tx.insert(table),
    }, data, null)), /Late child failure/);
    assert.equal(await nextRecruitmentFileNumber(db), nextBeforeFailure, "Failed reimport must not reserve a number");
    for (const [uuid, frozen] of history) assert.deepEqual(await importSnapshot(db, uuid), frozen);

    // Edited workbook after deletion must not merge an omitted old family/child.
    const edited = structuredClone(data);
    edited.data.family = []; edited.data.children = [];
    edited.data.address[0].addressLine1 = "Edited after deletion";
    activeUuid = await persistCandidate(edited, null);
    const editedSnapshot = await importSnapshot(db, activeUuid);
    assert.equal(editedSnapshot.cand_addresses[0].addressLine1, "Edited after deletion");
    assert.equal(editedSnapshot.cand_family_info.length, 0);
    assert.equal(editedSnapshot.cand_children.length, 0);
    await expectDuplicate(edited);
    await archive(activeUuid);
    for (let i = 0; i < 3; i++) {
      activeUuid = await persistCandidate(data, null);
      await expectDuplicate(data);
      if (i < 2) await archive(activeUuid);
    }
    for (const [uuid, frozen] of history) assert.deepEqual(await importSnapshot(db, uuid), frozen, "Old history must remain unchanged");

    // Exact-workbook protection cannot rely on email, DOB or passport existing.
    const minimal: any = { isValid: true, data: { candidate: [{ firstName: minimalName, familyName: "Test" }], address: [], documents: [] } };
    const minimalOld = await persistCandidate(minimal, null);
    await archive(minimalOld);
    const minimalNew = await persistCandidate(minimal, null);
    assert.notEqual(minimalOld, minimalNew);
    await expectDuplicate(minimal);
    console.log(JSON.stringify({ success: true, legacyCompatible: true, all14GroupsFresh: true, repeatedCycles: true, simultaneousWinnerCount: 1, duplicateAndRollbackNoAllocation: true, deletedHistoryUnchanged: true }));
  } finally {
    const roots = await db.select({ uuid: candidates.recCanUuid }).from(candidates)
      .where(inArray(candidates.firstName, [name, otherName, minimalName]));
    await cleanupSyntheticImports(db, roots.map((row: any) => row.uuid));
    console.log("Removed only this lifecycle check's synthetic applications and details.");
  }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
