import { eq, and, inArray, sql, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  crewPreJoiningMedicals,
  crewMedicalAttachments,
  crewDoctorVisits,
  crewDoctorVisitsAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import { masterVessels } from "../../../../shared/schema";
import type {
  CrewPreJoiningMedical,
  InsertCrewPreJoiningMedical,
  CrewMedicalAttachment,
  InsertCrewMedicalAttachment,
  CrewDoctorVisit,
  InsertCrewDoctorVisit,
  CrewDoctorVisitAttachment,
  InsertCrewDoctorVisitAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewPreJoiningMedicalWithAttachments = CrewPreJoiningMedical & {
  attachments: CrewMedicalAttachment[];
};

export type CrewDoctorVisitWithAttachments = CrewDoctorVisit & {
  attachments: CrewDoctorVisitAttachment[];
};

export class CrewMedicalRepository {
  // ============ Pre-Joining Medicals ============
  async findMedicalsByCrewUuid(
    crewUuid: string
  ): Promise<CrewPreJoiningMedical[]> {
    const db = getDb();
    return db
      .select()
      .from(crewPreJoiningMedicals)
      .where(
        and(
          eq(crewPreJoiningMedicals.crewUuid, crewUuid),
          eq(crewPreJoiningMedicals.isDeleted, false)
        )
      );
  }

  async findMedicalsByCrewUuidWithAttachments(
    crewUuid: string
  ): Promise<CrewPreJoiningMedicalWithAttachments[]> {
    const db = getDb();
    const medicalsWithVessel = await db
      .select({
        id: crewPreJoiningMedicals.id,
        medUuid: crewPreJoiningMedicals.medUuid,
        crewUuid: crewPreJoiningMedicals.crewUuid,
        vesselUuid: crewPreJoiningMedicals.vesselUuid,
        vesselName: masterVessels.vessel,
        examinationDate: crewPreJoiningMedicals.examinationDate,
        bp: crewPreJoiningMedicals.bp,
        weight: crewPreJoiningMedicals.weight,
        anyMedicationPrescribed: crewPreJoiningMedicals.anyMedicationPrescribed,
        clinicHospital: crewPreJoiningMedicals.clinicHospital,
        fitForDuty: crewPreJoiningMedicals.fitForDuty,
        expiryDate: crewPreJoiningMedicals.expiryDate,
        sortOrder: crewPreJoiningMedicals.sortOrder,
        createdAt: crewPreJoiningMedicals.createdAt,
        createdByUuid: crewPreJoiningMedicals.createdByUuid,
        updatedAt: crewPreJoiningMedicals.updatedAt,
        updatedByUuid: crewPreJoiningMedicals.updatedByUuid,
        isDeleted: crewPreJoiningMedicals.isDeleted,
        isSync: crewPreJoiningMedicals.isSync,
      })
      .from(crewPreJoiningMedicals)
      .leftJoin(masterVessels, eq(crewPreJoiningMedicals.vesselUuid, masterVessels.vesselUuid))
      .where(
        and(
          eq(crewPreJoiningMedicals.crewUuid, crewUuid),
          eq(crewPreJoiningMedicals.isDeleted, false)
        )
      )
      .orderBy(asc(crewPreJoiningMedicals.sortOrder), asc(crewPreJoiningMedicals.createdAt));

    if (medicalsWithVessel.length === 0) return [];

    const medUuids = medicalsWithVessel.map((m: { medUuid: string }) => m.medUuid);
    const attachments = await db
      .select()
      .from(crewMedicalAttachments)
      .where(
        and(
          inArray(crewMedicalAttachments.medUuid, medUuids),
          eq(crewMedicalAttachments.isDeleted, false)
        )
      );

    const attMap = new Map<string, CrewMedicalAttachment[]>();
    attachments.forEach((att: CrewMedicalAttachment) => {
      const existing = attMap.get(att.medUuid) || [];
      existing.push(att);
      attMap.set(att.medUuid, existing);
    });

    return medicalsWithVessel.map((medical: { medUuid: string; vesselName: string | null; [key: string]: any }) => ({
      ...medical,
      attachments: attMap.get(medical.medUuid) || [],
    }));
  }

  async findMedicalByUuid(
    medUuid: string
  ): Promise<CrewPreJoiningMedical | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewPreJoiningMedicals)
      .where(
        and(
          eq(crewPreJoiningMedicals.medUuid, medUuid),
          eq(crewPreJoiningMedicals.isDeleted, false)
        )
      );
    return results[0];
  }

  async createMedical(
    data: Omit<InsertCrewPreJoiningMedical, "medUuid">
  ): Promise<CrewPreJoiningMedical> {
    const db = getDb();
    const results = await db
      .insert(crewPreJoiningMedicals)
      .values({
        ...data,
        medUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async updateMedical(
    medUuid: string,
    data: Partial<InsertCrewPreJoiningMedical>
  ): Promise<CrewPreJoiningMedical | undefined> {
    const db = getDb();
    const results = await db
      .update(crewPreJoiningMedicals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewPreJoiningMedicals.medUuid, medUuid))
      .returning();
    return results[0];
  }

  async softDeleteMedical(medUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .update(crewMedicalAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewMedicalAttachments.medUuid, medUuid));

    const results = await db
      .update(crewPreJoiningMedicals)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewPreJoiningMedicals.medUuid, medUuid))
      .returning();
    return results.length > 0;
  }

  async hardDeleteMedical(medUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .delete(crewMedicalAttachments)
      .where(eq(crewMedicalAttachments.medUuid, medUuid));

    const results = await db
      .delete(crewPreJoiningMedicals)
      .where(eq(crewPreJoiningMedicals.medUuid, medUuid))
      .returning();
    return results.length > 0;
  }

  // ============ Medical Attachments ============
  async findMedicalAttachmentsByMedUuid(
    medUuid: string
  ): Promise<CrewMedicalAttachment[]> {
    const db = getDb();
    return db
      .select()
      .from(crewMedicalAttachments)
      .where(
        and(
          eq(crewMedicalAttachments.medUuid, medUuid),
          eq(crewMedicalAttachments.isDeleted, false)
        )
      );
  }

  async addMedicalAttachment(
    data: Omit<InsertCrewMedicalAttachment, "attUuid">
  ): Promise<CrewMedicalAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewMedicalAttachments)
      .values({
        ...data,
        attUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async softDeleteMedicalAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewMedicalAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewMedicalAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }

  // ============ Doctor Visits ============
  async findVisitsByCrewUuid(crewUuid: string): Promise<CrewDoctorVisit[]> {
    const db = getDb();
    return db
      .select()
      .from(crewDoctorVisits)
      .where(
        and(
          eq(crewDoctorVisits.crewUuid, crewUuid),
          eq(crewDoctorVisits.isDeleted, false)
        )
      );
  }

  async findVisitsByCrewUuidWithAttachments(
    crewUuid: string
  ): Promise<CrewDoctorVisitWithAttachments[]> {
    const db = getDb();
    const visits = await db
      .select()
      .from(crewDoctorVisits)
      .where(
        and(
          eq(crewDoctorVisits.crewUuid, crewUuid),
          eq(crewDoctorVisits.isDeleted, false)
        )
      )
      .orderBy(asc(crewDoctorVisits.sortOrder), asc(crewDoctorVisits.createdAt));

    if (visits.length === 0) return [];

    const visitUuids = visits.map((v: CrewDoctorVisit) => v.visitUuid);
    const attachments = await db
      .select()
      .from(crewDoctorVisitsAttachments)
      .where(
        and(
          inArray(crewDoctorVisitsAttachments.visitUuid, visitUuids),
          eq(crewDoctorVisitsAttachments.isDeleted, false)
        )
      );

    const attMap = new Map<string, CrewDoctorVisitAttachment[]>();
    attachments.forEach((att: CrewDoctorVisitAttachment) => {
      const existing = attMap.get(att.visitUuid) || [];
      existing.push(att);
      attMap.set(att.visitUuid, existing);
    });

    return visits.map((visit: CrewDoctorVisit) => ({
      ...visit,
      attachments: attMap.get(visit.visitUuid) || [],
    }));
  }

  async findVisitByUuid(
    visitUuid: string
  ): Promise<CrewDoctorVisit | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewDoctorVisits)
      .where(
        and(
          eq(crewDoctorVisits.visitUuid, visitUuid),
          eq(crewDoctorVisits.isDeleted, false)
        )
      );
    return results[0];
  }

  async createVisit(
    data: Omit<InsertCrewDoctorVisit, "visitUuid">
  ): Promise<CrewDoctorVisit> {
    const db = getDb();
    const results = await db
      .insert(crewDoctorVisits)
      .values({
        ...data,
        visitUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async updateVisit(
    visitUuid: string,
    data: Partial<InsertCrewDoctorVisit>
  ): Promise<CrewDoctorVisit | undefined> {
    const db = getDb();
    const results = await db
      .update(crewDoctorVisits)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewDoctorVisits.visitUuid, visitUuid))
      .returning();
    return results[0];
  }

  async softDeleteVisit(visitUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .update(crewDoctorVisitsAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewDoctorVisitsAttachments.visitUuid, visitUuid));

    const results = await db
      .update(crewDoctorVisits)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewDoctorVisits.visitUuid, visitUuid))
      .returning();
    return results.length > 0;
  }

  async hardDeleteVisit(visitUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .delete(crewDoctorVisitsAttachments)
      .where(eq(crewDoctorVisitsAttachments.visitUuid, visitUuid));

    const results = await db
      .delete(crewDoctorVisits)
      .where(eq(crewDoctorVisits.visitUuid, visitUuid))
      .returning();
    return results.length > 0;
  }

  // ============ Doctor Visit Attachments ============
  async findVisitAttachmentsByVisitUuid(
    visitUuid: string
  ): Promise<CrewDoctorVisitAttachment[]> {
    const db = getDb();
    return db
      .select()
      .from(crewDoctorVisitsAttachments)
      .where(
        and(
          eq(crewDoctorVisitsAttachments.visitUuid, visitUuid),
          eq(crewDoctorVisitsAttachments.isDeleted, false)
        )
      );
  }

  async addVisitAttachment(
    data: Omit<InsertCrewDoctorVisitAttachment, "attUuid">
  ): Promise<CrewDoctorVisitAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewDoctorVisitsAttachments)
      .values({
        ...data,
        attUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async softDeleteVisitAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewDoctorVisitsAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewDoctorVisitsAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }

  // ============ Combined Medical Data ============
  async findAllMedicalDataByCrewUuid(crewUuid: string) {
    const [medicals, visits] = await Promise.all([
      this.findMedicalsByCrewUuidWithAttachments(crewUuid),
      this.findVisitsByCrewUuidWithAttachments(crewUuid),
    ]);
    return { medicals, visits };
  }
}
