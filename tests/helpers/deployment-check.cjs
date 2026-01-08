// Smart Deployment Decision Logic
// Determines whether deployment should be allowed based on test results

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(process.cwd(), 'test-results');
const REGRESSIONS_PATH = path.join(RESULTS_DIR, 'REGRESSIONS.md');
const NEW_FEATURES_PATH = path.join(RESULTS_DIR, 'NEW-FEATURES.md');
const BASELINE_PATH = path.join(RESULTS_DIR, 'baseline.json');

/**
 * Check if deployment should be blocked
 */
function shouldBlockDeployment() {
  // Check for regressions file (existence = regressions exist)
  if (fs.existsSync(REGRESSIONS_PATH)) {
    const content = fs.readFileSync(REGRESSIONS_PATH, 'utf8');
    // Make sure it's not empty
    if (content.trim().length > 0 && content.includes('REGRESSIONS DETECTED')) {
      return {
        blocked: true,
        reason: 'Regressions detected - existing functionality is broken',
        file: REGRESSIONS_PATH,
      };
    }
  }
  
  return {
    blocked: false,
    reason: 'No regressions detected',
  };
}

/**
 * Check for new feature tests
 */
function checkNewFeatures() {
  if (fs.existsSync(NEW_FEATURES_PATH)) {
    const content = fs.readFileSync(NEW_FEATURES_PATH, 'utf8');
    if (content.trim().length > 0) {
      const hasFailingNew = content.includes('Status: FAILED');
      return {
        hasNewTests: true,
        hasFailingNewTests: hasFailingNew,
        file: NEW_FEATURES_PATH,
      };
    }
  }
  
  return {
    hasNewTests: false,
    hasFailingNewTests: false,
  };
}

/**
 * Check if baseline exists
 */
function hasBaseline() {
  return fs.existsSync(BASELINE_PATH);
}

/**
 * Get deployment decision with detailed explanation
 */
function getDeploymentDecision() {
  const decision = {
    allowed: true,
    blockedBy: null,
    warnings: [],
    details: {},
  };
  
  // Check for regressions (blocks deployment)
  const regressionCheck = shouldBlockDeployment();
  if (regressionCheck.blocked) {
    decision.allowed = false;
    decision.blockedBy = 'regressions';
    decision.details.regressions = regressionCheck;
  }
  
  // Check for new features (warning only)
  const newFeaturesCheck = checkNewFeatures();
  decision.details.newFeatures = newFeaturesCheck;
  
  if (newFeaturesCheck.hasFailingNewTests) {
    decision.warnings.push('Some new feature tests are failing - these features may not work correctly');
  }
  
  // Check for baseline
  if (!hasBaseline()) {
    decision.warnings.push('No baseline exists - this is the first test run');
  }
  
  return decision;
}

/**
 * Print deployment decision
 */
function printDecision() {
  const decision = getDeploymentDecision();
  
  console.log('\n' + '='.repeat(50));
  console.log('DEPLOYMENT DECISION');
  console.log('='.repeat(50) + '\n');
  
  if (decision.allowed) {
    console.log('STATUS: DEPLOYMENT ALLOWED');
    console.log('');
    console.log('No regressions detected. Safe to deploy.');
  } else {
    console.log('STATUS: DEPLOYMENT BLOCKED');
    console.log('');
    console.log(`Blocked by: ${decision.blockedBy}`);
    console.log(`Reason: ${decision.details.regressions?.reason}`);
    console.log(`Details: See ${decision.details.regressions?.file}`);
  }
  
  if (decision.warnings.length > 0) {
    console.log('\nWarnings:');
    decision.warnings.forEach(w => console.log(`  - ${w}`));
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  return decision.allowed;
}

module.exports = {
  shouldBlockDeployment,
  checkNewFeatures,
  hasBaseline,
  getDeploymentDecision,
  printDecision,
};

// Run if executed directly
if (require.main === module) {
  const allowed = printDecision();
  process.exit(allowed ? 0 : 1);
}
