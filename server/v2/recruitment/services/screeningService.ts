import { v4 as uuidv4 } from "uuid";
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

export class ScreeningB1Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB1Initial | undefined> {
    return screeningB1Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB1Initial>, userUuid?: string): Promise<ScreeningB1Initial> {
    return screeningB1Repository.upsert(recCanUuid, {
      b1Uuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getComments(b1Uuid: string) {
    return screeningB1Repository.findComments(b1Uuid);
  }

  async createComment(b1Uuid: string, data: { fieldKey?: string; userUuid?: string; commentText?: string }, userUuid?: string) {
    return screeningB1Repository.createComment({
      commentUuid: uuidv4(),
      b1Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getAttachments(b1Uuid: string) {
    return screeningB1Repository.findAttachments(b1Uuid);
  }

  async createAttachment(b1Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB1Repository.createAttachment({
      attUuid: uuidv4(),
      b1Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }
}

export class ScreeningB2Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB2References | undefined> {
    return screeningB2Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB2References>, userUuid?: string): Promise<ScreeningB2References> {
    return screeningB2Repository.upsert(recCanUuid, {
      b2Uuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getItems(b2Uuid: string) {
    return screeningB2Repository.findItems(b2Uuid);
  }

  async createItem(b2Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB2Repository.createItem({
      refUuid: uuidv4(),
      b2Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }

  async getComments(b2Uuid: string) {
    return screeningB2Repository.findComments(b2Uuid);
  }

  async createComment(b2Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB2Repository.createComment({
      commentUuid: uuidv4(),
      b2Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }

  async getAttachments(b2Uuid: string) {
    return screeningB2Repository.findAttachments(b2Uuid);
  }

  async createAttachment(b2Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB2Repository.createAttachment({
      attUuid: uuidv4(),
      b2Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }
}

export class ScreeningB3Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB3Security | undefined> {
    return screeningB3Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB3Security>, userUuid?: string): Promise<ScreeningB3Security> {
    return screeningB3Repository.upsert(recCanUuid, {
      b3Uuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getAuthorities(b3Uuid: string) {
    return screeningB3Repository.findAuthorities(b3Uuid);
  }

  async createAuthority(b3Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB3Repository.createAuthority({
      authUuid: uuidv4(),
      b3Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }

  async getComments(b3Uuid: string) {
    return screeningB3Repository.findComments(b3Uuid);
  }

  async createComment(b3Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB3Repository.createComment({
      commentUuid: uuidv4(),
      b3Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }

  async getAttachments(b3Uuid: string) {
    return screeningB3Repository.findAttachments(b3Uuid);
  }

  async createAttachment(b3Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB3Repository.createAttachment({
      attUuid: uuidv4(),
      b3Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }
}

export class ScreeningB4Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB4Certificates | undefined> {
    return screeningB4Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB4Certificates>, userUuid?: string): Promise<ScreeningB4Certificates> {
    return screeningB4Repository.upsert(recCanUuid, {
      b4Uuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getCertItems(b4Uuid: string) {
    return screeningB4Repository.findCertItems(b4Uuid);
  }

  async createCertItem(b4Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB4Repository.createCertItem({
      certUuid: uuidv4(),
      b4Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }

  async getComments(b4Uuid: string) {
    return screeningB4Repository.findComments(b4Uuid);
  }

  async createComment(b4Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB4Repository.createComment({
      commentUuid: uuidv4(),
      b4Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }

  async getAttachments(b4Uuid: string) {
    return screeningB4Repository.findAttachments(b4Uuid);
  }

  async createAttachment(b4Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB4Repository.createAttachment({
      attUuid: uuidv4(),
      b4Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }
}

export class ScreeningB5Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB5Tests | undefined> {
    return screeningB5Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB5Tests>, userUuid?: string): Promise<ScreeningB5Tests> {
    return screeningB5Repository.upsert(recCanUuid, {
      b5Uuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getTestItems(b5Uuid: string) {
    return screeningB5Repository.findTestItems(b5Uuid);
  }

  async createTestItem(b5Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB5Repository.createTestItem({
      testUuid: uuidv4(),
      b5Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }

  async getComments(b5Uuid: string) {
    return screeningB5Repository.findComments(b5Uuid);
  }

  async createComment(b5Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB5Repository.createComment({
      commentUuid: uuidv4(),
      b5Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }

  async getAttachments(b5Uuid: string) {
    return screeningB5Repository.findAttachments(b5Uuid);
  }

  async createAttachment(b5Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB5Repository.createAttachment({
      attUuid: uuidv4(),
      b5Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }
}

export class ScreeningB6Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB6Interviews | undefined> {
    return screeningB6Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB6Interviews>, userUuid?: string): Promise<ScreeningB6Interviews> {
    return screeningB6Repository.upsert(recCanUuid, {
      b6Uuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getInterviewItems(b6Uuid: string) {
    return screeningB6Repository.findInterviewItems(b6Uuid);
  }

  async createInterviewItem(b6Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB6Repository.createInterviewItem({
      intUuid: uuidv4(),
      b6Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }

  async getComments(b6Uuid: string) {
    return screeningB6Repository.findComments(b6Uuid);
  }

  async createComment(b6Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB6Repository.createComment({
      commentUuid: uuidv4(),
      b6Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }

  async getAttachments(b6Uuid: string) {
    return screeningB6Repository.findAttachments(b6Uuid);
  }

  async createAttachment(b6Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB6Repository.createAttachment({
      attUuid: uuidv4(),
      b6Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }
}

export class ScreeningB7Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB7Training | undefined> {
    return screeningB7Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB7Training>, userUuid?: string): Promise<ScreeningB7Training> {
    return screeningB7Repository.upsert(recCanUuid, {
      b7Uuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getTrainingItems(b7Uuid: string) {
    return screeningB7Repository.findTrainingItems(b7Uuid);
  }

  async createTrainingItem(b7Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB7Repository.createTrainingItem({
      trainItemUuid: uuidv4(),
      b7Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }
}

export class ScreeningB8Service {
  async getByCandidate(recCanUuid: string): Promise<ScreeningB8Shortlisting | undefined> {
    return screeningB8Repository.findByCandidateUuid(recCanUuid);
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB8Shortlisting>, userUuid?: string): Promise<ScreeningB8Shortlisting> {
    return screeningB8Repository.upsert(recCanUuid, {
      b8Uuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  async getApprovers(b8Uuid: string) {
    return screeningB8Repository.findApprovers(b8Uuid);
  }

  async createApprover(b8Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB8Repository.createApprover({
      approverUuid: uuidv4(),
      b8Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }

  async getComments(b8Uuid: string) {
    return screeningB8Repository.findComments(b8Uuid);
  }

  async createComment(b8Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB8Repository.createComment({
      commentUuid: uuidv4(),
      b8Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
  }

  async getAttachments(b8Uuid: string) {
    return screeningB8Repository.findAttachments(b8Uuid);
  }

  async createAttachment(b8Uuid: string, data: Record<string, unknown>, userUuid?: string) {
    return screeningB8Repository.createAttachment({
      attUuid: uuidv4(),
      b8Uuid,
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    } as any);
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
