import http from 'http';

async function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function cleanupDuplicates() {
  console.log('🧹 Starting Master Data Duplicate Cleanup...\n');

  try {
    // Clean up Vessel Type Master (004) duplicates
    console.log('🚢 CLEANING VESSEL TYPE MASTER (004):');
    const vesselTypesResponse = await makeRequest('GET', '/api/masters/004/data');
    
    if (vesselTypesResponse.status === 200) {
      const vesselTypes = vesselTypesResponse.data;
      console.log(`📊 Found ${vesselTypes.length} total vessel type entries`);
      
      // Group by entry_id to find duplicates
      const vesselTypeGroups = {};
      vesselTypes.forEach(entry => {
        const entryId = entry.entryId;
        if (!vesselTypeGroups[entryId]) {
          vesselTypeGroups[entryId] = [];
        }
        vesselTypeGroups[entryId].push(entry);
      });

      let vesselTypeDeletedCount = 0;
      
      // Process each group and remove duplicates
      for (const [entryId, entries] of Object.entries(vesselTypeGroups)) {
        if (entries.length > 1) {
          console.log(`🚨 Found ${entries.length} duplicates for ${entryId} (${entries[0].name})`);
          
          // Sort by ID (descending) to keep the most recent one
          entries.sort((a, b) => b.id - a.id);
          const keepEntry = entries[0];
          const deleteEntries = entries.slice(1);
          
          console.log(`   ✅ Keeping entry ID ${keepEntry.id} (created: ${keepEntry.createdAt})`);
          
          // Delete the duplicate entries
          for (const deleteEntry of deleteEntries) {
            console.log(`   🗑️ Deleting entry ID ${deleteEntry.id} (created: ${deleteEntry.createdAt})`);
            const deleteResponse = await makeRequest('DELETE', `/api/master-data/${deleteEntry.id}`);
            if (deleteResponse.status === 200) {
              vesselTypeDeletedCount++;
            } else {
              console.log(`   ❌ Failed to delete entry ID ${deleteEntry.id} - Status: ${deleteResponse.status}`);
            }
          }
        }
      }
      
      console.log(`✅ Deleted ${vesselTypeDeletedCount} duplicate vessel type entries\n`);
    }

    // Clean up Designation Master (012) duplicates
    console.log('👥 CLEANING DESIGNATION MASTER (012):');
    const designationsResponse = await makeRequest('GET', '/api/masters/012/data');
    
    if (designationsResponse.status === 200) {
      const designations = designationsResponse.data;
      console.log(`📊 Found ${designations.length} total designation entries`);
      
      // Group by entry_id to find duplicates
      const designationGroups = {};
      designations.forEach(entry => {
        const entryId = entry.entryId;
        if (!designationGroups[entryId]) {
          designationGroups[entryId] = [];
        }
        designationGroups[entryId].push(entry);
      });

      let designationDeletedCount = 0;
      
      // Process each group and remove duplicates
      for (const [entryId, entries] of Object.entries(designationGroups)) {
        if (entries.length > 1) {
          console.log(`🚨 Found ${entries.length} duplicates for ${entryId} (${entries[0].name})`);
          
          // Sort by ID (descending) to keep the most recent one
          entries.sort((a, b) => b.id - a.id);
          const keepEntry = entries[0];
          const deleteEntries = entries.slice(1);
          
          console.log(`   ✅ Keeping entry ID ${keepEntry.id} (created: ${keepEntry.createdAt})`);
          
          // Delete the duplicate entries
          for (const deleteEntry of deleteEntries) {
            console.log(`   🗑️ Deleting entry ID ${deleteEntry.id} (created: ${deleteEntry.createdAt})`);
            const deleteResponse = await makeRequest('DELETE', `/api/master-data/${deleteEntry.id}`);
            if (deleteResponse.status === 200) {
              designationDeletedCount++;
            } else {
              console.log(`   ❌ Failed to delete entry ID ${deleteEntry.id} - Status: ${deleteResponse.status}`);
            }
          }
        }
      }
      
      console.log(`✅ Deleted ${designationDeletedCount} duplicate designation entries\n`);
    }

    // Verify cleanup results
    console.log('🔍 VERIFYING CLEANUP RESULTS:');
    
    const finalVesselTypesResponse = await makeRequest('GET', '/api/masters/004/data');
    if (finalVesselTypesResponse.status === 200) {
      const finalVesselTypes = finalVesselTypesResponse.data;
      console.log(`📋 Vessel Type Master now has ${finalVesselTypes.length} entries`);
      
      // Check for remaining duplicates
      const finalVtGroups = {};
      finalVesselTypes.forEach(entry => {
        const entryId = entry.entryId;
        if (!finalVtGroups[entryId]) {
          finalVtGroups[entryId] = 0;
        }
        finalVtGroups[entryId]++;
      });
      
      const vtDuplicates = Object.entries(finalVtGroups).filter(([id, count]) => count > 1);
      if (vtDuplicates.length === 0) {
        console.log('✅ No remaining vessel type duplicates');
      } else {
        console.log('🚨 Remaining vessel type duplicates:', vtDuplicates);
      }
    }

    const finalDesignationsResponse = await makeRequest('GET', '/api/masters/012/data');
    if (finalDesignationsResponse.status === 200) {
      const finalDesignations = finalDesignationsResponse.data;
      console.log(`📋 Designation Master now has ${finalDesignations.length} entries`);
      
      // Check for remaining duplicates
      const finalDesGroups = {};
      finalDesignations.forEach(entry => {
        const entryId = entry.entryId;
        if (!finalDesGroups[entryId]) {
          finalDesGroups[entryId] = 0;
        }
        finalDesGroups[entryId]++;
      });
      
      const desDuplicates = Object.entries(finalDesGroups).filter(([id, count]) => count > 1);
      if (desDuplicates.length === 0) {
        console.log('✅ No remaining designation duplicates');
      } else {
        console.log('🚨 Remaining designation duplicates:', desDuplicates);
      }
    }

    console.log('\n🎉 Master Data Duplicate Cleanup Complete!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Run the cleanup
cleanupDuplicates();