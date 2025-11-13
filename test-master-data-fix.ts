import { DatabaseStorage } from "./server/database";
import fs from 'fs';

const storage = new DatabaseStorage();
const extractFromTuple = (item: any) => Array.isArray(item) && item.length === 2 ? item[1] : item;

async function testMasterData() {
  console.log('Testing master data entry insertion...\n');
  const json = JSON.parse(fs.readFileSync('./test-data.json', 'utf-8'));
  
  // Test first vessel entry
  const vesselData = extractFromTuple(json.masterDataEntries[0]);
  console.log('Vessel data:', vesselData);
  
  try {
    const result = await storage.createMasterDataEntry(vesselData);
    console.log(`\n✅ SUCCESS! Created master data entry: ${result.name} (${result.vesselType})`);
  } catch (error: any) {
    console.log(`\n❌ FAILED: ${error.message || error.code}`);
  }
  
  await storage.close();
}

testMasterData().catch(console.error);
