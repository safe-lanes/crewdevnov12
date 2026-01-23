import { Request, Response } from "express";
import { crewDocumentsService } from "../services";
import { insertCrewDocumentSchema } from "@shared/v2/crew-pool/types";
import { z } from "zod";

export const crewDocumentsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const documents = await crewDocumentsService.getAll(crewUuid);
      res.json(documents);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewDocumentSchema
        .omit({ docUuid: true, crewUuid: true })
        .parse(req.body);
      const document = await crewDocumentsService.create(
        crewUuid,
        validatedData
      );
      res.status(201).json(document);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create document" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { docUuid } = req.params;
      const validatedData = insertCrewDocumentSchema.partial().parse(req.body);
      const document = await crewDocumentsService.update(docUuid, validatedData);
      res.json(document);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update document" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { docUuid } = req.params;
      await crewDocumentsService.delete(docUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete document" });
    }
  },

  async addAttachment(req: Request, res: Response) {
    try {
      const { docUuid } = req.params;
      const { fileName, filePath, fileType, fileSize } = req.body;

      if (!fileName || !filePath) {
        return res
          .status(400)
          .json({ error: "fileName and filePath are required" });
      }

      const attachment = await crewDocumentsService.addAttachment(docUuid, {
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
      await crewDocumentsService.removeAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },
};
