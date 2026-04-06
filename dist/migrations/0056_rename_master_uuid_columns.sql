-- Migration: Rename UUID columns in master tables to standardized naming convention
-- Date: 2026-01-20

-- 1. master_additional_groups: external_id -> ag_uuid
ALTER TABLE master_additional_groups RENAME COLUMN external_id TO ag_uuid;

-- 2. master_countries: nuid -> country_uuid
DROP INDEX IF EXISTS idx_country_nuid;
ALTER TABLE master_countries RENAME COLUMN nuid TO country_uuid;
CREATE INDEX idx_country_uuid ON master_countries (country_uuid);

-- 3. master_fleet_groups: external_id -> fg_uuid
DROP INDEX IF EXISTS idx_fleet_group_ext_id;
ALTER TABLE master_fleet_groups RENAME COLUMN external_id TO fg_uuid;
CREATE INDEX idx_fleet_group_uuid ON master_fleet_groups (fg_uuid);

-- 4. master_languages: luid -> lang_uuid
DROP INDEX IF EXISTS idx_language_luid;
ALTER TABLE master_languages RENAME COLUMN luid TO lang_uuid;
CREATE INDEX idx_language_uuid ON master_languages (lang_uuid);

-- 5. master_nationalities: cid -> nat_uuid
DROP INDEX IF EXISTS idx_nationality_cid;
ALTER TABLE master_nationalities RENAME COLUMN cid TO nat_uuid;
CREATE INDEX idx_nationality_uuid ON master_nationalities (nat_uuid);

-- 6. master_ports: puid -> port_uuid
DROP INDEX IF EXISTS idx_port_puid;
ALTER TABLE master_ports RENAME COLUMN puid TO port_uuid;
CREATE INDEX idx_port_uuid ON master_ports (port_uuid);

-- 7. master_users: uuid -> user_uuid
DROP INDEX IF EXISTS idx_master_user_uuid;
ALTER TABLE master_users RENAME COLUMN uuid TO user_uuid;
CREATE INDEX idx_master_user_uuid ON master_users (user_uuid);

-- 8. master_vessel_types: vtuid -> vt_uuid
DROP INDEX IF EXISTS idx_master_vessel_types_vtuid;
ALTER TABLE master_vessel_types RENAME COLUMN vtuid TO vt_uuid;
CREATE INDEX idx_vessel_type_uuid ON master_vessel_types (vt_uuid);

-- 9. master_vessels: vuid -> vessel_uuid
DROP INDEX IF EXISTS idx_vessel_vuid;
ALTER TABLE master_vessels RENAME COLUMN vuid TO vessel_uuid;
CREATE INDEX idx_vessel_uuid ON master_vessels (vessel_uuid);
