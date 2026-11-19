/**
 * In-app approval notifications (table approval_notifications_v2, migration 0273).
 * One row per person. Every read and write is scoped to ONE user_uuid; there is no way to list
 * or mark another person's notifications through this repository.
 */
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";

export const approvalNotificationsV2 = pgTable("approval_notifications_v2", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  anuuid: text("anuuid").notNull().unique(),
  userUuid: text("user_uuid").notNull(),
  kind: text("kind").notNull(),
  requuid: text("requuid").notNull(),
  nodeKey: text("node_key").notNull().default(""),
  moduleId: text("module_id").notNull(),
  screenId: text("screen_id").notNull(),
  actionId: text("action_id").notNull().default(""),
  subjectRef: text("subject_ref").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull().default(""),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ApprovalNotificationKind = "pending" | "approved" | "returned" | "withdrawn";

export interface NewApprovalNotification {
  kind: ApprovalNotificationKind;
  requuid: string;
  nodeKey?: string;
  scope: { moduleId: string; screenId: string; actionId: string };
  subjectRef: string;
  title: string;
  message: string;
  link?: string | null;
}

export interface ApprovalNotificationView {
  anuuid: string;
  kind: string;
  requuid: string;
  moduleId: string;
  screenId: string;
  actionId: string;
  subjectRef: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const MAX_LIST = 50;

/** One row per recipient; the same event never notifies the same person twice. */
export async function insertApprovalNotifications(userUuids: string[], n: NewApprovalNotification): Promise<number> {
  const recipients = Array.from(new Set(userUuids.map((u) => u?.trim()).filter((u): u is string => !!u)));
  if (recipients.length === 0) return 0;
  const rows = recipients.map((userUuid) => ({
    anuuid: randomUUID(),
    userUuid,
    kind: n.kind,
    requuid: n.requuid,
    nodeKey: n.nodeKey ?? "",
    moduleId: n.scope.moduleId,
    screenId: n.scope.screenId,
    actionId: n.scope.actionId,
    subjectRef: n.subjectRef,
    title: n.title,
    message: n.message,
    link: n.link ?? null,
  }));
  const inserted = await getDb()
    .insert(approvalNotificationsV2)
    .values(rows)
    .onConflictDoNothing()
    .returning({ anuuid: approvalNotificationsV2.anuuid });
  return inserted.length;
}

export async function listApprovalNotificationsForUser(userUuid: string, unreadOnly: boolean): Promise<ApprovalNotificationView[]> {
  const where = unreadOnly
    ? and(eq(approvalNotificationsV2.userUuid, userUuid), eq(approvalNotificationsV2.isRead, false))
    : eq(approvalNotificationsV2.userUuid, userUuid);
  const rows = await getDb()
    .select()
    .from(approvalNotificationsV2)
    .where(where)
    .orderBy(desc(approvalNotificationsV2.createdAt))
    .limit(MAX_LIST);
  return rows.map((r: typeof approvalNotificationsV2.$inferSelect) => ({
    anuuid: r.anuuid,
    kind: r.kind,
    requuid: r.requuid,
    moduleId: r.moduleId,
    screenId: r.screenId,
    actionId: r.actionId,
    subjectRef: r.subjectRef,
    title: r.title,
    message: r.message,
    link: r.link,
    isRead: r.isRead,
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt as unknown as string)).toISOString(),
  }));
}

export async function countUnreadApprovalNotifications(userUuid: string): Promise<number> {
  const rows = await getDb()
    .select({ n: count() })
    .from(approvalNotificationsV2)
    .where(and(eq(approvalNotificationsV2.userUuid, userUuid), eq(approvalNotificationsV2.isRead, false)));
  return Number(rows[0]?.n ?? 0);
}

/** Marks the given notifications read — only those that belong to userUuid. Returns how many changed. */
export async function markApprovalNotificationsRead(userUuid: string, anuuids: string[] | "all"): Promise<number> {
  const mine = eq(approvalNotificationsV2.userUuid, userUuid);
  const unread = eq(approvalNotificationsV2.isRead, false);
  const where = anuuids === "all"
    ? and(mine, unread)
    : anuuids.length === 0 ? null : and(mine, unread, inArray(approvalNotificationsV2.anuuid, anuuids));
  if (!where) return 0;
  const updated = await getDb()
    .update(approvalNotificationsV2)
    .set({ isRead: true, readAt: new Date() })
    .where(where)
    .returning({ anuuid: approvalNotificationsV2.anuuid });
  return updated.length;
}
