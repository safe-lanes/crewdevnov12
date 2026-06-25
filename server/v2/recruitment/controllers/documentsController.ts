import { Request, Response } from "express";
import { documentsService } from "../services";
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

export async function getDocuments(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const docs = await documentsService.getDocuments(recCanUuid);
    res.json(docs);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
}

export async function createDocument(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const doc = await documentsService.createDocument(recCanUuid, req.body);
    res.status(201).json(doc);
  } catch (error) {
    console.error("Error creating document:", error);
    res.status(500).json({ error: "Failed to create document" });
  }
}

export async function updateDocument(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const doc = await documentsService.updateDocument(id, req.body);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ error: "Failed to update document" });
  }
}

export async function deleteDocument(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const result = await documentsService.deleteDocument(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
}

export async function getDocumentAttachments(req: Request, res: Response) {
  try {
    const { docUuid } = req.params;
    const attachments = await documentsService.getDocumentAttachments(docUuid);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching attachments:", error);
    res.status(500).json({ error: "Failed to fetch attachments" });
  }
}

export async function createDocumentAttachment(req: Request, res: Response) {
  try {
    const { docUuid } = req.params;
    const data = await buildAttachmentData("recruitment-documents", req.body);
    const attachment = await documentsService.createDocumentAttachment(docUuid, data);
    res.status(201).json(attachment);
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error creating attachment:", error);
    res.status(500).json({ error: "Failed to create attachment" });
  }
}

export async function serveDocumentAttachment(req: Request, res: Response) {
  try {
    const { attUuid } = req.params;
    const record = await documentsService.getDocumentAttachmentFile(attUuid);
    await serveAttachmentFromFilePath(res, normalizeForServe(record));
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    console.error("Error serving document attachment:", error);
    res.status(500).json({ error: "Failed to serve attachment" });
  }
}

export async function getVisaAttachments(req: Request, res: Response) {
  try {
    const { visaUuid } = req.params;
    const attachments = await documentsService.getVisaAttachments(visaUuid);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching visa attachments:", error);
    res.status(500).json({ error: "Failed to fetch visa attachments" });
  }
}

export async function createVisaAttachment(req: Request, res: Response) {
  try {
    const { visaUuid } = req.params;
    const data = await buildAttachmentData("recruitment-visas", req.body);
    const attachment = await documentsService.createVisaAttachment(visaUuid, data);
    res.status(201).json(attachment);
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error creating visa attachment:", error);
    res.status(500).json({ error: "Failed to create visa attachment" });
  }
}

export async function serveVisaAttachment(req: Request, res: Response) {
  try {
    const { attUuid } = req.params;
    const record = await documentsService.getVisaAttachmentFile(attUuid);
    await serveAttachmentFromFilePath(res, normalizeForServe(record));
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    console.error("Error serving visa attachment:", error);
    res.status(500).json({ error: "Failed to serve attachment" });
  }
}

export async function getEducationAttachments(req: Request, res: Response) {
  try {
    const { eduUuid } = req.params;
    const attachments = await documentsService.getEducationAttachments(eduUuid);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching education attachments:", error);
    res.status(500).json({ error: "Failed to fetch education attachments" });
  }
}

export async function createEducationAttachment(req: Request, res: Response) {
  try {
    const { eduUuid } = req.params;
    const data = await buildAttachmentData("recruitment-education", req.body);
    const attachment = await documentsService.createEducationAttachment(eduUuid, data);
    res.status(201).json(attachment);
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error creating education attachment:", error);
    res.status(500).json({ error: "Failed to create education attachment" });
  }
}

export async function serveEducationAttachment(req: Request, res: Response) {
  try {
    const { attUuid } = req.params;
    const record = await documentsService.getEducationAttachmentFile(attUuid);
    await serveAttachmentFromFilePath(res, normalizeForServe(record));
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    console.error("Error serving education attachment:", error);
    res.status(500).json({ error: "Failed to serve attachment" });
  }
}

export async function getLicenseAttachments(req: Request, res: Response) {
  try {
    const { licUuid } = req.params;
    const attachments = await documentsService.getLicenseAttachments(licUuid);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching license attachments:", error);
    res.status(500).json({ error: "Failed to fetch license attachments" });
  }
}

export async function createLicenseAttachment(req: Request, res: Response) {
  try {
    const { licUuid } = req.params;
    const data = await buildAttachmentData("recruitment-licenses", req.body);
    const attachment = await documentsService.createLicenseAttachment(licUuid, data);
    res.status(201).json(attachment);
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error creating license attachment:", error);
    res.status(500).json({ error: "Failed to create license attachment" });
  }
}

export async function serveLicenseAttachment(req: Request, res: Response) {
  try {
    const { attUuid } = req.params;
    const record = await documentsService.getLicenseAttachmentFile(attUuid);
    await serveAttachmentFromFilePath(res, normalizeForServe(record));
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    console.error("Error serving license attachment:", error);
    res.status(500).json({ error: "Failed to serve attachment" });
  }
}

export async function getTrainingAttachments(req: Request, res: Response) {
  try {
    const { trainUuid } = req.params;
    const attachments = await documentsService.getTrainingAttachments(trainUuid);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching training attachments:", error);
    res.status(500).json({ error: "Failed to fetch training attachments" });
  }
}

export async function createTrainingAttachment(req: Request, res: Response) {
  try {
    const { trainUuid } = req.params;
    const data = await buildAttachmentData("recruitment-training", req.body);
    const attachment = await documentsService.createTrainingAttachment(trainUuid, data);
    res.status(201).json(attachment);
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error creating training attachment:", error);
    res.status(500).json({ error: "Failed to create training attachment" });
  }
}

export async function serveTrainingAttachment(req: Request, res: Response) {
  try {
    const { attUuid } = req.params;
    const record = await documentsService.getTrainingAttachmentFile(attUuid);
    await serveAttachmentFromFilePath(res, normalizeForServe(record));
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    console.error("Error serving training attachment:", error);
    res.status(500).json({ error: "Failed to serve attachment" });
  }
}

export async function getSeaServiceAttachments(req: Request, res: Response) {
  try {
    const { seaUuid } = req.params;
    const attachments = await documentsService.getSeaServiceAttachments(seaUuid);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching sea service attachments:", error);
    res.status(500).json({ error: "Failed to fetch sea service attachments" });
  }
}

export async function createSeaServiceAttachment(req: Request, res: Response) {
  try {
    const { seaUuid } = req.params;
    const data = await buildAttachmentData("recruitment-sea-service", req.body);
    const attachment = await documentsService.createSeaServiceAttachment(seaUuid, data);
    res.status(201).json(attachment);
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error creating sea service attachment:", error);
    res.status(500).json({ error: "Failed to create sea service attachment" });
  }
}

export async function serveSeaServiceAttachment(req: Request, res: Response) {
  try {
    const { attUuid } = req.params;
    const record = await documentsService.getSeaServiceAttachmentFile(attUuid);
    await serveAttachmentFromFilePath(res, normalizeForServe(record));
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    console.error("Error serving sea service attachment:", error);
    res.status(500).json({ error: "Failed to serve attachment" });
  }
}

export async function getAdditionalInfoAttachments(req: Request, res: Response) {
  try {
    const { infoUuid } = req.params;
    const attachments = await documentsService.getAdditionalInfoAttachments(infoUuid);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching additional info attachments:", error);
    res.status(500).json({ error: "Failed to fetch additional info attachments" });
  }
}

export async function createAdditionalInfoAttachment(req: Request, res: Response) {
  try {
    const { infoUuid } = req.params;
    const data = await buildAttachmentData("recruitment-additional-info", req.body);
    const attachment = await documentsService.createAdditionalInfoAttachment(infoUuid, data);
    res.status(201).json(attachment);
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error creating additional info attachment:", error);
    res.status(500).json({ error: "Failed to create additional info attachment" });
  }
}

export async function serveAdditionalInfoAttachment(req: Request, res: Response) {
  try {
    const { attUuid } = req.params;
    const record = await documentsService.getAdditionalInfoAttachmentFile(attUuid);
    await serveAttachmentFromFilePath(res, normalizeForServe(record));
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    console.error("Error serving additional info attachment:", error);
    res.status(500).json({ error: "Failed to serve attachment" });
  }
}

export async function getVisas(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const visas = await documentsService.getVisas(recCanUuid);
    res.json(visas);
  } catch (error) {
    console.error("Error fetching visas:", error);
    res.status(500).json({ error: "Failed to fetch visas" });
  }
}

