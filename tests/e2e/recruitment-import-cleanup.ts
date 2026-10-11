import { readFile, unlink } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { getDb } from "../../server/v2/db";
import * as tables from "../../shared/v2/recruitment/schema";

async function main() {
  if (process.env.NODE_ENV !== "development") throw new Error("Cleanup is development-only.");
  const path = "/tmp/recruitment-browser-test-uuid.txt";
  const uuid = (await readFile(path, "utf8")).trim();
  if (!/^[a-f0-9-]{36}$/.test(uuid)) throw new Error("Invalid synthetic candidate UUID.");
  let db: any;
  for (let i = 0; i < 30; i++) {
    try { db = getDb(); break; } catch { await new Promise(r => setTimeout(r, 200)); }
  }
  if (!db) throw new Error("Database not ready.");
  await db.transaction(async (tx: any) => {
    const [candidate] = await tx.select().from(tables.recruitmentCandidatesV2).where(eq(tables.recruitmentCandidatesV2.recCanUuid, uuid));
    if (!candidate?.firstName?.startsWith("ExcelImport") || candidate.familyName !== "Test") throw new Error("Refusing to clean a non-smoke-test candidate.");
    for (const table of [
      tables.candAdditionalInfo, tables.candSeaService, tables.candTrainingCourses, tables.candLicenses, tables.candEducation,
      tables.candVisas, tables.candDocuments, tables.candNextOfKin, tables.candChildren, tables.candFamilyInfo,
      tables.candAddresses, tables.candPersonalDetails, tables.candVesselTypesApplied, tables.recruitmentCandidatesV2,
    ]) await tx.delete(table).where(eq(table.recCanUuid, uuid));
  });
  await unlink(path);
  console.log("Removed only the synthetic recruitment import candidate and its detail records.");
  process.exit(0);
}
main().catch(error => { console.error(error); process.exit(1); });
