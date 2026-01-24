import { eq, and, inArray, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  crewSeaService,
  crewSeaServiceAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  CrewSeaService,
  InsertCrewSeaService,
  CrewSeaServiceAttachment,
  InsertCrewSeaServiceAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewSeaServiceWithAttachments = CrewSeaService & {
  attachments: CrewSeaServiceAttachment[];
};

export class CrewSeaServiceRepository {
  async findByCrewUuid(crewUuid: string): Promise<CrewSeaService[]> {
    const db = getDb();
    return db
      .select()
      .from(crewSeaService)
      .where(
        and(
          eq(crewSeaService.crewUuid, crewUuid),
          eq(crewSeaService.isDeleted, false)
        )
      );
  }

  async findByCrewUuidAndType(
    crewUuid: string,
    serviceType: string
  ): Promise<CrewSeaService[]> {
    const db = getDb();
    return db
      .select()
      .from(crewSeaService)
      .where(
        and(
          eq(crewSeaService.crewUuid, crewUuid),
          eq(crewSeaService.serviceType, serviceType),
          eq(crewSeaService.isDeleted, false)
        )
      );
  }

  async findByCrewUuidWithAttachments(
    crewUuid: string
  ): Promise<CrewSeaServiceWithAttachments[]> {
    const db = getDb();
    const services = await db
      .select()
      .from(crewSeaService)
      .where(
        and(
          eq(crewSeaService.crewUuid, crewUuid),
          eq(crewSeaService.isDeleted, false)
        )
      )
      .orderBy(asc(crewSeaService.sortOrder), asc(crewSeaService.createdAt));

    if (services.length === 0) return [];

    const seaUuids = services.map((s: CrewSeaService) => s.seaUuid);
    const attachments = await db
      .select()
      .from(crewSeaServiceAttachments)
      .where(
        and(
          inArray(crewSeaServiceAttachments.seaUuid, seaUuids),
          eq(crewSeaServiceAttachments.isDeleted, false)
        )
      );

    const attMap = new Map<string, CrewSeaServiceAttachment[]>();
    attachments.forEach((att: CrewSeaServiceAttachment) => {
      const existing = attMap.get(att.seaUuid) || [];
      existing.push(att);
      attMap.set(att.seaUuid, existing);
    });

    return services.map((service: CrewSeaService) => ({
      ...service,
      attachments: attMap.get(service.seaUuid) || [],
    }));
  }

  async findByUuid(seaUuid: string): Promise<CrewSeaService | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewSeaService)
      .where(
        and(
          eq(crewSeaService.seaUuid, seaUuid),
          eq(crewSeaService.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(
    data: Omit<InsertCrewSeaService, "seaUuid">
  ): Promise<CrewSeaService> {
    const db = getDb();
    const results = await db
      .insert(crewSeaService)
      .values({
        ...data,
        seaUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    seaUuid: string,
    data: Partial<InsertCrewSeaService>
  ): Promise<CrewSeaService | undefined> {
    const db = getDb();
    const results = await db
      .update(crewSeaService)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewSeaService.seaUuid, seaUuid))
      .returning();
    return results[0];
  }

  async softDelete(seaUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .update(crewSeaServiceAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewSeaServiceAttachments.seaUuid, seaUuid));

    const results = await db
      .update(crewSeaService)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewSeaService.seaUuid, seaUuid))
      .returning();
    return results.length > 0;
  }

  async hardDelete(seaUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .delete(crewSeaServiceAttachments)
      .where(eq(crewSeaServiceAttachments.seaUuid, seaUuid));

    const results = await db
      .delete(crewSeaService)
      .where(eq(crewSeaService.seaUuid, seaUuid))
      .returning();
    return results.length > 0;
  }

  // ============ Attachments ============
  async findAttachmentsBySeaUuid(
    seaUuid: string
  ): Promise<CrewSeaServiceAttachment[]> {
    const db = getDb();
    return db
      .select()
      .from(crewSeaServiceAttachments)
      .where(
        and(
          eq(crewSeaServiceAttachments.seaUuid, seaUuid),
          eq(crewSeaServiceAttachments.isDeleted, false)
        )
      );
  }

  async addAttachment(
    data: Omit<InsertCrewSeaServiceAttachment, "attUuid">
  ): Promise<CrewSeaServiceAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewSeaServiceAttachments)
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
      .update(crewSeaServiceAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewSeaServiceAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }

  async hardDeleteAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewSeaServiceAttachments)
      .where(eq(crewSeaServiceAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}
