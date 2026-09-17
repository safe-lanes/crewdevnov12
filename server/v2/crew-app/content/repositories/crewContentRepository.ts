import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../../db";
import { appCrewContentPages } from "../../../../../shared/v2/crew-app/schema";
import type { AppCrewContentPage } from "../../../../../shared/v2/crew-app/types";

export class CrewContentRepository {
  async findByDomainAndKey(domain: string, pageKey: string): Promise<AppCrewContentPage | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(appCrewContentPages)
      .where(
        and(
          eq(appCrewContentPages.domain, domain),
          eq(appCrewContentPages.pageKey, pageKey),
          eq(appCrewContentPages.isDeleted, false),
        ),
      )
      .limit(1);
    return results[0];
  }

  async listByDomain(domain: string): Promise<AppCrewContentPage[]> {
    const db = getDb();
    return db
      .select()
      .from(appCrewContentPages)
      .where(and(eq(appCrewContentPages.domain, domain), eq(appCrewContentPages.isDeleted, false)));
  }

  async upsert(
    domain: string,
    pageKey: string,
    data: { title: string; bodyHtml: string; isPublished?: boolean },
    auditUserUuid?: string | null,
  ): Promise<AppCrewContentPage> {
    const db = getDb();
    const results = await db
      .insert(appCrewContentPages)
      .values({
        contentUuid: uuidv4(),
        domain,
        pageKey,
        title: data.title,
        bodyHtml: data.bodyHtml,
        isPublished: data.isPublished ?? true,
        createdByUuid: auditUserUuid ?? null,
        updatedByUuid: auditUserUuid ?? null,
      })
      .onConflictDoUpdate({
        target: [appCrewContentPages.domain, appCrewContentPages.pageKey],
        set: {
          title: data.title,
          bodyHtml: data.bodyHtml,
          ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
          updatedByUuid: auditUserUuid ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return results[0];
  }
}
