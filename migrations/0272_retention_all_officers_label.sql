-- Prepared outside the watched migration directory until read-only preflight.
-- Label only. Stable codes, UUIDs, order, targets and frozen audit data stay intact.
-- Rollback is another forward migration changing only this catalogue label;
-- never rewrite historical audit details in either direction.
BEGIN;
DO $$
BEGIN
  IF (SELECT count(*) FROM kpi_components c JOIN kpi_definitions k USING(kpi_uuid)
      WHERE k.code='retention' AND c.code='officers'
        AND c.label IN ('Officers','All Officers')) <> 1 THEN
    RAISE EXCEPTION 'Expected one Retention officers component with a recognized label';
  END IF;
END $$;
UPDATE kpi_components c SET label='All Officers'
FROM kpi_definitions k
WHERE k.kpi_uuid=c.kpi_uuid AND k.code='retention'
  AND c.code='officers' AND c.label='Officers';
COMMIT;
