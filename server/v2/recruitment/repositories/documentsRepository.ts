import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  candDocuments,
  candDocumentsAttachments,
  candVisas,
  candVisasAttachments,
  candEducation,
  candEducationAttachments,
  candLicenses,
  candLicensesAttachments,
  candTrainingCourses,
  candTrainingAttachments,
  candSeaService,
  candSeaServiceAttachments,
  candAdditionalInfo,
  candAdditionalInfoAttachments,
} from "../../../../shared/v2/recruitment/schema";
import type {
  CandDocument,
  InsertDocument,
  CandDocumentAttachment,
  InsertDocumentAttachment,
  CandVisa,
  InsertVisa,
  CandVisaAttachment,
  InsertVisaAttachment,
  CandEducation,
  InsertEducation,
  CandEducationAttachment,
  InsertEducationAttachment,
  CandLicense,
  InsertLicense,
  CandLicenseAttachment,
  InsertLicenseAttachment,
  CandTrainingCourse,
  InsertTrainingCourse,
  CandTrainingAttachment,
  InsertTrainingAttachment,
  CandSeaService,
  InsertSeaService,
  CandSeaServiceAttachment,
  InsertSeaServiceAttachment,
  CandAdditionalInfo,
  InsertAdditionalInfo,
  CandAdditionalInfoAttachment,
  InsertAdditionalInfoAttachment,
} from "../../../../shared/v2/recruitment/types";

export class DocumentsRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandDocument[]> {
    const db = getDb();
    return db.select().from(candDocuments).where(
      and(eq(candDocuments.recCanUuid, recCanUuid), eq(candDocuments.isDeleted, false))
    ).orderBy(asc(candDocuments.sortOrder), asc(candDocuments.createdAt));
  }

  async findByUuid(docUuid: string): Promise<CandDocument | undefined> {
    const db = getDb();
    const results = await db.select().from(candDocuments).where(
      and(eq(candDocuments.docUuid, docUuid), eq(candDocuments.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertDocument): Promise<CandDocument> {
    const db = getDb();
    const results = await db.insert(candDocuments).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertDocument>): Promise<CandDocument | undefined> {
    const db = getDb();
    const results = await db.update(candDocuments).set({ ...data, updatedAt: new Date() }).where(eq(candDocuments.id, id)).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candDocuments).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candDocuments.id, id)).returning();
    return results.length > 0;
  }
}

export class DocumentAttachmentsRepository {
  async findByDocUuid(docUuid: string): Promise<CandDocumentAttachment[]> {
    const db = getDb();
    return db.select().from(candDocumentsAttachments).where(
      and(eq(candDocumentsAttachments.docUuid, docUuid), eq(candDocumentsAttachments.isDeleted, false))
    ).orderBy(asc(candDocumentsAttachments.sortOrder), asc(candDocumentsAttachments.createdAt));
  }

  async findByUuid(attUuid: string): Promise<CandDocumentAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candDocumentsAttachments).where(
      eq(candDocumentsAttachments.attUuid, attUuid)
    );
    return results[0];
  }

  async findById(id: number): Promise<CandDocumentAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candDocumentsAttachments).where(
      eq(candDocumentsAttachments.id, id)
    );
    return results[0];
  }

  async create(data: InsertDocumentAttachment): Promise<CandDocumentAttachment> {
    const db = getDb();
    const results = await db.insert(candDocumentsAttachments).values(data).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candDocumentsAttachments).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candDocumentsAttachments.id, id)).returning();
    return results.length > 0;
  }

  async hardDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.delete(candDocumentsAttachments).where(eq(candDocumentsAttachments.id, id)).returning();
    return results.length > 0;
  }
}

export class VisasRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandVisa[]> {
    const db = getDb();
    return db.select().from(candVisas).where(
      and(eq(candVisas.recCanUuid, recCanUuid), eq(candVisas.isDeleted, false))
    ).orderBy(asc(candVisas.sortOrder), asc(candVisas.createdAt));
  }

  async findByUuid(visaUuid: string): Promise<CandVisa | undefined> {
    const db = getDb();
    const results = await db.select().from(candVisas).where(
      and(eq(candVisas.visaUuid, visaUuid), eq(candVisas.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertVisa): Promise<CandVisa> {
    const db = getDb();
    const results = await db.insert(candVisas).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertVisa>): Promise<CandVisa | undefined> {
    const db = getDb();
    const results = await db.update(candVisas).set({ ...data, updatedAt: new Date() }).where(eq(candVisas.id, id)).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candVisas).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candVisas.id, id)).returning();
    return results.length > 0;
  }
}

