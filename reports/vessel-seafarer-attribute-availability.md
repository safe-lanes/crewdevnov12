# Vessel and Seafarer Attribute Availability

Read-only investigation performed against the development database. No application
code, schema, migration, or database row was changed.

Blank means `NULL` or, for text columns, an empty/whitespace-only value. Vessel
counts exclude rows where `master_vessels.is_deleted = true`. Crew counts exclude
rows where `crew_members_v2.is_deleted = true`.

## 1. Vessel master — what exists

### Column definitions

**SQL**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'master_vessels'
ORDER BY ordinal_position;
```

**Raw output**

```text
column_name,data_type,is_nullable
id,integer,NO
vessel_uuid,text,YES
vessel,text,YES
imo_number,text,YES
vessel_type,text,YES
synched_at,timestamp with time zone,YES
flag,text,YES
is_active,boolean,YES
is_deleted,boolean,YES
year_built,text,YES
dead_weight,text,YES
vessel_owner,text,YES
engine_type_power,text,YES
```

Code definition: `shared/schema.ts:1220-1247`.

### Population of every column

**SQL**

```sql
WITH live AS (
  SELECT * FROM master_vessels WHERE COALESCE(is_deleted, false) = false
)
SELECT * FROM (
  SELECT 1 AS ordinal, 'id' AS column_name,
    COUNT(*) FILTER (WHERE id IS NOT NULL) AS populated_count,
    COUNT(*) FILTER (WHERE id IS NULL) AS blank_count FROM live
  UNION ALL SELECT 2, 'vessel_uuid',
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(vessel_uuid), '') IS NOT NULL),
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(vessel_uuid), '') IS NULL) FROM live
  UNION ALL SELECT 3, 'vessel',
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(vessel), '') IS NOT NULL),
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(vessel), '') IS NULL) FROM live
  UNION ALL SELECT 4, 'imo_number',
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(imo_number), '') IS NOT NULL),
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(imo_number), '') IS NULL) FROM live
  UNION ALL SELECT 5, 'vessel_type',
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(vessel_type), '') IS NOT NULL),
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(vessel_type), '') IS NULL) FROM live
  UNION ALL SELECT 6, 'synched_at',
    COUNT(*) FILTER (WHERE synched_at IS NOT NULL),
    COUNT(*) FILTER (WHERE synched_at IS NULL) FROM live
  UNION ALL SELECT 7, 'flag',
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(flag), '') IS NOT NULL),
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(flag), '') IS NULL) FROM live
  UNION ALL SELECT 8, 'is_active',
    COUNT(*) FILTER (WHERE is_active IS NOT NULL),
    COUNT(*) FILTER (WHERE is_active IS NULL) FROM live
  UNION ALL SELECT 9, 'is_deleted',
    COUNT(*) FILTER (WHERE is_deleted IS NOT NULL),
    COUNT(*) FILTER (WHERE is_deleted IS NULL) FROM live
  UNION ALL SELECT 10, 'year_built',
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(year_built), '') IS NOT NULL),
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(year_built), '') IS NULL) FROM live
  UNION ALL SELECT 11, 'dead_weight',
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(dead_weight), '') IS NOT NULL),
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(dead_weight), '') IS NULL) FROM live
  UNION ALL SELECT 12, 'vessel_owner',
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(vessel_owner), '') IS NOT NULL),
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(vessel_owner), '') IS NULL) FROM live
  UNION ALL SELECT 13, 'engine_type_power',
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(engine_type_power), '') IS NOT NULL),
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(engine_type_power), '') IS NULL) FROM live
) AS counts
ORDER BY ordinal;
```

**Raw output**

```text
ordinal,column_name,populated_count,blank_count
1,id,10,0
2,vessel_uuid,10,0
3,vessel,10,0
4,imo_number,9,1
5,vessel_type,9,1
6,synched_at,10,0
7,flag,1,9
8,is_active,10,0
9,is_deleted,10,0
10,year_built,0,10
11,dead_weight,0,10
12,vessel_owner,0,10
13,engine_type_power,0,10
```

**Meaning:** The working vessel master has ten non-deleted vessels. Core identity
fields are complete. IMO number and vessel type are each populated for nine.
Flag is populated for one row only. Year built, dead weight, vessel owner, and
engine type/power are declared but empty for all ten.

## 2. Vessel master — the four requested attributes

| Attribute | Column exists? | Source | Populated | Plain result |
|---|---:|---|---:|---|
| Flag / flag state / registry | Yes | `master_vessels.flag` | 1 of 10 | Column exists, mostly blank. |
| Vessel owner | Yes | `master_vessels.vessel_owner` | 0 of 10 | Column exists, entirely blank. |
| Trading area / region / limits | No | No `master_vessels` column | 0 of 10 | No column exists. |
| CBA / collective or union agreement | No | No `master_vessels` column | 0 of 10 | No column exists. |

The schema and population SQL/output are in answer 1. Code corroboration is
`shared/schema.ts:1221-1242`.

## 3. The microservice feed

The receiving path is `server/v2/masters/controllers/dataMasterController.ts:330-365`.
It validates `MASTER_DATA_API_URL`, adds the tenant `domain`, fetches the external
JSON document, selects each master-data array through `API_KEY_MAP`, and passes the
array unchanged to `mastersRepo.syncMasterData(...)`.

The vessel sync target and business key are defined at
`server/v2/masters/repositories/mastersRepository.ts:64-74`.

The accepted vessel payload-to-database mapping is defined at
`server/v2/masters/repositories/mastersRepository.ts:130-143`:

| Upstream payload field | Stored field | Database column |
|---|---|---|
| `id` | `id` | `master_vessels.id` |
| `vuid` | `vesselUuid` | `master_vessels.vessel_uuid` |
| `vessel` | `vessel` | `master_vessels.vessel` |
| `imoNumber` | `imoNumber` | `master_vessels.imo_number` |
| `flag` | `flag` | `master_vessels.flag` |
| `vesselType` | `vesselType` | `master_vessels.vessel_type` |
| `yearBuilt` | `yearBuilt` | `master_vessels.year_built` |
| `deadWeightSummer` | `deadWeight` | `master_vessels.dead_weight` |
| `vesselOwner` | `vesselOwner` | `master_vessels.vessel_owner` |
| `engineTypePower` | `engineTypePower` | `master_vessels.engine_type_power` |
| `isActive` | `isActive` | `master_vessels.is_active` |
| `isDeleted` | `isDeleted` | `master_vessels.is_deleted` |

The generic importer copies only mapped non-null/non-undefined values
(`mastersRepository.ts:1097-1117`), validates the business key
(`:1132-1141`), inserts or updates (`:1164-1187`), and soft-deletes local rows
missing from a complete incoming vessel payload (`:1189-1205`).

**Flag and owner conclusion:** `flag` and `vesselOwner` are explicitly supported
payload fields and are mapped into the vessel master; they are not discarded by
this code. Whether the upstream service actually supplied either field in its most
recent runtime response is **UNKNOWN** because the response is untyped, not logged
in this repository, and individual fields are not validated. Current data has one
flag value and no owner values. `engineTypePower` is explicitly documented as not
currently supplied upstream at `shared/schema.ts:1233-1236`.

## 4. Fleet and Group

### Tables and linkage

- Fleet: `master_fleet_groups` with `id`, `fg_uuid`, `name`, `vessels`,
  `synched_at` (`shared/schema.ts:1340-1353`).
- Add Group: `master_additional_groups` with `id`, `ag_uuid`, `name`, `vessels`,
  `synched_at` (`shared/schema.ts:1290-1300`).
- Both are available through `/api/v2/masters` routes
  (`server/v2/masters/routes.ts:18-25`) and repository reads
  (`server/v2/masters/repositories/mastersRepository.ts:396-410,431-445`).
- In both tables, membership is denormalized text containing comma-separated
  vessel names. There is no vessel membership table and no foreign key. Membership
  is resolved by splitting `vessels` and matching it to `master_vessels.vessel`.

There is also a separate admin CRUD table, `adm_vessel_groups_v2`, whose
`vessel_ids` text field currently contains JSON arrays of vessel numeric IDs. It
is not the synchronized Fleet/Add Group pair.

The Vessel Database UI itself currently hardcodes three Fleet options and three
Add Group options rather than reading the master APIs
(`client/src/modules/vessel/VesselModule_v2.tsx:1369-1409`).

### Stored group values

**SQL**

```sql
SELECT 'master_fleet_groups' AS source, id::text, fg_uuid AS group_uuid, name, vessels
FROM master_fleet_groups
UNION ALL
SELECT 'master_additional_groups', id::text, ag_uuid, name, vessels
FROM master_additional_groups
UNION ALL
SELECT 'adm_vessel_groups_v2', id::text, vg_uuid, name, vessel_ids
FROM adm_vessel_groups_v2
WHERE COALESCE(is_deleted, false) = false
ORDER BY source, id;
```

**Raw output**

```text
source,id,group_uuid,name,vessels
adm_vessel_groups_v2,1,06b8d949-d35b-4c1b-851a-b8d0e62f73af,Fleet 1,"[""2"", ""1""]"
adm_vessel_groups_v2,2,517a22f4-5975-4cd8-9ede-96a92d7048b2,Fleet 2,"[""4"", ""3"", ""5""]"
master_additional_groups,1,0015f133-5282-4652-8f2e-c5bd80c30926,Group 1,"vessel 03, vessel 03, vessel 03, vessel 04, vessel 05, vessel 06, vessel 07, vessel 08, vessel 08, vessel 08, vessel 08, vessel 08, vessel 09, vessel 09, vessel 09"
master_additional_groups,2,15de419c-a1ed-4e8a-9ad5-82f8c45a178f,Group 5,"vessel 02, vessel 07, vessel 08, vessel 08, vessel 08, vessel 08, vessel 08, vessel 09, vessel 09, vessel 09, vessel 10, vessel 10, vessel 10, vessel 10, vessel 10, vessel 10, vessel 10"
master_additional_groups,3,18212fb3-6f8a-48d2-b03a-62a388719895,Group 4,"vessel 02, vessel 03, vessel 03, vessel 03, vessel 04, vessel 05, vessel 10, vessel 10, vessel 10, vessel 10, vessel 10, vessel 10, vessel 10"
master_fleet_groups,1,8f303a7c-96de-490b-bea9-e3de5a58e354,Fleet 3,"vessel 08, vessel 09, vessel 10"
master_fleet_groups,2,d971d113-dc53-4756-81a4-e47b816f743c,Fleet 2,"vessel 04, vessel 05, vessel 06, vessel 07"
master_fleet_groups,3,ef419235-5061-4b39-ab30-cffee5112fd2,Fleet 1,"vessel 02, vessel 03"
```

### Assigned vessel counts

**SQL**

```sql
WITH live_vessels AS (
  SELECT vessel FROM master_vessels WHERE COALESCE(is_deleted, false) = false
), fleet_members AS (
  SELECT DISTINCT BTRIM(member) AS vessel
  FROM master_fleet_groups,
       LATERAL regexp_split_to_table(COALESCE(vessels, ''), ',') AS member
  WHERE NULLIF(BTRIM(member), '') IS NOT NULL
), additional_members AS (
  SELECT DISTINCT BTRIM(member) AS vessel
  FROM master_additional_groups,
       LATERAL regexp_split_to_table(COALESCE(vessels, ''), ',') AS member
  WHERE NULLIF(BTRIM(member), '') IS NOT NULL
)
SELECT
  COUNT(*) AS total_live_vessels,
  COUNT(*) FILTER (WHERE fm.vessel IS NOT NULL) AS fleet_assigned,
  COUNT(*) FILTER (WHERE fm.vessel IS NULL) AS fleet_blank,
  COUNT(*) FILTER (WHERE am.vessel IS NOT NULL) AS additional_group_assigned,
  COUNT(*) FILTER (WHERE am.vessel IS NULL) AS additional_group_blank
