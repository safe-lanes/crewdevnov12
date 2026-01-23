import { Request, Response } from "express";
import { crewMembersService } from "../services";
import { insertCrewMemberV2Schema } from "@shared/v2/crew-pool/types";
import { z } from "zod";

export const crewMembersController = {
  async getAll(req: Request, res: Response) {
    try {
      const { status, isActive, search } = req.query;
      const crew = await crewMembersService.getAll({
        status: status as string | undefined,
        isActive: isActive !== undefined ? isActive === "true" : undefined,
        search: search as string | undefined,
      });
      res.json(crew);
    } catch (error) {
      console.error("Error fetching crew:", error);
      res.status(500).json({ error: "Failed to fetch crew members" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const crew = await crewMembersService.getByUuid(crewUuid);
      res.json(crew);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching crew:", error);
      res.status(500).json({ error: "Failed to fetch crew member" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const validatedData = insertCrewMemberV2Schema
        .omit({ crewUuid: true })
        .parse(req.body);
      const crew = await crewMembersService.create(validatedData);
      res.status(201).json(crew);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating crew:", error);
      res.status(500).json({ error: "Failed to create crew member" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewMemberV2Schema.partial().parse(req.body);
      const crew = await crewMembersService.update(crewUuid, validatedData);
      res.json(crew);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating crew:", error);
      res.status(500).json({ error: "Failed to update crew member" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      await crewMembersService.archive(crewUuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting crew:", error);
      res.status(500).json({ error: "Failed to delete crew member" });
    }
  },
};
