import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import {
  candTravelDocuments,
  candVisas,
  candCoc,
  candCop,
  candStcwCertificates,
  candFlagEndorsements,
  candMedicalCertificates,
  candVaccinations,
  candTrainingCertificates,
  candEducation,
  candSeaServiceInternal,
  candSeaServiceExternal,
  candLicenses,
  candDocumentAttachments,
} from "../../../../shared/v2/recruitment/schema";
import type {
  TravelDocument,
  InsertTravelDocument,
  Visa,
  InsertVisa,
  Coc,
  InsertCoc,
  Cop,
  InsertCop,
  StcwCertificate,
  InsertStcwCertificate,
  FlagEndorsement,
  InsertFlagEndorsement,
  MedicalCertificate,
  InsertMedicalCertificate,
  Vaccination,
  InsertVaccination,
  TrainingCertificate,
  InsertTrainingCertificate,
  Education,
  InsertEducation,
  SeaServiceInternal,
  InsertSeaServiceInternal,
  SeaServiceExternal,
  InsertSeaServiceExternal,
  License,
  InsertLicense,
  DocumentAttachment,
  InsertDocumentAttachment,
} from "../../../../shared/v2/recruitment/types";

export class TravelDocumentRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<TravelDocument[]> {
    const db = getDb();
    return db
      .select()
      .from(candTravelDocuments)
      .where(
        and(
          eq(candTravelDocuments.recCanUuid, recCanUuid),
          eq(candTravelDocuments.isDeleted, false)
        )
      );
  }

  async findByUuid(tdocUuid: string): Promise<TravelDocument | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candTravelDocuments)
      .where(
        and(
          eq(candTravelDocuments.tdocUuid, tdocUuid),
          eq(candTravelDocuments.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertTravelDocument): Promise<TravelDocument> {
    const db = getDb();
    const results = await db.insert(candTravelDocuments).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertTravelDocument>): Promise<TravelDocument | undefined> {
    const db = getDb();
    const results = await db
      .update(candTravelDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candTravelDocuments.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candTravelDocuments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candTravelDocuments.id, id))
      .returning();
    return results.length > 0;
  }
}

export class VisaRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<Visa[]> {
    const db = getDb();
    return db
      .select()
      .from(candVisas)
      .where(
        and(
          eq(candVisas.recCanUuid, recCanUuid),
          eq(candVisas.isDeleted, false)
        )
      );
  }

  async findByUuid(visaUuid: string): Promise<Visa | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candVisas)
      .where(
        and(
          eq(candVisas.visaUuid, visaUuid),
          eq(candVisas.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertVisa): Promise<Visa> {
    const db = getDb();
    const results = await db.insert(candVisas).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertVisa>): Promise<Visa | undefined> {
    const db = getDb();
    const results = await db
      .update(candVisas)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candVisas.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candVisas)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candVisas.id, id))
      .returning();
    return results.length > 0;
  }
}

export class CocRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<Coc[]> {
    const db = getDb();
    return db
      .select()
      .from(candCoc)
      .where(
        and(
          eq(candCoc.recCanUuid, recCanUuid),
          eq(candCoc.isDeleted, false)
        )
      );
  }

  async findByUuid(cocUuid: string): Promise<Coc | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candCoc)
      .where(
        and(
          eq(candCoc.cocUuid, cocUuid),
          eq(candCoc.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertCoc): Promise<Coc> {
    const db = getDb();
    const results = await db.insert(candCoc).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertCoc>): Promise<Coc | undefined> {
    const db = getDb();
    const results = await db
      .update(candCoc)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candCoc.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candCoc)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candCoc.id, id))
      .returning();
    return results.length > 0;
  }
}

export class CopRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<Cop[]> {
    const db = getDb();
    return db
      .select()
      .from(candCop)
      .where(
        and(
          eq(candCop.recCanUuid, recCanUuid),
          eq(candCop.isDeleted, false)
        )
      );
  }

  async findByUuid(copUuid: string): Promise<Cop | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candCop)
      .where(
        and(
          eq(candCop.copUuid, copUuid),
          eq(candCop.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertCop): Promise<Cop> {
    const db = getDb();
    const results = await db.insert(candCop).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertCop>): Promise<Cop | undefined> {
    const db = getDb();
    const results = await db
      .update(candCop)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candCop.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candCop)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candCop.id, id))
      .returning();
    return results.length > 0;
  }
}

export class StcwCertificateRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<StcwCertificate[]> {
    const db = getDb();
    return db
      .select()
      .from(candStcwCertificates)
      .where(
        and(
          eq(candStcwCertificates.recCanUuid, recCanUuid),
          eq(candStcwCertificates.isDeleted, false)
        )
      );
  }

  async findByUuid(stcwUuid: string): Promise<StcwCertificate | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candStcwCertificates)
      .where(
        and(
          eq(candStcwCertificates.stcwUuid, stcwUuid),
          eq(candStcwCertificates.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertStcwCertificate): Promise<StcwCertificate> {
    const db = getDb();
    const results = await db.insert(candStcwCertificates).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertStcwCertificate>): Promise<StcwCertificate | undefined> {
    const db = getDb();
    const results = await db
      .update(candStcwCertificates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candStcwCertificates.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candStcwCertificates)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candStcwCertificates.id, id))
      .returning();
    return results.length > 0;
  }
}

