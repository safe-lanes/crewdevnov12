import { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  crewBriefingService,
  crewCertificatesService,
  crewDocumentsService,
  crewEducationService,
  crewMedicalService,
  crewSeaServiceService,
  crewVisasService,
} from "../../crew-pool/services";
import {
  AttachmentValidationError,
  fileStorageService,
  MAX_ATTACHMENT_BYTES,
} from "../../shared/fileStorageService";
import { serveAttachmentFromFilePath } from "../../shared/serveAttachmentHelper";
import { runInCrewAppTenant } from "../tenantContext";

type AttachmentSection =
  | "documents" | "visas" | "education" | "licenses" | "training" | "sea-service"
  | "medicals" | "doctor-visits" | "briefings" | "debriefings";

type Adapter = {
  parentKey: string;
  module: string;
  writable: boolean;
  list: (crewUuid: string) => Promise<any[]>;
  add?: (parentUuid: string, file: any) => Promise<any>;
  remove?: (attUuid: string) => Promise<void>;
};

const adapters: Record<AttachmentSection, Adapter> = {
  documents: { parentKey: "docUuid", module: "crew-pool/crew-documents", writable: true, list: crewDocumentsService.getAll.bind(crewDocumentsService), add: crewDocumentsService.addAttachment.bind(crewDocumentsService), remove: crewDocumentsService.removeAttachment.bind(crewDocumentsService) },
  visas: { parentKey: "visaUuid", module: "crew-pool/crew-visas", writable: true, list: crewVisasService.getAll.bind(crewVisasService), add: crewVisasService.addAttachment.bind(crewVisasService), remove: crewVisasService.removeAttachment.bind(crewVisasService) },
  education: { parentKey: "eduUuid", module: "crew-pool/crew-education", writable: true, list: crewEducationService.getAll.bind(crewEducationService), add: crewEducationService.addAttachment.bind(crewEducationService), remove: crewEducationService.removeAttachment.bind(crewEducationService) },
  licenses: { parentKey: "licUuid", module: "crew-pool/crew-licenses", writable: true, list: crewCertificatesService.getLicenses.bind(crewCertificatesService), add: crewCertificatesService.addLicenseAttachment.bind(crewCertificatesService), remove: crewCertificatesService.removeLicenseAttachment.bind(crewCertificatesService) },
  training: { parentKey: "trainUuid", module: "crew-pool/crew-training", writable: true, list: crewCertificatesService.getTraining.bind(crewCertificatesService), add: crewCertificatesService.addTrainingAttachment.bind(crewCertificatesService), remove: crewCertificatesService.removeTrainingAttachment.bind(crewCertificatesService) },
  "sea-service": { parentKey: "seaUuid", module: "crew-pool/crew-sea-service", writable: true, list: crewSeaServiceService.getAll.bind(crewSeaServiceService), add: crewSeaServiceService.addAttachment.bind(crewSeaServiceService), remove: crewSeaServiceService.removeAttachment.bind(crewSeaServiceService) },
  medicals: { parentKey: "medUuid", module: "crew-pool/crew-medicals", writable: false, list: crewMedicalService.getMedicals.bind(crewMedicalService) },
  "doctor-visits": { parentKey: "visitUuid", module: "crew-pool/crew-doctor-visits", writable: false, list: crewMedicalService.getDoctorVisits.bind(crewMedicalService) },
  briefings: { parentKey: "briefingUuid", module: "crew-pool/crew-briefings", writable: false, list: crewBriefingService.getBriefings.bind(crewBriefingService) },
  debriefings: { parentKey: "debriefingUuid", module: "crew-pool/crew-debriefings", writable: false, list: crewBriefingService.getDebriefings.bind(crewBriefingService) },
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_ATTACHMENT_BYTES } });

export function parseCrewAttachment(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (error: any) => {
    if (error) {
      const tooLarge = error?.code === "LIMIT_FILE_SIZE";
      res.status(400).json({
        error: "invalid_attachment",
        message: tooLarge ? "Attachment exceeds the 5 MB size limit." : "Unable to read the selected file.",
      });
      return;
    }
    const domain = req.crewUser?.domain;
    if (!domain) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    runInCrewAppTenant(domain, () => next()).catch(() => {
      if (!res.headersSent) res.status(503).json({ error: "tenant_context_unavailable" });
    });
  });
}

function adapterFor(value: string): Adapter | null {
  return Object.prototype.hasOwnProperty.call(adapters, value) ? adapters[value as AttachmentSection] : null;
}

function isReadOnlyParent(section: string, parent: any): boolean {
  return (section === "sea-service" && parent?.serviceType === "company") ||
    (section === "licenses" && Boolean(parent?.archivedAt));
}

