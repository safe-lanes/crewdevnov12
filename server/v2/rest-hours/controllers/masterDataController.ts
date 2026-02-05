import { Request, Response } from "express";
import { getDb } from "../../db";
import { masterVessels } from "../../../../shared/schema";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { eq, isNull, or } from "drizzle-orm";

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
        .orderBy(masterVessels.vessel);

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
          status: crewMembersV2.status,
          isActive: crewMembersV2.isActive,
          uploadedPhoto: crewMembersV2.uploadedPhoto,
        })
        .from(crewMembersV2)
        .where(
          or(
            eq(crewMembersV2.isDeleted, false),
            isNull(crewMembersV2.isDeleted)
          )
        );

      const crewMembers = await query;

      const formattedCrew = crewMembers.map((crew) => ({
        ...crew,
        name: [crew.firstName, crew.middleName, crew.familyName]
          .filter(Boolean)
          .join(" "),
        rank: crew.presentRank,
        crewMemberId: crew.empNo,
      }));

      res.json(formattedCrew);
    } catch (error) {
      console.error("Error fetching crew members V2:", error);
      res.status(500).json({ error: "Failed to fetch crew members" });
    }
  },
};
