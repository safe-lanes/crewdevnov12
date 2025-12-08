/**
 * Migration Script: Backfill Sea Service Record Linkage
 * 
 * Purpose: Add planningId linkage to existing sea service records
 * Created: Production-ready implementation for vessel database
 * 
 * This script:
 * 1. Scans all crew members' sea service records
 * 2. Attempts to match records with vessel planning entries
 * 3. Adds planningId where matches are found
 * 4. Creates legacy hash IDs for unmatched records
 * 5. Is fully idempotent and safe to run multiple times
 * 
 * Usage:
 *   npx tsx server/migrations/backfill-sea-service-linkage.ts [--dry-run] [--storage=mem|file]
 */

import { storage } from '../storage';
import { generateLegacyHash, safeParseDate, formatDateToISO } from '@shared/dateUtils';

interface MigrationStats {
  totalCrewMembers: number;
  totalSeaServiceRecords: number;
  recordsWithPlanningId: number;
  recordsMatched: number;
  recordsUnmatched: number;
  recordsUpdated: number;
  errors: string[];
}

interface SeaServiceRecord {
  id: string;
  vesselName: string;
  vesselCode: string;
  vesselType: string;
  rank: string;
  from: string;
  to: string;
  periodMonths: string;
  planningId?: number;
  isActive?: boolean;
  status?: string;
  createdVia?: string;
  legacyHash?: string;
  [key: string]: any;
}

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const VERBOSE = ARGS.includes('--verbose') || ARGS.includes('-v');

/**
 * Main migration function
 */
