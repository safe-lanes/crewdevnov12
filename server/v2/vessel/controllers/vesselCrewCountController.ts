import { Request, Response } from "express";
import { and, sql, isNotNull, inArray, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";

export const vesselCrewCountController = {
  async getCrewCounts(req: Request, res: Response) {
    try {
      const db = getDb();

      // Count crew currently on board, per vessel, from vessel_planning_v2:
      // - crewStatus is 'primary' or 'secondary' (skip relief-only planning rows)
      // - isArchived = false   (excludes signed-off historical rows / orphans)
      // - isDeleted  = false
      // - crewUuid   IS NOT NULL  (skip empty rank slots)
      // - vesselUuid IS NOT NULL
      // - signOnDate IS NOT NULL  (non-negotiable: count only ACTUALLY signed-on crew;
      //                             excludes deployed-pending-sign-on relievers)
      const results = await db
        .select({
          vesselUuid: vesselPlanningV2.vesselUuid,
          count: sql<number>`count(*)::int`,
        })
        .from(vesselPlanningV2)
        .where(
          and(
            inArray(vesselPlanningV2.crewStatus, ["primary", "secondary"]),
            eq(vesselPlanningV2.isArchived, false),
            eq(vesselPlanningV2.isDeleted, false),
            isNotNull(vesselPlanningV2.crewUuid),
            isNotNull(vesselPlanningV2.vesselUuid),
            isNotNull(vesselPlanningV2.signOnDate)
          )
        )
        .groupBy(vesselPlanningV2.vesselUuid);

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
