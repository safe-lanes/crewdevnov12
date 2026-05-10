import { z } from "zod";
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../../db";
import {
  crewMembersV2,
} from "../../../../shared/v2/crew-pool/schema";
import {
  masterNationalities,
  masterVessels,
} from "../../../../shared/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import type { ReportHandler } from "../types";
import type {
  ReportColumn,
  ReportResultRow,
} from "../../../../shared/v2/reports/types";

const filterSchema = z
  .object({
    rank: z.string().trim().min(1).optional(),
    nationality: z.string().trim().min(1).optional(),
  })
  .strict();

type Filters = z.infer<typeof filterSchema>;

const COLUMNS: ReportColumn[] = [
  { key: "empNo", label: "Emp No", type: "text", width: 110 },
  { key: "name", label: "Name", type: "text" },
  { key: "presentRank", label: "Rank", type: "text" },
  { key: "nationalityName", label: "Nationality", type: "text" },
  { key: "vesselName", label: "Vessel", type: "text" },
  { key: "status", label: "Status", type: "status", width: 110 },
];

const SORT_COLUMNS: Record<string, PgColumn> = {
  empNo: crewMembersV2.empNo,
  name: crewMembersV2.firstName,
  presentRank: crewMembersV2.presentRank,
  nationalityName: masterNationalities.nationality,
  vesselName: masterVessels.vessel,
};

export const activeCrewReport: ReportHandler<Filters> = {
  reportId: "cp-active",
  title: "Active Crew",
  columns: COLUMNS,
  filterSchema,
  async run(filters, ctx) {
    const db = getDb();

    const conditions: SQL[] = [
      eq(crewMembersV2.isDeleted, false),
      isNull(crewMembersV2.archivedAt),
      eq(crewMembersV2.isActive, true),
    ];
    if (filters.rank) {
      conditions.push(eq(crewMembersV2.presentRank, filters.rank));
    }
    if (filters.nationality) {
      conditions.push(eq(masterNationalities.nationality, filters.nationality));
    }

    const whereClause = and(...conditions);

    // Distinct count of crew (the join to vesselPlanningV2 can fan out rows).
    const totalResult = await db
      .select({ c: sql<number>`count(distinct ${crewMembersV2.crewUuid})` })
      .from(crewMembersV2)
      .leftJoin(
        masterNationalities,
        eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid),
      )
      .leftJoin(
        vesselPlanningV2,
        and(
          eq(vesselPlanningV2.crewUuid, crewMembersV2.crewUuid),
          eq(vesselPlanningV2.isDeleted, false),
          eq(vesselPlanningV2.isArchived, false),
        ),
      )
      .leftJoin(
        masterVessels,
        eq(vesselPlanningV2.vesselUuid, masterVessels.vesselUuid),
      )
      .where(whereClause);
    const total = Number(totalResult[0]?.c ?? 0);

    const sortKey = ctx.sort?.key ?? "empNo";
    const sortColumn = SORT_COLUMNS[sortKey] ?? SORT_COLUMNS.empNo;
    const orderFn = ctx.sort?.direction === "desc" ? desc : asc;

    // distinctOn(crewUuid) eliminates row fan-out from the planning join.
    const rows = await db
      .selectDistinctOn([crewMembersV2.crewUuid], {
        empNo: crewMembersV2.empNo,
        firstName: crewMembersV2.firstName,
        middleName: crewMembersV2.middleName,
        familyName: crewMembersV2.familyName,
        presentRank: crewMembersV2.presentRank,
        nationalityName: masterNationalities.nationality,
        vesselName: masterVessels.vessel,
        isActive: crewMembersV2.isActive,
        crewUuid: crewMembersV2.crewUuid,
      })
      .from(crewMembersV2)
      .leftJoin(
        masterNationalities,
        eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid),
      )
      .leftJoin(
        vesselPlanningV2,
        and(
          eq(vesselPlanningV2.crewUuid, crewMembersV2.crewUuid),
          eq(vesselPlanningV2.isDeleted, false),
          eq(vesselPlanningV2.isArchived, false),
        ),
      )
      .leftJoin(
        masterVessels,
        eq(vesselPlanningV2.vesselUuid, masterVessels.vesselUuid),
      )
      .where(whereClause)
      .orderBy(crewMembersV2.crewUuid, orderFn(sortColumn))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    type Row = (typeof rows)[number];
    const mapped: ReportResultRow[] = rows.map((r: Row) => {
      const name = [r.firstName, r.middleName, r.familyName]
        .filter((p): p is string => Boolean(p))
        .join(" ");
      const status = !r.isActive
        ? "Inactive"
        : r.vesselName
          ? "On Board"
          : "On Leave";
      return {
        empNo: r.empNo ?? null,
        name: name || null,
        presentRank: r.presentRank ?? null,
        nationalityName: r.nationalityName ?? null,
        vesselName: r.vesselName ?? null,
        status,
      };
    });

    return { rows: mapped, total };
  },
};
