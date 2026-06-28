import { Request, Response } from "express";
import { crewBriefingService } from "../services";
import {
  insertCrewBriefingSchema,
  insertCrewDebriefingSchema,
} from "@shared/v2/crew-pool/types";
import { z } from "zod";
import {
  fileStorageService,
  AttachmentValidationError,
} from "../../shared/fileStorageService.js";
import {
  serveAttachmentFromFilePath,
  decodeStoredFile,
} from "../../shared/serveAttachmentHelper.js";

/**
 * Normalize a stored attachment record for serving. Legacy rows written by the
 * pre-migration code path may carry a base64 data URL wrongly persisted in the
 * file_path column; treat any data: value as fileData so the shared helper's
 * dual-read path serves it instead of attempting a (failing) disk read.
 */
function normalizeForServe(att: {
  fileName?: string | null;
  fileType?: string | null;
  filePath?: string | null;
  fileData?: string | null;
}) {
  const filePathIsDataUrl = !!att.filePath && att.filePath.startsWith("data:");
  return {
    filePath: filePathIsDataUrl ? null : att.filePath ?? null,
    fileData: att.fileData ?? (filePathIsDataUrl ? att.filePath ?? null : null),
    fileName: att.fileName ?? null,
    fileType: att.fileType ?? null,
  };
}

/**
 * Convert an incoming attachment value (base64 data URL or an already-stored
 * relative disk path) into the persisted {filePath, fileData} pair. New base64
 * uploads are written to disk via the shared service so only the relative path
 * is stored; base64 is never persisted to the database.
 */
async function persistIncoming(
  moduleName: string,
  fileName: string,
  rawValue: string,
  fileType?: string | null,
): Promise<{ filePath: string; fileData: null }> {
  const decoded = decodeStoredFile(rawValue, fileType);
  if (decoded) {
    const filePath = await fileStorageService.writeAttachment(
      moduleName,
      fileName,
      decoded.buffer,
    );
    return { filePath, fileData: null };
  }
  // Not base64 — assume the client supplied an already-stored relative path.
  return { filePath: rawValue, fileData: null };
}

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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const briefing = await crewBriefingService.createBriefing(
        crewUuid,
        { ...validatedData, auditUserUuid }
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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const briefing = await crewBriefingService.updateBriefing(
        briefingUuid,
        { ...validatedData, auditUserUuid }
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
      const rawValue = filePath || fileUrl || "";
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!fileName || !rawValue) {
        return res
          .status(400)
          .json({ error: "fileName and filePath/fileUrl are required" });
      }

      const stored = await persistIncoming(
        "crew-pool/crew-briefing",
        fileName,
        rawValue,
        resolvedFileType,
      );

      const attachment = await crewBriefingService.addBriefingAttachment(
        briefingUuid,
        {
          fileName,
          filePath: stored.filePath,
          fileData: stored.fileData,
          fileType: resolvedFileType,
          fileSize: fileSize || "0",
        }
      );
      res.status(201).json(attachment);
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
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

  async serveBriefingAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const attachment = await crewBriefingService.getBriefingAttachmentFile(
        attUuid
      );
      await serveAttachmentFromFilePath(res, normalizeForServe(attachment));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      return res.status(500).json({ error: "Failed to load attachment" });
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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const debriefing = await crewBriefingService.createDebriefing(
        crewUuid,
        { ...validatedData, auditUserUuid }
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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const debriefing = await crewBriefingService.updateDebriefing(
        debriefingUuid,
        { ...validatedData, auditUserUuid }
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
      const rawValue = filePath || fileUrl || "";
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!fileName || !rawValue) {
        return res
          .status(400)
          .json({ error: "fileName and filePath/fileUrl are required" });
      }

      const stored = await persistIncoming(
        "crew-pool/crew-debriefing",
        fileName,
        rawValue,
        resolvedFileType,
      );

      const attachment = await crewBriefingService.addDebriefingAttachment(
        debriefingUuid,
        {
          fileName,
          filePath: stored.filePath,
          fileData: stored.fileData,
          fileType: resolvedFileType,
          fileSize: fileSize || "0",
        }
      );
      res.status(201).json(attachment);
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
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

  async serveDebriefingAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const attachment = await crewBriefingService.getDebriefingAttachmentFile(
        attUuid
      );
      await serveAttachmentFromFilePath(res, normalizeForServe(attachment));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      return res.status(500).json({ error: "Failed to load attachment" });
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
