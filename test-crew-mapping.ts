import { DatabaseStorage } from "./server/database";
import fs from 'fs';

// Copy the helpers from migration script
function extractFromTuple(item: any): any {
  return Array.isArray(item) && item.length === 2 ? item[1] : item;
}

function convertTimestamps(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };
  const timestampFields = ['createdAt', 'updatedAt', 'signOnDate', 'signOffDate', 'joiningDate'];
  for (const field of timestampFields) {
    if (result[field] && typeof result[field] === 'string') {
      try {
        result[field] = new Date(result[field]);
      } catch (e) {}
    }
  }
  return result;
}

const CREW_FIELD_MAP: Record<string, string> = {
  id: 'id', firstName: 'first_name', middleName: 'middle_name', lastName: 'last_name',
  familyName: 'family_name', rank: 'rank', nationality: 'nationality', vessel: 'vessel',
  vesselType: 'vessel_type', presentVessel: 'present_vessel', presentRank: 'present_rank',
  empNo: 'emp_no', status: 'status', createdAt: 'created_at', updatedAt: 'updated_at'
};

function mapCrewFields(crew: any): any {
  const result: any = {};
  for (const [jsonKey, dbKey] of Object.entries(CREW_FIELD_MAP)) {
    if (crew.hasOwnProperty(jsonKey)) {
      result[dbKey] = crew[jsonKey];
    }
  }
  if (!result.present_vessel) {
    result.present_vessel = result.vessel || '';
  }
  return result;
}

async function test() {
  console.log('Testing crew member schema-aware mapping...\n');
  const db = new DatabaseStorage();
  const jsonData = JSON.parse(fs.readFileSync('./test-data.json', 'utf-8'));
  
  const crewData = extractFromTuple(jsonData.crewMembers[0]);
  console.log('Original data (sample fields):');
  console.log(`  presentVessel: "${crewData.presentVessel}"`);
  console.log(`  firstName: "${crewData.firstName}"`);
  
  const withTimestamps = convertTimestamps(crewData);
  const mapped = mapCrewFields(withTimestamps);
  
  console.log('\nMapped data (sample fields):');
  console.log(`  present_vessel: "${mapped.present_vessel}"`);
  console.log(`  first_name: "${mapped.first_name}"`);
  
  console.log('\nAttempting to insert crew member...');
  try {
    const result = await db.createCrewMember(mapped);
    console.log(`✅ SUCCESS! Inserted crew member: ${result.id}`);
  } catch (error: any) {
    console.log(`❌ FAILED: ${error.message}`);
  }
  
  await db.close();
}

test().catch(console.error);
