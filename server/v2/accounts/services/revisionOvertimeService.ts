import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  accWageScalesV2, accMonthlyTransactionsV2, accPayElementsV2,
  accEngagementsV2, accPortageBillsV2,
} from "../../../../shared/v2/accounts/schema";
import type { AccWageScaleV2 } from "../../../../shared/v2/accounts/types";
import { EngineReads } from "../engine/engineReads";
import { readApplicableWageValues } from "../engine/wageEngineService";

const editable = new Set(["open", "vessel_draft", "returned"]);

export async function applyRevisionOvertimeEffects(revision: AccWageScaleV2, auditUserUuid?: string) {
  if (!revision.effectiveFrom) throw new Error("Revision start is required");
  const db = getDb();
  const scales = await db.select().from(accWageScalesV2)
    .where(eq(accWageScalesV2.isDeleted, false));
  const ancestors = new Set<string>([revision.scaleUuid]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const scale of scales) {
      if (scale.supersededByScaleUuid && ancestors.has(scale.supersededByScaleUuid)
          && !ancestors.has(scale.scaleUuid)) {
        ancestors.add(scale.scaleUuid);
        grew = true;
      }
    }
  }
  const candidates = await db.select({
    txn: accMonthlyTransactionsV2, engagement: accEngagementsV2,
  }).from(accMonthlyTransactionsV2)
    .innerJoin(accEngagementsV2,
      eq(accEngagementsV2.engagementUuid, accMonthlyTransactionsV2.engagementUuid))
    .innerJoin(accPayElementsV2,
      eq(accPayElementsV2.payElementUuid, accMonthlyTransactionsV2.payElementUuid))
    .where(and(
      eq(accMonthlyTransactionsV2.isDeleted, false),
      eq(accEngagementsV2.isDeleted, false),
      eq(accPayElementsV2.isDeleted, false),
      eq(accPayElementsV2.status, "active"),
      eq(accPayElementsV2.category, "overtime_variable"),
      eq(accPayElementsV2.calcMethod, "rate_times_qty"),
      inArray(accEngagementsV2.wageScaleUuid, [...ancestors]),
      inArray(accEngagementsV2.status, ["active", "completed"]),
      inArray(accMonthlyTransactionsV2.status, ["draft", "submitted", "accepted"]),
      gte(accMonthlyTransactionsV2.period, revision.effectiveFrom.slice(0, 7)),
    ));
  const reads = new EngineReads();
  const frozen = new Set((await reads.findFrozenSettlements(
    [...new Set<string>(candidates.map((row: any) => row.engagement.engagementUuid))],
  )).map(row => row.engagementUuid));
  const blockers: Array<{ txnUuid: string; crewUuid: string; period: string; reason: string }> = [];
  const updates: Array<{ txn: any; rate: string; amount: string }> = [];
  const protections: any[] = [];
  for (const period of new Set<string>(candidates.map((row: any) => row.txn.period))) {
    const periodRows = candidates.filter((row: any) => row.txn.period === period);
    const engagements = [...new Map<string, any>(
      periodRows.map((row: any) => [row.engagement.engagementUuid, row.engagement]),
    ).values()];
    const values = await readApplicableWageValues(period, engagements);
    const portages = await db.select().from(accPortageBillsV2).where(and(
      eq(accPortageBillsV2.period, period), eq(accPortageBillsV2.isDeleted, false),
    ));
    for (const { txn, engagement } of periodRows) {
      const bills = portages.filter((row: any) =>
        row.vesselUuid === txn.vesselUuid || row.vesselUuid === engagement.vesselUuid);
      if (frozen.has(engagement.engagementUuid) ||
          bills.some((bill: any) => bill.isLocked || bill.status === "locked")) continue;
      const value = values.get(engagement.engagementUuid)!;
      if (!value.errors.length && value.scaleUuid !== revision.scaleUuid) continue;
      const fail = (reason: string) => blockers.push({
        txnUuid: txn.txnUuid, crewUuid: txn.crewUuid, period, reason,
      });
      if (txn.status === "draft") {
        if (bills.some((bill: any) => !editable.has(bill.status))) continue;
        if (txn.crewUuid !== engagement.crewUuid ||
            (txn.vesselUuid != null && txn.vesselUuid !== engagement.vesselUuid)) {
          fail("Overtime entry does not match its engagement");
          continue;
        }
        const rate = value.entries[txn.payElementUuid]?.rate;
        if (rate == null || !Number.isFinite(Number(rate))) {
          fail(value.errors.join("; ") || "Applicable overtime rate is missing");
        } else if (txn.qty == null || !Number.isFinite(Number(txn.qty))) {
          fail("Overtime hours are missing or invalid");
        } else {
          updates.push({ txn, rate, amount: (Number(txn.qty) * Number(rate)).toFixed(2) });
        }
      } else if (txn.rate == null || !Number.isFinite(Number(txn.rate))) {
        fail("Saved overtime rate is missing or invalid");
      } else {
        protections.push(txn);
      }
    }
  }
  if (blockers.length) {
    throw Object.assign(new Error("Resolve the affected overtime entries before activation."), {
      code: "OVERTIME_RATE_BLOCKERS", blockers,
    });
  }
  for (const { txn, rate, amount } of updates) {
    await db.update(accMonthlyTransactionsV2).set({
      rate, amount, updatedByUuid: auditUserUuid ?? null, updatedAt: new Date(),
    }).where(eq(accMonthlyTransactionsV2.txnUuid, txn.txnUuid));
  }
  for (const txn of protections) {
    await db.execute(sql`
      INSERT INTO acc_wage_revision_rate_protection_v2
        (txn_uuid, revision_scale_uuid, engagement_uuid, vessel_uuid,
         period, pay_element_uuid, currency, created_by_uuid)
      VALUES (${txn.txnUuid}, ${revision.scaleUuid}, ${txn.engagementUuid},
        ${txn.vesselUuid}, ${txn.period}, ${txn.payElementUuid},
        ${txn.currency}, ${auditUserUuid ?? null})
      ON CONFLICT (txn_uuid) DO UPDATE SET
        revision_scale_uuid = EXCLUDED.revision_scale_uuid,
        engagement_uuid = EXCLUDED.engagement_uuid,
        vessel_uuid = EXCLUDED.vessel_uuid,
        period = EXCLUDED.period,
        pay_element_uuid = EXCLUDED.pay_element_uuid,
        currency = EXCLUDED.currency,
        created_by_uuid = EXCLUDED.created_by_uuid
    `);
  }
  return { corrected: updates.length, protected: protections.length };
}
