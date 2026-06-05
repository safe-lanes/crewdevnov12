import { Request, Response } from "express";
import { crewBriefingService } from "../services";
import {
  insertCrewBriefingSchema,
  insertCrewDebriefingSchema,
} from "@shared/v2/crew-pool/types";
import { z } from "zod";

/**
 * Decode a stored attachment value into raw bytes + mime type.
 * Stored content is typically a base64 data URL ("data:<mime>;base64,<payload>").
 * Returns null when the value is empty or not a usable data URL.
 */
function decodeStoredFile(
  stored: string | null | undefined,
  fallbackType?: string | null
): { buffer: Buffer; mime: string } | null {
  if (!stored) return null;

  if (stored.startsWith("data:")) {
    const match = stored.match(/^data:([^;,]*)(;base64)?,([\s\S]*)$/);
    if (!match) return null;
    const mime = match[1] || fallbackType || "application/octet-stream";
    const isBase64 = !!match[2];
    const payload = match[3];
    const buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf-8");
    return { buffer, mime };
  }

  return null;
}

// MIME types that are safe to render inline in the browser. Anything else
// (e.g. text/html, image/svg+xml) is forced to download to prevent a stored
// data URL from executing as same-origin script.
const INLINE_RENDERABLE_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

function serveAttachment(
  res: Response,
  attachment: {
    fileName?: string | null;
    fileType?: string | null;
    filePath?: string | null;
    fileData?: string | null;
  }
) {
  const stored = attachment.filePath || attachment.fileData;
  const decoded = decodeStoredFile(stored, attachment.fileType);

  if (!decoded) {
    return res.status(404).json({ error: "File content not available" });
  }

  const fileName = attachment.fileName || "file";
  const safeName = fileName.replace(/[\r\n"]/g, "_");
  const mime = decoded.mime.toLowerCase().trim();
  const canRenderInline = INLINE_RENDERABLE_MIMES.has(mime);

  // Never reflect an arbitrary/unsafe MIME inline. Unknown types are served as
  // a generic binary download so they cannot run in the same origin.
  res.setHeader(
    "Content-Type",
    canRenderInline ? mime : "application/octet-stream"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Length", decoded.buffer.length);
  res.setHeader(
    "Content-Disposition",
    `${canRenderInline ? "inline" : "attachment"}; filename="${safeName}"`
  );
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  return res.send(decoded.buffer);
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

  async serveBriefingAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const attachment = await crewBriefingService.getBriefingAttachmentFile(
        attUuid
      );
      return serveAttachment(res, attachment);
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

  async serveDebriefingAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const attachment = await crewBriefingService.getDebriefingAttachmentFile(
        attUuid
      );
      return serveAttachment(res, attachment);
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
