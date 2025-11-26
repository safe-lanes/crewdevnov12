-- Add rotation_archive table for independent historical records of deployed/rejected assignments
-- This table stores complete snapshots of crew assignments and persists independently of rotation plans

CREATE TABLE IF NOT EXISTS rotation_archive (
    id SERIAL PRIMARY KEY,
    original_plan_id INTEGER,
    original_draft_id TEXT,
    original_assignment_index INTEGER,
    vessel_id TEXT NOT NULL,
    vessel_name TEXT NOT NULL,
    rank_id TEXT,
    rank TEXT NOT NULL,
    crew_id TEXT NOT NULL,
    crew_name TEXT NOT NULL,
    crew_member_id TEXT,
    joining_date TEXT NOT NULL,
    joining_port TEXT,
    contract_period INTEGER NOT NULL,
    sign_off_date TEXT,
    proposed_by TEXT NOT NULL,
    proposed_date TEXT NOT NULL,
    result TEXT NOT NULL,
    archived_date TEXT NOT NULL,
    archived_by TEXT NOT NULL,
    vessel_planning_id INTEGER,
    current_crew_info TEXT,
    full_assignment_snapshot TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rotation_archive_vessel ON rotation_archive(vessel_name);
CREATE INDEX IF NOT EXISTS idx_rotation_archive_rank ON rotation_archive(rank);
CREATE INDEX IF NOT EXISTS idx_rotation_archive_archived_date ON rotation_archive(archived_date);
CREATE INDEX IF NOT EXISTS idx_rotation_archive_result ON rotation_archive(result);
CREATE INDEX IF NOT EXISTS idx_rotation_archive_crew ON rotation_archive(crew_id);

-- Add new columns if table already exists (for existing deployments)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rotation_archive' AND column_name = 'original_assignment_index') THEN
        ALTER TABLE rotation_archive ADD COLUMN original_assignment_index INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rotation_archive' AND column_name = 'rank_id') THEN
        ALTER TABLE rotation_archive ADD COLUMN rank_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rotation_archive' AND column_name = 'crew_member_id') THEN
        ALTER TABLE rotation_archive ADD COLUMN crew_member_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rotation_archive' AND column_name = 'joining_port') THEN
        ALTER TABLE rotation_archive ADD COLUMN joining_port TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rotation_archive' AND column_name = 'sign_off_date') THEN
        ALTER TABLE rotation_archive ADD COLUMN sign_off_date TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rotation_archive' AND column_name = 'vessel_planning_id') THEN
        ALTER TABLE rotation_archive ADD COLUMN vessel_planning_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rotation_archive' AND column_name = 'full_assignment_snapshot') THEN
        ALTER TABLE rotation_archive ADD COLUMN full_assignment_snapshot TEXT;
    END IF;
END $$;
