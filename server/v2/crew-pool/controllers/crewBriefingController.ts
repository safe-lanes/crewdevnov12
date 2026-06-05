import { Request, Response } from "express";
import { crewBriefingService } from "../services";
import {
  insertCrewBriefingSchema,
  insertCrewDebriefingSchema,
} from "@shared/v2/crew-pool/types";
import { z } from "zod";

export const crewBriefingController = {
  // ============ Briefings ============
  async getBriefings(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const briefings = await crewBriefingService.getBriefings(crewUuid);
      res.json(briefings);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch briefing records" });
    }
  },

  async createBriefing(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewBriefingSchema
        .omit({ briefingUuid: true, crewUuid: true })
        .parse(req.body);
      const briefing = await crewBriefingService.createBriefing(
        crewUuid,
        validatedData
      );
      res.status(201).json(briefing);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create briefing record" });
    }
  },

  async updateBriefing(req: Request, res: Response) {
    try {
      const { briefingUuid } = req.params;
      const validatedData = insertCrewBriefingSchema.partial().parse(req.body);
      const briefing = await crewBriefingService.updateBriefing(
        briefingUuid,
        validatedData
      );
      res.json(briefing);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update briefing record" });
    }
  },

  async deleteBriefing(req: Request, res: Response) {
    try {
      const { briefingUuid } = req.params;
      await crewBriefingService.deleteBriefing(briefingUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete briefing record" });
    }
  },

  async addBriefingAttachment(req: Request, res: Response) {
    try {
      const { briefingUuid } = req.params;
      const { fileName, filePath, fileUrl, fileType, mimeType, fileSize } = req.body;
      const resolvedFilePath = filePath || fileUrl || "";
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!fileName || !resolvedFilePath) {
        return res
          .status(400)
          .json({ error: "fileName and filePath/fileUrl are required" });
      }

      const attachment = await crewBriefingService.addBriefingAttachment(
        briefingUuid,
        {
          fileName,
          filePath: resolvedFilePath,
          fileType: resolvedFileType,
          fileSize: fileSize || "0",
        }
      );
      res.status(201).json(attachment);
    } catch (error) {
      res.status(500).json({ error: "Failed to add attachment" });
    }
  },

  async removeBriefingAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      await crewBriefingService.removeBriefingAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },

  // ============ De-briefings ============
  async getDebriefings(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const debriefings = await crewBriefingService.getDebriefings(crewUuid);
      res.json(debriefings);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch de-briefing records" });
    }
  },

  async createDebriefing(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewDebriefingSchema
        .omit({ debriefingUuid: true, crewUuid: true })
        .parse(req.body);
      const debriefing = await crewBriefingService.createDebriefing(
        crewUuid,
        validatedData
      );
      res.status(201).json(debriefing);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create de-briefing record" });
    }
  },

  async updateDebriefing(req: Request, res: Response) {
    try {
      const { debriefingUuid } = req.params;
      const validatedData = insertCrewDebriefingSchema.partial().parse(req.body);
      const debriefing = await crewBriefingService.updateDebriefing(
        debriefingUuid,
        validatedData
      );
      res.json(debriefing);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update de-briefing record" });
    }
  },

  async deleteDebriefing(req: Request, res: Response) {
    try {
      const { debriefingUuid } = req.params;
      await crewBriefingService.deleteDebriefing(debriefingUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete de-briefing record" });
    }
  },

  async addDebriefingAttachment(req: Request, res: Response) {
    try {
      const { debriefingUuid } = req.params;
      const { fileName, filePath, fileUrl, fileType, mimeType, fileSize } = req.body;
      const resolvedFilePath = filePath || fileUrl || "";
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!fileName || !resolvedFilePath) {
        return res
          .status(400)
          .json({ error: "fileName and filePath/fileUrl are required" });
      }

      const attachment = await crewBriefingService.addDebriefingAttachment(
        debriefingUuid,
        {
          fileName,
          filePath: resolvedFilePath,
          fileType: resolvedFileType,
          fileSize: fileSize || "0",
        }
      );
      res.status(201).json(attachment);
    } catch (error) {
      res.status(500).json({ error: "Failed to add attachment" });
    }
  },

  async removeDebriefingAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      await crewBriefingService.removeDebriefingAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },

  async getAllBriefingData(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const data = await crewBriefingService.getAllBriefingData(crewUuid);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch briefing data" });
    }
  },
};
