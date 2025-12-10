-- Migration: Update English Proficiency values
-- Change 'Excellent' to 'Good' and 'Average' to 'Fair' in crew_members table

UPDATE crew_members 
SET english_proficiency = 'Good' 
WHERE english_proficiency = 'Excellent';

UPDATE crew_members 
SET english_proficiency = 'Fair' 
WHERE english_proficiency = 'Average';

-- Update recruitment_candidates application_data JSON field
UPDATE recruitment_candidates 
SET application_data = jsonb_set(
  application_data::jsonb, 
  '{englishProficiency}', 
  '"Good"'
)
WHERE application_data::json->>'englishProficiency' = 'Excellent';

UPDATE recruitment_candidates 
SET application_data = jsonb_set(
  application_data::jsonb, 
  '{englishProficiency}', 
  '"Fair"'
)
WHERE application_data::json->>'englishProficiency' = 'Average';
