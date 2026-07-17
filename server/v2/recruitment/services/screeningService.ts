import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { masterUsers } from "../../../../shared/schema";
import {
  screeningB1Repository,
  screeningB2Repository,
  screeningB3Repository,
  screeningB4Repository,
  screeningB5Repository,
  screeningB6Repository,
  screeningB7Repository,
  screeningB8Repository,
} from "../repositories/screeningRepository";
import type {
  ScreeningB1Initial,
  InsertScreeningB1Initial,
  ScreeningB2References,
  InsertScreeningB2References,
  ScreeningB3Security,
  InsertScreeningB3Security,
  ScreeningB4Certificates,
  InsertScreeningB4Certificates,
  ScreeningB5Tests,
  InsertScreeningB5Tests,
  ScreeningB6Interviews,
  InsertScreeningB6Interviews,
  ScreeningB7Training,
  InsertScreeningB7Training,
  ScreeningB8Shortlisting,
  InsertScreeningB8Shortlisting,
} from "../../../../shared/v2/recruitment/types";
import { fileStorageService } from "../../shared/fileStorageService.js";
import { recruitmentCandidatesV2 } from "../../../../shared/v2/recruitment/schema";
import { sendEmail, logEmailEvent } from "../../shared/emailService.js";
import { buildInterviewAssignmentEmail } from "../templates/interviewNotificationTemplate.js";



/**
 * Delete a stored attachment binary from disk. Skips base64 data: values
 * (legacy rows) and silently ignores missing files.
 */
async function deleteAttachmentFile(filePath?: string | null): Promise<void> {
  if (!filePath || filePath.startsWith("data:")) return;
  await fileStorageService.deleteAttachment(filePath);
}

function extractAuditUser(userUuid?: string, data?: Record<string, unknown>): string | null {
  if (userUuid) return userUuid;
  if (data && 'auditUserUuid' in data) {
    const val = data.auditUserUuid as string | null;
    delete data.auditUserUuid;
    return val;
  }
  return null;
}

async function resolveUserUuid(value: string): Promise<string | null> {
  if (!value) return null;
  
  const db = getDb();
  
  // 1. Try exact match by userUuid directly (if it was passed as UUID)
  const byUuid = await db.select().from(masterUsers)
    .where(eq(masterUsers.userUuid, value))
    .limit(1);
  if (byUuid.length > 0 && byUuid[0].userUuid) {
    return byUuid[0].userUuid;
  }
  
  // 2. Try exact match by displayName column (corresponds to dropdown value)
  const byDisplayName = await db.select().from(masterUsers)
    .where(eq(masterUsers.displayName, value))
    .limit(1);
  if (byDisplayName.length > 0 && byDisplayName[0].userUuid) {
    return byDisplayName[0].userUuid;
  }
  
  // 3. Try parsing string split by designation separator (fullname + " ," + designation)
  const separator = value.includes(' ,') ? ' ,' : (value.includes(',') ? ',' : null);
  if (separator) {
    const parts = value.split(separator);
    const namePart = parts[0].trim();
    const designationPart = parts[1].trim();
    
    // Try matching namePart against fullname
    let results = await db.select().from(masterUsers)
      .where(eq(masterUsers.fullname, namePart))
      .limit(10);
      
    // Fall back to matching namePart against firstname if fullname is empty
    if (results.length === 0) {
      results = await db.select().from(masterUsers)
        .where(eq(masterUsers.firstname, namePart))
        .limit(10);
    }
    
    // Disambiguate multiple matches using designation
    const exactMatch = results.find((u: { designation?: string | null; userUuid?: string | null }) => 
      u.designation && u.designation.trim().toLowerCase() === designationPart.toLowerCase()
    );
    if (exactMatch && exactMatch.userUuid) {
      return exactMatch.userUuid;
    }
    if (results.length > 0 && results[0].userUuid) {
      return results[0].userUuid;
    }
  }
  
  // 4. Try matching exact string against fullname
  const byFullname = await db.select().from(masterUsers)
    .where(eq(masterUsers.fullname, value))
    .limit(1);
  if (byFullname.length > 0 && byFullname[0].userUuid) {
    return byFullname[0].userUuid;
  }

  // 5. Try matching exact string against firstname
  const byFirstname = await db.select().from(masterUsers)
    .where(eq(masterUsers.firstname, value))
    .limit(1);
  if (byFirstname.length > 0 && byFirstname[0].userUuid) {
    return byFirstname[0].userUuid;
  }
  
  return null;
}



