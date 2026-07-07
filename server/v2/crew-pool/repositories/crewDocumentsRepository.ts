import { eq, and, inArray, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  crewDocuments,
  crewDocumentsAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  CrewDocument,
  InsertCrewDocument,
  CrewDocumentAttachment,
  InsertCrewDocumentAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewDocumentWithAttachments = CrewDocument & {
  attachments: CrewDocumentAttachment[];
};

export class CrewDocumentsRepository {
  async findByCrewUuid(crewUuid: string): Promise<CrewDocument[]> {
    const db = getDb();
    return db
      .select()
      .from(crewDocuments)
      .where(
        and(
          eq(crewDocuments.crewUuid, crewUuid),
          eq(crewDocuments.isDeleted, false)
        )
      );
  }

  async findByCrewUuidWithAttachments(
    crewUuid: string
  ): Promise<CrewDocumentWithAttachments[]> {
    const db = getDb();
    const docs = await db
      .select()
      .from(crewDocuments)
      .where(
        and(
          eq(crewDocuments.crewUuid, crewUuid),
          eq(crewDocuments.isDeleted, false)
        )
      )
      .orderBy(asc(crewDocuments.sortOrder), asc(crewDocuments.createdAt));

    if (docs.length === 0) return [];

    const docUuids = docs.map((d: CrewDocument) => d.docUuid);
    const attachments = await db
      .select()
      .from(crewDocumentsAttachments)
      .where(
        and(
          inArray(crewDocumentsAttachments.docUuid, docUuids),
          eq(crewDocumentsAttachments.isDeleted, false)
        )
      );

    const attMap = new Map<string, CrewDocumentAttachment[]>();
    attachments.forEach((att: CrewDocumentAttachment) => {
      const existing = attMap.get(att.docUuid) || [];
      existing.push(att);
      attMap.set(att.docUuid, existing);
    });

    return docs.map((doc: CrewDocument) => ({
      ...doc,
      attachments: attMap.get(doc.docUuid) || [],
    }));
  }

  async findByUuid(docUuid: string): Promise<CrewDocument | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewDocuments)
      .where(
        and(
          eq(crewDocuments.docUuid, docUuid),
          eq(crewDocuments.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(
    data: Omit<InsertCrewDocument, "docUuid">
  ): Promise<CrewDocument> {
    const db = getDb();
    const results = await db
      .insert(crewDocuments)
      .values({
        ...data,
        docUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    docUuid: string,
    data: Partial<InsertCrewDocument>
  ): Promise<CrewDocument | undefined> {
    const db = getDb();
    const results = await db
      .update(crewDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewDocuments.docUuid, docUuid))
      .returning();
    return results[0];
  }

  async softDelete(docUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .update(crewDocumentsAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewDocumentsAttachments.docUuid, docUuid));

    const results = await db
      .update(crewDocuments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewDocuments.docUuid, docUuid))
      .returning();
    return results.length > 0;
  }

  async hardDelete(docUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .delete(crewDocumentsAttachments)
      .where(eq(crewDocumentsAttachments.docUuid, docUuid));

    const results = await db
      .delete(crewDocuments)
      .where(eq(crewDocuments.docUuid, docUuid))
      .returning();
    return results.length > 0;
  }

  // ============ Attachments ============
  async findAttachmentByUuid(
    attUuid: string
  ): Promise<CrewDocumentAttachment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewDocumentsAttachments)
      .where(eq(crewDocumentsAttachments.attUuid, attUuid));
    return results[0];
  }

  async findAttachmentsByDocUuid(
    docUuid: string
  ): Promise<CrewDocumentAttachment[]> {
    const db = getDb();
    return db
      .select()
      .from(crewDocumentsAttachments)
      .where(
        and(
          eq(crewDocumentsAttachments.docUuid, docUuid),
          eq(crewDocumentsAttachments.isDeleted, false)
        )
      );
  }

  async addAttachment(
    data: Omit<InsertCrewDocumentAttachment, "attUuid">
  ): Promise<CrewDocumentAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewDocumentsAttachments)
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
      .update(crewDocumentsAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewDocumentsAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }

  async hardDeleteAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewDocumentsAttachments)
      .where(eq(crewDocumentsAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}