export class VisaAttachmentsRepository {
  async findByVisaUuid(visaUuid: string): Promise<CandVisaAttachment[]> {
    const db = getDb();
    return db.select().from(candVisasAttachments).where(
      and(eq(candVisasAttachments.visaUuid, visaUuid), eq(candVisasAttachments.isDeleted, false))
    ).orderBy(asc(candVisasAttachments.sortOrder), asc(candVisasAttachments.createdAt));
  }

  async findByUuid(attUuid: string): Promise<CandVisaAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candVisasAttachments).where(
      eq(candVisasAttachments.attUuid, attUuid)
    );
    return results[0];
  }

  async findById(id: number): Promise<CandVisaAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candVisasAttachments).where(
      eq(candVisasAttachments.id, id)
    );
    return results[0];
  }

  async create(data: InsertVisaAttachment): Promise<CandVisaAttachment> {
    const db = getDb();
    const results = await db.insert(candVisasAttachments).values(data).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candVisasAttachments).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candVisasAttachments.id, id)).returning();
    return results.length > 0;
  }

  async hardDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.delete(candVisasAttachments).where(eq(candVisasAttachments.id, id)).returning();
    return results.length > 0;
  }
}

export class EducationRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandEducation[]> {
    const db = getDb();
    return db.select().from(candEducation).where(
      and(eq(candEducation.recCanUuid, recCanUuid), eq(candEducation.isDeleted, false))
    ).orderBy(asc(candEducation.sortOrder), asc(candEducation.createdAt));
  }

  async findByUuid(eduUuid: string): Promise<CandEducation | undefined> {
    const db = getDb();
    const results = await db.select().from(candEducation).where(
      and(eq(candEducation.eduUuid, eduUuid), eq(candEducation.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertEducation): Promise<CandEducation> {
    const db = getDb();
    const results = await db.insert(candEducation).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertEducation>): Promise<CandEducation | undefined> {
    const db = getDb();
    const results = await db.update(candEducation).set({ ...data, updatedAt: new Date() }).where(eq(candEducation.id, id)).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candEducation).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candEducation.id, id)).returning();
    return results.length > 0;
  }
}

export class EducationAttachmentsRepository {
  async findByEduUuid(eduUuid: string): Promise<CandEducationAttachment[]> {
    const db = getDb();
    return db.select().from(candEducationAttachments).where(
      and(eq(candEducationAttachments.eduUuid, eduUuid), eq(candEducationAttachments.isDeleted, false))
    ).orderBy(asc(candEducationAttachments.sortOrder), asc(candEducationAttachments.createdAt));
  }

  async findByUuid(attUuid: string): Promise<CandEducationAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candEducationAttachments).where(
      eq(candEducationAttachments.attUuid, attUuid)
    );
    return results[0];
  }

  async findById(id: number): Promise<CandEducationAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candEducationAttachments).where(
      eq(candEducationAttachments.id, id)
    );
    return results[0];
  }

  async create(data: InsertEducationAttachment): Promise<CandEducationAttachment> {
    const db = getDb();
    const results = await db.insert(candEducationAttachments).values(data).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candEducationAttachments).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candEducationAttachments.id, id)).returning();
    return results.length > 0;
  }

  async hardDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.delete(candEducationAttachments).where(eq(candEducationAttachments.id, id)).returning();
    return results.length > 0;
  }
}

export class LicensesRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandLicense[]> {
    const db = getDb();
    return db.select().from(candLicenses).where(
      and(eq(candLicenses.recCanUuid, recCanUuid), eq(candLicenses.isDeleted, false))
    ).orderBy(asc(candLicenses.sortOrder), asc(candLicenses.createdAt));
  }

  async findByUuid(licUuid: string): Promise<CandLicense | undefined> {
    const db = getDb();
    const results = await db.select().from(candLicenses).where(
      and(eq(candLicenses.licUuid, licUuid), eq(candLicenses.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertLicense): Promise<CandLicense> {
    const db = getDb();
    const results = await db.insert(candLicenses).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertLicense>): Promise<CandLicense | undefined> {
    const db = getDb();
    const results = await db.update(candLicenses).set({ ...data, updatedAt: new Date() }).where(eq(candLicenses.id, id)).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candLicenses).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candLicenses.id, id)).returning();
    return results.length > 0;
  }
}

export class LicenseAttachmentsRepository {
  async findByLicUuid(licUuid: string): Promise<CandLicenseAttachment[]> {
    const db = getDb();
    return db.select().from(candLicensesAttachments).where(
      and(eq(candLicensesAttachments.licUuid, licUuid), eq(candLicensesAttachments.isDeleted, false))
    ).orderBy(asc(candLicensesAttachments.sortOrder), asc(candLicensesAttachments.createdAt));
  }

