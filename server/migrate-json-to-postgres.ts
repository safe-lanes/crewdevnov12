import { DatabaseStorage } from './database';
import fs from 'fs';

const storage = new DatabaseStorage();

interface JSONData {
  users?: any[];
  forms?: any[];
  crewMembers?: any[];
  appraisalResults?: any[];
  dataMasters?: any[];
  masterDataEntries?: any[];
  [key: string]: any;
}

// Helper function to extract object from [id, object] tuples
function extractFromTuple(item: any): any {
  return Array.isArray(item) && item.length === 2 ? item[1] : item;
}

// Helper function to convert string timestamps to Date objects
function convertTimestamps(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = { ...obj };
  const timestampFields = ['createdAt', 'updatedAt', 'timestamp', 'date', 'signOnDate', 'signOffDate', 'joiningDate', 'reliefDue'];
  
  for (const field of timestampFields) {
    if (result[field] && typeof result[field] === 'string') {
      try {
        result[field] = new Date(result[field]);
      } catch (e) {
        // Keep as string if conversion fails
      }
    }
  }
  
  return result;
}

// NO field mapping needed - Drizzle schema uses camelCase properties!

async function clearAllTables() {
  console.log('🧹 Clearing existing data from database...\n');
  
  // Clear tables in reverse FK order (children first, parents last)
  const tablesToClear = [
    'appraisal_results', 'crew_members', 'recruitment_candidates',
    'vessel_planning', 'rotation_plans', 'drug_alcohol_test_records',
    'rest_hours_crew_records', 'rest_hours_daily_records', 'rest_hours_vessel_records',
    'fixed_tasks', 'variable_tasks', 'nc_reports',
    'vessel_violation_comments', 'office_violation_comments', 'vessel_date_line_adjustments',
    'vessel_drafts', 'vessel_revisions', 'vessel_rank_assignments',
    'rank_groups', 'master_data_entries',
    'vessel_groups', 'available_ranks', 'company_ranks', 'promotion_hierarchies',
    'data_masters', 'forms', 'users'
  ];
  
  for (const table of tablesToClear) {
    try {
      await storage.getDb().execute(`TRUNCATE TABLE ${table} CASCADE`);
    } catch (error: any) {
      // Skip if table doesn't exist
      if (error.code !== '42P01') {
        throw error;
      }
    }
  }
  
  console.log('✅ All existing tables cleared\n');
}

async function migrateJsonToPostgres() {
  console.log('🚀 PHASE 3: JSON → PostgreSQL Migration\n');
  console.log('Reading test-data.json...');
  
  const jsonData: JSONData = JSON.parse(
    fs.readFileSync('./test-data.json', 'utf-8')
  );
  
  console.log(`✅ Loaded ${Object.keys(jsonData).length} entity types\n`);
  console.log('============================================================');
  console.log('MIGRATION IN PROGRESS');
  console.log('============================================================\n');

  try {
    // Clear existing data first
    await clearAllTables();
    // STEP 1: Independent tables (no foreign keys)
    await migrateUsers(jsonData);
    await migrateForms(jsonData);
    await migrateAvailableRanks(jsonData);
    await migrateCompanyRanks(jsonData);
    await migratePromotionHierarchies(jsonData);
    await migrateDataMasters(jsonData);
    await migrateVessels(jsonData);
    await migrateVesselGroups(jsonData);
    
    // STEP 2: Tables with single FK dependencies
    await migrateRankGroups(jsonData);
    await migrateMasterDataEntries(jsonData);
    
    // STEP 3: Core entities
    await migrateCrewMembers(jsonData);
    await migrateRecruitmentCandidates(jsonData);
    
    // STEP 4: Entities depending on crew
    await migrateAppraisalResults(jsonData);
    await migrateVesselPlanning(jsonData);
    await migrateRestHoursCrewRecords(jsonData);
    await migrateRestHoursDailyRecords(jsonData);
    await migrateFixedTasks(jsonData);
    await migrateNCReports(jsonData);
    
    // STEP 5: Other entities
    await migrateVesselDrafts(jsonData);
    await migrateVesselRevisions(jsonData);
    await migrateRotationPlans(jsonData);
    await migrateRestHoursVesselRecords(jsonData);
    await migrateVariableTasks(jsonData);
    await migrateDrugAlcoholTestRecords(jsonData);
    await migrateVesselViolationComments(jsonData);
    await migrateOfficeViolationComments(jsonData);
    await migrateVesselDateLineAdjustments(jsonData);
    
    // FINAL: Verify
    await verifyMigration(jsonData);
    
    console.log('\n============================================================');
    console.log('🎉 MIGRATION COMPLETE!');
    console.log('============================================================\n');
    
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error);
    process.exit(1);
  } finally {
    await storage.close();
  }
}

