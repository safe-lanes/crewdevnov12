import { eq, and, inArray, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  crewBriefings,
  crewBriefingAttachments,
  crewDebriefings,
  crewDebriefingAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import { masterVessels } from "../../../../shared/schema";
import type {
  CrewBriefing,
  InsertCrewBriefing,
  CrewBriefingAttachment,
  InsertCrewBriefingAttachment,
  CrewDebriefing,
  InsertCrewDebriefing,
  CrewDebriefingAttachment,
  InsertCrewDebriefingAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewBriefingWithAttachments = CrewBriefing & {
  attachments: CrewBriefingAttachment[];
};

export type CrewDebriefingWithAttachments = CrewDebriefing & {
  attachments: CrewDebriefingAttachment[];
};

export class CrewBriefingRepository {
  // ============ Briefings ============
  async findBriefingsByCrewUuid(crewUuid: string): Promise<CrewBriefing[]> {
    const db = getDb();
    return db
      .select()
      .from(crewBriefings)
      .where(
        and(
          eq(crewBriefings.crewUuid, crewUuid),
          eq(crewBriefings.isDeleted, false)
        )
      );
  }

  async findBriefingsByCrewUuidWithAttachments(
    crewUuid: string
  ): Promise<CrewBriefingWithAttachments[]> {
    const db = getDb();
    const briefingsWithVessel = await db
      .select({
        id: crewBriefings.id,
        briefingUuid: crewBriefings.briefingUuid,
        crewUuid: crewBriefings.crewUuid,
        vesselUuid: crewBriefings.vesselUuid,
        vesselName: masterVessels.vessel,
        joiningRank: crewBriefings.joiningRank,
        dateSignOn: crewBriefings.dateSignOn,
        sortOrder: crewBriefings.sortOrder,
        createdAt: crewBriefings.createdAt,
        createdByUuid: crewBriefings.createdByUuid,
        updatedAt: crewBriefings.updatedAt,
        updatedByUuid: crewBriefings.updatedByUuid,
        isDeleted: crewBriefings.isDeleted,
        isSync: crewBriefings.isSync,
      })
      .from(crewBriefings)
      .leftJoin(masterVessels, eq(crewBriefings.vesselUuid, masterVessels.vesselUuid))
      .where(
        and(
          eq(crewBriefings.crewUuid, crewUuid),
          eq(crewBriefings.isDeleted, false)
        )
      )
      .orderBy(asc(crewBriefings.sortOrder), asc(crewBriefings.createdAt));

    if (briefingsWithVessel.length === 0) return [];

    const briefingUuids = briefingsWithVessel.map((b: { briefingUuid: string }) => b.briefingUuid);
    const attachments = await db
      .select()
      .from(crewBriefingAttachments)
      .where(
        and(
          inArray(crewBriefingAttachments.briefingUuid, briefingUuids),
          eq(crewBriefingAttachments.isDeleted, false)
        )
      );

    const attMap = new Map<string, CrewBriefingAttachment[]>();
    attachments.forEach((att: CrewBriefingAttachment) => {
      const existing = attMap.get(att.briefingUuid) || [];
      existing.push(att);
      attMap.set(att.briefingUuid, existing);
    });

    return briefingsWithVessel.map((briefing: { briefingUuid: string; vesselName: string | null; [key: string]: any }) => ({
      ...briefing,
      attachments: attMap.get(briefing.briefingUuid) || [],
    }));
  }

  async findBriefingByUuid(briefingUuid: string): Promise<CrewBriefing | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewBriefings)
      .where(
        and(
          eq(crewBriefings.briefingUuid, briefingUuid),
          eq(crewBriefings.isDeleted, false)
        )
      );
    return results[0];
  }

  async createBriefing(
    data: Omit<InsertCrewBriefing, "briefingUuid">
  ): Promise<CrewBriefing> {
    const db = getDb();
    const results = await db
      .insert(crewBriefings)
      .values({
        ...data,
        briefingUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async updateBriefing(
    briefingUuid: string,
    data: Partial<InsertCrewBriefing>
  ): Promise<CrewBriefing | undefined> {
    const db = getDb();
    const results = await db
      .update(crewBriefings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewBriefings.briefingUuid, briefingUuid))
      .returning();
    return results[0];
  }

  async softDeleteBriefing(briefingUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .update(crewBriefingAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewBriefingAttachments.briefingUuid, briefingUuid));

    const results = await db
      .update(crewBriefings)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewBriefings.briefingUuid, briefingUuid))
      .returning();
    return results.length > 0;
  }

  async hardDeleteBriefing(briefingUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .delete(crewBriefingAttachments)
      .where(eq(crewBriefingAttachments.briefingUuid, briefingUuid));

    const results = await db
      .delete(crewBriefings)
      .where(eq(crewBriefings.briefingUuid, briefingUuid))
      .returning();
    return results.length > 0;
  }

  // ============ Briefing Attachments ============
  async findBriefingAttachmentsByBriefingUuid(
    briefingUuid: string
  ): Promise<CrewBriefingAttachment[]> {
    const db = getDb();
    return db
      .select()
      .from(crewBriefingAttachments)
      .where(
        and(
          eq(crewBriefingAttachments.briefingUuid, briefingUuid),
          eq(crewBriefingAttachments.isDeleted, false)
        )
      );
  }

  async addBriefingAttachment(
    data: Omit<InsertCrewBriefingAttachment, "attUuid">
  ): Promise<CrewBriefingAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewBriefingAttachments)
      .values({
        ...data,
        attUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async findBriefingAttachmentByUuid(
    attUuid: string
  ): Promise<CrewBriefingAttachment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewBriefingAttachments)
      .where(
        and(
          eq(crewBriefingAttachments.attUuid, attUuid),
          eq(crewBriefingAttachments.isDeleted, false)
        )
      );
    return results[0];
  }

  async softDeleteBriefingAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewBriefingAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewBriefingAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }

  // ============ De-briefings ============
  async findDebriefingsByCrewUuid(crewUuid: string): Promise<CrewDebriefing[]> {
    const db = getDb();
    return db
      .select()
      .from(crewDebriefings)
      .where(
        and(
          eq(crewDebriefings.crewUuid, crewUuid),
          eq(crewDebriefings.isDeleted, false)
        )
      );
  }

  async findDebriefingsByCrewUuidWithAttachments(
    crewUuid: string
  ): Promise<CrewDebriefingWithAttachments[]> {
    const db = getDb();
    const debriefingsWithVessel = await db
      .select({
        id: crewDebriefings.id,
        debriefingUuid: crewDebriefings.debriefingUuid,
        crewUuid: crewDebriefings.crewUuid,
        vesselUuid: crewDebriefings.vesselUuid,
        vesselName: masterVessels.vessel,
        rankServed: crewDebriefings.rankServed,
        dateSignOn: crewDebriefings.dateSignOn,
        dateSignedOff: crewDebriefings.dateSignedOff,
        reasonForSignOff: crewDebriefings.reasonForSignOff,
        sortOrder: crewDebriefings.sortOrder,
        createdAt: crewDebriefings.createdAt,
        createdByUuid: crewDebriefings.createdByUuid,
        updatedAt: crewDebriefings.updatedAt,
        updatedByUuid: crewDebriefings.updatedByUuid,
        isDeleted: crewDebriefings.isDeleted,
        isSync: crewDebriefings.isSync,
      })
      .from(crewDebriefings)
      .leftJoin(masterVessels, eq(crewDebriefings.vesselUuid, masterVessels.vesselUuid))
      .where(
        and(
          eq(crewDebriefings.crewUuid, crewUuid),
          eq(crewDebriefings.isDeleted, false)
        )
      )
      .orderBy(asc(crewDebriefings.sortOrder), asc(crewDebriefings.createdAt));

    if (debriefingsWithVessel.length === 0) return [];

    const debriefingUuids = debriefingsWithVessel.map((d: { debriefingUuid: string }) => d.debriefingUuid);
    const attachments = await db
      .select()
      .from(crewDebriefingAttachments)
      .where(
        and(
          inArray(crewDebriefingAttachments.debriefingUuid, debriefingUuids),
          eq(crewDebriefingAttachments.isDeleted, false)
        )
      );

    const attMap = new Map<string, CrewDebriefingAttachment[]>();
    attachments.forEach((att: CrewDebriefingAttachment) => {
      const existing = attMap.get(att.debriefingUuid) || [];
      existing.push(att);
      attMap.set(att.debriefingUuid, existing);
    });

    return debriefingsWithVessel.map((debriefing: { debriefingUuid: string; vesselName: string | null; [key: string]: any }) => ({
      ...debriefing,
      attachments: attMap.get(debriefing.debriefingUuid) || [],
    }));
  }

  async findDebriefingByUuid(debriefingUuid: string): Promise<CrewDebriefing | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewDebriefings)
      .where(
        and(
          eq(crewDebriefings.debriefingUuid, debriefingUuid),
          eq(crewDebriefings.isDeleted, false)
        )
      );
    return results[0];
  }

  async createDebriefing(
    data: Omit<InsertCrewDebriefing, "debriefingUuid">
  ): Promise<CrewDebriefing> {
    const db = getDb();
    const results = await db
      .insert(crewDebriefings)
      .values({
        ...data,
        debriefingUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async updateDebriefing(
    debriefingUuid: string,
    data: Partial<InsertCrewDebriefing>
  ): Promise<CrewDebriefing | undefined> {
    const db = getDb();
    const results = await db
      .update(crewDebriefings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewDebriefings.debriefingUuid, debriefingUuid))
      .returning();
    return results[0];
  }

  async softDeleteDebriefing(debriefingUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .update(crewDebriefingAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewDebriefingAttachments.debriefingUuid, debriefingUuid));

    const results = await db
      .update(crewDebriefings)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewDebriefings.debriefingUuid, debriefingUuid))
      .returning();
    return results.length > 0;
  }

  async hardDeleteDebriefing(debriefingUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .delete(crewDebriefingAttachments)
      .where(eq(crewDebriefingAttachments.debriefingUuid, debriefingUuid));

    const results = await db
      .delete(crewDebriefings)
      .where(eq(crewDebriefings.debriefingUuid, debriefingUuid))
      .returning();
    return results.length > 0;
  }

  // ============ De-briefing Attachments ============
  async findDebriefingAttachmentsByDebriefingUuid(
    debriefingUuid: string
  ): Promise<CrewDebriefingAttachment[]> {
    const db = getDb();
    return db
      .select()
      .from(crewDebriefingAttachments)
      .where(
        and(
          eq(crewDebriefingAttachments.debriefingUuid, debriefingUuid),
          eq(crewDebriefingAttachments.isDeleted, false)
        )
      );
  }

  async addDebriefingAttachment(
    data: Omit<InsertCrewDebriefingAttachment, "attUuid">
  ): Promise<CrewDebriefingAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewDebriefingAttachments)
      .values({
        ...data,
        attUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async findDebriefingAttachmentByUuid(
    attUuid: string
  ): Promise<CrewDebriefingAttachment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewDebriefingAttachments)
      .where(
        and(
          eq(crewDebriefingAttachments.attUuid, attUuid),
          eq(crewDebriefingAttachments.isDeleted, false)
        )
      );
    return results[0];
  }

  async softDeleteDebriefingAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewDebriefingAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewDebriefingAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }

  // ============ Combined Briefing Data ============
  async findAllBriefingDataByCrewUuid(crewUuid: string) {
    const [briefings, debriefings] = await Promise.all([
      this.findBriefingsByCrewUuidWithAttachments(crewUuid),
      this.findDebriefingsByCrewUuidWithAttachments(crewUuid),
    ]);
    return { briefings, debriefings };
  }
}
