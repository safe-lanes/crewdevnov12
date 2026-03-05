-- Migration 0106: Create and seed vessel org chart table
-- Date: 2026-03-05
-- Description: Creates the adm_vessel_org_chart_v2 table and seeds it with a
--              standard vessel organizational hierarchy.

-- Part 1: Create table
CREATE TABLE IF NOT EXISTS adm_vessel_org_chart_v2 (
  id SERIAL PRIMARY KEY,
  oc_uuid TEXT NOT NULL UNIQUE,
  rank TEXT NOT NULL,
  rank_id TEXT NOT NULL,
  parent_rank_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Part 2: Seed default vessel org chart hierarchy
-- Uses a temporary unique index on rank_id to ensure idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'adm_vessel_org_chart_v2'
      AND indexname = 'adm_vessel_org_chart_v2_rank_id_unique'
  ) THEN
    CREATE UNIQUE INDEX adm_vessel_org_chart_v2_rank_id_unique
      ON adm_vessel_org_chart_v2 (rank_id)
      WHERE is_deleted = FALSE;
  END IF;
END $$;

-- Master (root)
INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, 'Master', 'R001', NULL, 0)
ON CONFLICT DO NOTHING;

-- Deck Department: Chief Officer and reports
INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, 'Chief Officer', 'R002', 'R001', 0)
ON CONFLICT DO NOTHING;

INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, '2nd Officer', 'R003', 'R002', 0)
ON CONFLICT DO NOTHING;

INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, '3rd Officer', 'R004', 'R002', 1)
ON CONFLICT DO NOTHING;

INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, 'Bosun', 'R014', 'R002', 2)
ON CONFLICT DO NOTHING;

INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, 'Pumpman', 'R017', 'R002', 3)
ON CONFLICT DO NOTHING;

INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, 'AB', 'R015', 'R002', 4)
ON CONFLICT DO NOTHING;

INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, 'OS', 'R016', 'R002', 5)
ON CONFLICT DO NOTHING;

-- Engine Department: Chief Engineer and reports
INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, 'Chief Engineer', 'R005', 'R001', 1)
ON CONFLICT DO NOTHING;

INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, '2nd Engineer', 'R006', 'R005', 0)
ON CONFLICT DO NOTHING;

INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, 'Fitter', 'R018', 'R006', 0)
ON CONFLICT DO NOTHING;

INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, 'Oiler', 'R021', 'R006', 1)
ON CONFLICT DO NOTHING;

INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, '3rd Engineer', 'R007', 'R005', 1)
ON CONFLICT DO NOTHING;

INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, '4th Engineer', 'R008', 'R005', 2)
ON CONFLICT DO NOTHING;

INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, 'Electrical Officer', 'R010', 'R005', 3)
ON CONFLICT DO NOTHING;

-- Catering Department: Chief Cook and reports
INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, 'Chief Cook', 'R022', 'R001', 2)
ON CONFLICT DO NOTHING;

INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, 'Messman', 'R023', 'R022', 0)
ON CONFLICT DO NOTHING;

-- Other
INSERT INTO adm_vessel_org_chart_v2 (oc_uuid, rank, rank_id, parent_rank_id, sort_order)
VALUES (gen_random_uuid()::text, 'Tester', 'R024', 'R001', 3)
ON CONFLICT DO NOTHING;

-- Part 3: Reset serial sequence
SELECT setval(
  pg_get_serial_sequence('adm_vessel_org_chart_v2', 'id'),
  COALESCE((SELECT MAX(id) FROM adm_vessel_org_chart_v2), 0) + 1,
  false
);
