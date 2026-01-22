import { v4 as uuidv4 } from "uuid";
import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  documentsRepository,
  documentAttachmentsRepository,
  visasRepository,
  visaAttachmentsRepository,
  educationRepository,
  educationAttachmentsRepository,
  licensesRepository,
  licenseAttachmentsRepository,
  trainingCoursesRepository,
  trainingAttachmentsRepository,
  seaServiceRepository,
  seaServiceAttachmentsRepository,
  additionalInfoRepository,
  additionalInfoAttachmentsRepository,
} from "../repositories";
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
  CandDocumentAttachment,
  CandVisa,
  CandVisaAttachment,
  CandEducation,
  CandEducationAttachment,
  CandLicense,
  CandLicenseAttachment,
  CandTrainingCourse,
  CandTrainingAttachment,
  CandSeaService,
  CandSeaServiceAttachment,
  CandAdditionalInfo,
  CandAdditionalInfoAttachment,
  InsertDocument,
  InsertDocumentAttachment,
  InsertVisa,
  InsertVisaAttachment,
  InsertEducation,
  InsertEducationAttachment,
  InsertLicense,
  InsertLicenseAttachment,
  InsertTrainingCourse,
  InsertTrainingAttachment,
  InsertSeaService,
  InsertSeaServiceAttachment,
  InsertAdditionalInfo,
  InsertAdditionalInfoAttachment,
} from "../../../../shared/v2/recruitment/types";

export class DocumentsService {
  // Optimized: Single JOIN query instead of N+1
  async getDocuments(recCanUuid: string): Promise<(CandDocument & { attachments: CandDocumentAttachment[] })[]> {
    const db = getDb();
    
    const rows = await db
      .select({
        doc: candDocuments,
        att: candDocumentsAttachments,
      })
      .from(candDocuments)
      .leftJoin(
        candDocumentsAttachments,
        and(
          eq(candDocuments.docUuid, candDocumentsAttachments.docUuid),
          eq(candDocumentsAttachments.isDeleted, false)
        )
      )
      .where(
        and(
          eq(candDocuments.recCanUuid, recCanUuid),
          eq(candDocuments.isDeleted, false)
        )
      )
      .orderBy(asc(candDocuments.sortOrder), asc(candDocumentsAttachments.sortOrder));

    // Group by document UUID
    const docMap = new Map<string, CandDocument & { attachments: CandDocumentAttachment[] }>();
    for (const row of rows) {
      if (!docMap.has(row.doc.docUuid)) {
        docMap.set(row.doc.docUuid, { ...row.doc, attachments: [] });
      }
      if (row.att?.attUuid) {
        docMap.get(row.doc.docUuid)!.attachments.push(row.att);
      }
    }

    return Array.from(docMap.values());
  }

