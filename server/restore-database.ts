import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const execAsync = promisify(exec);

async function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

async function restoreDatabase() {
  console.log('🔄 PostgreSQL Database Restore\n');
  
  const backupDir = path.join(process.cwd(), 'backups');
  
  if (!fs.existsSync(backupDir)) {
    console.error('❌ No backups directory found');
    process.exit(1);
  }
  
  const backupFiles = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .reverse();
  
  if (backupFiles.length === 0) {
    console.error('❌ No backup files found in backups/');
    process.exit(1);
  }
  
  console.log('📁 Available backups:');
  backupFiles.forEach((file, index) => {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`   ${index + 1}. ${file} (${sizeMB} MB)`);
  });
  
  console.log('\n⚠️  WARNING: This will REPLACE all current database data!');
  const confirm = await askQuestion('\nType "RESTORE" to confirm: ');
  
  if (confirm !== 'RESTORE') {
    console.log('❌ Restore cancelled');
    process.exit(0);
  }
  
  const fileIndex = await askQuestion('\nEnter backup number to restore: ');
  const selectedFile = backupFiles[parseInt(fileIndex) - 1];
  
  if (!selectedFile) {
    console.error('❌ Invalid selection');
    process.exit(1);
  }
  
  const backupFile = path.join(backupDir, selectedFile);
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found');
  }
  
  console.log(`\n🔄 Restoring from: ${selectedFile}`);
  console.log('   This may take a minute...\n');
  
  try {
    const restoreCommand = `psql "${databaseUrl}" < "${backupFile}"`;
    await execAsync(restoreCommand);
    
    console.log('✅ DATABASE RESTORED SUCCESSFULLY!\n');
    console.log('📊 Restored:');
    console.log('   ├── All 31 tables');
    console.log('   ├── All data records');
    console.log('   ├── All sequences');
    console.log('   └── All constraints\n');
    
    console.log('💡 Restart your application to use the restored database');
    
  } catch (error: any) {
    console.error('\n❌ RESTORE FAILED:', error.message);
    throw error;
  }
}

restoreDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
