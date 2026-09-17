import { pgTable, serial, text, boolean, integer, timestamp, varchar } from "drizzle-orm/pg-core";

// Duplicated locally rather than imported from crew-pool/schema.ts — this module is
// meant to be fully self-contained (isolated auth system), so it avoids any import
// coupling to other v2 modules. Matches the auditColumns shape used everywhere else.
export const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

export const appCrewCredentials = pgTable("app_crew_credentials", {
  id: serial("id").primaryKey(),
  credentialUuid: text("credential_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  empNo: text("emp_no"),
  mobile: text("mobile"),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  userType: text("user_type").notNull().default("Crew"),
  isActive: boolean("is_active").default(true),
  mustResetPassword: boolean("must_reset_password").default(true),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...auditColumns,
});

export const appCrewRefreshTokens = pgTable("app_crew_refresh_tokens", {
  id: serial("id").primaryKey(),
  refreshTokenUuid: text("refresh_token_uuid").notNull().unique(),
  crewCredentialId: integer("crew_credential_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  deviceId: text("device_id"),
  deviceLabel: text("device_label"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow(),
});

// One flexible row per static page per domain, instead of separate tables for
// About Us / Contact Us / Forum — pageKey distinguishes them.
export const appCrewContentPages = pgTable("app_crew_content_pages", {
  id: serial("id").primaryKey(),
  contentUuid: text("content_uuid").notNull().unique(),
  domain: varchar("domain", { length: 255 }).notNull(),
  pageKey: text("page_key").notNull(),
  title: text("title"),
  bodyHtml: text("body_html"),
  isPublished: boolean("is_published").default(true),
  ...auditColumns,
});

export const appCrewNotices = pgTable("app_crew_notices", {
  id: serial("id").primaryKey(),
  noticeUuid: text("notice_uuid").notNull().unique(),
  domain: varchar("domain", { length: 255 }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...auditColumns,
});

// Covers both "notice published" and "document/visa expiring" notification types.
export const appCrewNotifications = pgTable("app_crew_notifications", {
  id: serial("id").primaryKey(),
  notificationUuid: text("notification_uuid").notNull().unique(),
  domain: varchar("domain", { length: 255 }).notNull(),
  crewUuid: text("crew_uuid").notNull(),
  notificationType: text("notification_type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  sourceRefUuid: text("source_ref_uuid"),
  dedupeKey: text("dedupe_key").notNull().unique(),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  ...auditColumns,
});
