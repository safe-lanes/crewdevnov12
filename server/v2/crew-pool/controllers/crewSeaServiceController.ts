import { Request, Response } from "express";
import { crewSeaServiceService } from "../services";
import { insertCrewSeaServiceSchema } from "@shared/v2/crew-pool/types";
import { z } from "zod";

export const crewSeaServiceController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const seaService = await crewSeaServiceService.getAll(crewUuid);
      res.json(seaService);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch sea service records" });
    }
  },

  async getByType(req: Request, res: Response) {
    try {
      const { crewUuid, serviceType } = req.params;
      const seaService = await crewSeaServiceService.getByType(
        crewUuid,
        serviceType
      );
      res.json(seaService);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch sea service by type" });
    }
  },

  async getTotalExperience(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const experience = await crewSeaServiceService.getTotalExperience(
        crewUuid
      );
      res.json(experience);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to calculate experience" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewSeaServiceSchema
        .omit({ seaUuid: true, crewUuid: true })
        .parse(req.body);
      const seaService = await crewSeaServiceService.create(
        crewUuid,
        validatedData
      );
      res.status(201).json(seaService);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create sea service record" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { seaUuid } = req.params;
      const validatedData = insertCrewSeaServiceSchema
        .partial()
        .parse(req.body);
      const seaService = await crewSeaServiceService.update(
        seaUuid,
        validatedData
      );
      res.json(seaService);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update sea service record" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { seaUuid } = req.params;
      await crewSeaServiceService.delete(seaUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete sea service record" });
    }
  },

  async addAttachment(req: Request, res: Response) {
    try {
      const { seaUuid } = req.params;
      const { fileName, filePath, fileType, fileSize } = req.body;

      if (!fileName || !filePath) {
        return res
          .status(400)
          .json({ error: "fileName and filePath are required" });
      }

      const attachment = await crewSeaServiceService.addAttachment(seaUuid, {
        fileName,
        filePath,
        fileType: fileType || "application/octet-stream",
        fileSize: fileSize || "0",
      });
      res.status(201).json(attachment);
    } catch (error) {
      res.status(500).json({ error: "Failed to add attachment" });
    }
  },

  async removeAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      await crewSeaServiceService.removeAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },
};