export class ScreeningSummaryService {
  async getByCandidate(recCanUuid: string): Promise<{ stage: string; label: string; done: boolean }[]> {
    const [b1, b2, b3, b4, b5, b6, b7, b8] = await Promise.all([
      screeningB1Repository.findByCandidateUuid(recCanUuid),
      screeningB2Repository.findByCandidateUuid(recCanUuid),
      screeningB3Repository.findByCandidateUuid(recCanUuid),
      screeningB4Repository.findByCandidateUuid(recCanUuid),
      screeningB5Repository.findByCandidateUuid(recCanUuid),
      screeningB6Repository.findByCandidateUuid(recCanUuid),
      screeningB7Repository.findByCandidateUuid(recCanUuid),
      screeningB8Repository.findByCandidateUuid(recCanUuid),
    ]);
    return [
      { stage: 'B1', label: 'Initial Screening',        done: !!b1?.submittedDate },
      { stage: 'B2', label: 'Reference Checks',          done: !!b2?.submittedDate },
      { stage: 'B3', label: 'Background / Security',     done: !!b3?.submittedDate },
      { stage: 'B4', label: 'Certificate Authentication',done: !!b4?.submittedDate },
      { stage: 'B5', label: 'Tests / Assessments',       done: !!b5?.submittedDate },
      { stage: 'B6', label: 'Interviews',                done: !!b6?.submittedDate },
      { stage: 'B7', label: 'Training Needs',            done: !!b7?.submittedDate },
      { stage: 'B8', label: 'Final Shortlisting',        done: !!b8?.submittedDate },
    ];
  }
}

export const screeningSummaryService = new ScreeningSummaryService();

