import { z } from "zod";
import { and, asc, desc, eq, isNull, isNotNull, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { masterVessels } from "../../../../shared/schema";
import { rhVesselRecordsV2 } from "../../../../shared/v2/rest-hours/schema";
import type { ReportHandler } from "../types";
import type { ReportColumn } from "../../../../shared/v2/reports/types";
import { dateExpr, dateFilter, fullNameExpr, noSignOffExpr } from "./_shared";

const nameExpr = fullNameExpr(crewMembersV2.firstName, crewMembersV2.middleName, crewMembersV2.familyName);

// ============================================================
// vsl-crew-on-board : current crew on each vessel.
// ============================================================
const cobFilters = z
  .object({
    vessel: z.string().trim().min(1).optional(),
    rank: z.string().trim().min(1).optional(),
  })
  .strict();

const cobCols: ReportColumn[] = [
  { key: "vesselName", label: "Vessel", type: "text" },
  { key: "empNo", label: "Emp No", type: "text", width: 110 },
  { key: "name", label: "Name", type: "text" },
  { key: "rank", label: "Rank", type: "text" },
  { key: "signOnDate", label: "Sign On", type: "date", width: 130 },
  { key: "reliefDue", label: "Relief Due", type: "date", width: 130 },
];

export const crewOnBoardReport: ReportHandler<z.infer<typeof cobFilters>> = {
  reportId: "vsl-crew-on-board",
  title: "Crew on Board by Vessel",
  columns: cobCols,
  filterSchema: cobFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [
      eq(vesselPlanningV2.isDeleted, false),
      eq(vesselPlanningV2.isArchived, false),
      noSignOffExpr(vesselPlanningV2.signOffDate),
      isNotNull(vesselPlanningV2.crewUuid),
      eq(crewMembersV2.isDeleted, false),
    ];
    if (filters.vessel) conds.push(eq(masterVessels.vessel, filters.vessel));
    if (filters.rank) conds.push(eq(vesselPlanningV2.rank, filters.rank));
    const where = and(...conds);

    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(vesselPlanningV2)
      .innerJoin(crewMembersV2, eq(crewMembersV2.crewUuid, vesselPlanningV2.crewUuid))
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, vesselPlanningV2.vesselUuid))
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortMap: Record<string, PgColumn | SQL> = {
      vesselName: masterVessels.vessel,
      empNo: crewMembersV2.empNo,
      name: crewMembersV2.firstName,
      rank: vesselPlanningV2.rank,
      signOnDate: vesselPlanningV2.signOnDate,
      reliefDue: vesselPlanningV2.reliefDue,
    };
    const sortKey = ctx.sort?.key ?? "vesselName";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.vesselName);

    const rows = await db
      .select({
        vesselName: masterVessels.vessel,
        empNo: crewMembersV2.empNo,
        name: nameExpr,
        rank: vesselPlanningV2.rank,
        signOnDate: vesselPlanningV2.signOnDate,
        reliefDue: vesselPlanningV2.reliefDue,
      })
      .from(vesselPlanningV2)
      .innerJoin(crewMembersV2, eq(crewMembersV2.crewUuid, vesselPlanningV2.crewUuid))
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, vesselPlanningV2.vesselUuid))
      .where(where)
      .orderBy(order, asc(vesselPlanningV2.planUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        vesselName: r.vesselName ?? null,
        empNo: r.empNo ?? null,
        name: r.name ?? null,
        rank: r.rank ?? null,
        signOnDate: r.signOnDate ?? null,
        reliefDue: r.reliefDue ?? null,
      })),
    };
  },
};

// ============================================================
// vsl-manning-status : per vessel filled vs. vacant counts.
// ============================================================
const manningFilters = z.object({ vessel: z.string().trim().min(1).optional() }).strict();

const manningCols: ReportColumn[] = [
  { key: "vesselName", label: "Vessel", type: "text" },
  { key: "filled", label: "Filled", type: "number", align: "right", width: 100 },
  { key: "vacant", label: "Vacant", type: "number", align: "right", width: 100 },
  { key: "total", label: "Total Positions", type: "number", align: "right", width: 140 },
];

const filledExpr = sql<number>`COUNT(*) FILTER (WHERE ${vesselPlanningV2.crewUuid} IS NOT NULL)`;
const vacantExpr = sql<number>`COUNT(*) FILTER (WHERE ${vesselPlanningV2.crewUuid} IS NULL)`;
const totalExpr = sql<number>`COUNT(*)`;
const totalGroupsExpr = sql<number>`COUNT(*) OVER ()`;

