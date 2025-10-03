// Direct update to test-data.json to clear presentVessel and status fields
const fs = require('fs');

try {
  console.log('🔄 Loading test-data.json...\n');
  
  const data = JSON.parse(fs.readFileSync('test-data.json', 'utf8'));
  
  // Convert crewMembers array to Map
  const crewMap = new Map(data.crewMembers || []);
  
  console.log(`📊 Found ${crewMap.size} crew members`);
  
  let updated = 0;
  
  // Update each crew member
  for (const [id, crew] of crewMap.entries()) {
    if (crew.presentVessel || crew.status) {
      crew.presentVessel = null;
      crew.status = null;
      crewMap.set(id, crew);
      updated++;
    }
  }
  
  // Convert Map back to array format
  data.crewMembers = Array.from(crewMap.entries());
  
  // Save back to file
  fs.writeFileSync('test-data.json', JSON.stringify(data), 'utf8');
  
  console.log(`\n✅ Updated ${updated} crew members`);
  console.log(`💾 Changes saved to test-data.json`);
  console.log(`\n🔄 Please restart the server to reload the data`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