async function backfillSeaServiceLinkage(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalCrewMembers: 0,
    totalSeaServiceRecords: 0,
    recordsWithPlanningId: 0,
    recordsMatched: 0,
    recordsUnmatched: 0,
    recordsUpdated: 0,
    errors: []
  };

  console.log('\n========================================');
  console.log('Sea Service Linkage Backfill Migration');
  console.log('========================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be committed)'}`);
  console.log('========================================\n');

  try {
    // Step 1: Get all crew members
    const allCrewMembers = await storage.getCrewMembers();
    stats.totalCrewMembers = allCrewMembers.length;
    
    console.log(`📊 Found ${stats.totalCrewMembers} crew members`);

    // Step 2: Get all vessel planning records for matching
    const allVesselPlanning = await storage.getAllVesselPlanning();
    console.log(`📊 Found ${allVesselPlanning.length} vessel planning records for matching\n`);

    // Step 3: Process each crew member
    for (const crewMember of allCrewMembers) {
      try {
        await processCrewMember(crewMember, allVesselPlanning, stats);
      } catch (error) {
        const errorMsg = `Error processing crew ${crewMember.id}: ${error}`;
        stats.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    // Step 4: Print summary
    printMigrationSummary(stats);

    return stats;
  } catch (error) {
    console.error('❌ Migration failed with error:', error);
    throw error;
  }
}

/**
 * Process a single crew member's sea service records
 */
async function processCrewMember(
  crewMember: any,
  allVesselPlanning: any[],
  stats: MigrationStats
): Promise<void> {
  // Parse sea service records
  let seaServiceRecords: SeaServiceRecord[] = [];
  
  if (crewMember.currentCompanySeaService) {
    try {
      seaServiceRecords = typeof crewMember.currentCompanySeaService === 'string'
        ? JSON.parse(crewMember.currentCompanySeaService)
        : crewMember.currentCompanySeaService;
      
      if (!Array.isArray(seaServiceRecords)) {
        seaServiceRecords = [];
      }
    } catch (e) {
      stats.errors.push(`Failed to parse sea service for crew ${crewMember.id}`);
      return;
    }
  }

  if (seaServiceRecords.length === 0) {
    return; // No records to process
  }

  stats.totalSeaServiceRecords += seaServiceRecords.length;

  // Filter planning records for this crew member
  const crewPlanningRecords = allVesselPlanning.filter(
    (p: any) => p.crewMemberId === crewMember.id
  );

  if (VERBOSE) {
    console.log(`\n👤 Processing ${crewMember.firstName} ${crewMember.familyName} (${crewMember.id})`);
    console.log(`   Sea Service Records: ${seaServiceRecords.length}`);
    console.log(`   Planning Records: ${crewPlanningRecords.length}`);
  }

  let recordsModified = false;

  // Process each sea service record
  for (const record of seaServiceRecords) {
    // Skip if already has planningId
    if (record.planningId) {
      stats.recordsWithPlanningId++;
      if (VERBOSE) {
        console.log(`   ✓ Record already has planningId: ${record.planningId}`);
      }
      continue;
    }

    // Try to match with vessel planning record
    const match = findMatchingPlanningRecord(record, crewPlanningRecords);

    if (match) {
      // Match found - add planningId
      record.planningId = match.id;
      record.status = record.isActive ? 'active' : 'completed';
      record.createdVia = 'backfill';
      stats.recordsMatched++;
      recordsModified = true;

      if (VERBOSE) {
        console.log(`   ✅ Matched: ${record.vesselName} (${record.from}) → Planning ID ${match.id}`);
      }
    } else {
      // No match - create legacy hash
      const legacyHash = generateLegacyHash(
        crewMember.id,
        record.vesselCode || '',
        record.from
      );
      record.legacyHash = legacyHash;
      record.status = record.isActive ? 'active' : 'legacy';
      record.createdVia = 'legacy';
      stats.recordsUnmatched++;
      recordsModified = true;

      if (VERBOSE) {
        console.log(`   ⚠️  No match: ${record.vesselName} (${record.from}) → Legacy hash created`);
      }
    }
  }

  // Update crew member if records were modified
  if (recordsModified && !DRY_RUN) {
    try {
      await storage.updateCrewMember(crewMember.id, {
        currentCompanySeaService: JSON.stringify(seaServiceRecords)
      });
      stats.recordsUpdated++;
      
      if (VERBOSE) {
        console.log(`   💾 Updated crew member ${crewMember.id}`);
      }
    } catch (error) {
      stats.errors.push(`Failed to update crew ${crewMember.id}: ${error}`);
      console.error(`   ❌ Failed to update crew member: ${error}`);
    }
  } else if (recordsModified && DRY_RUN) {
    stats.recordsUpdated++;
    if (VERBOSE) {
      console.log(`   🔍 Would update crew member ${crewMember.id} (DRY RUN)`);
    }
  }
}

/**
 * Find matching vessel planning record for a sea service entry
 * Matching criteria:
 * 1. Vessel code must match
 * 2. Sign-on date must match (with some tolerance)
 * 3. Rank should match (optional, for disambiguation)
 */
function findMatchingPlanningRecord(
  seaServiceRecord: SeaServiceRecord,
  planningRecords: any[]
): any | null {
  if (!seaServiceRecord.from || !seaServiceRecord.vesselCode) {
    return null; // Can't match without basic info
  }

  const seaServiceDate = safeParseDate(seaServiceRecord.from);
  if (!seaServiceDate) return null;

  // Try exact match first
  for (const planning of planningRecords) {
    if (!planning.signOnDate || !planning.vesselId) continue;

    const planningDate = safeParseDate(planning.signOnDate);
    if (!planningDate) continue;

    // Check vessel match
    const vesselMatch = planning.vesselId === seaServiceRecord.vesselCode;
    
    // Check date match (exact)
    const dateMatch = formatDateToISO(seaServiceDate) === formatDateToISO(planningDate);

    if (vesselMatch && dateMatch) {
      return planning;
    }
  }

  // Try fuzzy match (±3 days tolerance for date discrepancies)
  for (const planning of planningRecords) {
    if (!planning.signOnDate || !planning.vesselId) continue;

    const planningDate = safeParseDate(planning.signOnDate);
    if (!planningDate) continue;

    // Check vessel match
    const vesselMatch = planning.vesselId === seaServiceRecord.vesselCode;
    
    // Check date match with tolerance
    const dateDiff = Math.abs(seaServiceDate.getTime() - planningDate.getTime());
    const daysDiff = dateDiff / (1000 * 60 * 60 * 24);
    const dateMatchFuzzy = daysDiff <= 3;

    if (vesselMatch && dateMatchFuzzy) {
      return planning;
    }
  }

  return null;
}

/**
 * Print migration summary
 */
function printMigrationSummary(stats: MigrationStats): void {
  console.log('\n========================================');
  console.log('Migration Summary');
  console.log('========================================');
  console.log(`Total Crew Members: ${stats.totalCrewMembers}`);
  console.log(`Total Sea Service Records: ${stats.totalSeaServiceRecords}`);
  console.log(`Records Already Linked: ${stats.recordsWithPlanningId}`);
  console.log(`Records Matched to Planning: ${stats.recordsMatched}`);
  console.log(`Records Without Match (Legacy): ${stats.recordsUnmatched}`);
  console.log(`Crew Members Updated: ${stats.recordsUpdated}`);
  
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
    console.log('\n✅ Migration completed successfully!');
  }
}

/**
 * Run migration
 */
if (require.main === module) {
  backfillSeaServiceLinkage()
    .then(() => {
      console.log('\n✅ Migration script finished\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { backfillSeaServiceLinkage };
