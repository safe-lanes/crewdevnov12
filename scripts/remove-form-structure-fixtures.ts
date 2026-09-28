/**
 * One-time development-data cleanup for the twelve September 2026 form-structure
 * integration fixtures. Run explicitly with:
 *   NODE_ENV=development npx tsx scripts/remove-form-structure-fixtures.ts --execute
 *
 * Never run from an app startup hook or against production.
 */
import { Client } from "pg";

const FIXTURE_UUIDS = [
  "963ec7fc-798d-4198-a85b-3c2c3ad48bd3",
  "626b4431-4f74-4167-8cdf-1fdb276ac6bc",
  "81672603-cd27-4810-9d8e-735c7a9cd5ad",
  "599e3c10-ea94-4e17-b61a-5428fed897c8",
  "ded068ee-45fc-4b9a-88ff-fc86832a85c2",
  "0abaa175-580f-4f7d-89b3-91a2e6fc45fd",
  "3f4c8b42-31bb-42c2-a13d-abfefa8640b3",
  "bb6ed5a9-40c7-44bc-a1f6-841efefd2c5f",
  "2e83b265-1f6a-4875-b42b-208a3ea8d7fb",
  "5db36414-e100-4f61-9590-861509951a4e",
  "385dfdbe-3181-4ffd-8c7d-3cedfbcc7475",
  "d93f78dd-a98d-4f88-8ed6-9d634a4cf512",
] as const;

const PROTECTED_UUIDS = [
  "637b0d04-e6f1-4961-8fc4-e74009b56000", // Company Forms Regression Fixture
  "251bb396-decf-435f-844c-98da24868a04", // Testing-form: investigation only
];

type ReferenceCounts = Record<
  "briefings" | "interviews" | "debriefings" | "appraisals" | "promotions" | "answers" | "section_states",
  string
>;

