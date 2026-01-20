import { v4 as uuidv4 } from "uuid";
import {
  approvalsRepository,
  suitabilityRepository,
  recruitmentDecisionRepository,
} from "../repositories/approvalsRepository";
import type {
  CandApproval,
  InsertApproval,
  CandSuitability,
  InsertSuitability,
  CandRecruitmentDecision,
  InsertRecruitmentDecision,
} from "../../../../shared/v2/recruitment/types";

export class ApprovalsService {
  async getApprovals(recCanUuid: string): Promise<CandApproval[]> {
    return approvalsRepository.findByCandidateUuid(recCanUuid);
  }

  async createApproval(recCanUuid: string, data: Partial<InsertApproval>, createdByUuid?: string): Promise<CandApproval> {
    return approvalsRepository.create({
      approvalUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertApproval);
  }

  async updateApproval(id: number, data: Partial<InsertApproval>, updatedByUuid?: string): Promise<CandApproval | undefined> {
    return approvalsRepository.update(id, { ...data, updatedByUuid });
  }

  async deleteApproval(id: number): Promise<boolean> {
    return approvalsRepository.softDelete(id);
  }
}

export class SuitabilityService {
  async getSuitability(recCanUuid: string): Promise<CandSuitability | undefined> {
    return suitabilityRepository.findByCandidateUuid(recCanUuid);
  }

  async upsertSuitability(recCanUuid: string, data: Partial<InsertSuitability>, userUuid?: string): Promise<CandSuitability> {
    return suitabilityRepository.upsert(recCanUuid, {
      suitUuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getVesselTypes(suitUuid: string) {
    return suitabilityRepository.findVesselTypes(suitUuid);
  }

  async addVesselType(suitUuid: string, vesselTypeUuid: string, userUuid?: string) {
    return suitabilityRepository.createVesselType({
      svtUuid: uuidv4(),
      suitUuid,
      vesselTypeUuid,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async clearVesselTypes(suitUuid: string) {
    return suitabilityRepository.deleteVesselTypes(suitUuid);
  }

  async getFleetGroups(suitUuid: string) {
    return suitabilityRepository.findFleetGroups(suitUuid);
  }

  async addFleetGroup(suitUuid: string, fleetGroupUuid: string, userUuid?: string) {
    return suitabilityRepository.createFleetGroup({
      sfgUuid: uuidv4(),
      suitUuid,
      fleetGroupUuid,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async clearFleetGroups(suitUuid: string) {
    return suitabilityRepository.deleteFleetGroups(suitUuid);
  }
}

export class RecruitmentDecisionService {
  async getDecision(recCanUuid: string): Promise<CandRecruitmentDecision | undefined> {
    return recruitmentDecisionRepository.findByCandidateUuid(recCanUuid);
  }

  async upsertDecision(recCanUuid: string, data: Partial<InsertRecruitmentDecision>, userUuid?: string): Promise<CandRecruitmentDecision> {
    return recruitmentDecisionRepository.upsert(recCanUuid, {
      decisionUuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getAssignedGroups(decisionUuid: string) {
    return recruitmentDecisionRepository.findAssignedGroups(decisionUuid);
  }

  async addAssignedGroup(decisionUuid: string, groupUuid: string, userUuid?: string) {
    return recruitmentDecisionRepository.createAssignedGroup({
      cagUuid: uuidv4(),
      decisionUuid,
      groupUuid,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async clearAssignedGroups(decisionUuid: string) {
    return recruitmentDecisionRepository.deleteAssignedGroups(decisionUuid);
  }
}

export const approvalsService = new ApprovalsService();
export const suitabilityService = new SuitabilityService();
export const recruitmentDecisionService = new RecruitmentDecisionService();
