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
  CandidateV2,
  VesselTypesApplied,
  PersonalDetails,
  Address,
  FamilyInfo,
  Child,
  NextOfKin,
  CreateCandidateRequest,
  UpdateCandidateRequest,
  UpsertPersonalDetailsRequest,
  UpsertAddressRequest,
  UpsertFamilyInfoRequest,
  CreateChildRequest,
  UpdateChildRequest,
  CreateNextOfKinRequest,
  UpdateNextOfKinRequest,
  AddVesselTypeAppliedRequest,
} from "../../../../shared/v2/recruitment/types";

// ============================================================================
// CANDIDATE SERVICE
// ============================================================================

export class CandidateService {
  async getAllCandidates(): Promise<CandidateV2[]> {
    return candidateRepository.findAll();
  }

  async getCandidateById(id: number): Promise<CandidateV2 | undefined> {
    return candidateRepository.findById(id);
  }

  async getCandidateByUuid(recCanUuid: string): Promise<CandidateV2 | undefined> {
    return candidateRepository.findByUuid(recCanUuid);
  }

  async createCandidate(
    data: CreateCandidateRequest,
    createdByUuid?: string
  ): Promise<CandidateV2> {
    const recCanUuid = uuidv4();
    return candidateRepository.create({
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateCandidate(
    id: number,
    data: UpdateCandidateRequest,
    updatedByUuid?: string
  ): Promise<CandidateV2 | undefined> {
    return candidateRepository.update(id, {
      ...data,
      updatedByUuid,
    });
  }

  async deleteCandidate(id: number): Promise<boolean> {
    return candidateRepository.softDelete(id);
  }

  // ============================================================================
  // VESSEL TYPES APPLIED
  // ============================================================================

  async getVesselTypesApplied(recCanUuid: string): Promise<VesselTypesApplied[]> {
    return vesselTypesAppliedRepository.findByCandidateUuid(recCanUuid);
  }

  async addVesselTypeApplied(
    recCanUuid: string,
    data: AddVesselTypeAppliedRequest,
    createdByUuid?: string
  ): Promise<VesselTypesApplied> {
    const cvtaUuid = uuidv4();
    return vesselTypesAppliedRepository.create({
      cvtaUuid,
      recCanUuid,
      vesselTypeUuid: data.vesselTypeUuid,
      sortOrder: data.sortOrder ?? 0,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async removeVesselTypeApplied(id: number): Promise<boolean> {
    return vesselTypesAppliedRepository.softDelete(id);
  }

  // ============================================================================
  // PERSONAL DETAILS
  // ============================================================================

  async getPersonalDetails(recCanUuid: string): Promise<PersonalDetails | undefined> {
    return personalDetailsRepository.findByCandidateUuid(recCanUuid);
  }

  async upsertPersonalDetails(
    recCanUuid: string,
    data: UpsertPersonalDetailsRequest,
    updatedByUuid?: string
  ): Promise<PersonalDetails> {
    const cpdUuid = uuidv4();
    return personalDetailsRepository.upsert(recCanUuid, {
      cpdUuid,
      ...data,
      updatedByUuid,
    });
  }

  // ============================================================================
  // ADDRESSES
  // ============================================================================

  async getAddress(recCanUuid: string): Promise<Address | undefined> {
    return addressRepository.findByCandidateUuid(recCanUuid);
  }

  async upsertAddress(
    recCanUuid: string,
    data: UpsertAddressRequest,
    updatedByUuid?: string
  ): Promise<Address> {
    const addrUuid = uuidv4();
    return addressRepository.upsert(recCanUuid, {
      addrUuid,
      ...data,
      updatedByUuid,
    });
  }

  // ============================================================================
  // FAMILY INFO
  // ============================================================================

  async getFamilyInfo(recCanUuid: string): Promise<FamilyInfo | undefined> {
    return familyInfoRepository.findByCandidateUuid(recCanUuid);
  }

  async upsertFamilyInfo(
    recCanUuid: string,
    data: UpsertFamilyInfoRequest,
    updatedByUuid?: string
  ): Promise<FamilyInfo> {
    const famUuid = uuidv4();
    return familyInfoRepository.upsert(recCanUuid, {
      famUuid,
      ...data,
      updatedByUuid,
    });
  }

  // ============================================================================
  // CHILDREN
  // ============================================================================

  async getChildren(recCanUuid: string): Promise<Child[]> {
    return childrenRepository.findByCandidateUuid(recCanUuid);
  }

  async createChild(
    recCanUuid: string,
    data: CreateChildRequest,
    createdByUuid?: string
  ): Promise<Child> {
    const childUuid = uuidv4();
    return childrenRepository.create({
      childUuid,
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateChild(
    id: number,
    data: UpdateChildRequest,
    updatedByUuid?: string
  ): Promise<Child | undefined> {
    return childrenRepository.update(id, {
      ...data,
      updatedByUuid,
    });
  }

  async deleteChild(id: number): Promise<boolean> {
    return childrenRepository.softDelete(id);
  }

  // ============================================================================
  // NEXT OF KIN
  // ============================================================================

  async getNextOfKin(recCanUuid: string): Promise<NextOfKin[]> {
    return nextOfKinRepository.findByCandidateUuid(recCanUuid);
  }

  async createNextOfKin(
    recCanUuid: string,
    data: CreateNextOfKinRequest,
    createdByUuid?: string
  ): Promise<NextOfKin> {
    const nokUuid = uuidv4();
    return nextOfKinRepository.create({
      nokUuid,
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async updateNextOfKin(
    id: number,
    data: UpdateNextOfKinRequest,
    updatedByUuid?: string
  ): Promise<NextOfKin | undefined> {
    return nextOfKinRepository.update(id, {
      ...data,
      updatedByUuid,
    });
  }

  async deleteNextOfKin(id: number): Promise<boolean> {
    return nextOfKinRepository.softDelete(id);
  }
}

export const candidateService = new CandidateService();
