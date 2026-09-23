import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  appCrewCredentials,
  appCrewRefreshTokens,
  appCrewContentPages,
  appCrewNotices,
  appCrewNotifications,
  appCrewPendingChanges,
  appCrewAppSettings,
} from "./schema";

// ============================================================================
// APP CREW CREDENTIALS
// ============================================================================

export const insertAppCrewCredentialSchema = createInsertSchema(appCrewCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAppCrewCredential = z.infer<typeof insertAppCrewCredentialSchema>;
export type AppCrewCredential = typeof appCrewCredentials.$inferSelect;

// ============================================================================
// APP CREW REFRESH TOKENS
// ============================================================================

export const insertAppCrewRefreshTokenSchema = createInsertSchema(appCrewRefreshTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertAppCrewRefreshToken = z.infer<typeof insertAppCrewRefreshTokenSchema>;
export type AppCrewRefreshToken = typeof appCrewRefreshTokens.$inferSelect;

// ============================================================================
// REQUEST DTOs (controller-boundary validation — not row-shaped)
// ============================================================================

export const crewLoginRequestSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  domain: z.string().min(1),
  deviceId: z.string().optional(),
  deviceLabel: z.string().optional(),
});
export type CrewLoginRequest = z.infer<typeof crewLoginRequestSchema>;

export const crewRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
  deviceId: z.string().optional(),
});
export type CrewRefreshRequest = z.infer<typeof crewRefreshRequestSchema>;

export const crewLogoutRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
  allDevices: z.boolean().optional(),
});
export type CrewLogoutRequest = z.infer<typeof crewLogoutRequestSchema>;

export const crewSetPasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type CrewSetPasswordRequest = z.infer<typeof crewSetPasswordRequestSchema>;

// ============================================================================
// APP CREW CONTENT PAGES (About Us / Contact Us / Forum)
// ============================================================================

export const contentPageKeySchema = z.enum(["about_us", "contact_us", "forum"]);
export type ContentPageKey = z.infer<typeof contentPageKeySchema>;

export const insertAppCrewContentPageSchema = createInsertSchema(appCrewContentPages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAppCrewContentPage = z.infer<typeof insertAppCrewContentPageSchema>;
export type AppCrewContentPage = typeof appCrewContentPages.$inferSelect;

export const upsertContentPageRequestSchema = z.object({
  title: z.string().min(1),
  bodyHtml: z.string().min(1),
  isPublished: z.boolean().optional(),
});
export type UpsertContentPageRequest = z.infer<typeof upsertContentPageRequestSchema>;

// ============================================================================
// APP CREW NOTICES
// ============================================================================

export const insertAppCrewNoticeSchema = createInsertSchema(appCrewNotices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAppCrewNotice = z.infer<typeof insertAppCrewNoticeSchema>;
export type AppCrewNotice = typeof appCrewNotices.$inferSelect;

export const createNoticeRequestSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  isPublished: z.boolean().optional(),
});
export type CreateNoticeRequest = z.infer<typeof createNoticeRequestSchema>;

export const updateNoticeRequestSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  isPublished: z.boolean().optional(),
});
export type UpdateNoticeRequest = z.infer<typeof updateNoticeRequestSchema>;

// ============================================================================
// APP CREW NOTIFICATIONS
// ============================================================================

export const insertAppCrewNotificationSchema = createInsertSchema(appCrewNotifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAppCrewNotification = z.infer<typeof insertAppCrewNotificationSchema>;
export type AppCrewNotification = typeof appCrewNotifications.$inferSelect;

// ============================================================================
// APP CREW PENDING CHANGES (crew-portal entries awaiting office verification)
// ============================================================================

export const pendingChangeActionSchema = z.enum(["create", "update", "delete"]);
export type PendingChangeAction = z.infer<typeof pendingChangeActionSchema>;

export const pendingChangeStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type PendingChangeStatus = z.infer<typeof pendingChangeStatusSchema>;

export const insertAppCrewPendingChangeSchema = createInsertSchema(appCrewPendingChanges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAppCrewPendingChange = z.infer<typeof insertAppCrewPendingChangeSchema>;
export type AppCrewPendingChange = typeof appCrewPendingChanges.$inferSelect;

export const rejectPendingChangeRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type RejectPendingChangeRequest = z.infer<typeof rejectPendingChangeRequestSchema>;

// ============================================================================
// APP CREW APP SETTINGS (per-tenant crew-app toggles)
// ============================================================================

export const insertAppCrewAppSettingsSchema = createInsertSchema(appCrewAppSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAppCrewAppSettings = z.infer<typeof insertAppCrewAppSettingsSchema>;
export type AppCrewAppSettings = typeof appCrewAppSettings.$inferSelect;
