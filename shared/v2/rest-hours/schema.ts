import { pgTable, serial, text, boolean, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

// ============================================
// STANDARD AUDIT COLUMNS (add to ALL tables)
// ============================================
export const auditColumns = {
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

// ============================================
// TABLE 1: VESSEL RECORDS
// ============================================
export const rhVesselRecordsV2 = pgTable("rh_vessel_records_v2", {
  id: serial("id").primaryKey(),
  rhVesselUuid: text("rh_vessel_uuid").notNull().unique(),
  vesselId: text("vessel_id").notNull(),
  month: text("month").notNull(),
  monthValue: text("month_value").notNull(),
  totalCrew: integer("total_crew").notNull().default(0),
  recordingStatusPercent: integer("recording_status_percent").notNull().default(0),
  activityConflicting: boolean("activity_conflicting").notNull().default(false),
  crewWithActivityConflicts: integer("crew_with_activity_conflicts").notNull().default(0),
  crewWithActivityConflictsDetails: text("crew_with_activity_conflicts_details"),
  totalViolations: integer("total_violations").notNull().default(0),
  crewWithViolations: integer("crew_with_violations").notNull().default(0),
  crewWithViolationsDetails: text("crew_with_violations_details"),
  totalNCs: integer("total_ncs").notNull().default(0),
  crewWithNCs: integer("crew_with_ncs").notNull().default(0),
  crewWithNCsDetails: text("crew_with_ncs_details"),
  predictedViolations: integer("predicted_violations").notNull().default(0),
  crewWithPredictedViolations: integer("crew_with_predicted_violations").notNull().default(0),
  crewWithPredictedViolationsDetails: text("crew_with_predicted_violations_details"),
  predictedNCs: integer("predicted_ncs").notNull().default(0),
  crewWithPredictedNCs: integer("crew_with_predicted_ncs").notNull().default(0),
  crewWithPredictedNCsDetails: text("crew_with_predicted_ncs_details"),
  vesselReviewStatus: text("vessel_review_status").notNull().default("Due"),
  vesselReviewSubmittedDate: timestamp("vessel_review_submitted_date"),
  officeReviewStatus: text("office_review_status").notNull().default("Due"),
  officeReviewSubmittedDate: timestamp("office_review_submitted_date"),
  isLocked: boolean("is_locked").notNull().default(false),
  ...auditColumns,
});

// ============================================
// TABLE 2: CREW RECORDS
// ============================================
export const rhCrewRecordsV2 = pgTable("rh_crew_records_v2", {
  id: serial("id").primaryKey(),
  rhCrewRecordUuid: text("rh_crew_record_uuid").notNull().unique(),
  vesselId: text("vessel_id").notNull(),
  crewMemberId: text("crew_member_id").notNull(),
  rank: text("rank").notNull(),
  name: text("name").notNull(),
  month: text("month").notNull(),
  monthValue: text("month_value").notNull(),
  signOnOffInfo: text("sign_on_off_info"),
  recordingStatusPercent: integer("recording_status_percent").notNull().default(0),
  activityConflicting: boolean("activity_conflicting").notNull().default(false),
  totalViolations: integer("total_violations").notNull().default(0),
  totalNCs: integer("total_ncs").notNull().default(0),
  predictedViolations: integer("predicted_violations").notNull().default(0),
  predictedNCs: integer("predicted_ncs").notNull().default(0),
  ...auditColumns,
});

// ============================================
// TABLE 3: DAILY RECORDS
// ============================================
export const rhDailyRecordsV2 = pgTable("rh_daily_records_v2", {
  id: serial("id").primaryKey(),
  rhDailyUuid: text("rh_daily_uuid").notNull().unique(),
  crewMemberId: text("crew_member_id").notNull(),
  vesselId: text("vessel_id").notNull(),
  rank: text("rank").notNull(),
  name: text("name").notNull(),
  monthYear: text("month_year").notNull(),
  dailyRecords: text("daily_records").notNull(),
  showPlanning: boolean("show_planning").default(false),
  opaMode: boolean("opa_mode").default(false),
  watchkeeper: boolean("watchkeeper").default(false),
  // Rank-period applicability window (promotion month). NULL = whole month, so
  // every non-promotion record behaves exactly as before. Days outside
  // [applicableFrom, applicableTo] render as N/A / non-editable for this record.
  applicableFrom: text("applicable_from"),
  applicableTo: text("applicable_to"),
  ...auditColumns,
}, (table) => ({
  uniqueCrewVesselMonth: uniqueIndex("rh_daily_records_v2_unique_idx").on(
    table.crewMemberId,
    table.vesselId,
    table.monthYear,
    table.rank
  ),
}));

// ============================================
// TABLE 4: VESSEL VIOLATION COMMENTS
// ============================================
export const rhVesselViolationCommentsV2 = pgTable("rh_vessel_violation_comments_v2", {
  id: serial("id").primaryKey(),
  vesselCommentUuid: text("vessel_comment_uuid").notNull().unique(),
  vesselId: text("vessel_id").notNull(),
  monthValue: text("month_value").notNull(),
  comment: text("comment"),
  ...auditColumns,
});

// ============================================
// TABLE 5: OFFICE VIOLATION COMMENTS
// ============================================
export const rhOfficeViolationCommentsV2 = pgTable("rh_office_violation_comments_v2", {
  id: serial("id").primaryKey(),
  officeCommentUuid: text("office_comment_uuid").notNull().unique(),
  vesselId: text("vessel_id").notNull(),
  monthValue: text("month_value").notNull(),
  comment: text("comment"),
  reviewerName: text("reviewer_name"),
  reviewerPosition: text("reviewer_position"),
  reviewDate: timestamp("review_date"),
  ...auditColumns,
});

// ============================================
// TABLE 6: NC REPORTS
// ============================================
export const rhNcReportsV2 = pgTable("rh_nc_reports_v2", {
  id: serial("id").primaryKey(),
  ncReportUuid: text("nc_report_uuid").notNull().unique(),
  crewMemberId: text("crew_member_id").notNull(),
  vesselId: text("vessel_id").notNull(),
  rank: text("rank").notNull(),
  monthValue: text("month_value").notNull(),
  ncReference: text("nc_reference").notNull().default("STCW/MLC/ILO"),
  identifiedRootCause: text("identified_root_cause"),
  immediateCorrectiveAction: text("immediate_corrective_action"),
  preventiveAction: text("preventive_action"),
  preventiveActionStatus: text("preventive_action_status").default("Pending"),
  preventiveActionDueDate: timestamp("preventive_action_due_date"),
  preventiveActionDateCompleted: timestamp("preventive_action_date_completed"),
  officeClosureVerifiedByName: text("office_closure_verified_by_name"),
  officeClosureVerifiedByPosition: text("office_closure_verified_by_position"),
  officeClosureDate: timestamp("office_closure_date"),
  status: text("status").default("Open"),
  submissionStatus: text("submission_status").default("draft"),
  ...auditColumns,
});

// ============================================
// TABLE 7: FIXED TASKS
// ============================================
export const rhFixedTasksV2 = pgTable("rh_fixed_tasks_v2", {
  id: serial("id").primaryKey(),
  fixedTaskUuid: text("fixed_task_uuid").notNull().unique(),
  crewMemberId: text("crew_member_id").notNull(),
  vesselId: text("vessel_id").notNull(),
  rank: text("rank").notNull(),
  name: text("name").notNull(),
  monthYear: text("month_year").notNull(),
  seaHours: text("sea_hours").notNull(),
  portHours: text("port_hours").notNull(),
  // Rank-period applicability window (promotion month). NULL = whole month.
  applicableFrom: text("applicable_from"),
  applicableTo: text("applicable_to"),
  // Old-rank fixed-task row is locked read-only once the new-rank row is created.
  isLocked: boolean("is_locked").notNull().default(false),
  ...auditColumns,
});

// ============================================
// TABLE 8: VARIABLE TASKS
// ============================================
export const rhVariableTasksV2 = pgTable("rh_variable_tasks_v2", {
  id: serial("id").primaryKey(),
  variableTaskUuid: text("variable_task_uuid").notNull().unique(),
  startDateTime: text("start_date_time").notNull(),
  finishDateTime: text("finish_date_time").notNull(),
  startDateTimeSort: text("start_date_time_sort").notNull(),
  finishDateTimeSort: text("finish_date_time_sort").notNull(),
  task: text("task").notNull(),
  status: text("status").notNull(),
  crewInvolved: integer("crew_involved").notNull(),
  remarks: text("remarks"),
  periodValue: text("period_value"),
  vesselId: text("vessel_id"),
  isDraft: boolean("is_draft").notNull().default(true),
  recordType: text("record_type").notNull(),
  statusType: text("status_type").notNull(),
  selectedTasks: text("selected_tasks"),
  otherTask: text("other_task"),
  crewInvolvedDetails: text("crew_involved_details"),
  comments: text("comments"),
  ...auditColumns,
});

// ============================================
// TABLE 9: DATELINE ADJUSTMENTS
// ============================================
export const rhDatelineAdjustmentsV2 = pgTable("rh_dateline_adjustments_v2", {
  id: serial("id").primaryKey(),
  adjustmentUuid: text("adjustment_uuid").notNull().unique(),
  vesselId: text("vessel_id").notNull(),
  monthValue: text("month_value").notNull(),
  adjustments: text("adjustments").notNull(),
  ...auditColumns,
});
