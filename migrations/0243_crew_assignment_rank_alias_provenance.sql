-- Complete only previously UNRESOLVED rank contexts using authoritative role
-- references. Never parse suffixes or overwrite an already captured rank.
WITH links AS (
 SELECT a.assign_uuid,p.plan_uuid,p.rank_id
 FROM crew_assignments a JOIN vessel_planning_v2 p ON p.vessel_uuid=a.vessel_uuid
  AND ((p.reliever_assign_uuid=a.assign_uuid AND p.reliever_crew_uuid=a.crew_uuid)
    OR (p.crew_assign_uuid=a.assign_uuid AND p.crew_uuid=a.crew_uuid))
 WHERE NOT a.is_deleted AND NOT p.is_deleted
), matches AS (
 SELECT l.*,r.ar_uuid,r.name FROM links l LEFT JOIN adm_available_ranks_v2 r ON NOT r.is_deleted
  AND (l.rank_id IN(r.ar_uuid,r.rank_id) OR EXISTS(
   SELECT 1 FROM adm_company_ranks_v2 c WHERE NOT c.is_deleted AND l.rank_id IN(c.cr_uuid,c.id,c.rank_id)
    AND coalesce(c.original_rank_id,c.rank_id) IN(r.ar_uuid,r.rank_id)
  ))
), safe AS (
 SELECT assign_uuid,min(ar_uuid) rank_uuid,min(name) label,
  jsonb_agg(DISTINCT plan_uuid) plans,jsonb_agg(DISTINCT rank_id) refs
 FROM matches GROUP BY assign_uuid HAVING count(DISTINCT ar_uuid)=1 AND count(*) FILTER(WHERE ar_uuid IS NULL)=0
)
UPDATE crew_assignment_rule_context ctx SET contract_rank_uuid=s.rank_uuid,contract_rank_label=s.label,
 rank_reason=NULL,rank_source=jsonb_build_object('method','recorded_planning_link_upgrade','planningUuids',s.plans,'rankReferences',s.refs)
FROM safe s WHERE ctx.assign_uuid=s.assign_uuid AND ctx.contract_rank_uuid IS NULL;
