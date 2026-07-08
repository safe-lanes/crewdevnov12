import { z } from "zod";
import { and, asc, desc, eq, isNotNull, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterVessels } from "../../../../shared/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import type { ReportHandler } from "../types";
import type { ReportColumn, ReportResultRow } from "../../../../shared/v2/reports/types";
import { dateExpr, fullNameExpr, noSignOffExpr } from "./_shared";

const nameExpr = fullNameExpr(crewMembersV2.firstName, crewMembersV2.middleName, crewMembersV2.familyName);
const reliefDueDate = dateExpr(vesselPlanningV2.reliefDue);

const baseCols: ReportColumn[] = [
  { key: "empNo", label: "Emp No", type: "text", width: 110 },
  { key: "name", label: "Name", type: "text" },
  { key: "presentRank", label: "Rank", type: "text" },
  { key: "vesselName", label: "Vessel", type: "text" },
  { key: "reliefDue", label: "Relief Due", type: "date", width: 140 },
];

const overdueCols: ReportColumn[] = [
  ...baseCols,
  { key: "daysOverdue", label: "Days Overdue", type: "number", align: "right", width: 130 },
];

const sortMap: Record<string, PgColumn | SQL> = {
  empNo: crewMembersV2.empNo,
  name: crewMembersV2.firstName,
  presentRank: vesselPlanningV2.rank,
  vesselName: masterVessels.vessel,
  reliefDue: reliefDueDate,
};

// ============================================================
// rot-overdue-relief : relief_due more than `byDays` days in the past.
// ============================================================
const overdueFilters = z
  .object({
    byDays: z.coerce.number().int().min(0).max(3650).default(0),
    rank: z.string().trim().min(1).optional(),
  })
  .strict();

export const rotationOverdueReliefReport: ReportHandler<z.infer<typeof overdueFilters>> = {
  reportId: "rot-overdue-relief",
  title: "Crew Overdue for Relief",
  columns: overdueCols,
  filterSchema: overdueFilters,
  async run(filters, ctx) {
    const db = getDb();
    const n = filters.byDays;
    const conds: SQL[] = [
      eq(vesselPlanningV2.isDeleted, false),
      eq(vesselPlanningV2.isArchived, false),
      noSignOffExpr(vesselPlanningV2.signOffDate),
      isNotNull(vesselPlanningV2.crewUuid),
      sql`${reliefDueDate} IS NOT NULL`,
      sql`${reliefDueDate} < CURRENT_DATE - (${n} || ' days')::interval`,
      eq(crewMembersV2.isDeleted, false),
    ];
    if (filters.rank) conds.push(eq(vesselPlanningV2.rank, filters.rank));
    const where = and(...conds);

    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(vesselPlanningV2)
      .innerJoin(crewMembersV2, eq(crewMembersV2.crewUuid, vesselPlanningV2.crewUuid))
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const daysOverdueExpr = sql<number>`(CURRENT_DATE - ${reliefDueDate})::int`;
    const sortKey = ctx.sort?.key ?? "reliefDue";
    const sortCol: PgColumn | SQL = sortKey === "daysOverdue" ? daysOverdueExpr : (sortMap[sortKey] ?? sortMap.reliefDue);
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortCol);

    const rows = await db
      .select({
        empNo: crewMembersV2.empNo,
        name: nameExpr,
        presentRank: vesselPlanningV2.rank,
        vesselName: masterVessels.vessel,
        reliefDue: vesselPlanningV2.reliefDue,
        daysOverdue: daysOverdueExpr,
      })
      .from(vesselPlanningV2)
      .innerJoin(crewMembersV2, eq(crewMembersV2.crewUuid, vesselPlanningV2.crewUuid))
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, vesselPlanningV2.vesselUuid))
      .where(where)
      .orderBy(order, asc(vesselPlanningV2.planUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    const mapped: ReportResultRow[] = rows.map((r: (typeof rows)[number]) => ({
      empNo: r.empNo ?? null,
      name: r.name ?? null,
      presentRank: r.presentRank ?? null,
      vesselName: r.vesselName ?? null,
      reliefDue: r.reliefDue ?? null,
      daysOverdue: Number(r.daysOverdue ?? 0),
    }));
    return { rows: mapped, total };
  },
};

// ============================================================
// rot-planned-reliefs : relief_due within next N days.
// ============================================================
const plannedFilters = z
  .object({
    withinDays: z.coerce.number().int().min(0).max(3650).default(30),
    vessel: z.string().trim().min(1).optional(),
  })
  .strict();

export const rotationPlannedReliefsReport: ReportHandler<z.infer<typeof plannedFilters>> = {
  reportId: "rot-planned-reliefs",
  title: "Planned Reliefs Within N Days",
  columns: baseCols,
  filterSchema: plannedFilters,
  async run(filters, ctx) {
    const db = getDb();
    const n = filters.withinDays;
    const conds: SQL[] = [
      eq(vesselPlanningV2.isDeleted, false),
      eq(vesselPlanningV2.isArchived, false),
      noSignOffExpr(vesselPlanningV2.signOffDate),
      isNotNull(vesselPlanningV2.crewUuid),
      sql`${reliefDueDate} IS NOT NULL`,
      sql`${reliefDueDate} BETWEEN CURRENT_DATE AND CURRENT_DATE + (${n} || ' days')::interval`,
      eq(crewMembersV2.isDeleted, false),
    ];
    if (filters.vessel) conds.push(eq(masterVessels.vessel, filters.vessel));
    const where = and(...conds);

    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(vesselPlanningV2)
      .innerJoin(crewMembersV2, eq(crewMembersV2.crewUuid, vesselPlanningV2.crewUuid))
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, vesselPlanningV2.vesselUuid))
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortKey = ctx.sort?.key ?? "reliefDue";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.reliefDue);

    const rows = await db
      .select({
        empNo: crewMembersV2.empNo,
        name: nameExpr,
        presentRank: vesselPlanningV2.rank,
        vesselName: masterVessels.vessel,
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
        empNo: r.empNo ?? null,
        name: r.name ?? null,
        presentRank: r.presentRank ?? null,
        vesselName: r.vesselName ?? null,
        reliefDue: r.reliefDue ?? null,
      })),
    };
  },
};