  async createDocument(recCanUuid: string, data: Partial<InsertDocument>, createdByUuid?: string): Promise<CandDocument> {
    return documentsRepository.create({
      docUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertDocument);
  }

  async updateDocument(id: number, data: Partial<InsertDocument>, updatedByUuid?: string): Promise<CandDocument | undefined> {
    return documentsRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteDocument(id: number): Promise<boolean> {
    return documentsRepository.softDelete(id);
  }

  async getDocumentAttachments(docUuid: string): Promise<CandDocumentAttachment[]> {
    return documentAttachmentsRepository.findByDocUuid(docUuid);
  }

  async createDocumentAttachment(docUuid: string, data: Partial<InsertDocumentAttachment>, createdByUuid?: string): Promise<CandDocumentAttachment> {
    return documentAttachmentsRepository.create({
      attUuid: uuidv4(),
      docUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertDocumentAttachment);
  }

  // Optimized: Single JOIN query instead of N+1
  async getVisas(recCanUuid: string): Promise<(CandVisa & { attachments: CandVisaAttachment[] })[]> {
    const db = getDb();
    
    const rows = await db
      .select({
        visa: candVisas,
        att: candVisasAttachments,
      })
      .from(candVisas)
      .leftJoin(
        candVisasAttachments,
        and(
          eq(candVisas.visaUuid, candVisasAttachments.visaUuid),
          eq(candVisasAttachments.isDeleted, false)
        )
      )
      .where(
        and(
          eq(candVisas.recCanUuid, recCanUuid),
          eq(candVisas.isDeleted, false)
        )
      )
      .orderBy(asc(candVisas.sortOrder), asc(candVisasAttachments.sortOrder));

    const visaMap = new Map<string, CandVisa & { attachments: CandVisaAttachment[] }>();
    for (const row of rows) {
      if (!visaMap.has(row.visa.visaUuid)) {
        visaMap.set(row.visa.visaUuid, { ...row.visa, attachments: [] });
      }
      if (row.att?.attUuid) {
        visaMap.get(row.visa.visaUuid)!.attachments.push(row.att);
      }
    }

    return Array.from(visaMap.values());
  }

  async createVisa(recCanUuid: string, data: Partial<InsertVisa>, createdByUuid?: string): Promise<CandVisa> {
    return visasRepository.create({
      visaUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertVisa);
  }

  async updateVisa(id: number, data: Partial<InsertVisa>, updatedByUuid?: string): Promise<CandVisa | undefined> {
    return visasRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteVisa(id: number): Promise<boolean> {
    return visasRepository.softDelete(id);
  }

  async getVisaAttachments(visaUuid: string): Promise<CandVisaAttachment[]> {
    return visaAttachmentsRepository.findByVisaUuid(visaUuid);
  }

  async createVisaAttachment(visaUuid: string, data: Partial<InsertVisaAttachment>, createdByUuid?: string): Promise<CandVisaAttachment> {
    return visaAttachmentsRepository.create({
      attUuid: uuidv4(),
      visaUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertVisaAttachment);
  }

  // Optimized: Single JOIN query instead of N+1
  async getEducation(recCanUuid: string): Promise<(CandEducation & { attachments: CandEducationAttachment[] })[]> {
    const db = getDb();
    
    const rows = await db
      .select({
        edu: candEducation,
        att: candEducationAttachments,
      })
      .from(candEducation)
      .leftJoin(
        candEducationAttachments,
        and(
          eq(candEducation.eduUuid, candEducationAttachments.eduUuid),
          eq(candEducationAttachments.isDeleted, false)
        )
      )
      .where(
        and(
          eq(candEducation.recCanUuid, recCanUuid),
          eq(candEducation.isDeleted, false)
        )
      )
      .orderBy(asc(candEducation.sortOrder), asc(candEducationAttachments.sortOrder));

    const eduMap = new Map<string, CandEducation & { attachments: CandEducationAttachment[] }>();
    for (const row of rows) {
      if (!eduMap.has(row.edu.eduUuid)) {
        eduMap.set(row.edu.eduUuid, { ...row.edu, attachments: [] });
      }
      if (row.att?.attUuid) {
        eduMap.get(row.edu.eduUuid)!.attachments.push(row.att);
      }
    }

    return Array.from(eduMap.values());
  }

  async createEducation(recCanUuid: string, data: Partial<InsertEducation>, createdByUuid?: string): Promise<CandEducation> {
    return educationRepository.create({
      eduUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertEducation);
  }

  async updateEducation(id: number, data: Partial<InsertEducation>, updatedByUuid?: string): Promise<CandEducation | undefined> {
    return educationRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteEducation(id: number): Promise<boolean> {
    return educationRepository.softDelete(id);
  }

  async getEducationAttachments(eduUuid: string): Promise<CandEducationAttachment[]> {
    return educationAttachmentsRepository.findByEduUuid(eduUuid);
  }

  async createEducationAttachment(eduUuid: string, data: Partial<InsertEducationAttachment>, createdByUuid?: string): Promise<CandEducationAttachment> {
    return educationAttachmentsRepository.create({
      attUuid: uuidv4(),
      eduUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertEducationAttachment);
  }

  // Optimized: Single JOIN query instead of N+1
  async getLicenses(recCanUuid: string): Promise<(CandLicense & { attachments: CandLicenseAttachment[] })[]> {
    const db = getDb();
    
    const rows = await db
      .select({
        lic: candLicenses,
        att: candLicensesAttachments,
      })
      .from(candLicenses)
      .leftJoin(
        candLicensesAttachments,
        and(
          eq(candLicenses.licUuid, candLicensesAttachments.licUuid),
          eq(candLicensesAttachments.isDeleted, false)
        )
      )
      .where(
        and(
          eq(candLicenses.recCanUuid, recCanUuid),
          eq(candLicenses.isDeleted, false)
        )
      )
      .orderBy(asc(candLicenses.sortOrder), asc(candLicensesAttachments.sortOrder));

    const licMap = new Map<string, CandLicense & { attachments: CandLicenseAttachment[] }>();
    for (const row of rows) {
      if (!licMap.has(row.lic.licUuid)) {
        licMap.set(row.lic.licUuid, { ...row.lic, attachments: [] });
      }
      if (row.att?.attUuid) {
        licMap.get(row.lic.licUuid)!.attachments.push(row.att);
      }
    }

    return Array.from(licMap.values());
  }

  async createLicense(recCanUuid: string, data: Partial<InsertLicense>, createdByUuid?: string): Promise<CandLicense> {
    return licensesRepository.create({
      licUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertLicense);
  }

  async updateLicense(id: number, data: Partial<InsertLicense>, updatedByUuid?: string): Promise<CandLicense | undefined> {
    return licensesRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteLicense(id: number): Promise<boolean> {
    return licensesRepository.softDelete(id);
  }

  async getLicenseAttachments(licUuid: string): Promise<CandLicenseAttachment[]> {
    return licenseAttachmentsRepository.findByLicUuid(licUuid);
  }

  async createLicenseAttachment(licUuid: string, data: Partial<InsertLicenseAttachment>, createdByUuid?: string): Promise<CandLicenseAttachment> {
    return licenseAttachmentsRepository.create({
      attUuid: uuidv4(),
      licUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertLicenseAttachment);
  }

  // Optimized: Single JOIN query instead of N+1
  async getTrainingCourses(recCanUuid: string): Promise<(CandTrainingCourse & { attachments: CandTrainingAttachment[] })[]> {
    const db = getDb();
    
    const rows = await db
      .select({
        train: candTrainingCourses,
        att: candTrainingAttachments,
      })
      .from(candTrainingCourses)
      .leftJoin(
        candTrainingAttachments,
        and(
          eq(candTrainingCourses.trainUuid, candTrainingAttachments.trainUuid),
          eq(candTrainingAttachments.isDeleted, false)
        )
      )
      .where(
        and(
          eq(candTrainingCourses.recCanUuid, recCanUuid),
          eq(candTrainingCourses.isDeleted, false)
        )
      )
      .orderBy(asc(candTrainingCourses.sortOrder), asc(candTrainingAttachments.sortOrder));

    const trainMap = new Map<string, CandTrainingCourse & { attachments: CandTrainingAttachment[] }>();
    for (const row of rows) {
      if (!trainMap.has(row.train.trainUuid)) {
        trainMap.set(row.train.trainUuid, { ...row.train, attachments: [] });
      }
      if (row.att?.attUuid) {
        trainMap.get(row.train.trainUuid)!.attachments.push(row.att);
      }
    }

    return Array.from(trainMap.values());
  }

  async createTrainingCourse(recCanUuid: string, data: Partial<InsertTrainingCourse>, createdByUuid?: string): Promise<CandTrainingCourse> {
    return trainingCoursesRepository.create({
      trainUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertTrainingCourse);
  }

  async updateTrainingCourse(id: number, data: Partial<InsertTrainingCourse>, updatedByUuid?: string): Promise<CandTrainingCourse | undefined> {
    return trainingCoursesRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteTrainingCourse(id: number): Promise<boolean> {
    return trainingCoursesRepository.softDelete(id);
  }

  async getTrainingAttachments(trainUuid: string): Promise<CandTrainingAttachment[]> {
    return trainingAttachmentsRepository.findByTrainUuid(trainUuid);
  }

  async createTrainingAttachment(trainUuid: string, data: Partial<InsertTrainingAttachment>, createdByUuid?: string): Promise<CandTrainingAttachment> {
    return trainingAttachmentsRepository.create({
      attUuid: uuidv4(),
      trainUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertTrainingAttachment);
  }

  // Optimized: Single JOIN query instead of N+1
  async getSeaService(recCanUuid: string): Promise<(CandSeaService & { attachments: CandSeaServiceAttachment[] })[]> {
    const db = getDb();
    
    const rows = await db
      .select({
        sea: candSeaService,
        att: candSeaServiceAttachments,
      })
      .from(candSeaService)
      .leftJoin(
        candSeaServiceAttachments,
        and(
          eq(candSeaService.seaUuid, candSeaServiceAttachments.seaUuid),
          eq(candSeaServiceAttachments.isDeleted, false)
        )
      )
      .where(
        and(
          eq(candSeaService.recCanUuid, recCanUuid),
          eq(candSeaService.isDeleted, false)
        )
      )
      .orderBy(asc(candSeaService.sortOrder), asc(candSeaServiceAttachments.sortOrder));

    const seaMap = new Map<string, CandSeaService & { attachments: CandSeaServiceAttachment[] }>();
    for (const row of rows) {
      if (!seaMap.has(row.sea.seaUuid)) {
        seaMap.set(row.sea.seaUuid, { ...row.sea, attachments: [] });
      }
      if (row.att?.attUuid) {
        seaMap.get(row.sea.seaUuid)!.attachments.push(row.att);
      }
    }

    return Array.from(seaMap.values());
  }

  async createSeaService(recCanUuid: string, data: Partial<InsertSeaService>, createdByUuid?: string): Promise<CandSeaService> {
    return seaServiceRepository.create({
      seaUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertSeaService);
  }

  async updateSeaService(id: number, data: Partial<InsertSeaService>, updatedByUuid?: string): Promise<CandSeaService | undefined> {
    return seaServiceRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteSeaService(id: number): Promise<boolean> {
    return seaServiceRepository.softDelete(id);
  }

  async getSeaServiceAttachments(seaUuid: string): Promise<CandSeaServiceAttachment[]> {
    return seaServiceAttachmentsRepository.findBySeaUuid(seaUuid);
  }

  async createSeaServiceAttachment(seaUuid: string, data: Partial<InsertSeaServiceAttachment>, createdByUuid?: string): Promise<CandSeaServiceAttachment> {
    return seaServiceAttachmentsRepository.create({
      attUuid: uuidv4(),
      seaUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertSeaServiceAttachment);
  }

  // Optimized: Single JOIN query instead of N+1
  async getAdditionalInfo(recCanUuid: string): Promise<(CandAdditionalInfo & { attachments: CandAdditionalInfoAttachment[] })[]> {
    const db = getDb();
    
    const rows = await db
      .select({
        info: candAdditionalInfo,
        att: candAdditionalInfoAttachments,
      })
      .from(candAdditionalInfo)
      .leftJoin(
        candAdditionalInfoAttachments,
        and(
          eq(candAdditionalInfo.infoUuid, candAdditionalInfoAttachments.infoUuid),
          eq(candAdditionalInfoAttachments.isDeleted, false)
        )
      )
      .where(
        and(
          eq(candAdditionalInfo.recCanUuid, recCanUuid),
          eq(candAdditionalInfo.isDeleted, false)
        )
      )
      .orderBy(asc(candAdditionalInfo.sortOrder), asc(candAdditionalInfoAttachments.sortOrder));

    const infoMap = new Map<string, CandAdditionalInfo & { attachments: CandAdditionalInfoAttachment[] }>();
    for (const row of rows) {
      if (!infoMap.has(row.info.infoUuid)) {
        infoMap.set(row.info.infoUuid, { ...row.info, attachments: [] });
      }
      if (row.att?.attUuid) {
        infoMap.get(row.info.infoUuid)!.attachments.push(row.att);
      }
    }

    return Array.from(infoMap.values());
  }

  async createAdditionalInfo(recCanUuid: string, data: Partial<InsertAdditionalInfo>, createdByUuid?: string): Promise<CandAdditionalInfo> {
    return additionalInfoRepository.create({
      infoUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertAdditionalInfo);
  }

  async updateAdditionalInfo(id: number, data: Partial<InsertAdditionalInfo>, updatedByUuid?: string): Promise<CandAdditionalInfo | undefined> {
    return additionalInfoRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteAdditionalInfo(id: number): Promise<boolean> {
    return additionalInfoRepository.softDelete(id);
  }

  async getAdditionalInfoAttachments(infoUuid: string): Promise<CandAdditionalInfoAttachment[]> {
    return additionalInfoAttachmentsRepository.findByInfoUuid(infoUuid);
  }

  async createAdditionalInfoAttachment(infoUuid: string, data: Partial<InsertAdditionalInfoAttachment>, createdByUuid?: string): Promise<CandAdditionalInfoAttachment> {
    return additionalInfoAttachmentsRepository.create({
      attUuid: uuidv4(),
      infoUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertAdditionalInfoAttachment);
  }
}

export const documentsService = new DocumentsService();
