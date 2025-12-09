/**
 * Migration Script: Repair Missing Sea Service Records
 * 
 * Purpose: Populate sea service records for crew members who have vessel assignments
 * with sign_on_date but are missing proper sea service data
 * 
 * This script:
 * 1. Finds all vessel planning records with sign_on_date set
 * 2. Checks if corresponding crew member has valid sea service data
 * 3. Populates missing data using the same logic as sign-on action
 * 4. Is fully idempotent and safe to run multiple times
 * 
 * Usage:
 *   npx tsx server/migrations/repair-sea-service-records.ts [--dry-run] [--verbose]
 */

import { storage } from '../storage';
import { fileURLToPath } from 'url';

interface RepairStats {
  totalPlanningRecords: number;
  recordsWithSignOnDate: number;
  recordsNeedingRepair: number;
  recordsRepaired: number;
  recordsSkipped: number;
  errors: string[];
}

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const VERBOSE = ARGS.includes('--verbose') || ARGS.includes('-v');

async function repairSeaServiceRecords(): Promise<RepairStats> {
  const stats: RepairStats = {
    totalPlanningRecords: 0,
    recordsWithSignOnDate: 0,
    recordsNeedingRepair: 0,
    recordsRepaired: 0,
    recordsSkipped: 0,
    errors: []
  };

  console.log('\n========================================');
  console.log('Sea Service Records Repair Migration');
  console.log('========================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be committed)'}`);
  console.log('========================================\n');

  try {
    // Step 1: Get all vessel planning records
    const allPlanning = await storage.getAllVesselPlanning();
    stats.totalPlanningRecords = allPlanning.length;
    console.log(`📊 Found ${stats.totalPlanningRecords} vessel planning records`);

    // Step 2: Filter to records with sign-on date and crew member
    const planningWithSignOn = allPlanning.filter((p: any) => 
      p.signOnDate && p.crewMemberId && p.vesselId && !p.isArchived
    );
    stats.recordsWithSignOnDate = planningWithSignOn.length;
    console.log(`📊 Found ${stats.recordsWithSignOnDate} records with sign-on date\n`);

    // Step 3: Get master data for vessel lookups
    const vesselMasterData = await storage.getMasterDataEntries('014');
    const vesselTypeMasterData = await storage.getMasterDataEntries('004');
    const companyRanks = await storage.getCompanyRanks();

    // Step 4: Process each planning record
    for (const planning of planningWithSignOn) {
      try {
        await processPlanning(planning, vesselMasterData, vesselTypeMasterData, companyRanks, stats);
      } catch (error) {
        const errorMsg = `Error processing planning ${planning.id}: ${error}`;
        stats.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    // Step 5: Print summary
    printRepairSummary(stats);

    return stats;
  } catch (error) {
    console.error('❌ Migration failed with error:', error);
    throw error;
  }
}

async function processPlanning(
  planning: any,
  vesselMasterData: any[],
  vesselTypeMasterData: any[],
  companyRanks: any[],
  stats: RepairStats
): Promise<void> {
  const crewMember = await storage.getCrewMember(planning.crewMemberId);
  if (!crewMember) {
    stats.recordsSkipped++;
    if (VERBOSE) {
      console.log(`   ⏭️ Skipped planning ${planning.id}: crew member not found`);
    }
    return;
  }

  // Parse existing sea service records
  let seaService: any[] = [];
  if (crewMember.currentCompanySeaService) {
    try {
      seaService = typeof crewMember.currentCompanySeaService === 'string'
        ? JSON.parse(crewMember.currentCompanySeaService)
        : crewMember.currentCompanySeaService;
      if (!Array.isArray(seaService)) seaService = [];
    } catch (e) {
      seaService = [];
    }
  }

  // Check if valid sea service record exists for this planning
  const existingRecord = seaService.find((r: any) => r.planningId === planning.id);
  const hasValidRecord = existingRecord && 
    existingRecord.vesselName && 
    existingRecord.vesselCode && 
    existingRecord.from;

  if (hasValidRecord) {
    stats.recordsSkipped++;
    if (VERBOSE) {
      console.log(`   ✓ Planning ${planning.id}: Valid sea service record exists`);
    }
    return;
  }

  stats.recordsNeedingRepair++;

  // Get vessel info
  let vesselName = 'Unknown Vessel';
  let vesselType = '';
  
  const vesselEntry = vesselMasterData.find((e: any) => 
    e.entryId === planning.vesselId || e.entry_id === planning.vesselId || e.nuid === planning.vesselId
  );
  
  if (vesselEntry) {
    vesselName = vesselEntry.name || vesselName;
    if (vesselEntry.vtuid) {
      const typeEntry = vesselTypeMasterData.find((t: any) => 
        t.entryId === vesselEntry.vtuid || t.entry_id === vesselEntry.vtuid
      );
      if (typeEntry) {
        vesselType = typeEntry.name || '';
      }
    }
  }

  // Get rank display name
  let rankDisplayName = crewMember.presentRank || '';
  if (!rankDisplayName && planning.rankId) {
    const rankEntry = companyRanks.find((r: any) => 
      r.rankId === planning.rankId || 
      r.id === planning.rankId ||
      String(r.id) === planning.rankId
    );
    if (rankEntry) {
      rankDisplayName = rankEntry.rank || '';
    }
  }
  if (!rankDisplayName) {
    rankDisplayName = planning.rank || planning.rankId || 'Unknown Rank';
  }

  if (VERBOSE) {
    console.log(`\n🔧 Repairing planning ${planning.id}:`);
    console.log(`   Crew: ${crewMember.firstName} ${crewMember.familyName}`);
    console.log(`   Vessel: ${vesselName} (${planning.vesselId})`);
    console.log(`   Rank: ${rankDisplayName}`);
    console.log(`   Sign-on: ${planning.signOnDate}`);
  }

  if (DRY_RUN) {
    stats.recordsRepaired++;
    console.log(`   🔍 Would repair sea service record for planning ${planning.id} (DRY RUN)`);
    return;
  }

  // Use the upsertSeaServiceEntry helper to create/update the record
  try {
    await storage.upsertSeaServiceEntry({
      crewId: planning.crewMemberId,
      planningId: planning.id,
      vesselName: vesselName,
      vesselCode: planning.vesselId,
      vesselType: vesselType,
      rank: rankDisplayName,
      signOnDate: planning.signOnDate
    });

    // Also update crew member status if needed
    await storage.updateCrewMember(planning.crewMemberId, {
      status: 'On Board',
      presentVessel: planning.vesselId,
      signOnDate: planning.signOnDate
    });

    stats.recordsRepaired++;
    console.log(`   ✅ Repaired sea service record for ${crewMember.firstName} ${crewMember.familyName} on ${vesselName}`);
  } catch (repairError) {
    stats.errors.push(`Failed to repair planning ${planning.id}: ${repairError}`);
    console.error(`   ❌ Failed to repair: ${repairError}`);
  }
}

function printRepairSummary(stats: RepairStats): void {
  console.log('\n========================================');
  console.log('Repair Summary');
  console.log('========================================');
  console.log(`Total Planning Records: ${stats.totalPlanningRecords}`);
  console.log(`Records with Sign-On Date: ${stats.recordsWithSignOnDate}`);
  console.log(`Records Needing Repair: ${stats.recordsNeedingRepair}`);
  console.log(`Records Repaired: ${stats.recordsRepaired}`);
  console.log(`Records Skipped: ${stats.recordsSkipped}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors: ${stats.errors.length}`);
    stats.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }
  
  console.log('========================================');
  
  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN - No changes were made to the database');
    console.log('   Remove --dry-run flag to apply changes');
  } else {
    console.log('\n✅ Repair completed successfully!');
  }
}

// Run migration (ESM compatible)
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1].replace(/\.ts$/, ''));

if (isMainModule) {
  repairSeaServiceRecords()
    .then(() => {
      console.log('\n✅ Repair script finished\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Repair script failed:', error);
      process.exit(1);
    });
}

export { repairSeaServiceRecords };
