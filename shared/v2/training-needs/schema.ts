import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const trainingNeedsOtherV2 = pgTable("training_needs_other_v2", {
  id: serial("id").primaryKey(),
  tnoUuid: text("tno_uuid").notNull().unique(),
  sourceLabel: text("source_label").notNull().default("Others"),
  crewMemberId: text("crew_member_id"),
  name: text("name"),
  rank: text("rank"),
  rankId: text("rank_id"),
  training: text("training"),
  correspondingInDb: text("corresponding_in_db"),
  identifiedBy: text("identified_by"),
  category: text("category"),
  status: text("status"),
  targetDate: text("target_date"),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
});

export const insertTrainingNeedOtherSchema = createInsertSchema(trainingNeedsOtherV2).omit({
  id: true,
  tnoUuid: true,
  createdAt: true,
  updatedAt: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export type InsertTrainingNeedOther = z.infer<typeof insertTrainingNeedOtherSchema>;
export type TrainingNeedOther = typeof trainingNeedsOtherV2.$inferSelect;
