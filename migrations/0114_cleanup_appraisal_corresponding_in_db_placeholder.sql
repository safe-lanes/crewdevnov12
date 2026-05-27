-- Clean up legacy placeholder string in appraisal training follow-ups.
-- Saved rows previously stored the literal "Select Training from DB"
-- as a placeholder; that's no longer a valid value now that the cell
-- is a dropdown sourced from the company training catalogue.
-- Idempotent: re-running has no effect once the rows are cleaned.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.tables
     WHERE table_name = 'appr_training_followups_v2'
  ) THEN
    UPDATE appr_training_followups_v2
       SET corresponding_in_db = NULL
     WHERE corresponding_in_db = 'Select Training from DB';
  END IF;
END
$$;
