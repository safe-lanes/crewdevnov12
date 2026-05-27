import { z } from "zod";
import { and, asc, desc, eq, gt, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../../db";
import { rhCrewRecordsV2, rhVesselRecordsV2 } from "../../../../shared/v2/rest-hours/schema";
import { masterVessels } from "../../../../shared/schema";
import type { ReportHandler } from "../types";
import type { ReportColumn } from "../../../../shared/v2/reports/types";
import { dateFilter } from "./_shared";

// month_value is text "YYYY-MM"; cast to a date for range filtering.
const monthAsDate = sql`to_date(${rhCrewRecordsV2.monthValue} || '-01', 'YYYY-MM-DD')`;
const vMonthAsDate = sql`to_date(${rhVesselRecordsV2.monthValue} || '-01', 'YYYY-MM-DD')`;

// ============================================================
// rh-violations : crew records with totalViolations > 0.
// ============================================================
const violFilters = z
  .object({
    vessel: z.string().trim().min(1).optional(),
    dateFrom: dateFilter,
    dateTo: dateFilter,
  })
  .strict();

const violCols: ReportColumn[] = [
  { key: "vesselName", label: "Vessel", type: "text" },
  { key: "monthValue", label: "Month", type: "text", width: 110 },
  { key: "name", label: "Name", type: "text" },
  { key: "rank", label: "Rank", type: "text" },
  { key: "totalViolations", label: "Violations", type: "number", align: "right", width: 110 },
  { key: "totalNCs", label: "NCs", type: "number", align: "right", width: 80 },
];

export const restHourViolationsReport: ReportHandler<z.infer<typeof violFilters>> = {
  reportId: "rh-violations",
  title: "Rest Hour Violations",
  columns: violCols,
  filterSchema: violFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [
      eq(rhCrewRecordsV2.isDeleted, false),
      gt(rhCrewRecordsV2.totalViolations, 0),
    ];
    if (filters.vessel) conds.push(eq(masterVessels.vessel, filters.vessel));
    if (filters.dateFrom) conds.push(sql`${monthAsDate} >= ${filters.dateFrom}::date`);
    if (filters.dateTo) conds.push(sql`${monthAsDate} <= ${filters.dateTo}::date`);
    const where = and(...conds);

    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(rhCrewRecordsV2)
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, rhCrewRecordsV2.vesselId))
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortMap: Record<string, PgColumn | SQL> = {
      vesselName: masterVessels.vessel,
      monthValue: rhCrewRecordsV2.monthValue,
      name: rhCrewRecordsV2.name,
      rank: rhCrewRecordsV2.rank,
      totalViolations: rhCrewRecordsV2.totalViolations,
      totalNCs: rhCrewRecordsV2.totalNCs,
    };
    const sortKey = ctx.sort?.key ?? "monthValue";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.monthValue);

    const rows = await db
      .select({
        vesselName: masterVessels.vessel,
        monthValue: rhCrewRecordsV2.monthValue,
        name: rhCrewRecordsV2.name,
        rank: rhCrewRecordsV2.rank,
        totalViolations: rhCrewRecordsV2.totalViolations,
        totalNCs: rhCrewRecordsV2.totalNCs,
      })
      .from(rhCrewRecordsV2)
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, rhCrewRecordsV2.vesselId))
      .where(where)
      .orderBy(order, asc(rhCrewRecordsV2.rhCrewRecordUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        vesselName: r.vesselName ?? null,
        monthValue: r.monthValue ?? null,
        name: r.name ?? null,
        rank: r.rank ?? null,
        totalViolations: Number(r.totalViolations ?? 0),
        totalNCs: Number(r.totalNCs ?? 0),
      })),
    };
  },
};

// ============================================================
// rh-compliance-summary : per-vessel-month totals from rh_vessel_records_v2.
// ============================================================
const compFilters = z
  .object({
    vessel: z.string().trim().min(1).optional(),
    dateFrom: dateFilter,
    dateTo: dateFilter,
  })
  .strict();

const compCols: ReportColumn[] = [
  { key: "vesselName", label: "Vessel", type: "text" },
  { key: "monthValue", label: "Month", type: "text", width: 110 },
  { key: "totalCrew", label: "Crew", type: "number", align: "right", width: 80 },
  { key: "recordingStatusPercent", label: "Recording %", type: "number", align: "right", width: 120 },
  { key: "totalViolations", label: "Violations", type: "number", align: "right", width: 110 },
  { key: "totalNCs", label: "NCs", type: "number", align: "right", width: 80 },
  { key: "vesselReviewStatus", label: "Vessel Review", type: "status", width: 130 },
  { key: "officeReviewStatus", label: "Office Review", type: "status", width: 130 },
];

export const restHourComplianceReport: ReportHandler<z.infer<typeof compFilters>> = {
  reportId: "rh-compliance-summary",
  title: "Rest Hour Compliance Summary",
  columns: compCols,
  filterSchema: compFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [eq(rhVesselRecordsV2.isDeleted, false)];
    if (filters.vessel) conds.push(eq(masterVessels.vessel, filters.vessel));
    if (filters.dateFrom) conds.push(sql`${vMonthAsDate} >= ${filters.dateFrom}::date`);
    if (filters.dateTo) conds.push(sql`${vMonthAsDate} <= ${filters.dateTo}::date`);
    const where = and(...conds);

    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(rhVesselRecordsV2)
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, rhVesselRecordsV2.vesselId))
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortMap: Record<string, PgColumn | SQL> = {
      vesselName: masterVessels.vessel,
      monthValue: rhVesselRecordsV2.monthValue,
      totalCrew: rhVesselRecordsV2.totalCrew,
      recordingStatusPercent: rhVesselRecordsV2.recordingStatusPercent,
      totalViolations: rhVesselRecordsV2.totalViolations,
      totalNCs: rhVesselRecordsV2.totalNCs,
      vesselReviewStatus: rhVesselRecordsV2.vesselReviewStatus,
      officeReviewStatus: rhVesselRecordsV2.officeReviewStatus,
    };
    const sortKey = ctx.sort?.key ?? "monthValue";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.monthValue);

    const rows = await db
      .select({
        vesselName: masterVessels.vessel,
        monthValue: rhVesselRecordsV2.monthValue,
        totalCrew: rhVesselRecordsV2.totalCrew,
        recordingStatusPercent: rhVesselRecordsV2.recordingStatusPercent,
        totalViolations: rhVesselRecordsV2.totalViolations,
        totalNCs: rhVesselRecordsV2.totalNCs,
        vesselReviewStatus: rhVesselRecordsV2.vesselReviewStatus,
        officeReviewStatus: rhVesselRecordsV2.officeReviewStatus,
      })
      .from(rhVesselRecordsV2)
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, rhVesselRecordsV2.vesselId))
      .where(where)
      .orderBy(order, asc(rhVesselRecordsV2.rhVesselUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        vesselName: r.vesselName ?? null,
        monthValue: r.monthValue ?? null,
        totalCrew: Number(r.totalCrew ?? 0),
        recordingStatusPercent: Number(r.recordingStatusPercent ?? 0),
        totalViolations: Number(r.totalViolations ?? 0),
        totalNCs: Number(r.totalNCs ?? 0),
        vesselReviewStatus: r.vesselReviewStatus ?? null,
        officeReviewStatus: r.officeReviewStatus ?? null,
      })),
    };
  },
};
