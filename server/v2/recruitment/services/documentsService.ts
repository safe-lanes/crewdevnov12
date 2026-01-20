import { v4 as uuidv4 } from "uuid";
import {
  travelDocumentRepository,
  visaRepository,
  cocRepository,
  copRepository,
  stcwCertificateRepository,
  flagEndorsementRepository,
  medicalCertificateRepository,
  vaccinationRepository,
  trainingCertificateRepository,
  educationRepository,
  seaServiceInternalRepository,
  seaServiceExternalRepository,
  licenseRepository,
  documentAttachmentRepository,
} from "../repositories";
import type {
  TravelDocument,
  Visa,
  Coc,
  Cop,
  StcwCertificate,
  FlagEndorsement,
  MedicalCertificate,
  Vaccination,
  TrainingCertificate,
  Education,
  SeaServiceInternal,
  SeaServiceExternal,
  License,
  DocumentAttachment,
} from "../../../../shared/v2/recruitment/types";

type CreateData<T> = Partial<Omit<T, "id" | "createdAt" | "updatedAt" | "recCanUuid">>;

export class DocumentsService {
  async getTravelDocuments(recCanUuid: string): Promise<TravelDocument[]> {
    return travelDocumentRepository.findByCandidateUuid(recCanUuid);
  }

  async createTravelDocument(
    recCanUuid: string,
    data: CreateData<TravelDocument>,
    createdByUuid?: string
  ): Promise<TravelDocument> {
    return travelDocumentRepository.create({
      tdocUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateTravelDocument(
    id: number,
    data: CreateData<TravelDocument>,
    updatedByUuid?: string
  ): Promise<TravelDocument | undefined> {
    return travelDocumentRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteTravelDocument(id: number): Promise<boolean> {
    return travelDocumentRepository.softDelete(id);
  }

  async getVisas(recCanUuid: string): Promise<Visa[]> {
    return visaRepository.findByCandidateUuid(recCanUuid);
  }

  async createVisa(
    recCanUuid: string,
    data: CreateData<Visa>,
    createdByUuid?: string
  ): Promise<Visa> {
    return visaRepository.create({
      visaUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateVisa(
    id: number,
    data: CreateData<Visa>,
    updatedByUuid?: string
  ): Promise<Visa | undefined> {
    return visaRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteVisa(id: number): Promise<boolean> {
    return visaRepository.softDelete(id);
  }

  async getCocs(recCanUuid: string): Promise<Coc[]> {
    return cocRepository.findByCandidateUuid(recCanUuid);
  }

  async createCoc(
    recCanUuid: string,
    data: CreateData<Coc>,
    createdByUuid?: string
  ): Promise<Coc> {
    return cocRepository.create({
      cocUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateCoc(
    id: number,
    data: CreateData<Coc>,
    updatedByUuid?: string
  ): Promise<Coc | undefined> {
    return cocRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteCoc(id: number): Promise<boolean> {
    return cocRepository.softDelete(id);
  }

  async getCops(recCanUuid: string): Promise<Cop[]> {
    return copRepository.findByCandidateUuid(recCanUuid);
  }

  async createCop(
    recCanUuid: string,
    data: CreateData<Cop>,
    createdByUuid?: string
  ): Promise<Cop> {
    return copRepository.create({
      copUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateCop(
    id: number,
    data: CreateData<Cop>,
    updatedByUuid?: string
  ): Promise<Cop | undefined> {
    return copRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteCop(id: number): Promise<boolean> {
    return copRepository.softDelete(id);
  }

  async getStcwCertificates(recCanUuid: string): Promise<StcwCertificate[]> {
    return stcwCertificateRepository.findByCandidateUuid(recCanUuid);
  }

  async createStcwCertificate(
    recCanUuid: string,
    data: CreateData<StcwCertificate>,
    createdByUuid?: string
  ): Promise<StcwCertificate> {
    return stcwCertificateRepository.create({
      stcwUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateStcwCertificate(
    id: number,
    data: CreateData<StcwCertificate>,
    updatedByUuid?: string
  ): Promise<StcwCertificate | undefined> {
    return stcwCertificateRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteStcwCertificate(id: number): Promise<boolean> {
    return stcwCertificateRepository.softDelete(id);
  }

  async getFlagEndorsements(recCanUuid: string): Promise<FlagEndorsement[]> {
    return flagEndorsementRepository.findByCandidateUuid(recCanUuid);
  }

  async createFlagEndorsement(
    recCanUuid: string,
    data: CreateData<FlagEndorsement>,
    createdByUuid?: string
  ): Promise<FlagEndorsement> {
    return flagEndorsementRepository.create({
      flagUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateFlagEndorsement(
    id: number,
    data: CreateData<FlagEndorsement>,
    updatedByUuid?: string
  ): Promise<FlagEndorsement | undefined> {
    return flagEndorsementRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteFlagEndorsement(id: number): Promise<boolean> {
    return flagEndorsementRepository.softDelete(id);
  }

  async getMedicalCertificates(recCanUuid: string): Promise<MedicalCertificate[]> {
    return medicalCertificateRepository.findByCandidateUuid(recCanUuid);
  }

  async createMedicalCertificate(
    recCanUuid: string,
    data: CreateData<MedicalCertificate>,
    createdByUuid?: string
  ): Promise<MedicalCertificate> {
    return medicalCertificateRepository.create({
      medUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateMedicalCertificate(
    id: number,
    data: CreateData<MedicalCertificate>,
    updatedByUuid?: string
  ): Promise<MedicalCertificate | undefined> {
    return medicalCertificateRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteMedicalCertificate(id: number): Promise<boolean> {
    return medicalCertificateRepository.softDelete(id);
  }

  async getVaccinations(recCanUuid: string): Promise<Vaccination[]> {
    return vaccinationRepository.findByCandidateUuid(recCanUuid);
  }

  async createVaccination(
    recCanUuid: string,
    data: CreateData<Vaccination>,
    createdByUuid?: string
  ): Promise<Vaccination> {
    return vaccinationRepository.create({
      vaccUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateVaccination(
    id: number,
    data: CreateData<Vaccination>,
    updatedByUuid?: string
  ): Promise<Vaccination | undefined> {
    return vaccinationRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteVaccination(id: number): Promise<boolean> {
    return vaccinationRepository.softDelete(id);
  }

  async getTrainingCertificates(recCanUuid: string): Promise<TrainingCertificate[]> {
    return trainingCertificateRepository.findByCandidateUuid(recCanUuid);
  }

  async createTrainingCertificate(
    recCanUuid: string,
    data: CreateData<TrainingCertificate>,
    createdByUuid?: string
  ): Promise<TrainingCertificate> {
    return trainingCertificateRepository.create({
      trainUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateTrainingCertificate(
    id: number,
    data: CreateData<TrainingCertificate>,
    updatedByUuid?: string
  ): Promise<TrainingCertificate | undefined> {
    return trainingCertificateRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteTrainingCertificate(id: number): Promise<boolean> {
    return trainingCertificateRepository.softDelete(id);
  }

  async getEducation(recCanUuid: string): Promise<Education[]> {
    return educationRepository.findByCandidateUuid(recCanUuid);
  }

  async createEducation(
    recCanUuid: string,
    data: CreateData<Education>,
    createdByUuid?: string
  ): Promise<Education> {
    return educationRepository.create({
      eduUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateEducation(
    id: number,
    data: CreateData<Education>,
    updatedByUuid?: string
  ): Promise<Education | undefined> {
    return educationRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteEducation(id: number): Promise<boolean> {
    return educationRepository.softDelete(id);
  }

  async getSeaServiceInternal(recCanUuid: string): Promise<SeaServiceInternal[]> {
    return seaServiceInternalRepository.findByCandidateUuid(recCanUuid);
  }

  async createSeaServiceInternal(
    recCanUuid: string,
    data: CreateData<SeaServiceInternal>,
    createdByUuid?: string
  ): Promise<SeaServiceInternal> {
    return seaServiceInternalRepository.create({
      ssIntUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateSeaServiceInternal(
    id: number,
    data: CreateData<SeaServiceInternal>,
    updatedByUuid?: string
  ): Promise<SeaServiceInternal | undefined> {
    return seaServiceInternalRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteSeaServiceInternal(id: number): Promise<boolean> {
    return seaServiceInternalRepository.softDelete(id);
  }

  async getSeaServiceExternal(recCanUuid: string): Promise<SeaServiceExternal[]> {
    return seaServiceExternalRepository.findByCandidateUuid(recCanUuid);
  }

  async createSeaServiceExternal(
    recCanUuid: string,
    data: CreateData<SeaServiceExternal>,
    createdByUuid?: string
  ): Promise<SeaServiceExternal> {
    return seaServiceExternalRepository.create({
      ssExtUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateSeaServiceExternal(
    id: number,
    data: CreateData<SeaServiceExternal>,
    updatedByUuid?: string
  ): Promise<SeaServiceExternal | undefined> {
    return seaServiceExternalRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteSeaServiceExternal(id: number): Promise<boolean> {
    return seaServiceExternalRepository.softDelete(id);
  }

  async getLicenses(recCanUuid: string): Promise<License[]> {
    return licenseRepository.findByCandidateUuid(recCanUuid);
  }

  async createLicense(
    recCanUuid: string,
    data: CreateData<License>,
    createdByUuid?: string
  ): Promise<License> {
    return licenseRepository.create({
      licUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateLicense(
    id: number,
    data: CreateData<License>,
    updatedByUuid?: string
  ): Promise<License | undefined> {
    return licenseRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteLicense(id: number): Promise<boolean> {
    return licenseRepository.softDelete(id);
  }

  async getDocumentAttachments(recCanUuid: string): Promise<DocumentAttachment[]> {
    return documentAttachmentRepository.findByCandidateUuid(recCanUuid);
  }

  async getDocumentAttachmentsByParent(
    parentTableName: string,
    parentRecordUuid: string
  ): Promise<DocumentAttachment[]> {
    return documentAttachmentRepository.findByParentRecord(parentTableName, parentRecordUuid);
  }

  async createDocumentAttachment(
    recCanUuid: string,
    data: CreateData<DocumentAttachment>,
    createdByUuid?: string
  ): Promise<DocumentAttachment> {
    return documentAttachmentRepository.create({
      attachUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateDocumentAttachment(
    id: number,
    data: CreateData<DocumentAttachment>,
    updatedByUuid?: string
  ): Promise<DocumentAttachment | undefined> {
    return documentAttachmentRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteDocumentAttachment(id: number): Promise<boolean> {
    return documentAttachmentRepository.softDelete(id);
  }
}

export const documentsService = new DocumentsService();
