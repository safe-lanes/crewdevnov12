import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import {
  screeningB1Initial,
  screeningB1Comments,
  screeningB1Attachments,
  screeningB2References,
  screeningB2ReferenceItems,
  screeningB2Comments,
  screeningB2Attachments,
  screeningB3Security,
  screeningB3Authorities,
  screeningB3Comments,
  screeningB3Attachments,
  screeningB4Certificates,
  screeningB4CertItems,
  screeningB4Comments,
  screeningB4Attachments,
  screeningB5Tests,
  screeningB5TestItems,
  screeningB5Comments,
  screeningB5Attachments,
  screeningB6Interviews,
  screeningB6InterviewItems,
  screeningB6Comments,
  screeningB6Attachments,
  screeningB7Training,
  screeningB7TrainingItems,
  screeningB8Shortlisting,
  screeningB8SelectedApprovers,
  screeningB8Comments,
  screeningB8Attachments,
} from "../../../../shared/v2/recruitment/schema";
import type {
  ScreeningB1Initial,
  InsertScreeningB1Initial,
  ScreeningB1Comment,
  InsertScreeningB1Comment,
  ScreeningB1Attachment,
  InsertScreeningB1Attachment,
  ScreeningB2References,
  InsertScreeningB2References,
  ScreeningB2ReferenceItem,
  InsertScreeningB2ReferenceItem,
  ScreeningB2Comment,
  InsertScreeningB2Comment,
  ScreeningB2Attachment,
  InsertScreeningB2Attachment,
  ScreeningB3Security,
  InsertScreeningB3Security,
  ScreeningB3Authority,
  InsertScreeningB3Authority,
  ScreeningB3Comment,
  InsertScreeningB3Comment,
  ScreeningB3Attachment,
  InsertScreeningB3Attachment,
  ScreeningB4Certificates,
  InsertScreeningB4Certificates,
  ScreeningB4CertItem,
  InsertScreeningB4CertItem,
  ScreeningB4Comment,
  InsertScreeningB4Comment,
  ScreeningB4Attachment,
  InsertScreeningB4Attachment,
  ScreeningB5Tests,
  InsertScreeningB5Tests,
  ScreeningB5TestItem,
  InsertScreeningB5TestItem,
  ScreeningB5Comment,
  InsertScreeningB5Comment,
  ScreeningB5Attachment,
  InsertScreeningB5Attachment,
  ScreeningB6Interviews,
  InsertScreeningB6Interviews,
  ScreeningB6InterviewItem,
  InsertScreeningB6InterviewItem,
  ScreeningB6Comment,
  InsertScreeningB6Comment,
  ScreeningB6Attachment,
  InsertScreeningB6Attachment,
  ScreeningB7Training,
  InsertScreeningB7Training,
  ScreeningB7TrainingItem,
  InsertScreeningB7TrainingItem,
  ScreeningB8Shortlisting,
  InsertScreeningB8Shortlisting,
  ScreeningB8Approver,
  InsertScreeningB8Approver,
  ScreeningB8Comment,
  InsertScreeningB8Comment,
  ScreeningB8Attachment,
  InsertScreeningB8Attachment,
} from "../../../../shared/v2/recruitment/types";

