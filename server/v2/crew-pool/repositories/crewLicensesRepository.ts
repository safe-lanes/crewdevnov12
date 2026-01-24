import { eq, and, inArray, isNull, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  crewLicenses,
  crewLicensesAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  CrewLicense,
  InsertCrewLicense,
  CrewLicenseAttachment,
  InsertCrewLicenseAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewLicenseWithAttachments = CrewLicense & {
  attachments: CrewLicenseAttachment[];
};

export class CrewLicensesRepository {
  async findByCrewUuid(crewUuid: string): Promise<CrewLicense[]> {
    const db = getDb();
    return db
      .select()
      .from(crewLicenses)
      .where(
        and(
          eq(crewLicenses.crewUuid, crewUuid),
          eq(crewLicenses.isDeleted, false)
        )
      );
  }

  async findActiveByCrewUuid(crewUuid: string): Promise<CrewLicense[]> {
    const db = getDb();
    return db
      .select()
      .from(crewLicenses)
      .where(
        and(
          eq(crewLicenses.crewUuid, crewUuid),
          eq(crewLicenses.isDeleted, false),
          isNull(crewLicenses.archivedAt)
        )
      );
  }

  async findByCrewUuidWithAttachments(
    crewUuid: string
  ): Promise<CrewLicenseWithAttachments[]> {
    const db = getDb();
    const licenses = await db
      .select()
      .from(crewLicenses)
      .where(
        and(
          eq(crewLicenses.crewUuid, crewUuid),
          eq(crewLicenses.isDeleted, false)
        )
      )
      .orderBy(asc(crewLicenses.sortOrder), asc(crewLicenses.createdAt));

    if (licenses.length === 0) return [];

    const licUuids = licenses.map((l: CrewLicense) => l.licUuid);
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
    attachments.forEach((att: CrewLicenseAttachment) => {
      const existing = attMap.get(att.licUuid) || [];
      existing.push(att);
      attMap.set(att.licUuid, existing);
    });

    return licenses.map((lic: CrewLicense) => ({
      ...lic,
      attachments: attMap.get(lic.licUuid) || [],
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

  async create(
    data: Omit<InsertCrewLicense, "licUuid">
  ): Promise<CrewLicense> {
    const db = getDb();
    const results = await db
      .insert(crewLicenses)
      .values({
        ...data,
        licUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    licUuid: string,
    data: Partial<InsertCrewLicense>
  ): Promise<CrewLicense | undefined> {
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

  async hardDelete(licUuid: string): Promise<boolean> {
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

  // ============ Attachments ============
  async findAttachmentsByLicUuid(
    licUuid: string
  ): Promise<CrewLicenseAttachment[]> {
    const db = getDb();
    return db
      .select()
      .from(crewLicensesAttachments)
      .where(
        and(
          eq(crewLicensesAttachments.licUuid, licUuid),
          eq(crewLicensesAttachments.isDeleted, false)
        )
      );
  }

  async addAttachment(
    data: Omit<InsertCrewLicenseAttachment, "attUuid">
  ): Promise<CrewLicenseAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewLicensesAttachments)
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
      .update(crewLicensesAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewLicensesAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }

  async hardDeleteAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewLicensesAttachments)
      .where(eq(crewLicensesAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}
