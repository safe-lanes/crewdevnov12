import { v4 as uuidv4 } from "uuid";
import {
  hiringDecisionsRepository,
  offerLettersRepository,
  employmentContractsRepository,
  onboardingTasksRepository,
  decisionAuditTrailRepository,
  approvalWorkflowsRepository,
} from "../repositories/approvalsRepository";
import {
  CreateHiringDecisionRequest,
  CreateOfferLetterRequest,
  CreateEmploymentContractRequest,
  CreateOnboardingTaskRequest,
  CreateDecisionAuditTrailRequest,
  CreateApprovalWorkflowRequest,
} from "@shared/v2/recruitment/types";

// Default audit columns for new records
const auditDefaults = {
  createdByUuid: null,
  updatedByUuid: null,
  isDeleted: false,
  isSync: false,
};

// ============================================================================
// HIRING DECISIONS SERVICE
// ============================================================================

export const hiringDecisionsService = {
  async getByRecCanUuid(recCanUuid: string) {
    return hiringDecisionsRepository.findByRecCanUuid(recCanUuid);
  },

  async upsert(recCanUuid: string, data: CreateHiringDecisionRequest) {
    const existing = await hiringDecisionsRepository.findByRecCanUuid(recCanUuid);
    if (existing) {
      return hiringDecisionsRepository.update(existing.decisionUuid, data);
    }
    return hiringDecisionsRepository.create({
      decisionUuid: uuidv4(),
      recCanUuid,
      ...auditDefaults,
      ...data,
    });
  },

  async delete(decisionUuid: string) {
    return hiringDecisionsRepository.softDelete(decisionUuid);
  },
};

// ============================================================================
// OFFER LETTERS SERVICE
// ============================================================================

export const offerLettersService = {
  async getAllByRecCanUuid(recCanUuid: string) {
    return offerLettersRepository.findAllByRecCanUuid(recCanUuid);
  },

  async getByOfferUuid(offerUuid: string) {
    return offerLettersRepository.findByOfferUuid(offerUuid);
  },

  async create(recCanUuid: string, data: CreateOfferLetterRequest) {
    return offerLettersRepository.create({
      offerUuid: uuidv4(),
      recCanUuid,
      ...auditDefaults,
      ...data,
    });
  },

  async update(offerUuid: string, data: CreateOfferLetterRequest) {
    return offerLettersRepository.update(offerUuid, data);
  },

  async delete(offerUuid: string) {
    return offerLettersRepository.softDelete(offerUuid);
  },
};

// ============================================================================
// EMPLOYMENT CONTRACTS SERVICE
// ============================================================================

export const employmentContractsService = {
  async getAllByRecCanUuid(recCanUuid: string) {
    return employmentContractsRepository.findAllByRecCanUuid(recCanUuid);
  },

  async getByContractUuid(contractUuid: string) {
    return employmentContractsRepository.findByContractUuid(contractUuid);
  },

  async create(recCanUuid: string, data: CreateEmploymentContractRequest) {
    return employmentContractsRepository.create({
      contractUuid: uuidv4(),
      recCanUuid,
      ...auditDefaults,
      ...data,
    });
  },

  async update(contractUuid: string, data: CreateEmploymentContractRequest) {
    return employmentContractsRepository.update(contractUuid, data);
  },

  async delete(contractUuid: string) {
    return employmentContractsRepository.softDelete(contractUuid);
  },
};

// ============================================================================
// ONBOARDING TASKS SERVICE
// ============================================================================

export const onboardingTasksService = {
  async getAllByRecCanUuid(recCanUuid: string) {
    return onboardingTasksRepository.findAllByRecCanUuid(recCanUuid);
  },

  async getByTaskUuid(taskUuid: string) {
    return onboardingTasksRepository.findByTaskUuid(taskUuid);
  },

  async create(recCanUuid: string, data: CreateOnboardingTaskRequest) {
    return onboardingTasksRepository.create({
      taskUuid: uuidv4(),
      recCanUuid,
      ...auditDefaults,
      ...data,
    });
  },

  async update(taskUuid: string, data: CreateOnboardingTaskRequest) {
    return onboardingTasksRepository.update(taskUuid, data);
  },

  async delete(taskUuid: string) {
    return onboardingTasksRepository.softDelete(taskUuid);
  },
};

// ============================================================================
// DECISION AUDIT TRAIL SERVICE
// ============================================================================

export const decisionAuditTrailService = {
  async getAllByRecCanUuid(recCanUuid: string) {
    return decisionAuditTrailRepository.findAllByRecCanUuid(recCanUuid);
  },

  async create(recCanUuid: string, data: CreateDecisionAuditTrailRequest) {
    return decisionAuditTrailRepository.create({
      auditUuid: uuidv4(),
      recCanUuid,
      ...auditDefaults,
      ...data,
    });
  },

  async delete(auditUuid: string) {
    return decisionAuditTrailRepository.softDelete(auditUuid);
  },
};

// ============================================================================
// APPROVAL WORKFLOWS SERVICE
// ============================================================================

export const approvalWorkflowsService = {
  async getAllByRecCanUuid(recCanUuid: string) {
    return approvalWorkflowsRepository.findAllByRecCanUuid(recCanUuid);
  },

  async getByWorkflowUuid(workflowUuid: string) {
    return approvalWorkflowsRepository.findByWorkflowUuid(workflowUuid);
  },

  async create(recCanUuid: string, data: CreateApprovalWorkflowRequest) {
    return approvalWorkflowsRepository.create({
      workflowUuid: uuidv4(),
      recCanUuid,
      ...auditDefaults,
      ...data,
    });
  },

  async update(workflowUuid: string, data: CreateApprovalWorkflowRequest) {
    return approvalWorkflowsRepository.update(workflowUuid, data);
  },

  async delete(workflowUuid: string) {
    return approvalWorkflowsRepository.softDelete(workflowUuid);
  },
};