export async function createVisa(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const visa = await documentsService.createVisa(recCanUuid, req.body);
    res.status(201).json(visa);
  } catch (error) {
    console.error("Error creating visa:", error);
    res.status(500).json({ error: "Failed to create visa" });
  }
}

export async function updateVisa(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const visa = await documentsService.updateVisa(id, req.body);
    if (!visa) return res.status(404).json({ error: "Not found" });
    res.json(visa);
  } catch (error) {
    console.error("Error updating visa:", error);
    res.status(500).json({ error: "Failed to update visa" });
  }
}

export async function deleteVisa(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const result = await documentsService.deleteVisa(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting visa:", error);
    res.status(500).json({ error: "Failed to delete visa" });
  }
}

export async function getEducation(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const education = await documentsService.getEducation(recCanUuid);
    res.json(education);
  } catch (error) {
    console.error("Error fetching education:", error);
    res.status(500).json({ error: "Failed to fetch education" });
  }
}

export async function createEducation(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const edu = await documentsService.createEducation(recCanUuid, req.body);
    res.status(201).json(edu);
  } catch (error) {
    console.error("Error creating education:", error);
    res.status(500).json({ error: "Failed to create education" });
  }
}

export async function updateEducation(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const edu = await documentsService.updateEducation(id, req.body);
    if (!edu) return res.status(404).json({ error: "Not found" });
    res.json(edu);
  } catch (error) {
    console.error("Error updating education:", error);
    res.status(500).json({ error: "Failed to update education" });
  }
}

