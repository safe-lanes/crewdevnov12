-- Migration 0143: Accounts V2 uniqueness guards (data integrity)
-- Date: 2026-06-23
-- Description: Prevents duplicate draft contracts per crew member + vessel group,
--              and duplicate inherited pay elements per contract, under
--              concurrent contract-data reads (find-or-create + inherit). Partial
--              unique indexes only apply to live (non-deleted) rows. Idempotent.

-- One live contract per crew member + vessel group.
CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_contracts_v2_crew_group
  ON acc_contracts_v2 (crew_uuid, vessel_group)
  WHERE is_deleted = FALSE;

-- One live inherited element per (contract, master pay element).
CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_contract_pay_elements_v2_contract_pe
  ON acc_contract_pay_elements_v2 (contract_uuid, pay_element_uuid)
  WHERE is_deleted = FALSE AND pay_element_uuid IS NOT NULL;
