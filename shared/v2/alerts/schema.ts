import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

export const alertPoliciesV2 = pgTable("alert_policies_v2", {
  id: serial("id").primaryKey(),
  apuuid: text("apuuid").notNull().unique(),
  alertType: text("alert_type").notNull(), // 'visa_expiration' | 'document_expiration' | 'relief_due' | 'appraisal_due'
  enabled: boolean("enabled").notNull().default(true),
  priority: text("priority").notNull().default("medium"), // 'low' | 'medium' | 'high'
  emailEnabled: boolean("email_enabled").notNull().default(false),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  thresholds: text("thresholds").notNull().default("{}"), // JSON string
  scopeFilters: text("scope_filters").notNull().default("{}"), // JSON string
  recipients: text("recipients").notNull().default("{}"), // JSON string
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const alertEventsV2 = pgTable("alert_events_v2", {
  id: serial("id").primaryKey(),
  aeuuid: text("aeuuid").notNull().unique(),
  policyUuid: text("policy_uuid").notNull().references(() => alertPoliciesV2.apuuid),
  alertType: text("alert_type").notNull(),
  priority: text("priority").notNull(),
  objectType: text("object_type"), // 'crew_member' | 'promotion_review' | etc.
  objectId: text("object_id"),
  dedupeKey: text("dedupe_key").notNull(),
  state: text("state"), // 'expiring' | 'expired' | 'due' | etc.
  payload: text("payload").notNull(), // JSON string for alert details
  ackBy: text("ack_by"),
  ackAt: timestamp("ack_at"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const alertDeliveriesV2 = pgTable("alert_deliveries_v2", {
  id: serial("id").primaryKey(),
  eventUuid: text("event_uuid").notNull().references(() => alertEventsV2.aeuuid),
  channel: text("channel").notNull(), // 'in_app' | 'email'
  recipient: text("recipient").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'sent' | 'failed' | 'acknowledged'
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export type AlertPolicyV2 = typeof alertPoliciesV2.$inferSelect;
export type InsertAlertPolicyV2 = typeof alertPoliciesV2.$inferInsert;

export type AlertEventV2 = typeof alertEventsV2.$inferSelect;
export type InsertAlertEventV2 = typeof alertEventsV2.$inferInsert;

export type AlertDeliveryV2 = typeof alertDeliveriesV2.$inferSelect;
export type InsertAlertDeliveryV2 = typeof alertDeliveriesV2.$inferInsert;
