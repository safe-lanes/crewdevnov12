import { z } from "zod";
import { crewMembersService } from "../../crew-pool/services";
import type { ReportHandler } from "../types";
import { applySortAndPaginate, pickColumns } from "../utils";

const filterSchema = z
  .object({
    rank: z.string().trim().min(1).optional(),
    nationality: z.string().trim().min(1).optional(),
  })
  .strict();

type Filters = z.infer<typeof filterSchema>;

export const activeCrewReport: ReportHandler<Filters> = {
  reportId: "cp-active",
  title: "Active Crew",
  columns: [
    { key: "empNo", label: "Emp No", type: "text", width: 110 },
    { key: "name", label: "Name", type: "text" },
    { key: "presentRank", label: "Rank", type: "text" },
    { key: "nationalityName", label: "Nationality", type: "text" },
    { key: "vesselName", label: "Vessel", type: "text" },
    { key: "status", label: "Status", type: "status", width: 110 },
  ],
  filterSchema,
  async run(filters, ctx) {
    const enriched = await crewMembersService.getAllEnriched({
      isActive: true,
    });

    let rows = enriched.map((c: any) => ({
      empNo: c.empNo ?? c.employeeId ?? null,
      name: [c.firstName, c.middleName, c.familyName].filter(Boolean).join(" "),
      presentRank: c.presentRank ?? null,
      nationalityName: c.nationalityName ?? null,
      vesselName: c.vesselName ?? null,
      status: c.status ?? null,
    }));

    if (filters.rank) {
      const r = filters.rank.toLowerCase();
      rows = rows.filter((row) => (row.presentRank ?? "").toLowerCase() === r);
    }
    if (filters.nationality) {
      const n = filters.nationality.toLowerCase();
      rows = rows.filter(
        (row) => (row.nationalityName ?? "").toLowerCase() === n,
      );
    }

    const picked = pickColumns(rows, activeCrewReport.columns);
    return applySortAndPaginate(picked, ctx, "name");
  },
};
