import { Request, Response } from "express";
import { crewEducationService } from "../services";
import { insertCrewEducationSchema } from "@shared/v2/crew-pool/types";
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
import { crewEducation } from "@shared/v2/crew-pool/schema";

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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const education = await crewEducationService.create(
        crewUuid,
        { ...validatedData, auditUserUuid }
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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const education = await crewEducationService.update(
        eduUuid,
        { ...validatedData, auditUserUuid }
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
      const rawValue = filePath || fileUrl || "";
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!fileName || !rawValue) {
        return res
          .status(400)
          .json({ error: "fileName and filePath/fileUrl are required" });
      }

      const crewFolder = await resolveCrewFolderByEntity(
        crewEducation,
        crewEducation.eduUuid,
        eduUuid,
      );
      const stored = await persistIncoming(
        `crewpool/education/${crewFolder}`,
        fileName,
        rawValue,
        resolvedFileType,
      );

      const attachment = await crewEducationService.addAttachment(eduUuid, {
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
      await crewEducationService.removeAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const attachment = await crewEducationService.getAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(attachment));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      return res.status(500).json({ error: "Failed to load attachment" });
    }
  },
};
