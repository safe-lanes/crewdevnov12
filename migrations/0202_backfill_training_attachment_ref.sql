-- Backfill existing training records using the requested crew UUID/course name format.
-- Idempotent: existing non-null references (including empty strings) are preserved.
-- A null training_course leaves attachment_ref null under SQL concatenation rules.
UPDATE crew_training_courses
SET attachment_ref = crew_uuid || '-T_' || training_course
WHERE attachment_ref IS NULL;
