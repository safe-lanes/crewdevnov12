import { DatabaseStorage } from "./server/database";
import fs from 'fs';

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

async function test() {
  const db = new DatabaseStorage();
  const json = JSON.parse(fs.readFileSync('./test-data.json', 'utf-8'));
  
  console.log('Testing crew member migration (NO field mapping)...\n');
  const crewData = extractFromTuple(json.crewMembers[0]);
  console.log('Original camelCase data (sample):');
  console.log(`  presentVessel: "${crewData.presentVessel}"`);
  console.log(`  firstName: "${crewData.firstName}"`);
  
  const withTimestamps = convertTimestamps(crewData);
  console.log('\nWith timestamps converted:');
  console.log(`  presentVessel: "${withTimestamps.presentVessel}"`);
  console.log(`  firstName: "${withTimestamps.firstName}"`);
  
  console.log('\nAttempting insert...');
  try {
    const result = await db.createCrewMember(withTimestamps);
    console.log(`✅ SUCCESS! Inserted: ${result.id} (${result.firstName} ${result.familyName})`);
  } catch (error: any) {
    console.log(`❌ FAILED: ${error.message}`);
  }
  
  await db.close();
}

test().catch(console.error);