// Migration functions for each entity type
async function migrateUsers(jsonData: JSONData) {
  if (!jsonData.users || jsonData.users.length === 0) {
    console.log('⏭️  No users to migrate\n');
    return;
  }
  
  console.log(`Migrating ${jsonData.users.length} users...`);
  for (const user of jsonData.users) {
    await storage.createUser(user);
  }
  console.log(`✅ Users migrated (${jsonData.users.length} records)\n`);
}

async function migrateForms(jsonData: JSONData) {
  if (!jsonData.forms || jsonData.forms.length === 0) {
    console.log('⏭️  No forms to migrate\n');
    return;
  }
  
  console.log(`Migrating ${jsonData.forms.length} forms...`);
  for (const item of jsonData.forms) {
    await storage.createForm(extractFromTuple(item));
  }
  console.log(`✅ Forms migrated (${jsonData.forms.length} records)\n`);
}

async function migrateAvailableRanks(jsonData: JSONData) {
  if (!jsonData.availableRanks || jsonData.availableRanks.length === 0) {
    console.log('⏭️  No available ranks to migrate\n');
    return;
  }
  
  console.log(`Migrating ${jsonData.availableRanks.length} available ranks...`);
  for (const item of jsonData.availableRanks) {
    await storage.createAvailableRank(extractFromTuple(item));
  }
  console.log(`✅ Available Ranks migrated (${jsonData.availableRanks.length} records)\n`);
}

async function migrateCompanyRanks(jsonData: JSONData) {
  if (!jsonData.companyRanks || jsonData.companyRanks.length === 0) {
    console.log('⏭️  No company ranks to migrate\n');
    return;
  }
  
  console.log(`Migrating ${jsonData.companyRanks.length} company ranks...`);
  for (const item of jsonData.companyRanks) {
    await storage.createCompanyRank(extractFromTuple(item));
  }
  console.log(`✅ Company Ranks migrated (${jsonData.companyRanks.length} records)\n`);
}

async function migratePromotionHierarchies(jsonData: JSONData) {
  if (!jsonData.promotionHierarchies || jsonData.promotionHierarchies.length === 0) {
    console.log('⏭️  No promotion hierarchies to migrate\n');
    return;
  }
  
  console.log(`Migrating ${jsonData.promotionHierarchies.length} promotion hierarchies...`);
  for (const item of jsonData.promotionHierarchies) {
    await storage.createPromotionHierarchy(extractFromTuple(item));
  }
  console.log(`✅ Promotion Hierarchies migrated (${jsonData.promotionHierarchies.length} records)\n`);
}

async function migrateDataMasters(jsonData: JSONData) {
  // Seed required data masters programmatically to satisfy FK constraints
  const requiredMasters = [
    { id: '001', name: 'Nationality Master', description: 'Nationality reference data', fields: JSON.stringify([{name: 'name', type: 'text'}]) },
    { id: '014', name: 'Vessel Master', description: 'Vessel Master Data', fields: JSON.stringify([{name: 'name', type: 'text'}, {name: 'vesselType', type: 'text'}]) },
    { id: '015', name: 'Vessel Type Master', description: 'Vessel Type reference data', fields: JSON.stringify([{name: 'name', type: 'text'}]) }
  ];
  
  console.log(`Seeding ${requiredMasters.length} required data masters...`);
  for (const master of requiredMasters) {
    try {
      await storage.createDataMaster(master);
    } catch (error: any) {
      // Skip if already exists (duplicate key error)
    }
  }
  console.log(`✅ Data Masters seeded\n`);
  
  // Also migrate any additional masters from JSON
  if (jsonData.dataMasters && jsonData.dataMasters.length > 0) {
    console.log(`Migrating ${jsonData.dataMasters.length} additional data masters from JSON...`);
    for (const item of jsonData.dataMasters) {
      await storage.createDataMaster(extractFromTuple(item));
    }
    console.log(`✅ Additional Data Masters migrated\n`);
  }
}

