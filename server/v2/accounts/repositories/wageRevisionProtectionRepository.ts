import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import type { AccMonthlyTransactionV2 } from "../../../../shared/v2/accounts/types";

export async function protectedTxnUuids(txns: AccMonthlyTransactionV2[]): Promise<Set<string>> {
  if (!txns.length) return new Set();
  const ids = sql.join(txns.map(t => sql`${t.txnUuid}`), sql`, `);
  const result = await getDb().execute(sql`
    SELECT t.txn_uuid FROM acc_monthly_transactions_v2 t
    JOIN acc_wage_revision_rate_protection_v2 p ON p.txn_uuid = t.txn_uuid
      AND p.engagement_uuid = t.engagement_uuid
      AND p.vessel_uuid IS NOT DISTINCT FROM t.vessel_uuid
      AND p.period = t.period AND p.pay_element_uuid = t.pay_element_uuid
      AND p.currency = t.currency
    WHERE t.is_deleted = false AND t.txn_uuid IN (${ids})
  `);
  return new Set<string>(result.rows.map((r: any) => String(r.txn_uuid)));
}
