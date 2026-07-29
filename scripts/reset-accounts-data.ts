/**
 * reset-accounts-data.ts
 * =========================================================
 * Wipes all Accounts module data for the tenant so that a
 * manual test run can start from a known clean state.
 *
 * TABLES CLEARED (DELETE, respecting FK child-before-parent order)
 * ----------------------------------------------------------------
 *   acc_settlement_adjustments_v2
 *   acc_settlement_approvals_v2
 *   acc_settlements_v2
 *   acc_portage_approvals_v2
 *   acc_portage_bills_v2
 *   acc_wage_ledger_v2
 *   acc_calculation_runs_v2
 *   acc_ctm_lines_v2
 *   acc_ctm_v2
 *   acc_bond_items_v2
 *   acc_advances_v2
 *   acc_allotments_v2
 *   acc_monthly_transactions_v2
 *   acc_engagement_pay_elements_v2
 *   acc_engagement_phases_v2
 *   acc_engagements_v2
 *   acc_cba_reference_v2
 *   acc_wage_scale_lines_v2
 *   acc_wage_scales_v2
 *   acc_pay_elements_v2
 *
 * acc_tenant_config_v2 is RESET to system defaults (not deleted).
 *
 * TABLES DELIBERATELY LEFT ALONE
 * --------------------------------
 *   crew_members_v2        (crew records — not owned by Accounts)
 *   crew_assignments       (vessel assignments)
 *   master_vessels         (vessel master)
 *   adm_company_ranks_v2   (rank master)
 *   master_nationalities   (nationality master)
 *   vessel_planning_v2     (rotation)
 *   Any role / permission / menu tables
 *
 * USAGE
 * ------
 *   npx tsx scripts/reset-accounts-data.ts --confirm
 *
 * The --confirm flag is required. The script also refuses to run
 * if NODE_ENV is "production".
 */

import { Pool, PoolClient } from "pg";

// ─── Safety guards ───────────────────────────────────────────────────────────

function checkSafety(): void {
  if (!process.argv.includes("--confirm")) {
    console.error(
      "\n⚠  SAFETY GUARD: pass --confirm to allow this destructive operation.\n" +
        "   npx tsx scripts/reset-accounts-data.ts --confirm\n",
    );
    process.exit(1);
  }

  const env = (process.env.NODE_ENV ?? "").toLowerCase();
  if (env === "production") {
    console.error(
      "\n🚫 REFUSED: NODE_ENV=production. This script must not run against a\n" +
        "   production database. Set NODE_ENV=development and try again.\n",
    );
    process.exit(1);
  }
}

// ─── Tables to clear (ordered child → parent) ────────────────────────────────

const CLEAR_TABLES = [
  "acc_settlement_adjustments_v2",
  "acc_settlement_approvals_v2",
  "acc_settlements_v2",
  "acc_portage_approvals_v2",
  "acc_portage_bills_v2",
  "acc_wage_ledger_v2",
  "acc_calculation_runs_v2",
  "acc_ctm_lines_v2",
  "acc_ctm_v2",
  "acc_bond_items_v2",
  "acc_advances_v2",
  "acc_allotments_v2",
  "acc_monthly_transactions_v2",
  "acc_engagement_pay_elements_v2",
  "acc_engagement_phases_v2",
  "acc_engagements_v2",
  "acc_cba_reference_v2",
  "acc_wage_scale_lines_v2",
  "acc_wage_scales_v2",
  "acc_pay_elements_v2",
] as const;

// ─── Tenant config defaults ───────────────────────────────────────────────────

// Reset to DB column defaults (matches acc_tenant_config_v2 schema).
// NOTE: preparation_mode resets to 'office_prepares' — the test script's
// Setup Phase A must explicitly change this to 'vessel_prepares'.
const CONFIG_DEFAULTS = `
  preparation_mode            = 'office_prepares',
  proration_basis             = 'thirty_day_month',
  day_inclusion_rule          = 'both_inclusive',
  functional_currency         = 'USD',
  fx_rate_policy              = 'month_end',
  employment_models_enabled   = NULL,
  auto_lock_on_approval       = true,
  max_allotment_percent       = NULL,
  gl_wages_payable_code       = NULL,
  seniority_basis             = 'rank_service_all_employers',
  allow_manual_seniority_anchor = true,
  extra_tab_1_enabled         = false,
  extra_tab_1_label           = NULL,
  extra_tab_1_pay_element_uuid = NULL,
  extra_tab_2_enabled         = false,
  extra_tab_2_label           = NULL,
  extra_tab_2_pay_element_uuid = NULL,
  settings                    = NULL,
  updated_at                  = now()
`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  checkSafety();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌  DATABASE_URL environment variable is not set.");
    process.exit(1);
  }

  console.log("\n🔴 Accounts data reset — starting\n");
  console.log("   NODE_ENV :", process.env.NODE_ENV ?? "(not set)");
  console.log("   Database :", connectionString.replace(/:[^:@]+@/, ":***@"));
  console.log("");

  const pool = new Pool({ connectionString });
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const summary: Array<{ table: string; deleted: number }> = [];

    // 1. Delete rows from all Accounts tables (child → parent).
    for (const table of CLEAR_TABLES) {
      const result = await client.query(`DELETE FROM ${table}`);
      const deleted = result.rowCount ?? 0;
      summary.push({ table, deleted });
      console.log(
        `   ${deleted > 0 ? "🗑 " : "  "}${table.padEnd(40)} ${deleted} rows deleted`,
      );
    }

    // 2. Reset tenant config to defaults (UPDATE, not DELETE).
    const configResult = await client.query(
      `UPDATE acc_tenant_config_v2 SET ${CONFIG_DEFAULTS}`,
    );
    const configRows = configResult.rowCount ?? 0;
    if (configRows === 0) {
      console.log("   ℹ️  acc_tenant_config_v2 — no row found; will be created on first Accounts page load.");
    } else {
      console.log(`   🔄 acc_tenant_config_v2 — reset to defaults (${configRows} row).`);
    }

    await client.query("COMMIT");

    // 3. Summary
    const totalDeleted = summary.reduce((sum, r) => sum + r.deleted, 0);
    console.log("\n─────────────────────────────────────────────────────────");
    console.log(`✅  Done. ${totalDeleted} rows deleted across ${CLEAR_TABLES.length} tables.`);
    console.log("   Tenant config reset to system defaults.");
    console.log(
      "   ⚠  preparation_mode is now 'office_prepares'.\n" +
        "      The test script Setup Phase A must set it to 'vessel_prepares'.\n",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌  Reset failed — transaction rolled back.");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
