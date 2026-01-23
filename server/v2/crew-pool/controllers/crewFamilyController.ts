import { Request, Response } from "express";
import { crewProfileService } from "../services";
import {
  insertCrewFamilyInfoSchema,
  insertCrewChildSchema,
  insertCrewNextOfKinSchema,
} from "@shared/v2/crew-pool/types";
import { z } from "zod";

export const crewFamilyController = {
  async getFamilyInfo(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const familyInfo = await crewProfileService.getFamilyInfo(crewUuid);
      res.json(familyInfo);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch family info" });
    }
  },

  async upsertFamilyInfo(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewFamilyInfoSchema
        .omit({ famUuid: true, crewUuid: true })
        .parse(req.body);
      const familyInfo = await crewProfileService.upsertFamilyInfo(
        crewUuid,
        validatedData
      );
      res.json(familyInfo);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to save family info" });
    }
  },

  async getChildren(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const children = await crewProfileService.getChildren(crewUuid);
      res.json(children);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch children" });
    }
  },

  async createChild(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewChildSchema
        .omit({ childUuid: true, crewUuid: true })
        .parse(req.body);
      const child = await crewProfileService.createChild(
        crewUuid,
        validatedData
      );
      res.status(201).json(child);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to create child" });
    }
  },

  async updateChild(req: Request, res: Response) {
    try {
      const { childUuid } = req.params;
      const validatedData = insertCrewChildSchema.partial().parse(req.body);
      const child = await crewProfileService.updateChild(
        childUuid,
        validatedData
      );
      res.json(child);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update child" });
    }
  },

  async deleteChild(req: Request, res: Response) {
    try {
      const { childUuid } = req.params;
      await crewProfileService.deleteChild(childUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete child" });
    }
  },

  async getNextOfKin(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const nextOfKin = await crewProfileService.getNextOfKin(crewUuid);
      res.json(nextOfKin);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch next of kin" });
    }
  },

  async upsertNextOfKin(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewNextOfKinSchema
        .omit({ nokUuid: true, crewUuid: true })
        .parse(req.body);
      const nextOfKin = await crewProfileService.upsertNextOfKin(
        crewUuid,
        validatedData
      );
      res.json(nextOfKin);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to save next of kin" });
    }
  },
};
