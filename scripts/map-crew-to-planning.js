import fs from 'fs';

// Load the data
const data = JSON.parse(fs.readFileSync('test-data.json', 'utf8'));

// Convert Map structure to array
const crewMembers = data.crewMembers.map(([key, value]) => ({ ...value, _mapKey: key }));
const vesselPlanning = data.vesselPlanning.map(([key, value]) => ({ ...value, id: key }));

// Helper function to normalize names for matching
function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Helper function to check if names match (partial match)
function namesMatch(crewFirstName, crewLastName, planningName) {
  const crewFullName = `${crewFirstName || ''} ${crewLastName || ''}`.trim();
  const normalized1 = normalizeName(crewFullName);
  const normalized2 = normalizeName(planningName);
  
  // Exact match
  if (normalized1 === normalized2) return true;
  
  // Planning name contains crew first name
  if (normalized2.includes(normalizeName(crewFirstName))) return true;
  
  // Crew full name contains planning name
  if (normalized1.includes(normalized2)) return true;
  
  return false;
}

// Create mapping
const mapping = [];
const unmatchedPlanning = [];

for (const planning of vesselPlanning) {
  if (!planning.vesselId || !planning.rank) continue;
  
  // Find matching crew member
  const match = crewMembers.find(crew => {
    // Must match vessel
    if (crew.presentVessel !== planning.vesselId) return false;
    
    // Rank matching - handle variants like "3rd Officer" vs "3rd Officer_1"
    const planningRank = planning.rank.replace(/_\d+$/, ''); // Remove _1, _2 suffixes
    const crewRank = crew.presentRank || '';
    
    if (crewRank !== planning.rank && crewRank !== planningRank) return false;
    
    // Name matching
    if (planning.crewName) {
      return namesMatch(crew.firstName, crew.lastName, planning.crewName);
    }
    
    return true;
  });
  
  if (match) {
    mapping.push({
      planningId: planning.id,
      vesselId: planning.vesselId,
      rank: planning.rank,
      planningCrewName: planning.crewName,
      crewMemberId: match.id || match.employeeId,
      crewEmployeeId: match.employeeId,
      crewFullName: `${match.firstName || ''} ${match.lastName || ''}`.trim(),
      matched: true
    });
  } else {
    unmatchedPlanning.push({
      planningId: planning.id,
      vesselId: planning.vesselId,
      rank: planning.rank,
      crewName: planning.crewName,
      matched: false
    });
  }
}

// Output results
console.log('=== MAPPING RESULTS ===');
console.log(`Total vessel planning entries: ${vesselPlanning.length}`);
console.log(`Successfully matched: ${mapping.length}`);
console.log(`Unmatched: ${unmatchedPlanning.length}`);
console.log('');

if (unmatchedPlanning.length > 0) {
  console.log('=== UNMATCHED PLANNING ENTRIES ===');
  unmatchedPlanning.forEach(p => {
    console.log(`  ID ${p.planningId}: ${p.vesselId} - ${p.rank} - ${p.crewName || '(no name)'}`);
  });
  console.log('');
}

// Group by vessel for summary
const byVessel = {};
mapping.forEach(m => {
  if (!byVessel[m.vesselId]) byVessel[m.vesselId] = [];
  byVessel[m.vesselId].push(m);
});

console.log('=== MATCHED BY VESSEL ===');
Object.entries(byVessel).forEach(([vesselId, matches]) => {
  console.log(`${vesselId}: ${matches.length} positions mapped`);
});

// Save mapping to file
fs.writeFileSync('/tmp/crew-planning-mapping.json', JSON.stringify(mapping, null, 2));
console.log('');
console.log('✅ Mapping saved to /tmp/crew-planning-mapping.json');
