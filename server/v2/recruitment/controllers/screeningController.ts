import { Request, Response } from "express";
import {
  screeningB1Service,
  screeningB2Service,
  screeningB3Service,
  screeningB4Service,
  screeningB5Service,
  screeningB6Service,
  screeningB7Service,
  screeningB8Service,
} from "../services/screeningService";
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

/**
 * Build the attachment insert payload from the request body, writing any new
 * base64 upload to disk. Falls back to passing the body unchanged when no file
 * value is present.
 */
async function buildAttachmentData(moduleName: string, body: any) {
  const rawValue = body?.fileData ?? body?.fileUrl ?? body?.filePath ?? body?.data ?? "";
  if (!rawValue) return body;
  const fileName = body?.fileName || body?.name || "attachment";
  const persisted = await persistIncoming(moduleName, fileName, String(rawValue), body?.fileType);
  return { ...body, filePath: persisted.filePath, fileData: persisted.fileData };
}

export const screeningB1Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB1Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B1:", error);
      res.status(500).json({ error: "Failed to get B1 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB1Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B1:", error);
      res.status(500).json({ error: "Failed to upsert B1 screening" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b1Uuid } = req.params;
      const result = await screeningB1Service.getComments(b1Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B1 comments:", error);
      res.status(500).json({ error: "Failed to get B1 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b1Uuid } = req.params;
      const result = await screeningB1Service.createComment(b1Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B1 comment:", error);
      res.status(500).json({ error: "Failed to create B1 comment" });
    }
  },

  async updateComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB1Service.updateComment(commentUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B1 comment:", error);
      res.status(500).json({ error: "Failed to update B1 comment" });
    }
  },

  async deleteComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB1Service.deleteComment(commentUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B1 comment:", error);
      res.status(500).json({ error: "Failed to delete B1 comment" });
    }
  },

  async getAttachments(req: Request, res: Response) {
    try {
      const { b1Uuid } = req.params;
      const result = await screeningB1Service.getAttachments(b1Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B1 attachments:", error);
      res.status(500).json({ error: "Failed to get B1 attachments" });
    }
  },

  async createAttachment(req: Request, res: Response) {
    try {
      const { b1Uuid } = req.params;
      const data = await buildAttachmentData("screening-b1", req.body);
      const result = await screeningB1Service.createAttachment(b1Uuid, data);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating B1 attachment:", error);
      res.status(500).json({ error: "Failed to create B1 attachment" });
    }
  },

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const record = await screeningB1Service.getAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(record));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      console.error("Error serving B1 attachment:", error);
      res.status(500).json({ error: "Failed to serve attachment" });
    }
  },

  async deleteAttachment(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
      const result = await screeningB1Service.deleteAttachment(id);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B1 attachment:", error);
      res.status(500).json({ error: "Failed to delete B1 attachment" });
    }
  },
};

