import { Request, Response } from "express";
import { crewVisasService } from "../services";
import { insertCrewVisaSchema } from "@shared/v2/crew-pool/types";
import { z } from "zod";

export const crewVisasController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const visas = await crewVisasService.getAll(crewUuid);
      res.json(visas);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch visas" });
    }
  },

  async getExpiring(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const { withinDays } = req.query;
      const days = withinDays ? parseInt(withinDays as string) : 30;
      const visas = await crewVisasService.checkExpiringVisas(crewUuid, days);
      res.json(visas);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch expiring visas" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewVisaSchema
        .omit({ visaUuid: true, crewUuid: true })
        .parse(req.body);
      const visa = await crewVisasService.create(crewUuid, validatedData);
      res.status(201).json(visa);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create visa" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { visaUuid } = req.params;
      const validatedData = insertCrewVisaSchema.partial().parse(req.body);
      const visa = await crewVisasService.update(visaUuid, validatedData);
      res.json(visa);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update visa" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { visaUuid } = req.params;
      await crewVisasService.delete(visaUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete visa" });
    }
  },

  async addAttachment(req: Request, res: Response) {
    try {
      const { visaUuid } = req.params;
      const { fileName, filePath, fileUrl, fileType, mimeType, fileSize } = req.body;
      const resolvedFilePath = filePath || fileUrl || '';
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!fileName || !resolvedFilePath) {
        return res
          .status(400)
          .json({ error: "fileName and filePath/fileUrl are required" });
      }

      const attachment = await crewVisasService.addAttachment(visaUuid, {
        fileName,
        filePath: resolvedFilePath,
        fileType: resolvedFileType,
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
      await crewVisasService.removeAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },
};
