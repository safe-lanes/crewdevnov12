import { Request, Response } from "express";
import { crewCertificatesService } from "../services";
import { insertCrewLicenseSchema } from "@shared/v2/crew-pool/types";
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

export const crewLicensesController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const licenses = await crewCertificatesService.getLicenses(crewUuid);
      res.json(licenses);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch licenses" });
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
      res.json(result.expiringLicenses);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch expiring licenses" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewLicenseSchema
        .omit({ licUuid: true, crewUuid: true })
        .parse(req.body);
      const license = await crewCertificatesService.createLicense(
        crewUuid,
        validatedData
      );
      res.status(201).json(license);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create license" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { licUuid } = req.params;
      const validatedData = insertCrewLicenseSchema.partial().parse(req.body);
      const license = await crewCertificatesService.updateLicense(
        licUuid,
        validatedData
      );
      res.json(license);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update license" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { licUuid } = req.params;
      await crewCertificatesService.deleteLicense(licUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete license" });
    }
  },

  async addAttachment(req: Request, res: Response) {
    try {
      const { licUuid } = req.params;
      const { fileName, filePath, fileUrl, fileType, mimeType, fileSize } = req.body;
      const rawValue = filePath || fileUrl || "";
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!fileName || !rawValue) {
        return res
          .status(400)
          .json({ error: "fileName and filePath/fileUrl are required" });
      }

      const stored = await persistIncoming(
        "crew-licenses",
        fileName,
        rawValue,
        resolvedFileType,
      );

      const attachment = await crewCertificatesService.addLicenseAttachment(
        licUuid,
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

  async removeAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      await crewCertificatesService.removeLicenseAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const attachment =
        await crewCertificatesService.getLicenseAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(attachment));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      return res.status(500).json({ error: "Failed to load attachment" });
    }
  },

  async archive(req: Request, res: Response) {
    try {
      const { licUuid } = req.params;
      const success = await crewCertificatesService.archiveLicense(licUuid);
      if (success) {
        res.json({ message: "License archived successfully" });
      } else {
        res.status(404).json({ error: "License not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to archive license" });
    }
  },

  async unarchive(req: Request, res: Response) {
    try {
      const { licUuid } = req.params;
      const success = await crewCertificatesService.unarchiveLicense(licUuid);
      if (success) {
        res.json({ message: "License unarchived successfully" });
      } else {
        res.status(404).json({ error: "License not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to unarchive license" });
    }
  },
};