async function main() {
  if (process.argv.slice(2).join(" ") !== "--execute" || process.env.NODE_ENV !== "development") {
    throw new Error("Requires --execute and NODE_ENV=development. No data was changed.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (FIXTURE_UUIDS.length !== 12 ||
    new Set(FIXTURE_UUIDS).size !== 12 ||
    FIXTURE_UUIDS.some((uuid) => PROTECTED_UUIDS.includes(uuid))) {
    throw new Error("Fixture allowlist is invalid.");
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    transactionStarted = true;
    const forms = await client.query<{
      id: number; form_uuid: string; name: string; category: string; created_at: Date;
    }>(
      `SELECT id, form_uuid, name, category, created_at
       FROM adm_forms_v2 WHERE form_uuid = ANY($1::text[]) ORDER BY id FOR UPDATE`,
      [FIXTURE_UUIDS],
    );
    if (forms.rows.length !== 12 || forms.rows.some((form) =>
      form.category !== "briefing" ||
      !(/^(Structure |Rank group copy )/.test(form.name)) ||
      form.created_at.toISOString().slice(0, 10) !== "2026-09-25"
    )) {
      throw new Error("Fixture inventory does not match the reviewed twelve forms. Nothing deleted.");
    }
    const versions = await client.query<{ id: number; fv_uuid: string }>(
      `SELECT id, fv_uuid FROM adm_form_versions_v2
       WHERE form_id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
      [forms.rows.map((form) => form.id)],
    );
    const formIds = forms.rows.map((form) => form.id);
    const formUuids = forms.rows.map((form) => form.form_uuid);
    const versionIds = versions.rows.map((version) => version.id);
    const versionUuids = versions.rows.map((version) => version.fv_uuid);

    // Check all known submission consumers, including legacy integer pins, and
    // form-engine child data before the first DELETE. Row locks above prevent
    // concurrent FK-backed submissions from referencing these forms/versions.
    const refs = await client.query<ReferenceCounts>(
      `WITH sections AS (
         SELECT section_uuid FROM frm_sections
         WHERE form_version_uuid = ANY($2::text[])
           OR form_part_uuid IN (SELECT form_part_uuid FROM frm_form_parts WHERE form_uuid = ANY($1::text[]))
       ), questions AS (
         SELECT question_uuid FROM frm_questions WHERE section_uuid IN (SELECT section_uuid FROM sections)
       )
       SELECT
         (SELECT count(*) FROM crew_briefing_submissions
           WHERE form_uuid = ANY($1::text[]) OR form_version_uuid = ANY($2::text[])) AS briefings,
         (SELECT count(*) FROM crew_interview_submissions
           WHERE form_uuid = ANY($1::text[]) OR form_version_uuid = ANY($2::text[])) AS interviews,
         (SELECT count(*) FROM crew_debriefing_submissions
           WHERE form_uuid = ANY($1::text[]) OR form_version_uuid = ANY($2::text[])) AS debriefings,
         (SELECT count(*) FROM appraisal_results_v2
           WHERE form_uuid = ANY($1::text[]) OR form_version_uuid = ANY($2::text[])
              OR form_version_id = ANY($3::int[]) OR form_id_legacy = ANY($4::int[])) AS appraisals,
         (SELECT count(*) FROM promotion_reviews_v2
           WHERE form_version_uuid = ANY($2::text[]) OR form_version_id = ANY($3::int[])) AS promotions,
         (SELECT count(*) FROM frm_answers WHERE question_uuid IN (SELECT question_uuid FROM questions)) AS answers,
         (SELECT count(*) FROM frm_section_states WHERE section_uuid IN (SELECT section_uuid FROM sections)) AS section_states`,
      [formUuids, versionUuids, versionIds, formIds],
    );
    const counts = refs.rows[0];
    console.log("Pre-delete references:", counts);
    if (Object.values(counts).some((count) => Number(count) !== 0)) {
      throw new Error("Fixture references appeared. STOP: no rows were deleted.");
    }

    const sections = `SELECT section_uuid FROM frm_sections
      WHERE form_version_uuid = ANY($2::text[])
         OR form_part_uuid IN (SELECT form_part_uuid FROM frm_form_parts WHERE form_uuid = ANY($1::text[]))`;
    const questions = `SELECT question_uuid FROM frm_questions WHERE section_uuid IN (${sections})`;
    const sets = `SELECT option_set_uuid FROM frm_option_sets WHERE form_version_uuid = ANY($1::text[])`;
    const removed: Record<string, number> = {};
    for (const [label, sql, args] of [
      ["questions", `DELETE FROM frm_questions WHERE question_uuid IN (${questions})`, [formUuids, versionUuids]],
      ["sections", `DELETE FROM frm_sections WHERE section_uuid IN (${sections})`, [formUuids, versionUuids]],
      ["options", `DELETE FROM frm_options WHERE option_set_uuid IN (${sets})`, [versionUuids]],
      ["option_sets", `DELETE FROM frm_option_sets WHERE option_set_uuid IN (${sets})`, [versionUuids]],
      ["version_owned_and_legacy_parts", `DELETE FROM frm_form_parts WHERE form_uuid = ANY($1::text[])`, [formUuids]],
      ["versions", `DELETE FROM adm_form_versions_v2 WHERE form_id = ANY($1::int[])`, [formIds]],
      ["rank_groups", `DELETE FROM adm_rank_groups_v2 WHERE form_id = ANY($1::int[])`, [formIds]],
      ["forms", `DELETE FROM adm_forms_v2 WHERE id = ANY($1::int[])`, [formIds]],
    ] as const) {
      const result = await client.query(sql, args);
      removed[label] = result.rowCount ?? 0;
    }
    if (removed.forms !== 12 || removed.versions !== versions.rows.length) {
      throw new Error("Deletion counts differ from the locked inventory; rolling back.");
    }
    const remaining = await client.query<{ count: string }>("SELECT count(*) FROM adm_forms_v2");
    const protectedForms = await client.query<{ count: string }>(
      "SELECT count(*) FROM adm_forms_v2 WHERE form_uuid = ANY($1::text[])",
      [PROTECTED_UUIDS],
    );
    if (Number(remaining.rows[0].count) !== 8 || Number(protectedForms.rows[0].count) !== 2) {
      throw new Error("Expected exactly eight remaining forms, including both protected forms; rolling back.");
    }
    await client.query("COMMIT");
    transactionStarted = false;
    console.log("Committed fixture cleanup:", removed, "remaining forms:", remaining.rows[0].count);
  } catch (error) {
    if (transactionStarted) await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});