  async findByUuid(attUuid: string): Promise<CandLicenseAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candLicensesAttachments).where(
      eq(candLicensesAttachments.attUuid, attUuid)
    );
    return results[0];
  }

  async findById(id: number): Promise<CandLicenseAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candLicensesAttachments).where(
      eq(candLicensesAttachments.id, id)
    );
    return results[0];
  }

  async create(data: InsertLicenseAttachment): Promise<CandLicenseAttachment> {
    const db = getDb();
    const results = await db.insert(candLicensesAttachments).values(data).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candLicensesAttachments).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candLicensesAttachments.id, id)).returning();
    return results.length > 0;
  }

  async hardDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.delete(candLicensesAttachments).where(eq(candLicensesAttachments.id, id)).returning();
    return results.length > 0;
  }
}

export class TrainingCoursesRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandTrainingCourse[]> {
    const db = getDb();
    return db.select().from(candTrainingCourses).where(
      and(eq(candTrainingCourses.recCanUuid, recCanUuid), eq(candTrainingCourses.isDeleted, false))
    ).orderBy(asc(candTrainingCourses.sortOrder), asc(candTrainingCourses.createdAt));
  }

  async findByUuid(trainUuid: string): Promise<CandTrainingCourse | undefined> {
    const db = getDb();
    const results = await db.select().from(candTrainingCourses).where(
      and(eq(candTrainingCourses.trainUuid, trainUuid), eq(candTrainingCourses.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertTrainingCourse): Promise<CandTrainingCourse> {
    const db = getDb();
    const results = await db.insert(candTrainingCourses).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertTrainingCourse>): Promise<CandTrainingCourse | undefined> {
    const db = getDb();
    const results = await db.update(candTrainingCourses).set({ ...data, updatedAt: new Date() }).where(eq(candTrainingCourses.id, id)).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candTrainingCourses).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candTrainingCourses.id, id)).returning();
    return results.length > 0;
  }
}

export class TrainingAttachmentsRepository {
  async findByTrainUuid(trainUuid: string): Promise<CandTrainingAttachment[]> {
    const db = getDb();
    return db.select().from(candTrainingAttachments).where(
      and(eq(candTrainingAttachments.trainUuid, trainUuid), eq(candTrainingAttachments.isDeleted, false))
    ).orderBy(asc(candTrainingAttachments.sortOrder), asc(candTrainingAttachments.createdAt));
  }

  async findByUuid(attUuid: string): Promise<CandTrainingAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candTrainingAttachments).where(
      eq(candTrainingAttachments.attUuid, attUuid)
    );
    return results[0];
  }

  async findById(id: number): Promise<CandTrainingAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candTrainingAttachments).where(
      eq(candTrainingAttachments.id, id)
    );
    return results[0];
  }

  async create(data: InsertTrainingAttachment): Promise<CandTrainingAttachment> {
    const db = getDb();
    const results = await db.insert(candTrainingAttachments).values(data).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candTrainingAttachments).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candTrainingAttachments.id, id)).returning();
    return results.length > 0;
  }

  async hardDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.delete(candTrainingAttachments).where(eq(candTrainingAttachments.id, id)).returning();
    return results.length > 0;
  }
}

export class SeaServiceRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandSeaService[]> {
    const db = getDb();
    return db.select().from(candSeaService).where(
      and(eq(candSeaService.recCanUuid, recCanUuid), eq(candSeaService.isDeleted, false))
    ).orderBy(asc(candSeaService.sortOrder), asc(candSeaService.createdAt));
  }

  async findByUuid(seaUuid: string): Promise<CandSeaService | undefined> {
    const db = getDb();
    const results = await db.select().from(candSeaService).where(
      and(eq(candSeaService.seaUuid, seaUuid), eq(candSeaService.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertSeaService): Promise<CandSeaService> {
    const db = getDb();
    const results = await db.insert(candSeaService).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertSeaService>): Promise<CandSeaService | undefined> {
    const db = getDb();
    const results = await db.update(candSeaService).set({ ...data, updatedAt: new Date() }).where(eq(candSeaService.id, id)).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candSeaService).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candSeaService.id, id)).returning();
    return results.length > 0;
  }
}

export class SeaServiceAttachmentsRepository {
  async findBySeaUuid(seaUuid: string): Promise<CandSeaServiceAttachment[]> {
    const db = getDb();
    return db.select().from(candSeaServiceAttachments).where(
      and(eq(candSeaServiceAttachments.seaUuid, seaUuid), eq(candSeaServiceAttachments.isDeleted, false))
    ).orderBy(asc(candSeaServiceAttachments.sortOrder), asc(candSeaServiceAttachments.createdAt));
  }

