import { Request, Response } from "express";
import {
  hiringDecisionsService,
  offerLettersService,
  employmentContractsService,
  onboardingTasksService,
  decisionAuditTrailService,
  approvalWorkflowsService,
} from "../services/approvalsService";
import {
  createHiringDecisionRequestSchema,
  createOfferLetterRequestSchema,
  createEmploymentContractRequestSchema,
  createOnboardingTaskRequestSchema,
  createDecisionAuditTrailRequestSchema,
  createApprovalWorkflowRequestSchema,
} from "@shared/v2/recruitment/types";

// ============================================================================
// HIRING DECISIONS CONTROLLER
// ============================================================================

export const hiringDecisionsController = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await hiringDecisionsService.getByRecCanUuid(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting hiring decision:", error);
      res.status(500).json({ error: "Failed to get hiring decision" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const parsed = createHiringDecisionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      }
      const result = await hiringDecisionsService.upsert(recCanUuid, parsed.data);
      res.json(result);
    } catch (error) {
      console.error("Error upserting hiring decision:", error);
      res.status(500).json({ error: "Failed to upsert hiring decision" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { decisionUuid } = req.params;
      const result = await hiringDecisionsService.delete(decisionUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting hiring decision:", error);
      res.status(500).json({ error: "Failed to delete hiring decision" });
    }
  },
};

// ============================================================================
// OFFER LETTERS CONTROLLER
// ============================================================================

export const offerLettersController = {
  async getAll(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await offerLettersService.getAllByRecCanUuid(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting offer letters:", error);
      res.status(500).json({ error: "Failed to get offer letters" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const parsed = createOfferLetterRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      }
      const result = await offerLettersService.create(recCanUuid, parsed.data);
      res.json(result);
    } catch (error) {
      console.error("Error creating offer letter:", error);
      res.status(500).json({ error: "Failed to create offer letter" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { offerUuid } = req.params;
      const parsed = createOfferLetterRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      }
      const result = await offerLettersService.update(offerUuid, parsed.data);
      res.json(result);
    } catch (error) {
      console.error("Error updating offer letter:", error);
      res.status(500).json({ error: "Failed to update offer letter" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { offerUuid } = req.params;
      const result = await offerLettersService.delete(offerUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting offer letter:", error);
      res.status(500).json({ error: "Failed to delete offer letter" });
    }
  },
};

// ============================================================================
// EMPLOYMENT CONTRACTS CONTROLLER
// ============================================================================

export const employmentContractsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await employmentContractsService.getAllByRecCanUuid(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting employment contracts:", error);
      res.status(500).json({ error: "Failed to get employment contracts" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const parsed = createEmploymentContractRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      }
      const result = await employmentContractsService.create(recCanUuid, parsed.data);
      res.json(result);
    } catch (error) {
      console.error("Error creating employment contract:", error);
      res.status(500).json({ error: "Failed to create employment contract" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { contractUuid } = req.params;
      const parsed = createEmploymentContractRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      }
      const result = await employmentContractsService.update(contractUuid, parsed.data);
      res.json(result);
    } catch (error) {
      console.error("Error updating employment contract:", error);
      res.status(500).json({ error: "Failed to update employment contract" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { contractUuid } = req.params;
      const result = await employmentContractsService.delete(contractUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting employment contract:", error);
      res.status(500).json({ error: "Failed to delete employment contract" });
    }
  },
};

// ============================================================================
// ONBOARDING TASKS CONTROLLER
// ============================================================================

export const onboardingTasksController = {
  async getAll(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await onboardingTasksService.getAllByRecCanUuid(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting onboarding tasks:", error);
      res.status(500).json({ error: "Failed to get onboarding tasks" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const parsed = createOnboardingTaskRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      }
      const result = await onboardingTasksService.create(recCanUuid, parsed.data);
      res.json(result);
    } catch (error) {
      console.error("Error creating onboarding task:", error);
      res.status(500).json({ error: "Failed to create onboarding task" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { taskUuid } = req.params;
      const parsed = createOnboardingTaskRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      }
      const result = await onboardingTasksService.update(taskUuid, parsed.data);
      res.json(result);
    } catch (error) {
      console.error("Error updating onboarding task:", error);
      res.status(500).json({ error: "Failed to update onboarding task" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { taskUuid } = req.params;
      const result = await onboardingTasksService.delete(taskUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting onboarding task:", error);
      res.status(500).json({ error: "Failed to delete onboarding task" });
    }
  },
};

// ============================================================================
// DECISION AUDIT TRAIL CONTROLLER
// ============================================================================

export const decisionAuditTrailController = {
  async getAll(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await decisionAuditTrailService.getAllByRecCanUuid(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting decision audit trail:", error);
      res.status(500).json({ error: "Failed to get decision audit trail" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const parsed = createDecisionAuditTrailRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      }
      const result = await decisionAuditTrailService.create(recCanUuid, parsed.data);
      res.json(result);
    } catch (error) {
      console.error("Error creating audit trail entry:", error);
      res.status(500).json({ error: "Failed to create audit trail entry" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { auditUuid } = req.params;
      const result = await decisionAuditTrailService.delete(auditUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting audit trail entry:", error);
      res.status(500).json({ error: "Failed to delete audit trail entry" });
    }
  },
};

// ============================================================================
// APPROVAL WORKFLOWS CONTROLLER
// ============================================================================

export const approvalWorkflowsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await approvalWorkflowsService.getAllByRecCanUuid(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting approval workflows:", error);
      res.status(500).json({ error: "Failed to get approval workflows" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const parsed = createApprovalWorkflowRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      }
      const result = await approvalWorkflowsService.create(recCanUuid, parsed.data);
      res.json(result);
    } catch (error) {
      console.error("Error creating approval workflow:", error);
      res.status(500).json({ error: "Failed to create approval workflow" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { workflowUuid } = req.params;
      const parsed = createApprovalWorkflowRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      }
      const result = await approvalWorkflowsService.update(workflowUuid, parsed.data);
      res.json(result);
    } catch (error) {
      console.error("Error updating approval workflow:", error);
      res.status(500).json({ error: "Failed to update approval workflow" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { workflowUuid } = req.params;
      const result = await approvalWorkflowsService.delete(workflowUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting approval workflow:", error);
      res.status(500).json({ error: "Failed to delete approval workflow" });
    }
  },
};
