# Crew Assignments Data Integrity Audit

**Scope:** development database only, read-only investigation. No application code, schema, migration, or database row was changed.

**Database inspected:** `heliumdb`, schema `public`.

## Read-only SQL attestation

40 database statements were executed. The complete list is below; every statement begins with `SELECT` or `WITH`. No `INSERT`, `UPDATE`, `DELETE`, DDL, or transaction-control statement was executed.

- `O1` — begins with `SELECT`: `SELECT current_database() AS database_name, current_schema() AS schema_name`
- `O2` — begins with `SELECT`: `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('crew_assignments', 'vessel_planning_v2', 'crew_sea_service', 'crew_members_v2', 'master_vessels') ORDER BY table_name, ordinal_position`
- `O3` — begins with `SELECT`: `SELECT COUNT(*) AS total_rows FROM crew_assignments`
- `O4` — begins with `SELECT`: `SELECT assignment_type, COUNT(*) AS row_count FROM crew_assignments GROUP BY assignment_type ORDER BY assignment_type NULLS FIRST`
- `O5` — begins with `SELECT`: `SELECT is_current, COUNT(*) AS row_count FROM crew_assignments GROUP BY is_current ORDER BY is_current NULLS FIRST`
- `O6` — begins with `SELECT`: `SELECT COUNT(*) AS total_rows FROM vessel_planning_v2`
- `O7` — begins with `SELECT`: `SELECT COUNT(*) AS total_rows FROM crew_sea_service`
- `C-1-count` — begins with `WITH`: `WITH duplicate_groups AS (SELECT crew_uuid, vessel_uuid, COUNT(*) AS row_count FROM crew_assignments WHERE is_deleted = false AND assignment_type = 'Planned' GROUP BY crew_uuid, vessel_uuid HAVING COUNT(*) > 1) SELECT COUNT(*) AS group_count, COALESCE(SUM(row_count), 0) AS rows_involved FROM duplicate_groups`
- `C-1-examples` — begins with `WITH`: `WITH duplicate_groups AS (SELECT crew_uuid, vessel_uuid FROM crew_assignments WHERE is_deleted = false AND assignment_type = 'Planned' GROUP BY crew_uuid, vessel_uuid HAVING COUNT(*) > 1) SELECT ca.crew_uuid, ca.vessel_uuid, ARRAY_AGG(ca.assign_uuid ORDER BY ca.created_at, ca.assign_uuid) AS assign_uuids, ARRAY_AGG(ca.created_at ORDER BY ca.created_at, ca.assign_uuid) AS created_at_values, COUNT(*) AS row_count FROM crew_assignments ca JOIN duplicate_groups dg ON dg.crew_uuid = ca.crew_uuid AND dg.vessel_uuid IS NOT DISTINCT FROM ca.vessel_uuid WHERE ca.is_deleted = false AND ca.assignment_type = 'Planned' GROUP BY ca.crew_uuid, ca.vessel_uuid ORDER BY ca.crew_uuid, ca.vessel_uuid LIMIT 5`
- `C-2-count` — begins with `WITH`: `WITH multiple_current AS (SELECT crew_uuid FROM crew_assignments WHERE is_deleted = false AND is_current = true GROUP BY crew_uuid HAVING COUNT(*) > 1) SELECT COUNT(*) AS crew_count FROM multiple_current`
- `C-2-examples` — begins with `WITH`: `WITH multiple_current AS (SELECT crew_uuid FROM crew_assignments WHERE is_deleted = false AND is_current = true GROUP BY crew_uuid HAVING COUNT(*) > 1) SELECT ca.crew_uuid, ca.assign_uuid, ca.vessel_uuid, ca.assignment_type FROM crew_assignments ca JOIN multiple_current mc ON mc.crew_uuid = ca.crew_uuid WHERE ca.is_deleted = false AND ca.is_current = true ORDER BY ca.crew_uuid, ca.created_at, ca.assign_uuid LIMIT 5`
- `C-3-count` — begins with `SELECT`: `SELECT COUNT(*) AS row_count FROM crew_assignments ca WHERE ca.is_deleted = false AND ca.assignment_type = 'Planned' AND EXISTS (SELECT 1 FROM vessel_planning_v2 vp WHERE vp.is_deleted = false AND vp.crew_uuid = ca.crew_uuid AND vp.vessel_uuid = ca.vessel_uuid AND vp.sign_on_date IS NOT NULL)`
- `C-3-examples` — begins with `SELECT`: `SELECT ca.assign_uuid, vp.plan_uuid, ca.crew_uuid, ca.vessel_uuid, vp.sign_on_date AS planning_sign_on_date, ca.assignment_type, ca.sign_on_date AS assignment_sign_on_date FROM crew_assignments ca JOIN vessel_planning_v2 vp ON vp.crew_uuid = ca.crew_uuid AND vp.vessel_uuid = ca.vessel_uuid AND vp.is_deleted = false AND vp.sign_on_date IS NOT NULL WHERE ca.is_deleted = false AND ca.assignment_type = 'Planned' ORDER BY ca.created_at, ca.assign_uuid, vp.plan_uuid LIMIT 5`
- `C-4-count` — begins with `SELECT`: `SELECT COUNT(*) AS row_count FROM crew_assignments ca WHERE ca.is_deleted = false AND (ca.is_current = true OR ca.sign_off_date IS NULL) AND EXISTS (SELECT 1 FROM vessel_planning_v2 vp WHERE vp.crew_uuid = ca.crew_uuid AND vp.vessel_uuid = ca.vessel_uuid AND vp.sign_off_date IS NOT NULL)`
- `C-4-examples` — begins with `SELECT`: `SELECT ca.assign_uuid, vp.plan_uuid, ca.crew_uuid, ca.vessel_uuid, ca.is_current, ca.sign_off_date AS assignment_sign_off_date, vp.sign_off_date AS planning_sign_off_date, ca.assignment_type FROM crew_assignments ca JOIN vessel_planning_v2 vp ON vp.crew_uuid = ca.crew_uuid AND vp.vessel_uuid = ca.vessel_uuid AND vp.sign_off_date IS NOT NULL WHERE ca.is_deleted = false AND (ca.is_current = true OR ca.sign_off_date IS NULL) ORDER BY ca.created_at, ca.assign_uuid, vp.plan_uuid LIMIT 5`
- `C-5-count` — begins with `SELECT`: `SELECT COUNT(*) AS row_count FROM crew_assignments ca WHERE ca.is_deleted = false AND ca.assignment_type = 'Planned' AND NOT EXISTS (SELECT 1 FROM vessel_planning_v2 vp WHERE vp.is_deleted = false AND vp.vessel_uuid = ca.vessel_uuid AND (vp.crew_uuid = ca.crew_uuid OR vp.reliever_crew_uuid = ca.crew_uuid))`
- `C-5-examples` — begins with `SELECT`: `SELECT ca.assign_uuid, ca.crew_uuid, ca.vessel_uuid, ca.assignment_type, ca.is_current, ca.created_at, ca.updated_at FROM crew_assignments ca WHERE ca.is_deleted = false AND ca.assignment_type = 'Planned' AND NOT EXISTS (SELECT 1 FROM vessel_planning_v2 vp WHERE vp.is_deleted = false AND vp.vessel_uuid = ca.vessel_uuid AND (vp.crew_uuid = ca.crew_uuid OR vp.reliever_crew_uuid = ca.crew_uuid)) ORDER BY ca.created_at, ca.assign_uuid LIMIT 5`
- `C-6-count` — begins with `SELECT`: `SELECT COUNT(*) AS row_count FROM vessel_planning_v2 vp WHERE vp.is_deleted = false AND vp.sign_on_date IS NOT NULL AND vp.crew_status = 'primary' AND NOT EXISTS (SELECT 1 FROM crew_sea_service css WHERE css.is_deleted = false AND css.crew_uuid = vp.crew_uuid AND css.vessel_uuid = vp.vessel_uuid AND css.service_type = 'company')`
- `C-6-examples` — begins with `SELECT`: `SELECT vp.plan_uuid, vp.crew_uuid, vp.vessel_uuid, vp.sign_on_date, vp.crew_status, vp.created_at, vp.updated_at FROM vessel_planning_v2 vp WHERE vp.is_deleted = false AND vp.sign_on_date IS NOT NULL AND vp.crew_status = 'primary' AND NOT EXISTS (SELECT 1 FROM crew_sea_service css WHERE css.is_deleted = false AND css.crew_uuid = vp.crew_uuid AND css.vessel_uuid = vp.vessel_uuid AND css.service_type = 'company') ORDER BY vp.created_at, vp.plan_uuid LIMIT 5`
- `C-7a-count` — begins with `SELECT`: `SELECT COUNT(*) AS row_count FROM crew_assignments WHERE is_deleted = false AND is_current = true AND sign_off_date IS NOT NULL`
- `C-7a-examples` — begins with `SELECT`: `SELECT * FROM crew_assignments WHERE is_deleted = false AND is_current = true AND sign_off_date IS NOT NULL ORDER BY created_at, assign_uuid LIMIT 3`
- `C-7b-count` — begins with `SELECT`: `SELECT COUNT(*) AS row_count FROM crew_assignments WHERE is_deleted = false AND assignment_type = 'OnBoard' AND sign_on_date IS NULL`
- `C-7b-examples` — begins with `SELECT`: `SELECT * FROM crew_assignments WHERE is_deleted = false AND assignment_type = 'OnBoard' AND sign_on_date IS NULL ORDER BY created_at, assign_uuid LIMIT 3`
- `C-7c-count` — begins with `SELECT`: `SELECT COUNT(*) AS row_count FROM crew_assignments WHERE is_deleted = false AND assignment_type = 'Planned' AND sign_off_date IS NOT NULL`
- `C-7c-examples` — begins with `SELECT`: `SELECT * FROM crew_assignments WHERE is_deleted = false AND assignment_type = 'Planned' AND sign_off_date IS NOT NULL ORDER BY created_at, assign_uuid LIMIT 3`
- `C-7d-count` — begins with `SELECT`: `SELECT COUNT(*) AS row_count FROM crew_assignments ca WHERE ca.is_deleted = false AND NOT EXISTS (SELECT 1 FROM crew_members_v2 cm WHERE cm.crew_uuid = ca.crew_uuid)`
- `C-7d-examples` — begins with `SELECT`: `SELECT ca.* FROM crew_assignments ca WHERE ca.is_deleted = false AND NOT EXISTS (SELECT 1 FROM crew_members_v2 cm WHERE cm.crew_uuid = ca.crew_uuid) ORDER BY ca.created_at, ca.assign_uuid LIMIT 3`
- `C-7e-count` — begins with `SELECT`: `SELECT COUNT(*) AS row_count FROM crew_assignments ca WHERE ca.is_deleted = false AND NOT EXISTS (SELECT 1 FROM master_vessels mv WHERE mv.vessel_uuid = ca.vessel_uuid)`
- `C-7e-examples` — begins with `SELECT`: `SELECT ca.* FROM crew_assignments ca WHERE ca.is_deleted = false AND NOT EXISTS (SELECT 1 FROM master_vessels mv WHERE mv.vessel_uuid = ca.vessel_uuid) ORDER BY ca.created_at, ca.assign_uuid LIMIT 3`
- `C-8-assignments` — begins with `SELECT`: `SELECT * FROM crew_assignments WHERE is_deleted = false AND crew_uuid = $1 AND vessel_uuid = $2 ORDER BY created_at, assign_uuid`
- `C-8-planning` — begins with `SELECT`: `SELECT * FROM vessel_planning_v2 WHERE is_deleted = false AND vessel_uuid = $2 AND (crew_uuid = $1 OR reliever_crew_uuid = $1) ORDER BY created_at, plan_uuid`
- `C-8-sea-service` — begins with `SELECT`: `SELECT * FROM crew_sea_service WHERE is_deleted = false AND crew_uuid = $1 AND vessel_uuid = $2 ORDER BY created_at, sea_uuid`
- `P-provenance-audit-identities` — begins with `SELECT`: `SELECT COALESCE(created_by_uuid, '<NULL>') AS created_by_uuid, COALESCE(updated_by_uuid, '<NULL>') AS updated_by_uuid, COUNT(*) AS row_count FROM crew_assignments GROUP BY created_by_uuid, updated_by_uuid ORDER BY row_count DESC, created_by_uuid, updated_by_uuid`
- `P-provenance-time-type-clusters` — begins with `SELECT`: `SELECT DATE_TRUNC('second', created_at) AS created_second, assignment_type, COUNT(*) AS row_count, MIN(id) AS min_id, MAX(id) AS max_id FROM crew_assignments GROUP BY DATE_TRUNC('second', created_at), assignment_type ORDER BY created_second, assignment_type`
- `P-provenance-known-seed-ids` — begins with `SELECT`: `SELECT assign_uuid, crew_uuid, vessel_uuid, assignment_type, is_current, sign_on_date, sign_off_date, created_at, updated_at, created_by_uuid, updated_by_uuid FROM crew_assignments WHERE assign_uuid = ANY($1::text[]) ORDER BY assign_uuid`
- `F1` — begins with `SELECT`: `SELECT COUNT(*) AS total_rows FROM crew_assignments`
- `F2` — begins with `SELECT`: `SELECT assignment_type, COUNT(*) AS row_count FROM crew_assignments GROUP BY assignment_type ORDER BY assignment_type NULLS FIRST`
- `F3` — begins with `SELECT`: `SELECT is_current, COUNT(*) AS row_count FROM crew_assignments GROUP BY is_current ORDER BY is_current NULLS FIRST`
- `F4` — begins with `SELECT`: `SELECT COUNT(*) AS total_rows FROM vessel_planning_v2`
- `F5` — begins with `SELECT`: `SELECT COUNT(*) AS total_rows FROM crew_sea_service`