export class FlagEndorsementRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<FlagEndorsement[]> {
    const db = getDb();
    return db
      .select()
      .from(candFlagEndorsements)
      .where(
        and(
          eq(candFlagEndorsements.recCanUuid, recCanUuid),
          eq(candFlagEndorsements.isDeleted, false)
        )
      );
  }

  async findByUuid(flagUuid: string): Promise<FlagEndorsement | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candFlagEndorsements)
      .where(
        and(
          eq(candFlagEndorsements.flagUuid, flagUuid),
          eq(candFlagEndorsements.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertFlagEndorsement): Promise<FlagEndorsement> {
    const db = getDb();
    const results = await db.insert(candFlagEndorsements).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertFlagEndorsement>): Promise<FlagEndorsement | undefined> {
    const db = getDb();
    const results = await db
      .update(candFlagEndorsements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candFlagEndorsements.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candFlagEndorsements)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candFlagEndorsements.id, id))
      .returning();
    return results.length > 0;
  }
}

export class MedicalCertificateRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<MedicalCertificate[]> {
    const db = getDb();
    return db
      .select()
      .from(candMedicalCertificates)
      .where(
        and(
          eq(candMedicalCertificates.recCanUuid, recCanUuid),
          eq(candMedicalCertificates.isDeleted, false)
        )
      );
  }

  async findByUuid(medUuid: string): Promise<MedicalCertificate | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candMedicalCertificates)
      .where(
        and(
          eq(candMedicalCertificates.medUuid, medUuid),
          eq(candMedicalCertificates.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertMedicalCertificate): Promise<MedicalCertificate> {
    const db = getDb();
    const results = await db.insert(candMedicalCertificates).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertMedicalCertificate>): Promise<MedicalCertificate | undefined> {
    const db = getDb();
    const results = await db
      .update(candMedicalCertificates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candMedicalCertificates.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candMedicalCertificates)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candMedicalCertificates.id, id))
      .returning();
    return results.length > 0;
  }
}

export class VaccinationRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<Vaccination[]> {
    const db = getDb();
    return db
      .select()
      .from(candVaccinations)
      .where(
        and(
          eq(candVaccinations.recCanUuid, recCanUuid),
          eq(candVaccinations.isDeleted, false)
        )
      );
  }

  async findByUuid(vaccUuid: string): Promise<Vaccination | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candVaccinations)
      .where(
        and(
          eq(candVaccinations.vaccUuid, vaccUuid),
          eq(candVaccinations.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertVaccination): Promise<Vaccination> {
    const db = getDb();
    const results = await db.insert(candVaccinations).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertVaccination>): Promise<Vaccination | undefined> {
    const db = getDb();
    const results = await db
      .update(candVaccinations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candVaccinations.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candVaccinations)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candVaccinations.id, id))
      .returning();
    return results.length > 0;
  }
}

export class TrainingCertificateRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<TrainingCertificate[]> {
    const db = getDb();
    return db
      .select()
      .from(candTrainingCertificates)
      .where(
        and(
          eq(candTrainingCertificates.recCanUuid, recCanUuid),
          eq(candTrainingCertificates.isDeleted, false)
        )
      );
  }

  async findByUuid(trainUuid: string): Promise<TrainingCertificate | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candTrainingCertificates)
      .where(
        and(
          eq(candTrainingCertificates.trainUuid, trainUuid),
          eq(candTrainingCertificates.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertTrainingCertificate): Promise<TrainingCertificate> {
    const db = getDb();
    const results = await db.insert(candTrainingCertificates).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertTrainingCertificate>): Promise<TrainingCertificate | undefined> {
    const db = getDb();
    const results = await db
      .update(candTrainingCertificates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candTrainingCertificates.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candTrainingCertificates)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candTrainingCertificates.id, id))
      .returning();
    return results.length > 0;
  }
}

export class EducationRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<Education[]> {
    const db = getDb();
    return db
      .select()
      .from(candEducation)
      .where(
        and(
          eq(candEducation.recCanUuid, recCanUuid),
          eq(candEducation.isDeleted, false)
        )
      );
  }

  async findByUuid(eduUuid: string): Promise<Education | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candEducation)
      .where(
        and(
          eq(candEducation.eduUuid, eduUuid),
          eq(candEducation.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertEducation): Promise<Education> {
    const db = getDb();
    const results = await db.insert(candEducation).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertEducation>): Promise<Education | undefined> {
    const db = getDb();
    const results = await db
      .update(candEducation)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candEducation.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candEducation)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candEducation.id, id))
      .returning();
    return results.length > 0;
  }
}

