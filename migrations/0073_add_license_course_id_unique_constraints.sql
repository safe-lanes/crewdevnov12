-- Add unique constraints on license_id and course_id to prevent duplicate auto-generated IDs
-- This enables retry-on-conflict pattern for concurrent ID generation

-- Add unique constraint on license_id in crew_licenses
-- Only applies to non-deleted records with non-null license_id
CREATE UNIQUE INDEX IF NOT EXISTS crew_licenses_license_id_unique 
ON crew_licenses (license_id) 
WHERE license_id IS NOT NULL AND is_deleted = false;

-- Add unique constraint on course_id in crew_training_courses
-- Only applies to non-deleted records with non-null course_id
CREATE UNIQUE INDEX IF NOT EXISTS crew_training_courses_course_id_unique 
ON crew_training_courses (course_id) 
WHERE course_id IS NOT NULL AND is_deleted = false;
