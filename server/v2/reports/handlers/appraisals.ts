import { z } from "zod";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../../db";
import { appraisalResultsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ReportHandler } from "../types";
import type { ReportColumn } from "../../../../shared/v2/reports/types";
import { dateExpr, dateFilter } from "./_shared";

const apprDate = dateExpr(appraisalResultsV2.appraisalDate);

// ============================================================
// appr-pending : status not in (completed, approved, closed).
// ============================================================
const pendingFilters = z
  .object({
    vessel: z.string().trim().min(1).optional(),
    rank: z.string().trim().min(1).optional(),
  })
  .strict();

const pendingCols: ReportColumn[] = [
  { key: "name", label: "Name", type: "text" },
  { key: "rank", label: "Rank", type: "text" },
  { key: "vessel", label: "Vessel", type: "text" },
  { key: "appraisalDate", label: "Appraisal Date", type: "date", width: 140 },
  { key: "status", label: "Status", type: "status", width: 130 },
];

export const apprPendingReport: ReportHandler<z.infer<typeof pendingFilters>> = {
  reportId: "appr-pending",
  title: "Pending Appraisals",
  columns: pendingCols,
  filterSchema: pendingFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [
      eq(appraisalResultsV2.isDeleted, false),
      sql`LOWER(COALESCE(${appraisalResultsV2.status}, '')) NOT IN ('completed', 'approved', 'closed', 'final')`,
    ];
    if (filters.vessel) conds.push(eq(appraisalResultsV2.vessel, filters.vessel));
    if (filters.rank) conds.push(eq(appraisalResultsV2.seafarersRank, filters.rank));
    const where = and(...conds);

    const totalRes = await db.select({ c: sql<number>`count(*)` }).from(appraisalResultsV2).where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortMap: Record<string, PgColumn | SQL> = {
      name: appraisalResultsV2.seafarersName,
      rank: appraisalResultsV2.seafarersRank,
      vessel: appraisalResultsV2.vessel,
      appraisalDate: apprDate,
      status: appraisalResultsV2.status,
    };
    const sortKey = ctx.sort?.key ?? "appraisalDate";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.appraisalDate);

    const rows = await db
      .select({
        name: appraisalResultsV2.seafarersName,
        rank: appraisalResultsV2.seafarersRank,
        vessel: appraisalResultsV2.vessel,
        appraisalDate: appraisalResultsV2.appraisalDate,
        status: appraisalResultsV2.status,
      })
      .from(appraisalResultsV2)
      .where(where)
      .orderBy(order, asc(appraisalResultsV2.appraisalUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        name: r.name ?? null,
        rank: r.rank ?? null,
        vessel: r.vessel ?? null,
        appraisalDate: r.appraisalDate ?? null,
        status: r.status ?? null,
      })),
    };
  },
};

// ============================================================
// appr-scores-summary : avg ratings grouped by rank.
// ============================================================
const scoresFilters = z
  .object({
    rank: z.string().trim().min(1).optional(),
    dateFrom: dateFilter,
    dateTo: dateFilter,
  })
  .strict();

const scoresCols: ReportColumn[] = [
  { key: "rank", label: "Rank", type: "text" },
  { key: "count", label: "Appraisals", type: "number", align: "right", width: 120 },
  { key: "avgOverall", label: "Avg Overall", type: "number", align: "right", width: 120 },
  { key: "avgCompetence", label: "Avg Competence", type: "number", align: "right", width: 150 },
  { key: "avgBehavioral", label: "Avg Behavioural", type: "number", align: "right", width: 150 },
];

const rankExpr = sql<string>`COALESCE(NULLIF(TRIM(${appraisalResultsV2.seafarersRank}), ''), '—')`;
const countExpr = sql<number>`COUNT(*)`;
const avgOverallExpr = sql<number>`ROUND(AVG(NULLIF(${appraisalResultsV2.overallRating}, '')::numeric), 2)`;
const avgCompetenceExpr = sql<number>`ROUND(AVG(NULLIF(${appraisalResultsV2.competenceRating}, '')::numeric), 2)`;
const avgBehavioralExpr = sql<number>`ROUND(AVG(NULLIF(${appraisalResultsV2.behavioralRating}, '')::numeric), 2)`;
const totalGroupsExpr = sql<number>`COUNT(*) OVER ()`;

export const apprScoresSummaryReport: ReportHandler<z.infer<typeof scoresFilters>> = {
  reportId: "appr-scores-summary",
  title: "Appraisal Scores Summary",
  columns: scoresCols,
  filterSchema: scoresFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [eq(appraisalResultsV2.isDeleted, false)];
    if (filters.rank) conds.push(eq(appraisalResultsV2.seafarersRank, filters.rank));
    if (filters.dateFrom) conds.push(sql`${apprDate} >= ${filters.dateFrom}::date`);
    if (filters.dateTo) conds.push(sql`${apprDate} <= ${filters.dateTo}::date`);
    const where = and(...conds);

    const sortKey = ctx.sort?.key ?? "rank";
    const orderFn = ctx.sort?.direction === "desc" ? desc : asc;
    const orderExpr =
      sortKey === "count" ? orderFn(countExpr)
      : sortKey === "avgOverall" ? orderFn(avgOverallExpr)
      : sortKey === "avgCompetence" ? orderFn(avgCompetenceExpr)
      : sortKey === "avgBehavioral" ? orderFn(avgBehavioralExpr)
      : orderFn(rankExpr);

    const rows = await db
      .select({
        rank: rankExpr,
        count: countExpr,
        avgOverall: avgOverallExpr,
        avgCompetence: avgCompetenceExpr,
        avgBehavioral: avgBehavioralExpr,
        totalGroups: totalGroupsExpr,
      })
      .from(appraisalResultsV2)
      .where(where)
      .groupBy(rankExpr)
      .orderBy(orderExpr)
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    const total = Number(rows[0]?.totalGroups ?? 0);
    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        rank: r.rank,
        count: Number(r.count),
        avgOverall: r.avgOverall == null ? null : Number(r.avgOverall),
        avgCompetence: r.avgCompetence == null ? null : Number(r.avgCompetence),
        avgBehavioral: r.avgBehavioral == null ? null : Number(r.avgBehavioral),
      })),
    };
  },
};
