import fs from 'fs';

// Load the mapping and data
const mapping = JSON.parse(fs.readFileSync('/tmp/crew-planning-mapping.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('test-data.json', 'utf8'));

console.log('=== MIGRATING CREW MEMBER IDS ===');
console.log(`Total mappings to apply: ${mapping.length}`);

let updated = 0;
let skipped = 0;

// Update vessel planning entries with crewMemberId
for (const map of mapping) {
  const planningIndex = data.vesselPlanning.findIndex(([id]) => id === map.planningId);
  
  if (planningIndex === -1) {
    console.log(`⚠️  Planning ID ${map.planningId} not found - skipping`);
    skipped++;
    continue;
  }
  
  const [id, planning] = data.vesselPlanning[planningIndex];
  
  // Add crewMemberId field
  planning.crewMemberId = map.crewMemberId;
  
  data.vesselPlanning[planningIndex] = [id, planning];
  updated++;
}

console.log(`\n✅ Updated ${updated} vessel planning entries with crewMemberId`);
if (skipped > 0) {
  console.log(`⚠️  Skipped ${skipped} entries`);
}

// Save updated data
fs.writeFileSync('test-data.json', JSON.stringify(data, null, 2));
console.log('✅ Data saved to test-data.json');

// Verification
const withCrewId = data.vesselPlanning.filter(([, p]) => p.crewMemberId).length;
console.log(`\n=== VERIFICATION ===`);
console.log(`Total vessel planning entries: ${data.vesselPlanning.length}`);
console.log(`Entries with crewMemberId: ${withCrewId}`);
console.log(`Entries without crewMemberId: ${data.vesselPlanning.length - withCrewId}`);

// Check specific vessels
const nordicStar = data.vesselPlanning.filter(([, p]) => p.vesselId === 'VSL-003' && p.crewMemberId);
const libertyGas = data.vesselPlanning.filter(([, p]) => p.vesselId === 'VSL-005' && p.crewMemberId);

console.log(`\nNordic Star (VSL-003): ${nordicStar.length} positions with crew IDs`);
console.log(`Liberty Gas (VSL-005): ${libertyGas.length} positions with crew IDs`);
