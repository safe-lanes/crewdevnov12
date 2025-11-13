import { DatabaseStorage } from "./server/database";
import fs from 'fs';

const storage = new DatabaseStorage();
const extractFromTuple = (item: any) => Array.isArray(item) && item.length === 2 ? item[1] : item;
const convertTimestamps = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };
  const fields = ['createdAt', 'updatedAt', 'signOnDate', 'signOffDate', 'joiningDate', 'reliefDue'];
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      try { result[field] = new Date(result[field]); } catch (e) {}
    }
  }
  return result;
};

async function testMigration() {
  console.log('Testing migration with first 5 crew members...\n');
  const json = JSON.parse(fs.readFileSync('./test-data.json', 'utf-8'));
  
  // Clear crew_members table
  await storage.db.execute('TRUNCATE TABLE crew_members CASCADE');
  console.log('✅ Cleared crew_members table\n');
  
  // Migrate first 5 crew members
  let successCount = 0;
  const limit = Math.min(5, json.crewMembers.length);
  
  for (let i = 0; i < limit; i++) {
    const crewData = extractFromTuple(json.crewMembers[i]);
    try {
      const withTimestamps = convertTimestamps(crewData);
      const result = await storage.createCrewMember(withTimestamps);
      console.log(`✅ ${i+1}. Migrated: ${result.id} (${result.firstName} ${result.familyName})`);
      successCount++;
    } catch (error: any) {
      console.log(`❌ ${i+1}. Failed: ${crewData.id} - ${error.message}`);
    }
  }
  
  console.log(`\n📊 RESULT: ${successCount}/${limit} crew members migrated successfully`);
  await storage.close();
}

testMigration().catch(console.error);