export class ScreeningB1Repository {
  async findByCandidateUuid(recCanUuid: string): Promise<ScreeningB1Initial | undefined> {
    const db = getDb();
    const results = await db.select().from(screeningB1Initial).where(
      and(eq(screeningB1Initial.recCanUuid, recCanUuid), eq(screeningB1Initial.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertScreeningB1Initial): Promise<ScreeningB1Initial> {
    const db = getDb();
    const results = await db.insert(screeningB1Initial).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertScreeningB1Initial>): Promise<ScreeningB1Initial | undefined> {
    const db = getDb();
    const results = await db.update(screeningB1Initial).set({ ...data, updatedAt: new Date() }).where(eq(screeningB1Initial.id, id)).returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB1Initial>): Promise<ScreeningB1Initial> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertScreeningB1Initial);
  }

  async findComments(b1Uuid: string): Promise<ScreeningB1Comment[]> {
    const db = getDb();
    return db.select().from(screeningB1Comments).where(
      and(eq(screeningB1Comments.b1Uuid, b1Uuid), eq(screeningB1Comments.isDeleted, false))
    );
  }

  async createComment(data: InsertScreeningB1Comment): Promise<ScreeningB1Comment> {
    const db = getDb();
    const results = await db.insert(screeningB1Comments).values(data).returning();
    return results[0];
  }

  async findAttachments(b1Uuid: string): Promise<ScreeningB1Attachment[]> {
    const db = getDb();
    return db.select().from(screeningB1Attachments).where(
      and(eq(screeningB1Attachments.b1Uuid, b1Uuid), eq(screeningB1Attachments.isDeleted, false))
    );
  }

  async createAttachment(data: InsertScreeningB1Attachment): Promise<ScreeningB1Attachment> {
    const db = getDb();
    const results = await db.insert(screeningB1Attachments).values(data).returning();
    return results[0];
  }
}

export class ScreeningB2Repository {
  async findByCandidateUuid(recCanUuid: string): Promise<ScreeningB2References | undefined> {
    const db = getDb();
    const results = await db.select().from(screeningB2References).where(
      and(eq(screeningB2References.recCanUuid, recCanUuid), eq(screeningB2References.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertScreeningB2References): Promise<ScreeningB2References> {
    const db = getDb();
    const results = await db.insert(screeningB2References).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertScreeningB2References>): Promise<ScreeningB2References | undefined> {
    const db = getDb();
    const results = await db.update(screeningB2References).set({ ...data, updatedAt: new Date() }).where(eq(screeningB2References.id, id)).returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB2References>): Promise<ScreeningB2References> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertScreeningB2References);
  }

  async findItems(b2Uuid: string): Promise<ScreeningB2ReferenceItem[]> {
    const db = getDb();
    return db.select().from(screeningB2ReferenceItems).where(
      and(eq(screeningB2ReferenceItems.b2Uuid, b2Uuid), eq(screeningB2ReferenceItems.isDeleted, false))
    );
  }

  async createItem(data: InsertScreeningB2ReferenceItem): Promise<ScreeningB2ReferenceItem> {
    const db = getDb();
    const results = await db.insert(screeningB2ReferenceItems).values(data).returning();
    return results[0];
  }

  async findComments(b2Uuid: string): Promise<ScreeningB2Comment[]> {
    const db = getDb();
    return db.select().from(screeningB2Comments).where(
      and(eq(screeningB2Comments.b2Uuid, b2Uuid), eq(screeningB2Comments.isDeleted, false))
    );
  }

  async createComment(data: InsertScreeningB2Comment): Promise<ScreeningB2Comment> {
    const db = getDb();
    const results = await db.insert(screeningB2Comments).values(data).returning();
    return results[0];
  }

  async findAttachments(b2Uuid: string): Promise<ScreeningB2Attachment[]> {
    const db = getDb();
    return db.select().from(screeningB2Attachments).where(
      and(eq(screeningB2Attachments.b2Uuid, b2Uuid), eq(screeningB2Attachments.isDeleted, false))
    );
  }

  async createAttachment(data: InsertScreeningB2Attachment): Promise<ScreeningB2Attachment> {
    const db = getDb();
    const results = await db.insert(screeningB2Attachments).values(data).returning();
    return results[0];
  }
}

export class ScreeningB3Repository {
  async findByCandidateUuid(recCanUuid: string): Promise<ScreeningB3Security | undefined> {
    const db = getDb();
    const results = await db.select().from(screeningB3Security).where(
      and(eq(screeningB3Security.recCanUuid, recCanUuid), eq(screeningB3Security.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertScreeningB3Security): Promise<ScreeningB3Security> {
    const db = getDb();
    const results = await db.insert(screeningB3Security).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertScreeningB3Security>): Promise<ScreeningB3Security | undefined> {
    const db = getDb();
    const results = await db.update(screeningB3Security).set({ ...data, updatedAt: new Date() }).where(eq(screeningB3Security.id, id)).returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB3Security>): Promise<ScreeningB3Security> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertScreeningB3Security);
  }

  async findAuthorities(b3Uuid: string): Promise<ScreeningB3Authority[]> {
    const db = getDb();
    return db.select().from(screeningB3Authorities).where(
      and(eq(screeningB3Authorities.b3Uuid, b3Uuid), eq(screeningB3Authorities.isDeleted, false))
    );
  }

  async createAuthority(data: InsertScreeningB3Authority): Promise<ScreeningB3Authority> {
    const db = getDb();
    const results = await db.insert(screeningB3Authorities).values(data).returning();
    return results[0];
  }

  async updateAuthority(authUuid: string, data: Partial<InsertScreeningB3Authority>): Promise<ScreeningB3Authority | undefined> {
    const db = getDb();
    const results = await db.update(screeningB3Authorities).set({ ...data, updatedAt: new Date() }).where(eq(screeningB3Authorities.authUuid, authUuid)).returning();
    return results[0];
  }

  async findComments(b3Uuid: string): Promise<ScreeningB3Comment[]> {
    const db = getDb();
    return db.select().from(screeningB3Comments).where(
      and(eq(screeningB3Comments.b3Uuid, b3Uuid), eq(screeningB3Comments.isDeleted, false))
    );
  }

  async createComment(data: InsertScreeningB3Comment): Promise<ScreeningB3Comment> {
    const db = getDb();
    const results = await db.insert(screeningB3Comments).values(data).returning();
    return results[0];
  }

  async findAttachments(b3Uuid: string): Promise<ScreeningB3Attachment[]> {
    const db = getDb();
    return db.select().from(screeningB3Attachments).where(
      and(eq(screeningB3Attachments.b3Uuid, b3Uuid), eq(screeningB3Attachments.isDeleted, false))
    );
  }

  async createAttachment(data: InsertScreeningB3Attachment): Promise<ScreeningB3Attachment> {
    const db = getDb();
    const results = await db.insert(screeningB3Attachments).values(data).returning();
    return results[0];
  }
}

export class ScreeningB4Repository {
  async findByCandidateUuid(recCanUuid: string): Promise<ScreeningB4Certificates | undefined> {
    const db = getDb();
    const results = await db.select().from(screeningB4Certificates).where(
      and(eq(screeningB4Certificates.recCanUuid, recCanUuid), eq(screeningB4Certificates.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertScreeningB4Certificates): Promise<ScreeningB4Certificates> {
    const db = getDb();
    const results = await db.insert(screeningB4Certificates).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertScreeningB4Certificates>): Promise<ScreeningB4Certificates | undefined> {
    const db = getDb();
    const results = await db.update(screeningB4Certificates).set({ ...data, updatedAt: new Date() }).where(eq(screeningB4Certificates.id, id)).returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB4Certificates>): Promise<ScreeningB4Certificates> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertScreeningB4Certificates);
  }

  async findCertItems(b4Uuid: string): Promise<ScreeningB4CertItem[]> {
    const db = getDb();
    return db.select().from(screeningB4CertItems).where(
      and(eq(screeningB4CertItems.b4Uuid, b4Uuid), eq(screeningB4CertItems.isDeleted, false))
    );
  }

  async createCertItem(data: InsertScreeningB4CertItem): Promise<ScreeningB4CertItem> {
    const db = getDb();
    const results = await db.insert(screeningB4CertItems).values(data).returning();
    return results[0];
  }

  async updateCertItem(certUuid: string, data: Partial<InsertScreeningB4CertItem>): Promise<ScreeningB4CertItem | undefined> {
    const db = getDb();
    const results = await db.update(screeningB4CertItems).set({ ...data, updatedAt: new Date() }).where(eq(screeningB4CertItems.certUuid, certUuid)).returning();
    return results[0];
  }

  async findComments(b4Uuid: string): Promise<ScreeningB4Comment[]> {
    const db = getDb();
    return db.select().from(screeningB4Comments).where(
      and(eq(screeningB4Comments.b4Uuid, b4Uuid), eq(screeningB4Comments.isDeleted, false))
    );
  }

  async createComment(data: InsertScreeningB4Comment): Promise<ScreeningB4Comment> {
    const db = getDb();
    const results = await db.insert(screeningB4Comments).values(data).returning();
    return results[0];
  }

  async findAttachments(b4Uuid: string): Promise<ScreeningB4Attachment[]> {
    const db = getDb();
    return db.select().from(screeningB4Attachments).where(
      and(eq(screeningB4Attachments.b4Uuid, b4Uuid), eq(screeningB4Attachments.isDeleted, false))
    );
  }

  async createAttachment(data: InsertScreeningB4Attachment): Promise<ScreeningB4Attachment> {
    const db = getDb();
    const results = await db.insert(screeningB4Attachments).values(data).returning();
    return results[0];
  }
}

export class ScreeningB5Repository {
  async findByCandidateUuid(recCanUuid: string): Promise<ScreeningB5Tests | undefined> {
    const db = getDb();
    const results = await db.select().from(screeningB5Tests).where(
      and(eq(screeningB5Tests.recCanUuid, recCanUuid), eq(screeningB5Tests.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertScreeningB5Tests): Promise<ScreeningB5Tests> {
    const db = getDb();
    const results = await db.insert(screeningB5Tests).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertScreeningB5Tests>): Promise<ScreeningB5Tests | undefined> {
    const db = getDb();
    const results = await db.update(screeningB5Tests).set({ ...data, updatedAt: new Date() }).where(eq(screeningB5Tests.id, id)).returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB5Tests>): Promise<ScreeningB5Tests> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertScreeningB5Tests);
  }

  async findTestItems(b5Uuid: string): Promise<ScreeningB5TestItem[]> {
    const db = getDb();
    return db.select().from(screeningB5TestItems).where(
      and(eq(screeningB5TestItems.b5Uuid, b5Uuid), eq(screeningB5TestItems.isDeleted, false))
    );
  }

  async createTestItem(data: InsertScreeningB5TestItem): Promise<ScreeningB5TestItem> {
    const db = getDb();
    const results = await db.insert(screeningB5TestItems).values(data).returning();
    return results[0];
  }

  async updateTestItem(testUuid: string, data: Partial<InsertScreeningB5TestItem>): Promise<ScreeningB5TestItem | undefined> {
    const db = getDb();
    const results = await db.update(screeningB5TestItems).set({ ...data, updatedAt: new Date() }).where(eq(screeningB5TestItems.testUuid, testUuid)).returning();
    return results[0];
  }

  async findComments(b5Uuid: string): Promise<ScreeningB5Comment[]> {
    const db = getDb();
    return db.select().from(screeningB5Comments).where(
      and(eq(screeningB5Comments.b5Uuid, b5Uuid), eq(screeningB5Comments.isDeleted, false))
    );
  }

  async createComment(data: InsertScreeningB5Comment): Promise<ScreeningB5Comment> {
    const db = getDb();
    const results = await db.insert(screeningB5Comments).values(data).returning();
    return results[0];
  }

  async findAttachments(b5Uuid: string): Promise<ScreeningB5Attachment[]> {
    const db = getDb();
    return db.select().from(screeningB5Attachments).where(
      and(eq(screeningB5Attachments.b5Uuid, b5Uuid), eq(screeningB5Attachments.isDeleted, false))
    );
  }

  async createAttachment(data: InsertScreeningB5Attachment): Promise<ScreeningB5Attachment> {
    const db = getDb();
    const results = await db.insert(screeningB5Attachments).values(data).returning();
    return results[0];
  }
}

export class ScreeningB6Repository {
  async findByCandidateUuid(recCanUuid: string): Promise<ScreeningB6Interviews | undefined> {
    const db = getDb();
    const results = await db.select().from(screeningB6Interviews).where(
      and(eq(screeningB6Interviews.recCanUuid, recCanUuid), eq(screeningB6Interviews.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertScreeningB6Interviews): Promise<ScreeningB6Interviews> {
    const db = getDb();
    const results = await db.insert(screeningB6Interviews).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertScreeningB6Interviews>): Promise<ScreeningB6Interviews | undefined> {
    const db = getDb();
    const results = await db.update(screeningB6Interviews).set({ ...data, updatedAt: new Date() }).where(eq(screeningB6Interviews.id, id)).returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB6Interviews>): Promise<ScreeningB6Interviews> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertScreeningB6Interviews);
  }

  async findInterviewItems(b6Uuid: string): Promise<ScreeningB6InterviewItem[]> {
    const db = getDb();
    return db.select().from(screeningB6InterviewItems).where(
      and(eq(screeningB6InterviewItems.b6Uuid, b6Uuid), eq(screeningB6InterviewItems.isDeleted, false))
    );
  }

  async createInterviewItem(data: InsertScreeningB6InterviewItem): Promise<ScreeningB6InterviewItem> {
    const db = getDb();
    const results = await db.insert(screeningB6InterviewItems).values(data).returning();
    return results[0];
  }

  async updateInterviewItem(intUuid: string, data: Partial<InsertScreeningB6InterviewItem>): Promise<ScreeningB6InterviewItem | undefined> {
    const db = getDb();
    const results = await db.update(screeningB6InterviewItems).set({ ...data, updatedAt: new Date() }).where(eq(screeningB6InterviewItems.intUuid, intUuid)).returning();
    return results[0];
  }

  async findComments(b6Uuid: string): Promise<ScreeningB6Comment[]> {
    const db = getDb();
    return db.select().from(screeningB6Comments).where(
      and(eq(screeningB6Comments.b6Uuid, b6Uuid), eq(screeningB6Comments.isDeleted, false))
    );
  }

  async createComment(data: InsertScreeningB6Comment): Promise<ScreeningB6Comment> {
    const db = getDb();
    const results = await db.insert(screeningB6Comments).values(data).returning();
    return results[0];
  }

  async findAttachments(b6Uuid: string): Promise<ScreeningB6Attachment[]> {
    const db = getDb();
    return db.select().from(screeningB6Attachments).where(
      and(eq(screeningB6Attachments.b6Uuid, b6Uuid), eq(screeningB6Attachments.isDeleted, false))
    );
  }

  async createAttachment(data: InsertScreeningB6Attachment): Promise<ScreeningB6Attachment> {
    const db = getDb();
    const results = await db.insert(screeningB6Attachments).values(data).returning();
    return results[0];
  }
}

export class ScreeningB7Repository {
  async findByCandidateUuid(recCanUuid: string): Promise<ScreeningB7Training | undefined> {
    const db = getDb();
    const results = await db.select().from(screeningB7Training).where(
      and(eq(screeningB7Training.recCanUuid, recCanUuid), eq(screeningB7Training.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertScreeningB7Training): Promise<ScreeningB7Training> {
    const db = getDb();
    const results = await db.insert(screeningB7Training).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertScreeningB7Training>): Promise<ScreeningB7Training | undefined> {
    const db = getDb();
    const results = await db.update(screeningB7Training).set({ ...data, updatedAt: new Date() }).where(eq(screeningB7Training.id, id)).returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB7Training>): Promise<ScreeningB7Training> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertScreeningB7Training);
  }

  async findTrainingItems(b7Uuid: string): Promise<ScreeningB7TrainingItem[]> {
    const db = getDb();
    return db.select().from(screeningB7TrainingItems).where(
      and(eq(screeningB7TrainingItems.b7Uuid, b7Uuid), eq(screeningB7TrainingItems.isDeleted, false))
    );
  }

  async createTrainingItem(data: InsertScreeningB7TrainingItem): Promise<ScreeningB7TrainingItem> {
    const db = getDb();
    const results = await db.insert(screeningB7TrainingItems).values(data).returning();
    return results[0];
  }
}

export class ScreeningB8Repository {
  async findByCandidateUuid(recCanUuid: string): Promise<ScreeningB8Shortlisting | undefined> {
    const db = getDb();
    const results = await db.select().from(screeningB8Shortlisting).where(
      and(eq(screeningB8Shortlisting.recCanUuid, recCanUuid), eq(screeningB8Shortlisting.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertScreeningB8Shortlisting): Promise<ScreeningB8Shortlisting> {
    const db = getDb();
    const results = await db.insert(screeningB8Shortlisting).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertScreeningB8Shortlisting>): Promise<ScreeningB8Shortlisting | undefined> {
    const db = getDb();
    const results = await db.update(screeningB8Shortlisting).set({ ...data, updatedAt: new Date() }).where(eq(screeningB8Shortlisting.id, id)).returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertScreeningB8Shortlisting>): Promise<ScreeningB8Shortlisting> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertScreeningB8Shortlisting);
  }

  async findApprovers(b8Uuid: string): Promise<ScreeningB8Approver[]> {
    const db = getDb();
    return db.select().from(screeningB8SelectedApprovers).where(
      and(eq(screeningB8SelectedApprovers.b8Uuid, b8Uuid), eq(screeningB8SelectedApprovers.isDeleted, false))
    );
  }

  async createApprover(data: InsertScreeningB8Approver): Promise<ScreeningB8Approver> {
    const db = getDb();
    const results = await db.insert(screeningB8SelectedApprovers).values(data).returning();
    return results[0];
  }

  async findComments(b8Uuid: string): Promise<ScreeningB8Comment[]> {
    const db = getDb();
    return db.select().from(screeningB8Comments).where(
      and(eq(screeningB8Comments.b8Uuid, b8Uuid), eq(screeningB8Comments.isDeleted, false))
    );
  }

  async createComment(data: InsertScreeningB8Comment): Promise<ScreeningB8Comment> {
    const db = getDb();
    const results = await db.insert(screeningB8Comments).values(data).returning();
    return results[0];
  }

  async findAttachments(b8Uuid: string): Promise<ScreeningB8Attachment[]> {
    const db = getDb();
    return db.select().from(screeningB8Attachments).where(
      and(eq(screeningB8Attachments.b8Uuid, b8Uuid), eq(screeningB8Attachments.isDeleted, false))
    );
  }

  async createAttachment(data: InsertScreeningB8Attachment): Promise<ScreeningB8Attachment> {
    const db = getDb();
    const results = await db.insert(screeningB8Attachments).values(data).returning();
    return results[0];
  }
}

export const screeningB1Repository = new ScreeningB1Repository();
export const screeningB2Repository = new ScreeningB2Repository();
export const screeningB3Repository = new ScreeningB3Repository();
export const screeningB4Repository = new ScreeningB4Repository();
export const screeningB5Repository = new ScreeningB5Repository();
export const screeningB6Repository = new ScreeningB6Repository();
export const screeningB7Repository = new ScreeningB7Repository();
export const screeningB8Repository = new ScreeningB8Repository();