  async findByUuid(attUuid: string): Promise<CandSeaServiceAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candSeaServiceAttachments).where(
      eq(candSeaServiceAttachments.attUuid, attUuid)
    );
    return results[0];
  }

  async findById(id: number): Promise<CandSeaServiceAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candSeaServiceAttachments).where(
      eq(candSeaServiceAttachments.id, id)
    );
    return results[0];
  }

  async create(data: InsertSeaServiceAttachment): Promise<CandSeaServiceAttachment> {
    const db = getDb();
    const results = await db.insert(candSeaServiceAttachments).values(data).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candSeaServiceAttachments).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candSeaServiceAttachments.id, id)).returning();
    return results.length > 0;
  }

  async hardDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.delete(candSeaServiceAttachments).where(eq(candSeaServiceAttachments.id, id)).returning();
    return results.length > 0;
  }
}

export class AdditionalInfoRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandAdditionalInfo[]> {
    const db = getDb();
    return db.select().from(candAdditionalInfo).where(
      and(eq(candAdditionalInfo.recCanUuid, recCanUuid), eq(candAdditionalInfo.isDeleted, false))
    ).orderBy(asc(candAdditionalInfo.sortOrder), asc(candAdditionalInfo.createdAt));
  }

  async findByUuid(infoUuid: string): Promise<CandAdditionalInfo | undefined> {
    const db = getDb();
    const results = await db.select().from(candAdditionalInfo).where(
      and(eq(candAdditionalInfo.infoUuid, infoUuid), eq(candAdditionalInfo.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertAdditionalInfo): Promise<CandAdditionalInfo> {
    const db = getDb();
    const results = await db.insert(candAdditionalInfo).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertAdditionalInfo>): Promise<CandAdditionalInfo | undefined> {
    const db = getDb();
    const results = await db.update(candAdditionalInfo).set({ ...data, updatedAt: new Date() }).where(eq(candAdditionalInfo.id, id)).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candAdditionalInfo).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candAdditionalInfo.id, id)).returning();
    return results.length > 0;
  }
}

export class AdditionalInfoAttachmentsRepository {
  async findByInfoUuid(infoUuid: string): Promise<CandAdditionalInfoAttachment[]> {
    const db = getDb();
    return db.select().from(candAdditionalInfoAttachments).where(
      and(eq(candAdditionalInfoAttachments.infoUuid, infoUuid), eq(candAdditionalInfoAttachments.isDeleted, false))
    ).orderBy(asc(candAdditionalInfoAttachments.sortOrder), asc(candAdditionalInfoAttachments.createdAt));
  }

  async findByUuid(attUuid: string): Promise<CandAdditionalInfoAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candAdditionalInfoAttachments).where(
      eq(candAdditionalInfoAttachments.attUuid, attUuid)
    );
    return results[0];
  }

  async findById(id: number): Promise<CandAdditionalInfoAttachment | undefined> {
    const db = getDb();
    const results = await db.select().from(candAdditionalInfoAttachments).where(
      eq(candAdditionalInfoAttachments.id, id)
    );
    return results[0];
  }

  async create(data: InsertAdditionalInfoAttachment): Promise<CandAdditionalInfoAttachment> {
    const db = getDb();
    const results = await db.insert(candAdditionalInfoAttachments).values(data).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candAdditionalInfoAttachments).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candAdditionalInfoAttachments.id, id)).returning();
    return results.length > 0;
  }

  async hardDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.delete(candAdditionalInfoAttachments).where(eq(candAdditionalInfoAttachments.id, id)).returning();
    return results.length > 0;
  }
}

export const documentsRepository = new DocumentsRepository();
export const documentAttachmentsRepository = new DocumentAttachmentsRepository();
export const visasRepository = new VisasRepository();
export const visaAttachmentsRepository = new VisaAttachmentsRepository();
export const educationRepository = new EducationRepository();
export const educationAttachmentsRepository = new EducationAttachmentsRepository();
export const licensesRepository = new LicensesRepository();
export const licenseAttachmentsRepository = new LicenseAttachmentsRepository();
export const trainingCoursesRepository = new TrainingCoursesRepository();
export const trainingAttachmentsRepository = new TrainingAttachmentsRepository();
export const seaServiceRepository = new SeaServiceRepository();
export const seaServiceAttachmentsRepository = new SeaServiceAttachmentsRepository();
export const additionalInfoRepository = new AdditionalInfoRepository();
export const additionalInfoAttachmentsRepository = new AdditionalInfoAttachmentsRepository();
