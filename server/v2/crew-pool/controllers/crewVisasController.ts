import { Request, Response } from "express";
import { crewVisasService } from "../services";
import { insertCrewVisaSchema } from "@shared/v2/crew-pool/types";
import { z } from "zod";
import {
  fileStorageService,
  AttachmentValidationError,
} from "../../shared/fileStorageService.js";
import {
  serveAttachmentFromFilePath,
  decodeStoredFile,
} from "../../shared/serveAttachmentHelper.js";

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
  return { filePath: rawValue, fileData: null };
}

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
      const rawValue = filePath || fileUrl || "";
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!fileName || !rawValue) {
        return res
          .status(400)
          .json({ error: "fileName and filePath/fileUrl are required" });
      }

      const stored = await persistIncoming(
        "crew-pool/crew-visas",
        fileName,
        rawValue,
        resolvedFileType,
      );

      const attachment = await crewVisasService.addAttachment(visaUuid, {
        fileName,
        filePath: stored.filePath,
        fileData: stored.fileData,
        fileType: resolvedFileType,
        fileSize: fileSize || "0",
      });
      res.status(201).json(attachment);
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
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

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const attachment = await crewVisasService.getAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(attachment));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      return res.status(500).json({ error: "Failed to load attachment" });
    }
  },
};
