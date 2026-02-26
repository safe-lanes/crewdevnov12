-- Master Database Migration: Create tenants table
-- Database: sails_master_crewing
-- Run manually against the master database (NOT auto-run by the app migration runner)
--
-- Usage:
--   psql -U postgres -d sails_master_crewing -f migrations/master/0001_create_tenants_table.sql

CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    tuid TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL UNIQUE,
    company_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants (domain) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tenants_tuid ON tenants (tuid) WHERE is_active = TRUE AND is_deleted = FALSE;

-- Example: Insert a tenant (uncomment and modify for your setup)
-- INSERT INTO tenants (tuid, domain, company_name)
-- VALUES ('crew_management', 'rsms', 'RSMS Shipping')
-- ON CONFLICT (domain) DO NOTHING;
