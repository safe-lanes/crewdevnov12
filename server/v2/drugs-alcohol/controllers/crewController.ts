import { Request, Response } from "express";
import { eq, and, or, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { crewAssignments, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";

export const crewController = {
  async getOnboardByVessel(req: Request, res: Response) {
    try {
      const { vesselUuid } = req.params;
      if (!vesselUuid) {
        return res.status(400).json({ error: "vesselUuid is required" });
      }

      const db = getDb();

      const rows = await db
        .select({
          crewUuid: crewMembersV2.crewUuid,
          firstName: crewMembersV2.firstName,
          middleName: crewMembersV2.middleName,
          familyName: crewMembersV2.familyName,
          presentRank: crewMembersV2.presentRank,
          presentVessel: crewAssignments.vesselUuid,
          signOnDate: crewAssignments.signOnDate,
          assignmentType: crewAssignments.assignmentType,
        })
        .from(crewAssignments)
        .innerJoin(
          crewMembersV2,
          eq(crewAssignments.crewUuid, crewMembersV2.crewUuid)
        )
        .where(
          and(
            eq(crewAssignments.vesselUuid, vesselUuid),
            eq(crewAssignments.isCurrent, true),
            eq(crewAssignments.isDeleted, false),
            or(eq(crewMembersV2.isDeleted, false), isNull(crewMembersV2.isDeleted))
          )
        );

      const result = rows.map((row: any) => ({
        id: row.crewUuid,
        crewUuid: row.crewUuid,
        firstName: row.firstName || "",
        middleName: row.middleName || "",
        familyName: row.familyName || "",
        presentRank: row.presentRank || "",
        presentVessel: row.presentVessel || "",
        signOnDate: row.signOnDate || "",
        assignmentType: row.assignmentType || "",
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching onboard crew by vessel:", error);
      res.status(500).json({ error: "Failed to fetch onboard crew" });
    }
  },
};
