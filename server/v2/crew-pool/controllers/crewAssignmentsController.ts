import { Request, Response } from "express";
import { crewAssignmentsService } from "../services";
import { insertCrewAssignmentSchema } from "@shared/v2/crew-pool/types";
import { z } from "zod";

const assignToVesselSchema = z.object({
  vesselUuid: z.string().uuid(),
  vesselName: z.string().optional(),
  rank: z.string().optional(),
  assignmentType: z.enum(["primary", "secondary"]).optional().default("primary"),
  signOnDate: z.string().optional(),
  reliefDue: z.string().optional(),
  contractPeriod: z.string().optional(),
  notes: z.string().optional(),
});

const signOffSchema = z.object({
  signOffDate: z.string().optional(),
  signOffReason: z.string().optional(),
  signOffNotes: z.string().optional(),
});

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

  async getHistory(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const { limit } = req.query;
      const history = await crewAssignmentsService.getAssignmentHistory(
        crewUuid,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(history);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch assignment history" });
    }
  },

  async getVesselCrew(req: Request, res: Response) {
    try {
      const { vesselUuid } = req.params;
      const { includeSecondary } = req.query;
      const crew = await crewAssignmentsService.getVesselCrew(
        vesselUuid,
        includeSecondary === "true"
      );
      res.json(crew);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vessel crew" });
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

  async assignToVessel(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = assignToVesselSchema.parse(req.body);
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const assignment = await crewAssignmentsService.assignToVessel(
        crewUuid,
        validatedData.vesselUuid,
        { ...validatedData, auditUserUuid }
      );
      res.status(201).json(assignment);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("already assigned")) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to assign crew to vessel" });
    }
  },

  async signOff(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = signOffSchema.parse(req.body);
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const assignment = await crewAssignmentsService.signOff(
        crewUuid,
        { ...validatedData, auditUserUuid }
      );
      if (!assignment) {
        return res.status(404).json({ error: "No active assignment found" });
      }
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
      res.status(500).json({ error: "Failed to sign off crew" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { assignUuid } = req.params;
      const validatedData = insertCrewAssignmentSchema.partial().parse(req.body);
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const assignment = await crewAssignmentsService.update(
        assignUuid,
        { ...validatedData, auditUserUuid }
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
