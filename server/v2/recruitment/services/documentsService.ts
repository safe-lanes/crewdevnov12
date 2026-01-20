import { v4 as uuidv4 } from "uuid";
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
  async getDocuments(recCanUuid: string): Promise<CandDocument[]> {
    return documentsRepository.findByCandidateUuid(recCanUuid);
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

  async getVisas(recCanUuid: string): Promise<CandVisa[]> {
    return visasRepository.findByCandidateUuid(recCanUuid);
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

  async getEducation(recCanUuid: string): Promise<CandEducation[]> {
    return educationRepository.findByCandidateUuid(recCanUuid);
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

  async getLicenses(recCanUuid: string): Promise<CandLicense[]> {
    return licensesRepository.findByCandidateUuid(recCanUuid);
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

  async getTrainingCourses(recCanUuid: string): Promise<CandTrainingCourse[]> {
    return trainingCoursesRepository.findByCandidateUuid(recCanUuid);
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

  async getSeaService(recCanUuid: string): Promise<CandSeaService[]> {
    return seaServiceRepository.findByCandidateUuid(recCanUuid);
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

  async getAdditionalInfo(recCanUuid: string): Promise<CandAdditionalInfo[]> {
    return additionalInfoRepository.findByCandidateUuid(recCanUuid);
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
