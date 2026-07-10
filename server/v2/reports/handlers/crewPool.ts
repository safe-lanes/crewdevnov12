import { z } from "zod";
import { and, asc, desc, eq, isNull, isNotNull, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterNationalities, masterVessels } from "../../../../shared/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import type { ReportHandler } from "../types";
import type { ReportColumn, ReportResultRow } from "../../../../shared/v2/reports/types";
import { dateExpr, dateFilter, fullNameExpr, noSignOffExpr } from "./_shared";

const baseCrewConditions = (): SQL[] => [
  eq(crewMembersV2.isDeleted, false),
  isNull(crewMembersV2.archivedAt),
];

const currentVesselNameExpr = sql<string | null>`(
  SELECT master_vessels.vessel
  FROM vessel_planning_v2
  LEFT JOIN master_vessels
    ON master_vessels.vessel_uuid = vessel_planning_v2.vessel_uuid
  WHERE vessel_planning_v2.crew_uuid = crew_members_v2.crew_uuid
    AND vessel_planning_v2.is_deleted = FALSE
    AND vessel_planning_v2.is_archived = FALSE
    AND NULLIF(vessel_planning_v2.sign_off_date, '') IS NULL
  LIMIT 1
)`;

const currentPlanRankExpr = sql<string | null>`(
  SELECT vessel_planning_v2.rank
  FROM vessel_planning_v2
  WHERE vessel_planning_v2.crew_uuid = crew_members_v2.crew_uuid
    AND vessel_planning_v2.is_deleted = FALSE
    AND vessel_planning_v2.is_archived = FALSE
    AND NULLIF(vessel_planning_v2.sign_off_date, '') IS NULL
  LIMIT 1
)`;

const currentReliefDueExpr = sql<string | null>`(
  SELECT vessel_planning_v2.relief_due
  FROM vessel_planning_v2
  WHERE vessel_planning_v2.crew_uuid = crew_members_v2.crew_uuid
    AND vessel_planning_v2.is_deleted = FALSE
    AND vessel_planning_v2.is_archived = FALSE
    AND NULLIF(vessel_planning_v2.sign_off_date, '') IS NULL
  LIMIT 1
)`;

const nameExpr = fullNameExpr(crewMembersV2.firstName, crewMembersV2.middleName, crewMembersV2.familyName);

// ============================================================
// cp-on-leave : Active crew with no current vessel assignment.
// ============================================================
const onLeaveFilters = z.object({
  rank: z.string().trim().min(1).optional(),
  nationality: z.string().trim().min(1).optional(),
}).strict();
const onLeaveCols: ReportColumn[] = [
  { key: "empNo", label: "Emp No", type: "text", width: 110 },
  { key: "name", label: "Name", type: "text" },
  { key: "presentRank", label: "Rank", type: "text" },
  { key: "nationalityName", label: "Nationality", type: "text" },
  { key: "nextAvailability", label: "Next Available", type: "date", width: 140 },
];
const onLeaveSort: Record<string, PgColumn | SQL> = {
  empNo: crewMembersV2.empNo,
  name: crewMembersV2.firstName,
  presentRank: crewMembersV2.presentRank,
  nationalityName: masterNationalities.nationality,
  nextAvailability: crewMembersV2.nextAvailability,
};

export const crewOnLeaveReport: ReportHandler<z.infer<typeof onLeaveFilters>> = {
  reportId: "cp-on-leave",
  title: "Crew on Leave",
  columns: onLeaveCols,
  filterSchema: onLeaveFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [
      ...baseCrewConditions(),
      eq(crewMembersV2.status, 'On Leave'),
    ];
    if (filters.rank) conds.push(eq(crewMembersV2.presentRank, filters.rank));
    if (filters.nationality) conds.push(eq(masterNationalities.nationality, filters.nationality));

    const where = and(...conds);
    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(crewMembersV2)
      .leftJoin(masterNationalities, eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid))
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortKey = ctx.sort?.key ?? "empNo";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(onLeaveSort[sortKey] ?? onLeaveSort.empNo);

    const rows = await db
      .select({
        empNo: crewMembersV2.empNo,
        name: nameExpr,
        presentRank: crewMembersV2.presentRank,
        nationalityName: masterNationalities.nationality,
        nextAvailability: crewMembersV2.nextAvailability,
      })
      .from(crewMembersV2)
      .leftJoin(masterNationalities, eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid))
      .where(where)
      .orderBy(order, asc(crewMembersV2.crewUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    const mapped: ReportResultRow[] = rows.map((r: (typeof rows)[number]) => ({
      empNo: r.empNo ?? null,
      name: r.name ?? null,
      presentRank: r.presentRank ?? null,
      nationalityName: r.nationalityName ?? null,
      nextAvailability: r.nextAvailability ?? null,
    }));
    return { rows: mapped, total };
  },
};

