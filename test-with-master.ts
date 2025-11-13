import { DatabaseStorage } from "./server/database";
import fs from 'fs';

const storage = new DatabaseStorage();
const extractFromTuple = (item: any) => Array.isArray(item) && item.length === 2 ? item[1] : item;

async function testWithMaster() {
  console.log('Creating master definition first, then master data entry...\n');
  
  // Step 1: Create the master definition (id='014' for Vessel Master)
  const masterDef = {
    id: '014',
    name: 'Vessel Master',
    description: 'Vessel Master Data',
    fields: JSON.stringify([
      {name: 'name', type: 'text', label: 'Vessel Name'},
      {name: 'vesselType', type: 'text', label: 'Vessel Type'}
    ])
  };
  
  try {
    await storage.createDataMaster(masterDef);
    console.log('✅ Created master definition: 014 - Vessel Master\n');
  } catch (error: any) {
    console.log(`⚠️  Master already exists or error: ${error.message}\n`);
  }
  
  // Step 2: Create the master data entry
  const json = JSON.parse(fs.readFileSync('./test-data.json', 'utf-8'));
  const vesselData = extractFromTuple(json.masterDataEntries[0]);
  
  try {
    const result = await storage.createMasterDataEntry(vesselData);
    console.log(`✅ SUCCESS! Created vessel: ${result.name} (${result.vesselType})`);
  } catch (error: any) {
    console.log(`❌ FAILED: ${error.message}`);
  }
  
  await storage.close();
}

testWithMaster().catch(console.error);
