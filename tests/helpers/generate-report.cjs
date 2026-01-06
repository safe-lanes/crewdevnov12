// Comprehensive Test Report Generator
// Generates all report files after test runs

const fs = require('fs');
const path = require('path');
const { runDetection } = require('./regression-detector.cjs');

const RESULTS_DIR = path.join(process.cwd(), 'test-results');
const HISTORY_DIR = path.join(RESULTS_DIR, 'history');
const LOGS_DIR = path.join(process.cwd(), 'test-logs');
const COVERAGE_DIR = path.join(process.cwd(), 'coverage');

/**
 * Ensure all directories exist
 */
function ensureDirectories() {
  [RESULTS_DIR, HISTORY_DIR, LOGS_DIR, COVERAGE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Get current timestamp for filenames
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Get date string for history
 */
function getDateString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Save results to history
 */
function saveToHistory() {
  const resultsPath = path.join(RESULTS_DIR, 'results.json');
  if (fs.existsSync(resultsPath)) {
    const historyPath = path.join(HISTORY_DIR, `${getDateString()}.json`);
    fs.copyFileSync(resultsPath, historyPath);
    
    // Keep only last 30 days of history
    const files = fs.readdirSync(HISTORY_DIR).sort();
    while (files.length > 30) {
      const oldFile = files.shift();
      fs.unlinkSync(path.join(HISTORY_DIR, oldFile));
    }
  }
}

/**
 * Generate detailed log file
 */
function generateLogFile(summary) {
  const timestamp = getTimestamp();
  const logPath = path.join(LOGS_DIR, `test-run-${timestamp}.log`);
  
  let log = `Test Run Log - ${new Date().toISOString()}\n`;
  log += `${'='.repeat(60)}\n\n`;
  
  log += `SUMMARY\n`;
  log += `-`.repeat(40) + `\n`;
  log += `Total Tests: ${(summary.passing || 0) + (summary.failing || 0) + (summary.regressions || 0)}\n`;
  log += `Passing: ${summary.passing || 0}\n`;
  log += `Failing: ${summary.failing || 0}\n`;
  log += `Regressions: ${summary.regressions || 0}\n`;
  log += `New Tests: ${summary.newTests || 0}\n\n`;
  
  log += `DEPLOYMENT STATUS\n`;
  log += `-`.repeat(40) + `\n`;
  if (summary.regressions > 0) {
    log += `Status: BLOCKED\n`;
    log += `Reason: ${summary.regressions} regression(s) detected\n`;
    log += `Action: Fix regressions before deploying\n`;
  } else {
    log += `Status: ALLOWED\n`;
    log += `Reason: No regressions detected\n`;
  }
  log += `\n`;
  
  log += `REPORTS GENERATED\n`;
  log += `-`.repeat(40) + `\n`;
  log += `- test-results/index.html (Visual Report)\n`;
  log += `- test-results/results.json (Machine Readable)\n`;
  log += `- test-results/junit.xml (CI/CD Compatible)\n`;
  log += `- coverage/index.html (Code Coverage)\n`;
  if (summary.regressions > 0) {
    log += `- test-results/REGRESSIONS.md (Blocks Deployment)\n`;
  }
  if (summary.newTests > 0) {
    log += `- test-results/NEW-FEATURES.md (Informational)\n`;
  }
  log += `\n`;
  
  log += `END OF LOG\n`;
  log += `${'='.repeat(60)}\n`;
  
  fs.writeFileSync(logPath, log);
  console.log(`Log saved: ${logPath}`);
  
  // Keep only last 30 log files
  const files = fs.readdirSync(LOGS_DIR).filter(f => f.startsWith('test-run-')).sort();
  while (files.length > 30) {
    const oldFile = files.shift();
    fs.unlinkSync(path.join(LOGS_DIR, oldFile));
  }
}

/**
 * Print console summary
 */
function printConsoleSummary(summary, hasRegressions) {
  console.log('\n' + '='.repeat(50));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(50) + '\n');
  
  const total = (summary.passing || 0) + (summary.failing || 0) + (summary.regressions || 0);
  console.log(`Total Tests: ${total}`);
  console.log(`  Passed: ${summary.passing || 0}`);
  console.log(`  Failed: ${(summary.failing || 0) + (summary.regressions || 0)}`);
  console.log('');
  
  console.log('Regression Analysis:');
  if (summary.regressions > 0) {
    console.log(`  REGRESSIONS: ${summary.regressions} (BLOCKS DEPLOYMENT)`);
  } else {
    console.log(`  REGRESSIONS: 0`);
  }
  
  if (summary.newTests > 0) {
    console.log(`  NEW TESTS: ${summary.newTests} (informational)`);
  }
  
  console.log('');
  console.log('-'.repeat(50));
  
  if (hasRegressions) {
    console.log('DEPLOYMENT STATUS: BLOCKED');
    console.log('Reason: Existing functionality is broken');
    console.log('Action: Fix regressions before deploying');
  } else {
    console.log('DEPLOYMENT STATUS: ALLOWED');
    console.log('No regressions detected - safe to deploy');
  }
  
  console.log('-'.repeat(50) + '\n');
}

/**
 * Main report generation function
 */
function generateReports() {
  console.log('Generating test reports...\n');
  
  ensureDirectories();
  
  // Run regression detection (generates REGRESSIONS.md, NEW-FEATURES.md, FAILURES.md)
  const { hasRegressions, summary, isFirstRun } = runDetection();
  
  if (!summary) {
    console.log('No test results to report.');
    return;
  }
  
  // Save to history
  saveToHistory();
  
  // Generate log file
  generateLogFile(summary);
  
  // Print console summary
  printConsoleSummary(summary, hasRegressions);
  
  if (isFirstRun) {
    console.log('Note: This was the first test run. Baseline created.');
    console.log('Future runs will compare against this baseline.\n');
  }
  
  // List generated files
  console.log('Reports Generated:');
  console.log('  - test-results/index.html');
  console.log('  - test-results/results.json');
  console.log('  - test-results/junit.xml');
  console.log('  - coverage/index.html');
  
  if (fs.existsSync(path.join(RESULTS_DIR, 'REGRESSIONS.md'))) {
    console.log('  - test-results/REGRESSIONS.md');
  }
  if (fs.existsSync(path.join(RESULTS_DIR, 'NEW-FEATURES.md'))) {
    console.log('  - test-results/NEW-FEATURES.md');
  }
  if (fs.existsSync(path.join(RESULTS_DIR, 'FAILURES.md'))) {
    console.log('  - test-results/FAILURES.md');
  }
  
  console.log('');
  
  // Exit with appropriate code
  process.exit(hasRegressions ? 1 : 0);
}

module.exports = { generateReports };

// Run if executed directly
if (require.main === module) {
  generateReports();
}
