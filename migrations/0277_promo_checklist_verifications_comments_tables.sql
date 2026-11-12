-- Migration: PRD-14 - checklist verifications and comments get rows of their own.
--
-- Background: each checklist point is one row in promo_checklist_progress_v2.
-- Its verifications and comments were JSON text in verifications_data and
-- comments_data, and every save wrote the whole list. Two people adding one
-- verification each (ship and office) therefore replaced each other's list.
-- Each verification and each comment is now a row with its own uuid, like the
-- attachments in promo_checklist_attachments_v2 (parent: the point's cp_uuid).
--
-- The JSON columns stay as they are (no longer read or written) so the change
-- can be rolled back.
--
-- Backfill: every live point's JSON lists become rows. A legacy id such as
-- "verify-1775813832911-ab12cd" or "comment-1775813832911" is only unique
-- inside its list, so the row uuid is md5(cp_uuid : kind : id) cast to a uuid.
-- It depends only on the point and the legacy id, so ship and office derive
-- the same uuid for the same entry. A verification comment saved without a
-- verificationId is linked to the verification at the same position, as the
-- form always did. A point whose JSON cannot be read is skipped with a NOTICE.
--
-- Safe to re-run: IF NOT EXISTS, and ON CONFLICT DO NOTHING on the uuid, so a
-- second run adds nothing and never touches rows edited since.

CREATE TABLE IF NOT EXISTS promo_checklist_verifications_v2 (
  id SERIAL PRIMARY KEY,
  cv_uuid TEXT NOT NULL UNIQUE,
  checklist_progress_uuid TEXT NOT NULL,
  verifier_name TEXT,
  verifier_rank TEXT,
  date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS promo_checklist_comments_v2 (
  id SERIAL PRIMARY KEY,
  cm_uuid TEXT NOT NULL UNIQUE,
  checklist_progress_uuid TEXT NOT NULL,
  verification_uuid TEXT,
  comment_user TEXT,
  comment_rank TEXT,
  comment_text TEXT,
  date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Every open, save and delete reads these rows by the point's uuid.
CREATE INDEX IF NOT EXISTS idx_promo_checklist_verifications_v2_progress_uuid
  ON promo_checklist_verifications_v2 (checklist_progress_uuid);
CREATE INDEX IF NOT EXISTS idx_promo_checklist_comments_v2_progress_uuid
  ON promo_checklist_comments_v2 (checklist_progress_uuid);

DO $$
DECLARE
  cp RECORD;
  elem JSONB;
  pos INTEGER;
  ver_ids TEXT[];
  empty_pos INTEGER;
  link TEXT;
  ver_json JSONB;
  com_json JSONB;
BEGIN
  FOR cp IN
    SELECT cp_uuid, verifications_data, comments_data, created_by_uuid
    FROM promo_checklist_progress_v2
    WHERE is_deleted = FALSE
      AND (COALESCE(verifications_data, '') <> '' OR COALESCE(comments_data, '') <> '')
  LOOP
    BEGIN
      ver_ids := ARRAY[]::TEXT[];

      IF COALESCE(cp.verifications_data, '') <> '' THEN
        ver_json := cp.verifications_data::JSONB;
        IF jsonb_typeof(ver_json) = 'array' THEN
          pos := 0;
          FOR elem IN SELECT * FROM jsonb_array_elements(ver_json) LOOP
            ver_ids := ver_ids || md5(cp.cp_uuid || ':verification:' || COALESCE(elem->>'id', pos::TEXT))::UUID::TEXT;
            INSERT INTO promo_checklist_verifications_v2
              (cv_uuid, checklist_progress_uuid, verifier_name, verifier_rank, date, sort_order, created_by_uuid, updated_by_uuid)
            VALUES (
              ver_ids[pos + 1], cp.cp_uuid,
              NULLIF(elem->>'verifierName', ''), NULLIF(elem->>'rank', ''), NULLIF(elem->>'date', ''),
              pos, cp.created_by_uuid, cp.created_by_uuid
            )
            ON CONFLICT (cv_uuid) DO NOTHING;
            pos := pos + 1;
          END LOOP;
        END IF;
      END IF;

      IF COALESCE(cp.comments_data, '') <> '' THEN
        com_json := cp.comments_data::JSONB;
        IF jsonb_typeof(com_json) = 'array' THEN
          pos := 0;
          empty_pos := 0;
          FOR elem IN SELECT * FROM jsonb_array_elements(com_json) LOOP
            link := NULL;
            IF COALESCE(elem->>'verificationId', '') <> '' THEN
              link := md5(cp.cp_uuid || ':verification:' || (elem->>'verificationId'))::UUID::TEXT;
            ELSIF COALESCE(elem->>'text', '') = '' THEN
              link := ver_ids[empty_pos + 1];
              empty_pos := empty_pos + 1;
            END IF;
            INSERT INTO promo_checklist_comments_v2
              (cm_uuid, checklist_progress_uuid, verification_uuid, comment_user, comment_rank, comment_text, date, sort_order, created_by_uuid, updated_by_uuid)
            VALUES (
              md5(cp.cp_uuid || ':comment:' || COALESCE(elem->>'id', pos::TEXT))::UUID::TEXT,
              cp.cp_uuid, link,
              NULLIF(elem->>'userName', ''), NULLIF(elem->>'rank', ''), NULLIF(elem->>'text', ''), NULLIF(elem->>'date', ''),
              pos, cp.created_by_uuid, cp.created_by_uuid
            )
            ON CONFLICT (cm_uuid) DO NOTHING;
            pos := pos + 1;
          END LOOP;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'PRD-14 backfill skipped checklist point %: %', cp.cp_uuid, SQLERRM;
    END;
  END LOOP;
END $$;
