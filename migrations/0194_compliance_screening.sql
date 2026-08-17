-- Task 578: Compliance Screening (OFAC + Global Sanctions)

CREATE TABLE
    IF NOT EXISTS rec_candidate_screening (
        id SERIAL PRIMARY KEY,
        screening_uuid TEXT UNIQUE NOT NULL,
        rec_can_uuid TEXT UNIQUE NOT NULL,
        overall_status TEXT NOT NULL DEFAULT 'PENDING',
        result JSONB,
        provider TEXT,
        checked_by_uuid TEXT,
        checked_on TIMESTAMPTZ,
        remark TEXT,
        remark_by_uuid TEXT,
        remark_on TIMESTAMPTZ,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
        created_by_uuid TEXT,
        updated_by_uuid TEXT,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        is_sync BOOLEAN NOT NULL DEFAULT FALSE
    );

CREATE INDEX IF NOT EXISTS idx_candidate_screening_rec_can ON rec_candidate_screening (rec_can_uuid);