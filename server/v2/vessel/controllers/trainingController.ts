import { Request, Response } from "express";
import { eq, and, isNotNull } from "drizzle-orm";
import { getDb } from "../../db";
import { crewTrainingCourses } from "../../../../shared/v2/crew-pool/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";

interface CrewTrainingData {
  role: string;
  crewUuid: string;
  trainings: {
    courseId: string;
    trainingCourse: string;
    abbr: string;
    expiry: string | null;
  }[];
}

export const trainingController = {
  async getVesselCrewTrainings(req: Request, res: Response) {
    try {
      const vesselUuid = req.params.vesselUuid;
      const db = getDb();
      
      // Get crew from vessel_planning_v2 (primary crew with crewUuid assigned)
      const planningEntries = await db
        .select({
          crewUuid: vesselPlanningV2.crewUuid,
          rank: vesselPlanningV2.rank,
        })
        .from(vesselPlanningV2)
        .where(
          and(
            eq(vesselPlanningV2.vesselUuid, vesselUuid),
            eq(vesselPlanningV2.isDeleted, false),
            eq(vesselPlanningV2.crewStatus, 'primary'),
            isNotNull(vesselPlanningV2.crewUuid)
          )
        );
      
      const result: CrewTrainingData[] = [];
      
      // Use a Set to avoid duplicate crew entries
      const processedCrewUuids = new Set<string>();
      
      for (const entry of planningEntries) {
        if (!entry.crewUuid || processedCrewUuids.has(entry.crewUuid)) continue;
        processedCrewUuids.add(entry.crewUuid);
        
        const trainings = await db
          .select({
            courseId: crewTrainingCourses.courseId,
            trainingCourse: crewTrainingCourses.trainingCourse,
            abbr: crewTrainingCourses.abbr,
            expiry: crewTrainingCourses.expiry,
          })
          .from(crewTrainingCourses)
          .where(eq(crewTrainingCourses.crewUuid, entry.crewUuid));
        
        result.push({
          role: entry.rank || '',
          crewUuid: entry.crewUuid,
          trainings: trainings.map((t: { courseId: string | null; trainingCourse: string | null; abbr: string | null; expiry: string | null }) => ({
            courseId: t.courseId || '',
            trainingCourse: t.trainingCourse || '',
            abbr: t.abbr || '',
            expiry: t.expiry,
          })),
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error('V2 Crew Training error:', error);
      res.status(500).json({ error: 'Failed to fetch crew trainings' });
    }
  }
};
