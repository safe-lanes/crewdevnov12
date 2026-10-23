import { readFile, unlink } from "node:fs/promises";
import { getDb } from "../../server/v2/db";
import { cleanupSyntheticImports } from "../helpers/recruitmentImportLifecycle";

async function main() {
  if (process.env.NODE_ENV !== "development") throw new Error("Cleanup is development-only.");
  const path = "/tmp/recruitment-reimport-uuids.json";
  const uuids = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(uuids) || !uuids.every(uuid => typeof uuid === "string")) throw new Error("Invalid cleanup list.");
  let db: any;
  for (let i = 0; i < 40; i++) {
    try { db = getDb(); break; } catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  if (!db) throw new Error("Database not ready.");
  await cleanupSyntheticImports(db, uuids);
  await unlink(path);
  console.log("Removed only this browser lifecycle check's synthetic applications and details.");
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
