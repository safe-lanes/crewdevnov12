// Regression Detection System
// Detects when previously passing tests now fail

const fs = require('fs');
const path = require('path');

const BASELINE_PATH = path.join(process.cwd(), 'test-results', 'baseline.json');
const RESULTS_PATH = path.join(process.cwd(), 'test-results', 'results.json');
const REGRESSIONS_PATH = path.join(process.cwd(), 'test-results', 'REGRESSIONS.md');
const NEW_FEATURES_PATH = path.join(process.cwd(), 'test-results', 'NEW-FEATURES.md');
const FAILURES_PATH = path.join(process.cwd(), 'test-results', 'FAILURES.md');

/**
 * Load baseline test results
 */
function loadBaseline() {
  if (fs.existsSync(BASELINE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    } catch (e) {
      console.warn('Warning: Could not parse baseline file');
      return null;
    }
  }
  return null;
}

/**
 * Load current test results
 */
function loadResults() {
  if (fs.existsSync(RESULTS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
    } catch (e) {
      console.warn('Warning: Could not parse results file');
      return null;
    }
  }
  return null;
}

/**
 * Extract test statuses from vitest results
 */
function extractTestStatuses(results) {
  if (!results || !results.testResults) return {};
  
  const statuses = {};
  
  results.testResults.forEach(file => {
    if (file.assertionResults) {
      file.assertionResults.forEach(test => {
        const testKey = `${file.name}::${test.ancestorTitles.join('::')}::${test.title}`;
        statuses[testKey] = {
          status: test.status,
          duration: test.duration,
          failureMessages: test.failureMessages || [],
        };
      });
    }
  });
  
  return statuses;
}

/**
 * Compare current results against baseline
 */
function detectRegressions(baseline, current) {
  const baselineStatuses = extractTestStatuses(baseline);
  const currentStatuses = extractTestStatuses(current);
  
  const regressions = [];
  const newTests = [];
  const stillPassing = [];
  const stillFailing = [];
  
  // Check each current test
  Object.entries(currentStatuses).forEach(([testKey, currentStatus]) => {
    const baselineStatus = baselineStatuses[testKey];
    
    if (!baselineStatus) {
      // New test - not in baseline
      newTests.push({
        testKey,
        status: currentStatus.status,
        failureMessages: currentStatus.failureMessages,
      });
    } else if (baselineStatus.status === 'passed' && currentStatus.status === 'failed') {
      // TRUE REGRESSION - was passing, now failing
      regressions.push({
        testKey,
        previousStatus: 'passed',
        currentStatus: 'failed',
        failureMessages: currentStatus.failureMessages,
      });
    } else if (currentStatus.status === 'passed') {
      stillPassing.push({ testKey });
    } else if (currentStatus.status === 'failed') {
      stillFailing.push({
        testKey,
        failureMessages: currentStatus.failureMessages,
      });
    }
  });
  
  return { regressions, newTests, stillPassing, stillFailing };
}

/**
 * Generate REGRESSIONS.md report
 */
function generateRegressionsReport(regressions) {
  if (regressions.length === 0) {
    // Remove file if no regressions
    if (fs.existsSync(REGRESSIONS_PATH)) {
      fs.unlinkSync(REGRESSIONS_PATH);
    }
    return;
  }
  
  let report = `# REGRESSIONS DETECTED\n\n`;
  report += `**Status: BLOCKS DEPLOYMENT**\n\n`;
  report += `The following tests were previously passing but are now failing:\n\n`;
  
  regressions.forEach((reg, index) => {
    report += `## ${index + 1}. ${reg.testKey}\n\n`;
    report += `- Previous Status: PASSED\n`;
    report += `- Current Status: FAILED\n\n`;
    if (reg.failureMessages.length > 0) {
      report += `**Failure Details:**\n\`\`\`\n${reg.failureMessages.join('\n')}\n\`\`\`\n\n`;
    }
  });
  
  report += `---\n\n`;
  report += `**Action Required:** Fix these regressions before deploying.\n`;
  
  fs.writeFileSync(REGRESSIONS_PATH, report);
}

/**
 * Generate NEW-FEATURES.md report
 */
function generateNewFeaturesReport(newTests) {
  if (newTests.length === 0) {
    if (fs.existsSync(NEW_FEATURES_PATH)) {
      fs.unlinkSync(NEW_FEATURES_PATH);
    }
    return;
  }
  
  let report = `# NEW FEATURE TESTS\n\n`;
  report += `**Status: Does NOT block deployment**\n\n`;
  report += `The following tests are new (not in baseline):\n\n`;
  
  const passing = newTests.filter(t => t.status === 'passed');
  const failing = newTests.filter(t => t.status === 'failed');
  
  if (passing.length > 0) {
    report += `## Passing New Tests (${passing.length})\n\n`;
    passing.forEach((test, index) => {
      report += `${index + 1}. ${test.testKey} - Status: PASSED\n`;
    });
    report += `\n`;
  }
  
  if (failing.length > 0) {
    report += `## Failing New Tests (${failing.length})\n\n`;
    failing.forEach((test, index) => {
      report += `${index + 1}. ${test.testKey} - Status: FAILED\n`;
      if (test.failureMessages.length > 0) {
        report += `   \`\`\`\n   ${test.failureMessages.join('\n   ')}\n   \`\`\`\n`;
      }
    });
    report += `\n`;
  }
  
  report += `---\n\n`;
  report += `**Note:** These are new tests for new features. They don't indicate regressions.\n`;
  
  fs.writeFileSync(NEW_FEATURES_PATH, report);
}

