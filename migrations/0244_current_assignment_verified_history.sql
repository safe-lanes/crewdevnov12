-- Verified current-contract exclusion, never a fabricated sign-on capture.
ALTER TABLE crew_assignment_rule_context ADD COLUMN IF NOT EXISTS joining_history_backfill jsonb;
CREATE TABLE IF NOT EXISTS crew_rule_history_backfill_report (
 assign_uuid text PRIMARY KEY REFERENCES crew_assignments(assign_uuid) ON DELETE RESTRICT,
 matching_rows integer NOT NULL, first_ever boolean, first_in_rank boolean,
 reason text, evidence jsonb NOT NULL, verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION crew_rule_valid_day(value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
 RETURN value ~ '^\d{4}-\d{2}-\d{2}$' AND value::date::text=value;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
WITH rank_refs AS (
 SELECT ar_uuid, unnest(ARRAY[ar_uuid,rank_id,name,label]) AS ref
 FROM adm_available_ranks_v2 WHERE NOT is_deleted
 UNION
 SELECT r.ar_uuid, unnest(ARRAY[c.cr_uuid,c.rank,c.role,c.rank_id])
 FROM adm_company_ranks_v2 c JOIN adm_available_ranks_v2 r
 ON coalesce(c.original_rank_id,c.rank_id) IN(r.ar_uuid,r.rank_id)
 WHERE NOT c.is_deleted AND NOT r.is_deleted
), rank_mapping AS (
 SELECT ref,min(ar_uuid) rank_uuid FROM rank_refs WHERE ref IS NOT NULL
 GROUP BY ref HAVING count(DISTINCT ar_uuid)=1
), candidates AS (
 SELECT a.*,c.contract_rank_uuid, s.matches, s.current_sea,
   h.prior_count,h.same_rank,h.uncertain_dates,h.uncertain_ranks
 FROM crew_assignments a LEFT JOIN crew_assignment_rule_context c USING(assign_uuid)
 CROSS JOIN LATERAL (
  SELECT count(*)::integer matches,min(sea_uuid) current_sea FROM crew_sea_service
  WHERE NOT is_deleted AND service_type='company' AND crew_uuid=a.crew_uuid
    AND vessel_uuid=a.vessel_uuid AND from_date=a.sign_on_date
 ) s
 CROSS JOIN LATERAL (
  SELECT count(*) FILTER(WHERE crew_rule_valid_day(t.from_date) AND t.from_date<a.sign_on_date AND t.from_date<=current_date::text) prior_count,
   count(*) FILTER(WHERE crew_rule_valid_day(t.from_date) AND t.from_date<a.sign_on_date AND t.from_date<=current_date::text AND m.rank_uuid=c.contract_rank_uuid) same_rank,
   count(*) FILTER(WHERE NOT coalesce(crew_rule_valid_day(t.from_date),false) OR t.from_date=a.sign_on_date) uncertain_dates,
   count(*) FILTER(WHERE t.from_date<a.sign_on_date AND t.from_date<=current_date::text AND m.rank_uuid IS NULL) uncertain_ranks
  FROM crew_sea_service t LEFT JOIN rank_mapping m ON m.ref=t.rank
  WHERE NOT t.is_deleted AND t.service_type='company' AND t.crew_uuid=a.crew_uuid
    AND t.sea_uuid<>coalesce(s.current_sea,'')
 ) h
 WHERE NOT a.is_deleted AND (a.is_current OR a.assignment_type='OnBoard')
   AND (c.joining_history IS NULL OR c.joining_history->>'firstEver' IS NULL
     OR c.joining_history->>'firstInRank' IS NULL)
), decisions AS (
 SELECT *,
 CASE WHEN matches<>1 OR NOT coalesce(crew_rule_valid_day(sign_on_date),false) THEN NULL
      WHEN prior_count>0 THEN false WHEN uncertain_dates>0 THEN NULL ELSE true END first_ever,
 CASE WHEN matches<>1 OR NOT coalesce(crew_rule_valid_day(sign_on_date),false)
        OR contract_rank_uuid IS NULL THEN NULL
      WHEN same_rank>0 THEN false WHEN uncertain_dates>0 OR uncertain_ranks>0 THEN NULL ELSE true END first_in_rank
 FROM candidates
)
INSERT INTO crew_rule_history_backfill_report(assign_uuid,matching_rows,first_ever,first_in_rank,reason,evidence)
SELECT assign_uuid,matches,first_ever,first_in_rank,
 CASE WHEN matches=0 THEN 'No exact current company-service row'
      WHEN matches>1 THEN 'Multiple exact current company-service rows'
      WHEN NOT coalesce(crew_rule_valid_day(sign_on_date),false) THEN 'Invalid sign-on cutoff'
      WHEN contract_rank_uuid IS NULL THEN 'Contract rank is UNRESOLVED'
      WHEN first_ever IS NULL OR first_in_rank IS NULL THEN 'Historical date or rank is ambiguous' END,
 jsonb_build_object('source','verified_current_contract_backfill','verifiedAt',now(),
  'firstEver',first_ever,'firstInRank',first_in_rank,'cutoff',sign_on_date,
  'contractRankUuid',contract_rank_uuid,'excludedCurrentSeaServiceUuid',
  CASE WHEN matches=1 THEN current_sea END,'matchingRows',matches,
  'currentContractExclusion','Exact seafarer, vessel, sign-on date and company service',
  'sourceSeaServiceUuids',(SELECT coalesce(jsonb_agg(t.sea_uuid),'[]') FROM crew_sea_service t
    WHERE NOT t.is_deleted AND t.crew_uuid=decisions.crew_uuid AND t.service_type='company'
      AND t.sea_uuid<>coalesce(current_sea,'') AND t.from_date<sign_on_date))
FROM decisions ON CONFLICT(assign_uuid) DO NOTHING;

INSERT INTO crew_assignment_rule_context(assign_uuid,rank_source,rank_reason,joining_history_backfill)
SELECT assign_uuid,'{"method":"no_recorded_deploy_capture"}','Contract rank is UNRESOLVED',
 evidence || jsonb_build_object('firstEverReason',CASE WHEN first_ever IS NULL THEN reason END,
 'firstInRankReason',CASE WHEN first_in_rank IS NULL THEN reason END)
FROM crew_rule_history_backfill_report
ON CONFLICT(assign_uuid) DO UPDATE SET joining_history_backfill=EXCLUDED.joining_history_backfill
 WHERE crew_assignment_rule_context.joining_history_backfill IS NULL;

CREATE OR REPLACE FUNCTION crew_verified_history_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.joining_history_backfill IS NOT NULL AND NEW.joining_history_backfill IS DISTINCT FROM OLD.joining_history_backfill
 THEN RAISE EXCEPTION 'Verified backfill is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crew_verified_history_frozen ON crew_assignment_rule_context;
CREATE TRIGGER trg_crew_verified_history_frozen BEFORE UPDATE ON crew_assignment_rule_context
FOR EACH ROW EXECUTE FUNCTION crew_verified_history_frozen();