## 0. Denominators

### Database and schema confirmation

**SQL**

```sql
SELECT current_database() AS database_name, current_schema() AS schema_name
```

**Raw output**

```text
database_name,schema_name
heliumdb,public

```
### Schema-column confirmation

**SQL**

```sql
SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('crew_assignments', 'vessel_planning_v2', 'crew_sea_service', 'crew_members_v2', 'master_vessels') ORDER BY table_name, ordinal_position
```

**Raw output**

```text
table_name,column_name,data_type
crew_assignments,id,integer
crew_assignments,assign_uuid,text
crew_assignments,crew_uuid,text
crew_assignments,vessel_uuid,text
crew_assignments,is_current,boolean
crew_assignments,sign_on_date,text
crew_assignments,sign_off_date,text
crew_assignments,contract_period,text
crew_assignments,relief_due,text
crew_assignments,port_of_joining_uuid,text
crew_assignments,port_of_leaving_uuid,text
crew_assignments,assignment_type,text
crew_assignments,created_at,timestamp without time zone
crew_assignments,updated_at,timestamp without time zone
crew_assignments,created_by_uuid,text
crew_assignments,updated_by_uuid,text
crew_assignments,is_deleted,boolean
crew_assignments,is_sync,boolean
crew_assignments,last_vessel_uuid,text
crew_assignments,reason,text
crew_members_v2,id,integer
crew_members_v2,crew_uuid,text
crew_members_v2,emp_no,text
crew_members_v2,employee_id,text
crew_members_v2,first_name,text
crew_members_v2,middle_name,text
crew_members_v2,family_name,text
crew_members_v2,gender,text
crew_members_v2,dob,text
crew_members_v2,nationality_uuid,text
crew_members_v2,present_rank,text
crew_members_v2,rank_applied_for,text
crew_members_v2,status,text
crew_members_v2,is_active,boolean
crew_members_v2,uploaded_photo,text
crew_members_v2,source_rec_can_uuid,text
crew_members_v2,archived_at,timestamp without time zone
crew_members_v2,created_at,timestamp without time zone
crew_members_v2,updated_at,timestamp without time zone
crew_members_v2,created_by_uuid,text
crew_members_v2,updated_by_uuid,text
crew_members_v2,is_deleted,boolean
crew_members_v2,is_sync,boolean
crew_members_v2,vessel_type_uuid,text
crew_members_v2,availability,text
crew_members_v2,next_availability,text
crew_members_v2,last_termination_date,text
crew_members_v2,last_termination_reason,text
crew_members_v2,last_termination_category,text
crew_members_v2,termination_initiated_by,text
crew_members_v2,not_for_hire,boolean
crew_members_v2,recruitment_date,text
crew_sea_service,id,integer
crew_sea_service,sea_uuid,text
crew_sea_service,crew_uuid,text
crew_sea_service,service_type,text
crew_sea_service,vessel_name,text
crew_sea_service,vessel_uuid,text
crew_sea_service,vessel_type_uuid,text
crew_sea_service,deadweight,text
crew_sea_service,engine_type_power,text
crew_sea_service,owner_operator,text
crew_sea_service,rank,text
crew_sea_service,from_date,text
crew_sea_service,to_date,text
crew_sea_service,period_months,text
crew_sea_service,experience_categories,ARRAY
crew_sea_service,sort_order,integer
crew_sea_service,created_at,timestamp without time zone
crew_sea_service,updated_at,timestamp without time zone
crew_sea_service,created_by_uuid,text
crew_sea_service,updated_by_uuid,text
crew_sea_service,is_deleted,boolean
crew_sea_service,is_sync,boolean
crew_sea_service,sign_off_reason,text
crew_sea_service,attachment_ref,text
crew_sea_service,imo_number,text
crew_sea_service,year_built,text
master_vessels,id,integer
master_vessels,vessel_uuid,text
master_vessels,vessel,text
master_vessels,imo_number,text
master_vessels,vessel_type,text
master_vessels,synched_at,timestamp with time zone
master_vessels,flag,text
master_vessels,is_active,boolean
master_vessels,is_deleted,boolean
master_vessels,year_built,text
master_vessels,dead_weight,text
master_vessels,vessel_owner,text
master_vessels,engine_type_power,text
vessel_planning_v2,id,integer
vessel_planning_v2,plan_uuid,text
vessel_planning_v2,vessel_uuid,text
vessel_planning_v2,active_revision_uuid,text
vessel_planning_v2,rank_id,text
vessel_planning_v2,rank,text
vessel_planning_v2,crew_uuid,text
vessel_planning_v2,crew_status,text
vessel_planning_v2,sign_on_date,text
vessel_planning_v2,relief_due,text
vessel_planning_v2,sign_off_date,text
vessel_planning_v2,sign_off_port_uuid,text
vessel_planning_v2,sign_off_reason,text
vessel_planning_v2,relief_status,text
vessel_planning_v2,take_over_date,text
vessel_planning_v2,take_over_confirmation,boolean
vessel_planning_v2,hand_over_date,text
vessel_planning_v2,reliever_crew_uuid,text
vessel_planning_v2,reliever_sign_on_date,text
vessel_planning_v2,joining_port_uuid,text
vessel_planning_v2,joining_status,text
vessel_planning_v2,contract_period_months,integer
vessel_planning_v2,contract_end_range_start_months,integer
vessel_planning_v2,contract_end_range_end_months,integer
vessel_planning_v2,reliever_contract_period_months,integer
vessel_planning_v2,reliever_contract_end_range_start_months,integer
vessel_planning_v2,reliever_contract_end_range_end_months,integer
vessel_planning_v2,deployment_checklist_completed,boolean
vessel_planning_v2,applicable_docs_checked,boolean
vessel_planning_v2,is_archived,boolean
vessel_planning_v2,archived_date,text
vessel_planning_v2,created_at,timestamp with time zone
vessel_planning_v2,updated_at,timestamp with time zone
vessel_planning_v2,created_by_uuid,text
vessel_planning_v2,updated_by_uuid,text
vessel_planning_v2,is_deleted,boolean
vessel_planning_v2,is_sync,boolean
vessel_planning_v2,is_reliever_archived,boolean
vessel_planning_v2,admin_accept,boolean
vessel_planning_v2,planned_confirmed_date,text
vessel_planning_v2,travel_start_date,text
vessel_planning_v2,travel_end_date,text

```
### Opening total assignments

