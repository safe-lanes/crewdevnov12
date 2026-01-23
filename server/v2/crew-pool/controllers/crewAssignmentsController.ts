import { Request, Response } from "express";
import { crewAssignmentsService } from "../services";
import { insertCrewAssignmentSchema } from "@shared/v2/crew-pool/types";
import { z } from "zod";

export const crewAssignmentsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const assignments = await crewAssignmentsService.getAll(crewUuid);
      res.json(assignments);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  },

  async getCurrent(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const assignment = await crewAssignmentsService.getCurrent(crewUuid);
      res.json(assignment);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch current assignment" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewAssignmentSchema
        .omit({ assignUuid: true, crewUuid: true })
        .parse(req.body);
      const assignment = await crewAssignmentsService.create(
        crewUuid,
        validatedData
      );
      res.status(201).json(assignment);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create assignment" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { assignUuid } = req.params;
      const validatedData = insertCrewAssignmentSchema.partial().parse(req.body);
      const assignment = await crewAssignmentsService.update(
        assignUuid,
        validatedData
      );
      res.json(assignment);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update assignment" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { assignUuid } = req.params;
      await crewAssignmentsService.delete(assignUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete assignment" });
    }
  },
};
