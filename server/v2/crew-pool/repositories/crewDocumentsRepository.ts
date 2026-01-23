import { eq, desc, inArray, and } from "drizzle-orm";
import { getDb } from "../../db";
import { crewDocuments, crewDocumentsAttachments } from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewDocument,
  CrewDocument,
  InsertCrewDocumentAttachment,
  CrewDocumentAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewDocumentWithAttachments = CrewDocument & {
  attachments: CrewDocumentAttachment[];
};

export class CrewDocumentsRepository {
  // JOIN-based query to prevent N+1
  async findByCrewUuidWithAttachments(crewUuid: string): Promise<CrewDocumentWithAttachments[]> {
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
      .orderBy(desc(crewDocuments.createdAt));

    if (docs.length === 0) return [];

    const docUuids = docs.map(d => d.docUuid);
    const attachments = await db
      .select()
      .from(crewDocumentsAttachments)
      .where(
        and(
          inArray(crewDocumentsAttachments.docUuid, docUuids),
          eq(crewDocumentsAttachments.isDeleted, false)
        )
      );

    // Group attachments by docUuid
    const attMap = new Map<string, CrewDocumentAttachment[]>();
    attachments.forEach(att => {
      const existing = attMap.get(att.docUuid) || [];
      existing.push(att);
      attMap.set(att.docUuid, existing);
    });

    return docs.map(doc => ({
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

  async findByUuidWithAttachments(docUuid: string): Promise<CrewDocumentWithAttachments | undefined> {
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
    
    if (results.length === 0) return undefined;
    
    const doc = results[0];
    const attachments = await db
      .select()
      .from(crewDocumentsAttachments)
      .where(
        and(
          eq(crewDocumentsAttachments.docUuid, docUuid),
          eq(crewDocumentsAttachments.isDeleted, false)
        )
      );

    return { ...doc, attachments };
  }

  async create(data: Omit<InsertCrewDocument, "docUuid">): Promise<CrewDocument> {
    const db = getDb();
    const results = await db
      .insert(crewDocuments)
      .values({ ...data, docUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(docUuid: string, data: Partial<InsertCrewDocument>): Promise<CrewDocument | undefined> {
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
    
    // Soft delete attachments
    await db
      .update(crewDocumentsAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewDocumentsAttachments.docUuid, docUuid));

    // Soft delete document
    const results = await db
      .update(crewDocuments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewDocuments.docUuid, docUuid))
      .returning();
    return results.length > 0;
  }

  async delete(docUuid: string): Promise<boolean> {
    const db = getDb();
    
    // Delete attachments first (cascade)
    await db
      .delete(crewDocumentsAttachments)
      .where(eq(crewDocumentsAttachments.docUuid, docUuid));

    // Delete document
    const results = await db
      .delete(crewDocuments)
      .where(eq(crewDocuments.docUuid, docUuid))
      .returning();
    return results.length > 0;
  }

  // Attachment methods
  async addAttachment(docUuid: string, data: Omit<InsertCrewDocumentAttachment, "docUuid" | "attUuid">): Promise<CrewDocumentAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewDocumentsAttachments)
      .values({ ...data, docUuid, attUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async findAttachment(attUuid: string): Promise<CrewDocumentAttachment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewDocumentsAttachments)
      .where(
        and(
          eq(crewDocumentsAttachments.attUuid, attUuid),
          eq(crewDocumentsAttachments.isDeleted, false)
        )
      );
    return results[0];
  }

  async removeAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewDocumentsAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewDocumentsAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }

  async deleteAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewDocumentsAttachments)
      .where(eq(crewDocumentsAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}

export const crewDocumentsRepository = new CrewDocumentsRepository();
