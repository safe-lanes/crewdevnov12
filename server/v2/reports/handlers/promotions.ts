import { z } from "zod";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { promotionReviewsV2, promoExecutionLedgerV2 } from "../../../../shared/v2/promotions/schema";
import type { ReportHandler } from "../types";
import type { ReportColumn } from "../../../../shared/v2/reports/types";
import { dateExpr, dateFilter, fullNameExpr } from "./_shared";

const nameExpr = fullNameExpr(crewMembersV2.firstName, crewMembersV2.middleName, crewMembersV2.familyName);

// ============================================================
// promo-approved-ytd : executed (completed) promotions.
// ============================================================
const promoFilters = z
  .object({
    rank: z.string().trim().min(1).optional(),
    dateFrom: dateFilter,
    dateTo: dateFilter,
  })
  .strict();

const promoCols: ReportColumn[] = [
  { key: "empNo", label: "Crew ID", type: "text", width: 110 },
  { key: "name", label: "Crew Name", type: "text" },
  { key: "presentRank", label: "Present Rank", type: "text" },
  { key: "promotedRank", label: "Promoted Rank", type: "text" },
  { key: "promotionDate", label: "Promotion Date", type: "date", width: 140 },
  { key: "vesselName", label: "Vessel Name", type: "text" },
  { key: "promotionType", label: "Promotion Type", type: "text", width: 180 },
];

const promoDateExpr = dateExpr(promotionReviewsV2.promotionDate);

// Vessel where the crew member was serving on the promotion date, derived
// from company sea-service periods (written automatically at sign-on).
const vesselNameExpr = sql<string>`(
  SELECT css.vessel_name
  FROM crew_sea_service css
  WHERE css.crew_uuid = ${crewMembersV2.crewUuid}
    AND css.is_deleted = false
    AND LOWER(COALESCE(css.service_type, '')) = 'company'
    AND ${dateExpr(sql`css.from_date`)} IS NOT NULL
    AND ${dateExpr(sql`css.from_date`)} <= ${promoDateExpr}
    AND (${dateExpr(sql`css.to_date`)} IS NULL OR ${dateExpr(sql`css.to_date`)} >= ${promoDateExpr})
  ORDER BY ${dateExpr(sql`css.from_date`)} DESC
  LIMIT 1
)`;

const promotionTypeExpr = sql<string>`CASE LOWER(TRIM(COALESCE(${promotionReviewsV2.promotionTiming}, '')))
  WHEN 'on-board' THEN 'Promoted Onboard'
  WHEN 'prior-joining' THEN 'Promoted Prior Joining'
  ELSE '' END`;

export const promoExecutedReport: ReportHandler<z.infer<typeof promoFilters>> = {
  reportId: "promo-approved-ytd",
  title: "Executed Promotions",
  columns: promoCols,
  filterSchema: promoFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [
      eq(promotionReviewsV2.isDeleted, false),
      sql`LOWER(TRIM(${promotionReviewsV2.status})) = 'completed'`,
      sql`NULLIF(TRIM(COALESCE(${promotionReviewsV2.promotionDate}, '')), '') IS NOT NULL`,
    ];
    if (filters.rank) conds.push(eq(promotionReviewsV2.promotionToRank, filters.rank));
    if (filters.dateFrom) conds.push(sql`${promoDateExpr} >= ${filters.dateFrom}::date`);
    if (filters.dateTo) conds.push(sql`${promoDateExpr} <= ${filters.dateTo}::date`);
    const where = and(...conds);

    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(promotionReviewsV2)
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortMap: Record<string, PgColumn | SQL> = {
      empNo: promotionReviewsV2.crewMemberId,
      name: crewMembersV2.firstName,
      presentRank: promoExecutionLedgerV2.fromRank,
      promotedRank: promotionReviewsV2.promotionToRank,
      promotionDate: promoDateExpr,
      vesselName: vesselNameExpr,
      promotionType: promotionTypeExpr,
    };
    const sortKey = ctx.sort?.key ?? "promotionDate";
    const sortDir = ctx.sort ? (ctx.sort.direction === "desc" ? desc : asc) : desc;
    const order = sortDir(sortMap[sortKey] ?? sortMap.promotionDate);

    const rows = await db
      .select({
        empNo: promotionReviewsV2.crewMemberId,
        name: nameExpr,
        presentRank: promoExecutionLedgerV2.fromRank,
        promotedRank: promotionReviewsV2.promotionToRank,
        promotionDate: promotionReviewsV2.promotionDate,
        vesselName: vesselNameExpr,
        promotionType: promotionTypeExpr,
      })
      .from(promotionReviewsV2)
      .leftJoin(crewMembersV2, eq(crewMembersV2.empNo, promotionReviewsV2.crewMemberId))
      .leftJoin(
        promoExecutionLedgerV2,
        and(
          eq(promoExecutionLedgerV2.reviewUuid, promotionReviewsV2.reviewUuid),
          eq(promoExecutionLedgerV2.isDeleted, false),
        ),
      )
      .where(where)
      .orderBy(order, asc(promotionReviewsV2.reviewUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        empNo: r.empNo ?? null,
        name: r.name ?? null,
        presentRank: r.presentRank ?? null,
        promotedRank: r.promotedRank ?? null,
        promotionDate: r.promotionDate ?? null,
        vesselName: r.vesselName ?? null,
        promotionType: r.promotionType ?? null,
      })),
    };
  },
};
