import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import {
  crewTrainingCourses,
  crewTrainingAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  CrewTrainingCourse,
  InsertCrewTrainingCourse,
  CrewTrainingAttachment,
  InsertCrewTrainingAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewTrainingCourseWithAttachments = CrewTrainingCourse & {
  attachments: CrewTrainingAttachment[];
};

export class CrewTrainingRepository {
  async findByCrewUuid(crewUuid: string): Promise<CrewTrainingCourse[]> {
    const db = getDb();
    return db
      .select()
      .from(crewTrainingCourses)
      .where(
        and(
          eq(crewTrainingCourses.crewUuid, crewUuid),
          eq(crewTrainingCourses.isDeleted, false)
        )
      );
  }

  async findByCrewUuidWithAttachments(
    crewUuid: string
  ): Promise<CrewTrainingCourseWithAttachments[]> {
    const db = getDb();
    const trainings = await db
      .select()
      .from(crewTrainingCourses)
      .where(
        and(
          eq(crewTrainingCourses.crewUuid, crewUuid),
          eq(crewTrainingCourses.isDeleted, false)
        )
      );

    if (trainings.length === 0) return [];

    const trainUuids = trainings.map((t: CrewTrainingCourse) => t.trainUuid);
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
    attachments.forEach((att: CrewTrainingAttachment) => {
      const existing = attMap.get(att.trainUuid) || [];
      existing.push(att);
      attMap.set(att.trainUuid, existing);
    });

    return trainings.map((training: CrewTrainingCourse) => ({
      ...training,
      attachments: attMap.get(training.trainUuid) || [],
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

  async create(
    data: Omit<InsertCrewTrainingCourse, "trainUuid">
  ): Promise<CrewTrainingCourse> {
    const db = getDb();
    const results = await db
      .insert(crewTrainingCourses)
      .values({
        ...data,
        trainUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    trainUuid: string,
    data: Partial<InsertCrewTrainingCourse>
  ): Promise<CrewTrainingCourse | undefined> {
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

  async hardDelete(trainUuid: string): Promise<boolean> {
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

  // ============ Attachments ============
  async findAttachmentsByTrainUuid(
    trainUuid: string
  ): Promise<CrewTrainingAttachment[]> {
    const db = getDb();
    return db
      .select()
      .from(crewTrainingAttachments)
      .where(
        and(
          eq(crewTrainingAttachments.trainUuid, trainUuid),
          eq(crewTrainingAttachments.isDeleted, false)
        )
      );
  }

  async addAttachment(
    data: Omit<InsertCrewTrainingAttachment, "attUuid">
  ): Promise<CrewTrainingAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewTrainingAttachments)
      .values({
        ...data,
        attUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async softDeleteAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewTrainingAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewTrainingAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }

  async hardDeleteAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewTrainingAttachments)
      .where(eq(crewTrainingAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}
