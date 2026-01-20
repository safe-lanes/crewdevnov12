import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import {
  hiringDecisions,
  offerLetters,
  employmentContracts,
  onboardingTasks,
  decisionAuditTrail,
  approvalWorkflows,
} from "@shared/v2/recruitment/schema";

// Type definitions
type HiringDecision = typeof hiringDecisions.$inferSelect;
type OfferLetter = typeof offerLetters.$inferSelect;
type EmploymentContract = typeof employmentContracts.$inferSelect;
type OnboardingTask = typeof onboardingTasks.$inferSelect;
type DecisionAudit = typeof decisionAuditTrail.$inferSelect;
type ApprovalWorkflow = typeof approvalWorkflows.$inferSelect;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CreateData = Record<string, any>;

// ============================================================================
// HIRING DECISIONS REPOSITORY
// ============================================================================

export const hiringDecisionsRepository = {
  async findByRecCanUuid(recCanUuid: string): Promise<HiringDecision | null> {
    const db = getDb();
    const results = await db
      .select()
      .from(hiringDecisions)
      .where(and(eq(hiringDecisions.recCanUuid, recCanUuid), eq(hiringDecisions.isDeleted, false)));
    return results[0] || null;
  },

  async create(data: CreateData): Promise<HiringDecision> {
    const db = getDb();
    const results = await db.insert(hiringDecisions).values(data).returning();
    return results[0];
  },

  async update(decisionUuid: string, data: Partial<HiringDecision>): Promise<HiringDecision | null> {
    const db = getDb();
    const results = await db
      .update(hiringDecisions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(hiringDecisions.decisionUuid, decisionUuid))
      .returning();
    return results[0] || null;
  },

  async softDelete(decisionUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(hiringDecisions)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(hiringDecisions.decisionUuid, decisionUuid))
      .returning();
    return results.length > 0;
  },
};

// ============================================================================
// OFFER LETTERS REPOSITORY
// ============================================================================

export const offerLettersRepository = {
  async findAllByRecCanUuid(recCanUuid: string): Promise<OfferLetter[]> {
    const db = getDb();
    return db
      .select()
      .from(offerLetters)
      .where(and(eq(offerLetters.recCanUuid, recCanUuid), eq(offerLetters.isDeleted, false)));
  },

  async findByOfferUuid(offerUuid: string): Promise<OfferLetter | null> {
    const db = getDb();
    const results = await db
      .select()
      .from(offerLetters)
      .where(and(eq(offerLetters.offerUuid, offerUuid), eq(offerLetters.isDeleted, false)));
    return results[0] || null;
  },

  async create(data: CreateData): Promise<OfferLetter> {
    const db = getDb();
    const results = await db.insert(offerLetters).values(data).returning();
    return results[0];
  },

  async update(offerUuid: string, data: Partial<OfferLetter>): Promise<OfferLetter | null> {
    const db = getDb();
    const results = await db
      .update(offerLetters)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(offerLetters.offerUuid, offerUuid))
      .returning();
    return results[0] || null;
  },

  async softDelete(offerUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(offerLetters)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(offerLetters.offerUuid, offerUuid))
      .returning();
    return results.length > 0;
  },
};

// ============================================================================
// EMPLOYMENT CONTRACTS REPOSITORY
// ============================================================================

export const employmentContractsRepository = {
  async findAllByRecCanUuid(recCanUuid: string): Promise<EmploymentContract[]> {
    const db = getDb();
    return db
      .select()
      .from(employmentContracts)
      .where(and(eq(employmentContracts.recCanUuid, recCanUuid), eq(employmentContracts.isDeleted, false)));
  },

  async findByContractUuid(contractUuid: string): Promise<EmploymentContract | null> {
    const db = getDb();
    const results = await db
      .select()
      .from(employmentContracts)
      .where(and(eq(employmentContracts.contractUuid, contractUuid), eq(employmentContracts.isDeleted, false)));
    return results[0] || null;
  },

  async create(data: CreateData): Promise<EmploymentContract> {
    const db = getDb();
    const results = await db.insert(employmentContracts).values(data).returning();
    return results[0];
  },

  async update(contractUuid: string, data: Partial<EmploymentContract>): Promise<EmploymentContract | null> {
    const db = getDb();
    const results = await db
      .update(employmentContracts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employmentContracts.contractUuid, contractUuid))
      .returning();
    return results[0] || null;
  },

  async softDelete(contractUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(employmentContracts)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(employmentContracts.contractUuid, contractUuid))
      .returning();
    return results.length > 0;
  },
};

