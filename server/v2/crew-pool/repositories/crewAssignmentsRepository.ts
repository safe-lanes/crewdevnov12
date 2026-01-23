import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { crewAssignments } from "../../../../shared/v2/crew-pool/schema";
import type { InsertCrewAssignment, CrewAssignment } from "../../../../shared/v2/crew-pool/types";
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

  async findByVesselUuid(vesselUuid: string): Promise<CrewAssignment[]> {
    const db = getDb();
    return db
      .select()
      .from(crewAssignments)
      .where(
        and(
          eq(crewAssignments.vesselUuid, vesselUuid),
          eq(crewAssignments.isDeleted, false)
        )
      )
      .orderBy(desc(crewAssignments.signOnDate));
  }

  async create(data: Omit<InsertCrewAssignment, "assignUuid">): Promise<CrewAssignment> {
    const db = getDb();
    
    // If marking as current, unset previous current assignment
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
      .values({ ...data, assignUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(assignUuid: string, data: Partial<InsertCrewAssignment>): Promise<CrewAssignment | undefined> {
    const db = getDb();
    
    // If marking as current, unset previous current assignment
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

  async delete(assignUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewAssignments)
      .where(eq(crewAssignments.assignUuid, assignUuid))
      .returning();
    return results.length > 0;
  }

  async signOff(assignUuid: string, signOffDate: string, portOfLeavingUuid?: string): Promise<CrewAssignment | undefined> {
    const db = getDb();
    const results = await db
      .update(crewAssignments)
      .set({
        signOffDate,
        portOfLeavingUuid,
        isCurrent: false,
        updatedAt: new Date(),
      })
      .where(eq(crewAssignments.assignUuid, assignUuid))
      .returning();
    return results[0];
  }
}

export const crewAssignmentsRepository = new CrewAssignmentsRepository();
