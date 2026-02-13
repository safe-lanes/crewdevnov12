import { Request, Response } from "express";
import { getDb } from "../../db";
import { masterVessels } from "../../../../shared/schema";
import { sql } from "drizzle-orm";

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
        .from(masterVessels)
        .orderBy(sql`LOWER(${masterVessels.vessel})`);

      res.json(vessels);
    } catch (error) {
      console.error("Error fetching vessels:", error);
      res.status(500).json({ error: "Failed to fetch vessels" });
    }
  },
};
