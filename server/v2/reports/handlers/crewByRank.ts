import { z } from "zod";
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import type { ReportHandler } from "../types";
import type {
  ReportColumn,
  ReportResultRow,
} from "../../../../shared/v2/reports/types";

const filterSchema = z
  .object({
    rank: z.string().trim().min(1).optional(),
  })
  .strict();

type Filters = z.infer<typeof filterSchema>;

const COLUMNS: ReportColumn[] = [
  { key: "rank", label: "Rank", type: "text" },
  { key: "active", label: "Active", type: "number", align: "right", width: 110 },
  { key: "inactive", label: "Inactive", type: "number", align: "right", width: 110 },
  { key: "total", label: "Total", type: "number", align: "right", width: 110 },
];

// Group key normalises NULL/empty rank to em-dash so the row is stable.
const rankExpr = sql<string>`COALESCE(NULLIF(TRIM(${crewMembersV2.presentRank}), ''), '—')`;
const activeCountExpr = sql<number>`COUNT(*) FILTER (WHERE ${crewMembersV2.isActive} = TRUE)`;
const inactiveCountExpr = sql<number>`COUNT(*) FILTER (WHERE ${crewMembersV2.isActive} = FALSE)`;
const totalCountExpr = sql<number>`COUNT(*)`;
const totalGroupsExpr = sql<number>`COUNT(*) OVER ()`;

export const crewByRankReport: ReportHandler<Filters> = {
  reportId: "cp-by-rank",
  title: "Crew by Rank",
  columns: COLUMNS,
  filterSchema,
  async run(filters, ctx) {
    const db = getDb();

    const conditions: SQL[] = [
      eq(crewMembersV2.isDeleted, false),
      isNull(crewMembersV2.archivedAt),
    ];
    if (filters.rank) {
      conditions.push(eq(crewMembersV2.presentRank, filters.rank));
    }

    const sortKey = ctx.sort?.key ?? "rank";
    const orderFn = ctx.sort?.direction === "desc" ? desc : asc;
    const orderByExpr =
      sortKey === "active"
        ? orderFn(activeCountExpr)
        : sortKey === "inactive"
          ? orderFn(inactiveCountExpr)
          : sortKey === "total"
            ? orderFn(totalCountExpr)
            : orderFn(rankExpr);

    const rows = await db
      .select({
        rank: rankExpr,
        active: activeCountExpr,
        inactive: inactiveCountExpr,
        total: totalCountExpr,
        totalGroups: totalGroupsExpr,
      })
      .from(crewMembersV2)
      .where(and(...conditions))
      .groupBy(rankExpr)
      .orderBy(orderByExpr)
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    const total = Number(rows[0]?.totalGroups ?? 0);
    type Row = (typeof rows)[number];
    const mapped: ReportResultRow[] = rows.map((r: Row) => ({
      rank: r.rank,
      active: Number(r.active),
      inactive: Number(r.inactive),
      total: Number(r.total),
    }));

    return { rows: mapped, total };
  },
};
