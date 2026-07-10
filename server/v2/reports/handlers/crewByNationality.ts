import { z } from "zod";
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterNationalities } from "../../../../shared/schema";
import type { ReportHandler } from "../types";
import type {
  ReportColumn,
  ReportResultRow,
} from "../../../../shared/v2/reports/types";

const filterSchema = z
  .object({
    nationality: z.string().trim().min(1).optional(),
  })
  .strict();

type Filters = z.infer<typeof filterSchema>;

const COLUMNS: ReportColumn[] = [
  { key: "nationality", label: "Nationality", type: "text" },
  { key: "active", label: "Active", type: "number", align: "right", width: 110 },
  { key: "inactive", label: "Inactive", type: "number", align: "right", width: 110 },
  { key: "total", label: "Total", type: "number", align: "right", width: 110 },
];

const nationalityExpr = sql<string>`COALESCE(NULLIF(TRIM(${masterNationalities.nationality}), ''), '—')`;
const activeCountExpr = sql<number>`COUNT(*) FILTER (WHERE ${crewMembersV2.isActive} = TRUE)`;
const inactiveCountExpr = sql<number>`COUNT(*) FILTER (WHERE ${crewMembersV2.isActive} = FALSE)`;
const totalCountExpr = sql<number>`COUNT(*)`;
const totalGroupsExpr = sql<number>`COUNT(*) OVER ()`;

export const crewByNationalityReport: ReportHandler<Filters> = {
  reportId: "cp-by-nationality",
  title: "Crew by Nationality",
  columns: COLUMNS,
  filterSchema,
  async run(filters, ctx) {
    const db = getDb();

    const conditions: SQL[] = [
      eq(crewMembersV2.isDeleted, false),
      isNull(crewMembersV2.archivedAt),
      sql`(${crewMembersV2.status} IS NULL OR ${crewMembersV2.status} NOT ILIKE 'Terminated%')`,
    ];
    if (filters.nationality) {
      conditions.push(
        eq(masterNationalities.nationality, filters.nationality),
      );
    }

    const sortKey = ctx.sort?.key ?? "nationality";
    const orderFn = ctx.sort?.direction === "desc" ? desc : asc;
    const orderByExpr =
      sortKey === "active"
        ? orderFn(activeCountExpr)
        : sortKey === "inactive"
          ? orderFn(inactiveCountExpr)
          : sortKey === "total"
            ? orderFn(totalCountExpr)
            : orderFn(nationalityExpr);

    const rows = await db
      .select({
        nationality: nationalityExpr,
        active: activeCountExpr,
        inactive: inactiveCountExpr,
        total: totalCountExpr,
        totalGroups: totalGroupsExpr,
      })
      .from(crewMembersV2)
      .leftJoin(
        masterNationalities,
        eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid),
      )
      .where(and(...conditions))
      .groupBy(nationalityExpr)
      .orderBy(orderByExpr)
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    const total = Number(rows[0]?.totalGroups ?? 0);
    type Row = (typeof rows)[number];
    const mapped: ReportResultRow[] = rows.map((r: Row) => ({
      nationality: r.nationality,
      active: Number(r.active),
      inactive: Number(r.inactive),
      total: Number(r.total),
    }));

    return { rows: mapped, total };
  },
};
