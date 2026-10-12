import { Request, Response } from "express";
import { vesselPlanningService, getAllForConflictDetection } from "../services";
import { insertVesselPlanningV2Schema } from "../../../../shared/v2/vessel/schema";
import { z } from "zod";
import {
  fileStorageService,
  AttachmentValidationError,
} from "../../shared/fileStorageService.js";
import {
  serveAttachmentFromFilePath,
  decodeStoredFile,
} from "../../shared/serveAttachmentHelper.js";
import { resolveVesselFolderFromPlanUuid } from "../../shared/attachmentScope.js";
import { getAuditUserUuid } from "../../accounts/controllers/_auth";
import { getDb } from "../../db";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { crewAssignments } from "../../../../shared/v2/crew-pool/schema";
import { and, eq } from "drizzle-orm";

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

export const vesselPlanningController = {
  async deferRelief(req: Request, res: Response) {
    const parsed = z.object({ reason: z.string().trim().min(1).max(5000) }).strict().safeParse(req.body);
    const actor = getAuditUserUuid(req);
    if (!parsed.success) { res.status(400).json({ message: "Provide only a written reason for deferring relief." }); return; }
    if (!actor) { res.status(401).json({ message: "Authenticated identity required." }); return; }
    try { res.json(await vesselPlanningService.deferRelief(req.params.planUuid, parsed.data.reason, actor)); }
    catch (error: any) { res.status(409).json({ message: error.message }); }
  },
  async getUnlinkedRelieverClearAudit(req: Request, res: Response) {
    if (req.resolvedRole?.ok !== true || req.resolvedRole.role.roleName.trim().toLowerCase() !== "admin"
      || !getAuditUserUuid(req)) {
      return res.status(403).json({ error: "Administrator access required" });
    }
    try {
      res.json(await vesselPlanningService.getUnlinkedRelieverClearAudit(req.params.planUuid));
    } catch (error: any) {
      if (error.message?.includes("not found")) return res.status(404).json({ error: error.message });
      console.error("Error reading reliever-clear audit:", error);
      res.status(500).json({ error: "Failed to read reliever-clear audit" });
    }
  },

  async clearUnlinkedReliever(req: Request, res: Response) {
    if (req.resolvedRole?.ok !== true || req.resolvedRole.role.roleName.trim().toLowerCase() !== "admin"
      || !getAuditUserUuid(req)) {
      return res.status(403).json({ error: "Administrator access required" });
    }
    const parsed = z.object({
      expectedCrewUuid: z.string().uuid(),
      reason: z.string().trim().min(1).max(2000),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "A written reason and reliever crew ID are required" });
    try {
      res.json(await vesselPlanningService.clearUnlinkedReliever(
        req.params.planUuid, parsed.data.expectedCrewUuid, parsed.data.reason, getAuditUserUuid(req)!,
      ));
    } catch (error: any) {
      if (error.message?.includes("not found")) return res.status(404).json({ error: error.message });
      if (error.message?.includes("cannot be cleared") || error.message?.includes("Reliever changed")) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Error clearing unlinked reliever:", error);
      res.status(500).json({ error: "Failed to clear unlinked reliever" });
    }
  },

  async getIncumbentReconciliation(req: Request, res: Response) {
    if (req.user?.userType?.toLowerCase() !== "admin" || !getAuditUserUuid(req)) {
      return res.status(403).json({ error: "Administrator access required" });
    }
    try {
      res.json(await vesselPlanningService.getIncumbentReconciliation(req.params.planUuid));
    } catch (error: any) {
      if (error.message?.includes("not found")) return res.status(404).json({ error: error.message });
      console.error("Error loading incumbent reconciliation:", error);
      res.status(500).json({ error: "Failed to load incumbent reconciliation" });
    }
  },

  async reconcileIncumbentAssignment(req: Request, res: Response) {
    const reviewedBy = getAuditUserUuid(req);
    if (req.user?.userType?.toLowerCase() !== "admin" || !reviewedBy) {
      return res.status(403).json({ error: "Administrator access required" });
    }
    const parsed = z.object({
      assignUuid: z.string().uuid(),
      evidenceNote: z.string().trim().min(20).max(2000),
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Select an assignment and provide at least 20 characters explaining the evidence" });
    }
    try {
      res.json(await vesselPlanningService.reconcileIncumbentAssignment(
        req.params.planUuid, parsed.data.assignUuid, parsed.data.evidenceNote, reviewedBy,
      ));
    } catch (error: any) {
      if (error.message?.includes("not found")) return res.status(404).json({ error: error.message });
      if (error.message?.includes("assignment") || error.message?.includes("planning")) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Error reconciling incumbent assignment:", error);
      res.status(500).json({ error: "Failed to reconcile incumbent assignment" });
    }
  },
  /**
   * Get all planning records for conflict detection in rotation planning
   * Returns minimal fields: crewMemberId, relieverCrewId, vesselUuid, signOnDate, reliefDue, relieverSignOnDate, contractPeriodMonths
   */
  async getAll(req: Request, res: Response) {
    try {
      const planning = await getAllForConflictDetection();
      res.json(planning);
    } catch (error) {
      console.error("Error fetching all vessel planning:", error);
      res.status(500).json({ error: "Failed to fetch vessel planning" });
    }
  },

  async getByVesselUuid(req: Request, res: Response) {
    try {
      const { vesselUuid } = req.params;
      const planning = await vesselPlanningService.getByVesselUuid(vesselUuid);
      res.json(planning);
    } catch (error) {
      console.error("Error fetching vessel planning:", error);
      res.status(500).json({ error: "Failed to fetch vessel planning" });
    }
  },

  async getCrewListExport(req: Request, res: Response) {
    try {
      const { vesselUuid } = req.params;
      const payload = await vesselPlanningService.getCrewListExportPayload(vesselUuid);
      res.json(payload);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error building crew list export payload:", error);
      res.status(500).json({ error: "Failed to build crew list export" });
    }
  },

  async getByPlanUuid(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const planning = await vesselPlanningService.getByPlanUuid(planUuid);
      res.json(planning);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching planning:", error);
      res.status(500).json({ error: "Failed to fetch planning record" });
    }
  },

  async getRelieverAssignment(req: Request, res: Response) {
    try {
      const { planUuid, assignUuid } = req.params;
      const db = getDb();
      const [row] = await db.select({
        assignUuid: crewAssignments.assignUuid,
        crewUuid: crewAssignments.crewUuid,
        vesselUuid: crewAssignments.vesselUuid,
        assignmentType: crewAssignments.assignmentType,
        signOnDate: crewAssignments.signOnDate,
        contractPeriod: crewAssignments.contractPeriod,
        portOfJoiningUuid: crewAssignments.portOfJoiningUuid,
      }).from(vesselPlanningV2)
        .innerJoin(crewAssignments, and(
          eq(crewAssignments.assignUuid, vesselPlanningV2.relieverAssignUuid),
          eq(crewAssignments.crewUuid, vesselPlanningV2.relieverCrewUuid),
          eq(crewAssignments.vesselUuid, vesselPlanningV2.vesselUuid),
          eq(crewAssignments.isDeleted, false),
        ))
        .where(and(
          eq(vesselPlanningV2.planUuid, planUuid),
          eq(vesselPlanningV2.relieverAssignUuid, assignUuid),
          eq(vesselPlanningV2.isDeleted, false),
        ));
      if (!row) return res.status(404).json({ error: "Linked reliever assignment unavailable" });
      res.json(row);
    } catch (error) {
      console.error("Error opening linked reliever assignment:", error);
      res.status(500).json({ error: "Failed to open linked reliever assignment" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const validatedData = insertVesselPlanningV2Schema
        .omit({ planUuid: true, relieverAssignUuid: true, crewAssignUuid: true })
        .parse(req.body);
      const auditUserUuid = getAuditUserUuid(req);
      const planning = await vesselPlanningService.create({ ...validatedData, auditUserUuid });
      res.status(201).json(planning);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating planning:", error);
      res.status(500).json({ error: "Failed to create planning record" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const { relieverAssignUuid: _ignored, crewAssignUuid: _ignoredCrew, ...updateBody } = req.body || {};
      const planning = await vesselPlanningService.update(planUuid, {
        ...updateBody,
        // Audit identity is server-derived and cannot be spoofed by the client.
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(planning);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("Travel End date cannot be filled before Sign Off")) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message?.includes("assignment is unlinked") ||
          error.message?.includes("assignment is no longer Planned") ||
          error.message?.includes("Deploy the reliever") ||
          error.message?.includes("Incumbent assignment link is missing") ||
          error.message?.includes("Linked incumbent assignment is inconsistent") ||
          error.message?.includes("Planning assignment links changed") ||
          error.message?.includes("Planning crew changed")) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Error updating planning:", error);
      res.status(500).json({ error: "Failed to update planning record" });
    }
  },

  async archive(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const { archivedByUuid, auditUserUuid } = req.body;
      const planning = await vesselPlanningService.archive(planUuid, archivedByUuid, auditUserUuid);
      res.json(planning);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error archiving planning:", error);
      res.status(500).json({ error: "Failed to archive planning record" });
    }
  },

  async getAttachments(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const attachments = await vesselPlanningService.getAttachments(planUuid);
      
      const formattedAttachments = attachments.map((att: any) => ({
        id: att.attUuid,
        filename: att.fileName,
        fileType: att.fileType,
        fileData: att.fileData,
        fileSize: parseInt(att.fileSize || '0', 10),
        uploadedBy: att.uploadedByUuid || '',
        uploadDate: att.uploadDate,
        viewUrl: `/api/v2/vessel/planning/attachments/${att.attUuid}/raw`,
      }));
      
      res.json(formattedAttachments);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  },

  async addAttachment(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const {
        filename,
        fileName,
        filePath,
        fileUrl,
        fileData,
        data,
        fileType,
        mimeType,
        fileSize,
        uploadedByUuid,
      } = req.body;

      const resolvedFileName = fileName || filename || "";
      const rawValue = fileData || filePath || fileUrl || data || "";
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!resolvedFileName || !rawValue) {
        return res
          .status(400)
          .json({ error: "fileName and fileData/filePath are required" });
      }

      const vesselFolder = await resolveVesselFolderFromPlanUuid(planUuid);
      const stored = await persistIncoming(
        `${vesselFolder}/vessel`,
        resolvedFileName,
        rawValue,
        resolvedFileType,
      );

      const attachment = await vesselPlanningService.addAttachment(planUuid, {
        fileName: resolvedFileName,
        filePath: stored.filePath,
        fileData: stored.fileData,
        fileType: resolvedFileType,
        fileSize: fileSize != null ? String(fileSize) : "0",
        uploadedByUuid: uploadedByUuid || null,
        uploadDate: new Date().toISOString(),
      });
      res.status(201).json(attachment);
    } catch (error: any) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error adding attachment:", error);
      res.status(500).json({ error: "Failed to add attachment" });
    }
  },

  async deleteAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      await vesselPlanningService.deleteAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting attachment:", error);
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  },

  async serveAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const attachment = await vesselPlanningService.getAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(attachment));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      console.error("Error serving attachment:", error);
      return res.status(500).json({ error: "Failed to load attachment" });
    }
  },

  /**
   * Sign on reliever: moves crew from Reliever Status to On Board Status
   * This is triggered when joiningStatus changes from "Planned" to "Signed On"
   */
  async signOnReliever(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const { signOnDate, signOnPort, contractPeriodMonths, contractEndRangeStartMonths, contractEndRangeEndMonths, plannedConfirmedDate, travelStartDate } = req.body;
      const auditUserUuid = getAuditUserUuid(req);
      
      const planning = await vesselPlanningService.signOnReliever(planUuid, {
        signOnDate,
        signOnPort,
        contractPeriodMonths,
        contractEndRangeStartMonths,
        contractEndRangeEndMonths,
        plannedConfirmedDate,
        travelStartDate,
        auditUserUuid,
      });
      
      res.json(planning);
    } catch (error: any) {
      if (error.code === "SIGN_ON_CONFLICT") {
        return res.status(409).json({ error: error.message, conflict: error.conflict });
      }
      if (error.message?.includes("assignment link is missing") ||
          error.message?.includes("Planning assignment links changed") ||
          error.message?.includes("Linked reliever assignment") ||
          error.message?.includes("Reliever planning changed")) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("No reliever") || error.message?.includes("secondary crew")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error signing on reliever:", error);
      res.status(500).json({ error: "Failed to sign on reliever" });
    }
  },

  /**
   * Update reliever status without signing on
   * For status changes: Planned -> Confirmed -> In Transit
   */
  async updateRelieverStatus(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const { joiningStatus, relieverSignOnDate, joiningPortUuid, relieverContractPeriodMonths, contractEndRangeStartMonths, contractEndRangeEndMonths } = req.body;
      const auditUserUuid = getAuditUserUuid(req);
      
      if (!joiningStatus) {
        return res.status(400).json({ error: "joiningStatus is required" });
      }

      if (joiningStatus === "Signed On") {
        const planning = await vesselPlanningService.signOnReliever(planUuid, {
          signOnDate: relieverSignOnDate,
          signOnPort: joiningPortUuid,
          contractPeriodMonths: relieverContractPeriodMonths,
          contractEndRangeStartMonths,
          contractEndRangeEndMonths,
          auditUserUuid,
        });
        return res.json(planning);
      }

      const planning = await vesselPlanningService.updateRelieverStatus(planUuid, joiningStatus, {
        relieverSignOnDate,
        joiningPortUuid,
        relieverContractPeriodMonths,
        auditUserUuid,
      });
      
      res.json(planning);
    } catch (error: any) {
      if (error.code === "SIGN_ON_CONFLICT") {
        return res.status(409).json({ error: error.message, conflict: error.conflict });
      }
      if (error.message?.includes("assignment link is missing") ||
          error.message?.includes("Linked reliever assignment") ||
          error.message?.includes("Reliever planning changed")) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating reliever status:", error);
      res.status(500).json({ error: "Failed to update reliever status" });
    }
  },

  /**
   * Sign off crew from vessel - updates both vessel_planning_v2 and crew_assignments
   */
  async signOffCrew(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const { signOffDate, signOffReason, signOffPortUuid, travelEndDate } = req.body;
      
      if (!signOffDate) {
        return res.status(400).json({ error: "signOffDate is required" });
      }
      
      const planning = await vesselPlanningService.signOffCrew(planUuid, {
        signOffDate,
        signOffReason,
        signOffPortUuid,
        travelEndDate,
        auditUserUuid: getAuditUserUuid(req),
      });
      
      res.json(planning);
    } catch (error: any) {
      if (error.message?.includes("assignment link is missing") ||
          error.message?.includes("Planning assignment links changed") ||
          error.message?.includes("Linked incumbent assignment")) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error signing off crew:", error);
      res.status(500).json({ error: "Failed to sign off crew" });
    }
  },

  /**
   * Get Officer Matrix data for a crew member
   * Returns experience metrics, certifications, and English proficiency
   */
  async getOfficerMatrixData(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const { rank, signOnDate, department, vesselUuid } = req.query;
      
      if (!crewUuid) {
        return res.status(400).json({ error: "crewUuid is required" });
      }
      
      const data = await vesselPlanningService.getOfficerMatrixData(
        crewUuid,
        (rank as string) || '',
        (signOnDate as string) || null,
        ((department as string) || 'deck') as 'deck' | 'engine',
        (vesselUuid as string) || null
      );
      
      res.json(data);
    } catch (error) {
      console.error("Error fetching officer matrix data:", error);
      res.status(500).json({ error: "Failed to fetch officer matrix data" });
    }
  },

  async checkSignOnConflict(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const { vesselUuid } = req.query;

      if (!crewUuid || !vesselUuid) {
        return res.status(400).json({ error: "crewUuid and vesselUuid are required" });
      }

      const { planUuid } = req.query;
      const result = await vesselPlanningService.checkSignOnConflict(
        crewUuid,
        vesselUuid as string,
        typeof planUuid === "string" && planUuid.length > 0 ? planUuid : undefined,
      );
      res.json(result);
    } catch (error) {
      console.error("Error checking sign-on conflict:", error);
      res.status(500).json({ error: "Failed to check sign-on conflict" });
    }
  },
};