// ============================================================
// cp-available-to-join : nextAvailability within N days.
// ============================================================
const availFilters = z
  .object({
    rank: z.string().trim().min(1).optional(),
    withinDays: z.coerce.number().int().min(0).max(3650).default(30),
  })
  .strict();

export const crewAvailableToJoinReport: ReportHandler<z.infer<typeof availFilters>> = {
  reportId: "cp-available-to-join",
  title: "Crew Available to Join",
  columns: onLeaveCols,
  filterSchema: availFilters,
  async run(filters, ctx) {
    const db = getDb();
    const n = filters.withinDays;
    const conds: SQL[] = [
      ...baseCrewConditions(),
      eq(crewMembersV2.isActive, true),
      sql`${currentVesselNameExpr} IS NULL`,
      sql`${dateExpr(crewMembersV2.nextAvailability)} IS NOT NULL`,
      sql`${dateExpr(crewMembersV2.nextAvailability)} <= CURRENT_DATE + (${n} || ' days')::interval`,
    ];
    if (filters.rank) conds.push(eq(crewMembersV2.presentRank, filters.rank));
    const where = and(...conds);

    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(crewMembersV2)
      .leftJoin(masterNationalities, eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid))
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortKey = ctx.sort?.key ?? "nextAvailability";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(onLeaveSort[sortKey] ?? onLeaveSort.empNo);

    const rows = await db
      .select({
        empNo: crewMembersV2.empNo,
        name: nameExpr,
        presentRank: crewMembersV2.presentRank,
        nationalityName: masterNationalities.nationality,
        nextAvailability: crewMembersV2.nextAvailability,
      })
      .from(crewMembersV2)
      .leftJoin(masterNationalities, eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid))
      .where(where)
      .orderBy(order, asc(crewMembersV2.crewUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        empNo: r.empNo ?? null,
        name: r.name ?? null,
        presentRank: r.presentRank ?? null,
        nationalityName: r.nationalityName ?? null,
        nextAvailability: r.nextAvailability ?? null,
      })),
    };
  },
};

// ============================================================
// cp-terminated : isActive = false (excluding deleted).
// ============================================================
const termFilters = z
  .object({
    rank: z.string().trim().min(1).optional(),
    dateFrom: dateFilter,
    dateTo: dateFilter,
  })
  .strict();

const termCols: ReportColumn[] = [
  { key: "empNo", label: "Emp No", type: "text", width: 110 },
  { key: "name", label: "Name", type: "text" },
  { key: "presentRank", label: "Rank", type: "text" },
  { key: "status", label: "Status", type: "status", width: 130 },
  { key: "terminatedAt", label: "Terminated", type: "date", width: 140 },
];

