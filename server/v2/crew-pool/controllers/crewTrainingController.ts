import { Request, Response } from "express";
import { crewCertificatesService } from "../services";
import { insertCrewTrainingCourseSchema } from "@shared/v2/crew-pool/types";
import { z } from "zod";

export const crewTrainingController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const training = await crewCertificatesService.getTraining(crewUuid);
      res.json(training);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch training records" });
    }
  },

  async getExpiring(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const { withinDays } = req.query;
      const days = withinDays ? parseInt(withinDays as string) : 30;
      const result = await crewCertificatesService.checkExpiringCertificates(
        crewUuid,
        days
      );
      res.json(result.expiringTraining);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch expiring training" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewTrainingCourseSchema
        .omit({ trainUuid: true, crewUuid: true })
        .parse(req.body);
      const training = await crewCertificatesService.createTraining(
        crewUuid,
        validatedData
      );
      res.status(201).json(training);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create training record" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { trainUuid } = req.params;
      const validatedData = insertCrewTrainingCourseSchema
        .partial()
        .parse(req.body);
      const training = await crewCertificatesService.updateTraining(
        trainUuid,
        validatedData
      );
      res.json(training);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update training record" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { trainUuid } = req.params;
      await crewCertificatesService.deleteTraining(trainUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete training record" });
    }
  },

  async addAttachment(req: Request, res: Response) {
    try {
      const { trainUuid } = req.params;
      const { fileName, filePath, fileType, fileSize } = req.body;

      if (!fileName || !filePath) {
        return res
          .status(400)
          .json({ error: "fileName and filePath are required" });
      }

      const attachment = await crewCertificatesService.addTrainingAttachment(
        trainUuid,
        {
          fileName,
          filePath,
          fileType: fileType || "application/octet-stream",
          fileSize: fileSize || "0",
        }
      );
      res.status(201).json(attachment);
    } catch (error) {
      res.status(500).json({ error: "Failed to add attachment" });
    }
  },

  async removeAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      await crewCertificatesService.removeTrainingAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },
};
