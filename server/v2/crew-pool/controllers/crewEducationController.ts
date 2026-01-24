import { Request, Response } from "express";
import { crewEducationService } from "../services";
import { insertCrewEducationSchema } from "@shared/v2/crew-pool/types";
import { z } from "zod";

export const crewEducationController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const education = await crewEducationService.getAll(crewUuid);
      res.json(education);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch education records" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewEducationSchema
        .omit({ eduUuid: true, crewUuid: true })
        .parse(req.body);
      const education = await crewEducationService.create(
        crewUuid,
        validatedData
      );
      res.status(201).json(education);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create education record" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { eduUuid } = req.params;
      const validatedData = insertCrewEducationSchema.partial().parse(req.body);
      const education = await crewEducationService.update(
        eduUuid,
        validatedData
      );
      res.json(education);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update education record" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { eduUuid } = req.params;
      await crewEducationService.delete(eduUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete education record" });
    }
  },

  async addAttachment(req: Request, res: Response) {
    try {
      const { eduUuid } = req.params;
      const { fileName, filePath, fileUrl, fileType, mimeType, fileSize } = req.body;
      const resolvedFilePath = filePath || fileUrl || '';
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!fileName || !resolvedFilePath) {
        return res
          .status(400)
          .json({ error: "fileName and filePath/fileUrl are required" });
      }

      const attachment = await crewEducationService.addAttachment(eduUuid, {
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
      await crewEducationService.removeAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },
};
