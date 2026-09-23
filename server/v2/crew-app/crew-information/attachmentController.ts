import { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  crewBriefingService,
  crewMedicalService,
} from "../../crew-pool/services";
import { attachmentAdapters, isCollectionName, isReadonlyCollectionRecord, collections, type CollectionName } from "./adapters";
import { pendingChangesRepository } from "./pendingChangesRepository";
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

// Wraps the shared collection adapters (documents/visas/education/licenses/
// training/sea-service — see ./adapters) plus the two read-only-from-here
// sections that still list their own attachments.
function collectionAttachmentAdapter(name: CollectionName): Adapter {
  const attach = attachmentAdapters[name];
  return {
    parentKey: collections[name].primaryKey,
    module: `crew-pool/crew-${name}`,
    writable: Boolean(attach),
    list: collections[name].list,
    add: attach?.add,
    remove: attach?.remove,
  };
}

const adapters: Record<AttachmentSection, Adapter> = {
  documents: collectionAttachmentAdapter("documents"),
  visas: collectionAttachmentAdapter("visas"),
  education: collectionAttachmentAdapter("education"),
  licenses: collectionAttachmentAdapter("licenses"),
  training: collectionAttachmentAdapter("training"),
  "sea-service": collectionAttachmentAdapter("sea-service"),
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
  return isCollectionName(section) && isReadonlyCollectionRecord(section, parent);
}

interface ResolvedParent {
  adapter: Adapter;
  parent: any;
  /** Set when the "parent" is actually a still-pending 'create' row, not yet a canonical record — attachments are staged on the pending row instead of linked live. */
  pendingUuid?: string;
}

async function ownParent(req: Request): Promise<ResolvedParent> {
  const adapter = adapterFor(req.params.collection);
  if (!adapter) throw Object.assign(new Error("Attachment section not found"), { status: 404 });
  const rows = await adapter.list(req.crewUser!.crewUuid);
  const parent = rows.find((row) => row?.[adapter.parentKey] === req.params.uuid);
  if (parent) {
    if (parent.crewUuid !== req.crewUser!.crewUuid) {
      throw Object.assign(new Error("Record not found"), { status: 404 });
    }
    return { adapter, parent };
  }

  // Not a canonical record yet — check whether it's this crew member's own
  // still-pending submission awaiting office verification (requirement 1).
  if (isCollectionName(req.params.collection) && adapter.writable) {
    const pending = await pendingChangesRepository.findByUuid(req.params.uuid);
    if (
      pending && pending.crewUuid === req.crewUser!.crewUuid && pending.status === "pending" &&
      pending.action === "create" && pending.section === req.params.collection
    ) {
      const stagedAttachments = JSON.parse(pending.stagedAttachments || "[]");
      return {
        adapter,
        parent: { crewUuid: pending.crewUuid, attachments: stagedAttachments },
        pendingUuid: pending.pendingUuid,
      };
    }
  }
  throw Object.assign(new Error("Record not found"), { status: 404 });
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
    const { adapter, parent, pendingUuid } = await ownParent(req);
    if (!adapter.writable || !adapter.add) throw Object.assign(new Error("Attachments are read only for this section"), { status: 403 });
    if (isReadOnlyParent(req.params.collection, parent)) throw Object.assign(new Error("This record is read only"), { status: 409 });
    if (!req.file) throw Object.assign(new Error("Select a file to upload"), { status: 400 });
    const detectedType = fileStorageService.validateAttachmentBuffer(req.file.buffer);
    const extension = detectedType === "application/pdf" ? ".pdf" : detectedType === "image/png" ? ".png" : ".jpg";
    const displayName = fileStorageService.sanitizeFileName(req.file.originalname).replace(/\.[^.]*$/, "") + extension;
    storedPath = await fileStorageService.writeAttachment(adapter.module, displayName, req.file.buffer);

    if (pendingUuid) {
      // Still-pending 'create' — file is written to storage now, but only
      // linked into the canonical record's attachments once the office
      // approves the entry (see pendingChangesService.applyPendingChange).
      const { attUuid } = await pendingChangesRepository.appendStagedAttachment(pendingUuid, {
        fileName: displayName,
        filePath: storedPath,
        fileType: detectedType,
        fileSize: String(req.file.size),
      });
      res.status(201).json(metadata({ attUuid, fileName: displayName, fileType: detectedType, fileSize: String(req.file.size), createdAt: new Date().toISOString() }, true));
      return;
    }

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
    const { adapter, parent, pendingUuid } = await ownParent(req);
    if (!adapter.writable || !adapter.remove) throw Object.assign(new Error("Attachments are read only for this section"), { status: 403 });
    if (isReadOnlyParent(req.params.collection, parent)) throw Object.assign(new Error("This record is read only"), { status: 409 });
    ownAttachment(parent, req.params.attUuid);

    if (pendingUuid) {
      const removed = await pendingChangesRepository.removeStagedAttachment(pendingUuid, req.params.attUuid);
      if (removed?.filePath) await fileStorageService.deleteAttachment(removed.filePath);
      res.status(204).send();
      return;
    }

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
