import { Request, Response } from "express";
import { getDb } from "../../db";
import { masterVessels } from "../../../../shared/schema";

function naturalSort(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const aParts = a.match(re) || [];
  const bParts = b.match(re) || [];
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    if (i >= aParts.length) return -1;
    if (i >= bParts.length) return 1;
    const aVal = aParts[i];
    const bVal = bParts[i];
    const aNum = parseInt(aVal, 10);
    const bNum = parseInt(bVal, 10);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" });
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

export const vesselListController = {
  async getAll(req: Request, res: Response) {
    try {
      const db = getDb();
      
      const vessels = await db
        .select({
          id: masterVessels.id,
          vesselUuid: masterVessels.vesselUuid,
          vessel: masterVessels.vessel,
          vesselType: masterVessels.vesselType,
          imoNumber: masterVessels.imoNumber,
        })
        .from(masterVessels);

      vessels.sort((a, b) => naturalSort(a.vessel || "", b.vessel || ""));

      res.json(vessels);
    } catch (error) {
      console.error("Error fetching vessels:", error);
      res.status(500).json({ error: "Failed to fetch vessels" });
    }
  },
};