**SQL**

```sql
SELECT COUNT(*) AS total_rows FROM crew_assignments
```

**Raw output**

```text
total_rows
63

```
### Opening assignment type breakdown

**SQL**

```sql
SELECT assignment_type, COUNT(*) AS row_count FROM crew_assignments GROUP BY assignment_type ORDER BY assignment_type NULLS FIRST
```

**Raw output**

```text
assignment_type,row_count
OnBoard,55
Planned,8

```
### Opening current-state breakdown

**SQL**

```sql
SELECT is_current, COUNT(*) AS row_count FROM crew_assignments GROUP BY is_current ORDER BY is_current NULLS FIRST
```

**Raw output**

```text
is_current,row_count
f,35
t,28

```
### Opening planning total

**SQL**

```sql
SELECT COUNT(*) AS total_rows FROM vessel_planning_v2
```

**Raw output**

```text
total_rows
81

```
### Opening sea-service total

**SQL**

```sql
SELECT COUNT(*) AS total_rows FROM crew_sea_service
```

**Raw output**

```text
total_rows
472

```


**Meaning:** At opening there were 63 `crew_assignments` rows: 55 `OnBoard`, 8 `Planned`; 28 current and 35 not current. There were 81 planning rows and 472 sea-service rows.

## 1. Duplicate Planned rows

### Duplicate group and row count

**SQL**

```sql
WITH duplicate_groups AS (SELECT crew_uuid, vessel_uuid, COUNT(*) AS row_count FROM crew_assignments WHERE is_deleted = false AND assignment_type = 'Planned' GROUP BY crew_uuid, vessel_uuid HAVING COUNT(*) > 1) SELECT COUNT(*) AS group_count, COALESCE(SUM(row_count), 0) AS rows_involved FROM duplicate_groups
```

**Raw output**

```text
group_count,rows_involved
0,0

```
### Up to five duplicate groups

**SQL**

```sql
WITH duplicate_groups AS (SELECT crew_uuid, vessel_uuid FROM crew_assignments WHERE is_deleted = false AND assignment_type = 'Planned' GROUP BY crew_uuid, vessel_uuid HAVING COUNT(*) > 1) SELECT ca.crew_uuid, ca.vessel_uuid, ARRAY_AGG(ca.assign_uuid ORDER BY ca.created_at, ca.assign_uuid) AS assign_uuids, ARRAY_AGG(ca.created_at ORDER BY ca.created_at, ca.assign_uuid) AS created_at_values, COUNT(*) AS row_count FROM crew_assignments ca JOIN duplicate_groups dg ON dg.crew_uuid = ca.crew_uuid AND dg.vessel_uuid IS NOT DISTINCT FROM ca.vessel_uuid WHERE ca.is_deleted = false AND ca.assignment_type = 'Planned' GROUP BY ca.crew_uuid, ca.vessel_uuid ORDER BY ca.crew_uuid, ca.vessel_uuid LIMIT 5
```

**Raw output**

```text
crew_uuid,vessel_uuid,assign_uuids,created_at_values,row_count

```


**Meaning:** No non-deleted crew/vessel pair has more than one Planned assignment.

## 2. Multiple current rows per seafarer

### Crew count

**SQL**

```sql
WITH multiple_current AS (SELECT crew_uuid FROM crew_assignments WHERE is_deleted = false AND is_current = true GROUP BY crew_uuid HAVING COUNT(*) > 1) SELECT COUNT(*) AS crew_count FROM multiple_current
```

**Raw output**

```text
crew_count
0

```
### Up to five assignment examples

**SQL**

```sql
WITH multiple_current AS (SELECT crew_uuid FROM crew_assignments WHERE is_deleted = false AND is_current = true GROUP BY crew_uuid HAVING COUNT(*) > 1) SELECT ca.crew_uuid, ca.assign_uuid, ca.vessel_uuid, ca.assignment_type FROM crew_assignments ca JOIN multiple_current mc ON mc.crew_uuid = ca.crew_uuid WHERE ca.is_deleted = false AND ca.is_current = true ORDER BY ca.crew_uuid, ca.created_at, ca.assign_uuid LIMIT 5
```

**Raw output**

```text
crew_uuid,assign_uuid,vessel_uuid,assignment_type

```


**Meaning:** No crew UUID has more than one non-deleted current assignment.

## 3. Signed on but still Planned

### Count

**SQL**

```sql
SELECT COUNT(*) AS row_count FROM crew_assignments ca WHERE ca.is_deleted = false AND ca.assignment_type = 'Planned' AND EXISTS (SELECT 1 FROM vessel_planning_v2 vp WHERE vp.is_deleted = false AND vp.crew_uuid = ca.crew_uuid AND vp.vessel_uuid = ca.vessel_uuid AND vp.sign_on_date IS NOT NULL)
```

**Raw output**

```text
row_count
3

```
### Up to five examples

**SQL**

```sql
SELECT ca.assign_uuid, vp.plan_uuid, ca.crew_uuid, ca.vessel_uuid, vp.sign_on_date AS planning_sign_on_date, ca.assignment_type, ca.sign_on_date AS assignment_sign_on_date FROM crew_assignments ca JOIN vessel_planning_v2 vp ON vp.crew_uuid = ca.crew_uuid AND vp.vessel_uuid = ca.vessel_uuid AND vp.is_deleted = false AND vp.sign_on_date IS NOT NULL WHERE ca.is_deleted = false AND ca.assignment_type = 'Planned' ORDER BY ca.created_at, ca.assign_uuid, vp.plan_uuid LIMIT 5
```

**Raw output**

