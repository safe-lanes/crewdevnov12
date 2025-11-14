import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

async function fixAllSequences() {
  console.log('🔧 Fixing all auto-increment sequences...\n');
  
  // Create a new pool instance for this script
  const pool = new Pool({
    connectionString: DATABASE_URL!,
    ssl: DATABASE_URL!.includes('sslmode=require') ? {
      rejectUnauthorized: false
    } : undefined
  });
  
  const tables = [
    // Tables with serial ID columns
    'users',
    'forms',
    'rank_groups',
    'available_ranks',
    'promotion_hierarchies',
    'appraisal_results',
    'vessels',
    'vessel_groups',
    'vessel_drafts',
    'vessel_revisions',
    'vessel_ranks',
    'master_data_entries',
    'rotation_plans',
    'drug_alcohol_test_records',
    'rest_hours_vessel_records',
    'rest_hours_crew_records',
    'rest_hours_daily_records',
    'variable_tasks',
    'fixed_tasks',
    'nc_reports',
    'vessel_violation_comments',
    'office_violation_comments',
    'vessel_dateline_adjustments',
    'id_counters',
    'data_masters',
    'recruitment_candidates',
    'vessel_planning'
  ];
  
  let fixedCount = 0;
  let skippedCount = 0;
  
  for (const table of tables) {
    try {
      const sequenceName = `${table}_id_seq`;
      
      // Check if table exists and has rows
      const checkTable = await pool.query(`
        SELECT COUNT(*) as count FROM ${table};
      `);
      
      const rowCount = parseInt(checkTable.rows[0].count);
      
      // Reset sequence to max ID in table (minimum 1 for empty tables)
      const result = await pool.query(`
        SELECT setval('${sequenceName}', 
          GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${table}), 1)
        );
      `);
      
      const newValue = result.rows[0].setval;
      console.log(`✅ ${table.padEnd(35)} → sequence set to ${newValue} (${rowCount} rows)`);
      fixedCount++;
      
    } catch (error: any) {
      // Skip tables that don't have sequences (like crew_members with TEXT id)
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        console.log(`⏭️  ${table.padEnd(35)} → no sequence (probably TEXT primary key)`);
      } else {
        console.log(`⚠️  ${table.padEnd(35)} → ${error.message}`);
      }
      skippedCount++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`✅ Fixed ${fixedCount} sequences`);
  console.log(`⏭️  Skipped ${skippedCount} tables (no sequence)`);
  console.log('='.repeat(70));
  console.log('\n✅ All sequences fixed!');
  
  await pool.end();
  process.exit(0);
}

fixAllSequences().catch((error) => {
  console.error(error);
  process.exit(1);
});
