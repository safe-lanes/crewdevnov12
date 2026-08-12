-- Pin-at-submission rule: Draft / In Progress reviews must live-follow the
-- latest released version, so their creation-time pins are removed.
-- Submitted / Approved / Completed reviews keep their pins (frozen records).
UPDATE promotion_reviews_v2
SET form_version_id = NULL,
    form_version_uuid = NULL
WHERE is_deleted = false
  AND lower(trim(status)) IN ('draft', 'in progress', 'in_progress');