export class SeaServiceInternalRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<SeaServiceInternal[]> {
    const db = getDb();
    return db
      .select()
      .from(candSeaServiceInternal)
      .where(
        and(
          eq(candSeaServiceInternal.recCanUuid, recCanUuid),
          eq(candSeaServiceInternal.isDeleted, false)
        )
      );
  }

  async findByUuid(ssIntUuid: string): Promise<SeaServiceInternal | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candSeaServiceInternal)
      .where(
        and(
          eq(candSeaServiceInternal.ssIntUuid, ssIntUuid),
          eq(candSeaServiceInternal.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertSeaServiceInternal): Promise<SeaServiceInternal> {
    const db = getDb();
    const results = await db.insert(candSeaServiceInternal).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertSeaServiceInternal>): Promise<SeaServiceInternal | undefined> {
    const db = getDb();
    const results = await db
      .update(candSeaServiceInternal)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candSeaServiceInternal.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candSeaServiceInternal)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candSeaServiceInternal.id, id))
      .returning();
    return results.length > 0;
  }
}

export class SeaServiceExternalRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<SeaServiceExternal[]> {
    const db = getDb();
    return db
      .select()
      .from(candSeaServiceExternal)
      .where(
        and(
          eq(candSeaServiceExternal.recCanUuid, recCanUuid),
          eq(candSeaServiceExternal.isDeleted, false)
        )
      );
  }

  async findByUuid(ssExtUuid: string): Promise<SeaServiceExternal | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candSeaServiceExternal)
      .where(
        and(
          eq(candSeaServiceExternal.ssExtUuid, ssExtUuid),
          eq(candSeaServiceExternal.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertSeaServiceExternal): Promise<SeaServiceExternal> {
    const db = getDb();
    const results = await db.insert(candSeaServiceExternal).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertSeaServiceExternal>): Promise<SeaServiceExternal | undefined> {
    const db = getDb();
    const results = await db
      .update(candSeaServiceExternal)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candSeaServiceExternal.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candSeaServiceExternal)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candSeaServiceExternal.id, id))
      .returning();
    return results.length > 0;
  }
}

export class LicenseRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<License[]> {
    const db = getDb();
    return db
      .select()
      .from(candLicenses)
      .where(
        and(
          eq(candLicenses.recCanUuid, recCanUuid),
          eq(candLicenses.isDeleted, false)
        )
      );
  }

  async findByUuid(licUuid: string): Promise<License | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candLicenses)
      .where(
        and(
          eq(candLicenses.licUuid, licUuid),
          eq(candLicenses.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertLicense): Promise<License> {
    const db = getDb();
    const results = await db.insert(candLicenses).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertLicense>): Promise<License | undefined> {
    const db = getDb();
    const results = await db
      .update(candLicenses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candLicenses.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candLicenses)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candLicenses.id, id))
      .returning();
    return results.length > 0;
  }
}

export class DocumentAttachmentRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<DocumentAttachment[]> {
    const db = getDb();
    return db
      .select()
      .from(candDocumentAttachments)
      .where(
        and(
          eq(candDocumentAttachments.recCanUuid, recCanUuid),
          eq(candDocumentAttachments.isDeleted, false)
        )
      );
  }

  async findByParentRecord(parentTableName: string, parentRecordUuid: string): Promise<DocumentAttachment[]> {
    const db = getDb();
    return db
      .select()
      .from(candDocumentAttachments)
      .where(
        and(
          eq(candDocumentAttachments.parentTableName, parentTableName),
          eq(candDocumentAttachments.parentRecordUuid, parentRecordUuid),
          eq(candDocumentAttachments.isDeleted, false)
        )
      );
  }

  async findByUuid(attachUuid: string): Promise<DocumentAttachment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candDocumentAttachments)
      .where(
        and(
          eq(candDocumentAttachments.attachUuid, attachUuid),
          eq(candDocumentAttachments.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertDocumentAttachment): Promise<DocumentAttachment> {
    const db = getDb();
    const results = await db.insert(candDocumentAttachments).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertDocumentAttachment>): Promise<DocumentAttachment | undefined> {
    const db = getDb();
    const results = await db
      .update(candDocumentAttachments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candDocumentAttachments.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candDocumentAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candDocumentAttachments.id, id))
      .returning();
    return results.length > 0;
  }
}

export const travelDocumentRepository = new TravelDocumentRepository();
export const visaRepository = new VisaRepository();
export const cocRepository = new CocRepository();
export const copRepository = new CopRepository();
export const stcwCertificateRepository = new StcwCertificateRepository();
export const flagEndorsementRepository = new FlagEndorsementRepository();
export const medicalCertificateRepository = new MedicalCertificateRepository();
export const vaccinationRepository = new VaccinationRepository();
export const trainingCertificateRepository = new TrainingCertificateRepository();
export const educationRepository = new EducationRepository();
export const seaServiceInternalRepository = new SeaServiceInternalRepository();
export const seaServiceExternalRepository = new SeaServiceExternalRepository();
export const licenseRepository = new LicenseRepository();
export const documentAttachmentRepository = new DocumentAttachmentRepository();