/**
 * Generate FAILURES.md report (all failures with action items)
 */
function generateFailuresReport(regressions, newTests, stillFailing) {
  const allFailures = [
    ...regressions.map(r => ({ ...r, type: 'regression' })),
    ...newTests.filter(t => t.status === 'failed').map(t => ({ ...t, type: 'new' })),
    ...stillFailing.map(f => ({ ...f, type: 'existing' })),
  ];
  
  if (allFailures.length === 0) {
    if (fs.existsSync(FAILURES_PATH)) {
      fs.unlinkSync(FAILURES_PATH);
    }
    return;
  }
  
  let report = `# ALL TEST FAILURES\n\n`;
  report += `Total Failures: ${allFailures.length}\n\n`;
  
  // Regressions first (most critical)
  const regs = allFailures.filter(f => f.type === 'regression');
  if (regs.length > 0) {
    report += `## REGRESSIONS (${regs.length}) - MUST FIX\n\n`;
    regs.forEach((f, i) => {
      report += `${i + 1}. ${f.testKey}\n`;
      report += `   - Action: Fix immediately - blocks deployment\n\n`;
    });
  }
  
  // New feature failures
  const news = allFailures.filter(f => f.type === 'new');
  if (news.length > 0) {
    report += `## NEW FEATURE FAILURES (${news.length}) - Optional Fix\n\n`;
    news.forEach((f, i) => {
      report += `${i + 1}. ${f.testKey}\n`;
      report += `   - Action: New feature not working - consider fixing\n\n`;
    });
  }
  
  // Existing failures
  const existing = allFailures.filter(f => f.type === 'existing');
  if (existing.length > 0) {
    report += `## EXISTING FAILURES (${existing.length}) - Known Issues\n\n`;
    existing.forEach((f, i) => {
      report += `${i + 1}. ${f.testKey}\n`;
      report += `   - Action: Pre-existing failure - was failing in baseline\n\n`;
    });
  }
  
  fs.writeFileSync(FAILURES_PATH, report);
}

/**
 * Update baseline with current results (only when all tests pass or on first run)
 */
function updateBaseline(results) {
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(results, null, 2));
  console.log('Baseline updated with current test results');
}

/**
 * Main detection function
 */
function runDetection(options = {}) {
  console.log('\nRunning regression detection...\n');
  
  const baseline = loadBaseline();
  const current = loadResults();
  
  if (!current) {
    console.log('No test results found. Run tests first.');
    return { hasRegressions: false, summary: null };
  }
  
  // First run - no baseline exists
  if (!baseline) {
    console.log('No baseline found. This is the first test run.');
    console.log('Creating baseline from current results...');
    updateBaseline(current);
    
    const currentStatuses = extractTestStatuses(current);
    const passing = Object.values(currentStatuses).filter(s => s.status === 'passed').length;
    const failing = Object.values(currentStatuses).filter(s => s.status === 'failed').length;
    
    return {
      hasRegressions: false,
      isFirstRun: true,
      summary: {
        passing,
        failing,
        regressions: 0,
        newTests: Object.keys(currentStatuses).length,
      },
    };
  }
  
  // Compare against baseline
  const { regressions, newTests, stillPassing, stillFailing } = detectRegressions(baseline, current);
  
  // Generate reports
  generateRegressionsReport(regressions);
  generateNewFeaturesReport(newTests);
  generateFailuresReport(regressions, newTests, stillFailing);
  
  // Console output
  console.log('Regression Analysis:');
  console.log(`  Regressions: ${regressions.length} ${regressions.length > 0 ? '(BLOCKS DEPLOYMENT)' : ''}`);
  console.log(`  New Tests: ${newTests.length} (informational)`);
  console.log(`  Still Passing: ${stillPassing.length}`);
  console.log(`  Still Failing: ${stillFailing.length}`);
  console.log('');
  
  // Update baseline only if all passing
  const allPassing = regressions.length === 0 && stillFailing.length === 0;
  if (allPassing && options.updateBaseline !== false) {
    updateBaseline(current);
  }
  
  return {
    hasRegressions: regressions.length > 0,
    summary: {
      regressions: regressions.length,
      newTests: newTests.length,
      passing: stillPassing.length,
      failing: stillFailing.length,
    },
  };
}

module.exports = {
  runDetection,
  loadBaseline,
  loadResults,
  detectRegressions,
  updateBaseline,
};

// Run if executed directly
if (require.main === module) {
  const result = runDetection();
  process.exit(result.hasRegressions ? 1 : 0);
}