export const vesselManningStatusReport: ReportHandler<z.infer<typeof manningFilters>> = {
  reportId: "vsl-manning-status",
  title: "Vessel Manning Status",
  columns: manningCols,
  filterSchema: manningFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [
      eq(vesselPlanningV2.isDeleted, false),
      eq(vesselPlanningV2.isArchived, false),
    ];
    if (filters.vessel) conds.push(eq(masterVessels.vessel, filters.vessel));
    const where = and(...conds);

    const sortKey = ctx.sort?.key ?? "vesselName";
    const orderFn = ctx.sort?.direction === "desc" ? desc : asc;
    const orderExpr =
      sortKey === "filled" ? orderFn(filledExpr)
      : sortKey === "vacant" ? orderFn(vacantExpr)
      : sortKey === "total" ? orderFn(totalExpr)
      : orderFn(masterVessels.vessel);

    const rows = await db
      .select({
        vesselName: masterVessels.vessel,
        filled: filledExpr,
        vacant: vacantExpr,
        total: totalExpr,
        totalGroups: totalGroupsExpr,
      })
      .from(vesselPlanningV2)
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, vesselPlanningV2.vesselUuid))
      .where(where)
      .groupBy(masterVessels.vessel)
      .orderBy(orderExpr)
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    const total = Number(rows[0]?.totalGroups ?? 0);
    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        vesselName: r.vesselName ?? null,
        filled: Number(r.filled),
        vacant: Number(r.vacant),
        total: Number(r.total),
      })),
    };
  },
};

// ============================================================
// vsl-vacancies : open positions per vessel & rank.
// ============================================================
const vacFilters = z
  .object({
    vessel: z.string().trim().min(1).optional(),
    rank: z.string().trim().min(1).optional(),
  })
  .strict();

const vacCols: ReportColumn[] = [
  { key: "vesselName", label: "Vessel", type: "text" },
  { key: "rank", label: "Rank", type: "text" },
  { key: "vacancies", label: "Vacancies", type: "number", align: "right", width: 110 },
];

const vacanciesExpr = sql<number>`COUNT(*)`;

export const vesselVacanciesReport: ReportHandler<z.infer<typeof vacFilters>> = {
  reportId: "vsl-vacancies",
  title: "Vacancies by Vessel",
  columns: vacCols,
  filterSchema: vacFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [
      eq(vesselPlanningV2.isDeleted, false),
      eq(vesselPlanningV2.isArchived, false),
      isNull(vesselPlanningV2.crewUuid),
    ];
    if (filters.vessel) conds.push(eq(masterVessels.vessel, filters.vessel));
    if (filters.rank) conds.push(eq(vesselPlanningV2.rank, filters.rank));
    const where = and(...conds);

    const sortKey = ctx.sort?.key ?? "vesselName";
    const orderFn = ctx.sort?.direction === "desc" ? desc : asc;
    const orderExpr =
      sortKey === "vacancies" ? orderFn(vacanciesExpr)
      : sortKey === "rank" ? orderFn(vesselPlanningV2.rank)
      : orderFn(masterVessels.vessel);

    const rows = await db
      .select({
        vesselName: masterVessels.vessel,
        rank: vesselPlanningV2.rank,
        vacancies: vacanciesExpr,
        totalGroups: totalGroupsExpr,
      })
      .from(vesselPlanningV2)
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, vesselPlanningV2.vesselUuid))
      .where(where)
      .groupBy(masterVessels.vessel, vesselPlanningV2.rank)
      .orderBy(orderExpr)
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    const total = Number(rows[0]?.totalGroups ?? 0);
    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        vesselName: r.vesselName ?? null,
        rank: r.rank ?? null,
        vacancies: Number(r.vacancies),
      })),
    };
  },
};

// ============================================================
// vsl-crew-changes : sign-on or sign-off events in a date range.
// ============================================================
const changesFilters = z
  .object({
    vessel: z.string().trim().min(1).optional(),
    dateFrom: dateFilter,
    dateTo: dateFilter,
  })
  .strict();

const changesCols: ReportColumn[] = [
  { key: "vesselName", label: "Vessel", type: "text" },
  { key: "empNo", label: "Emp No", type: "text", width: 110 },
  { key: "name", label: "Name", type: "text" },
  { key: "rank", label: "Rank", type: "text" },
  { key: "changeType", label: "Change Type", type: "text", width: 140 },
  { key: "signOnDate", label: "Sign On", type: "date", width: 130 },
  { key: "signOffDate", label: "Sign Off", type: "date", width: 130 },
];

const onDate = dateExpr(vesselPlanningV2.signOnDate);
const offDate = dateExpr(vesselPlanningV2.signOffDate);

