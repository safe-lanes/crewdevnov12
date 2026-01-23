import { eq, desc, inArray, and } from "drizzle-orm";
import { getDb } from "../../db";
import { crewSeaService, crewSeaServiceAttachments } from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewSeaService,
  CrewSeaService,
  InsertCrewSeaServiceAttachment,
  CrewSeaServiceAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewSeaServiceWithAttachments = CrewSeaService & {
  attachments: CrewSeaServiceAttachment[];
};

export class CrewSeaServiceRepository {
  async findByCrewUuidWithAttachments(crewUuid: string, serviceType?: "company" | "external"): Promise<CrewSeaServiceWithAttachments[]> {
    const db = getDb();
    
    const conditions = [
      eq(crewSeaService.crewUuid, crewUuid),
      eq(crewSeaService.isDeleted, false),
    ];
    
    if (serviceType) {
      conditions.push(eq(crewSeaService.serviceType, serviceType));
    }
    
    const services = await db
      .select()
      .from(crewSeaService)
      .where(and(...conditions))
      .orderBy(desc(crewSeaService.signOnDate));

    if (services.length === 0) return [];

    const seaUuids = services.map(s => s.seaUuid);
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
    attachments.forEach(att => {
      const existing = attMap.get(att.seaUuid) || [];
      existing.push(att);
      attMap.set(att.seaUuid, existing);
    });

    return services.map(service => ({
      ...service,
      attachments: attMap.get(service.seaUuid) || [],
    }));
  }

  async findCompanyService(crewUuid: string): Promise<CrewSeaServiceWithAttachments[]> {
    return this.findByCrewUuidWithAttachments(crewUuid, "company");
  }

  async findExternalService(crewUuid: string): Promise<CrewSeaServiceWithAttachments[]> {
    return this.findByCrewUuidWithAttachments(crewUuid, "external");
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

  async findByUuidWithAttachments(seaUuid: string): Promise<CrewSeaServiceWithAttachments | undefined> {
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
    
    if (results.length === 0) return undefined;
    
    const service = results[0];
    const attachments = await db
      .select()
      .from(crewSeaServiceAttachments)
      .where(
        and(
          eq(crewSeaServiceAttachments.seaUuid, seaUuid),
          eq(crewSeaServiceAttachments.isDeleted, false)
        )
      );

    return { ...service, attachments };
  }

  async create(data: Omit<InsertCrewSeaService, "seaUuid">): Promise<CrewSeaService> {
    const db = getDb();
    const results = await db
      .insert(crewSeaService)
      .values({ ...data, seaUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(seaUuid: string, data: Partial<InsertCrewSeaService>): Promise<CrewSeaService | undefined> {
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

  async delete(seaUuid: string): Promise<boolean> {
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

  async addAttachment(seaUuid: string, data: Omit<InsertCrewSeaServiceAttachment, "seaUuid" | "attUuid">): Promise<CrewSeaServiceAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewSeaServiceAttachments)
      .values({ ...data, seaUuid, attUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async findAttachment(attUuid: string): Promise<CrewSeaServiceAttachment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewSeaServiceAttachments)
      .where(
        and(
          eq(crewSeaServiceAttachments.attUuid, attUuid),
          eq(crewSeaServiceAttachments.isDeleted, false)
        )
      );
    return results[0];
  }

  async removeAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewSeaServiceAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewSeaServiceAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}

export const crewSeaServiceRepository = new CrewSeaServiceRepository();
