import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  CrewMedicalRepository,
  type CrewPreJoiningMedicalWithAttachments,
  type CrewDoctorVisitWithAttachments,
} from "../repositories";
import { crewMembersService } from "./crewMembersService";
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

const crewMedicalRepository = new CrewMedicalRepository();

export const crewMedicalService = {
  // ============ Pre-Joining Medicals ============
  async getMedicals(
    crewUuid: string
  ): Promise<CrewPreJoiningMedicalWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewMedicalRepository.findMedicalsByCrewUuidWithAttachments(
      crewUuid
    );
  },

  async getMedicalByUuid(medUuid: string): Promise<CrewPreJoiningMedical> {
    const medical = await crewMedicalRepository.findMedicalByUuid(medUuid);
    if (!medical) {
      throw new Error(`Medical record not found: ${medUuid}`);
    }
    return medical;
  },

  async createMedical(
    crewUuid: string,
    data: Omit<InsertCrewPreJoiningMedical, "medUuid" | "crewUuid">
  ): Promise<CrewPreJoiningMedical> {
    await crewMembersService.getByUuid(crewUuid);
    return crewMedicalRepository.createMedical({ ...data, crewUuid });
  },

  async updateMedical(
    medUuid: string,
    data: Partial<InsertCrewPreJoiningMedical>
  ): Promise<CrewPreJoiningMedical> {
    await this.getMedicalByUuid(medUuid);

    const updated = await crewMedicalRepository.updateMedical(medUuid, data);
    if (!updated) {
      throw new Error(`Failed to update medical record: ${medUuid}`);
    }
    return updated;
  },

  async deleteMedical(medUuid: string): Promise<void> {
    await this.getMedicalByUuid(medUuid);
    const success = await crewMedicalRepository.softDeleteMedical(medUuid);
    if (!success) {
      throw new Error(`Failed to delete medical record: ${medUuid}`);
    }
  },

  async addMedicalAttachment(
    medUuid: string,
    file: Omit<InsertCrewMedicalAttachment, "attUuid" | "medUuid">
  ): Promise<CrewMedicalAttachment> {
    await this.getMedicalByUuid(medUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewMedicalRepository.addMedicalAttachment({ ...file, medUuid });
  },

  async removeMedicalAttachment(attUuid: string): Promise<void> {
    const success =
      await crewMedicalRepository.softDeleteMedicalAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
  },

  // ============ Doctor Visits ============
  async getDoctorVisits(
    crewUuid: string
  ): Promise<CrewDoctorVisitWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewMedicalRepository.findVisitsByCrewUuidWithAttachments(crewUuid);
  },

  async getVisitByUuid(visitUuid: string): Promise<CrewDoctorVisit> {
    const visit = await crewMedicalRepository.findVisitByUuid(visitUuid);
    if (!visit) {
      throw new Error(`Doctor visit not found: ${visitUuid}`);
    }
    return visit;
  },

  async createVisit(
    crewUuid: string,
    data: Omit<InsertCrewDoctorVisit, "visitUuid" | "crewUuid">
  ): Promise<CrewDoctorVisit> {
    await crewMembersService.getByUuid(crewUuid);
    return crewMedicalRepository.createVisit({ ...data, crewUuid });
  },

  async updateVisit(
    visitUuid: string,
    data: Partial<InsertCrewDoctorVisit>
  ): Promise<CrewDoctorVisit> {
    await this.getVisitByUuid(visitUuid);

    const updated = await crewMedicalRepository.updateVisit(visitUuid, data);
    if (!updated) {
      throw new Error(`Failed to update doctor visit: ${visitUuid}`);
    }
    return updated;
  },

  async deleteVisit(visitUuid: string): Promise<void> {
    await this.getVisitByUuid(visitUuid);
    const success = await crewMedicalRepository.softDeleteVisit(visitUuid);
    if (!success) {
      throw new Error(`Failed to delete doctor visit: ${visitUuid}`);
    }
  },

  async addVisitAttachment(
    visitUuid: string,
    file: Omit<InsertCrewDoctorVisitAttachment, "attUuid" | "visitUuid">
  ): Promise<CrewDoctorVisitAttachment> {
    await this.getVisitByUuid(visitUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewMedicalRepository.addVisitAttachment({ ...file, visitUuid });
  },

  async removeVisitAttachment(attUuid: string): Promise<void> {
    const success =
      await crewMedicalRepository.softDeleteVisitAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
  },

  // ============ Fitness Status ============
  async getFitnessStatus(crewUuid: string) {
    const medicals = await this.getMedicals(crewUuid);

    if (medicals.length === 0) {
      return {
        status: "unknown",
        message: "No medical records found",
        latestMedical: null,
      };
    }

    const sortedMedicals = [...medicals].sort((a, b) => {
      const dateA = a.examinationDate
        ? new Date(a.examinationDate).getTime()
        : 0;
      const dateB = b.examinationDate
        ? new Date(b.examinationDate).getTime()
        : 0;
      return dateB - dateA;
    });

    const latestMedical = sortedMedicals[0];

    if (
      latestMedical.expiryDate &&
      new Date(latestMedical.expiryDate) < new Date()
    ) {
      return {
        status: "expired",
        message: "Medical certificate expired",
        expiryDate: latestMedical.expiryDate,
        latestMedical,
      };
    }

    return {
      status: "valid",
      fitForDuty: latestMedical.fitForDuty,
      expiryDate: latestMedical.expiryDate,
      latestMedical,
    };
  },

  // ============ Combined Data ============
  async getAllMedicalData(crewUuid: string) {
    await crewMembersService.getByUuid(crewUuid);
    return crewMedicalRepository.findAllMedicalDataByCrewUuid(crewUuid);
  },

  /**
   * Reconcile medicals with attachments - handles add/update/delete in one transaction
   */
  async reconcileMedicalsWithAttachments(
    crewUuid: string,
    items: Array<{
      medUuid?: string;
      isDeleted?: boolean;
      data: Omit<InsertCrewPreJoiningMedical, "medUuid" | "crewUuid">;
      attachments?: Array<{
        attUuid?: string;
        isNew?: boolean;
        fileName: string;
        filePath?: string;
        fileData?: string;
      }>;
    }>
  ): Promise<CrewPreJoiningMedical[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    return db.transaction(async (tx: any) => {
      const results: CrewPreJoiningMedical[] = [];
      const now = new Date();

      for (const item of items) {
        if (item.isDeleted && item.medUuid) {
          await tx
            .update(crewPreJoiningMedicals)
            .set({ isDeleted: true, updatedAt: now })
            .where(eq(crewPreJoiningMedicals.medUuid, item.medUuid));
          continue;
        }

        let medUuid: string;

        if (item.medUuid) {
          const [updated] = await tx
            .update(crewPreJoiningMedicals)
            .set({ ...item.data, updatedAt: now })
            .where(eq(crewPreJoiningMedicals.medUuid, item.medUuid))
            .returning();
          medUuid = item.medUuid;
          results.push(updated);
        } else {
          medUuid = uuidv4();
          const [created] = await tx
            .insert(crewPreJoiningMedicals)
            .values({
              ...item.data,
              medUuid,
              crewUuid,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
          results.push(created);
        }

        if (item.attachments) {
          for (const att of item.attachments) {
            if (att.isNew && (att.filePath || att.fileData)) {
              await tx.insert(crewMedicalAttachments).values({
                attUuid: uuidv4(),
                medUuid,
                fileName: att.fileName,
                filePath: att.filePath || null,
                fileData: att.fileData || null,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      }

      return results;
    });
  },

  /**
   * Reconcile doctor visits with attachments - handles add/update/delete in one transaction
   */
  async reconcileVisitsWithAttachments(
    crewUuid: string,
    items: Array<{
      visitUuid?: string;
      isDeleted?: boolean;
      data: Omit<InsertCrewDoctorVisit, "visitUuid" | "crewUuid">;
      attachments?: Array<{
        attUuid?: string;
        isNew?: boolean;
        fileName: string;
        filePath?: string;
        fileData?: string;
      }>;
    }>
  ): Promise<CrewDoctorVisit[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    return db.transaction(async (tx: any) => {
      const results: CrewDoctorVisit[] = [];
      const now = new Date();

      for (const item of items) {
        if (item.isDeleted && item.visitUuid) {
          await tx
            .update(crewDoctorVisits)
            .set({ isDeleted: true, updatedAt: now })
            .where(eq(crewDoctorVisits.visitUuid, item.visitUuid));
          continue;
        }

        let visitUuid: string;

        if (item.visitUuid) {
          const [updated] = await tx
            .update(crewDoctorVisits)
            .set({ ...item.data, updatedAt: now })
            .where(eq(crewDoctorVisits.visitUuid, item.visitUuid))
            .returning();
          visitUuid = item.visitUuid;
          results.push(updated);
        } else {
          visitUuid = uuidv4();
          const [created] = await tx
            .insert(crewDoctorVisits)
            .values({
              ...item.data,
              visitUuid,
              crewUuid,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
          results.push(created);
        }

        if (item.attachments) {
          for (const att of item.attachments) {
            if (att.isNew && (att.filePath || att.fileData)) {
              await tx.insert(crewDoctorVisitsAttachments).values({
                attUuid: uuidv4(),
                visitUuid,
                fileName: att.fileName,
                filePath: att.filePath || null,
                fileData: att.fileData || null,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      }

      return results;
    });
  },
};