export const screeningB2Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB2Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B2:", error);
      res.status(500).json({ error: "Failed to get B2 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB2Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B2:", error);
      res.status(500).json({ error: "Failed to upsert B2 screening" });
    }
  },

  async getItems(req: Request, res: Response) {
    try {
      const { b2Uuid } = req.params;
      const result = await screeningB2Service.getItems(b2Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B2 items:", error);
      res.status(500).json({ error: "Failed to get B2 items" });
    }
  },

  async createItem(req: Request, res: Response) {
    try {
      const { b2Uuid } = req.params;
      const result = await screeningB2Service.createItem(b2Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B2 item:", error);
      res.status(500).json({ error: "Failed to create B2 item" });
    }
  },

  async updateItem(req: Request, res: Response) {
    try {
      const { refUuid } = req.params;
      const result = await screeningB2Service.updateItem(refUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B2 item:", error);
      res.status(500).json({ error: "Failed to update B2 item" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b2Uuid } = req.params;
      const result = await screeningB2Service.getComments(b2Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B2 comments:", error);
      res.status(500).json({ error: "Failed to get B2 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b2Uuid } = req.params;
      const result = await screeningB2Service.createComment(b2Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B2 comment:", error);
      res.status(500).json({ error: "Failed to create B2 comment" });
    }
  },

  async updateComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB2Service.updateComment(commentUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B2 comment:", error);
      res.status(500).json({ error: "Failed to update B2 comment" });
    }
  },

  async deleteComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB2Service.deleteComment(commentUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B2 comment:", error);
      res.status(500).json({ error: "Failed to delete B2 comment" });
    }
  },

  async getAttachments(req: Request, res: Response) {
    try {
      const { b2Uuid } = req.params;
      const result = await screeningB2Service.getAttachments(b2Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B2 attachments:", error);
      res.status(500).json({ error: "Failed to get B2 attachments" });
    }
  },

  async createAttachment(req: Request, res: Response) {
    try {
      const { b2Uuid } = req.params;
      const data = await buildAttachmentData("screening-b2", req.body);
      const result = await screeningB2Service.createAttachment(b2Uuid, data);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating B2 attachment:", error);
      res.status(500).json({ error: "Failed to create B2 attachment" });
    }
  },

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const record = await screeningB2Service.getAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(record));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      console.error("Error serving B2 attachment:", error);
      res.status(500).json({ error: "Failed to serve attachment" });
    }
  },

  async deleteAttachment(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
      const result = await screeningB2Service.deleteAttachment(id);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B2 attachment:", error);
      res.status(500).json({ error: "Failed to delete B2 attachment" });
    }
  },

  async deleteItem(req: Request, res: Response) {
    try {
      const { refUuid } = req.params;
      const result = await screeningB2Service.deleteItem(refUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B2 item:", error);
      res.status(500).json({ error: "Failed to delete B2 item" });
    }
  },
};

export const screeningB3Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB3Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B3:", error);
      res.status(500).json({ error: "Failed to get B3 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB3Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B3:", error);
      res.status(500).json({ error: "Failed to upsert B3 screening" });
    }
  },

  async getAuthorities(req: Request, res: Response) {
    try {
      const { b3Uuid } = req.params;
      const result = await screeningB3Service.getAuthorities(b3Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B3 authorities:", error);
      res.status(500).json({ error: "Failed to get B3 authorities" });
    }
  },

  async createAuthority(req: Request, res: Response) {
    try {
      const { b3Uuid } = req.params;
      const result = await screeningB3Service.createAuthority(b3Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B3 authority:", error);
      res.status(500).json({ error: "Failed to create B3 authority" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b3Uuid } = req.params;
      const result = await screeningB3Service.getComments(b3Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B3 comments:", error);
      res.status(500).json({ error: "Failed to get B3 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b3Uuid } = req.params;
      const result = await screeningB3Service.createComment(b3Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B3 comment:", error);
      res.status(500).json({ error: "Failed to create B3 comment" });
    }
  },

  async updateComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB3Service.updateComment(commentUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B3 comment:", error);
      res.status(500).json({ error: "Failed to update B3 comment" });
    }
  },

  async deleteComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB3Service.deleteComment(commentUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B3 comment:", error);
      res.status(500).json({ error: "Failed to delete B3 comment" });
    }
  },

  async updateAuthority(req: Request, res: Response) {
    try {
      const { authUuid } = req.params;
      const result = await screeningB3Service.updateAuthority(authUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B3 authority:", error);
      res.status(500).json({ error: "Failed to update B3 authority" });
    }
  },

  async getAttachments(req: Request, res: Response) {
    try {
      const { b3Uuid } = req.params;
      const result = await screeningB3Service.getAttachments(b3Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B3 attachments:", error);
      res.status(500).json({ error: "Failed to get B3 attachments" });
    }
  },

  async createAttachment(req: Request, res: Response) {
    try {
      const { b3Uuid } = req.params;
      const data = await buildAttachmentData("screening-b3", req.body);
      const result = await screeningB3Service.createAttachment(b3Uuid, data);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating B3 attachment:", error);
      res.status(500).json({ error: "Failed to create B3 attachment" });
    }
  },

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const record = await screeningB3Service.getAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(record));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      console.error("Error serving B3 attachment:", error);
      res.status(500).json({ error: "Failed to serve attachment" });
    }
  },

  async deleteAttachment(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
      const result = await screeningB3Service.deleteAttachment(id);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B3 attachment:", error);
      res.status(500).json({ error: "Failed to delete B3 attachment" });
    }
  },

  async deleteAuthority(req: Request, res: Response) {
    try {
      const { authUuid } = req.params;
      const result = await screeningB3Service.deleteAuthority(authUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B3 authority:", error);
      res.status(500).json({ error: "Failed to delete B3 authority" });
    }
  },
};

export const screeningB4Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB4Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B4:", error);
      res.status(500).json({ error: "Failed to get B4 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB4Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B4:", error);
      res.status(500).json({ error: "Failed to upsert B4 screening" });
    }
  },

  async getCertItems(req: Request, res: Response) {
    try {
      const { b4Uuid } = req.params;
      const result = await screeningB4Service.getCertItems(b4Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B4 cert items:", error);
      res.status(500).json({ error: "Failed to get B4 cert items" });
    }
  },

  async createCertItem(req: Request, res: Response) {
    try {
      const { b4Uuid } = req.params;
      const result = await screeningB4Service.createCertItem(b4Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B4 cert item:", error);
      res.status(500).json({ error: "Failed to create B4 cert item" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b4Uuid } = req.params;
      const result = await screeningB4Service.getComments(b4Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B4 comments:", error);
      res.status(500).json({ error: "Failed to get B4 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b4Uuid } = req.params;
      const result = await screeningB4Service.createComment(b4Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B4 comment:", error);
      res.status(500).json({ error: "Failed to create B4 comment" });
    }
  },

  async updateComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB4Service.updateComment(commentUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B4 comment:", error);
      res.status(500).json({ error: "Failed to update B4 comment" });
    }
  },

  async deleteComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB4Service.deleteComment(commentUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B4 comment:", error);
      res.status(500).json({ error: "Failed to delete B4 comment" });
    }
  },

  async updateCertItem(req: Request, res: Response) {
    try {
      const { certUuid } = req.params;
      const result = await screeningB4Service.updateCertItem(certUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B4 cert item:", error);
      res.status(500).json({ error: "Failed to update B4 cert item" });
    }
  },

  async getAttachments(req: Request, res: Response) {
    try {
      const { b4Uuid } = req.params;
      const result = await screeningB4Service.getAttachments(b4Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B4 attachments:", error);
      res.status(500).json({ error: "Failed to get B4 attachments" });
    }
  },

  async createAttachment(req: Request, res: Response) {
    try {
      const { b4Uuid } = req.params;
      const data = await buildAttachmentData("screening-b4", req.body);
      const result = await screeningB4Service.createAttachment(b4Uuid, data);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating B4 attachment:", error);
      res.status(500).json({ error: "Failed to create B4 attachment" });
    }
  },

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const record = await screeningB4Service.getAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(record));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      console.error("Error serving B4 attachment:", error);
      res.status(500).json({ error: "Failed to serve attachment" });
    }
  },

  async deleteAttachment(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
      const result = await screeningB4Service.deleteAttachment(id);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B4 attachment:", error);
      res.status(500).json({ error: "Failed to delete B4 attachment" });
    }
  },

  async deleteCertItem(req: Request, res: Response) {
    try {
      const { certUuid } = req.params;
      const result = await screeningB4Service.deleteCertItem(certUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B4 cert item:", error);
      res.status(500).json({ error: "Failed to delete B4 cert item" });
    }
  },
};

export const screeningB5Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB5Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B5:", error);
      res.status(500).json({ error: "Failed to get B5 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB5Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B5:", error);
      res.status(500).json({ error: "Failed to upsert B5 screening" });
    }
  },

  async getTestItems(req: Request, res: Response) {
    try {
      const { b5Uuid } = req.params;
      const result = await screeningB5Service.getTestItems(b5Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B5 test items:", error);
      res.status(500).json({ error: "Failed to get B5 test items" });
    }
  },

  async createTestItem(req: Request, res: Response) {
    try {
      const { b5Uuid } = req.params;
      const result = await screeningB5Service.createTestItem(b5Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B5 test item:", error);
      res.status(500).json({ error: "Failed to create B5 test item" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b5Uuid } = req.params;
      const result = await screeningB5Service.getComments(b5Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B5 comments:", error);
      res.status(500).json({ error: "Failed to get B5 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b5Uuid } = req.params;
      const result = await screeningB5Service.createComment(b5Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B5 comment:", error);
      res.status(500).json({ error: "Failed to create B5 comment" });
    }
  },

  async updateComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB5Service.updateComment(commentUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B5 comment:", error);
      res.status(500).json({ error: "Failed to update B5 comment" });
    }
  },

  async deleteComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB5Service.deleteComment(commentUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B5 comment:", error);
      res.status(500).json({ error: "Failed to delete B5 comment" });
    }
  },

  async updateTestItem(req: Request, res: Response) {
    try {
      const { testUuid } = req.params;
      const result = await screeningB5Service.updateTestItem(testUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B5 test item:", error);
      res.status(500).json({ error: "Failed to update B5 test item" });
    }
  },

  async getAttachments(req: Request, res: Response) {
    try {
      const { b5Uuid } = req.params;
      const result = await screeningB5Service.getAttachments(b5Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B5 attachments:", error);
      res.status(500).json({ error: "Failed to get B5 attachments" });
    }
  },

  async createAttachment(req: Request, res: Response) {
    try {
      const { b5Uuid } = req.params;
      const data = await buildAttachmentData("screening-b5", req.body);
      const result = await screeningB5Service.createAttachment(b5Uuid, data);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating B5 attachment:", error);
      res.status(500).json({ error: "Failed to create B5 attachment" });
    }
  },

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const record = await screeningB5Service.getAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(record));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      console.error("Error serving B5 attachment:", error);
      res.status(500).json({ error: "Failed to serve attachment" });
    }
  },

  async deleteAttachment(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
      const result = await screeningB5Service.deleteAttachment(id);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B5 attachment:", error);
      res.status(500).json({ error: "Failed to delete B5 attachment" });
    }
  },

  async deleteTestItem(req: Request, res: Response) {
    try {
      const { testUuid } = req.params;
      const result = await screeningB5Service.deleteTestItem(testUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B5 test item:", error);
      res.status(500).json({ error: "Failed to delete B5 test item" });
    }
  },
};

export const screeningB6Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB6Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B6:", error);
      res.status(500).json({ error: "Failed to get B6 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB6Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B6:", error);
      res.status(500).json({ error: "Failed to upsert B6 screening" });
    }
  },

  async getInterviewItems(req: Request, res: Response) {
    try {
      const { b6Uuid } = req.params;
      const result = await screeningB6Service.getInterviewItems(b6Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B6 interview items:", error);
      res.status(500).json({ error: "Failed to get B6 interview items" });
    }
  },

  async createInterviewItem(req: Request, res: Response) {
    try {
      const { b6Uuid } = req.params;
      const result = await screeningB6Service.createInterviewItem(b6Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B6 interview item:", error);
      res.status(500).json({ error: "Failed to create B6 interview item" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b6Uuid } = req.params;
      const result = await screeningB6Service.getComments(b6Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B6 comments:", error);
      res.status(500).json({ error: "Failed to get B6 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b6Uuid } = req.params;
      const result = await screeningB6Service.createComment(b6Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B6 comment:", error);
      res.status(500).json({ error: "Failed to create B6 comment" });
    }
  },

  async updateComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB6Service.updateComment(commentUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B6 comment:", error);
      res.status(500).json({ error: "Failed to update B6 comment" });
    }
  },

  async deleteComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB6Service.deleteComment(commentUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B6 comment:", error);
      res.status(500).json({ error: "Failed to delete B6 comment" });
    }
  },

  async updateInterviewItem(req: Request, res: Response) {
    try {
      const { intUuid } = req.params;
      const result = await screeningB6Service.updateInterviewItem(intUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B6 interview item:", error);
      res.status(500).json({ error: "Failed to update B6 interview item" });
    }
  },

  async getAttachments(req: Request, res: Response) {
    try {
      const { b6Uuid } = req.params;
      const result = await screeningB6Service.getAttachments(b6Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B6 attachments:", error);
      res.status(500).json({ error: "Failed to get B6 attachments" });
    }
  },

  async createAttachment(req: Request, res: Response) {
    try {
      const { b6Uuid } = req.params;
      const data = await buildAttachmentData("screening-b6", req.body);
      const result = await screeningB6Service.createAttachment(b6Uuid, data);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating B6 attachment:", error);
      res.status(500).json({ error: "Failed to create B6 attachment" });
    }
  },

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const record = await screeningB6Service.getAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(record));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      console.error("Error serving B6 attachment:", error);
      res.status(500).json({ error: "Failed to serve attachment" });
    }
  },

  async deleteAttachment(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
      const result = await screeningB6Service.deleteAttachment(id);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B6 attachment:", error);
      res.status(500).json({ error: "Failed to delete B6 attachment" });
    }
  },

  async deleteInterviewItem(req: Request, res: Response) {
    try {
      const { intUuid } = req.params;
      const result = await screeningB6Service.deleteInterviewItem(intUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B6 interview item:", error);
      res.status(500).json({ error: "Failed to delete B6 interview item" });
    }
  },
};

export const screeningB7Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB7Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B7:", error);
      res.status(500).json({ error: "Failed to get B7 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB7Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B7:", error);
      res.status(500).json({ error: "Failed to upsert B7 screening" });
    }
  },

  async getTrainingItems(req: Request, res: Response) {
    try {
      const { b7Uuid } = req.params;
      const result = await screeningB7Service.getTrainingItems(b7Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B7 training items:", error);
      res.status(500).json({ error: "Failed to get B7 training items" });
    }
  },

  async createTrainingItem(req: Request, res: Response) {
    try {
      const { b7Uuid } = req.params;
      const result = await screeningB7Service.createTrainingItem(b7Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B7 training item:", error);
      res.status(500).json({ error: "Failed to create B7 training item" });
    }
  },

  async updateTrainingItem(req: Request, res: Response) {
    try {
      const { trainItemUuid } = req.params;
      const result = await screeningB7Service.updateTrainingItem(trainItemUuid, req.body);
      if (!result) {
        return res.status(404).json({ error: "B7 training item not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error updating B7 training item:", error);
      res.status(500).json({ error: "Failed to update B7 training item" });
    }
  },

  async deleteTrainingItem(req: Request, res: Response) {
    try {
      const { trainItemUuid } = req.params;
      const result = await screeningB7Service.deleteTrainingItem(trainItemUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B7 training item:", error);
      res.status(500).json({ error: "Failed to delete B7 training item" });
    }
  },
};

export const screeningB8Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB8Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B8:", error);
      res.status(500).json({ error: "Failed to get B8 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB8Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B8:", error);
      res.status(500).json({ error: "Failed to upsert B8 screening" });
    }
  },

  async getApprovers(req: Request, res: Response) {
    try {
      const { b8Uuid } = req.params;
      const result = await screeningB8Service.getApprovers(b8Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B8 approvers:", error);
      res.status(500).json({ error: "Failed to get B8 approvers" });
    }
  },

  async createApprover(req: Request, res: Response) {
    try {
      const { b8Uuid } = req.params;
      const result = await screeningB8Service.createApprover(b8Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B8 approver:", error);
      res.status(500).json({ error: "Failed to create B8 approver" });
    }
  },

  // Get approver details by joining with master_users using userUuids array
  async getApproverDetails(req: Request, res: Response) {
    try {
      const { userUuids } = req.body;
      if (!userUuids || !Array.isArray(userUuids)) {
        return res.status(400).json({ error: "userUuids array is required" });
      }
      const result = await screeningB8Service.getApproverDetails(userUuids);
      res.json(result);
    } catch (error) {
      console.error("Error getting approver details:", error);
      res.status(500).json({ error: "Failed to get approver details" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b8Uuid } = req.params;
      const result = await screeningB8Service.getComments(b8Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B8 comments:", error);
      res.status(500).json({ error: "Failed to get B8 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b8Uuid } = req.params;
      const result = await screeningB8Service.createComment(b8Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B8 comment:", error);
      res.status(500).json({ error: "Failed to create B8 comment" });
    }
  },

  async updateComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB8Service.updateComment(commentUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B8 comment:", error);
      res.status(500).json({ error: "Failed to update B8 comment" });
    }
  },

  async deleteComment(req: Request, res: Response) {
    try {
      const { commentUuid } = req.params;
      const result = await screeningB8Service.deleteComment(commentUuid);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B8 comment:", error);
      res.status(500).json({ error: "Failed to delete B8 comment" });
    }
  },

  async getAttachments(req: Request, res: Response) {
    try {
      const { b8Uuid } = req.params;
      const result = await screeningB8Service.getAttachments(b8Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B8 attachments:", error);
      res.status(500).json({ error: "Failed to get B8 attachments" });
    }
  },

  async createAttachment(req: Request, res: Response) {
    try {
      const { b8Uuid } = req.params;
      const data = await buildAttachmentData("screening-b8", req.body);
      const result = await screeningB8Service.createAttachment(b8Uuid, data);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating B8 attachment:", error);
      res.status(500).json({ error: "Failed to create B8 attachment" });
    }
  },

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const record = await screeningB8Service.getAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(record));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      console.error("Error serving B8 attachment:", error);
      res.status(500).json({ error: "Failed to serve attachment" });
    }
  },

  async deleteAttachment(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
      const result = await screeningB8Service.deleteAttachment(id);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting B8 attachment:", error);
      res.status(500).json({ error: "Failed to delete B8 attachment" });
    }
  },
};