FROM live_vessels lv
LEFT JOIN fleet_members fm ON fm.vessel = lv.vessel
LEFT JOIN additional_members am ON am.vessel = lv.vessel;
```

**Raw output**

```text
total_live_vessels,fleet_assigned,fleet_blank,additional_group_assigned,additional_group_blank
10,9,1,9,1
```

**Meaning:** Nine of ten live vessels appear in at least one synchronized Fleet,
and nine appear in at least one synchronized Add Group. Duplicate vessel names
inside a group were counted once.

## 5. Seafarer attributes

Nationality and present rank are held directly on `crew_members_v2`.
Manning agent and crew pool are held on the non-deleted
`crew_personal_details` row linked through `crew_uuid`; code definition:
`shared/v2/crew-pool/schema.ts:108-126`.

**SQL**

```sql
WITH live_crew AS (
  SELECT crew_uuid, nationality_uuid, present_rank
  FROM crew_members_v2
  WHERE COALESCE(is_deleted, false) = false
), details AS (
  SELECT crew_uuid, manning_agent, crew_pool,
         ROW_NUMBER() OVER (PARTITION BY crew_uuid ORDER BY id DESC) AS rn
  FROM crew_personal_details
  WHERE COALESCE(is_deleted, false) = false
)
SELECT
  COUNT(*) AS total_non_deleted_crew,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(lc.nationality_uuid), '') IS NOT NULL
  ) AS nationality_populated,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(lc.nationality_uuid), '') IS NULL
  ) AS nationality_blank,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(lc.present_rank), '') IS NOT NULL
  ) AS present_rank_populated,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(lc.present_rank), '') IS NULL
  ) AS present_rank_blank,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(d.manning_agent), '') IS NOT NULL
  ) AS manning_agent_populated,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(d.manning_agent), '') IS NULL
  ) AS manning_agent_blank,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(d.crew_pool), '') IS NOT NULL
  ) AS crew_pool_populated,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(d.crew_pool), '') IS NULL
  ) AS crew_pool_blank