```text
assign_uuid,plan_uuid,crew_uuid,vessel_uuid,planning_sign_on_date,assignment_type,assignment_sign_on_date
d92219fa-686a-4877-91ba-cff8a249fb2d,e81dbd9b-3db3-4e02-b511-b3206341f3eK,88a9be81-0951-4119-b36a-b4e7d1d17459,24a0fb38-d8bf-43d2-9e8f-206f20578069,2026-02-28,Planned,2026-02-27T18:30:00.000Z
5bc158bd-00c4-494f-ad0d-eaca8967bc28,x01dbd9b-3db3-4e02-b511-b3206341f3eU,5d67cd1e-f6cc-49d4-8cf6-f3502e83c45a,24a0fb38-d8bf-43d2-9e8f-206f20578069,2026-02-28,Planned,2026-02-27T18:30:00.000Z
d08f42d7-cc82-4447-8ae2-e745217748aa,6f3aa34a-59a5-4c1b-b889-2988f24959b8,f8e3aca9-5238-46d1-bb40-d1105f98c3ed,24a0fb38-d8bf-43d2-9e8f-206f20578069,2026-02-28,Planned,2026-02-27T18:30:00.000Z

```


**Meaning:** Three Planned assignment rows correspond to non-deleted planning rows with a sign-on date.

## 4. Signed off but still open

### Count

**SQL**

```sql
SELECT COUNT(*) AS row_count FROM crew_assignments ca WHERE ca.is_deleted = false AND (ca.is_current = true OR ca.sign_off_date IS NULL) AND EXISTS (SELECT 1 FROM vessel_planning_v2 vp WHERE vp.crew_uuid = ca.crew_uuid AND vp.vessel_uuid = ca.vessel_uuid AND vp.sign_off_date IS NOT NULL)
```

**Raw output**

```text
row_count
26

```
### Up to five examples

**SQL**

```sql
SELECT ca.assign_uuid, vp.plan_uuid, ca.crew_uuid, ca.vessel_uuid, ca.is_current, ca.sign_off_date AS assignment_sign_off_date, vp.sign_off_date AS planning_sign_off_date, ca.assignment_type FROM crew_assignments ca JOIN vessel_planning_v2 vp ON vp.crew_uuid = ca.crew_uuid AND vp.vessel_uuid = ca.vessel_uuid AND vp.sign_off_date IS NOT NULL WHERE ca.is_deleted = false AND (ca.is_current = true OR ca.sign_off_date IS NULL) ORDER BY ca.created_at, ca.assign_uuid, vp.plan_uuid LIMIT 5
```

**Raw output**

```text
assign_uuid,plan_uuid,crew_uuid,vessel_uuid,is_current,assignment_sign_off_date,planning_sign_off_date,assignment_type
d92219fa-686a-4877-91ba-cff8a249fb2d,e81dbd9b-3db3-4e02-b511-b3206341f3eK,88a9be81-0951-4119-b36a-b4e7d1d17459,24a0fb38-d8bf-43d2-9e8f-206f20578069,f,,2026-04-09,Planned
5bc158bd-00c4-494f-ad0d-eaca8967bc28,x01dbd9b-3db3-4e02-b511-b3206341f3eU,5d67cd1e-f6cc-49d4-8cf6-f3502e83c45a,24a0fb38-d8bf-43d2-9e8f-206f20578069,f,,2026-04-09,Planned
d08f42d7-cc82-4447-8ae2-e745217748aa,6f3aa34a-59a5-4c1b-b889-2988f24959b8,f8e3aca9-5238-46d1-bb40-d1105f98c3ed,24a0fb38-d8bf-43d2-9e8f-206f20578069,f,,2026-04-09,Planned
3c3f6b3e-7b27-41c7-a10f-0bddafff2188,ff5dec6a-d0cb-4453-9ea2-8f3da634365c,a326a90f-690e-460b-ad3a-bd82e1f621f3,744535d0-841a-11ed-aa7c-7003bca91a86,t,,,OnBoard
f29d650e-56e0-4a99-a3e8-0bbba69bfe66,6ad48919-8f60-474f-86b3-2bd69f336f27,702caa20-94eb-4cc8-89aa-be04afdb262c,744535d0-841a-11ed-aa7c-7003bca91a86,t,,,OnBoard

```


**Meaning:** 26 assignment rows are current or lack a sign-off date while a matching planning row has a sign-off date. The query counts matching assignment rows, as requested.

## 5. Ghost Planned rows from unassign

### Count

**SQL**

```sql
SELECT COUNT(*) AS row_count FROM crew_assignments ca WHERE ca.is_deleted = false AND ca.assignment_type = 'Planned' AND NOT EXISTS (SELECT 1 FROM vessel_planning_v2 vp WHERE vp.is_deleted = false AND vp.vessel_uuid = ca.vessel_uuid AND (vp.crew_uuid = ca.crew_uuid OR vp.reliever_crew_uuid = ca.crew_uuid))
```

**Raw output**

```text
row_count
1

```
### Up to five examples

**SQL**

```sql
SELECT ca.assign_uuid, ca.crew_uuid, ca.vessel_uuid, ca.assignment_type, ca.is_current, ca.created_at, ca.updated_at FROM crew_assignments ca WHERE ca.is_deleted = false AND ca.assignment_type = 'Planned' AND NOT EXISTS (SELECT 1 FROM vessel_planning_v2 vp WHERE vp.is_deleted = false AND vp.vessel_uuid = ca.vessel_uuid AND (vp.crew_uuid = ca.crew_uuid OR vp.reliever_crew_uuid = ca.crew_uuid)) ORDER BY ca.created_at, ca.assign_uuid LIMIT 5
```

**Raw output**

```text
assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,created_at,updated_at
5d09e503-5a52-4008-9c3c-feb4104c6154,93cbfc40-d544-4c76-a03e-5b9651f1b2d4,744535d0-841a-11ed-aa7c-7003bca91a866,Planned,f,2026-06-04 08:00:02.258076,2026-06-04 08:00:02.258076

```


**Meaning:** One Planned assignment has no non-deleted planning row naming that crew UUID as either primary or reliever for the same vessel.

## 6. Missing company sea service

### Count

**SQL**

```sql
SELECT COUNT(*) AS row_count FROM vessel_planning_v2 vp WHERE vp.is_deleted = false AND vp.sign_on_date IS NOT NULL AND vp.crew_status = 'primary' AND NOT EXISTS (SELECT 1 FROM crew_sea_service css WHERE css.is_deleted = false AND css.crew_uuid = vp.crew_uuid AND css.vessel_uuid = vp.vessel_uuid AND css.service_type = 'company')
```

**Raw output**

```text
row_count
10

```
### Up to five examples

**SQL**

```sql
SELECT vp.plan_uuid, vp.crew_uuid, vp.vessel_uuid, vp.sign_on_date, vp.crew_status, vp.created_at, vp.updated_at FROM vessel_planning_v2 vp WHERE vp.is_deleted = false AND vp.sign_on_date IS NOT NULL AND vp.crew_status = 'primary' AND NOT EXISTS (SELECT 1 FROM crew_sea_service css WHERE css.is_deleted = false AND css.crew_uuid = vp.crew_uuid AND css.vessel_uuid = vp.vessel_uuid AND css.service_type = 'company') ORDER BY vp.created_at, vp.plan_uuid LIMIT 5
```

**Raw output**

```text
plan_uuid,crew_uuid,vessel_uuid,sign_on_date,crew_status,created_at,updated_at
b344ed5c-09a2-465c-abd6-da0c9c6041d5,6dddf1d3-c9d5-4577-9baa-e04576757048,24a0fb38-d8bf-43d2-9e8f-206f20578069,2026-02-28,primary,2026-02-28 07:35:32.820889+00,2026-04-10 10:15:17.642+00
83b49be8-3dae-423e-9ec5-b10c2ef883cc,a340d6af-a846-4f56-b236-6d8822745192,24a0fb38-d8bf-43d2-9e8f-206f20578069,2026-02-28,primary,2026-02-28 07:35:32.822924+00,2026-04-10 10:15:26.215+00
a668070b-23b1-4fa6-8adc-53fecd818ca3,5560a1f5-3d0c-440b-80ec-600bf6536052,24a0fb38-d8bf-43d2-9e8f-206f20578069,2026-02-28,primary,2026-02-28 07:35:32.824632+00,2026-04-10 10:15:37.277+00
68c18d3e-f6e3-4168-92d0-64883584e8f7,c39d6a76-6015-4fa4-9339-1a2b37801ec9,24a0fb38-d8bf-43d2-9e8f-206f20578069,2026-02-28,primary,2026-02-28 07:35:32.826816+00,2026-04-10 10:15:45.892+00
e01dbd9b-3db3-4e02-b511-b3206341f3ef,ba2e1219-a0c1-4838-9945-670b662f96bf,24a0fb38-d8bf-43d2-9e8f-206f20578069,2026-02-28,primary,2026-02-28 07:47:19.307396+00,2026-04-10 10:20:35.056+00

```


