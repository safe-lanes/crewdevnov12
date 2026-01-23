import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { crewAssignments } from "../../../../shared/v2/crew-pool/schema";
import type {
  CrewAssignment,
  InsertCrewAssignment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export class CrewAssignmentsRepository {
  async findByCrewUuid(crewUuid: string): Promise<CrewAssignment[]> {
    const db = getDb();
    return db
      .select()
      .from(crewAssignments)
      .where(
        and(
          eq(crewAssignments.crewUuid, crewUuid),
          eq(crewAssignments.isDeleted, false)
        )
      )
      .orderBy(desc(crewAssignments.signOnDate));
  }

  async findByUuid(assignUuid: string): Promise<CrewAssignment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewAssignments)
      .where(
        and(
          eq(crewAssignments.assignUuid, assignUuid),
          eq(crewAssignments.isDeleted, false)
        )
      );
    return results[0];
  }

  async findCurrent(crewUuid: string): Promise<CrewAssignment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewAssignments)
      .where(
        and(
          eq(crewAssignments.crewUuid, crewUuid),
          eq(crewAssignments.isCurrent, true),
          eq(crewAssignments.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(
    data: Omit<InsertCrewAssignment, "assignUuid">
  ): Promise<CrewAssignment> {
    const db = getDb();

    // If marking as current, unset previous current
    if (data.isCurrent) {
      await db
        .update(crewAssignments)
        .set({ isCurrent: false, updatedAt: new Date() })
        .where(
          and(
            eq(crewAssignments.crewUuid, data.crewUuid),
            eq(crewAssignments.isCurrent, true)
          )
        );
    }

    const results = await db
      .insert(crewAssignments)
      .values({
        ...data,
        assignUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    assignUuid: string,
    data: Partial<InsertCrewAssignment>
  ): Promise<CrewAssignment | undefined> {
    const db = getDb();

    // If marking as current, unset previous current first
    if (data.isCurrent) {
      const existing = await this.findByUuid(assignUuid);
      if (existing) {
        await db
          .update(crewAssignments)
          .set({ isCurrent: false, updatedAt: new Date() })
          .where(
            and(
              eq(crewAssignments.crewUuid, existing.crewUuid),
              eq(crewAssignments.isCurrent, true)
            )
          );
      }
    }

    const results = await db
      .update(crewAssignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewAssignments.assignUuid, assignUuid))
      .returning();
    return results[0];
  }

  async softDelete(assignUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewAssignments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewAssignments.assignUuid, assignUuid))
      .returning();
    return results.length > 0;
  }

  async hardDelete(assignUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewAssignments)
      .where(eq(crewAssignments.assignUuid, assignUuid))
      .returning();
    return results.length > 0;
  }

  async setCurrentAssignment(
    crewUuid: string,
    assignUuid: string
  ): Promise<boolean> {
    const db = getDb();

    // Unset all current assignments for this crew
    await db
      .update(crewAssignments)
      .set({ isCurrent: false, updatedAt: new Date() })
      .where(eq(crewAssignments.crewUuid, crewUuid));

    // Set the specified assignment as current
    const results = await db
      .update(crewAssignments)
      .set({ isCurrent: true, updatedAt: new Date() })
      .where(eq(crewAssignments.assignUuid, assignUuid))
      .returning();

    return results.length > 0;
  }
}