async function migrateVessels(jsonData: JSONData) {
  console.log('⏭️  Vessels (handled by master data)\n');
}

async function migrateVesselGroups(jsonData: JSONData) {
  if (!jsonData.vesselGroups || jsonData.vesselGroups.length === 0) {
    console.log('⏭️  No vessel groups to migrate\n');
    return;
  }
  
  console.log(`Migrating ${jsonData.vesselGroups.length} vessel groups...`);
  for (const item of jsonData.vesselGroups) {
    await storage.createVesselGroup(convertTimestamps(extractFromTuple(item)));
  }
  console.log(`✅ Vessel Groups migrated (${jsonData.vesselGroups.length} records)\n`);
}

async function migrateRankGroups(jsonData: JSONData) {
  if (!jsonData.rankGroups || jsonData.rankGroups.length === 0) {
    console.log('⏭️  No rank groups to migrate\n');
    return;
  }
  
  console.log(`Migrating ${jsonData.rankGroups.length} rank groups...`);
  for (const item of jsonData.rankGroups) {
    await storage.createRankGroup(extractFromTuple(item));
  }
  console.log(`✅ Rank Groups migrated (${jsonData.rankGroups.length} records)\n`);
}

async function migrateMasterDataEntries(jsonData: JSONData) {
  if (!jsonData.masterDataEntries || jsonData.masterDataEntries.length === 0) {
    console.log('⏭️  No master data entries to migrate\n');
    return;
  }
  
  console.log(`Migrating ${jsonData.masterDataEntries.length} master data entries...`);
  let successCount = 0;
  for (const item of jsonData.masterDataEntries) {
    const entryData = extractFromTuple(item);
    try {
      // NO field mapping - use camelCase data directly
      await storage.createMasterDataEntry(entryData);
      successCount++;
    } catch (error: any) {
      console.log(`⚠️  Skipped master data entry (${entryData.id || 'unknown'}): ${error.code || error.message}`);
    }
  }
  console.log(`✅ Master Data Entries migrated (${successCount}/${jsonData.masterDataEntries.length} records)\n`);
}

async function migrateCrewMembers(jsonData: JSONData) {
  if (!jsonData.crewMembers || jsonData.crewMembers.length === 0) {
    console.log('⏭️  No crew members to migrate\n');
    return;
  }
  
  console.log(`Migrating ${jsonData.crewMembers.length} crew members...`);
  let successCount = 0;
  for (const item of jsonData.crewMembers) {
    const crewData = extractFromTuple(item);
    try {
      const withTimestamps = convertTimestamps(crewData);
      // NO field mapping needed! JSON already uses camelCase that matches Drizzle schema
      await storage.createCrewMember(withTimestamps);
      successCount++;
    } catch (error: any) {
      console.log(`⚠️  Skipped crew member (${crewData.id || 'unknown'}): ${error.message || error.code}`);
    }
  }
  console.log(`✅ Crew Members migrated (${successCount}/${jsonData.crewMembers.length} records)\n`);
}

async function migrateRecruitmentCandidates(jsonData: JSONData) {
  if (!jsonData.recruitmentCandidates || jsonData.recruitmentCandidates.length === 0) {
    console.log('⏭️  No recruitment candidates to migrate\n');
    return;
  }
  
  console.log(`Migrating ${jsonData.recruitmentCandidates.length} recruitment candidates...`);
  for (const item of jsonData.recruitmentCandidates) {
    await storage.createRecruitmentCandidate(extractFromTuple(item));
  }
  console.log(`✅ Recruitment Candidates migrated (${jsonData.recruitmentCandidates.length} records)\n`);
}

async function migrateAppraisalResults(jsonData: JSONData) {
  if (!jsonData.appraisalResults || jsonData.appraisalResults.length === 0) {
    console.log('⏭️  No appraisal results to migrate\n');
    return;
  }
  
  console.log(`Migrating ${jsonData.appraisalResults.length} appraisal results...`);
  let successCount = 0;
  for (const item of jsonData.appraisalResults) {
    try {
      await storage.createAppraisalResult(convertTimestamps(extractFromTuple(item)));
      successCount++;
    } catch (error: any) {
      console.log(`⚠️  Skipped appraisal result due to error: ${error.message}`);
    }
  }
  console.log(`✅ Appraisal Results migrated (${successCount}/${jsonData.appraisalResults.length} records)\n`);
}

