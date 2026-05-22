/**
 * One-time backfill: clear legacy `answer: "Yes"` defaults on rank-group
 * recommendation configs.
 *
 * Background: until Task #479, the admin Form Editor seeded the 4 built-in
 * F2 recommendations with `answer: "Yes"` (and its loaders silently
 * back-filled `"Yes"` whenever no answer was present). That default flowed
 * into every appraisal's F2 section as a pre-selected "Yes" even though the
 * admin never picked anything. The fix stops writing `"Yes"` going forward;
 * this script removes the stale `"Yes"` from existing configs so already-
 * configured rank groups behave like newly-created ones.
 *
 * Scope (deliberately narrow):
 *   - Tables: adm_rank_groups_v2.configuration AND adm_form_versions_v2.configuration
 *   - Only rows whose `question` exactly matches one of the 4 built-in baseline
 *     questions (see BASELINE_QUESTIONS below).
 *   - Only when `answer === "Yes"`.
 *   - Only when `isCustom !== true` (custom rows are always left untouched).
 *   - Promotion form / submitted appraisals are NOT touched.
 *
 * Safe to re-run (idempotent). Use --dry-run to preview.
 *
 * Usage:
 *   npx tsx server/scripts/backfillRecommendationAnswers.ts [--dry-run]
 */

import { getDb } from "../v2/db";
import { admRankGroupsV2, admFormVersionsV2 } from "../../shared/v2/admin/schema";
import { eq } from "drizzle-orm";

const BASELINE_QUESTIONS = new Set([
  "Recommended for continued service on board?",
  "Recommended for re-employment?",
  "Recommended for promotion?",
  "Career Development recommendations (If Any)?",
]);

interface ClearResult {
  changed: boolean;
  clearedCount: number;
  config: any;
}

function clearLegacyYes(configJson: string | null): ClearResult {
  if (!configJson) return { changed: false, clearedCount: 0, config: null };
  let config: any;
  try {
    config = typeof configJson === "string" ? JSON.parse(configJson) : configJson;
  } catch {
    return { changed: false, clearedCount: 0, config: null };
  }
  if (!config || !Array.isArray(config.recommendations)) {
    return { changed: false, clearedCount: 0, config };
  }
  let cleared = 0;
  for (const rec of config.recommendations) {
    if (!rec || typeof rec !== "object") continue;
    if (rec.isCustom === true) continue;
    const q = typeof rec.question === "string" ? rec.question : rec.recommendation;
    if (!q || !BASELINE_QUESTIONS.has(q)) continue;
    if (rec.answer === "Yes") {
      rec.answer = "";
      cleared++;
    }
  }
  return { changed: cleared > 0, clearedCount: cleared, config };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = getDb();
  if (!db) {
    console.error("❌ Database not available. Set DATABASE_URL.");
    process.exit(1);
  }

  console.log(`🔧 Backfill recommendation answers ${dryRun ? "(DRY RUN)" : ""}`);

  let totalRowsScanned = 0;
  let totalRowsUpdated = 0;
  let totalRecsCleared = 0;

  // 1) adm_rank_groups_v2.configuration (legacy runtime config)
  const rankGroups = await db.select().from(admRankGroupsV2);
  for (const rg of rankGroups) {
    totalRowsScanned++;
    const { changed, clearedCount, config } = clearLegacyYes(rg.configuration);
    if (!changed) continue;
    totalRowsUpdated++;
    totalRecsCleared += clearedCount;
    console.log(
      `  rank_group id=${rg.id} name="${rg.name}" — cleared ${clearedCount} recommendation(s)`
    );
    if (!dryRun) {
      await db
        .update(admRankGroupsV2)
        .set({ configuration: JSON.stringify(config), updatedAt: new Date() })
        .where(eq(admRankGroupsV2.id, rg.id));
    }
  }

  // 2) adm_form_versions_v2.configuration (versioned configs — what released
  //    appraisals actually load via getFormForRank).
  const versions = await db.select().from(admFormVersionsV2);
  for (const v of versions) {
    totalRowsScanned++;
    const { changed, clearedCount, config } = clearLegacyYes(v.configuration);
    if (!changed) continue;
    totalRowsUpdated++;
    totalRecsCleared += clearedCount;
    console.log(
      `  form_version id=${v.id} fvUuid=${v.fvUuid} versionNo=${v.versionNo} status=${v.status} — cleared ${clearedCount} recommendation(s)`
    );
    if (!dryRun) {
      await db
        .update(admFormVersionsV2)
        .set({ configuration: JSON.stringify(config), updatedAt: new Date() })
        .where(eq(admFormVersionsV2.id, v.id));
    }
  }

  console.log("");
  console.log(`✅ Scanned ${totalRowsScanned} config row(s).`);
  console.log(
    `   Updated ${totalRowsUpdated} row(s), cleared ${totalRecsCleared} legacy "Yes" answer(s).`
  );
  if (dryRun) {
    console.log(`   (dry-run — no changes written)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  });
