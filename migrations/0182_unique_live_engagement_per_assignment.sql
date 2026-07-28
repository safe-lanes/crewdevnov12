-- Task #179 review fix: concurrent auto-create / sync calls could both pass
-- the read-then-insert existence check and create duplicate engagements for
-- the same crew assignment. Enforce the invariant at the DB level: at most
-- one live (non-deleted, non-cancelled) engagement per assignment.
CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_engagements_v2_live_assignment
  ON acc_engagements_v2 (assignment_uuid)
  WHERE assignment_uuid IS NOT NULL
    AND is_deleted = false
    AND status <> 'cancelled';
