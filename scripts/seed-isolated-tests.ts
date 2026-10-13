import pg from "pg";

// No development reads, dumps, parent API calls, crew, or operational history.
// Compatibility actor 24 is a newly constructed synthetic actor, not a copy.
export async function seedIsolatedTests() {
  if (process.env.TEST_DATABASE_VERIFIED !== "true")
    throw new Error("Synthetic seeds require verified test isolation.");
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await pool.query(`INSERT INTO master_users
      (id,user_uuid,firstname,lastname,fullname,display_name,email,user_type,role)
      VALUES(24,'40400000-0000-4000-8000-000000000024','Synthetic','Author',
        'Synthetic Author','Synthetic Author','author@example.invalid','Office','Admin')
      ON CONFLICT(id) DO UPDATE SET role='Admin',user_type='Office'`);
    await pool.query(`SELECT setval('master_users_id_seq',
      greatest((SELECT max(id) FROM master_users),24))`);
    await pool.query("UPDATE master_users SET designation='Synthetic Crewing Superintendent' WHERE id=24");
    await pool.query(`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
      SELECT r.ruid,a.resource,a.action,true FROM adm_rolemaster_ac r
      CROSS JOIN adm_permission_actions a WHERE r.assigned_role='Admin'
      ON CONFLICT(role_id,resource,action) DO UPDATE SET allowed=true`);
    await pool.query(`INSERT INTO adm_roleaccess_ac
      (rauid,role_id,menu_id,canview,cancreate,canedit,candelete,is_deleted)
      SELECT gen_random_uuid()::text,r.ruid,m.muid,true,true,true,true,false
      FROM adm_rolemaster_ac r CROSS JOIN adm_menumaster_ac m
      WHERE r.assigned_role='Admin' AND NOT m.is_deleted AND NOT EXISTS
        (SELECT 1 FROM adm_roleaccess_ac a WHERE a.role_id=r.ruid AND a.menu_id=m.muid AND NOT a.is_deleted)`);
    await pool.query(`UPDATE adm_roleaccess_ac SET canview=true,cancreate=true,canedit=true,candelete=true
      WHERE role_id IN(SELECT ruid FROM adm_rolemaster_ac WHERE assigned_role='Admin') AND NOT is_deleted`);
    for (let n = 1; n <= 3; n++) {
      const uuid = `40400000-0000-4000-8000-${String(n).padStart(12, "0")}`;
      await pool.query(`INSERT INTO master_vessel_types(vt_uuid,vessel_type,is_active,is_deleted)
        SELECT $1,$2,true,false WHERE NOT EXISTS
        (SELECT 1 FROM master_vessel_types WHERE vt_uuid=$1)`, [uuid, `Synthetic Vessel Type ${n}`]);
      await pool.query(`INSERT INTO master_nationalities(nat_uuid,country_code,country_name,nationality)
        SELECT $1,$2,$3,$3 WHERE NOT EXISTS
        (SELECT 1 FROM master_nationalities WHERE nat_uuid=$1)`, [uuid, `T${n}`, `Synthetic Nationality ${n}`]);
      await pool.query(`INSERT INTO master_vessels(vessel_uuid,vessel,vessel_type,is_active,is_deleted)
        SELECT $1,$2,$3,true,false WHERE NOT EXISTS
        (SELECT 1 FROM master_vessels WHERE vessel_uuid=$1)`, [uuid, `TEST ONLY Isolated Vessel ${n}`, `Synthetic Vessel Type ${n}`]);
    }
    await pool.query(`INSERT INTO master_crew_pools(id,name) VALUES
      ('40400000-0000-4000-8000-000000000101','Synthetic Crew Pool') ON CONFLICT(id) DO NOTHING`);
    await pool.query(`INSERT INTO master_manning_agents(id,name) VALUES
      ('40400000-0000-4000-8000-000000000102','Synthetic Manning Agent') ON CONFLICT(id) DO NOTHING`);
    await pool.query(`INSERT INTO master_fleet_groups(fg_uuid,name,vessels)
      SELECT '40400000-0000-4000-8000-000000000103','Synthetic Fleet','[]'
      WHERE NOT EXISTS(SELECT 1 FROM master_fleet_groups WHERE fg_uuid='40400000-0000-4000-8000-000000000103')`);
    await pool.query(`INSERT INTO master_additional_groups(ag_uuid,name,vessels)
      SELECT '40400000-0000-4000-8000-000000000104','Synthetic Group','[]'
      WHERE NOT EXISTS(SELECT 1 FROM master_additional_groups WHERE ag_uuid='40400000-0000-4000-8000-000000000104')`);
    console.log("Synthetic test masters and author seeded; no real crew or service copied.");
  } finally { await pool.end(); }
}