**Meaning:** Ten non-deleted primary planning rows with a sign-on date have no matching non-deleted company sea-service row.

## 7. Internal contradictions

### 7a. Current with a sign-off date
### Count

**SQL**

```sql
SELECT COUNT(*) AS row_count FROM crew_assignments WHERE is_deleted = false AND is_current = true AND sign_off_date IS NOT NULL
```

**Raw output**

```text
row_count
0

```
### Up to three examples

**SQL**

```sql
SELECT * FROM crew_assignments WHERE is_deleted = false AND is_current = true AND sign_off_date IS NOT NULL ORDER BY created_at, assign_uuid LIMIT 3
```

**Raw output**

```text
id,assign_uuid,crew_uuid,vessel_uuid,is_current,sign_on_date,sign_off_date,contract_period,relief_due,port_of_joining_uuid,port_of_leaving_uuid,assignment_type,created_at,updated_at,created_by_uuid,updated_by_uuid,is_deleted,is_sync,last_vessel_uuid,reason

```

**Meaning:** 0 rows.

### 7b. OnBoard with no sign-on date
### Count

**SQL**

```sql
SELECT COUNT(*) AS row_count FROM crew_assignments WHERE is_deleted = false AND assignment_type = 'OnBoard' AND sign_on_date IS NULL
```

**Raw output**

```text
row_count
0

```
### Up to three examples

**SQL**

```sql
SELECT * FROM crew_assignments WHERE is_deleted = false AND assignment_type = 'OnBoard' AND sign_on_date IS NULL ORDER BY created_at, assign_uuid LIMIT 3
```

**Raw output**

```text
id,assign_uuid,crew_uuid,vessel_uuid,is_current,sign_on_date,sign_off_date,contract_period,relief_due,port_of_joining_uuid,port_of_leaving_uuid,assignment_type,created_at,updated_at,created_by_uuid,updated_by_uuid,is_deleted,is_sync,last_vessel_uuid,reason

```

**Meaning:** 0 rows.

### 7c. Planned with a sign-off date
### Count

**SQL**

```sql
SELECT COUNT(*) AS row_count FROM crew_assignments WHERE is_deleted = false AND assignment_type = 'Planned' AND sign_off_date IS NOT NULL
```

**Raw output**

```text
row_count
0

```
### Up to three examples

**SQL**

```sql
SELECT * FROM crew_assignments WHERE is_deleted = false AND assignment_type = 'Planned' AND sign_off_date IS NOT NULL ORDER BY created_at, assign_uuid LIMIT 3
```

**Raw output**

```text
id,assign_uuid,crew_uuid,vessel_uuid,is_current,sign_on_date,sign_off_date,contract_period,relief_due,port_of_joining_uuid,port_of_leaving_uuid,assignment_type,created_at,updated_at,created_by_uuid,updated_by_uuid,is_deleted,is_sync,last_vessel_uuid,reason

```

**Meaning:** 0 rows.

### 7d. Assignment crew absent from crew master
### Count

**SQL**

```sql
SELECT COUNT(*) AS row_count FROM crew_assignments ca WHERE ca.is_deleted = false AND NOT EXISTS (SELECT 1 FROM crew_members_v2 cm WHERE cm.crew_uuid = ca.crew_uuid)
```

**Raw output**

```text
row_count
0

```
### Up to three examples

**SQL**

```sql
SELECT ca.* FROM crew_assignments ca WHERE ca.is_deleted = false AND NOT EXISTS (SELECT 1 FROM crew_members_v2 cm WHERE cm.crew_uuid = ca.crew_uuid) ORDER BY ca.created_at, ca.assign_uuid LIMIT 3
```

**Raw output**

```text
id,assign_uuid,crew_uuid,vessel_uuid,is_current,sign_on_date,sign_off_date,contract_period,relief_due,port_of_joining_uuid,port_of_leaving_uuid,assignment_type,created_at,updated_at,created_by_uuid,updated_by_uuid,is_deleted,is_sync,last_vessel_uuid,reason

```

**Meaning:** 0 rows.

### 7e. Assignment vessel absent from vessel master
### Count

**SQL**

```sql
SELECT COUNT(*) AS row_count FROM crew_assignments ca WHERE ca.is_deleted = false AND NOT EXISTS (SELECT 1 FROM master_vessels mv WHERE mv.vessel_uuid = ca.vessel_uuid)
```

**Raw output**

```text
row_count
6

```
### Up to three examples

**SQL**

```sql
SELECT ca.* FROM crew_assignments ca WHERE ca.is_deleted = false AND NOT EXISTS (SELECT 1 FROM master_vessels mv WHERE mv.vessel_uuid = ca.vessel_uuid) ORDER BY ca.created_at, ca.assign_uuid LIMIT 3
```

**Raw output**

```text
id,assign_uuid,crew_uuid,vessel_uuid,is_current,sign_on_date,sign_off_date,contract_period,relief_due,port_of_joining_uuid,port_of_leaving_uuid,assignment_type,created_at,updated_at,created_by_uuid,updated_by_uuid,is_deleted,is_sync,last_vessel_uuid,reason
63,d92219fa-686a-4877-91ba-cff8a249fb2d,88a9be81-0951-4119-b36a-b4e7d1d17459,24a0fb38-d8bf-43d2-9e8f-206f20578069,f,2026-02-27T18:30:00.000Z,,9,,,,Planned,2026-02-28 07:47:19.312828,2026-02-28 07:47:19.312828,unknown,unknown,f,f,,
65,5bc158bd-00c4-494f-ad0d-eaca8967bc28,5d67cd1e-f6cc-49d4-8cf6-f3502e83c45a,24a0fb38-d8bf-43d2-9e8f-206f20578069,f,2026-02-27T18:30:00.000Z,,9,,,,Planned,2026-02-28 07:47:19.363967,2026-02-28 07:47:19.363967,unknown,unknown,f,f,,
67,d08f42d7-cc82-4447-8ae2-e745217748aa,f8e3aca9-5238-46d1-bb40-d1105f98c3ed,24a0fb38-d8bf-43d2-9e8f-206f20578069,f,2026-02-27T18:30:00.000Z,,9,,,,Planned,2026-02-28 07:47:19.393866,2026-02-28 07:47:19.393866,unknown,unknown,f,f,,

```

**Meaning:** 6 non-deleted assignments reference a vessel UUID absent from `master_vessels`.

## 8. Known record

### All non-deleted assignment rows

**SQL**

```sql
SELECT * FROM crew_assignments WHERE is_deleted = false AND crew_uuid = $1 AND vessel_uuid = $2 ORDER BY created_at, assign_uuid
```

**Parameters**

```json
["f8e3aca9-5238-46d1-bb40-d1105f98c3ed","24a0fb38-d8bf-43d2-9e8f-206f20578069"]
```

**Raw output**

```text
id,assign_uuid,crew_uuid,vessel_uuid,is_current,sign_on_date,sign_off_date,contract_period,relief_due,port_of_joining_uuid,port_of_leaving_uuid,assignment_type,created_at,updated_at,created_by_uuid,updated_by_uuid,is_deleted,is_sync,last_vessel_uuid,reason
67,d08f42d7-cc82-4447-8ae2-e745217748aa,f8e3aca9-5238-46d1-bb40-d1105f98c3ed,24a0fb38-d8bf-43d2-9e8f-206f20578069,f,2026-02-27T18:30:00.000Z,,9,,,,Planned,2026-02-28T07:47:19.393Z,2026-02-28T07:47:19.393Z,unknown,unknown,f,f,,

```
### All non-deleted matching planning rows

**SQL**

```sql
SELECT * FROM vessel_planning_v2 WHERE is_deleted = false AND vessel_uuid = $2 AND (crew_uuid = $1 OR reliever_crew_uuid = $1) ORDER BY created_at, plan_uuid
```

**Parameters**

```json
["f8e3aca9-5238-46d1-bb40-d1105f98c3ed","24a0fb38-d8bf-43d2-9e8f-206f20578069"]
```

**Raw output**

