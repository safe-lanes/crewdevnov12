import { eq, and, desc, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { vesselPlanningV2, vesselPlanningAttachmentsV2 } from "../../../../shared/v2/vessel/schema";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import type { VesselPlanningV2, InsertVesselPlanningV2, VesselPlanningAttachmentsV2, InsertVesselPlanningAttachmentsV2 } from "../../../../shared/v2/vessel/schema";
import { v4 as uuidv4 } from "uuid";

export class VesselPlanningRepository {
  async findByVesselUuid(vesselUuid: string): Promise<any[]> {
    const db = getDb();
    const relieverAlias = db.select().from(crewMembersV2).as("reliever");
    
    const results = await db
      .select({
        planning: vesselPlanningV2,
        crewFirstName: crewMembersV2.firstName,
        crewFamilyName: crewMembersV2.familyName,
        crewEmpNo: crewMembersV2.empNo,
      })
      .from(vesselPlanningV2)
      .leftJoin(crewMembersV2, eq(vesselPlanningV2.crewUuid, crewMembersV2.crewUuid))
      .where(
        and(
          eq(vesselPlanningV2.vesselUuid, vesselUuid),
          eq(vesselPlanningV2.isDeleted, false),
          eq(vesselPlanningV2.isArchived, false)
        )
      )
      .orderBy(desc(vesselPlanningV2.createdAt));

    return results.map((row: { planning: any; crewFirstName: string | null; crewFamilyName: string | null; crewEmpNo: string | null }) => ({
      ...row.planning,
      crewMemberName: row.crewFirstName && row.crewFamilyName 
        ? `${row.crewFirstName} ${row.crewFamilyName}`
        : null,
      crewEmpNo: row.crewEmpNo,
    }));
  }

  async findByPlanUuid(planUuid: string): Promise<VesselPlanningV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(vesselPlanningV2)
      .where(
        and(
          eq(vesselPlanningV2.planUuid, planUuid),
          eq(vesselPlanningV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async findByVesselAndRank(vesselUuid: string, rankId: string): Promise<VesselPlanningV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(vesselPlanningV2)
      .where(
        and(
          eq(vesselPlanningV2.vesselUuid, vesselUuid),
          eq(vesselPlanningV2.rankId, rankId),
          eq(vesselPlanningV2.isDeleted, false),
          eq(vesselPlanningV2.isArchived, false)
        )
      );
    return results[0];
  }

  async create(data: Omit<InsertVesselPlanningV2, "planUuid">): Promise<VesselPlanningV2> {
    const db = getDb();
    const results = await db
      .insert(vesselPlanningV2)
      .values({
        ...data,
        planUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(planUuid: string, data: Partial<InsertVesselPlanningV2>): Promise<VesselPlanningV2> {
    const db = getDb();
    const results = await db
      .update(vesselPlanningV2)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(vesselPlanningV2.planUuid, planUuid))
      .returning();
    return results[0];
  }

  async archive(planUuid: string, archivedByUuid?: string): Promise<VesselPlanningV2> {
    const db = getDb();
    const results = await db
      .update(vesselPlanningV2)
      .set({
        isArchived: true,
        archivedDate: new Date().toISOString().split("T")[0],
        updatedAt: new Date(),
        updatedByUuid: archivedByUuid,
      })
      .where(eq(vesselPlanningV2.planUuid, planUuid))
      .returning();
    return results[0];
  }

  async softDelete(planUuid: string): Promise<void> {
    const db = getDb();
    await db
      .update(vesselPlanningV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(vesselPlanningV2.planUuid, planUuid));
  }
}

export class VesselPlanningAttachmentsRepository {
  async findByPlanUuid(planUuid: string): Promise<VesselPlanningAttachmentsV2[]> {
    const db = getDb();
    return db
      .select()
      .from(vesselPlanningAttachmentsV2)
      .where(
        and(
          eq(vesselPlanningAttachmentsV2.planUuid, planUuid),
          eq(vesselPlanningAttachmentsV2.isDeleted, false)
        )
      )
      .orderBy(vesselPlanningAttachmentsV2.sortOrder);
  }

  async create(data: Omit<InsertVesselPlanningAttachmentsV2, "attUuid">): Promise<VesselPlanningAttachmentsV2> {
    const db = getDb();
    const results = await db
      .insert(vesselPlanningAttachmentsV2)
      .values({
        ...data,
        attUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async softDelete(attUuid: string): Promise<void> {
    const db = getDb();
    await db
      .update(vesselPlanningAttachmentsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(vesselPlanningAttachmentsV2.attUuid, attUuid));
  }
}

export const vesselPlanningRepository = new VesselPlanningRepository();
export const vesselPlanningAttachmentsRepository = new VesselPlanningAttachmentsRepository();