FROM live_crew lc
LEFT JOIN details d ON d.crew_uuid = lc.crew_uuid AND d.rn = 1;
```

**Raw output**

```text
total_non_deleted_crew,nationality_populated,nationality_blank,present_rank_populated,present_rank_blank,manning_agent_populated,manning_agent_blank,crew_pool_populated,crew_pool_blank
134,125,9,133,1,106,28,102,32
```

**Meaning:** There are 134 non-deleted crew members. Present rank is nearly
complete, nationality is populated for 125, while manning agent and crew pool have
larger gaps.

## 6. Vessel type

Vessel type is held in `master_vessels.vessel_type`
(`shared/schema.ts:1229`). It is descriptive text, not a foreign key to
`master_vessel_types`.

**SQL**

```sql
SELECT
  COALESCE(NULLIF(BTRIM(vessel_type), ''), '<BLANK>') AS vessel_type,
  COUNT(*) AS vessel_count
FROM master_vessels
WHERE COALESCE(is_deleted, false) = false
GROUP BY COALESCE(NULLIF(BTRIM(vessel_type), ''), '<BLANK>')
ORDER BY vessel_type;
```

**Raw output**

```text
vessel_type,vessel_count
<BLANK>,1
Chemical Tanker,1
Crude Oil Tanker,1
Gas Tanker,1
LNG Tanker,1
LPG Tanker,1
OBO (Oil Bulk Ore),1
Oil Chemical Tanker,1
Others,1
Product Oil Tanker,1
```

**Meaning:** Nine vessels have a type and one does not. Every populated type is
currently used by one vessel.

## 7. Blank rates — plain summary

| Attribute | Source column | Populated | Blank | Populated |
|---|---|---:|---:|---:|
| Vessel flag | `master_vessels.flag` | 1 | 9 | 10.0% |
| Vessel owner | `master_vessels.vessel_owner` | 0 | 10 | 0.0% |
| Trading area | No column | 0 | 10 | 0.0% |
| CBA / collective agreement | No column | 0 | 10 | 0.0% |
| Fleet | `master_fleet_groups.vessels` matched to `master_vessels.vessel` | 9 | 1 | 90.0% |
| Add Group | `master_additional_groups.vessels` matched to `master_vessels.vessel` | 9 | 1 | 90.0% |
| Crew nationality | `crew_members_v2.nationality_uuid` | 125 | 9 | 93.3% |
| Crew present rank | `crew_members_v2.present_rank` | 133 | 1 | 99.3% |
| Manning agent | `crew_personal_details.manning_agent` by `crew_uuid` | 106 | 28 | 79.1% |
| Crew pool | `crew_personal_details.crew_pool` by `crew_uuid` | 102 | 32 | 76.1% |
| Vessel type | `master_vessels.vessel_type` | 9 | 1 | 90.0% |

For attributes whose vessel-master column does not exist, the table reports all
ten live vessels as blank so the absence is visible in the same denominator.