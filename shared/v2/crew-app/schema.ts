import { pgTable, serial, text, boolean, integer, timestamp, varchar, uniqueIndex } from "drizzle-orm/pg-core";

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
  provisioningStatus: text("provisioning_status").notNull().default("pending"),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  lastError: text("last_error"),
  temporaryPasswordConsumedAt: timestamp("temporary_password_consumed_at", { withTimezone: true }),
  provisioningOperationUuid: text("provisioning_operation_uuid"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecretCiphertext: text("mfa_secret_ciphertext"),
  mfaSecretNonce: text("mfa_secret_nonce"),
  mfaRecoveryCodeHashes: text("mfa_recovery_code_hashes").notNull().default("[]"),
  mfaEnrolledAt: timestamp("mfa_enrolled_at", { withTimezone: true }),
  sessionVersion: integer("session_version").notNull().default(0),
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

// One row per section/collection edit a crew member submits via the app.
// Canonical crew-pool tables (crewDocuments, crewVisas, crew profile
// singletons, etc.) are only ever written to by the office-side "apply" step
// once a row here is approved — every other module in the app keeps reading
// those canonical tables exactly as before, unaware this table exists.
export const appCrewPendingChanges = pgTable("app_crew_pending_changes", {
  id: serial("id").primaryKey(),
  pendingUuid: text("pending_uuid").notNull().unique(),
  operationUuid: text("operation_uuid").notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  crewUuid: text("crew_uuid").notNull(),
  // Matches the section/collection keys already used in
  // crew-information/controller.ts (particulars, personal, ..., documents, visas, ...).
  section: text("section").notNull(),
  action: text("action").notNull(), // 'create' | 'update' | 'delete'
  targetUuid: text("target_uuid"), // existing canonical record uuid; null for 'create'
  payload: text("payload").notNull().default("{}"), // JSON string of the validated crew-submitted body
  // JSON string array of {fileName, filePath, fileType, fileSize} — files a
  // crew member attached while building a still-pending 'create'. Linked into
  // the canonical record's attachments only once the create is approved.
  stagedAttachments: text("staged_attachments").notNull().default("[]"),
  status: text("status").notNull().default("pending"),
  reviewedByUuid: text("reviewed_by_uuid"),
  reviewedByName: text("reviewed_by_name"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  ...auditColumns,
}, (table) => ({
  tenantCrewOperationUnique: uniqueIndex("app_crew_pending_tenant_crew_operation_uq")
    .on(table.domain, table.crewUuid, table.operationUuid),
}));

/** Immutable reviewer decisions. A pending change can have only one terminal decision. */
export const appCrewPendingReviews = pgTable("app_crew_pending_reviews", {
  id: serial("id").primaryKey(),
  reviewUuid: text("review_uuid").notNull().unique(),
  pendingUuid: text("pending_uuid").notNull().unique(),
  decision: text("decision").notNull(),
  reviewerUuid: text("reviewer_uuid").notNull(),
  reviewerName: text("reviewer_name"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Durable command boundary between mobile approval and authoritative ERP mutation. */
export const appCrewErpCommands = pgTable("app_crew_erp_commands", {
  id: serial("id").primaryKey(),
  commandUuid: text("command_uuid").notNull().unique(),
  pendingUuid: text("pending_uuid").notNull().unique(),
  operationUuid: text("operation_uuid").notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  crewUuid: text("crew_uuid").notNull(),
  commandType: text("command_type").notNull(),
  status: text("status").notNull().default("queued"),
  attemptCount: integer("attempt_count").notNull().default(0),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  resultJson: text("result_json"),
  errorCode: text("error_code"),
  lastErrorSummary: text("last_error_summary"),
  authoritativeRecordUuid: text("authoritative_record_uuid"),
  authoritativeResultHash: text("authoritative_result_hash"),
  approvedPayloadHash: text("approved_payload_hash"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const appCrewErpCommandAudits = pgTable("app_crew_erp_command_audits", {
  id: serial("id").primaryKey(), auditUuid: text("audit_uuid").notNull().unique(),
  commandUuid: text("command_uuid").notNull(), operatorUuid: text("operator_uuid").notNull(),
  previousStatus: text("previous_status").notNull(), newStatus: text("new_status").notNull(),
  decision: text("decision").notNull(), reason: text("reason").notNull(),
  correlationId: text("correlation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appCrewPrivacyRequests = pgTable("app_crew_privacy_requests", {
  id: serial("id").primaryKey(),
  requestUuid: text("request_uuid").notNull().unique(),
  domain: varchar("domain", { length: 255 }).notNull(),
  crewUuid: text("crew_uuid").notNull(),
  requestType: text("request_type").notNull(),
  status: text("status").notNull().default("submitted"),
  reason: text("reason"),
  legalHold: boolean("legal_hold").notNull().default(false),
  resolutionNotes: text("resolution_notes"),
  evidenceReference: text("evidence_reference"),
  correlationId: text("correlation_id"),
  identityVerifiedAt: timestamp("identity_verified_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewerId: text("reviewer_id"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const appCrewPrivacyRequestAudits = pgTable("app_crew_privacy_request_audits", {
  id: serial("id").primaryKey(), auditUuid: text("audit_uuid").notNull().unique(),
  requestUuid: text("request_uuid").notNull(), actorUuid: text("actor_uuid").notNull(),
  previousStatus: text("previous_status").notNull(), newStatus: text("new_status").notNull(),
  action: text("action").notNull(), reason: text("reason").notNull(), correlationId: text("correlation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per tenant domain. Absence of a row means the default (gate ON)
// applies — see pendingChangesService.isVerificationRequired(). This is the
// only per-client flexibility knob requirement 1 needs: a client that wants
// crew entries to publish immediately just gets this row set to false, no
// code change.
export const appCrewAppSettings = pgTable("app_crew_app_settings", {
  id: serial("id").primaryKey(),
  settingUuid: text("setting_uuid").notNull().unique(),
  domain: varchar("domain", { length: 255 }).notNull().unique(),
  requireOfficeVerification: boolean("require_office_verification").notNull().default(true),
  ...auditColumns,
});