export const vesselCrewChangesReport: ReportHandler<z.infer<typeof changesFilters>> = {
  reportId: "vsl-crew-changes",
  title: "Crew Changes by Vessel",
  columns: changesCols,
  filterSchema: changesFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [
      eq(vesselPlanningV2.isDeleted, false),
      isNotNull(vesselPlanningV2.crewUuid),
      eq(crewMembersV2.isDeleted, false),
    ];
    if (filters.vessel) conds.push(eq(masterVessels.vessel, filters.vessel));
    // Event-in-range: include rows where sign-on OR sign-off falls inside
    // the requested window. Using BETWEEN per event is correct; the previous
    // (>=from OR ...) AND (<=to OR ...) split could match rows with neither
    // event actually inside the window.
    // changeType label reuses the exact same checks that admit the row, so
    // the label can never disagree with the filtering. NULL (blank) when no
    // date filters are applied.
    let changeTypeExpr: SQL<string | null> = sql<string | null>`NULL`;
    const buildChangeType = (onIn: SQL, offIn: SQL) =>
      sql<string | null>`CASE
        WHEN ${onIn} AND ${offIn} THEN 'Sign On / Sign Off'
        WHEN ${onIn} THEN 'Sign On'
        WHEN ${offIn} THEN 'Sign Off'
      END`;
    if (filters.dateFrom && filters.dateTo) {
      const from = filters.dateFrom;
      const to = filters.dateTo;
      const onIn = sql`(${onDate} BETWEEN ${from}::date AND ${to}::date)`;
      const offIn = sql`(${offDate} BETWEEN ${from}::date AND ${to}::date)`;
      conds.push(sql`(${onIn} OR ${offIn})`);
      changeTypeExpr = buildChangeType(onIn, offIn);
    } else if (filters.dateFrom) {
      const from = filters.dateFrom;
      const onIn = sql`(${onDate} >= ${from}::date)`;
      const offIn = sql`(${offDate} >= ${from}::date)`;
      conds.push(sql`(${onIn} OR ${offIn})`);
      changeTypeExpr = buildChangeType(onIn, offIn);
    } else if (filters.dateTo) {
      const to = filters.dateTo;
      const onIn = sql`(${onDate} <= ${to}::date)`;
      const offIn = sql`(${offDate} <= ${to}::date)`;
      conds.push(sql`(${onIn} OR ${offIn})`);
      changeTypeExpr = buildChangeType(onIn, offIn);
    }
    const where = and(...conds);

    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(vesselPlanningV2)
      .innerJoin(crewMembersV2, eq(crewMembersV2.crewUuid, vesselPlanningV2.crewUuid))
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, vesselPlanningV2.vesselUuid))
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortMap: Record<string, PgColumn | SQL> = {
      vesselName: masterVessels.vessel,
      empNo: crewMembersV2.empNo,
      name: crewMembersV2.firstName,
      rank: vesselPlanningV2.rank,
      signOnDate: vesselPlanningV2.signOnDate,
      signOffDate: vesselPlanningV2.signOffDate,
    };
    const sortKey = ctx.sort?.key ?? "signOnDate";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.signOnDate);

    const rows = await db
      .select({
        vesselName: masterVessels.vessel,
        empNo: crewMembersV2.empNo,
        name: nameExpr,
        rank: vesselPlanningV2.rank,
        changeType: changeTypeExpr,
        signOnDate: vesselPlanningV2.signOnDate,
        signOffDate: vesselPlanningV2.signOffDate,
      })
      .from(vesselPlanningV2)
      .innerJoin(crewMembersV2, eq(crewMembersV2.crewUuid, vesselPlanningV2.crewUuid))
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, vesselPlanningV2.vesselUuid))
      .where(where)
      .orderBy(order, asc(vesselPlanningV2.planUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        vesselName: r.vesselName ?? null,
        empNo: r.empNo ?? null,
        name: r.name ?? null,
        rank: r.rank ?? null,
        changeType: r.changeType ?? null,
        signOnDate: r.signOnDate ?? null,
        signOffDate: r.signOffDate ?? null,
      })),
    };
  },
};

// ============================================================
// vsl-compliance-summary : per-vessel rest-hours review status.
// ============================================================
const vcsFilters = z.object({ vessel: z.string().trim().min(1).optional() }).strict();

const vcsCols: ReportColumn[] = [
  { key: "vesselName", label: "Vessel", type: "text" },
  { key: "monthValue", label: "Month", type: "text", width: 110 },
  { key: "recordingStatusPercent", label: "Recording %", type: "number", align: "right", width: 120 },
  { key: "totalViolations", label: "Violations", type: "number", align: "right", width: 110 },
  { key: "totalNCs", label: "NCs", type: "number", align: "right", width: 80 },
  { key: "vesselReviewStatus", label: "Vessel Review", type: "status", width: 130 },
  { key: "officeReviewStatus", label: "Office Review", type: "status", width: 130 },
];

export const vesselComplianceSummaryReport: ReportHandler<z.infer<typeof vcsFilters>> = {
  reportId: "vsl-compliance-summary",
  title: "Vessel Compliance Summary",
  columns: vcsCols,
  filterSchema: vcsFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [eq(rhVesselRecordsV2.isDeleted, false)];
    if (filters.vessel) conds.push(eq(masterVessels.vessel, filters.vessel));
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
        recordingStatusPercent: Number(r.recordingStatusPercent ?? 0),
        totalViolations: Number(r.totalViolations ?? 0),
        totalNCs: Number(r.totalNCs ?? 0),
        vesselReviewStatus: r.vesselReviewStatus ?? null,
        officeReviewStatus: r.officeReviewStatus ?? null,
      })),
    };
  },
};
