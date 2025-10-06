#!/usr/bin/env node

/**
 * Data Migration Script: Standardize Vessel IDs in Crew Records
 * 
 * This script converts all crew member `presentVessel` fields from vessel names
 * to vessel IDs for consistency across the application.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFile = path.join(__dirname, '..', 'test-data.json');

console.log('🔄 Starting vessel ID migration...\n');

// Read the data file
const rawData = fs.readFileSync(dataFile, 'utf8');
const data = JSON.parse(rawData);

// Build vessel name → ID mapping from master data (ID 014)
const vesselMap = new Map();
data.masterDataEntries
  .filter(entry => entry[1].masterId === '014')
  .forEach(entry => {
    const vesselData = entry[1];
    const vesselName = vesselData.name;
    const vesselId = vesselData.entryId;
    if (vesselName && vesselId) {
      vesselMap.set(vesselName, vesselId);
      console.log(`📍 Mapped vessel: "${vesselName}" → ID "${vesselId}"`);
    }
  });

console.log(`\n✅ Built vessel mapping for ${vesselMap.size} vessels\n`);

// Find and update crew members with vessel names
let updatedCount = 0;
let alreadyCorrectCount = 0;

data.crewMembers = data.crewMembers.map(crewEntry => {
  const [crewId, crewData] = crewEntry;
  
  if (crewData.presentVessel) {
    const currentValue = crewData.presentVessel;
    
    // Check if it's already a vessel ID (numeric string)
    if (/^\d+$/.test(currentValue)) {
      alreadyCorrectCount++;
      return crewEntry;
    }
    
    // It's a vessel name, convert to ID
    const vesselId = vesselMap.get(currentValue);
    
    if (vesselId) {
      console.log(`🔧 Updating crew ${crewData.firstName} ${crewData.familyName || ''} (${crewId}): "${currentValue}" → "${vesselId}"`);
      crewData.presentVessel = vesselId;
      updatedCount++;
    } else {
      console.warn(`⚠️  Warning: No vessel ID found for "${currentValue}" (crew ${crewId})`);
    }
  }
  
  return crewEntry;
});

console.log(`\n📊 Migration Summary:`);
console.log(`   ✅ Updated: ${updatedCount} crew records`);
console.log(`   ✓  Already correct: ${alreadyCorrectCount} crew records`);

// Write back to file
fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');

console.log(`\n💾 Saved updated data to ${dataFile}`);
console.log('🎉 Migration completed successfully!\n');
