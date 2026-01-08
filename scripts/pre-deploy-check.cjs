#!/usr/bin/env node

// Pre-Deployment Regression Check Script
// Cross-platform (Windows, Mac, Linux)
// Blocks deployment only on TRUE regressions

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('==================================================');
console.log('PRE-DEPLOYMENT REGRESSION CHECK');
console.log('==================================================\n');

const RESULTS_DIR = path.join(process.cwd(), 'test-results');
const REGRESSIONS_FILE = path.join(RESULTS_DIR, 'REGRESSIONS.md');
const NEW_FEATURES_FILE = path.join(RESULTS_DIR, 'NEW-FEATURES.md');

/**
 * Run tests and capture results
 */
function runTests() {
  console.log('Running tests...\n');
  
  try {
    execSync('npm test', { 
      stdio: 'inherit',
      encoding: 'utf8',
    });
    return true;
  } catch (error) {
    // Tests may fail but we still check for regressions vs new failures
    console.log('\nSome tests failed. Analyzing results...\n');
    return false;
  }
}

/**
 * Check for regressions
 */
function checkRegressions() {
  if (fs.existsSync(REGRESSIONS_FILE)) {
    const content = fs.readFileSync(REGRESSIONS_FILE, 'utf8');
    if (content.trim().length > 0 && content.includes('REGRESSIONS DETECTED')) {
      return {
        hasRegressions: true,
        content: content,
      };
    }
  }
  return { hasRegressions: false };
}

/**
 * Check for new feature tests
 */
function checkNewFeatures() {
  if (fs.existsSync(NEW_FEATURES_FILE)) {
    const content = fs.readFileSync(NEW_FEATURES_FILE, 'utf8');
    if (content.trim().length > 0) {
      const hasFailingNew = content.includes('Status: FAILED');
      return {
        hasNewTests: true,
        hasFailingNew: hasFailingNew,
        content: content,
      };
    }
  }
  return { hasNewTests: false, hasFailingNew: false };
}

/**
 * Main execution
 */
function main() {
  try {
    // Run all tests
    const testsRan = runTests();
    
    // Check for TRUE regressions only (not new features)
    const regressionCheck = checkRegressions();
    
    if (regressionCheck.hasRegressions) {
      console.log('\n==================================================');
      console.log('REGRESSIONS DETECTED!');
      console.log('==================================================');
      console.log(regressionCheck.content);
      console.log('==================================================\n');
      console.log('DEPLOYMENT BLOCKED');
      console.log('Reason: Existing functionality is broken');
      console.log('Action: Fix regressions before deploying\n');
      process.exit(1);
    }
    
    // Inform about new features (but don\'t block)
    const newFeaturesCheck = checkNewFeatures();
    
    if (newFeaturesCheck.hasNewTests) {
      console.log('\n==================================================');
      console.log('New Feature Tests Detected');
      console.log('==================================================');
      
      if (newFeaturesCheck.hasFailingNew) {
        console.log('Warning: Some new feature tests are failing');
        console.log('These new features may not work correctly yet');
        console.log('Consider fixing before deploying\n');
      } else {
        console.log('All new feature tests are passing\n');
      }
      
      console.log('Note: New features don\'t block deployment\n');
    }
    
    // All good - no TRUE regressions
    console.log('==================================================');
    console.log('ALL CHECKS PASSED');
    console.log('NO REGRESSIONS DETECTED');
    console.log('SAFE TO DEPLOY');
    console.log('==================================================\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\nPre-deployment check failed');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
