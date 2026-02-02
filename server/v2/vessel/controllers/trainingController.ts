import { Request, Response } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { crewAssignments, crewTrainingCourses } from "../../../../shared/v2/crew-pool/schema";

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
      
      const assignments = await db
        .select()
        .from(crewAssignments)
        .where(
          and(
            eq(crewAssignments.vesselUuid, vesselUuid),
            eq(crewAssignments.isCurrent, true),
            eq(crewAssignments.isDeleted, false),
            isNull(crewAssignments.signOffDate)
          )
        );
      
      const result: CrewTrainingData[] = [];
      
      for (const assignment of assignments) {
        if (!assignment.crewUuid) continue;
        
        const trainings = await db
          .select({
            courseId: crewTrainingCourses.courseId,
            trainingCourse: crewTrainingCourses.trainingCourse,
            abbr: crewTrainingCourses.abbr,
            expiry: crewTrainingCourses.expiry,
          })
          .from(crewTrainingCourses)
          .where(eq(crewTrainingCourses.crewUuid, assignment.crewUuid));
        
        result.push({
          role: assignment.rank || '',
          crewUuid: assignment.crewUuid,
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
