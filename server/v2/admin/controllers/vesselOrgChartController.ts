import { Request, Response } from "express";
import { vesselOrgChartService } from "../services";
import { z } from "zod";

const orgChartEntrySchema = z.object({
  rank: z.string().min(1),
  rankId: z.string().min(1),
  parentRankId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0),
  ocUuid: z.string().optional(),
});

const orgChartSaveSchema = z.array(orgChartEntrySchema);

function hasCycle(entries: z.infer<typeof orgChartSaveSchema>): boolean {
  const map = new Map<string, string | null>();
  entries.forEach(e => map.set(e.rankId, e.parentRankId ?? null));
  for (const rankId of map.keys()) {
    const visited = new Set<string>();
    let current: string | null = rankId;
    while (current) {
      if (visited.has(current)) return true;
      visited.add(current);
      current = map.get(current) ?? null;
    }
  }
  return false;
}

export const vesselOrgChartController = {
  async getAll(req: Request, res: Response) {
    try {
      const records = await vesselOrgChartService.getAll();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching vessel org chart:", error);
      res.status(500).json({ error: "Failed to fetch vessel org chart" });
    }
  },

  async saveAll(req: Request, res: Response) {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: "Request body must be an array" });
      }
      const parsed = orgChartSaveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      }
      if (hasCycle(parsed.data)) {
        return res.status(400).json({ error: "Circular hierarchy detected" });
      }
      const records = await vesselOrgChartService.saveAll(parsed.data);
      res.json(records);
    } catch (error: any) {
      console.error("Error saving vessel org chart:", error);
      res.status(500).json({ error: "Failed to save vessel org chart" });
    }
  },
};