// ============================================================================
// ONBOARDING TASKS REPOSITORY
// ============================================================================

export const onboardingTasksRepository = {
  async findAllByRecCanUuid(recCanUuid: string): Promise<OnboardingTask[]> {
    const db = getDb();
    return db
      .select()
      .from(onboardingTasks)
      .where(and(eq(onboardingTasks.recCanUuid, recCanUuid), eq(onboardingTasks.isDeleted, false)));
  },

  async findByTaskUuid(taskUuid: string): Promise<OnboardingTask | null> {
    const db = getDb();
    const results = await db
      .select()
      .from(onboardingTasks)
      .where(and(eq(onboardingTasks.taskUuid, taskUuid), eq(onboardingTasks.isDeleted, false)));
    return results[0] || null;
  },

  async create(data: CreateData): Promise<OnboardingTask> {
    const db = getDb();
    const results = await db.insert(onboardingTasks).values(data).returning();
    return results[0];
  },

  async update(taskUuid: string, data: Partial<OnboardingTask>): Promise<OnboardingTask | null> {
    const db = getDb();
    const results = await db
      .update(onboardingTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(onboardingTasks.taskUuid, taskUuid))
      .returning();
    return results[0] || null;
  },

  async softDelete(taskUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(onboardingTasks)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(onboardingTasks.taskUuid, taskUuid))
      .returning();
    return results.length > 0;
  },
};

// ============================================================================
// DECISION AUDIT TRAIL REPOSITORY
// ============================================================================

export const decisionAuditTrailRepository = {
  async findAllByRecCanUuid(recCanUuid: string): Promise<DecisionAudit[]> {
    const db = getDb();
    return db
      .select()
      .from(decisionAuditTrail)
      .where(and(eq(decisionAuditTrail.recCanUuid, recCanUuid), eq(decisionAuditTrail.isDeleted, false)));
  },

  async findByAuditUuid(auditUuid: string): Promise<DecisionAudit | null> {
    const db = getDb();
    const results = await db
      .select()
      .from(decisionAuditTrail)
      .where(and(eq(decisionAuditTrail.auditUuid, auditUuid), eq(decisionAuditTrail.isDeleted, false)));
    return results[0] || null;
  },

  async create(data: CreateData): Promise<DecisionAudit> {
    const db = getDb();
    const results = await db.insert(decisionAuditTrail).values(data).returning();
    return results[0];
  },

  async softDelete(auditUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(decisionAuditTrail)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(decisionAuditTrail.auditUuid, auditUuid))
      .returning();
    return results.length > 0;
  },
};

// ============================================================================
// APPROVAL WORKFLOWS REPOSITORY
// ============================================================================

export const approvalWorkflowsRepository = {
  async findAllByRecCanUuid(recCanUuid: string): Promise<ApprovalWorkflow[]> {
    const db = getDb();
    return db
      .select()
      .from(approvalWorkflows)
      .where(and(eq(approvalWorkflows.recCanUuid, recCanUuid), eq(approvalWorkflows.isDeleted, false)));
  },

  async findByWorkflowUuid(workflowUuid: string): Promise<ApprovalWorkflow | null> {
    const db = getDb();
    const results = await db
      .select()
      .from(approvalWorkflows)
      .where(and(eq(approvalWorkflows.workflowUuid, workflowUuid), eq(approvalWorkflows.isDeleted, false)));
    return results[0] || null;
  },

  async create(data: CreateData): Promise<ApprovalWorkflow> {
    const db = getDb();
    const results = await db.insert(approvalWorkflows).values(data).returning();
    return results[0];
  },

  async update(workflowUuid: string, data: Partial<ApprovalWorkflow>): Promise<ApprovalWorkflow | null> {
    const db = getDb();
    const results = await db
      .update(approvalWorkflows)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(approvalWorkflows.workflowUuid, workflowUuid))
      .returning();
    return results[0] || null;
  },

  async softDelete(workflowUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(approvalWorkflows)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(approvalWorkflows.workflowUuid, workflowUuid))
      .returning();
    return results.length > 0;
  },
};
