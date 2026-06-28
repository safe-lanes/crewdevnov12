import { Request, Response } from "express";
import { crewDocumentsService } from "../services";
import { insertCrewDocumentSchema } from "@shared/v2/crew-pool/types";
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
      console.log('[V2 Documents] Creating document for crew:', crewUuid);
      console.log('[V2 Documents] Request body:', JSON.stringify(req.body, null, 2));
      const validatedData = insertCrewDocumentSchema
        .omit({ docUuid: true, crewUuid: true })
        .parse(req.body);
      console.log('[V2 Documents] Validated data:', JSON.stringify(validatedData, null, 2));
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const document = await crewDocumentsService.create(
        crewUuid,
        { ...validatedData, auditUserUuid }
      );
      console.log('[V2 Documents] Created document:', JSON.stringify(document, null, 2));
      res.status(201).json(document);
    } catch (error: any) {
      console.error('[V2 Documents] Create error:', error.message);
      if (error instanceof z.ZodError) {
        console.error('[V2 Documents] Validation errors:', JSON.stringify(error.errors, null, 2));
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create document", message: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { docUuid } = req.params;
      const validatedData = insertCrewDocumentSchema.partial().parse(req.body);
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const document = await crewDocumentsService.update(docUuid, {
        ...validatedData,
        auditUserUuid,
      });
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
      const { fileName, filePath, fileUrl, fileType, mimeType, fileSize } = req.body;
      const rawValue = filePath || fileUrl || "";
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!fileName || !rawValue) {
        return res
          .status(400)
          .json({ error: "fileName and filePath/fileUrl are required" });
      }

      const stored = await persistIncoming(
        "crew-pool/crew-documents",
        fileName,
        rawValue,
        resolvedFileType,
      );

      const attachment = await crewDocumentsService.addAttachment(docUuid, {
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
      await crewDocumentsService.removeAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const attachment = await crewDocumentsService.getAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(attachment));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      return res.status(500).json({ error: "Failed to load attachment" });
    }
  },
};
