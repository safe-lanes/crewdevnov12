/**
 * One-time development cleanup for the soft-deleted Testing-form and its
 * orphaned active rank group. Commit this script before executing:
 *   NODE_ENV=development npx tsx scripts/remove-testing-form.ts --execute
 *
 * Never run from app startup or against production.
 */
import { Client } from "pg";

const FORM_UUID = "251bb396-decf-435f-844c-98da24868a04";
const RANK_GROUP_UUID = "73cb1ab8-3e6c-40f5-a38a-2ec55a5a245a";
const COMPANY_FIXTURE_UUID = "637b0d04-e6f1-4961-8fc4-e74009b56000";
const PROMOTION_FORM_UUID = "58154529-894c-42b9-90e0-c1799c62bec0";

async function main() {
  if (process.env.NODE_ENV !== "development" || process.argv.slice(2).join(" ") !== "--execute") {
    throw new Error("Requires NODE_ENV=development and --execute. No data was changed.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    transactionStarted = true;

    const forms = await client.query<{
      id: number; name: string; category: string; is_deleted: boolean; created_at: Date;
    }>(
      `SELECT id, name, category, is_deleted, created_at
       FROM adm_forms_v2 WHERE form_uuid = $1 FOR UPDATE`,
      [FORM_UUID],
    );
    const form = forms.rows[0];
    if (forms.rows.length !== 1 || form.id !== 7 || form.name !== "Testing-form" ||
        form.category !== "promotion" || form.is_deleted !== true ||
        form.created_at.toISOString() !== "2026-02-16T11:35:30.372Z") {
      throw new Error("Testing-form no longer matches the reviewed record. Nothing deleted.");
    }

    const groups = await client.query<{
      id: number; name: string; ranks: string; is_deleted: boolean; archived_at: Date | null;
    }>(
      `SELECT id, name, ranks, is_deleted, archived_at
       FROM adm_rank_groups_v2 WHERE form_id = $1 AND rg_uuid = $2 FOR UPDATE`,
      [form.id, RANK_GROUP_UUID],
    );
    const group = groups.rows[0];
    if (groups.rows.length !== 1 || group.id !== 35 || group.name !== "Test Rank" ||
        group.is_deleted !== false || group.archived_at !== null ||
        JSON.stringify(JSON.parse(group.ranks)) !== '["Master","Chief Officer"]') {
      throw new Error("Testing-form rank group no longer matches the reviewed record. Nothing deleted.");
    }
    const groupCount = await client.query<{ count: string }>(
      "SELECT count(*) FROM adm_rank_groups_v2 WHERE form_id = $1",
      [form.id],
    );
    const formCount = await client.query<{ count: string }>("SELECT count(*) FROM adm_forms_v2");
    if (Number(groupCount.rows[0].count) !== 1 || Number(formCount.rows[0].count) !== 8) {
      throw new Error("Form or rank-group inventory changed. Nothing deleted.");
    }

    // No version or form part should exist. The remaining checks cover all
    // known submission consumers, including the legacy integer appraisal pin.
    // Run immediately before the first DELETE, inside the same transaction.
    const references = await client.query<Record<string, string>>(
      `SELECT
        (SELECT count(*) FROM adm_form_versions_v2 WHERE form_id = $2 OR rank_group_id = $3) AS versions,
        (SELECT count(*) FROM frm_form_parts WHERE form_uuid = $1) AS parts,
        (SELECT count(*) FROM crew_briefing_submissions WHERE form_uuid = $1) AS briefings,
        (SELECT count(*) FROM crew_interview_submissions WHERE form_uuid = $1) AS interviews,
        (SELECT count(*) FROM crew_debriefing_submissions WHERE form_uuid = $1) AS debriefings,
        (SELECT count(*) FROM crew_briefing_submission_report WHERE form_uuid = $1) AS briefing_reports,
        (SELECT count(*) FROM appraisal_results_v2 WHERE form_uuid = $1 OR form_id_legacy = $2) AS appraisals`,
      [FORM_UUID, form.id, group.id],
    );
    console.log("Pre-delete references:", references.rows[0]);
    if (Object.values(references.rows[0]).some((count) => Number(count) !== 0)) {
      throw new Error("Testing-form acquired references. STOP: nothing was deleted.");
    }

    const deletedGroup = await client.query(
      "DELETE FROM adm_rank_groups_v2 WHERE id = $1 AND form_id = $2",
      [group.id, form.id],
    );
    const deletedForm = await client.query(
      "DELETE FROM adm_forms_v2 WHERE id = $1 AND form_uuid = $2",
      [form.id, FORM_UUID],
    );
    const remaining = await client.query<{ count: string }>("SELECT count(*) FROM adm_forms_v2");
    const retained = await client.query<{ form_uuid: string }>(
      "SELECT form_uuid FROM adm_forms_v2 WHERE form_uuid = ANY($1::text[])",
      [[COMPANY_FIXTURE_UUID, PROMOTION_FORM_UUID]],
    );
    if (deletedGroup.rowCount !== 1 || deletedForm.rowCount !== 1 ||
        Number(remaining.rows[0].count) !== 7 || retained.rows.length !== 2) {
      throw new Error("Unexpected deletion or remaining-form count; rolling back.");
    }
    await client.query("COMMIT");
    transactionStarted = false;
    console.log("Committed Testing-form and rank-group deletion; remaining forms:", remaining.rows[0].count);
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