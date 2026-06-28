import { Request, Response } from "express";
import { crewProfileService } from "../services";
import {
  insertCrewPersonalDetailsSchema,
  insertCrewAddressSchema,
} from "@shared/v2/crew-pool/types";
import { z } from "zod";

export const crewPersonalController = {
  async getPersonalDetails(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const details = await crewProfileService.getPersonalDetails(crewUuid);
      res.json(details);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch personal details" });
    }
  },

  async upsertPersonalDetails(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewPersonalDetailsSchema
        .omit({ cpdUuid: true, crewUuid: true })
        .parse(req.body);
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const details = await crewProfileService.upsertPersonalDetails(
        crewUuid,
        { ...validatedData, auditUserUuid }
      );
      res.json(details);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to save personal details" });
    }
  },

  async getAddress(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const address = await crewProfileService.getAddress(crewUuid);
      res.json(address);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch address" });
    }
  },

  async upsertAddress(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewAddressSchema
        .omit({ addrUuid: true, crewUuid: true })
        .parse(req.body);
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const address = await crewProfileService.upsertAddress(
        crewUuid,
        { ...validatedData, auditUserUuid }
      );
      res.json(address);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to save address" });
    }
  },
};
