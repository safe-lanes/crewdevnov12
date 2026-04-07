import { Request, Response } from "express";
import { getDb } from "../../db";
import { masterVessels } from "../../../../shared/schema";
import { crewMembersV2, crewAssignments } from "../../../../shared/v2/crew-pool/schema";
import { eq, isNull, or, and, sql, count } from "drizzle-orm";

export const masterDataController = {
  async getVessels(req: Request, res: Response) {
    try {
      const db = getDb();
      const vessels = await db
        .select({
          id: masterVessels.id,
          vesselUuid: masterVessels.vesselUuid,
          vessel: masterVessels.vessel,
          imoNumber: masterVessels.imoNumber,
          vesselType: masterVessels.vesselType,
        })
        .from(masterVessels)
        .orderBy(sql`LOWER(${masterVessels.vessel})`);

      res.json(vessels);
    } catch (error) {
      console.error("Error fetching master vessels:", error);
      res.status(500).json({ error: "Failed to fetch vessels" });
    }
  },

  async getCrewMembers(req: Request, res: Response) {
    try {
      const db = getDb();

      const query = db
        .select({
          id: crewMembersV2.id,
          crewUuid: crewMembersV2.crewUuid,
          empNo: crewMembersV2.empNo,
          firstName: crewMembersV2.firstName,
          middleName: crewMembersV2.middleName,
          familyName: crewMembersV2.familyName,
          presentRank: crewMembersV2.presentRank,
          vesselUuid: crewAssignments.vesselUuid,
          signOnDate: crewAssignments.signOnDate,
          signOffDate: crewAssignments.signOffDate,
          status: crewMembersV2.status,
          isActive: crewMembersV2.isActive,
          uploadedPhoto: crewMembersV2.uploadedPhoto,
        })
        .from(crewMembersV2)
        .leftJoin(
          crewAssignments,
          and(
            eq(crewMembersV2.crewUuid, crewAssignments.crewUuid),
            eq(crewAssignments.isCurrent, true)
          )
        )
        .where(
          or(
            eq(crewMembersV2.isDeleted, false),
            isNull(crewMembersV2.isDeleted)
          )
        );

      const crewMembers = await query;

      const formattedCrew = crewMembers.map((crew: any) => ({
        ...crew,
        name: [crew.firstName, crew.middleName, crew.familyName]
          .filter(Boolean)
          .join(" "),
        rank: crew.presentRank,
        crewMemberId: crew.empNo,
        presentVessel: crew.vesselUuid,
      }));

      res.json(formattedCrew);
    } catch (error) {
      console.error("Error fetching crew members V2:", error);
      res.status(500).json({ error: "Failed to fetch crew members" });
    }
  },

  async getCrewCountByVessel(req: Request, res: Response) {
    try {
      const db = getDb();

      const crewCounts = await db
        .select({
          vesselUuid: crewAssignments.vesselUuid,
          crewCount: count(crewAssignments.id),
        })
        .from(crewAssignments)
        .innerJoin(
          crewMembersV2,
          eq(crewAssignments.crewUuid, crewMembersV2.crewUuid)
        )
        .where(
          and(
            eq(crewAssignments.isCurrent, true),
            or(
              eq(crewMembersV2.isDeleted, false),
              isNull(crewMembersV2.isDeleted)
            )
          )
        )
        .groupBy(crewAssignments.vesselUuid);

      const countMap: Record<string, number> = {};
      for (const row of crewCounts) {
        if (row.vesselUuid) {
          countMap[row.vesselUuid] = Number(row.crewCount);
        }
      }

      res.json(countMap);
    } catch (error) {
      console.error("Error fetching crew count by vessel:", error);
      res.status(500).json({ error: "Failed to fetch crew count" });
    }
  },
};