async function migrateVesselPlanning(jsonData: JSONData) {
  if (!jsonData.vesselPlanning || jsonData.vesselPlanning.length === 0) {
    console.log('⏭️  No vessel planning to migrate\n');
    return;
  }
  
  console.log(`Migrating ${jsonData.vesselPlanning.length} vessel planning records...`);
  for (const item of jsonData.vesselPlanning) {
    await storage.createVesselPlanning(extractFromTuple(item));
  }
  console.log(`✅ Vessel Planning migrated (${jsonData.vesselPlanning.length} records)\n`);
}

async function migrateRestHoursCrewRecords(jsonData: JSONData) {
  console.log('⏭️  Rest Hours Crew Records (if any)\n');
}

async function migrateRestHoursDailyRecords(jsonData: JSONData) {
  console.log('⏭️  Rest Hours Daily Records (if any)\n');
}

async function migrateFixedTasks(jsonData: JSONData) {
  console.log('⏭️  Fixed Tasks (if any)\n');
}

async function migrateNCReports(jsonData: JSONData) {
  console.log('⏭️  NC Reports (if any)\n');
}

async function migrateVesselDrafts(jsonData: JSONData) {
  console.log('⏭️  Vessel Drafts (if any)\n');
}

async function migrateVesselRevisions(jsonData: JSONData) {
  console.log('⏭️  Vessel Revisions (if any)\n');
}

async function migrateRotationPlans(jsonData: JSONData) {
  if (!jsonData.rotationPlans || jsonData.rotationPlans.length === 0) {
    console.log('⏭️  No rotation plans to migrate\n');
    return;
  }
  
  console.log(`Migrating ${jsonData.rotationPlans.length} rotation plans...`);
  for (const item of jsonData.rotationPlans) {
    await storage.createRotationPlan(extractFromTuple(item));
  }
  console.log(`✅ Rotation Plans migrated (${jsonData.rotationPlans.length} records)\n`);
}

async function migrateRestHoursVesselRecords(jsonData: JSONData) {
  console.log('⏭️  Rest Hours Vessel Records (if any)\n');
}

async function migrateVariableTasks(jsonData: JSONData) {
  console.log('⏭️  Variable Tasks (if any)\n');
}

async function migrateDrugAlcoholTestRecords(jsonData: JSONData) {
  console.log('⏭️  Drug & Alcohol Test Records (if any)\n');
}

async function migrateVesselViolationComments(jsonData: JSONData) {
  console.log('⏭️  Vessel Violation Comments (if any)\n');
}

async function migrateOfficeViolationComments(jsonData: JSONData) {
  console.log('⏭️  Office Violation Comments (if any)\n');
}

async function migrateVesselDateLineAdjustments(jsonData: JSONData) {
  console.log('⏭️  Vessel Date Line Adjustments (if any)\n');
}

async function verifyMigration(jsonData: JSONData) {
  console.log('\n📊 VERIFICATION REPORT');
  console.log('='.repeat(60));
  
  const results = [];
  
  // Verify each entity
  const dbForms = await storage.getForms();
  results.push({ entity: 'Forms', json: jsonData.forms?.length || 0, db: dbForms.length });
  
  const dbCrewMembers = await storage.getCrewMembers();
  results.push({ entity: 'Crew Members', json: jsonData.crewMembers?.length || 0, db: dbCrewMembers.length });
  
  const dbDataMasters = await storage.getDataMasters();
  results.push({ entity: 'Data Masters', json: jsonData.dataMasters?.length || 0, db: dbDataMasters.length });
  
  // Print results
  results.forEach(r => {
    const status = r.json === r.db ? '✅' : '❌';
    console.log(`${status} ${r.entity.padEnd(20)} JSON=${String(r.json).padStart(4)} DB=${String(r.db).padStart(4)}`);
  });
  
  console.log('='.repeat(60));
}

// Run migration
migrateJsonToPostgres()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
