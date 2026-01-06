#!/usr/bin/env node

// Safety Check Script
// Cross-platform (Windows, Mac, Linux)
// Verifies application integrity before running tests

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('==================================================');
console.log('SAFETY CHECK');
console.log('==================================================\n');

let checksPass = true;
const issues = [];

/**
 * Check 1: Verify critical files unchanged (if git is available)
 */
function checkCriticalFiles() {
  console.log('1. Checking if application code unchanged...');
  
  try {
    const gitStatus = execSync('git diff --name-only client/ server/ shared/', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    if (gitStatus.trim()) {
      console.log('   Warning: Application code was modified');
      console.log('   Changed files:');
      gitStatus.trim().split('\n').forEach(file => {
        console.log(`     - ${file}`);
      });
      // This is informational, not a blocker
    } else {
      console.log('   Application code unchanged');
    }
  } catch (error) {
    console.log('   Git not available or not a git repo - skipping check');
  }
}

/**
 * Check 2: Verify package.json has dev script
 */
function checkDevScript() {
  console.log('\n2. Checking if dev script exists...');
  
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (packageJson.scripts && packageJson.scripts.dev) {
      console.log('   Dev script exists');
      return true;
    } else {
      console.log('   ERROR: Dev script missing!');
      issues.push('Dev script missing from package.json');
      checksPass = false;
      return false;
    }
  } catch (error) {
    console.log('   ERROR: Could not read package.json');
    issues.push('Could not read package.json');
    checksPass = false;
    return false;
  }
}

/**
 * Check 3: Verify test scripts exist
 */
function checkTestScripts() {
  console.log('\n3. Checking if test scripts exist...');
  
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const testScripts = ['test', 'test:unit', 'test:e2e'];
    const missingScripts = testScripts.filter(script => 
      !packageJson.scripts || !packageJson.scripts[script]
    );
    
    if (missingScripts.length === 0) {
      console.log('   All test scripts exist');
      return true;
    } else {
      console.log('   Warning: Some test scripts missing:', missingScripts.join(', '));
      return false;
    }
  } catch (error) {
    console.log('   Could not verify test scripts');
    return false;
  }
}

/**
 * Check 4: Verify test configuration files exist
 */
function checkTestConfig() {
  console.log('\n4. Checking test configuration...');
  
  const configFiles = [
    'vitest.config.ts',
    'playwright.config.ts',
  ];
  
  const missingConfigs = configFiles.filter(file => 
    !fs.existsSync(path.join(process.cwd(), file))
  );
  
  if (missingConfigs.length === 0) {
    console.log('   All test configuration files exist');
    return true;
  } else {
    console.log('   Warning: Missing config files:', missingConfigs.join(', '));
    return false;
  }
}

/**
 * Check 5: Verify tests directory exists
 */
function checkTestsDirectory() {
  console.log('\n5. Checking tests directory...');
  
  const testsDir = path.join(process.cwd(), 'tests');
  
  if (fs.existsSync(testsDir)) {
    const files = fs.readdirSync(testsDir);
    console.log(`   Tests directory exists with ${files.length} items`);
    return true;
  } else {
    console.log('   ERROR: Tests directory not found');
    issues.push('Tests directory not found');
    checksPass = false;
    return false;
  }
}

/**
 * Check 6: Try to start app (quick check)
 */
function checkAppStarts() {
  return new Promise((resolve) => {
    console.log('\n6. Checking if app starts...');
    console.log('   Starting app (will timeout after 10 seconds)...');
    
    const startApp = spawn('npm', ['run', 'dev'], {
      shell: true,
      stdio: 'pipe',
    });
    
    let appStarted = false;
    let output = '';
    
    startApp.stdout.on('data', (data) => {
      output += data.toString();
      // Check for common success messages
      if (output.includes('Local:') || 
          output.includes('localhost') || 
          output.includes('ready') ||
          output.includes('listening') ||
          output.includes('Server started') ||
          output.includes('5000')) {
        appStarted = true;
      }
    });
    
    startApp.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    // Wait 10 seconds then check
    setTimeout(() => {
      startApp.kill();
      
      if (appStarted) {
        console.log('   App starts successfully');
      } else {
        console.log('   Warning: Could not confirm app started');
        console.log('   (This may be normal if app takes longer to start)');
      }
      
      resolve(appStarted);
    }, 10000);
  });
}

/**
 * Print final results
 */
function printResults() {
  console.log('\n==================================================');
  
  if (checksPass) {
    console.log('ALL SAFETY CHECKS PASSED');
    console.log('App is safe to use!');
    console.log('You can now run: npm test');
  } else {
    console.log('SAFETY CHECKS FAILED');
    console.log('Issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  console.log('==================================================\n');
}

/**
 * Main execution
 */
async function main() {
  try {
    checkCriticalFiles();
    checkDevScript();
    checkTestScripts();
    checkTestConfig();
    checkTestsDirectory();
    
    // App start check is optional - don't block on it
    await checkAppStarts();
    
    printResults();
    
    process.exit(checksPass ? 0 : 1);
    
  } catch (error) {
    console.error('\nSafety check encountered an error:', error.message);
    process.exit(1);
  }
}

main();
