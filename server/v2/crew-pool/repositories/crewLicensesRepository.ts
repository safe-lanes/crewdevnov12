import { eq, desc, inArray, and, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { crewLicenses, crewLicensesAttachments } from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewLicense,
  CrewLicense,
  InsertCrewLicenseAttachment,
  CrewLicenseAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewLicenseWithAttachments = CrewLicense & {
  attachments: CrewLicenseAttachment[];
};

export class CrewLicensesRepository {
  async findByCrewUuidWithAttachments(crewUuid: string, includeArchived = false): Promise<CrewLicenseWithAttachments[]> {
    const db = getDb();
    
    const conditions = [
      eq(crewLicenses.crewUuid, crewUuid),
      eq(crewLicenses.isDeleted, false),
    ];
    
    if (!includeArchived) {
      conditions.push(isNull(crewLicenses.archivedAt));
    }
    
    const licenses = await db
      .select()
      .from(crewLicenses)
      .where(and(...conditions))
      .orderBy(desc(crewLicenses.createdAt));

    if (licenses.length === 0) return [];

    const licUuids = licenses.map(l => l.licUuid);
    const attachments = await db
      .select()
      .from(crewLicensesAttachments)
      .where(
        and(
          inArray(crewLicensesAttachments.licUuid, licUuids),
          eq(crewLicensesAttachments.isDeleted, false)
        )
      );

    const attMap = new Map<string, CrewLicenseAttachment[]>();
    attachments.forEach(att => {
      const existing = attMap.get(att.licUuid) || [];
      existing.push(att);
      attMap.set(att.licUuid, existing);
    });

    return licenses.map(license => ({
      ...license,
      attachments: attMap.get(license.licUuid) || [],
    }));
  }

  async findByUuid(licUuid: string): Promise<CrewLicense | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewLicenses)
      .where(
        and(
          eq(crewLicenses.licUuid, licUuid),
          eq(crewLicenses.isDeleted, false)
        )
      );
    return results[0];
  }

  async findByUuidWithAttachments(licUuid: string): Promise<CrewLicenseWithAttachments | undefined> {
    const db = getDb();
    
    const results = await db
      .select()
      .from(crewLicenses)
      .where(
        and(
          eq(crewLicenses.licUuid, licUuid),
          eq(crewLicenses.isDeleted, false)
        )
      );
    
    if (results.length === 0) return undefined;
    
    const license = results[0];
    const attachments = await db
      .select()
      .from(crewLicensesAttachments)
      .where(
        and(
          eq(crewLicensesAttachments.licUuid, licUuid),
          eq(crewLicensesAttachments.isDeleted, false)
        )
      );

    return { ...license, attachments };
  }

  async create(data: Omit<InsertCrewLicense, "licUuid">): Promise<CrewLicense> {
    const db = getDb();
    const results = await db
      .insert(crewLicenses)
      .values({ ...data, licUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(licUuid: string, data: Partial<InsertCrewLicense>): Promise<CrewLicense | undefined> {
    const db = getDb();
    const results = await db
      .update(crewLicenses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewLicenses.licUuid, licUuid))
      .returning();
    return results[0];
  }

  async archive(licUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewLicenses)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(crewLicenses.licUuid, licUuid))
      .returning();
    return results.length > 0;
  }

  async unarchive(licUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewLicenses)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(eq(crewLicenses.licUuid, licUuid))
      .returning();
    return results.length > 0;
  }

  async softDelete(licUuid: string): Promise<boolean> {
    const db = getDb();
    
    await db
      .update(crewLicensesAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewLicensesAttachments.licUuid, licUuid));

    const results = await db
      .update(crewLicenses)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewLicenses.licUuid, licUuid))
      .returning();
    return results.length > 0;
  }

  async delete(licUuid: string): Promise<boolean> {
    const db = getDb();
    
    await db
      .delete(crewLicensesAttachments)
      .where(eq(crewLicensesAttachments.licUuid, licUuid));

    const results = await db
      .delete(crewLicenses)
      .where(eq(crewLicenses.licUuid, licUuid))
      .returning();
    return results.length > 0;
  }

  async addAttachment(licUuid: string, data: Omit<InsertCrewLicenseAttachment, "licUuid" | "attUuid">): Promise<CrewLicenseAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewLicensesAttachments)
      .values({ ...data, licUuid, attUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async findAttachment(attUuid: string): Promise<CrewLicenseAttachment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewLicensesAttachments)
      .where(
        and(
          eq(crewLicensesAttachments.attUuid, attUuid),
          eq(crewLicensesAttachments.isDeleted, false)
        )
      );
    return results[0];
  }

  async removeAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewLicensesAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewLicensesAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}

export const crewLicensesRepository = new CrewLicensesRepository();