```text
id,plan_uuid,vessel_uuid,active_revision_uuid,rank_id,rank,crew_uuid,crew_status,sign_on_date,relief_due,sign_off_date,sign_off_port_uuid,sign_off_reason,relief_status,take_over_date,take_over_confirmation,hand_over_date,reliever_crew_uuid,reliever_sign_on_date,joining_port_uuid,joining_status,contract_period_months,contract_end_range_start_months,contract_end_range_end_months,reliever_contract_period_months,reliever_contract_end_range_start_months,reliever_contract_end_range_end_months,deployment_checklist_completed,applicable_docs_checked,is_archived,archived_date,created_at,updated_at,created_by_uuid,updated_by_uuid,is_deleted,is_sync,is_reliever_archived,admin_accept,planned_confirmed_date,travel_start_date,travel_end_date
90,6f3aa34a-59a5-4c1b-b889-2988f24959b8,24a0fb38-d8bf-43d2-9e8f-206f20578069,,R015,AB_1,f8e3aca9-5238-46d1-bb40-d1105f98c3ed,primary,2026-02-28,2026-11-28,2026-04-09,,Terminated,Signed Off,,f,,,,,,9,,,,,,,,t,2026-04-10,2026-02-28T08:15:36.463Z,2026-04-10T10:16:46.474Z,,,f,f,f,t,,,

```
### All non-deleted matching sea-service rows

**SQL**

```sql
SELECT * FROM crew_sea_service WHERE is_deleted = false AND crew_uuid = $1 AND vessel_uuid = $2 ORDER BY created_at, sea_uuid
```

**Parameters**

```json
["f8e3aca9-5238-46d1-bb40-d1105f98c3ed","24a0fb38-d8bf-43d2-9e8f-206f20578069"]
```

**Raw output**

```text
id,sea_uuid,crew_uuid,service_type,vessel_name,vessel_uuid,vessel_type_uuid,deadweight,engine_type_power,owner_operator,rank,from_date,to_date,period_months,experience_categories,sort_order,created_at,updated_at,created_by_uuid,updated_by_uuid,is_deleted,is_sync,sign_off_reason,attachment_ref,imo_number,year_built

```


**Classification:** The assignment `d08f42d7-cc82-4447-8ae2-e745217748aa` is **not consistent** with the matching planning row. It is still `Planned`, has no `sign_off_date`, and is not current; the planning row records `sign_on_date = 2026-02-28`, `sign_off_date = 2026-04-09`, `relief_status = Signed Off`, and `is_archived = true`. It falls into check 3 (signed on but still Planned), check 4 (signed off but still open), and check 7e (vessel absent from master). It does not fall into check 1, 2, 5, 7a, 7b, 7c, or 7d. It also contributes to check 6 because its matching primary planning row has no company sea-service row.

## 9. How the development data was made

### Assignment audit-identity distribution

**SQL**

```sql
SELECT COALESCE(created_by_uuid, '<NULL>') AS created_by_uuid, COALESCE(updated_by_uuid, '<NULL>') AS updated_by_uuid, COUNT(*) AS row_count FROM crew_assignments GROUP BY created_by_uuid, updated_by_uuid ORDER BY row_count DESC, created_by_uuid, updated_by_uuid
```

**Raw output**

```text
created_by_uuid,updated_by_uuid,row_count
unknown,<NULL>,49
unknown,unknown,8
<NULL>,<NULL>,5
unknown,13c6eeb9-e20d-11ed-bdf2-06f16491c73e,1

```
### Assignment creation-time/type clusters

**SQL**

```sql
SELECT DATE_TRUNC('second', created_at) AS created_second, assignment_type, COUNT(*) AS row_count, MIN(id) AS min_id, MAX(id) AS max_id FROM crew_assignments GROUP BY DATE_TRUNC('second', created_at), assignment_type ORDER BY created_second, assignment_type
```

**Raw output**

```text
created_second,assignment_type,row_count,min_id,max_id
2026-02-28 07:47:19,OnBoard,6,61,69
2026-02-28 07:47:19,Planned,3,63,67
2026-02-28 07:47:21,OnBoard,1,70,70
2026-02-28 07:47:32,OnBoard,9,71,79
2026-02-28 07:47:34,OnBoard,1,80,80
2026-02-28 07:59:52,OnBoard,2,81,82
2026-02-28 07:59:53,OnBoard,1,83,83
2026-04-10 04:59:20,OnBoard,5,84,88
2026-04-10 04:59:21,OnBoard,1,89,89
2026-04-10 04:59:33,OnBoard,5,90,94
2026-04-10 04:59:34,OnBoard,1,95,95
2026-04-10 04:59:41,OnBoard,6,96,101
2026-04-10 04:59:47,OnBoard,3,102,104
2026-04-10 04:59:48,OnBoard,1,105,105
2026-04-14 09:18:58,OnBoard,2,106,107
2026-04-14 09:36:45,OnBoard,2,108,109
2026-04-14 11:42:33,OnBoard,1,110,110
2026-04-14 11:47:07,OnBoard,1,111,111
2026-04-16 11:15:02,OnBoard,2,112,113
2026-05-06 13:00:06,Planned,2,114,115
2026-06-02 07:53:43,Planned,2,116,117
2026-06-04 08:00:02,Planned,1,118,118
2026-07-27 13:24:28,OnBoard,5,146,150

```
### Known seed UUID verification

**SQL**

```sql
SELECT assign_uuid, crew_uuid, vessel_uuid, assignment_type, is_current, sign_on_date, sign_off_date, created_at, updated_at, created_by_uuid, updated_by_uuid FROM crew_assignments WHERE assign_uuid = ANY($1::text[]) ORDER BY assign_uuid
```

**Parameters**

```json
[["c4ec0000-0000-4000-8000-0000000000a1","c4ec0000-0000-4000-8000-0000000000a2","c4ec0000-0000-4000-8000-0000000000a3","c4ec0000-0000-4000-8000-0000000000a4","c4ec0000-0000-4000-8000-0000000000a5"]]
```

**Raw output**

```text
assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,sign_on_date,sign_off_date,created_at,updated_at,created_by_uuid,updated_by_uuid
c4ec0000-0000-4000-8000-0000000000a1,c4ec0000-0000-4000-8000-0000000000c1,c4ec0000-0000-4000-8000-000000000001,OnBoard,t,2026-03-01,,2026-07-27T13:24:28.376Z,2026-07-27T13:24:40.095Z,,
c4ec0000-0000-4000-8000-0000000000a2,c4ec0000-0000-4000-8000-0000000000c2,c4ec0000-0000-4000-8000-000000000001,OnBoard,t,2026-03-01,,2026-07-27T13:24:28.389Z,2026-07-27T13:24:40.111Z,,
c4ec0000-0000-4000-8000-0000000000a3,c4ec0000-0000-4000-8000-0000000000c3,c4ec0000-0000-4000-8000-000000000001,OnBoard,t,2026-03-01,,2026-07-27T13:24:28.396Z,2026-07-27T13:24:40.120Z,,
c4ec0000-0000-4000-8000-0000000000a4,c4ec0000-0000-4000-8000-0000000000c4,c4ec0000-0000-4000-8000-000000000001,OnBoard,t,2026-03-01,,2026-07-27T13:24:28.404Z,2026-07-27T13:24:40.132Z,,
c4ec0000-0000-4000-8000-0000000000a5,c4ec0000-0000-4000-8000-0000000000c5,c4ec0000-0000-4000-8000-000000000001,OnBoard,f,2026-03-15,2026-04-20,2026-07-27T13:24:28.412Z,2026-07-27T13:24:40.141Z,,

```


**Source evidence inspected:**

- `scripts/seed-test-script-data.ts:120-145` contains an idempotent assignment seed path. It looks up by crew, vessel, and sign-on date; updates by `assign_uuid`; and inserts five stable assignment UUIDs.
- `migrations/0069_create_crew_pool_v2_tables.sql:41-70` creates the table; `migrations/0072_add_missing_v2_crew_columns.sql:24-29` alters it. No migration insert/update into `crew_assignments` was found.
- Integration-test fixtures insert assignment rows in `tests/integration/api/vessel-initiated-workflow.test.ts`, `wage-engine.test.ts`, `contract-detail.test.ts`, and `promotions.test.ts`.
- Application paths can create or update assignments through the rotation deploy, crew-assignment, vessel-planning, and vessel-list-import flows recorded in answer 10.

**Meaning:** This database is a **mixture** in the limited sense established by evidence: five rows exactly match the seed script’s stable UUIDs and values, and code/test/fixture paths also exist. The remaining 58 rows cannot be attributed to UI actions, a particular seed execution, imports, tests, or direct SQL from the available row metadata. The `unknown` and null audit identities are not proof of any writer. Whether the observed inconsistencies were created by an application path or hand-inserted test data is therefore **UNKNOWN** for each non-seed row.

