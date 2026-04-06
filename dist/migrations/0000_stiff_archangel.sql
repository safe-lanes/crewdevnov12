CREATE TABLE "appraisal_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"crew_member_id" text NOT NULL,
	"form_id" integer NOT NULL,
	"appraisal_type" text NOT NULL,
	"appraisal_date" text NOT NULL,
	"appraisal_data" text NOT NULL,
	"competence_rating" text,
	"behavioral_rating" text,
	"overall_rating" text,
	"submitted_at" timestamp DEFAULT now(),
	"submitted_by" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"stage_statuses" text,
	"stage_payloads" text
);
--> statement-breakpoint
CREATE TABLE "available_ranks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"rank_id" text,
	"label" text,
	"applicable_to_company" boolean,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "company_ranks" (
	"id" text PRIMARY KEY NOT NULL,
	"rank" text NOT NULL,
	"rank_id" text NOT NULL,
	"role" text,
	"original_rank_id" text,
	"is_role_row" boolean DEFAULT false,
	"officer" boolean DEFAULT false,
	"rating" boolean DEFAULT false,
	"senior_officer" boolean DEFAULT false,
	"deck_officer" boolean DEFAULT false,
	"eng_officer" boolean DEFAULT false,
	"petty_officer" boolean DEFAULT false,
	"deck_rating" boolean DEFAULT false,
	"engine_rating" boolean DEFAULT false,
	"general_rating" boolean DEFAULT false,
	"catering_rating" boolean DEFAULT false,
	"safety_officer" boolean DEFAULT false,
	"sso" boolean DEFAULT false,
	"medical_officer" boolean DEFAULT false,
	"navigating_officer" boolean DEFAULT false,
	"emt_officer" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crew_members" (
	"id" text PRIMARY KEY NOT NULL,
	"emp_no" text,
	"first_name" text NOT NULL,
	"middle_name" text,
	"family_name" text,
	"date_of_birth" text,
	"age" text,
	"nationality" text NOT NULL,
	"present_rank" text NOT NULL,
	"rank_applied_for" text,
	"employee_id" text,
	"present_vessel" text NOT NULL,
	"vessel_type" text NOT NULL,
	"last_vessel" text,
	"status" text,
	"joining_date" text,
	"sign_on_date" text,
	"sign_off_date" text,
	"contract_period" text,
	"relief_due" text,
	"reason" text,
	"availability" text,
	"email" text,
	"mobile" text,
	"contact_landline" text,
	"country_of_residence" text,
	"nearest_airport" text,
	"residential_address_line1" text,
	"residential_address_line2" text,
	"place_of_birth_city" text,
	"place_of_birth_country" text,
	"height_cm" text,
	"weight_kg" text,
	"bmi" text,
	"native_language" text,
	"foreign_languages" text,
	"english_proficiency" text,
	"marital_status" text,
	"number_of_dependent_children" text,
	"father_name" text,
	"mother_name" text,
	"spouse_first_name" text,
	"spouse_middle_name" text,
	"spouse_family_name" text,
	"spouse_date_of_birth" text,
	"nok_first_name" text,
	"nok_middle_name" text,
	"nok_family_name" text,
	"nok_telephone" text,
	"nok_email" text,
	"nok_address" text,
	"nok_relationship" text,
	"manning_agent" text,
	"vessel_types" text,
	"documents" text,
	"visas" text,
	"education" text,
	"licenses" text,
	"training_courses" text,
	"current_company_sea_service" text,
	"external_sea_service" text,
	"pre_joining_medicals" text,
	"doctor_visits" text,
	"children" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_masters" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "drug_alcohol_test_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" text NOT NULL,
	"test_type" text NOT NULL,
	"alcohol_drug_type" text,
	"place_location" text,
	"date_time_test_completed" text,
	"external_test_results_date" text,
	"incident_id" text,
	"testing_equipment" text,
	"equipment_not_applicable" boolean DEFAULT false,
	"test_history" text,
	"frequency_months" integer DEFAULT 12 NOT NULL,
	"planned_port" text,
	"planned_date" text,
	"planned_comments" text,
	"incident_title" text,
	"incident_date_time" text,
	"alcohol_test_date_time" text,
	"drug_test_date_time" text,
	"violations" integer DEFAULT 0,
	"test_date_time" text,
	"other_test_type" text,
	"reason_for_testing" text,
	"description" text,
	"initiated_by" text,
	"personnel_tested" text,
	"comments" text,
	"master_deputy_signature" text,
	"attachment_file" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fixed_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"crew_member_id" text NOT NULL,
	"vessel_id" text NOT NULL,
	"rank" text NOT NULL,
	"name" text NOT NULL,
	"month_year" text NOT NULL,
	"sea_hours" text NOT NULL,
	"port_hours" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'appraisal' NOT NULL,
	"rank_group" text NOT NULL,
	"version_no" text NOT NULL,
	"version_date" text NOT NULL,
	"configuration" text
);
--> statement-breakpoint
CREATE TABLE "id_counters" (
	"id" serial PRIMARY KEY NOT NULL,
	"counter_type" text NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"prefix" text NOT NULL,
	"format" text DEFAULT '000000' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "id_counters_counter_type_unique" UNIQUE("counter_type")
);
--> statement-breakpoint
CREATE TABLE "master_data_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"master_id" text NOT NULL,
	"entry_id" text NOT NULL,
	"nuid" text,
	"name" text NOT NULL,
	"description" text,
	"countryName" text,
	"country" text,
	"cid" text,
	"countryCode" text,
	"nationality" text,
	"countryRefId" text,
	"vtuid" text,
	"vesselType" text,
	"tanker" boolean DEFAULT false,
	"oilTanker" boolean DEFAULT false,
	"gasTanker" boolean DEFAULT false,
	"chemicalTanker" boolean DEFAULT false,
	"bulk" boolean DEFAULT false,
	"isActive" boolean DEFAULT true,
	"isDeleted" boolean DEFAULT false,
	"createdBy" text,
	"domain" text,
	"orderBy" integer,
	"fuid" text,
	"managerId" text,
	"aguid" text,
	"userId" text,
	"vesselIds" text,
	"vouid" text,
	"address" text,
	"email" text,
	"phone" text,
	"company" text,
	"nameOfContactPerson" text,
	"duid" text,
	"shortCode" text,
	"type" text,
	"department" text,
	"uuid" text,
	"lastname" text,
	"firstname" text,
	"addressLine1" text,
	"addressLine2" text,
	"addressLine3" text,
	"city" text,
	"state" text,
	"zipcode" text,
	"loginId" text,
	"roleId" text,
	"designationId" text,
	"profilePic" text,
	"userType" text,
	"departmentId" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "nc_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"crew_member_id" text NOT NULL,
	"vessel_id" text NOT NULL,
	"rank" text NOT NULL,
	"month_value" text NOT NULL,
	"nc_reference" text DEFAULT 'STCW/MLC/ILO' NOT NULL,
	"identified_root_cause" text,
	"immediate_corrective_action" text,
	"preventive_action" text,
	"preventive_action_status" text DEFAULT 'Pending' NOT NULL,
	"preventive_action_due_date" timestamp,
	"preventive_action_date_completed" timestamp,
	"office_closure_verified_by_name" text,
	"office_closure_verified_by_position" text,
	"office_closure_date" timestamp,
	"status" text DEFAULT 'Open' NOT NULL,
	"submission_status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "office_violation_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" text NOT NULL,
	"month_value" text NOT NULL,
	"comment" text,
	"reviewer_name" text,
	"reviewer_position" text,
	"review_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promotion_hierarchies" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_name" text NOT NULL,
	"rank_path" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rank_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_id" integer NOT NULL,
	"name" text NOT NULL,
	"ranks" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruitment_candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"file_no" text NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"family_name" text NOT NULL,
	"dob" text NOT NULL,
	"nationality" text NOT NULL,
	"rank_applied_for" text NOT NULL,
	"present_rank" text NOT NULL,
	"vessel_type" text NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"application_data" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "recruitment_candidates_file_no_unique" UNIQUE("file_no")
);
--> statement-breakpoint
CREATE TABLE "rest_hours_crew_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" text NOT NULL,
	"vessel_name" text NOT NULL,
	"crew_member_id" text NOT NULL,
	"rank" text NOT NULL,
	"name" text NOT NULL,
	"month" text NOT NULL,
	"month_value" text NOT NULL,
	"sign_on_off_info" text,
	"recording_status_percent" integer DEFAULT 0 NOT NULL,
	"activity_conflicting" boolean DEFAULT false NOT NULL,
	"total_violations" integer DEFAULT 0 NOT NULL,
	"total_ncs" integer DEFAULT 0 NOT NULL,
	"predicted_violations" integer DEFAULT 0 NOT NULL,
	"predicted_ncs" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rest_hours_daily_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"crew_member_id" text NOT NULL,
	"vessel_id" text NOT NULL,
	"rank" text NOT NULL,
	"name" text NOT NULL,
	"month_year" text NOT NULL,
	"daily_records" text NOT NULL,
	"show_planning" boolean DEFAULT false,
	"opa_mode" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rest_hours_vessel_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" text NOT NULL,
	"vessel_name" text NOT NULL,
	"month" text NOT NULL,
	"month_value" text NOT NULL,
	"total_crew" integer DEFAULT 0 NOT NULL,
	"recording_status_percent" integer DEFAULT 0 NOT NULL,
	"activity_conflicting" boolean DEFAULT false NOT NULL,
	"crew_with_activity_conflicts" integer DEFAULT 0 NOT NULL,
	"crew_with_activity_conflicts_details" text,
	"total_violations" integer DEFAULT 0 NOT NULL,
	"crew_with_violations" integer DEFAULT 0 NOT NULL,
	"crew_with_violations_details" text,
	"total_ncs" integer DEFAULT 0 NOT NULL,
	"crew_with_ncs" integer DEFAULT 0 NOT NULL,
	"crew_with_ncs_details" text,
	"predicted_violations" integer DEFAULT 0 NOT NULL,
	"crew_with_predicted_violations" integer DEFAULT 0 NOT NULL,
	"crew_with_predicted_violations_details" text,
	"predicted_ncs" integer DEFAULT 0 NOT NULL,
	"crew_with_predicted_ncs" integer DEFAULT 0 NOT NULL,
	"crew_with_predicted_ncs_details" text,
	"vessel_review_status" text DEFAULT 'Due' NOT NULL,
	"vessel_review_submitted_date" timestamp,
	"office_review_status" text DEFAULT 'Due' NOT NULL,
	"office_review_submitted_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" integer NOT NULL,
	"revision_no" text NOT NULL,
	"flex_date" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rotation_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"last_edited" text NOT NULL,
	"vessels" text NOT NULL,
	"crew" text NOT NULL,
	"plan_from_date" text NOT NULL,
	"plan_to_date" text NOT NULL,
	"created_by" text NOT NULL,
	"plan_status" text DEFAULT 'In Draft' NOT NULL,
	"proposed_by" text,
	"proposed_date" text,
	"assignments" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "seafarers" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"last_name" text NOT NULL,
	"rank" text NOT NULL,
	"nationality" text NOT NULL,
	"status" text DEFAULT 'Available' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variable_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"start_date_time" text NOT NULL,
	"finish_date_time" text NOT NULL,
	"start_date_time_sort" text NOT NULL,
	"finish_date_time_sort" text NOT NULL,
	"task" text NOT NULL,
	"status" text NOT NULL,
	"crew_involved" integer NOT NULL,
	"remarks" text,
	"period_value" text,
	"vessel_id" text,
	"is_draft" boolean DEFAULT true NOT NULL,
	"record_type" text NOT NULL,
	"status_type" text NOT NULL,
	"selected_tasks" text,
	"other_task" text,
	"crew_involved_details" text,
	"comments" text
);
--> statement-breakpoint
CREATE TABLE "vessel_dateline_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" text NOT NULL,
	"month_value" text NOT NULL,
	"adjustments" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessel_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" text NOT NULL,
	"revision" text DEFAULT 'R1' NOT NULL,
	"draft_data" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessel_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"vessel_ids" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessel_planning" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" text NOT NULL,
	"rank_id" text NOT NULL,
	"rank" text NOT NULL,
	"crew_member_id" text,
	"on_board_crew_id" text,
	"on_board_crew_name" text,
	"on_board_crew_nationality" text,
	"relief_due" text,
	"sign_off_date" text,
	"sign_off_port" text,
	"relief_status" text,
	"reliever_crew_id" text,
	"reliever_crew_name" text,
	"reliever_nationality" text,
	"joining_date" text,
	"joining_port" text,
	"joining_status" text,
	"contract_period_months" integer,
	"contract_end_range_start_months" integer,
	"contract_end_range_end_months" integer,
	"deployment_checklist_completed" boolean,
	"applicable_docs_checked" boolean,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessel_ranks" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" integer NOT NULL,
	"revision_id" integer NOT NULL,
	"rank" text NOT NULL,
	"rank_id" text NOT NULL,
	"role" text,
	"original_rank_id" text,
	"is_role_row" boolean DEFAULT false,
	"officer" boolean DEFAULT false,
	"rating" boolean DEFAULT false,
	"senior_officer" boolean DEFAULT false,
	"deck_officer" boolean DEFAULT false,
	"eng_officer" boolean DEFAULT false,
	"petty_officer" boolean DEFAULT false,
	"deck_rating" boolean DEFAULT false,
	"engine_rating" boolean DEFAULT false,
	"general_rating" boolean DEFAULT false,
	"catering_rating" boolean DEFAULT false,
	"safety_officer" boolean DEFAULT false,
	"sso" boolean DEFAULT false,
	"medical_officer" boolean DEFAULT false,
	"navigating_officer" boolean DEFAULT false,
	"emt_officer" boolean DEFAULT false,
	"actual_manning" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessel_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" text NOT NULL,
	"revision" text NOT NULL,
	"revision_date" text NOT NULL,
	"revision_data" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessel_violation_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" text NOT NULL,
	"month_value" text NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"vessel_group" text,
	"vessel_type" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "appraisal_results" ADD CONSTRAINT "appraisal_results_crew_member_id_crew_members_id_fk" FOREIGN KEY ("crew_member_id") REFERENCES "public"."crew_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appraisal_results" ADD CONSTRAINT "appraisal_results_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_data_entries" ADD CONSTRAINT "master_data_entries_master_id_data_masters_id_fk" FOREIGN KEY ("master_id") REFERENCES "public"."data_masters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_groups" ADD CONSTRAINT "rank_groups_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_ranks" ADD CONSTRAINT "vessel_ranks_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_ranks" ADD CONSTRAINT "vessel_ranks_revision_id_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."revisions"("id") ON DELETE no action ON UPDATE no action;