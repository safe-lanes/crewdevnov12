import http from 'http';

async function fetchMasterData(masterId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api/masters/${masterId}/data`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function investigateDuplicates() {
  console.log('🔍 Investigating duplicate entries...\n');

  try {
    // Fetch Vessel Type master (004)
    console.log('📋 VESSEL TYPE MASTER (004):');
    const vesselTypes = await fetchMasterData('004');
    console.log(`Total entries: ${vesselTypes.length}`);
    
    // Group by name to find duplicates
    const vesselTypesByName = {};
    vesselTypes.forEach(entry => {
      const name = entry.name || 'unnamed';
      if (!vesselTypesByName[name]) {
        vesselTypesByName[name] = [];
      }
      vesselTypesByName[name].push(entry);
    });

    console.log('\nEntries by name:');
    Object.keys(vesselTypesByName).sort().forEach(name => {
      const entries = vesselTypesByName[name];
      if (entries.length > 1) {
        console.log(`🚨 DUPLICATE: "${name}" (${entries.length} entries)`);
        entries.forEach(entry => {
          console.log(`   - ID: ${entry.id}, Entry ID: ${entry.entryId}, Created: ${entry.createdAt}`);
        });
      } else {
        console.log(`✅ "${name}" (1 entry)`);
      }
    });

    console.log('\n' + '='.repeat(70) + '\n');

    // Fetch Designation master (012)
    console.log('📋 DESIGNATION MASTER (012):');
    const designations = await fetchMasterData('012');
    console.log(`Total entries: ${designations.length}`);
    
    // Group by name to find duplicates
    const designationsByName = {};
    designations.forEach(entry => {
      const name = entry.name || 'unnamed';
      if (!designationsByName[name]) {
        designationsByName[name] = [];
      }
      designationsByName[name].push(entry);
    });

    console.log('\nEntries by name:');
    Object.keys(designationsByName).sort().forEach(name => {
      const entries = designationsByName[name];
      if (entries.length > 1) {
        console.log(`🚨 DUPLICATE: "${name}" (${entries.length} entries)`);
        entries.forEach(entry => {
          console.log(`   - ID: ${entry.id}, Entry ID: ${entry.entryId}, Created: ${entry.createdAt}`);
        });
      } else {
        console.log(`✅ "${name}" (1 entry)`);
      }
    });

    // Look for "No vessel type" or "No classification" entries
    console.log('\n' + '='.repeat(70) + '\n');
    console.log('🔍 SEARCHING FOR PROBLEMATIC ENTRIES:');
    
    const problematicVesselTypes = vesselTypes.filter(entry => 
      entry.name && (
        entry.name.toLowerCase().includes('no vessel') ||
        entry.name.toLowerCase().includes('no classification') ||
        entry.description && entry.description.toLowerCase().includes('no classification')
      )
    );

    if (problematicVesselTypes.length > 0) {
      console.log('\n🚨 Found problematic vessel type entries:');
      problematicVesselTypes.forEach(entry => {
        console.log(`   - Name: "${entry.name}", Description: "${entry.description}", ID: ${entry.id}, Entry ID: ${entry.entryId}`);
      });
    } else {
      console.log('\n✅ No "No vessel type" or "No classification" entries found in current data');
    }

    // Look for entry IDs that match the pattern mentioned in screenshots
    console.log('\n🔍 SEARCHING FOR ENTRY ID PATTERNS:');
    const vtPatterns = vesselTypes.filter(entry => 
      entry.entryId && entry.entryId.match(/^VT\d+$/)
    );
    
    if (vtPatterns.length > 0) {
      console.log('\n📝 Found VT### pattern entries:');
      vtPatterns.forEach(entry => {
        console.log(`   - Entry ID: ${entry.entryId}, Name: "${entry.name}", Description: "${entry.description}"`);
      });
    }

    const desPatterns = designations.filter(entry => 
      entry.entryId && entry.entryId.match(/^DES\d+$/)
    );
    
    if (desPatterns.length > 0) {
      console.log('\n📝 Found DES### pattern entries:');
      desPatterns.forEach(entry => {
        console.log(`   - Entry ID: ${entry.entryId}, Name: "${entry.name}", Description: "${entry.description}"`);
      });
    }

  } catch (error) {
    console.error('❌ Error fetching data:', error);
  }
}

// Run the investigation
investigateDuplicates();