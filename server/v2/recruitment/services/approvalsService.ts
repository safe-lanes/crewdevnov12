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
    // Auto-extract auditUserUuid from data if not provided
    const auditUser = createdByUuid || (data as any).auditUserUuid || null;
    delete (data as any).auditUserUuid;

    return approvalsRepository.create({
      approvalUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as InsertApproval);
  }

  async updateApproval(id: number, data: Partial<InsertApproval>, updatedByUuid?: string): Promise<CandApproval | undefined> {
    // Auto-extract auditUserUuid from data if not provided
    const auditUser = updatedByUuid || (data as any).auditUserUuid || null;
    delete (data as any).auditUserUuid;

    return approvalsRepository.update(id, { ...data, updatedByUuid: auditUser });
  }

  async deleteApproval(id: number): Promise<boolean> {
    return approvalsRepository.softDelete(id);
  }
}

export class SuitabilityService {
  async getSuitability(recCanUuid: string): Promise<CandSuitability | undefined> {
    return suitabilityRepository.findByCandidateUuid(recCanUuid);
  }

  async getSuitabilityWithRelations(recCanUuid: string): Promise<{ suitUuid: string; vesselTypes: any[]; fleetGroups: any[] } | undefined> {
    const suitability = await suitabilityRepository.findByCandidateUuid(recCanUuid);
    if (!suitability) return undefined;
    
    const vesselTypes = await suitabilityRepository.findVesselTypes(suitability.suitUuid);
    const fleetGroups = await suitabilityRepository.findFleetGroups(suitability.suitUuid);
    
    return {
      ...suitability,
      vesselTypes,
      fleetGroups,
    };
  }

  async upsertSuitability(recCanUuid: string, data: Partial<InsertSuitability>, userUuid?: string): Promise<CandSuitability> {
    // Auto-extract auditUserUuid from data if not provided
    const auditUser = userUuid || (data as any).auditUserUuid || null;
    delete (data as any).auditUserUuid;

    return suitabilityRepository.upsert(recCanUuid, {
      suitUuid: uuidv4(),
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async getVesselTypes(suitUuid: string) {
    return suitabilityRepository.findVesselTypes(suitUuid);
  }

  async addVesselType(suitUuid: string, vesselTypeUuid: string, userUuid?: string, auditUserUuidFromBody?: string | null, sortOrder?: number) {
    const auditUser = userUuid || auditUserUuidFromBody || null;
    return suitabilityRepository.createVesselType({
      svtUuid: uuidv4(),
      suitUuid,
      vesselTypeUuid,
      sortOrder: sortOrder ?? 0,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async updateVesselTypeSortOrder(suitUuid: string, vesselTypeUuid: string, sortOrder: number) {
    return suitabilityRepository.updateVesselTypeSortOrder(suitUuid, vesselTypeUuid, sortOrder);
  }

  async clearVesselTypes(suitUuid: string) {
    return suitabilityRepository.deleteVesselTypes(suitUuid);
  }

  async softDeleteVesselType(svtUuid: string) {
    return suitabilityRepository.softDeleteVesselType(svtUuid);
  }

  async getFleetGroups(suitUuid: string) {
    return suitabilityRepository.findFleetGroups(suitUuid);
  }

  async addFleetGroup(suitUuid: string, fleetGroupUuid: string, userUuid?: string, auditUserUuidFromBody?: string | null, sortOrder?: number) {
    const auditUser = userUuid || auditUserUuidFromBody || null;
    return suitabilityRepository.createFleetGroup({
      sfgUuid: uuidv4(),
      suitUuid,
      fleetGroupUuid,
      sortOrder: sortOrder ?? 0,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async updateFleetGroupSortOrder(suitUuid: string, fleetGroupUuid: string, sortOrder: number) {
    return suitabilityRepository.updateFleetGroupSortOrder(suitUuid, fleetGroupUuid, sortOrder);
  }

  async softDeleteFleetGroup(sfgUuid: string) {
    return suitabilityRepository.softDeleteFleetGroup(sfgUuid);
  }

  async clearFleetGroups(suitUuid: string) {
    return suitabilityRepository.deleteFleetGroups(suitUuid);
  }
}

export class RecruitmentDecisionService {
  async getDecision(recCanUuid: string): Promise<CandRecruitmentDecision | undefined> {
    return recruitmentDecisionRepository.findByCandidateUuid(recCanUuid);
  }

  async getDecisionWithRelations(recCanUuid: string): Promise<{ decisionUuid: string; recruitmentStatus?: string | null; assignedGroups: any[] } | undefined> {
    const decision = await recruitmentDecisionRepository.findByCandidateUuid(recCanUuid);
    if (!decision) return undefined;
    
    const assignedGroups = await recruitmentDecisionRepository.findAssignedGroups(decision.decisionUuid);
    
    return {
      ...decision,
      assignedGroups,
    };
  }

  async upsertDecision(recCanUuid: string, data: Partial<InsertRecruitmentDecision>, userUuid?: string): Promise<CandRecruitmentDecision> {
    // Auto-extract auditUserUuid from data if not provided
    const auditUser = userUuid || (data as any).auditUserUuid || null;
    delete (data as any).auditUserUuid;

    return recruitmentDecisionRepository.upsert(recCanUuid, {
      decisionUuid: uuidv4(),
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async getAssignedGroups(decisionUuid: string) {
    return recruitmentDecisionRepository.findAssignedGroups(decisionUuid);
  }

  async addAssignedGroup(decisionUuid: string, groupUuid: string, userUuid?: string, auditUserUuidFromBody?: string | null) {
    const auditUser = userUuid || auditUserUuidFromBody || null;
    return recruitmentDecisionRepository.createAssignedGroup({
      cagUuid: uuidv4(),
      decisionUuid,
      groupUuid,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async clearAssignedGroups(decisionUuid: string) {
    return recruitmentDecisionRepository.deleteAssignedGroups(decisionUuid);
  }
}

export const approvalsService = new ApprovalsService();
export const suitabilityService = new SuitabilityService();
export const recruitmentDecisionService = new RecruitmentDecisionService();