## 10. Every crew_assignments read and write path

The following is the exhaustive source inventory of application, script, and test paths found by read-only search. It includes file and line ranges, selected/inserted/updated columns, lookup predicates, and whether each SELECT itself can return multiple rows.

Definitive second-pass inventory of every `crewAssignments`/`crew_assignments` SELECT/INSERT/UPDATE found by read-only rg. SQL column lists and predicates below are verbatim source expressions; Drizzle column names are the actual selected/set columns.

## SELECT

- `server/v2/crew-pool/services/crewAssignmentsService.ts:181-191`: `SELECT * FROM crew_assignments WHERE crew_uuid = crewUuid AND is_current = true AND assignment_type = 'primary' LIMIT 1`. Selected columns: all. SQL max 1 because LIMIT 1. Lookup is crewUuid + current + type, not assignUuid.
- `server/v2/crew-pool/services/crewAssignmentsService.ts:229-244`: all columns; `WHERE and(eq(crewAssignments.crewUuid, crewUuid), eq(crewAssignments.isDeleted, false))`, emitted predicate `crew_uuid = crewUuid AND is_deleted = false`; no SQL limit unless caller supplies `limit`, so multiple.
- `server/v2/crew-pool/services/crewAssignmentsService.ts:266-269`: all columns; dynamically `WHERE and(...conditions)`, conditions are `vessel_uuid = vesselUuid`, `is_current = true`, `is_deleted = false`, plus (when `includeSecondary=false`) `assignment_type = 'primary'`; multiple.
- `server/v2/crew-pool/repositories/crewAssignmentsRepository.ts:11-23`: all columns; verbatim builder predicate `and(eq(crewAssignments.crewUuid, crewUuid), eq(crewAssignments.isDeleted, false))` (`crew_uuid = ? AND is_deleted = false`); multiple.
- `:25-37`: all columns; `and(eq(crewAssignments.assignUuid, assignUuid), eq(crewAssignments.isDeleted, false))` (`assign_uuid = ? AND is_deleted = false`); no LIMIT, so SQL can return multiple in principle, although assign_uuid is intended unique; wrapper returns `results[0]`.
- `:39-52`: all columns; `and(eq(crewAssignments.crewUuid, crewUuid), eq(crewAssignments.isCurrent, true), eq(crewAssignments.isDeleted, false))`; no LIMIT, SQL can return multiple; wrapper returns first.
- `:90-101`: invokes the preceding `findByUuid` SELECT (same exact operation), then uses its result only to obtain crewUuid; no additional SELECT.
- `server/v2/crew-pool/services/crewMembersService.ts:575-591`: subquery columns `crewUuid, vesselUuid, signOnDate, reliefDue, contractPeriod`; `WHERE and(eq(isCurrent,true),eq(isDeleted,false))`; `DISTINCT ON (crewUuid)`, ordered `crewUuid, signOnDate DESC, id DESC`; SQL returns max one per crewUuid, potentially many total.
- `:678-699`: columns `crewUuid, vesselUuid, masterVessels.vessel AS vesselName, signOffDate, reason`; join `crewAssignments.vesselUuid = masterVessels.vesselUuid`; WHERE `inArray(crewAssignments.crewUuid, crewUuids), eq(isCurrent,false), eq(isDeleted,false), isNotNull(signOffDate)`; multiple. Application subsequently keeps first per crew.
- `:891-909`: columns `crewUuid, vesselUuid, vesselName, signOffDate`; same vessel left join; WHERE `inArray(crewAssignments.crewUuid, crewUuids), eq(isDeleted,false)`; multiple. Application keeps first per crew.
- `server/v2/accounts/engine/engineReads.ts:498-514`: columns `assignUuid, crewUuid, signOnDate, signOffDate`; `WHERE and(eq(vesselUuid,vesselUuid), eq(isDeleted,false))`; multiple; month overlap is application filtering after SQL.
- `server/v2/accounts/repositories/engagementsRepository.ts:218-226`: `select()` all columns; `WHERE and(eq(vesselUuid,vesselUuid), eq(isDeleted,false))`; multiple.
- `server/v2/crew-pool/services/dashboardService.ts:410-434`: selected `assignUuid, vesselUuid, masterVessels.vessel AS vesselName, masterVessels.imoNumber AS vesselImo, isCurrent, signOnDate, signOffDate, reliefDue`; left join `crewAssignments.vesselUuid = masterVessels.vesselUuid`; WHERE `crewUuid = crewUuid AND isDeleted = false AND isCurrent = true AND signOffDate IS NULL`; ORDER BY signOnDate; no LIMIT, multiple.
- `server/v2/reports/handlers/crewPool.ts:44-52` (`cpAssignmentVesselExpr`): scalar selected column `crew_assignments.vessel_uuid`; exact raw SQL WHERE `crew_assignments.crew_uuid = crew_members_v2.crew_uuid AND crew_assignments.is_current = TRUE AND crew_assignments.is_deleted = FALSE`; ORDER BY `crew_assignments.sign_on_date DESC, crew_assignments.id DESC`; `LIMIT 1`, therefore max one per outer crew row. This is a correlated lookup by crew_uuid, not assign_uuid.
- `server/v2/rest-hours/controllers/masterDataController.ts:39-63`: first query selects `crewAssignments` (all assignment columns) plus explicit `vesselUuid, assignmentType, signOnDate, signOffDate`; join `eq(crewMembersV2.crewUuid, crewAssignments.crewUuid)`; full WHERE is the surrounding controller filter (no limit); multiple. `:88-112`: selected `vesselUuid, signOnDate, signOffDate, isCurrent, crewUuid`; join by crewUuid; WHERE contains `eq(crewAssignments.vesselUuid, vesselId)`, member-not-deleted OR NULL, and `eq(crewAssignments.assignmentType, "OnBoard")`; multiple.
- `server/v2/rest-hours/services/vesselRecordsService.ts:20-42`: selected assignment vessel/crew/date/current fields plus joined crew fields; join by crewUuid; WHERE vesselUuid plus member-not-deleted/member predicates; no LIMIT, multiple.
- `server/v2/rest-hours/services/dailyRecordsService.ts:20-43`: selected crewUuid,vesselUuid,signOnDate,signOffDate,isCurrent plus crew fields; join by crewUuid; WHERE vesselUuid, member-not-deleted, `assignmentType = "OnBoard"`; multiple. `:201-229`: same assignment fields plus crewUuid; WHERE vesselUuid, member-not-deleted, `assignmentType = "OnBoard"`, `signOnDate <= lastDay`, and `(signOffDate IS NULL OR signOffDate = '' OR signOffDate >= firstDay)`; multiple.
- `server/v2/rest-hours/services/crewRecordsService.ts:454-481`: selected `crewUuid,vesselUuid,signOnDate,signOffDate,isCurrent,empNo`; join by crewUuid; WHERE `vesselUuid = vesselId`, member `isDeleted=false OR IS NULL`, `assignmentType = "OnBoard"`, `signOnDate <= lastDay`, and `(signOffDate IS NULL OR signOffDate = '' OR signOffDate >= firstDay)`; multiple. `:652-685`: selected same assignment fields plus `firstName,familyName,presentRank,empNo`; exact same predicate; multiple.
- `server/v2/drugs-alcohol/controllers/crewController.ts:20-38`: selected `presentVessel: vesselUuid`, `signOnDate`, `assignmentType`; join by crewUuid; WHERE `crewAssignments.crewUuid = crewUuid`, `crewAssignments.vesselUuid = vesselUuid`, `crewAssignments.isCurrent = true`, `crewAssignments.isDeleted = false`; no LIMIT, multiple.
- `server/v2/vessel/services/vesselCrewListImportService.ts:1095-1114`: selected `assignUuid,crewUuid,vesselUuid,assignmentType,signOnDate,reliefDue,contractPeriod`; WHERE `inArray(crewAssignments.crewUuid, allCrewUuidsForCheck), eq(crewAssignments.isDeleted, false)`; multiple. Application deduplicates by composite `crew|vessel|type|signOnDate`.
- `server/v2/vessel/services/vesselPlanningService.ts:1649-1662`: selected `vesselUuid, masterVessels.vessel AS vesselName`; left join on vesselUuid; WHERE `crewUuid = crewUuid AND isCurrent = true AND isDeleted = false`; no LIMIT, multiple. Application uses `.find()` (first matching row).

## INSERT

