-- 0176_add_attachment_ref.sql
-- Adds a nullable attachment_ref column to the crew record tables so the bulk
-- ZIP attachment import can link an uploaded file to the exact record within a
-- crew. The ref is generated in the import template (folder-per-ref in the ZIP)
-- and must be unique within a crew across all attachment-bearing sheets.
-- Idempotent: safe to re-run per tenant.

ALTER TABLE crew_documents ADD COLUMN IF NOT EXISTS attachment_ref text;
ALTER TABLE crew_visas ADD COLUMN IF NOT EXISTS attachment_ref text;
ALTER TABLE crew_licenses ADD COLUMN IF NOT EXISTS attachment_ref text;
ALTER TABLE crew_sea_service ADD COLUMN IF NOT EXISTS attachment_ref text;
ALTER TABLE crew_training_courses ADD COLUMN IF NOT EXISTS attachment_ref text;
ALTER TABLE crew_education ADD COLUMN IF NOT EXISTS attachment_ref text;
ALTER TABLE crew_pre_joining_medicals ADD COLUMN IF NOT EXISTS attachment_ref text;
ALTER TABLE crew_doctor_visits ADD COLUMN IF NOT EXISTS attachment_ref text;
ALTER TABLE crew_briefings ADD COLUMN IF NOT EXISTS attachment_ref text;
ALTER TABLE crew_debriefings ADD COLUMN IF NOT EXISTS attachment_ref text;