export const crewTerminatedReport: ReportHandler<z.infer<typeof termFilters>> = {
  reportId: "cp-terminated",
  title: "Terminated Crew",
  columns: termCols,
  filterSchema: termFilters,
  async run(filters, ctx) {
    const db = getDb();
    const archivedDate = sql<string | null>`to_char(${crewMembersV2.archivedAt}, 'YYYY-MM-DD')`;
    const updatedDate = sql<string | null>`to_char(${crewMembersV2.updatedAt}, 'YYYY-MM-DD')`;
    const terminatedAtExpr = sql<string | null>`COALESCE(${archivedDate}, ${updatedDate})`;

    const conds: SQL[] = [
      eq(crewMembersV2.isDeleted, false),
      eq(crewMembersV2.isActive, false),
      sql`${crewMembersV2.status} ILIKE 'Terminated%'`,
    ];
    if (filters.rank) conds.push(eq(crewMembersV2.presentRank, filters.rank));
    if (filters.dateFrom) conds.push(sql`COALESCE(${crewMembersV2.archivedAt}, ${crewMembersV2.updatedAt}) >= ${filters.dateFrom}::date`);
    if (filters.dateTo) conds.push(sql`COALESCE(${crewMembersV2.archivedAt}, ${crewMembersV2.updatedAt}) <= (${filters.dateTo}::date + INTERVAL '1 day')`);
    const where = and(...conds);

    const totalRes = await db.select({ c: sql<number>`count(*)` }).from(crewMembersV2).where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortMap: Record<string, PgColumn | SQL> = {
      empNo: crewMembersV2.empNo,
      name: crewMembersV2.firstName,
      presentRank: crewMembersV2.presentRank,
      status: crewMembersV2.status,
      terminatedAt: terminatedAtExpr,
    };
    const sortKey = ctx.sort?.key ?? "terminatedAt";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.empNo);

    const rows = await db
      .select({
        empNo: crewMembersV2.empNo,
        name: nameExpr,
        presentRank: crewMembersV2.presentRank,
        status: crewMembersV2.status,
        terminatedAt: terminatedAtExpr,
      })
      .from(crewMembersV2)
      .where(where)
      .orderBy(order, asc(crewMembersV2.crewUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        empNo: r.empNo ?? null,
        name: r.name ?? null,
        presentRank: r.presentRank ?? null,
        status: r.status ?? "Terminated",
        terminatedAt: r.terminatedAt ?? null,
      })),
    };
  },
};

// ============================================================
// cp-not-for-rehire : status flagged as not-for-rehire/blacklist.
// ============================================================
const nfrFilters = z
  .object({
    rank: z.string().trim().min(1).optional(),
    nationality: z.string().trim().min(1).optional(),
  })
  .strict();

const nfrCols: ReportColumn[] = [
  { key: "empNo", label: "Emp No", type: "text", width: 110 },
  { key: "name", label: "Name", type: "text" },
  { key: "presentRank", label: "Rank", type: "text" },
  { key: "nationalityName", label: "Nationality", type: "text" },
  { key: "status", label: "Status", type: "status", width: 160 },
];

export const crewNotForRehireReport: ReportHandler<z.infer<typeof nfrFilters>> = {
  reportId: "cp-not-for-rehire",
  title: "Not-for-Rehire List",
  columns: nfrCols,
  filterSchema: nfrFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [
      eq(crewMembersV2.isDeleted, false),
      eq(crewMembersV2.notForHire, true),
    ];
    if (filters.rank) conds.push(eq(crewMembersV2.presentRank, filters.rank));
    if (filters.nationality) conds.push(eq(masterNationalities.nationality, filters.nationality));
    const where = and(...conds);

    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(crewMembersV2)
      .leftJoin(masterNationalities, eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid))
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortMap: Record<string, PgColumn | SQL> = {
      empNo: crewMembersV2.empNo,
      name: crewMembersV2.firstName,
      presentRank: crewMembersV2.presentRank,
      nationalityName: masterNationalities.nationality,
      status: crewMembersV2.status,
    };
    const sortKey = ctx.sort?.key ?? "empNo";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.empNo);

    const rows = await db
      .select({
        empNo: crewMembersV2.empNo,
        name: nameExpr,
        presentRank: crewMembersV2.presentRank,
        nationalityName: masterNationalities.nationality,
        status: crewMembersV2.status,
      })
      .from(crewMembersV2)
      .leftJoin(masterNationalities, eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid))
      .where(where)
      .orderBy(order, asc(crewMembersV2.crewUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        empNo: r.empNo ?? null,
        name: r.name ?? null,
        presentRank: r.presentRank ?? null,
        nationalityName: r.nationalityName ?? null,
        status: r.status ?? null,
      })),
    };
  },
};

// ============================================================
// cp-contact-details
// ============================================================
const contactFilters = z
  .object({
    vessel: z.string().trim().min(1).optional(),
    rank: z.string().trim().min(1).optional(),
  })
  .strict();

const contactCols: ReportColumn[] = [
  { key: "empNo", label: "Emp No", type: "text", width: 110 },
  { key: "name", label: "Name", type: "text" },
  { key: "presentRank", label: "Rank", type: "text" },
  { key: "mobile", label: "Mobile", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "vesselName", label: "Vessel", type: "text" },
];

