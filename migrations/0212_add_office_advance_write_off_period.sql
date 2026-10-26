ALTER TABLE acc_advances_v2
  ADD COLUMN IF NOT EXISTS write_off_period text
  CHECK (write_off_period IS NULL OR write_off_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
