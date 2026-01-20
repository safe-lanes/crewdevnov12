import { Request, Response } from "express";
import {
  approvalsService,
  suitabilityService,
  recruitmentDecisionService,
} from "../services/approvalsService";

export const approvalsController = {
  async getApprovals(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await approvalsService.getApprovals(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting approvals:", error);
      res.status(500).json({ error: "Failed to get approvals" });
    }
  },

  async createApproval(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await approvalsService.createApproval(recCanUuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating approval:", error);
      res.status(500).json({ error: "Failed to create approval" });
    }
  },

  async updateApproval(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const result = await approvalsService.updateApproval(id, req.body);
      if (!result) return res.status(404).json({ error: "Not found" });
      res.json(result);
    } catch (error) {
      console.error("Error updating approval:", error);
      res.status(500).json({ error: "Failed to update approval" });
    }
  },

  async deleteApproval(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const result = await approvalsService.deleteApproval(id);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting approval:", error);
      res.status(500).json({ error: "Failed to delete approval" });
    }
  },
};

export const suitabilityController = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await suitabilityService.getSuitability(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting suitability:", error);
      res.status(500).json({ error: "Failed to get suitability" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await suitabilityService.upsertSuitability(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting suitability:", error);
      res.status(500).json({ error: "Failed to upsert suitability" });
    }
  },

  async getVesselTypes(req: Request, res: Response) {
    try {
      const { suitUuid } = req.params;
      const result = await suitabilityService.getVesselTypes(suitUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting vessel types:", error);
      res.status(500).json({ error: "Failed to get vessel types" });
    }
  },

  async addVesselType(req: Request, res: Response) {
    try {
      const { suitUuid } = req.params;
      const { vesselTypeUuid } = req.body;
      const result = await suitabilityService.addVesselType(suitUuid, vesselTypeUuid);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error adding vessel type:", error);
      res.status(500).json({ error: "Failed to add vessel type" });
    }
  },

  async getFleetGroups(req: Request, res: Response) {
    try {
      const { suitUuid } = req.params;
      const result = await suitabilityService.getFleetGroups(suitUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting fleet groups:", error);
      res.status(500).json({ error: "Failed to get fleet groups" });
    }
  },

  async addFleetGroup(req: Request, res: Response) {
    try {
      const { suitUuid } = req.params;
      const { fleetGroupUuid } = req.body;
      const result = await suitabilityService.addFleetGroup(suitUuid, fleetGroupUuid);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error adding fleet group:", error);
      res.status(500).json({ error: "Failed to add fleet group" });
    }
  },
};

export const recruitmentDecisionController = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await recruitmentDecisionService.getDecision(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting decision:", error);
      res.status(500).json({ error: "Failed to get decision" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await recruitmentDecisionService.upsertDecision(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting decision:", error);
      res.status(500).json({ error: "Failed to upsert decision" });
    }
  },

  async getAssignedGroups(req: Request, res: Response) {
    try {
      const { decisionUuid } = req.params;
      const result = await recruitmentDecisionService.getAssignedGroups(decisionUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting assigned groups:", error);
      res.status(500).json({ error: "Failed to get assigned groups" });
    }
  },

  async addAssignedGroup(req: Request, res: Response) {
    try {
      const { decisionUuid } = req.params;
      const { groupUuid } = req.body;
      const result = await recruitmentDecisionService.addAssignedGroup(decisionUuid, groupUuid);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error adding assigned group:", error);
      res.status(500).json({ error: "Failed to add assigned group" });
    }
  },
};
