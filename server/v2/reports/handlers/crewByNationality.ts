import { z } from "zod";
import { crewMembersService } from "../../crew-pool/services";
import type { ReportHandler } from "../types";
import { applySortAndPaginate, pickColumns } from "../utils";

const filterSchema = z
  .object({
    nationality: z.string().trim().min(1).optional(),
  })
  .strict();

type Filters = z.infer<typeof filterSchema>;

export const crewByNationalityReport: ReportHandler<Filters> = {
  reportId: "cp-by-nationality",
  title: "Crew by Nationality",
  columns: [
    { key: "nationality", label: "Nationality", type: "text" },
    { key: "active", label: "Active", type: "number", align: "right", width: 110 },
    { key: "inactive", label: "Inactive", type: "number", align: "right", width: 110 },
    { key: "total", label: "Total", type: "number", align: "right", width: 110 },
  ],
  filterSchema,
  async run(filters, ctx) {
    const enriched = await crewMembersService.getAllEnriched({});

    const counts = new Map<string, { active: number; inactive: number }>();
    for (const c of enriched as any[]) {
      const nat = (c.nationalityName ?? "—").trim() || "—";
      if (
        filters.nationality &&
        nat.toLowerCase() !== filters.nationality.toLowerCase()
      ) {
        continue;
      }
      const entry = counts.get(nat) ?? { active: 0, inactive: 0 };
      if (c.isActive === false) entry.inactive += 1;
      else entry.active += 1;
      counts.set(nat, entry);
    }

    const rows = Array.from(counts.entries()).map(([nationality, v]) => ({
      nationality,
      active: v.active,
      inactive: v.inactive,
      total: v.active + v.inactive,
    }));

    const picked = pickColumns(rows, crewByNationalityReport.columns);
    return applySortAndPaginate(picked, ctx, "nationality");
  },
};
