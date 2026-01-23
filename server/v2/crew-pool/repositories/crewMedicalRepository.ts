import { eq, desc, inArray, and } from "drizzle-orm";
import { getDb } from "../../db";
import {
  crewPreJoiningMedicals,
  crewMedicalAttachments,
  crewDoctorVisits,
  crewDoctorVisitsAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewPreJoiningMedical,
  CrewPreJoiningMedical,
  InsertCrewMedicalAttachment,
  CrewMedicalAttachment,
  InsertCrewDoctorVisit,
  CrewDoctorVisit,
  InsertCrewDoctorVisitAttachment,
  CrewDoctorVisitAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewMedicalWithAttachments = CrewPreJoiningMedical & {
  attachments: CrewMedicalAttachment[];
};

export type CrewDoctorVisitWithAttachments = CrewDoctorVisit & {
  attachments: CrewDoctorVisitAttachment[];
};

export class CrewMedicalRepository {
  // Pre-Joining Medicals
  async findMedicalsByCrewUuidWithAttachments(crewUuid: string): Promise<CrewMedicalWithAttachments[]> {
    const db = getDb();
    
    const medicals = await db
      .select()
      .from(crewPreJoiningMedicals)
      .where(
        and(
          eq(crewPreJoiningMedicals.crewUuid, crewUuid),
          eq(crewPreJoiningMedicals.isDeleted, false)
        )
      )
      .orderBy(desc(crewPreJoiningMedicals.examDate));

    if (medicals.length === 0) return [];

    const medUuids = medicals.map((m: CrewPreJoiningMedical) => m.medUuid);
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

    return medicals.map((medical: CrewPreJoiningMedical) => ({
      ...medical,
      attachments: attMap.get(medical.medUuid) || [],
    }));
  }

  async findMedicalByUuid(medUuid: string): Promise<CrewPreJoiningMedical | undefined> {
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

  async findMedicalByUuidWithAttachments(medUuid: string): Promise<CrewMedicalWithAttachments | undefined> {
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
    
    if (results.length === 0) return undefined;
    
    const medical = results[0];
    const attachments = await db
      .select()
      .from(crewMedicalAttachments)
      .where(
        and(
          eq(crewMedicalAttachments.medUuid, medUuid),
          eq(crewMedicalAttachments.isDeleted, false)
        )
      );

    return { ...medical, attachments };
  }

  async createMedical(data: Omit<InsertCrewPreJoiningMedical, "medUuid">): Promise<CrewPreJoiningMedical> {
    const db = getDb();
    const results = await db
      .insert(crewPreJoiningMedicals)
      .values({ ...data, medUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateMedical(medUuid: string, data: Partial<InsertCrewPreJoiningMedical>): Promise<CrewPreJoiningMedical | undefined> {
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

  async addMedicalAttachment(medUuid: string, data: Omit<InsertCrewMedicalAttachment, "medUuid" | "attUuid">): Promise<CrewMedicalAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewMedicalAttachments)
      .values({ ...data, medUuid, attUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async findMedicalAttachment(attUuid: string): Promise<CrewMedicalAttachment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewMedicalAttachments)
      .where(
        and(
          eq(crewMedicalAttachments.attUuid, attUuid),
          eq(crewMedicalAttachments.isDeleted, false)
        )
      );
    return results[0];
  }

  async removeMedicalAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewMedicalAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewMedicalAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }

  // Doctor Visits
  async findVisitsByCrewUuidWithAttachments(crewUuid: string): Promise<CrewDoctorVisitWithAttachments[]> {
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
      .orderBy(desc(crewDoctorVisits.visitDate));

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

  async findVisitByUuid(visitUuid: string): Promise<CrewDoctorVisit | undefined> {
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

  async findVisitByUuidWithAttachments(visitUuid: string): Promise<CrewDoctorVisitWithAttachments | undefined> {
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
    
    if (results.length === 0) return undefined;
    
    const visit = results[0];
    const attachments = await db
      .select()
      .from(crewDoctorVisitsAttachments)
      .where(
        and(
          eq(crewDoctorVisitsAttachments.visitUuid, visitUuid),
          eq(crewDoctorVisitsAttachments.isDeleted, false)
        )
      );

    return { ...visit, attachments };
  }

  async createVisit(data: Omit<InsertCrewDoctorVisit, "visitUuid">): Promise<CrewDoctorVisit> {
    const db = getDb();
    const results = await db
      .insert(crewDoctorVisits)
      .values({ ...data, visitUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateVisit(visitUuid: string, data: Partial<InsertCrewDoctorVisit>): Promise<CrewDoctorVisit | undefined> {
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

  async addVisitAttachment(visitUuid: string, data: Omit<InsertCrewDoctorVisitAttachment, "visitUuid" | "attUuid">): Promise<CrewDoctorVisitAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewDoctorVisitsAttachments)
      .values({ ...data, visitUuid, attUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async findVisitAttachment(attUuid: string): Promise<CrewDoctorVisitAttachment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewDoctorVisitsAttachments)
      .where(
        and(
          eq(crewDoctorVisitsAttachments.attUuid, attUuid),
          eq(crewDoctorVisitsAttachments.isDeleted, false)
        )
      );
    return results[0];
  }

  async removeVisitAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewDoctorVisitsAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewDoctorVisitsAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }

  // Get all medical info for a crew member
  async findAllMedicalInfo(crewUuid: string): Promise<{
    medicals: CrewMedicalWithAttachments[];
    visits: CrewDoctorVisitWithAttachments[];
  }> {
    const [medicals, visits] = await Promise.all([
      this.findMedicalsByCrewUuidWithAttachments(crewUuid),
      this.findVisitsByCrewUuidWithAttachments(crewUuid),
    ]);
    return { medicals, visits };
  }
}

export const crewMedicalRepository = new CrewMedicalRepository();
