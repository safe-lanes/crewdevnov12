#!/usr/bin/env node

// Script to remove duplicate nationality entries

import mysql from 'mysql2/promise';

const connectToDatabase = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'crew_database',
    ssl: {
      rejectUnauthorized: false
    }
  });
  return connection;
};

const cleanDuplicateNationalities = async () => {
  const connection = await connectToDatabase();
  
  try {
    console.log('🔍 Finding duplicate nationality entries...');
    
    // Find duplicates by entry_id
    const [duplicates] = await connection.execute(`
      SELECT entry_id, COUNT(*) as count, GROUP_CONCAT(id) as ids
      FROM master_data_entries 
      WHERE master_id = '001' 
      GROUP BY entry_id 
      HAVING COUNT(*) > 1
      ORDER BY entry_id
    `);
    
    console.log(`📊 Found ${duplicates.length} entry_ids with duplicates:`);
    
    for (const dup of duplicates) {
      console.log(`   ${dup.entry_id}: ${dup.count} entries (IDs: ${dup.ids})`);
    }
    
    if (duplicates.length > 0) {
      console.log('🧹 Removing duplicate entries (keeping the first occurrence of each)...');
      
      for (const dup of duplicates) {
        const ids = dup.ids.split(',').map(id => parseInt(id));
        const keepId = Math.min(...ids); // Keep the entry with the lowest ID
        const removeIds = ids.filter(id => id !== keepId);
        
        console.log(`   ${dup.entry_id}: Keeping ID ${keepId}, removing IDs: ${removeIds.join(', ')}`);
        
        if (removeIds.length > 0) {
          await connection.execute(
            `DELETE FROM master_data_entries WHERE id IN (${removeIds.map(() => '?').join(',')})`,
            removeIds
          );
        }
      }
      
      console.log('✅ Duplicate entries removed successfully');
      
      // Verify the cleanup
      const [finalCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = "001"'
      );
      console.log(`📊 Final nationality entries count: ${finalCount[0].count}`);
      
    } else {
      console.log('✅ No duplicates found');
    }
    
  } catch (error) {
    console.error('❌ Error cleaning duplicates:', error);
  } finally {
    await connection.end();
  }
};

// Run the script
cleanDuplicateNationalities().catch(console.error);