export class ScreeningB1Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB1Initial | undefined> {
    return screeningB1Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB1Initial>, userUuid?: string): Promise<ScreeningB1Initial> {
    // Auto-extract auditUserUuid from data if not provided
    const auditUser = userUuid || (data as any).auditUserUuid || null;
    delete (data as any).auditUserUuid;

    const existing = await screeningB1Repository.findByCandidateUuid(recCanUuid);
    return screeningB1Repository.upsert(recCanUuid, {
      ...(existing ? {} : { b1Uuid: uuidv4() }),
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async getComments(b1Uuid: string) {
    return screeningB1Repository.findComments(b1Uuid);
  }

  async createComment(b1Uuid: string, data: { fieldKey?: string; userUuid?: string; commentText?: string }, userUuid?: string) {
    // Auto-extract auditUserUuid from data if not provided
    const auditUser = userUuid || (data as any).auditUserUuid || null;
    delete (data as any).auditUserUuid;

    return screeningB1Repository.createComment({
      commentUuid: uuidv4(),
      b1Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async updateComment(commentUuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB1Repository.updateComment(commentUuid, {
      ...data,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteComment(commentUuid: string) {
    return screeningB1Repository.deleteComment(commentUuid);
  }

  async getAttachments(b1Uuid: string) {
    return screeningB1Repository.findAttachments(b1Uuid);
  }

  async createAttachment(b1Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB1Repository.createAttachment({
      attUuid: uuidv4(),
      b1Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteAttachment(id: number): Promise<boolean> {
    const attachment = await screeningB1Repository.findAttachmentById(id);
    const success = await screeningB1Repository.deleteAttachment(id);
    await deleteAttachmentFile(attachment?.filePath);
    return success;
  }

  async getAttachmentFile(attUuid: string) {
    const attachment = await screeningB1Repository.findAttachmentByUuid(attUuid);
    if (!attachment) throw new Error(`Attachment not found: ${attUuid}`);
    return attachment;
  }
}

export class ScreeningB2Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB2References | undefined> {
    return screeningB2Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB2References>, userUuid?: string): Promise<ScreeningB2References> {
    const auditUser = extractAuditUser(userUuid, data as Record<string, unknown>);
    const existing = await screeningB2Repository.findByCandidateUuid(recCanUuid);
    return screeningB2Repository.upsert(recCanUuid, {
      ...(existing ? {} : { b2Uuid: uuidv4() }),
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async getItems(b2Uuid: string) {
    return screeningB2Repository.findItems(b2Uuid);
  }

  async createItem(b2Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB2Repository.createItem({
      refUuid: uuidv4(),
      b2Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async updateItem(refUuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB2Repository.updateItem(refUuid, {
      ...data,
      updatedByUuid: auditUser,
    } as any);
  }

  async getComments(b2Uuid: string) {
    return screeningB2Repository.findComments(b2Uuid);
  }

  async createComment(b2Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB2Repository.createComment({
      commentUuid: uuidv4(),
      b2Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async updateComment(commentUuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB2Repository.updateComment(commentUuid, {
      ...data,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteComment(commentUuid: string) {
    return screeningB2Repository.deleteComment(commentUuid);
  }

  async deleteItem(refUuid: string) {
    return screeningB2Repository.softDeleteItem(refUuid);
  }

  async getAttachments(b2Uuid: string) {
    return screeningB2Repository.findAttachments(b2Uuid);
  }

  async createAttachment(b2Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB2Repository.createAttachment({
      attUuid: uuidv4(),
      b2Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteAttachment(id: number): Promise<boolean> {
    const attachment = await screeningB2Repository.findAttachmentById(id);
    const success = await screeningB2Repository.deleteAttachment(id);
    await deleteAttachmentFile(attachment?.filePath);
    return success;
  }

  async getAttachmentFile(attUuid: string) {
    const attachment = await screeningB2Repository.findAttachmentByUuid(attUuid);
    if (!attachment) throw new Error(`Attachment not found: ${attUuid}`);
    return attachment;
  }
}

export class ScreeningB3Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB3Security | undefined> {
    return screeningB3Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB3Security>, userUuid?: string): Promise<ScreeningB3Security> {
    const auditUser = extractAuditUser(userUuid, data as Record<string, unknown>);
    const existing = await screeningB3Repository.findByCandidateUuid(recCanUuid);
    return screeningB3Repository.upsert(recCanUuid, {
      ...(existing ? {} : { b3Uuid: uuidv4() }),
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async getAuthorities(b3Uuid: string) {
    return screeningB3Repository.findAuthorities(b3Uuid);
  }

  async createAuthority(b3Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB3Repository.createAuthority({
      authUuid: uuidv4(),
      b3Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async updateAuthority(authUuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB3Repository.updateAuthority(authUuid, {
      ...data,
      updatedByUuid: auditUser,
    } as any);
  }

  async getComments(b3Uuid: string) {
    return screeningB3Repository.findComments(b3Uuid);
  }

  async createComment(b3Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB3Repository.createComment({
      commentUuid: uuidv4(),
      b3Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async updateComment(commentUuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB3Repository.updateComment(commentUuid, {
      ...data,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteComment(commentUuid: string) {
    return screeningB3Repository.deleteComment(commentUuid);
  }

  async deleteAuthority(authUuid: string) {
    return screeningB3Repository.softDeleteAuthority(authUuid);
  }

  async getAttachments(b3Uuid: string) {
    return screeningB3Repository.findAttachments(b3Uuid);
  }

  async createAttachment(b3Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB3Repository.createAttachment({
      attUuid: uuidv4(),
      b3Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteAttachment(id: number): Promise<boolean> {
    const attachment = await screeningB3Repository.findAttachmentById(id);
    const success = await screeningB3Repository.deleteAttachment(id);
    await deleteAttachmentFile(attachment?.filePath);
    return success;
  }

  async getAttachmentFile(attUuid: string) {
    const attachment = await screeningB3Repository.findAttachmentByUuid(attUuid);
    if (!attachment) throw new Error(`Attachment not found: ${attUuid}`);
    return attachment;
  }
}

export class ScreeningB4Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB4Certificates | undefined> {
    return screeningB4Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB4Certificates>, userUuid?: string): Promise<ScreeningB4Certificates> {
    const auditUser = extractAuditUser(userUuid, data as Record<string, unknown>);
    const existing = await screeningB4Repository.findByCandidateUuid(recCanUuid);
    return screeningB4Repository.upsert(recCanUuid, {
      ...(existing ? {} : { b4Uuid: uuidv4() }),
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async getCertItems(b4Uuid: string) {
    return screeningB4Repository.findCertItems(b4Uuid);
  }

  async createCertItem(b4Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB4Repository.createCertItem({
      certUuid: uuidv4(),
      b4Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async updateCertItem(certUuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB4Repository.updateCertItem(certUuid, {
      ...data,
      updatedByUuid: auditUser,
    } as any);
  }

  async getComments(b4Uuid: string) {
    return screeningB4Repository.findComments(b4Uuid);
  }

  async createComment(b4Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB4Repository.createComment({
      commentUuid: uuidv4(),
      b4Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async updateComment(commentUuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB4Repository.updateComment(commentUuid, {
      ...data,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteComment(commentUuid: string) {
    return screeningB4Repository.deleteComment(commentUuid);
  }

  async deleteCertItem(certUuid: string) {
    return screeningB4Repository.softDeleteCertItem(certUuid);
  }

  async getAttachments(b4Uuid: string) {
    return screeningB4Repository.findAttachments(b4Uuid);
  }

  async createAttachment(b4Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB4Repository.createAttachment({
      attUuid: uuidv4(),
      b4Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteAttachment(id: number): Promise<boolean> {
    const attachment = await screeningB4Repository.findAttachmentById(id);
    const success = await screeningB4Repository.deleteAttachment(id);
    await deleteAttachmentFile(attachment?.filePath);
    return success;
  }

  async getAttachmentFile(attUuid: string) {
    const attachment = await screeningB4Repository.findAttachmentByUuid(attUuid);
    if (!attachment) throw new Error(`Attachment not found: ${attUuid}`);
    return attachment;
  }
}

export class ScreeningB5Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB5Tests | undefined> {
    return screeningB5Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB5Tests>, userUuid?: string): Promise<ScreeningB5Tests> {
    const auditUser = extractAuditUser(userUuid, data as Record<string, unknown>);
    const existing = await screeningB5Repository.findByCandidateUuid(recCanUuid);
    return screeningB5Repository.upsert(recCanUuid, {
      ...(existing ? {} : { b5Uuid: uuidv4() }),
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async getTestItems(b5Uuid: string) {
    return screeningB5Repository.findTestItems(b5Uuid);
  }

  async createTestItem(b5Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB5Repository.createTestItem({
      testUuid: uuidv4(),
      b5Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async updateTestItem(testUuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB5Repository.updateTestItem(testUuid, {
      ...data,
      updatedByUuid: auditUser,
    } as any);
  }

  async getComments(b5Uuid: string) {
    return screeningB5Repository.findComments(b5Uuid);
  }

  async createComment(b5Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB5Repository.createComment({
      commentUuid: uuidv4(),
      b5Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async updateComment(commentUuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB5Repository.updateComment(commentUuid, {
      ...data,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteComment(commentUuid: string) {
    return screeningB5Repository.deleteComment(commentUuid);
  }

  async deleteTestItem(testUuid: string) {
    return screeningB5Repository.softDeleteTestItem(testUuid);
  }

  async getAttachments(b5Uuid: string) {
    return screeningB5Repository.findAttachments(b5Uuid);
  }

  async createAttachment(b5Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB5Repository.createAttachment({
      attUuid: uuidv4(),
      b5Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteAttachment(id: number): Promise<boolean> {
    const attachment = await screeningB5Repository.findAttachmentById(id);
    const success = await screeningB5Repository.deleteAttachment(id);
    await deleteAttachmentFile(attachment?.filePath);
    return success;
  }

  async getAttachmentFile(attUuid: string) {
    const attachment = await screeningB5Repository.findAttachmentByUuid(attUuid);
    if (!attachment) throw new Error(`Attachment not found: ${attUuid}`);
    return attachment;
  }
}

export class ScreeningB6Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB6Interviews | undefined> {
    return screeningB6Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB6Interviews>, userUuid?: string): Promise<ScreeningB6Interviews> {
    const auditUser = extractAuditUser(userUuid, data as Record<string, unknown>);
    const existing = await screeningB6Repository.findByCandidateUuid(recCanUuid);
    return screeningB6Repository.upsert(recCanUuid, {
      ...(existing ? {} : { b6Uuid: uuidv4() }),
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async getInterviewItems(b6Uuid: string) {
    return screeningB6Repository.findInterviewItems(b6Uuid);
  }

  async createInterviewItem(b6Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    logEmailEvent('INFO', `createInterviewItem called. b6Uuid: ${b6Uuid}`, { data, userUuid });
    const auditUser = extractAuditUser(userUuid, data);
    const resolvedData = { ...data };
    if (data.interviewerUuid && typeof data.interviewerUuid === 'string') {
      const resolvedUuid = await resolveUserUuid(data.interviewerUuid);
      logEmailEvent('INFO', `Resolved interviewerUuid from: ${data.interviewerUuid} to: ${resolvedUuid}`);
      if (resolvedUuid) {
        resolvedData.interviewerUuid = resolvedUuid;
      }
    }
    const createdItem = await screeningB6Repository.createInterviewItem({
      intUuid: uuidv4(),
      b6Uuid,
      ...resolvedData,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);

    logEmailEvent('INFO', `Created interview item in DB with UUID: ${createdItem.intUuid}`, createdItem);

    // Trigger notification if interviewer is assigned
    if (createdItem.interviewerUuid) {
      logEmailEvent('INFO', 'Interviewer UUID exists in created item, resolving candidate recCanUuid...');
      const recCanUuid = await screeningB6Repository.getRecCanUuidByB6Uuid(b6Uuid);
      logEmailEvent('INFO', `Resolved recCanUuid: ${recCanUuid}`);
      if (recCanUuid) {
        triggerInterviewAssignmentNotification(
          recCanUuid,
          createdItem.interviewerUuid,
          createdItem.interviewDate
        );
      } else {
        logEmailEvent('WARN', `Could not fetch recCanUuid for b6Uuid: ${b6Uuid}`);
      }
    } else {
      logEmailEvent('INFO', 'No interviewerUuid assigned to created item.');
    }

    return createdItem;
  }

  async updateInterviewItem(intUuid: string, data: Record<string, unknown>, userUuid?: string) {
    logEmailEvent('INFO', `updateInterviewItem called. intUuid: ${intUuid}`, { data, userUuid });
    const auditUser = extractAuditUser(userUuid, data);
    const resolvedData = { ...data };
    if (data.interviewerUuid && typeof data.interviewerUuid === 'string') {
      const resolvedUuid = await resolveUserUuid(data.interviewerUuid);
      logEmailEvent('INFO', `Resolved interviewerUuid from: ${data.interviewerUuid} to: ${resolvedUuid}`);
      if (resolvedUuid) {
        resolvedData.interviewerUuid = resolvedUuid;
      }
    }

    // Fetch current item before update to check if interviewer changes
    logEmailEvent('INFO', `Fetching current interview item for intUuid: ${intUuid}`);
    const currentItem = await screeningB6Repository.findInterviewItemByUuid(intUuid);
    logEmailEvent('INFO', `Current item before update:`, currentItem);

    const updatedItem = await screeningB6Repository.updateInterviewItem(intUuid, {
      ...resolvedData,
      updatedByUuid: auditUser,
    } as any);

    logEmailEvent('INFO', `Updated interview item in DB:`, updatedItem);

    // Trigger notification if interviewer is changed/assigned
    if (updatedItem && updatedItem.interviewerUuid) {
      const oldInterviewer = currentItem?.interviewerUuid;
      const newInterviewer = updatedItem.interviewerUuid;
      logEmailEvent('INFO', `Comparing interviewers: Old=${oldInterviewer}, New=${newInterviewer}`);
      if (oldInterviewer !== newInterviewer) {
        logEmailEvent('INFO', 'Interviewer has changed/assigned. Resolving recCanUuid...');
        const recCanUuid = await screeningB6Repository.getRecCanUuidByB6Uuid(updatedItem.b6Uuid);
        logEmailEvent('INFO', `Resolved recCanUuid: ${recCanUuid}`);
        if (recCanUuid) {
          triggerInterviewAssignmentNotification(
            recCanUuid,
            newInterviewer,
            updatedItem.interviewDate
          );
        } else {
          logEmailEvent('WARN', `Could not fetch recCanUuid for b6Uuid: ${updatedItem.b6Uuid}`);
        }
      } else {
        logEmailEvent('INFO', 'Interviewer has not changed.');
      }
    } else {
      logEmailEvent('INFO', 'No interviewerUuid set on updated item.');
    }

    return updatedItem;
  }




  async getComments(b6Uuid: string) {
    return screeningB6Repository.findComments(b6Uuid);
  }

  async createComment(b6Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB6Repository.createComment({
      commentUuid: uuidv4(),
      b6Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async updateComment(commentUuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB6Repository.updateComment(commentUuid, {
      ...data,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteComment(commentUuid: string) {
    return screeningB6Repository.deleteComment(commentUuid);
  }

  async deleteInterviewItem(intUuid: string) {
    return screeningB6Repository.softDeleteInterviewItem(intUuid);
  }

  async getAttachments(b6Uuid: string) {
    return screeningB6Repository.findAttachments(b6Uuid);
  }

  async createAttachment(b6Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB6Repository.createAttachment({
      attUuid: uuidv4(),
      b6Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteAttachment(id: number): Promise<boolean> {
    const attachment = await screeningB6Repository.findAttachmentById(id);
    const success = await screeningB6Repository.deleteAttachment(id);
    await deleteAttachmentFile(attachment?.filePath);
    return success;
  }

  async getAttachmentFile(attUuid: string) {
    const attachment = await screeningB6Repository.findAttachmentByUuid(attUuid);
    if (!attachment) throw new Error(`Attachment not found: ${attUuid}`);
    return attachment;
  }
}

export class ScreeningB7Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB7Training | undefined> {
    return screeningB7Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB7Training>, userUuid?: string): Promise<ScreeningB7Training> {
    const auditUser = extractAuditUser(userUuid, data as Record<string, unknown>);
    const existing = await screeningB7Repository.findByCandidateUuid(recCanUuid);
    return screeningB7Repository.upsert(recCanUuid, {
      ...(existing ? {} : { b7Uuid: uuidv4() }),
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async getTrainingItems(b7Uuid: string) {
    return screeningB7Repository.findTrainingItems(b7Uuid);
  }

  async createTrainingItem(b7Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    const resolvedData = { ...data };
    if (data.identifiedByUuid && typeof data.identifiedByUuid === 'string') {
      const resolvedUuid = await resolveUserUuid(data.identifiedByUuid);
      if (resolvedUuid) {
        resolvedData.identifiedByUuid = resolvedUuid;
      }
    }
    return screeningB7Repository.createTrainingItem({
      trainItemUuid: uuidv4(),
      b7Uuid,
      ...resolvedData,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async updateTrainingItem(trainItemUuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    const resolvedData = { ...data };
    if (data.identifiedByUuid && typeof data.identifiedByUuid === 'string') {
      const resolvedUuid = await resolveUserUuid(data.identifiedByUuid);
      if (resolvedUuid) {
        resolvedData.identifiedByUuid = resolvedUuid;
      }
    }
    return screeningB7Repository.updateTrainingItem(trainItemUuid, {
      ...resolvedData,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteTrainingItem(trainItemUuid: string) {
    return screeningB7Repository.softDeleteTrainingItem(trainItemUuid);
  }
}

export class ScreeningB8Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB8Shortlisting | undefined> {
    return screeningB8Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB8Shortlisting>, userUuid?: string): Promise<ScreeningB8Shortlisting> {
    const auditUser = extractAuditUser(userUuid, data as Record<string, unknown>);
    const existing = await screeningB8Repository.findByCandidateUuid(recCanUuid);
    return screeningB8Repository.upsert(recCanUuid, {
      ...(existing ? {} : { b8Uuid: uuidv4() }),
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    });
  }

  async getApprovers(b8Uuid: string) {
    return screeningB8Repository.findApprovers(b8Uuid);
  }

  // Get approver details by joining selectedApproverUuids with master_users
  async getApproverDetails(userUuids: string[]) {
    return screeningB8Repository.getApproverDetailsByUuids(userUuids);
  }

  async createApprover(b8Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB8Repository.createApprover({
      approverUuid: uuidv4(),
      b8Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async getComments(b8Uuid: string) {
    return screeningB8Repository.findComments(b8Uuid);
  }

  async createComment(b8Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB8Repository.createComment({
      commentUuid: uuidv4(),
      b8Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async updateComment(commentUuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB8Repository.updateComment(commentUuid, {
      ...data,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteComment(commentUuid: string) {
    return screeningB8Repository.deleteComment(commentUuid);
  }

  async getAttachments(b8Uuid: string) {
    return screeningB8Repository.findAttachments(b8Uuid);
  }

  async createAttachment(b8Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    const auditUser = extractAuditUser(userUuid, data);
    return screeningB8Repository.createAttachment({
      attUuid: uuidv4(),
      b8Uuid,
      ...data,
      createdByUuid: auditUser,
      updatedByUuid: auditUser,
    } as any);
  }

  async deleteAttachment(id: number): Promise<boolean> {
    const attachment = await screeningB8Repository.findAttachmentById(id);
    const success = await screeningB8Repository.deleteAttachment(id);
    await deleteAttachmentFile(attachment?.filePath);
    return success;
  }

  async getAttachmentFile(attUuid: string) {
    const attachment = await screeningB8Repository.findAttachmentByUuid(attUuid);
    if (!attachment) throw new Error(`Attachment not found: ${attUuid}`);
    return attachment;
  }
}

export const screeningB1Service = new ScreeningB1Service();
export const screeningB2Service = new ScreeningB2Service();
export const screeningB3Service = new ScreeningB3Service();
export const screeningB4Service = new ScreeningB4Service();
export const screeningB5Service = new ScreeningB5Service();
export const screeningB6Service = new ScreeningB6Service();
export const screeningB7Service = new ScreeningB7Service();
export const screeningB8Service = new ScreeningB8Service();

async function triggerInterviewAssignmentNotification(
  recCanUuid: string,
  interviewerUuid: string,
  interviewDate?: string | null
): Promise<void> {
  logEmailEvent('INFO', `triggerInterviewAssignmentNotification triggered. recCanUuid: ${recCanUuid}, interviewerUuid: ${interviewerUuid}, interviewDate: ${interviewDate}`);

  try {
    const db = getDb();
    
    // 1. Fetch candidate details
    logEmailEvent('INFO', 'Querying recruitmentCandidatesV2...');
    const candidateResult = await db.select({
      firstName: recruitmentCandidatesV2.firstName,
      familyName: recruitmentCandidatesV2.familyName,
      rankAppliedFor: recruitmentCandidatesV2.rankAppliedFor,
      fileNo: recruitmentCandidatesV2.fileNo
    })
    .from(recruitmentCandidatesV2)
    .where(eq(recruitmentCandidatesV2.recCanUuid, recCanUuid))
    .limit(1);

    const candidate = candidateResult[0];
    logEmailEvent('INFO', 'Query result candidate:', candidate);
    if (!candidate) {
      logEmailEvent('WARN', `Candidate with UUID ${recCanUuid} not found.`);
      return;
    }

    // 2. Fetch interviewer details
    logEmailEvent('INFO', 'Querying masterUsers...');
    const interviewerResult = await db.select({
      email: masterUsers.email,
      fullname: masterUsers.fullname
    })
    .from(masterUsers)
    .where(eq(masterUsers.userUuid, interviewerUuid))
    .limit(1);

    const interviewer = interviewerResult[0];
    logEmailEvent('INFO', 'Query result interviewer:', interviewer);
    if (!interviewer || !interviewer.email) {
      logEmailEvent('WARN', `Interviewer with UUID ${interviewerUuid} has no valid email.`);
      return;
    }

    // 3. Construct application deep link
    const origin = process.env.VITE_API_CREWING_URL;
    if(!origin) {
      logEmailEvent('WARN', `VITE_API_CREWING_URL not found.`);
      return;
    }
    const applicationLink = `${origin}/recruitment/${recCanUuid}`;
    logEmailEvent('INFO', `Generated applicationLink: ${applicationLink}`);

    // 4. Build email and send
    const seafarerName = [candidate.firstName, candidate.familyName].filter(Boolean).join(' ') || 'Candidate';
    const rank = candidate.rankAppliedFor || 'N/A';
    
    const emailData = buildInterviewAssignmentEmail({
      interviewerName: interviewer.fullname || 'Interviewer',
      seafarerName,
      rank,
      interviewDate,
      applicationRef: candidate.fileNo,
      applicationLink
    });

    logEmailEvent('INFO', `Built email subject: ${emailData.subject}`);
    logEmailEvent('INFO', `Invoking sendEmail to: ${interviewer.email}`);
    sendEmail([interviewer.email], emailData.subject, emailData.html);
  } catch (error: any) {
    logEmailEvent('ERROR', `Error triggering interview assignment email:`, error.message || error);
  }
}



