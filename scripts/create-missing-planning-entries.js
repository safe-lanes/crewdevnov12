import fs from 'fs';

const data = JSON.parse(fs.readFileSync('test-data.json', 'utf8'));

console.log('=== CREATING MISSING VESSEL PLANNING ENTRIES ===\n');

// Find the next available ID for vessel planning
const maxId = Math.max(...data.vesselPlanning.map(([id]) => id));
let nextId = maxId + 1;

// Missing crew-to-rank mappings for Nordic Star (VSL-003)
const missingMappings = [
  {
    crewMemberId: 'A000502',
    crewName: 'Oleksandr Bondarenko',
    rank: 'Electrical Officer',
    rankId: 'electrical_officer_rank_id', // Will need to find actual rank ID
    vesselId: 'VSL-003'
  },
  {
    crewMemberId: 'A000352',
    crewName: 'Tomasz Kowalski',
    rank: 'Bosun',
    rankId: 'bosun_rank_id',
    vesselId: 'VSL-003'
  },
  {
    crewMemberId: 'A000512',
    crewName: 'Oleksandr Petrenko',
    rank: 'Pumpman',
    rankId: 'pumpman_rank_id',
    vesselId: 'VSL-003'
  },
  {
    crewMemberId: 'A000368',
    crewName: 'Oleksandr Bondarenko',
    rank: 'AB_1',
    rankId: 'ab_1_rank_id',
    vesselId: 'VSL-003'
  }
];

// Find crew member details
const crewMap = new Map(data.crewMembers.map(([id, crew]) => [crew.id || crew.employeeId, crew]));

// Get Nordic Star vessel ranks to find correct rank IDs
console.log('Finding rank IDs from vessel revisions...');

// Find the latest vessel revision for VSL-003
const nordicRevisions = data.vesselRevisions.filter(([, rev]) => rev.vesselId === 'VSL-003');
if (nordicRevisions.length === 0) {
  console.error('❌ No vessel revisions found for Nordic Star');
  process.exit(1);
}

// Sort by creation date to get latest
const latestRevision = nordicRevisions.sort((a, b) => {
  const aDate = new Date(a[1].createdAt || 0).getTime();
  const bDate = new Date(b[1].createdAt || 0).getTime();
  return bDate - aDate;
})[0];

const rankData = JSON.parse(latestRevision[1].revisionData);
const rankMap = new Map(rankData.map(r => [(r.role || r.rank), r.id || r.rankId]));

console.log(`Found ${rankData.length} ranks in latest revision\n`);

// Create planning entries
const created = [];
for (const mapping of missingMappings) {
  const crew = crewMap.get(mapping.crewMemberId);
  if (!crew) {
    console.log(`⚠️  Crew member ${mapping.crewMemberId} not found - skipping ${mapping.rank}`);
    continue;
  }

  // Find correct rank ID from vessel revision
  const actualRankId = rankMap.get(mapping.rank);
  if (!actualRankId) {
    console.log(`⚠️  Rank ID not found for ${mapping.rank} - skipping`);
    continue;
  }

  const planningEntry = {
    vesselId: mapping.vesselId,
    rankId: actualRankId,
    rank: mapping.rank,
    crewMemberId: mapping.crewMemberId,
    reliefDue: crew.reliefDue || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.vesselPlanning.push([nextId, planningEntry]);
  created.push({
    id: nextId,
    rank: mapping.rank,
    crewName: `${crew.firstName} ${crew.lastName || ''}`.trim(),
    crewMemberId: mapping.crewMemberId
  });
  
  console.log(`✅ Created planning entry ${nextId}: ${mapping.rank} -> ${crew.firstName} ${crew.lastName || ''} (${mapping.crewMemberId})`);
  nextId++;
}

// Save updated data
fs.writeFileSync('test-data.json', JSON.stringify(data, null, 2));
console.log(`\n✅ Created ${created.length} new vessel planning entries`);
console.log('✅ Data saved to test-data.json');

// Verification
console.log('\n=== VERIFICATION ===');
console.log(`Total vessel planning entries: ${data.vesselPlanning.length}`);
console.log(`Nordic Star entries: ${data.vesselPlanning.filter(([, p]) => p.vesselId === 'VSL-003').length}`);
