import { Request, Response } from "express";
import { crewSeaServiceService } from "../services";
import { insertCrewSeaServiceSchema } from "@shared/v2/crew-pool/types";
import { z } from "zod";
import {
  fileStorageService,
  AttachmentValidationError,
} from "../../shared/fileStorageService.js";
import {
  serveAttachmentFromFilePath,
  decodeStoredFile,
} from "../../shared/serveAttachmentHelper.js";
import { resolveCrewFolderByEntity } from "../../shared/attachmentScope.js";
import { crewSeaService } from "@shared/v2/crew-pool/schema";

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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const seaService = await crewSeaServiceService.create(
        crewUuid,
        { ...validatedData, auditUserUuid }
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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const seaService = await crewSeaServiceService.update(
        seaUuid,
        { ...validatedData, auditUserUuid }
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
      const { fileName, filePath, fileUrl, fileType, mimeType, fileSize } = req.body;
      const rawValue = filePath || fileUrl || "";
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!fileName || !rawValue) {
        return res
          .status(400)
          .json({ error: "fileName and filePath/fileUrl are required" });
      }

      const crewFolder = await resolveCrewFolderByEntity(
        crewSeaService,
        crewSeaService.seaUuid,
        seaUuid,
      );
      const stored = await persistIncoming(
        `crew-pool/sea-service/${crewFolder}`,
        fileName,
        rawValue,
        resolvedFileType,
      );

      const attachment = await crewSeaServiceService.addAttachment(seaUuid, {
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
      await crewSeaServiceService.removeAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const attachment = await crewSeaServiceService.getAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(attachment));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      return res.status(500).json({ error: "Failed to load attachment" });
    }
  },
};
