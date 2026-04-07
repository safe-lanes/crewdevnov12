import { Request, Response } from "express";
import { getDb } from "../../db";
import { masterVessels } from "../../../../shared/schema";
import { crewMembersV2, crewAssignments } from "../../../../shared/v2/crew-pool/schema";
import { eq, isNull, or, and, sql } from "drizzle-orm";

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
      const monthsParam = req.query.months as string | undefined;

      const crewRows = await db
        .select({
          vesselUuid: crewAssignments.vesselUuid,
          signOnDate: crewAssignments.signOnDate,
          signOffDate: crewAssignments.signOffDate,
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
        );

      if (monthsParam) {
        const months = monthsParam.split(',').filter(m => /^\d{4}-\d{2}$/.test(m));
        const result: Record<string, Record<string, number>> = {};

        for (const mv of months) {
          const [year, month] = mv.split('-').map(Number);
          const firstDay = `${mv}-01`;
          const lastDayDate = new Date(year, month, 0);
          const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;

          const monthCounts: Record<string, number> = {};
          for (const row of crewRows) {
            if (!row.vesselUuid) continue;
            if (row.signOnDate && row.signOnDate > lastDay) continue;
            if (row.signOffDate && row.signOffDate < firstDay) continue;
            monthCounts[row.vesselUuid] = (monthCounts[row.vesselUuid] || 0) + 1;
          }
          result[mv] = monthCounts;
        }

        res.json(result);
      } else {
        const countMap: Record<string, number> = {};
        for (const row of crewRows) {
          if (row.vesselUuid) {
            countMap[row.vesselUuid] = (countMap[row.vesselUuid] || 0) + 1;
          }
        }
        res.json(countMap);
      }
    } catch (error) {
      console.error("Error fetching crew count by vessel:", error);
      res.status(500).json({ error: "Failed to fetch crew count" });
    }
  },
};
