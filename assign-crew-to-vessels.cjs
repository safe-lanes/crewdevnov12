const fs = require('fs');

// Read test-data.json
const data = JSON.parse(fs.readFileSync('test-data.json', 'utf-8'));

// Vessel configurations
const vessels = [
  { id: '5', name: 'MT Liberty Gas' },
  { id: '3', name: 'MT Nordic Star' }
];

// Required ranks for both vessels (same org chart)
const requiredRanks = [
  { rank: 'Master', count: 1 },
  { rank: 'Chief Officer', count: 1 },
  { rank: '2nd Officer', count: 1 },
  { rank: '3rd Officer', count: 2 },
  { rank: 'Chief Engineer', count: 1 },
  { rank: '2nd Engineer', count: 1 },
  { rank: '3rd Engineer', count: 1 },
  { rank: '4th Engineer', count: 1 },
  { rank: 'Electrical Officer', count: 1 },
  { rank: 'Bosun', count: 1 },
  { rank: 'Pumpman', count: 1 },
  { rank: 'AB', count: 3 },
  { rank: 'OS', count: 3 },
  { rank: 'Fitter', count: 1 },
  { rank: 'Oiler', count: 3 },
  { rank: 'Chief Cook', count: 1 },
  { rank: 'Messman', count: 1 }
];

// Helper function to generate random date in past 6 months
function getRandomJoiningDate() {
  const today = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(today.getMonth() - 6);
  
  const randomTime = sixMonthsAgo.getTime() + Math.random() * (today.getTime() - sixMonthsAgo.getTime());
  return new Date(randomTime).toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Helper function to add months to a date
function addMonths(dateStr, months) {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
}

// Helper function to get random contract period (6-9 months)
function getRandomContractPeriod() {
  return Math.floor(Math.random() * 4) + 6; // 6, 7, 8, or 9 months
}

// Helper function to get crew full name
function getCrewFullName(crew) {
  const parts = [crew.firstName, crew.middleName, crew.lastName].filter(Boolean);
  return parts.join(' ');
}

// Get crew members array (handle both Map structure and array)
let crewMembers = [];
if (Array.isArray(data.crewMembers)) {
  crewMembers = data.crewMembers.map(item => Array.isArray(item) ? item[1] : item);
} else {
  crewMembers = Object.values(data.crewMembers);
}

// Get vessel planning array
let vesselPlanning = [];
if (data.vesselPlanning) {
  if (Array.isArray(data.vesselPlanning)) {
    vesselPlanning = data.vesselPlanning.map(item => Array.isArray(item) ? item[1] : item);
  } else {
    vesselPlanning = Object.values(data.vesselPlanning);
  }
}

// Get next planning ID
let nextPlanningId = Math.max(0, ...vesselPlanning.map(p => p.id || 0)) + 1;

console.log('📊 Starting crew assignment...\n');
console.log('Available crew by rank:');

// Track assignments
let totalAssigned = 0;
const assignments = [];

// Process each vessel
vessels.forEach(vessel => {
  console.log(`\n🚢 Assigning crew to ${vessel.name}...`);
  
  // Get available crew (not already assigned)
  const availableCrew = crewMembers.filter(c => !c.presentVessel && !c.status);
  
  // Assign crew for each required rank
  requiredRanks.forEach(({ rank, count }) => {
    const rankCrew = availableCrew.filter(c => c.presentRank === rank);
    
    for (let i = 0; i < count; i++) {
      if (rankCrew.length > 0) {
        const crew = rankCrew.shift();
        const crewFullName = getCrewFullName(crew);
        
        // Generate assignment data
        const joiningDate = getRandomJoiningDate();
        const contractPeriod = getRandomContractPeriod();
        const rangeStart = joiningDate;
        const rangeEnd = addMonths(joiningDate, contractPeriod + 1); // 1 month buffer
        const reliefDueDate = addMonths(joiningDate, contractPeriod);
        
        // Update crew member
        crew.presentVessel = vessel.name;
        crew.status = 'On Board';
        
        // Create vessel planning record
        const planning = {
          id: nextPlanningId++,
          vesselId: vessel.id,
          rankId: crew.rankId || rank.replace(/\s/g, '').toUpperCase(),
          crewMemberId: crew.id,
          crewName: crewFullName,
          nationality: crew.nationality,
          joiningDate: joiningDate,
          contractPeriod: contractPeriod,
          rangeStart: rangeStart,
          rangeEnd: rangeEnd,
          reliefDueDate: reliefDueDate,
          // On Board Status fields (some blank per requirements)
          signOffDate: null,
          signOffPort: null,
          reliefStatus: null,
          // Reliever Status fields (all blank)
          relieverCrewMemberId: null,
          relieverName: null,
          relieverNationality: null,
          joiningStatus: null,
          relieverContractPeriod: null,
          relieverContractStart: null,
          relieverContractEnd: null,
          relieverJoiningDate: null,
          relieverJoiningPort: null,
          deploymentChecklist: null,
          applicableDocs: null,
          createdAt: new Date().toISOString()
        };
        
        vesselPlanning.push(planning);
        assignments.push({ vessel: vessel.name, crew: crewFullName, rank: rank });
        totalAssigned++;
        
        console.log(`  ✓ ${rank}: ${crewFullName} (Joining: ${joiningDate}, Contract: ${contractPeriod}mo, Relief Due: ${reliefDueDate})`);
      } else {
        console.log(`  ⚠️  No available crew for ${rank}`);
      }
    }
  });
});

// Convert back to Map structure for saving
const crewMembersMap = crewMembers.map((crew, idx) => [crew.id, crew]);
const vesselPlanningMap = vesselPlanning.map((plan, idx) => [plan.id, plan]);

// Update data structure
data.crewMembers = crewMembersMap;
data.vesselPlanning = vesselPlanningMap;

// Save to file
fs.writeFileSync('test-data.json', JSON.stringify(data, null, 2));

console.log(`\n✅ Assignment complete!`);
console.log(`   Total crew assigned: ${totalAssigned}`);
console.log(`   MT Liberty Gas: ${assignments.filter(a => a.vessel === 'MT Liberty Gas').length} crew`);
console.log(`   MT Nordic Star: ${assignments.filter(a => a.vessel === 'MT Nordic Star').length} crew`);
console.log(`\n💾 Data saved to test-data.json`);
console.log(`🔄 Server will reload automatically`);