- `server/v2/crew-pool/services/crewAssignmentsService.ts:137-160`: inserted columns `assignUuid, crewUuid, vesselUuid, signOnDate, reliefDue, contractPeriod, assignmentType, isCurrent, createdAt, auditUserUuid` (plus fields produced by `applyAuditUser`); no predicate.
- `server/v2/crew-pool/repositories/crewAssignmentsRepository.ts:72-79`: inserted all supplied `data` columns plus generated `assignUuid`; no predicate.
- `server/v2/rotation/services/rotationDeployService.ts:190-203`: inserted `assignUuid, crewUuid, vesselUuid, isCurrent, signOnDate, contractPeriod, portOfJoiningUuid, assignmentType, createdByUuid, updatedByUuid`; values include `isCurrent:false`, `assignmentType:"Planned"`; no predicate.
- `server/v2/vessel/services/vesselCrewListImportService.ts:1251-1264`: inserted `assignUuid, crewUuid, vesselUuid, isCurrent, signOnDate, reliefDue, contractPeriod, assignmentType, portOfJoiningUuid, isDeleted, createdByUuid, updatedByUuid`; no predicate.
- `tests/integration/api/promotions.test.ts:228-233`: Drizzle insert columns `assignUuid, crewUuid, vesselUuid, isCurrent`; no predicate.
- `tests/integration/api/vessel-initiated-workflow.test.ts:289-300`: helper `insert("crew_assignments", {...})`; literal fields supplied are `assign_uuid, crew_uuid, vessel_uuid, sign_on_date` (two rows; no predicate). `tests/integration/api/wage-engine.test.ts:413-418` same four fields. `tests/integration/api/contract-detail.test.ts:225-230` same four fields.
- `scripts/seed-test-script-data.ts:139-145`: raw INSERT columns exactly `(assign_uuid, crew_uuid, vessel_uuid, is_current, sign_on_date, sign_off_date, assignment_type, is_deleted, is_sync, created_at, updated_at)`; values exactly `($1, $2, $3, $4, $5, $6, 'OnBoard', false, false, now(), now())`; no WHERE.

## UPDATE

- `server/v2/crew-pool/services/crewAssignmentsService.ts:119-128`: SET `{isCurrent:false, auditUserUuid}`; WHERE `crewUuid = crewUuid AND assignmentType = "primary" AND isCurrent = true`; multiple. `:203-214`: SET `signOffDate, reason, isCurrent:false, auditUserUuid`; WHERE `assignUuid = current.assignUuid`; intended one.
- `server/v2/crew-pool/repositories/crewAssignmentsRepository.ts:61-69`: SET `isCurrent:false, updatedAt: sqlnow()`; WHERE `crewUuid = data.crewUuid AND isCurrent=true`; multiple. `:92-101`: same SET, WHERE existing crewUuid + current; multiple. `:104-109`: SET spread `data, updatedAt: sqlnow()`; WHERE `assignUuid = assignUuid`; intended one. `:114-118`: SET `isDeleted:true, updatedAt: sqlnow()`; WHERE assignUuid. `:138-148`: SET current false WHERE crewUuid (all rows), then SET current true WHERE assignUuid (intended one).
- `server/v2/rotation/services/rotationDeployService.ts:174-186`: SET `isCurrent:false, updatedByUuid`; WHERE `crewUuid = entry.crewUuid AND isCurrent=true AND assignmentType = "Planned"`; multiple.
- `server/v2/vessel/services/vesselCrewListImportService.ts:1219-1229`: SET `reliefDue, contractPeriod, updatedAt, updatedByUuid`; WHERE `assignUuid = existingAssignment.assignUuid`; intended one. `:1235-1248`: SET `isCurrent:false, updatedAt, updatedByUuid`; WHERE `crewUuid = crew.crewUuid AND assignmentType IN ("OnBoard","primary") AND isCurrent=true`; multiple.
- `server/v2/vessel/services/vesselPlanningService.ts:959-975`: SET `reliefDue, contractPeriod, updatedByUuid, updatedAt: sql
dNOW()
d`; WHERE `crewUuid = effectiveCrewUuid AND vesselUuid = existing.vesselUuid AND isCurrent=true AND assignmentType="OnBoard"`; multiple. `:1027-1042`: SET `signOffDate, reason, isCurrent:false, updatedAt: sql
NOW(), updatedByUuid`; WHERE `crewUuid=crewUuid AND vesselUuid=vesselUuid AND isCurrent=true`; multiple. `:1407-1423` and `:1457-1473`: both SET `isCurrent:true, assignmentType="OnBoard", signOnDate, contractPeriod, reliefDue, updatedByUuid`; WHERE `crewUuid=relieverCrewUuid AND vesselUuid=vesselUuid AND isCurrent=false AND assignmentType="Planned"`; multiple possible (no assignUuid lookup).
- `scripts/seed-test-script-data.ts:129-135`: raw SET `sign_off_date = $2, is_current = $3, assignment_type = 'OnBoard', is_deleted = false, updated_at = now()`; WHERE `assign_uuid = $1`; intended one.
- `tests/integration/api/contract-detail.test.ts:676`: raw SQL exactly `UPDATE crew_assignments SET sign_off_date = $1 WHERE assign_uuid = $2`; intended one.

## Other direct occurrences / exclusions

- `server/v2/reports/handlers/crewPool.ts:17-27,31-40,54-72` contain other scalar SELECTs but against `vessel_planning_v2`, not crew_assignments; only `:44-52` belongs in this inventory.
- `server/v2/vessel/services/vesselPlanningService.ts:1654+` is the assignment SELECT above; the following `activePlanning` SELECT is vessel_planning_v2 and excluded.
- `DELETE` occurrences (not requested for required inventory): `tests/integration/api/vessel-initiated-workflow.test.ts:366`, `wage-engine.test.ts:592`, `contract-detail.test.ts:281`, `promotions.test.ts:239-240`, plus repository hard/soft delete at `server/v2/crew-pool/repositories/crewAssignmentsRepository.ts:112-128`.
- `migrations/0069_create_crew_pool_v2_tables.sql:41-~70` is CREATE TABLE, `:529-531` indexes; `migrations/0072_add_missing_v2_crew_columns.sql:24-29` ALTER TABLE. No migration INSERT/UPDATE seed was found. `shared/v2/crew-pool/schema.ts:78+` and `shared/v2/crew-pool/types.ts:6,48,252-253` are declarations/types, excluded.

## Seed literal metadata

`scripts/seed-test-script-data.ts:26-50` contains literal `MV CHECKMATE`; stable vessel UUID `c4ec0000-0000-4000-8000-000000000001`; five literal crew UUIDs/assignment UUIDs ending `c1..c5`/`a1..a5`; employee numbers `CHKMT-C1`..`CHKMT-C5`; names JOHN MASTERSON, CARLOS OFICIAL, ANDRES BODEGA, BEN DECKER, SAMUEL PARTIDA; rank codes R001/R002/R015; sign-on dates 2026-03-01 (C1-C4), 2026-03-15 (C5), and sign-off 2026-04-20 for C5. These are source literals, not evidence that rows exist. No database query was run; current code cannot prove execution history, tenant, or existing row contents.

## Closing denominator verification — final database action

These five statements were the final database action of this audit. They are the same denominator statements used at opening.

### Closing denominator 1

**SQL**

```sql
SELECT COUNT(*) AS total_rows FROM crew_assignments
```

**Raw output**

```text
total_rows
63

```
### Closing denominator 2

**SQL**

```sql
SELECT assignment_type, COUNT(*) AS row_count FROM crew_assignments GROUP BY assignment_type ORDER BY assignment_type NULLS FIRST
```

**Raw output**

```text
assignment_type,row_count
OnBoard,55
Planned,8

```
### Closing denominator 3

**SQL**

```sql
SELECT is_current, COUNT(*) AS row_count FROM crew_assignments GROUP BY is_current ORDER BY is_current NULLS FIRST
```

**Raw output**

```text
is_current,row_count
f,35
t,28

```
### Closing denominator 4

**SQL**

```sql
SELECT COUNT(*) AS total_rows FROM vessel_planning_v2
```

**Raw output**

```text
total_rows
81

```
### Closing denominator 5

**SQL**

```sql
SELECT COUNT(*) AS total_rows FROM crew_sea_service
```

**Raw output**

```text
total_rows
472

```


**Meaning:** Closing values exactly match opening values: 63 assignments; 55 OnBoard and 8 Planned; 28 current and 35 not current; 81 planning rows; 472 sea-service rows.

## Git verification

Final `git status --short` output after committing the audit artifacts:

```text
(no output)
```

The final committed task delivery and its resulting HEAD are reported with the task completion message. The report itself and the amended task plan are the only task artifacts added; no code, migration, schema, or data change was made.
