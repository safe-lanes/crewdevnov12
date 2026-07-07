import { eq, and, asc, desc, ne } from "drizzle-orm";
import { getDb } from "../../db";
import {
  daTestRecordsV2,
  daTestingEquipmentV2,
  daPersonnelTestedV2,
  daSignaturesV2,
  daAttachmentsV2,
} from "../../../../shared/v2/drugs-alcohol/schema";
import { masterVessels } from "../../../../shared/schema";
import {
  crewMembersV2,
  crewPersonalDetails,
} from "../../../../shared/v2/crew-pool/schema";
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
        .where(eq(daPersonnelTestedV2.isDeleted, false))
        .orderBy(asc(daPersonnelTestedV2.sortOrder)),
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
        )
        .orderBy(asc(daPersonnelTestedV2.sortOrder)),
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

  async findFinalizedWithViolatingPersonnel(): Promise<
    Array<{
      testType: string | null;
      dateTimeTestCompleted: string | null;
      incidentDateTime: string | null;
      testDateTime: string | null;
      alcoholViolation: boolean | null;
      drugViolation: boolean | null;
    }>
  > {
    const rows = await this.findFinalizedViolatingPersonnelDetailed();
    return rows.map((r) => ({
      testType: r.testType,
      dateTimeTestCompleted: r.dateTimeTestCompleted,
      incidentDateTime: r.incidentDateTime,
      testDateTime: r.testDateTime,
      alcoholViolation: r.alcoholViolation,
      drugViolation: r.drugViolation,
    }));
  }

  async findFinalizedViolatingPersonnelDetailed(): Promise<
    Array<{
      daUuid: string;
      vesselId: string | null;
      vesselName: string | null;
      testType: string | null;
      otherTestType: string | null;
      dateTimeTestCompleted: string | null;
      incidentDateTime: string | null;
      testDateTime: string | null;
      crewId: string | null;
      rank: string | null;
      crewPool: string | null;
      manningAgent: string | null;
      nationalityUuid: string | null;
      alcoholViolation: boolean | null;
      drugViolation: boolean | null;
    }>
  > {
    const db = getDb();
    const rows = await db
      .select({
        daUuid: daTestRecordsV2.daUuid,
        vesselId: daTestRecordsV2.vesselId,
        vesselName: masterVessels.vessel,
        testType: daTestRecordsV2.testType,
        otherTestType: daTestRecordsV2.otherTestType,
        dateTimeTestCompleted: daTestRecordsV2.dateTimeTestCompleted,
        incidentDateTime: daTestRecordsV2.incidentDateTime,
        testDateTime: daTestRecordsV2.testDateTime,
        crewId: daPersonnelTestedV2.crewId,
        rank: daPersonnelTestedV2.rank,
        crewPool: crewPersonalDetails.crewPool,
        manningAgent: crewPersonalDetails.manningAgent,
        nationalityUuid: crewMembersV2.nationalityUuid,
        alcoholViolation: daPersonnelTestedV2.alcoholViolation,
        drugViolation: daPersonnelTestedV2.drugViolation,
      })
      .from(daTestRecordsV2)
      .innerJoin(
        daPersonnelTestedV2,
        eq(daPersonnelTestedV2.testRecordUuid, daTestRecordsV2.daUuid)
      )
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, daTestRecordsV2.vesselId))
      .leftJoin(
        crewMembersV2,
        and(
          eq(crewMembersV2.crewUuid, daPersonnelTestedV2.crewId),
          eq(crewMembersV2.isDeleted, false)
        )
      )
      .leftJoin(
        crewPersonalDetails,
        and(
          eq(crewPersonalDetails.crewUuid, daPersonnelTestedV2.crewId),
          eq(crewPersonalDetails.isDeleted, false)
        )
      )
      .where(
        and(
          eq(daTestRecordsV2.isDeleted, false),
          ne(daTestRecordsV2.status, "draft"),
          eq(daPersonnelTestedV2.isDeleted, false)
        )
      );
    return rows;
  }

  async create(data: Omit<InsertDaTestRecordV2, "daUuid">): Promise<DaTestRecordV2> {
    const db = getDb();
    // Lock fields can never come from the regular save payload
    const { isLocked, lockedOnce, ...safeData } = data as any;
    // Auto-lock on first submit (new form submitted directly)
    const lockFields =
      safeData.status === "submitted"
        ? { isLocked: true, lockedOnce: true }
        : {};
    const results = await db
      .insert(daTestRecordsV2)
      .values({
        ...safeData,
        ...lockFields,
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
    // Lock fields can never come from the regular save payload
    const { isLocked, lockedOnce, ...safeData } = data as any;
    const updateData: any = { ...safeData, updatedAt: new Date() };

    const existing = await this.findByUuid(daUuid);
    if (existing) {
      // Status downgrade guard: a submitted form can never revert to draft
      if (existing.status === "submitted" && "status" in updateData) {
        updateData.status = "submitted";
      }
      // Auto-lock on first submit ever for this record
      if (updateData.status === "submitted" && !existing.lockedOnce) {
        updateData.isLocked = true;
        updateData.lockedOnce = true;
      }
    }

    const results = await db
      .update(daTestRecordsV2)
      .set(updateData)
      .where(eq(daTestRecordsV2.daUuid, daUuid))
      .returning();
    return results[0];
  }

  async toggleLock(
    daUuid: string,
    isLocked: boolean
  ): Promise<DaTestRecordV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(daTestRecordsV2)
      .set({ isLocked, updatedAt: new Date() })
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
