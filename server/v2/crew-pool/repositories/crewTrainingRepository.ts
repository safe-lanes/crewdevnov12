import { eq, desc, inArray, and } from "drizzle-orm";
import { getDb } from "../../db";
import { crewTrainingCourses, crewTrainingAttachments } from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewTrainingCourse,
  CrewTrainingCourse,
  InsertCrewTrainingAttachment,
  CrewTrainingAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewTrainingWithAttachments = CrewTrainingCourse & {
  attachments: CrewTrainingAttachment[];
};

export class CrewTrainingRepository {
  async findByCrewUuidWithAttachments(crewUuid: string): Promise<CrewTrainingWithAttachments[]> {
    const db = getDb();
    
    const courses = await db
      .select()
      .from(crewTrainingCourses)
      .where(
        and(
          eq(crewTrainingCourses.crewUuid, crewUuid),
          eq(crewTrainingCourses.isDeleted, false)
        )
      )
      .orderBy(desc(crewTrainingCourses.createdAt));

    if (courses.length === 0) return [];

    const trainUuids = courses.map(c => c.trainUuid);
    const attachments = await db
      .select()
      .from(crewTrainingAttachments)
      .where(
        and(
          inArray(crewTrainingAttachments.trainUuid, trainUuids),
          eq(crewTrainingAttachments.isDeleted, false)
        )
      );

    const attMap = new Map<string, CrewTrainingAttachment[]>();
    attachments.forEach(att => {
      const existing = attMap.get(att.trainUuid) || [];
      existing.push(att);
      attMap.set(att.trainUuid, existing);
    });

    return courses.map(course => ({
      ...course,
      attachments: attMap.get(course.trainUuid) || [],
    }));
  }

  async findByUuid(trainUuid: string): Promise<CrewTrainingCourse | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewTrainingCourses)
      .where(
        and(
          eq(crewTrainingCourses.trainUuid, trainUuid),
          eq(crewTrainingCourses.isDeleted, false)
        )
      );
    return results[0];
  }

  async findByUuidWithAttachments(trainUuid: string): Promise<CrewTrainingWithAttachments | undefined> {
    const db = getDb();
    
    const results = await db
      .select()
      .from(crewTrainingCourses)
      .where(
        and(
          eq(crewTrainingCourses.trainUuid, trainUuid),
          eq(crewTrainingCourses.isDeleted, false)
        )
      );
    
    if (results.length === 0) return undefined;
    
    const course = results[0];
    const attachments = await db
      .select()
      .from(crewTrainingAttachments)
      .where(
        and(
          eq(crewTrainingAttachments.trainUuid, trainUuid),
          eq(crewTrainingAttachments.isDeleted, false)
        )
      );

    return { ...course, attachments };
  }

  async create(data: Omit<InsertCrewTrainingCourse, "trainUuid">): Promise<CrewTrainingCourse> {
    const db = getDb();
    const results = await db
      .insert(crewTrainingCourses)
      .values({ ...data, trainUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(trainUuid: string, data: Partial<InsertCrewTrainingCourse>): Promise<CrewTrainingCourse | undefined> {
    const db = getDb();
    const results = await db
      .update(crewTrainingCourses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewTrainingCourses.trainUuid, trainUuid))
      .returning();
    return results[0];
  }

  async softDelete(trainUuid: string): Promise<boolean> {
    const db = getDb();
    
    await db
      .update(crewTrainingAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewTrainingAttachments.trainUuid, trainUuid));

    const results = await db
      .update(crewTrainingCourses)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewTrainingCourses.trainUuid, trainUuid))
      .returning();
    return results.length > 0;
  }

  async delete(trainUuid: string): Promise<boolean> {
    const db = getDb();
    
    await db
      .delete(crewTrainingAttachments)
      .where(eq(crewTrainingAttachments.trainUuid, trainUuid));

    const results = await db
      .delete(crewTrainingCourses)
      .where(eq(crewTrainingCourses.trainUuid, trainUuid))
      .returning();
    return results.length > 0;
  }

  async addAttachment(trainUuid: string, data: Omit<InsertCrewTrainingAttachment, "trainUuid" | "attUuid">): Promise<CrewTrainingAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewTrainingAttachments)
      .values({ ...data, trainUuid, attUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async findAttachment(attUuid: string): Promise<CrewTrainingAttachment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewTrainingAttachments)
      .where(
        and(
          eq(crewTrainingAttachments.attUuid, attUuid),
          eq(crewTrainingAttachments.isDeleted, false)
        )
      );
    return results[0];
  }

  async removeAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewTrainingAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewTrainingAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}

export const crewTrainingRepository = new CrewTrainingRepository();