const mobileExpr = sql<string | null>`(
  SELECT crew_addresses.mobile FROM crew_addresses
  WHERE crew_addresses.crew_uuid = crew_members_v2.crew_uuid
    AND crew_addresses.is_deleted = FALSE
  ORDER BY crew_addresses.id ASC LIMIT 1
)`;
const emailExpr = sql<string | null>`(
  SELECT crew_addresses.email FROM crew_addresses
  WHERE crew_addresses.crew_uuid = crew_members_v2.crew_uuid
    AND crew_addresses.is_deleted = FALSE
  ORDER BY crew_addresses.id ASC LIMIT 1
)`;

export const crewContactDetailsReport: ReportHandler<z.infer<typeof contactFilters>> = {
  reportId: "cp-contact-details",
  title: "Contact Details of Crew",
  columns: contactCols,
  filterSchema: contactFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [
      ...baseCrewConditions(),
      sql`(${crewMembersV2.status} IS NULL OR ${crewMembersV2.status} NOT ILIKE 'Terminated%')`,
    ];
    if (filters.rank) conds.push(eq(crewMembersV2.presentRank, filters.rank));
    if (filters.vessel) conds.push(sql`${currentVesselNameExpr} = ${filters.vessel}`);
    const where = and(...conds);

    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(crewMembersV2)
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortMap: Record<string, PgColumn | SQL> = {
      empNo: crewMembersV2.empNo,
      name: crewMembersV2.firstName,
      presentRank: crewMembersV2.presentRank,
      mobile: mobileExpr,
      email: emailExpr,
      vesselName: currentVesselNameExpr,
    };
    const sortKey = ctx.sort?.key ?? "empNo";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.empNo);

    const rows = await db
      .select({
        empNo: crewMembersV2.empNo,
        name: nameExpr,
        presentRank: crewMembersV2.presentRank,
        mobile: mobileExpr,
        email: emailExpr,
        vesselName: currentVesselNameExpr,
      })
      .from(crewMembersV2)
      .where(where)
      .orderBy(order, asc(crewMembersV2.crewUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        empNo: r.empNo ?? null,
        name: r.name ?? null,
        presentRank: r.presentRank ?? null,
        mobile: r.mobile ?? null,
        email: r.email ?? null,
        vesselName: r.vesselName ?? null,
      })),
    };
  },
};

// ============================================================
// cp-contract-expiry within N days (uses relief_due as the expiry).
// ============================================================
const expiryFilters = z
  .object({
    withinDays: z.coerce.number().int().min(0).max(3650).default(30),
    rank: z.string().trim().min(1).optional(),
  })
  .strict();

const expiryCols: ReportColumn[] = [
  { key: "empNo", label: "Emp No", type: "text", width: 110 },
  { key: "name", label: "Name", type: "text" },
  { key: "presentRank", label: "Rank", type: "text" },
  { key: "vesselName", label: "Vessel", type: "text" },
  { key: "reliefDue", label: "Relief Due", type: "date", width: 140 },
];

export const crewContractExpiryReport: ReportHandler<z.infer<typeof expiryFilters>> = {
  reportId: "cp-contract-expiry",
  title: "Contract Expiry Within N Days",
  columns: expiryCols,
  filterSchema: expiryFilters,
  async run(filters, ctx) {
    const db = getDb();
    const n = filters.withinDays;
    const reliefDueDate = dateExpr(vesselPlanningV2.reliefDue);
    const conds: SQL[] = [
      eq(vesselPlanningV2.isDeleted, false),
      eq(vesselPlanningV2.isArchived, false),
      noSignOffExpr(vesselPlanningV2.signOffDate),
      isNotNull(vesselPlanningV2.crewUuid),
      sql`${reliefDueDate} IS NOT NULL`,
      sql`${reliefDueDate} BETWEEN CURRENT_DATE AND CURRENT_DATE + (${n} || ' days')::interval`,
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

    const sortMap: Record<string, PgColumn | SQL> = {
      empNo: crewMembersV2.empNo,
      name: crewMembersV2.firstName,
      presentRank: vesselPlanningV2.rank,
      vesselName: masterVessels.vessel,
      reliefDue: reliefDueDate,
    };
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
