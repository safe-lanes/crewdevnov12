ALTER TABLE adm_forms_v2
  ADD COLUMN description TEXT,
  ADD COLUMN archived_at TIMESTAMP;

CREATE UNIQUE INDEX uq_adm_forms_v2_active_dynamic_name
  ON adm_forms_v2 (lower(trim(name)))
  WHERE category = 'dynamic' AND archived_at IS NULL;