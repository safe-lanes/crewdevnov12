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

  async getAllWithDetails(req: Request, res: Response) {
    try {
      const { rank, nationality, status, search, vesselUuid, limit, offset } = req.query;
      const result = await crewMembersService.getAllWithDetails({
        rank: rank as string | undefined,
        nationality: nationality as string | undefined,
        status: status as string | undefined,
        search: search as string | undefined,
        vesselUuid: vesselUuid as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching crew with details:", error);
      res.status(500).json({ error: "Failed to fetch crew members with details" });
    }
  },

  async getByEmpNo(req: Request, res: Response) {
    try {
      const { empNo } = req.params;
      const crew = await crewMembersService.getByEmpNo(empNo);
      res.json(crew);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching crew by empNo:", error);
      res.status(500).json({ error: "Failed to fetch crew member" });
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

  async getFullProfile(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const profile = await crewMembersService.getFullProfile(crewUuid);
      if (!profile) {
        return res.status(404).json({ error: `Crew member not found: ${crewUuid}` });
      }
      res.json(profile);
    } catch (error: any) {
      console.error("Error fetching full profile:", error);
      res.status(500).json({ error: "Failed to fetch crew profile" });
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

  async createWithRelatedData(req: Request, res: Response) {
    try {
      const crew = await crewMembersService.createWithRelatedData(req.body);
      res.status(201).json(crew);
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating crew with related data:", error);
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

  async updateWithProtection(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const { allowVesselClear, ...data } = req.body;
      const crew = await crewMembersService.updateWithProtection(
        crewUuid,
        data,
        { allowVesselClear: allowVesselClear === true }
      );
      res.json(crew);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("already in use")) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Error updating crew with protection:", error);
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

  async unarchive(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      await crewMembersService.unarchive(crewUuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error unarchiving crew:", error);
      res.status(500).json({ error: "Failed to unarchive crew member" });
    }
  },
};
