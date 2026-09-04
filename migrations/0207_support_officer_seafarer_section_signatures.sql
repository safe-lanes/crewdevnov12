-- Support independent officer and seafarer signatures per Briefing section.
-- Applied migrations 0202 and 0203 remain immutable reference history.

ALTER TABLE frm_sections
  ADD COLUMN IF NOT EXISTS signature_officer_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signature_seafarer_required BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'frm_sections' AND column_name = 'signature_required'
  ) THEN
    UPDATE frm_sections
    SET signature_officer_required = signature_required
    WHERE signature_required = TRUE
      AND signature_officer_required = FALSE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS frm_section_signatures (
  id SERIAL PRIMARY KEY,
  section_signature_uuid TEXT NOT NULL UNIQUE,
  section_state_uuid TEXT NOT NULL
    REFERENCES frm_section_states(section_state_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  signature_type TEXT NOT NULL,
  signature_att_uuid TEXT NOT NULL
    REFERENCES frm_signature_attachments(sig_att_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  signer_name TEXT NOT NULL,
  signer_rank TEXT,
  signed_at TIMESTAMP NOT NULL,
  signed_by_uuid TEXT NOT NULL,
  signature_method TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT chk_frm_section_signatures_type
    CHECK (signature_type IN ('officer', 'seafarer')),
  CONSTRAINT chk_frm_section_signatures_method
    CHECK (signature_method IN ('officer', 'witnessed', 'authenticated')),
  CONSTRAINT chk_frm_section_signatures_officer
    CHECK (signature_type <> 'officer' OR
      (signature_method = 'officer' AND signer_rank IS NULL)),
  CONSTRAINT chk_frm_section_signatures_seafarer
    CHECK (signature_type <> 'seafarer' OR
      (signature_method IN ('witnessed', 'authenticated')
       AND BTRIM(signer_name) <> ''
       AND signer_rank IS NOT NULL
       AND BTRIM(signer_rank) <> '')),
  CONSTRAINT uq_frm_section_signatures_state_type
    UNIQUE (section_state_uuid, signature_type)
);

CREATE INDEX IF NOT EXISTS idx_frm_section_signatures_section_state_uuid
  ON frm_section_signatures(section_state_uuid);
CREATE INDEX IF NOT EXISTS idx_frm_section_signatures_signature_att_uuid
  ON frm_section_signatures(signature_att_uuid);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'frm_section_states' AND column_name = 'signature_att_uuid'
  ) THEN
    INSERT INTO frm_section_signatures (
      section_signature_uuid,
      section_state_uuid,
      signature_type,
      signature_att_uuid,
      signer_name,
      signer_rank,
      signed_at,
      signed_by_uuid,
      signature_method,
      created_at,
      updated_at,
      created_by_uuid,
      updated_by_uuid,
      is_deleted,
      is_sync
    )
    SELECT
      gen_random_uuid()::text,
      state.section_state_uuid,
      'officer',
      state.signature_att_uuid,
      COALESCE(NULLIF(BTRIM(state.signature_name), ''), 'Unknown officer'),
      NULL,
      COALESCE(state.signed_at, state.updated_at, state.created_at, NOW()),
      COALESCE(NULLIF(BTRIM(state.signed_by_uuid), ''), NULLIF(BTRIM(state.updated_by_uuid), ''), 'legacy-migration'),
      'officer',
      COALESCE(state.created_at, NOW()),
      COALESCE(state.updated_at, NOW()),
      state.created_by_uuid,
      state.updated_by_uuid,
      COALESCE(state.is_deleted, FALSE),
      COALESCE(state.is_sync, FALSE)
    FROM frm_section_states state
    WHERE state.signature_att_uuid IS NOT NULL
    ON CONFLICT (section_state_uuid, signature_type) DO NOTHING;

    IF EXISTS (
      SELECT 1
      FROM frm_section_states state
      LEFT JOIN frm_signature_attachments attachment
        ON attachment.sig_att_uuid = state.signature_att_uuid
       AND attachment.section_state_uuid = state.section_state_uuid
      LEFT JOIN frm_section_signatures signature
        ON signature.section_state_uuid = state.section_state_uuid
       AND signature.signature_type = 'officer'
       AND signature.signature_att_uuid = state.signature_att_uuid
      WHERE state.signature_att_uuid IS NOT NULL
      GROUP BY state.section_state_uuid, state.signature_att_uuid
      HAVING COUNT(attachment.id) <> 1 OR COUNT(signature.id) <> 1
    ) THEN
      RAISE EXCEPTION 'Signature backfill ownership mismatch; legacy signature columns were not dropped';
    END IF;
  END IF;
END $$;

ALTER TABLE frm_section_states
  DROP CONSTRAINT IF EXISTS fk_frm_section_states_signature_attachment;
DROP INDEX IF EXISTS idx_frm_section_states_signature_att_uuid;

ALTER TABLE frm_signature_attachments
  DROP CONSTRAINT IF EXISTS frm_signature_attachments_section_state_uuid_fkey;
DROP INDEX IF EXISTS idx_frm_signature_attachments_section_state_uuid;

ALTER TABLE frm_signature_attachments
  DROP COLUMN IF EXISTS section_state_uuid;

ALTER TABLE frm_section_states
  DROP COLUMN IF EXISTS signature_att_uuid,
  DROP COLUMN IF EXISTS signature_name,
  DROP COLUMN IF EXISTS signed_by_uuid,
  DROP COLUMN IF EXISTS signed_at;

ALTER TABLE frm_sections
  DROP COLUMN IF EXISTS signature_required;