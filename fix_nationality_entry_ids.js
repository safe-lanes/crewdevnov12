#!/usr/bin/env node

// Script to check and fix blank entry IDs in nationality master data

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

const checkNationalityEntries = async () => {
  const connection = await connectToDatabase();
  
  try {
    console.log('🔍 Checking nationality master data (master_id = "001")...');
    
    // Check current entries
    const [rows] = await connection.execute(
      'SELECT id, entry_id, name, description FROM master_data_entries WHERE master_id = "001" ORDER BY id'
    );
    
    console.log(`📊 Found ${rows.length} nationality entries:`);
    
    let blankEntryIds = 0;
    let validEntryIds = 0;
    
    for (const row of rows) {
      if (!row.entry_id || row.entry_id.trim() === '') {
        console.log(`❌ BLANK entry_id: ID ${row.id} - "${row.name}" (${row.description})`);
        blankEntryIds++;
      } else {
        console.log(`✅ Valid entry_id: ${row.entry_id} - "${row.name}" (${row.description})`);
        validEntryIds++;
      }
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`   Valid entry IDs: ${validEntryIds}`);
    console.log(`   Blank entry IDs: ${blankEntryIds}`);
    
    if (blankEntryIds > 0) {
      console.log(`\n🛠️ Will fix ${blankEntryIds} blank entry IDs...`);
      await fixBlankEntryIds(connection, rows);
    } else {
      console.log(`\n✅ All entries have valid entry IDs!`);
    }
    
  } catch (error) {
    console.error('❌ Error checking nationality data:', error);
  } finally {
    await connection.end();
  }
};

const fixBlankEntryIds = async (connection, rows) => {
  try {
    let counter = 1;
    
    for (const row of rows) {
      if (!row.entry_id || row.entry_id.trim() === '') {
        const newEntryId = `NAT${counter.toString().padStart(3, '0')}`;
        
        console.log(`🔧 Fixing ID ${row.id}: "${row.name}" -> entry_id: ${newEntryId}`);
        
        await connection.execute(
          'UPDATE master_data_entries SET entry_id = ? WHERE id = ?',
          [newEntryId, row.id]
        );
        
        counter++;
      }
    }
    
    console.log(`✅ Successfully fixed ${counter - 1} blank entry IDs`);
    
  } catch (error) {
    console.error('❌ Error fixing blank entry IDs:', error);
    throw error;
  }
};

// Run the script
checkNationalityEntries().catch(console.error);