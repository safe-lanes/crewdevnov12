import { v4 as uuidv4 } from "uuid";
import {
  candidateRepository,
  vesselTypesAppliedRepository,
  personalDetailsRepository,
  addressRepository,
  familyInfoRepository,
  childrenRepository,
  nextOfKinRepository,
} from "../repositories";
import type {
  RecruitmentCandidate,
  CandVesselTypeApplied,
  CandPersonalDetails,
  CandAddress,
  CandFamilyInfo,
  CandChild,
  CandNextOfKin,
  CreateCandidateRequest,
  InsertPersonalDetails,
  InsertAddress,
  InsertFamilyInfo,
  InsertChild,
  InsertNextOfKin,
} from "../../../../shared/v2/recruitment/types";

export class CandidateService {
  async getAllCandidates(): Promise<RecruitmentCandidate[]> {
    return candidateRepository.findAll();
  }

  async getCandidateById(id: string): Promise<RecruitmentCandidate | undefined> {
    return candidateRepository.findById(id);
  }

  async getCandidateByUuid(recCanUuid: string): Promise<RecruitmentCandidate | undefined> {
    return candidateRepository.findByUuid(recCanUuid);
  }

  async createCandidate(
    data: CreateCandidateRequest,
    createdByUuid?: string
  ): Promise<RecruitmentCandidate> {
    const now = new Date();
    const id = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${Date.now()}`;
    const recCanUuid = uuidv4();
    return candidateRepository.create({
      id,
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateCandidate(
    id: string,
    data: Partial<CreateCandidateRequest>,
    updatedByUuid?: string
  ): Promise<RecruitmentCandidate | undefined> {
    return candidateRepository.update(id, {
      ...data,
      updatedByUuid,
    });
  }

  async updateCandidateByUuid(
    recCanUuid: string,
    data: Partial<CreateCandidateRequest>,
    updatedByUuid?: string
  ): Promise<RecruitmentCandidate | undefined> {
    return candidateRepository.updateByUuid(recCanUuid, {
      ...data,
      updatedByUuid,
    });
  }

  async deleteCandidate(id: string): Promise<boolean> {
    return candidateRepository.softDelete(id);
  }

  async deleteCandidateByUuid(recCanUuid: string): Promise<boolean> {
    return candidateRepository.softDeleteByUuid(recCanUuid);
  }

  async getVesselTypesApplied(recCanUuid: string): Promise<CandVesselTypeApplied[]> {
    return vesselTypesAppliedRepository.findByCandidateUuid(recCanUuid);
  }

  async addVesselTypeApplied(
    recCanUuid: string,
    vesselTypeUuid: string,
    createdByUuid?: string
  ): Promise<CandVesselTypeApplied> {
    return vesselTypesAppliedRepository.create({
      cvtaUuid: uuidv4(),
      recCanUuid,
      vesselTypeUuid,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async removeVesselTypeApplied(id: number): Promise<boolean> {
    return vesselTypesAppliedRepository.softDelete(id);
  }

  async getPersonalDetails(recCanUuid: string): Promise<CandPersonalDetails | undefined> {
    return personalDetailsRepository.findByCandidateUuid(recCanUuid);
  }

  async upsertPersonalDetails(
    recCanUuid: string,
    data: Partial<InsertPersonalDetails>,
    userUuid?: string
  ): Promise<CandPersonalDetails> {
    return personalDetailsRepository.upsert(recCanUuid, {
      cpdUuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getAddress(recCanUuid: string): Promise<CandAddress | undefined> {
    return addressRepository.findByCandidateUuid(recCanUuid);
  }

  async upsertAddress(
    recCanUuid: string,
    data: Partial<InsertAddress>,
    userUuid?: string
  ): Promise<CandAddress> {
    return addressRepository.upsert(recCanUuid, {
      addrUuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getFamilyInfo(recCanUuid: string): Promise<CandFamilyInfo | undefined> {
    return familyInfoRepository.findByCandidateUuid(recCanUuid);
  }

  async upsertFamilyInfo(
    recCanUuid: string,
    data: Partial<InsertFamilyInfo>,
    userUuid?: string
  ): Promise<CandFamilyInfo> {
    return familyInfoRepository.upsert(recCanUuid, {
      famUuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getChildren(recCanUuid: string): Promise<CandChild[]> {
    return childrenRepository.findByCandidateUuid(recCanUuid);
  }

  async createChild(
    recCanUuid: string,
    data: Partial<InsertChild>,
    createdByUuid?: string
  ): Promise<CandChild> {
    return childrenRepository.create({
      childUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertChild);
  }

  async updateChild(
    id: number,
    data: Partial<InsertChild>,
    updatedByUuid?: string
  ): Promise<CandChild | undefined> {
    return childrenRepository.update(id, {
      ...data,
      updatedByUuid,
    });
  }

  async deleteChild(id: number): Promise<boolean> {
    return childrenRepository.softDelete(id);
  }

  async getNextOfKin(recCanUuid: string): Promise<CandNextOfKin | undefined> {
    return nextOfKinRepository.findByCandidateUuid(recCanUuid);
  }

  async upsertNextOfKin(
    recCanUuid: string,
    data: Partial<InsertNextOfKin>,
    userUuid?: string
  ): Promise<CandNextOfKin> {
    return nextOfKinRepository.upsert(recCanUuid, {
      nokUuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }
}

export const candidateService = new CandidateService();
