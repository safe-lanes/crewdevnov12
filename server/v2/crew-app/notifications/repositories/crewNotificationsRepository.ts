import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../../db";
import { appCrewNotifications } from "../../../../../shared/v2/crew-app/schema";
import type { AppCrewNotification } from "../../../../../shared/v2/crew-app/types";

export interface NewNotification {
  domain: string;
  crewUuid: string;
  notificationType: string;
  title: string;
  body?: string | null;
  sourceRefUuid?: string | null;
  dedupeKey: string;
}

export class CrewNotificationsRepository {
  async listForCrew(crewUuid: string, domain: string): Promise<AppCrewNotification[]> {
    const db = getDb();
    return db
      .select()
      .from(appCrewNotifications)
      .where(
        and(
          eq(appCrewNotifications.crewUuid, crewUuid),
          eq(appCrewNotifications.domain, domain),
          eq(appCrewNotifications.isDeleted, false),
        ),
      )
      .orderBy(desc(appCrewNotifications.createdAt));
  }

  async unreadCountForCrew(crewUuid: string, domain: string): Promise<number> {
    const db = getDb();
    const results = await db
      .select()
      .from(appCrewNotifications)
      .where(
        and(
          eq(appCrewNotifications.crewUuid, crewUuid),
          eq(appCrewNotifications.domain, domain),
          eq(appCrewNotifications.isRead, false),
          eq(appCrewNotifications.isDeleted, false),
        ),
      );
    return results.length;
  }

  /** Scoped to crewUuid so a caller can't mark someone else's notification read. */
  async markRead(notificationUuid: string, crewUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(appCrewNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(appCrewNotifications.notificationUuid, notificationUuid),
          eq(appCrewNotifications.crewUuid, crewUuid),
        ),
      )
      .returning({ id: appCrewNotifications.id });
    return results.length > 0;
  }

  async markAllRead(crewUuid: string, domain: string): Promise<void> {
    const db = getDb();
    await db
      .update(appCrewNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(appCrewNotifications.crewUuid, crewUuid),
          eq(appCrewNotifications.domain, domain),
          eq(appCrewNotifications.isRead, false),
        ),
      );
  }

  /**
   * Bulk-inserts, silently skipping rows whose dedupe_key already exists —
   * this is the actual dedupe mechanism (relies on the unique index), so
   * callers never need to pre-check which keys already exist.
   */
  async insertManyIfNotExists(rows: NewNotification[]): Promise<number> {
    if (rows.length === 0) return 0;
    const db = getDb();
    const results = await db
      .insert(appCrewNotifications)
      .values(rows.map((r) => ({ ...r, notificationUuid: uuidv4() })))
      .onConflictDoNothing({ target: appCrewNotifications.dedupeKey })
      .returning({ id: appCrewNotifications.id });
    return results.length;
  }
}
