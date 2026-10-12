-- Runs on EACH tenant's upgrade, never against a global activation flag.
-- A single transaction and a write barrier make legacy coverage + activation
-- atomic. Failed upgrades roll back completion and leave enforcement off.
LOCK TABLE crew_assignments, vessel_planning_v2 IN SHARE ROW EXCLUSIVE MODE;
UPDATE frm_stage_rollout SET capture_from=coalesce(capture_from,clock_timestamp()) WHERE singleton;

DO $$
DECLARE a record; s record; cycle_id text; event_id text; run_id text; boundary timestamptz;
BEGIN
 SELECT capture_from INTO boundary FROM frm_stage_rollout WHERE singleton;
 FOR a IN SELECT ca.assign_uuid,ca.assignment_type,ca.sign_on_date,ca.sign_off_date,
   EXISTS(SELECT 1 FROM vessel_planning_v2 p WHERE p.crew_assign_uuid=ca.assign_uuid
     AND NOT p.is_deleted AND p.relief_status IN('Planned','Confirmed')) relief_reached
   FROM crew_assignments ca WHERE NOT ca.is_deleted AND ca.assignment_type<>'Cancelled'
 LOOP
   FOR s IN SELECT 'before_joining'::text stage, NULL::date business_day
     UNION ALL SELECT 'on_board', CASE WHEN a.sign_on_date ~ '^\d{4}-\d{2}-\d{2}$'
       THEN a.sign_on_date::date END WHERE a.assignment_type='OnBoard'
     UNION ALL SELECT 'at_sign_off', CASE WHEN a.sign_off_date ~ '^\d{4}-\d{2}-\d{2}$'
       THEN a.sign_off_date::date END WHERE a.relief_reached OR nullif(a.sign_off_date,'') IS NOT NULL
   LOOP
     cycle_id:=gen_random_uuid()::text;
     INSERT INTO frm_stage_cycles(subject_ref,stage_key,cycle_uuid)
       VALUES(a.assign_uuid,s.stage,cycle_id) ON CONFLICT DO NOTHING;
     SELECT cycle_uuid INTO cycle_id FROM frm_stage_cycles WHERE subject_ref=a.assign_uuid AND stage_key=s.stage;
     -- Never overwrite a live event or a deferred cycle on a resumed upgrade.
     IF EXISTS(SELECT 1 FROM frm_stage_events WHERE subject_ref=a.assign_uuid AND stage_key=s.stage AND cycle_uuid=cycle_id)
       OR EXISTS(SELECT 1 FROM frm_stage_cycles WHERE subject_ref=a.assign_uuid AND stage_key=s.stage AND deferred)
       THEN CONTINUE; END IF;
     event_id:=gen_random_uuid()::text; run_id:=gen_random_uuid()::text;
     INSERT INTO frm_stage_events(event_uuid,subject_ref,stage_key,cycle_uuid,source,source_key,
       occurred_at,business_date,actor_uuid,snapshot)
     VALUES(event_id,a.assign_uuid,s.stage,cycle_id,'go_live','tenant-upgrade',boundary,s.business_day,
       'tenant-upgrade',jsonb_build_object('legacy',true,'facts',NULL,'candidates','[]'::jsonb,
         'historicalDateKnown',s.business_day IS NOT NULL,
         'reason','Existing stage opened by recorded non-retrospective go-live check; no rules evaluated'));
     INSERT INTO frm_resolution_runs(run_uuid,subject_type,subject_ref,stage_key,cycle_uuid,event_key,
       trigger_at,effective_date,outcome,actor_uuid,source,evidence)
     VALUES(run_id,'crew_assignment',a.assign_uuid,s.stage,cycle_id,event_id,boundary,s.business_day,
       'COMPLETED','tenant-upgrade','go_live',jsonb_build_object('eventUuid',event_id,'legacy',true,'candidates','[]'::jsonb));
     INSERT INTO frm_stage_attempts(attempt_uuid,event_uuid,actor_uuid,outcome,run_uuid)
       VALUES(gen_random_uuid()::text,event_id,'tenant-upgrade','COMPLETED',run_id);
   END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM frm_stage_events e JOIN frm_stage_cycles c
     ON c.subject_ref=e.subject_ref AND c.stage_key=e.stage_key AND c.cycle_uuid=e.cycle_uuid
     WHERE NOT c.deferred AND NOT EXISTS(SELECT 1 FROM frm_stage_attempts t WHERE t.event_uuid=e.event_uuid AND t.outcome='COMPLETED'))
   THEN RAISE EXCEPTION 'Tenant go-live incomplete: existing stage checks are not ready'; END IF;
 INSERT INTO frm_stage_audit(actor_uuid,event,evidence)
 SELECT 'tenant-upgrade','GO_LIVE_COMPLETED',jsonb_build_object('boundary',boundary,
   'assignmentCount',(SELECT count(DISTINCT subject_ref) FROM frm_stage_events WHERE source='go_live'),
   'stageCount',(SELECT count(*) FROM frm_stage_events WHERE source='go_live'),
   'nonRetrospective',true,'tenantLocal',true)
 WHERE NOT EXISTS(SELECT 1 FROM frm_stage_audit WHERE event='GO_LIVE_COMPLETED');
 UPDATE frm_stage_rollout SET completed_at=coalesce(completed_at,clock_timestamp()),enforcement_enabled=true WHERE singleton;
END $$;
