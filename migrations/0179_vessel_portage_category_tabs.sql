-- 0179: Vessel Portage category-major tabs support.
-- 1) acc_monthly_transactions_v2.txn_date (nullable date) — day-level dating
--    for dated vessel entries (cash advances, bond etc.).
-- 2) acc_tenant_config_v2: two configurable extra vessel-entry tab slots
--    (enabled flag, label, bound pay element).
-- Idempotent: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS throughout.

ALTER TABLE acc_monthly_transactions_v2
  ADD COLUMN IF NOT EXISTS txn_date date;

ALTER TABLE acc_tenant_config_v2
  ADD COLUMN IF NOT EXISTS extra_tab_1_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_tab_1_label text,
  ADD COLUMN IF NOT EXISTS extra_tab_1_pay_element_uuid text,
  ADD COLUMN IF NOT EXISTS extra_tab_2_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_tab_2_label text,
  ADD COLUMN IF NOT EXISTS extra_tab_2_pay_element_uuid text;
