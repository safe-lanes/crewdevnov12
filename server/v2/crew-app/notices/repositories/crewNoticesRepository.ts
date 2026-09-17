import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../../db";
import { appCrewNotices } from "../../../../../shared/v2/crew-app/schema";
import type { AppCrewNotice, CreateNoticeRequest, UpdateNoticeRequest } from "../../../../../shared/v2/crew-app/types";

export class CrewNoticesRepository {
  async listPublishedByDomain(domain: string): Promise<AppCrewNotice[]> {
    const db = getDb();
    return db
      .select()
      .from(appCrewNotices)
      .where(
        and(
          eq(appCrewNotices.domain, domain),
          eq(appCrewNotices.isPublished, true),
          eq(appCrewNotices.isDeleted, false),
        ),
      )
      .orderBy(desc(appCrewNotices.publishedAt));
  }

  async listAllByDomain(domain: string): Promise<AppCrewNotice[]> {
    const db = getDb();
    return db
      .select()
      .from(appCrewNotices)
      .where(and(eq(appCrewNotices.domain, domain), eq(appCrewNotices.isDeleted, false)))
      .orderBy(desc(appCrewNotices.createdAt));
  }

  async findByUuid(noticeUuid: string, domain: string): Promise<AppCrewNotice | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(appCrewNotices)
      .where(and(eq(appCrewNotices.noticeUuid, noticeUuid), eq(appCrewNotices.domain, domain)))
      .limit(1);
    return results[0];
  }

  async create(domain: string, data: CreateNoticeRequest, adminCrewUuid: string): Promise<AppCrewNotice> {
    const db = getDb();
    const isPublished = data.isPublished ?? false;
    const results = await db
      .insert(appCrewNotices)
      .values({
        noticeUuid: uuidv4(),
        domain,
        title: data.title,
        body: data.body,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        createdByUuid: adminCrewUuid,
        updatedByUuid: adminCrewUuid,
      })
      .returning();
    return results[0];
  }

  /** Returns the updated row, and whether this update is what newly published it. */
  async update(
    noticeUuid: string,
    domain: string,
    data: UpdateNoticeRequest,
    adminCrewUuid: string,
  ): Promise<{ notice: AppCrewNotice; justPublished: boolean } | undefined> {
    const db = getDb();
    const existing = await this.findByUuid(noticeUuid, domain);
    if (!existing) return undefined;

    const justPublished = data.isPublished === true && existing.isPublished !== true;

    const results = await db
      .update(appCrewNotices)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
        ...(justPublished ? { publishedAt: new Date() } : {}),
        updatedByUuid: adminCrewUuid,
      })
      .where(and(eq(appCrewNotices.noticeUuid, noticeUuid), eq(appCrewNotices.domain, domain)))
      .returning();

    return { notice: results[0], justPublished };
  }

  async softDelete(noticeUuid: string, domain: string, adminCrewUuid: string): Promise<void> {
    const db = getDb();
    await db
      .update(appCrewNotices)
      .set({ isDeleted: true, updatedByUuid: adminCrewUuid })
      .where(and(eq(appCrewNotices.noticeUuid, noticeUuid), eq(appCrewNotices.domain, domain)));
  }
}
