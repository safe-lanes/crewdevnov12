import { Request, Response } from "express";
import { AttachmentsRepository } from "../repositories";
import { v4 as uuidv4 } from "uuid";
import {
  fileStorageService,
  AttachmentValidationError,
} from "../../shared/fileStorageService.js";
import {
  serveAttachmentFromFilePath,
  decodeStoredFile,
} from "../../shared/serveAttachmentHelper.js";
import { resolveVesselFolderByEntity } from "../../shared/attachmentScope.js";
import { daTestRecordsV2 } from "../../../../shared/v2/drugs-alcohol/schema";

const attachmentsRepository = new AttachmentsRepository();

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

/**
 * Delete the on-disk file backing an attachment, if any. Legacy rows may carry
 * a base64 data URL in file_path (no disk file) — those are skipped.
 */
async function deleteAttachmentFile(filePath?: string | null): Promise<void> {
  if (!filePath || filePath.startsWith("data:")) return;
  await fileStorageService.deleteAttachment(filePath);
}

export const attachmentsController = {
  async getByTestRecord(req: Request, res: Response) {
    try {
      const { testRecordUuid } = req.params;
      if (!testRecordUuid) {
        return res.status(400).json({ error: "testRecordUuid is required" });
      }

      const attachments = await attachmentsRepository.findByTestRecordUuid(testRecordUuid);

      const result = attachments.map((a) => ({
        id: a.attUuid,
        attUuid: a.attUuid,
        name: a.fileName || "",
        type: a.fileType || "",
        size: a.fileSize ? parseInt(a.fileSize, 10) : 0,
        data: a.fileData || "",
        filePath: a.filePath || "",
        viewUrl: `/api/v2/drugs-alcohol/attachments/${a.attUuid}/raw`,
        uploadedAt: a.uploadDate || a.createdAt?.toISOString() || "",
        testRecordUuid: a.testRecordUuid,
      }));

      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.json(result);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { testRecordUuid } = req.params;
      if (!testRecordUuid) {
        return res.status(400).json({ error: "testRecordUuid is required" });
      }

      const { name, type, size, data, uploadedAt } = req.body;

      if (!name || !data) {
        return res.status(400).json({ error: "name and data are required" });
      }

      const auditUserUuid = req.body.auditUserUuid || null;

      // Write new base64 uploads to disk; only the relative path is persisted.
      const vesselFolder = await resolveVesselFolderByEntity(
        daTestRecordsV2,
        daTestRecordsV2.daUuid,
        daTestRecordsV2.vesselId,
        testRecordUuid,
      );
      const stored = await persistIncoming(
        `${vesselFolder}/drugs-alcohol`,
        name,
        data,
        type || null,
      );

      const attachment = await attachmentsRepository.create({
        testRecordUuid,
        fileName: name,
        fileType: type || null,
        fileSize: size?.toString() || null,
        fileData: stored.fileData,
        uploadDate: uploadedAt || new Date().toISOString(),
        uploadedBy: auditUserUuid,
        filePath: stored.filePath,
        sortOrder: 0,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      });

      res.status(201).json({
        id: attachment.attUuid,
        attUuid: attachment.attUuid,
        name: attachment.fileName || "",
        type: attachment.fileType || "",
        size: attachment.fileSize ? parseInt(attachment.fileSize, 10) : 0,
        data: attachment.fileData || "",
        filePath: attachment.filePath || "",
        viewUrl: `/api/v2/drugs-alcohol/attachments/${attachment.attUuid}/raw`,
        uploadedAt: attachment.uploadDate || attachment.createdAt?.toISOString() || "",
        testRecordUuid: attachment.testRecordUuid,
      });
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating attachment:", error);
      res.status(500).json({ error: "Failed to create attachment" });
    }
  },

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      if (!attUuid) {
        return res.status(400).json({ error: "attUuid is required" });
      }

      const attachment = await attachmentsRepository.findByUuid(attUuid);
      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      await serveAttachmentFromFilePath(res, normalizeForServe(attachment));
    } catch (error) {
      console.error("Error serving attachment:", error);
      return res.status(500).json({ error: "Failed to load attachment" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      if (!attUuid) {
        return res.status(400).json({ error: "attUuid is required" });
      }

      const existing = await attachmentsRepository.findByUuid(attUuid);
      if (!existing) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      await attachmentsRepository.softDeleteByUuid(attUuid);
      await deleteAttachmentFile(existing.filePath);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting attachment:", error);
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  },
};