export async function deleteEducation(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const result = await documentsService.deleteEducation(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting education:", error);
    res.status(500).json({ error: "Failed to delete education" });
  }
}

export async function getLicenses(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const licenses = await documentsService.getLicenses(recCanUuid);
    res.json(licenses);
  } catch (error) {
    console.error("Error fetching licenses:", error);
    res.status(500).json({ error: "Failed to fetch licenses" });
  }
}

export async function createLicense(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const license = await documentsService.createLicense(recCanUuid, req.body);
    res.status(201).json(license);
  } catch (error) {
    console.error("Error creating license:", error);
    res.status(500).json({ error: "Failed to create license" });
  }
}

export async function updateLicense(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const license = await documentsService.updateLicense(id, req.body);
    if (!license) return res.status(404).json({ error: "Not found" });
    res.json(license);
  } catch (error) {
    console.error("Error updating license:", error);
    res.status(500).json({ error: "Failed to update license" });
  }
}

export async function deleteLicense(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const result = await documentsService.deleteLicense(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting license:", error);
    res.status(500).json({ error: "Failed to delete license" });
  }
}

export async function getTrainingCourses(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const courses = await documentsService.getTrainingCourses(recCanUuid);
    res.json(courses);
  } catch (error) {
    console.error("Error fetching training courses:", error);
    res.status(500).json({ error: "Failed to fetch training courses" });
  }
}

export async function createTrainingCourse(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const course = await documentsService.createTrainingCourse(recCanUuid, req.body);
    res.status(201).json(course);
  } catch (error) {
    console.error("Error creating training course:", error);
    res.status(500).json({ error: "Failed to create training course" });
  }
}

export async function updateTrainingCourse(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const course = await documentsService.updateTrainingCourse(id, req.body);
    if (!course) return res.status(404).json({ error: "Not found" });
    res.json(course);
  } catch (error) {
    console.error("Error updating training course:", error);
    res.status(500).json({ error: "Failed to update training course" });
  }
}

export async function deleteTrainingCourse(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const result = await documentsService.deleteTrainingCourse(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting training course:", error);
    res.status(500).json({ error: "Failed to delete training course" });
  }
}

export async function getSeaService(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const seaService = await documentsService.getSeaService(recCanUuid);
    res.json(seaService);
  } catch (error) {
    console.error("Error fetching sea service:", error);
    res.status(500).json({ error: "Failed to fetch sea service" });
  }
}

export async function createSeaService(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const ss = await documentsService.createSeaService(recCanUuid, req.body);
    res.status(201).json(ss);
  } catch (error) {
    console.error("Error creating sea service:", error);
    res.status(500).json({ error: "Failed to create sea service" });
  }
}

export async function updateSeaService(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const ss = await documentsService.updateSeaService(id, req.body);
    if (!ss) return res.status(404).json({ error: "Not found" });
    res.json(ss);
  } catch (error) {
    console.error("Error updating sea service:", error);
    res.status(500).json({ error: "Failed to update sea service" });
  }
}

export async function deleteSeaService(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const result = await documentsService.deleteSeaService(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting sea service:", error);
    res.status(500).json({ error: "Failed to delete sea service" });
  }
}

export async function getAdditionalInfo(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const info = await documentsService.getAdditionalInfo(recCanUuid);
    res.json(info);
  } catch (error) {
    console.error("Error fetching additional info:", error);
    res.status(500).json({ error: "Failed to fetch additional info" });
  }
}

export async function createAdditionalInfo(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const info = await documentsService.createAdditionalInfo(recCanUuid, req.body);
    res.status(201).json(info);
  } catch (error) {
    console.error("Error creating additional info:", error);
    res.status(500).json({ error: "Failed to create additional info" });
  }
}

export async function updateAdditionalInfo(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const info = await documentsService.updateAdditionalInfo(id, req.body);
    if (!info) return res.status(404).json({ error: "Not found" });
    res.json(info);
  } catch (error) {
    console.error("Error updating additional info:", error);
    res.status(500).json({ error: "Failed to update additional info" });
  }
}

export async function deleteAdditionalInfo(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const result = await documentsService.deleteAdditionalInfo(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting additional info:", error);
    res.status(500).json({ error: "Failed to delete additional info" });
  }
}

export async function deleteDocumentAttachment(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
    const result = await documentsService.deleteDocumentAttachment(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting document attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
}

export async function deleteVisaAttachment(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
    const result = await documentsService.deleteVisaAttachment(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting visa attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
}

export async function deleteEducationAttachment(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
    const result = await documentsService.deleteEducationAttachment(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting education attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
}

export async function deleteLicenseAttachment(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
    const result = await documentsService.deleteLicenseAttachment(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting license attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
}

export async function deleteTrainingAttachment(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
    const result = await documentsService.deleteTrainingAttachment(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting training attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
}

export async function deleteSeaServiceAttachment(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
    const result = await documentsService.deleteSeaServiceAttachment(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting sea service attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
}

export async function deleteAdditionalInfoAttachment(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid attachment ID" });
    const result = await documentsService.deleteAdditionalInfoAttachment(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting additional info attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
}