async function ownParent(req: Request): Promise<{ adapter: Adapter; parent: any }> {
  const adapter = adapterFor(req.params.collection);
  if (!adapter) throw Object.assign(new Error("Attachment section not found"), { status: 404 });
  const rows = await adapter.list(req.crewUser!.crewUuid);
  const parent = rows.find((row) => row?.[adapter.parentKey] === req.params.uuid);
  if (!parent || parent.crewUuid !== req.crewUser!.crewUuid) {
    throw Object.assign(new Error("Record not found"), { status: 404 });
  }
  return { adapter, parent };
}

function ownAttachment(parent: any, attUuid: string): any {
  const attachment = (parent.attachments || []).find((row: any) => row.attUuid === attUuid && !row.isDeleted);
  if (!attachment) throw Object.assign(new Error("Attachment not found"), { status: 404 });
  return attachment;
}

function metadata(attachment: any, canDelete: boolean): any {
  return {
    attUuid: attachment.attUuid,
    fileName: attachment.fileName || "Attachment",
    fileType: attachment.fileType || null,
    fileSize: attachment.fileSize || null,
    createdAt: attachment.createdAt instanceof Date ? attachment.createdAt.toISOString() : attachment.createdAt || null,
    canDelete,
  };
}

function sendError(res: Response, error: any): void {
  const status = error?.status || (error instanceof AttachmentValidationError ? 400 : 500);
  res.status(status).json({
    error: status === 404 ? "not_found" : "attachment_error",
    message: error?.message || "Attachment request failed",
  });
}

export async function listCrewAttachments(req: Request, res: Response): Promise<void> {
  try {
    const { adapter, parent } = await ownParent(req);
    const canDelete = adapter.writable && !isReadOnlyParent(req.params.collection, parent);
    res.json((parent.attachments || []).filter((row: any) => !row.isDeleted).map((row: any) => metadata(row, canDelete)));
  } catch (error) {
    sendError(res, error);
  }
}

export async function uploadCrewAttachment(req: Request, res: Response): Promise<void> {
  let storedPath: string | null = null;
  try {
    const { adapter, parent } = await ownParent(req);
    if (!adapter.writable || !adapter.add) throw Object.assign(new Error("Attachments are read only for this section"), { status: 403 });
    if (isReadOnlyParent(req.params.collection, parent)) throw Object.assign(new Error("This record is read only"), { status: 409 });
    if (!req.file) throw Object.assign(new Error("Select a file to upload"), { status: 400 });
    const detectedType = fileStorageService.validateAttachmentBuffer(req.file.buffer);
    const extension = detectedType === "application/pdf" ? ".pdf" : detectedType === "image/png" ? ".png" : ".jpg";
    const displayName = fileStorageService.sanitizeFileName(req.file.originalname).replace(/\.[^.]*$/, "") + extension;
    storedPath = await fileStorageService.writeAttachment(adapter.module, displayName, req.file.buffer);
    const attachment = await adapter.add(req.params.uuid, {
      fileName: displayName,
      filePath: storedPath,
      fileData: null,
      fileType: detectedType,
      fileSize: String(req.file.size),
      uploadedByUuid: req.crewUser!.crewUuid,
    });
    res.status(201).json(metadata(attachment, true));
  } catch (error) {
    if (storedPath) await fileStorageService.deleteAttachment(storedPath);
    sendError(res, error);
  }
}

export async function deleteCrewAttachment(req: Request, res: Response): Promise<void> {
  try {
    const { adapter, parent } = await ownParent(req);
    if (!adapter.writable || !adapter.remove) throw Object.assign(new Error("Attachments are read only for this section"), { status: 403 });
    if (isReadOnlyParent(req.params.collection, parent)) throw Object.assign(new Error("This record is read only"), { status: 409 });
    ownAttachment(parent, req.params.attUuid);
    await adapter.remove(req.params.attUuid);
    res.status(204).send();
  } catch (error) {
    sendError(res, error);
  }
}

export async function serveCrewAttachment(req: Request, res: Response): Promise<void> {
  try {
    const { parent } = await ownParent(req);
    const attachment = ownAttachment(parent, req.params.attUuid);
    const filePathIsDataUrl = Boolean(attachment.filePath?.startsWith("data:"));
    await serveAttachmentFromFilePath(res, {
      filePath: filePathIsDataUrl ? null : attachment.filePath || null,
      fileData: attachment.fileData || (filePathIsDataUrl ? attachment.filePath : null),
      fileName: attachment.fileName || null,
      fileType: attachment.fileType || null,
    });
  } catch (error) {
    sendError(res, error);
  }
}