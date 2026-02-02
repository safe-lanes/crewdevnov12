import { Request, Response } from "express";
import { eq, and, sql, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { crewAssignments } from "../../../../shared/v2/crew-pool/schema";

export const vesselCrewCountController = {
  async getCrewCounts(req: Request, res: Response) {
    try {
      const db = getDb();
      
      // Count crew that are currently on board:
      // - isCurrent = true (active assignment)
      // - signOffDate IS NULL (not signed off)
      // - isDeleted = false (not deleted)
      const results = await db
        .select({
          vesselUuid: crewAssignments.vesselUuid,
          count: sql<number>`count(*)::int`,
        })
        .from(crewAssignments)
        .where(
          and(
            eq(crewAssignments.isCurrent, true),
            eq(crewAssignments.isDeleted, false),
            isNull(crewAssignments.signOffDate),
            sql`${crewAssignments.vesselUuid} IS NOT NULL`
          )
        )
        .groupBy(crewAssignments.vesselUuid);

      const countMap: Record<string, number> = {};
      for (const row of results) {
        if (row.vesselUuid) {
          countMap[row.vesselUuid] = row.count;
        }
      }

      res.json(countMap);
    } catch (error) {
      console.error("Error fetching crew counts:", error);
      res.status(500).json({ error: "Failed to fetch crew counts" });
    }
  },
};
