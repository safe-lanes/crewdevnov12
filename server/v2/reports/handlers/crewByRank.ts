import { z } from "zod";
import { crewMembersService } from "../../crew-pool/services";
import type { ReportHandler } from "../types";
import { applySortAndPaginate, pickColumns } from "../utils";

const filterSchema = z
  .object({
    rank: z.string().trim().min(1).optional(),
  })
  .strict();

type Filters = z.infer<typeof filterSchema>;

export const crewByRankReport: ReportHandler<Filters> = {
  reportId: "cp-by-rank",
  title: "Crew by Rank",
  columns: [
    { key: "rank", label: "Rank", type: "text" },
    { key: "active", label: "Active", type: "number", align: "right", width: 110 },
    { key: "inactive", label: "Inactive", type: "number", align: "right", width: 110 },
    { key: "total", label: "Total", type: "number", align: "right", width: 110 },
  ],
  filterSchema,
  async run(filters, ctx) {
    const enriched = await crewMembersService.getAllEnriched({});

    const counts = new Map<string, { active: number; inactive: number }>();
    for (const c of enriched as any[]) {
      const rank = (c.presentRank ?? "—").trim() || "—";
      if (filters.rank && rank.toLowerCase() !== filters.rank.toLowerCase()) {
        continue;
      }
      const entry = counts.get(rank) ?? { active: 0, inactive: 0 };
      if (c.isActive === false) entry.inactive += 1;
      else entry.active += 1;
      counts.set(rank, entry);
    }

    const rows = Array.from(counts.entries()).map(([rank, v]) => ({
      rank,
      active: v.active,
      inactive: v.inactive,
      total: v.active + v.inactive,
    }));

    const picked = pickColumns(rows, crewByRankReport.columns);
    return applySortAndPaginate(picked, ctx, "rank");
  },
};
