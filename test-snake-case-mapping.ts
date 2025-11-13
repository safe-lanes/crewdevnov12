import { DatabaseStorage } from "./server/database";
import fs from 'fs';

// Helper functions
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function mapFieldsToSnakeCase(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeCase(key)] = value;
  }
  return result;
}

async function testMapping() {
  console.log('Testing camelCase → snake_case mapping...\n');
  
  const db = new DatabaseStorage();
  
  const jsonData = JSON.parse(fs.readFileSync('./test-data.json', 'utf-8'));
  
  const crewArray = jsonData.crewMembers[0];
  const crewData = Array.isArray(crewArray) && crewArray.length === 2 ? crewArray[1] : crewArray;
  
  console.log('Original camelCase keys (first 10):');
  console.log(Object.keys(crewData).slice(0, 10).join(', '));
  
  const snakeCased = mapFieldsToSnakeCase(crewData);
  
  console.log('\nMapped snake_case keys (first 10):');
  console.log(Object.keys(snakeCased).slice(0, 10).join(', '));
  
  console.log('\nSample field mappings:');
  console.log(`  presentVessel → present_vessel: "${crewData.presentVessel}" → "${snakeCased.present_vessel}"`);
  console.log(`  firstName → first_name: "${crewData.firstName}" → "${snakeCased.first_name}"`);
  console.log(`  empNo → emp_no: "${crewData.empNo}" → "${snakeCased.emp_no}"`);
  
  await db.close();
  console.log('\n✅ Mapping test complete!');
}

testMapping().catch(console.error);
