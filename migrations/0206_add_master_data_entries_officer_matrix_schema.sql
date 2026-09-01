-- Restore the current master_data_entries schema objects identified by the
-- migration parity proof.

ALTER TABLE public.master_data_entries
  ADD COLUMN IF NOT EXISTS "officerMatrixLabel" TEXT;

CREATE INDEX IF NOT EXISTS idx_master_data_entries_master_id
  ON public.master_data_entries USING btree (master_id);