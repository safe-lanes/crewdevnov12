import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  daTestRecordsV2,
  daTestingEquipmentV2,
  daPersonnelTestedV2,
  daSignaturesV2,
  daAttachmentsV2,
} from "../../../../shared/v2/drugs-alcohol/schema";
import type {
  DaTestRecordV2,
  InsertDaTestRecordV2,
  DaTestingEquipmentV2,
  DaPersonnelTestedV2,
  DaSignatureV2,
  DaAttachmentV2,
} from "../../../../shared/v2/drugs-alcohol/schema";
import { v4 as uuidv4 } from "uuid";

export interface TestRecordWithChildren extends DaTestRecordV2 {
  equipment: DaTestingEquipmentV2[];
  personnel: DaPersonnelTestedV2[];
  signatures: DaSignatureV2[];
  attachments: DaAttachmentV2[];
}

export class TestRecordsRepository {
  async findAll(filters?: {
    vesselId?: string;
    testType?: string;
  }): Promise<DaTestRecordV2[]> {
    const db = getDb();
    let conditions = [eq(daTestRecordsV2.isDeleted, false)];

    if (filters?.vesselId) {
      conditions.push(eq(daTestRecordsV2.vesselId, filters.vesselId));
    }
    if (filters?.testType) {
      conditions.push(eq(daTestRecordsV2.testType, filters.testType));
    }

    return db
      .select()
      .from(daTestRecordsV2)
      .where(and(...conditions))
      .orderBy(desc(daTestRecordsV2.createdAt));
  }

  async findAllWithChildren(filters?: {
    vesselId?: string;
    testType?: string;
  }): Promise<TestRecordWithChildren[]> {
    const records = await this.findAll(filters);
    if (records.length === 0) return [];

    const db = getDb();
    const recordUuids = records.map((r) => r.daUuid);

    const [allEquipment, allPersonnel, allSignatures, allAttachments] = await Promise.all([
      db
        .select()
        .from(daTestingEquipmentV2)
        .where(eq(daTestingEquipmentV2.isDeleted, false)),
      db
        .select()
        .from(daPersonnelTestedV2)
        .where(eq(daPersonnelTestedV2.isDeleted, false)),
      db
        .select()
        .from(daSignaturesV2)
        .where(eq(daSignaturesV2.isDeleted, false)),
      db
        .select()
        .from(daAttachmentsV2)
        .where(eq(daAttachmentsV2.isDeleted, false)),
    ]);

    const uuidSet = new Set(recordUuids);

    const equipmentByRecord = new Map<string, DaTestingEquipmentV2[]>();
    const personnelByRecord = new Map<string, DaPersonnelTestedV2[]>();
    const signaturesByRecord = new Map<string, DaSignatureV2[]>();
    const attachmentsByRecord = new Map<string, DaAttachmentV2[]>();

    for (const eq of allEquipment) {
      if (uuidSet.has(eq.testRecordUuid)) {
        const arr = equipmentByRecord.get(eq.testRecordUuid) || [];
        arr.push(eq);
        equipmentByRecord.set(eq.testRecordUuid, arr);
      }
    }
    for (const p of allPersonnel) {
      if (uuidSet.has(p.testRecordUuid)) {
        const arr = personnelByRecord.get(p.testRecordUuid) || [];
        arr.push(p);
        personnelByRecord.set(p.testRecordUuid, arr);
      }
    }
    for (const s of allSignatures) {
      if (uuidSet.has(s.testRecordUuid)) {
        const arr = signaturesByRecord.get(s.testRecordUuid) || [];
        arr.push(s);
        signaturesByRecord.set(s.testRecordUuid, arr);
      }
    }
    for (const a of allAttachments) {
      if (uuidSet.has(a.testRecordUuid)) {
        const arr = attachmentsByRecord.get(a.testRecordUuid) || [];
        arr.push(a);
        attachmentsByRecord.set(a.testRecordUuid, arr);
      }
    }

    return records.map((record) => ({
      ...record,
      equipment: equipmentByRecord.get(record.daUuid) || [],
      personnel: personnelByRecord.get(record.daUuid) || [],
      signatures: signaturesByRecord.get(record.daUuid) || [],
      attachments: attachmentsByRecord.get(record.daUuid) || [],
    }));
  }

  async findByUuid(daUuid: string): Promise<DaTestRecordV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(daTestRecordsV2)
      .where(
        and(
          eq(daTestRecordsV2.daUuid, daUuid),
          eq(daTestRecordsV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async findByUuidWithChildren(daUuid: string): Promise<TestRecordWithChildren | undefined> {
    const record = await this.findByUuid(daUuid);
    if (!record) return undefined;

    const db = getDb();
    const [equipment, personnel, signatures, attachments] = await Promise.all([
      db
        .select()
        .from(daTestingEquipmentV2)
        .where(
          and(
            eq(daTestingEquipmentV2.testRecordUuid, daUuid),
            eq(daTestingEquipmentV2.isDeleted, false)
          )
        ),
      db
        .select()
        .from(daPersonnelTestedV2)
        .where(
          and(
            eq(daPersonnelTestedV2.testRecordUuid, daUuid),
            eq(daPersonnelTestedV2.isDeleted, false)
          )
        ),
      db
        .select()
        .from(daSignaturesV2)
        .where(
          and(
            eq(daSignaturesV2.testRecordUuid, daUuid),
            eq(daSignaturesV2.isDeleted, false)
          )
        ),
      db
        .select()
        .from(daAttachmentsV2)
        .where(
          and(
            eq(daAttachmentsV2.testRecordUuid, daUuid),
            eq(daAttachmentsV2.isDeleted, false)
          )
        ),
    ]);

    return {
      ...record,
      equipment,
      personnel,
      signatures,
      attachments,
    };
  }

  async findDuplicate(vesselId: string, dateStr: string, excludeUuid?: string): Promise<DaTestRecordV2 | undefined> {
    const db = getDb();
    const allRecords = await db
      .select()
      .from(daTestRecordsV2)
      .where(
        and(
          eq(daTestRecordsV2.vesselId, vesselId),
          eq(daTestRecordsV2.isDeleted, false)
        )
      );

    const dateRegex = /^(\d{1,2}\s+\w+\s+\d{4})/;

    return allRecords.find((record: DaTestRecordV2) => {
      if (excludeUuid && record.daUuid === excludeUuid) return false;
      if (!record.dateTimeTestCompleted) return false;
      const match = record.dateTimeTestCompleted.match(dateRegex);
      return match && match[1] === dateStr;
    });
  }

  async create(data: Omit<InsertDaTestRecordV2, "daUuid">): Promise<DaTestRecordV2> {
    const db = getDb();
    const results = await db
      .insert(daTestRecordsV2)
      .values({
        ...data,
        daUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    daUuid: string,
    data: Partial<InsertDaTestRecordV2>
  ): Promise<DaTestRecordV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(daTestRecordsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(daTestRecordsV2.daUuid, daUuid))
      .returning();
    return results[0];
  }

  async softDelete(daUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(daTestRecordsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(daTestRecordsV2.daUuid, daUuid))
      .returning();
    return results.length > 0;
  }
}
