#!/usr/bin/env node

/**
 * Data Migration Script: Populate Vessel IDs in Vessel Planning Records
 * 
 * This script populates the vessel field in vesselPlanning records by copying
 * the presentVessel value from the associated crew member record.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFile = path.join(__dirname, '..', 'test-data.json');

console.log('🔄 Starting vessel planning migration...\n');

// Read the data file
const rawData = fs.readFileSync(dataFile, 'utf8');
const data = JSON.parse(rawData);

// Build crew ID → vessel ID mapping
const crewVesselMap = new Map();
data.crewMembers.forEach(entry => {
  const [crewId, crewData] = entry;
  if (crewData.presentVessel) {
    crewVesselMap.set(crewId, crewData.presentVessel);
  }
});

console.log(`✅ Built crew vessel mapping for ${crewVesselMap.size} crew members\n`);

// Update vessel planning records
let updatedCount = 0;
let alreadyPopulatedCount = 0;
let crewNotFoundCount = 0;

data.vesselPlanning = data.vesselPlanning.map(planEntry => {
  const [planId, planData] = planEntry;
  
  // Skip if vesselId is already populated with the correct format (VSL-XXX)
  if (planData.vesselId && typeof planData.vesselId === 'string' && planData.vesselId.startsWith('VSL-')) {
    alreadyPopulatedCount++;
    return planEntry;
  }
  
  // Get vessel from crew member
  const crewId = planData.crewMemberId;
  const vesselId = crewVesselMap.get(crewId);
  
  if (vesselId) {
    console.log(`🔧 Planning record ${planId} (${planData.rank}, crew ${crewId}): "${planData.vesselId}" → "${vesselId}"`);
    planData.vesselId = vesselId;
    planData.vessel = vesselId;  // Also update vessel for consistency
    updatedCount++;
  } else {
    console.warn(`⚠️  Warning: No vessel found for crew ${crewId} (planning record ${planId})`);
    crewNotFoundCount++;
  }
  
  return planEntry;
});

console.log(`\n📊 Migration Summary:`);
console.log(`   ✅ Updated: ${updatedCount} planning records`);
console.log(`   ✓  Already populated: ${alreadyPopulatedCount} planning records`);
if (crewNotFoundCount > 0) {
  console.log(`   ⚠️  Crew not found: ${crewNotFoundCount} planning records`);
}

// Write back to file
fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');

console.log(`\n💾 Saved updated data to ${dataFile}`);
console.log('🎉 Migration completed successfully!\n');
