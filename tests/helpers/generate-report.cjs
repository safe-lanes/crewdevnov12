// Enhanced Test Report Generator
// Creates professional, interactive HTML reports

const fs = require('fs');
const path = require('path');
const { runDetection } = require('./regression-detector.cjs');

const RESULTS_DIR = path.join(process.cwd(), 'test-results');
const HISTORY_DIR = path.join(RESULTS_DIR, 'history');
const LOGS_DIR = path.join(process.cwd(), 'test-logs');
const COVERAGE_DIR = path.join(process.cwd(), 'coverage');

// Enhanced duration calculation - tries multiple sources
function calculateTotalDuration(testResults) {
  if (!testResults || !testResults.testResults) return 0;
  
  let totalMs = 0;
  
  testResults.testResults.forEach(file => {
    // Try file-level timing first
    if (file.endTime && file.startTime) {
      totalMs += (file.endTime - file.startTime);
    } else if (file.perfStats && file.perfStats.runtime) {
      totalMs += file.perfStats.runtime;
    } else {
      // Fallback: sum individual test durations
      if (file.assertionResults) {
        file.assertionResults.forEach(test => {
          totalMs += (test.duration || 0);
        });
      }
    }
  });
  
  return totalMs;
}

// Parse coverage data
function parseCoverage() {
  const coveragePath = path.join(COVERAGE_DIR, 'coverage-summary.json');
  if (!fs.existsSync(coveragePath)) return null;
  
  try {
    const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    return coverage;
  } catch (e) {
    return null;
  }
}

function ensureDirectories() {
  [RESULTS_DIR, HISTORY_DIR, LOGS_DIR, COVERAGE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function getDateString() {
  return new Date().toISOString().split('T')[0];
}

function saveToHistory() {
  const resultsPath = path.join(RESULTS_DIR, 'results.json');
  if (fs.existsSync(resultsPath)) {
    const historyPath = path.join(HISTORY_DIR, `${getDateString()}.json`);
    fs.copyFileSync(resultsPath, historyPath);
    const files = fs.readdirSync(HISTORY_DIR).sort();
    while (files.length > 30) {
      fs.unlinkSync(path.join(HISTORY_DIR, files.shift()));
    }
  }
}

function parseTestResults() {
  const resultsPath = path.join(RESULTS_DIR, 'results.json');
  if (!fs.existsSync(resultsPath)) return null;
  
  try {
    const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    return data;
  } catch (e) {
    console.error('Error parsing results.json:', e);
    return null;
  }
}

// Parse Playwright E2E results
function parsePlaywrightResults() {
  const playwrightPath = path.join(RESULTS_DIR, 'playwright-results.json');
  if (!fs.existsSync(playwrightPath)) return null;
  
  try {
    const data = JSON.parse(fs.readFileSync(playwrightPath, 'utf8'));
    return data;
  } catch (e) {
    console.error('Error parsing playwright-results.json:', e);
    return null;
  }
}

// Convert Playwright results to match Vitest format for unified display
function normalizePlaywrightResults(playwrightData) {
  if (!playwrightData || !playwrightData.suites) return { tests: [], passed: 0, failed: 0, total: 0, duration: 0 };
  
  const results = { tests: [], passed: 0, failed: 0, total: 0, duration: 0 };
  
  function extractTests(suites, parentName = '') {
    for (const suite of suites) {
      const suiteName = parentName ? `${parentName} > ${suite.title}` : suite.title;
      
      // Extract specs (tests)
      if (suite.specs) {
        for (const spec of suite.specs) {
          const test = {
            name: spec.title,
            fullName: `${suiteName} > ${spec.title}`,
            suite: suite.title || 'E2E Tests',
            status: spec.ok ? 'passed' : 'failed',
            duration: spec.tests?.[0]?.results?.[0]?.duration || 0,
            failureMessages: []
          };
          
          // Extract failure messages
          if (!spec.ok && spec.tests) {
            for (const t of spec.tests) {
              if (t.results) {
                for (const r of t.results) {
                  if (r.error && r.error.message) {
                    test.failureMessages.push(r.error.message);
                  }
                }
              }
            }
          }
          
          results.tests.push(test);
          results.total++;
          if (test.status === 'passed') results.passed++;
          else results.failed++;
          results.duration += test.duration;
        }
      }
      
      // Recurse into nested suites
      if (suite.suites) {
        extractTests(suite.suites, suiteName);
      }
    }
  }
  
  extractTests(playwrightData.suites);
  return results;
}

function loadBaseline() {
  const baselinePath = path.join(RESULTS_DIR, 'baseline.json');
  if (!fs.existsSync(baselinePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function loadPreviousRun() {
  const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json')).sort();
  if (files.length < 2) return null;
  const previousFile = files[files.length - 2];
  try {
    return JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, previousFile), 'utf8'));
  } catch (e) {
    return null;
  }
}

function buildTestTree(testResults, playwrightResults = null) {
  const tree = { unit: {}, integration: {}, e2e: {} };
  
  // Process Vitest results
  if (testResults && testResults.testResults) {
    testResults.testResults.forEach(file => {
      const filePath = file.name || '';
      let category = 'unit';
      if (filePath.includes('/integration/')) category = 'integration';
      else if (filePath.includes('/e2e/')) category = 'e2e';
      
      const fileName = path.basename(filePath, '.test.ts').replace('.spec', '');
      const suiteName = fileName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      
      if (!tree[category][suiteName]) {
        tree[category][suiteName] = { tests: [], passed: 0, failed: 0, duration: 0 };
      }
      
      if (file.assertionResults) {
        file.assertionResults.forEach(test => {
          const testData = {
            name: test.title || test.fullName || 'Unknown Test',
            fullName: test.fullName || test.title || '',
            status: test.status === 'passed' ? 'passed' : 'failed',
            duration: test.duration || 0,
            failureMessages: test.failureMessages || [],
            ancestorTitles: test.ancestorTitles || []
          };
          tree[category][suiteName].tests.push(testData);
          tree[category][suiteName].duration += testData.duration;
          if (testData.status === 'passed') {
            tree[category][suiteName].passed++;
          } else {
            tree[category][suiteName].failed++;
          }
        });
      }
    });
  }
  
  // Process Playwright E2E results
  if (playwrightResults && playwrightResults.tests) {
    // Group by suite name
    const suiteMap = {};
    playwrightResults.tests.forEach(test => {
      const suiteName = test.suite || 'E2E Tests';
      if (!suiteMap[suiteName]) {
        suiteMap[suiteName] = { tests: [], passed: 0, failed: 0, duration: 0 };
      }
      suiteMap[suiteName].tests.push(test);
      suiteMap[suiteName].duration += test.duration || 0;
      if (test.status === 'passed') {
        suiteMap[suiteName].passed++;
      } else {
        suiteMap[suiteName].failed++;
      }
    });
    
    // Merge into e2e category
    Object.entries(suiteMap).forEach(([name, data]) => {
      tree.e2e[name] = data;
    });
  }
  
  return tree;
}

function generateEnhancedHTML(testResults, regressionData, baseline, previousRun) {
  // Parse Playwright E2E results
  const playwrightRaw = parsePlaywrightResults();
  const playwrightResults = normalizePlaywrightResults(playwrightRaw);
  
  // Build tree with both Vitest and Playwright results
  const tree = buildTestTree(testResults, playwrightResults);
  
  // Calculate totals including E2E
  const vitestTotal = testResults?.numTotalTests || 0;
  const vitestPassed = testResults?.numPassedTests || 0;
  const vitestFailed = testResults?.numFailedTests || 0;
  
  const totalTests = vitestTotal + playwrightResults.total;
  const passedTests = vitestPassed + playwrightResults.passed;
  const failedTests = vitestFailed + playwrightResults.failed;
  const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
  
  // Use enhanced duration calculation (Vitest + Playwright)
  const vitestDuration = calculateTotalDuration(testResults);
  const totalDuration = vitestDuration + playwrightResults.duration;
  
  // Load coverage data
  const coverage = parseCoverage();
  
  const unitTests = Object.values(tree.unit).reduce((acc, s) => acc + s.tests.length, 0);
  const integrationTests = Object.values(tree.integration).reduce((acc, s) => acc + s.tests.length, 0);
  const e2eTests = Object.values(tree.e2e).reduce((acc, s) => acc + s.tests.length, 0);
  
  const regressions = regressionData?.regressions || [];
  const newTests = regressionData?.newTests || [];
  
  const prevComparison = previousRun ? {
    prevTotal: previousRun.numTotalTests || 0,
    prevPassed: previousRun.numPassedTests || 0,
    prevFailed: previousRun.numFailedTests || 0
  } : null;

  const treeDataJson = JSON.stringify(tree).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const regressionsJson = JSON.stringify(regressions).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const newTestsJson = JSON.stringify(newTests).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report - ${totalTests} Tests | ${passRate}% Pass Rate</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    .fade-in { animation: fadeIn 0.3s ease-out; }
    .test-item:hover { background: rgba(59, 130, 246, 0.1); }
    .collapse-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; }
    .collapse-content.open { max-height: 5000px; }
    .dark { --bg-primary: #0f172a; --bg-secondary: #1e293b; --bg-tertiary: #334155; --text-primary: #f1f5f9; --text-secondary: #94a3b8; --border-color: #475569; }
    .light { --bg-primary: #ffffff; --bg-secondary: #f8fafc; --bg-tertiary: #e2e8f0; --text-primary: #1e293b; --text-secondary: #64748b; --border-color: #e2e8f0; }
    body { background: var(--bg-primary); color: var(--text-primary); transition: all 0.3s; }
    .card { background: var(--bg-secondary); border: 1px solid var(--border-color); }
    .search-input { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); }
    .progress-ring { transform: rotate(-90deg); }
    .suite-header { cursor: pointer; transition: background 0.2s; }
    .suite-header:hover { background: var(--bg-tertiary); }
    .chevron { transition: transform 0.2s; }
    .chevron.open { transform: rotate(90deg); }
    @media (max-width: 768px) { .stats-grid { grid-template-columns: repeat(2, 1fr) !important; } }
  </style>
</head>
<body class="min-h-screen light">
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Header -->
    <header class="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-bold flex items-center gap-3">
          <span class="text-4xl">${failedTests === 0 ? '&#9989;' : '&#10060;'}</span>
          Test Report
        </h1>
        <p class="text-sm mt-1" style="color: var(--text-secondary)">Generated: ${new Date().toLocaleString()}</p>
      </div>
      <div class="flex items-center gap-3">
        <button onclick="toggleDarkMode()" class="p-2 rounded-lg card hover:opacity-80" title="Toggle Dark Mode">
          <span id="theme-icon">&#127769;</span>
        </button>
        <button onclick="exportReport()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <span>&#128190;</span> Export
        </button>
      </div>
    </header>

    <!-- Dashboard Cards -->
    <div class="stats-grid grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
      <div class="card rounded-xl p-4 text-center fade-in">
        <div class="text-3xl font-bold text-blue-500">${totalTests}</div>
        <div class="text-sm" style="color: var(--text-secondary)">Total Tests</div>
      </div>
      <div class="card rounded-xl p-4 text-center fade-in">
        <div class="text-3xl font-bold text-green-500">${passedTests}</div>
        <div class="text-sm" style="color: var(--text-secondary)">Passed</div>
      </div>
      <div class="card rounded-xl p-4 text-center fade-in">
        <div class="text-3xl font-bold text-red-500">${failedTests}</div>
        <div class="text-sm" style="color: var(--text-secondary)">Failed</div>
      </div>
      <div class="card rounded-xl p-4 text-center fade-in">
        <div class="text-3xl font-bold ${passRate >= 90 ? 'text-green-500' : passRate >= 70 ? 'text-yellow-500' : 'text-red-500'}">${passRate}%</div>
        <div class="text-sm" style="color: var(--text-secondary)">Pass Rate</div>
      </div>
      <div class="card rounded-xl p-4 text-center fade-in">
        <div class="text-3xl font-bold text-purple-500">${(totalDuration / 1000).toFixed(2)}s</div>
        <div class="text-sm" style="color: var(--text-secondary)">Duration</div>
      </div>
      <div class="card rounded-xl p-4 text-center fade-in">
        <div class="text-3xl font-bold ${regressions.length > 0 ? 'text-red-500' : 'text-green-500'}">${regressions.length}</div>
        <div class="text-sm" style="color: var(--text-secondary)">Regressions</div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <div class="card rounded-xl p-6">
        <h3 class="font-semibold mb-4">Test Results</h3>
        <div class="h-48"><canvas id="resultsChart"></canvas></div>
      </div>
      <div class="card rounded-xl p-6">
        <h3 class="font-semibold mb-4">Test Categories</h3>
        <div class="h-48"><canvas id="categoriesChart"></canvas></div>
      </div>
      <div class="card rounded-xl p-6">
        <h3 class="font-semibold mb-4">Comparison with Previous</h3>
        <div class="space-y-3 pt-4">
          ${prevComparison ? `
          <div class="flex justify-between items-center">
            <span>Tests</span>
            <span class="font-mono">${prevComparison.prevTotal} → ${totalTests} ${totalTests > prevComparison.prevTotal ? '<span class="text-green-500">+' + (totalTests - prevComparison.prevTotal) + '</span>' : totalTests < prevComparison.prevTotal ? '<span class="text-red-500">' + (totalTests - prevComparison.prevTotal) + '</span>' : '<span class="text-gray-500">=</span>'}</span>
          </div>
          <div class="flex justify-between items-center">
            <span>Passed</span>
            <span class="font-mono">${prevComparison.prevPassed} → ${passedTests} ${passedTests > prevComparison.prevPassed ? '<span class="text-green-500">+' + (passedTests - prevComparison.prevPassed) + '</span>' : passedTests < prevComparison.prevPassed ? '<span class="text-red-500">' + (passedTests - prevComparison.prevPassed) + '</span>' : '<span class="text-gray-500">=</span>'}</span>
          </div>
          <div class="flex justify-between items-center">
            <span>Failed</span>
            <span class="font-mono">${prevComparison.prevFailed} → ${failedTests} ${failedTests < prevComparison.prevFailed ? '<span class="text-green-500">' + (failedTests - prevComparison.prevFailed) + '</span>' : failedTests > prevComparison.prevFailed ? '<span class="text-red-500">+' + (failedTests - prevComparison.prevFailed) + '</span>' : '<span class="text-gray-500">=</span>'}</span>
          </div>
          ` : '<div class="text-center py-8" style="color: var(--text-secondary)">No previous run to compare</div>'}
        </div>
      </div>
    </div>

    ${regressions.length > 0 ? `
    <!-- Regressions Section -->
    <div class="card rounded-xl p-6 mb-8 border-l-4 border-red-500">
      <h2 class="text-xl font-bold text-red-500 flex items-center gap-2 mb-4">
        <span>&#9888;&#65039;</span> REGRESSIONS DETECTED (${regressions.length})
      </h2>
      <p class="mb-4" style="color: var(--text-secondary)">These tests were previously passing but are now failing. Deployment is blocked until fixed.</p>
      <div class="space-y-3">
        ${regressions.map(r => `
        <div class="p-4 rounded-lg" style="background: rgba(239, 68, 68, 0.1)">
          <div class="font-medium text-red-400">${r.name || r}</div>
          <div class="text-sm mt-1" style="color: var(--text-secondary)">Impact: HIGH - Previously working functionality broken</div>
        </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${newTests.length > 0 ? `
    <!-- New Tests Section -->
    <div class="card rounded-xl p-6 mb-8 border-l-4 border-blue-500">
      <h2 class="text-xl font-bold text-blue-500 flex items-center gap-2 mb-4">
        <span>&#127381;</span> NEW TESTS DETECTED (${newTests.length})
      </h2>
      <p class="mb-4" style="color: var(--text-secondary)">These are new tests not in the baseline. They do not block deployment.</p>
      <div class="space-y-2">
        ${newTests.slice(0, 10).map(t => `
        <div class="p-3 rounded-lg" style="background: rgba(59, 130, 246, 0.1)">
          <span class="text-green-500 mr-2">&#10003;</span> ${t.name || t}
        </div>
        `).join('')}
        ${newTests.length > 10 ? `<div class="text-sm" style="color: var(--text-secondary)">...and ${newTests.length - 10} more</div>` : ''}
      </div>
    </div>
    ` : ''}

    <!-- Search and Filter -->
    <div class="card rounded-xl p-4 mb-6">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="flex-1 min-w-[200px]">
          <input type="text" id="searchInput" placeholder="&#128269; Search tests..." 
            class="w-full px-4 py-2 rounded-lg search-input" onkeyup="filterTests()">
        </div>
        <select id="statusFilter" class="px-4 py-2 rounded-lg search-input" onchange="filterTests()">
          <option value="all">All Status</option>
          <option value="passed">Passed Only</option>
          <option value="failed">Failed Only</option>
        </select>
        <select id="categoryFilter" class="px-4 py-2 rounded-lg search-input" onchange="filterTests()">
          <option value="all">All Categories</option>
          <option value="unit">Unit Tests</option>
          <option value="integration">Integration Tests</option>
          <option value="e2e">E2E Tests</option>
        </select>
        <button onclick="expandAll()" class="px-3 py-2 rounded-lg card hover:opacity-80">Expand All</button>
        <button onclick="collapseAll()" class="px-3 py-2 rounded-lg card hover:opacity-80">Collapse All</button>
      </div>
    </div>

    <!-- Test Tree -->
    <div class="card rounded-xl p-6" id="testTree">
      <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
        <span>&#128193;</span> Test Explorer
      </h2>
      
      <!-- Unit Tests -->
      <div class="test-category mb-4" data-category="unit">
        <div class="suite-header flex items-center gap-2 p-3 rounded-lg" onclick="toggleCategory('unit')">
          <span class="chevron" id="chevron-unit">&#9654;</span>
          <span class="text-lg">&#128193; Unit Tests</span>
          <span class="ml-auto text-sm px-2 py-1 rounded bg-blue-500/20 text-blue-400">${unitTests} tests</span>
        </div>
        <div class="collapse-content ml-4" id="content-unit">
          ${Object.entries(tree.unit).map(([suite, data]) => `
          <div class="test-suite my-2" data-suite="${suite.toLowerCase()}">
            <div class="suite-header flex items-center gap-2 p-2 rounded-lg" onclick="toggleSuite('unit-${suite.replace(/\s+/g, '-')}')">
              <span class="chevron" id="chevron-unit-${suite.replace(/\s+/g, '-')}">&#9654;</span>
              <span>${data.failed === 0 ? '&#9989;' : '&#10060;'}</span>
              <span>${suite}</span>
              <span class="ml-auto text-xs px-2 py-0.5 rounded ${data.failed === 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${data.passed}/${data.tests.length}</span>
            </div>
            <div class="collapse-content ml-6" id="content-unit-${suite.replace(/\s+/g, '-')}">
              ${data.tests.map(t => `
              <div class="test-item p-2 rounded flex items-center gap-2 my-1 cursor-pointer" data-status="${t.status}" data-name="${t.name.toLowerCase()}" onclick='showTestDetails(${JSON.stringify(t).replace(/'/g, "&apos;")})'>
                <span class="${t.status === 'passed' ? 'text-green-500' : 'text-red-500'}">${t.status === 'passed' ? '&#10003;' : '&#10007;'}</span>
                <span class="flex-1">${t.name}</span>
                <span class="text-xs" style="color: var(--text-secondary)">${t.duration}ms</span>
              </div>
              `).join('')}
            </div>
          </div>
          `).join('')}
        </div>
      </div>

      <!-- Integration Tests -->
      <div class="test-category mb-4" data-category="integration">
        <div class="suite-header flex items-center gap-2 p-3 rounded-lg" onclick="toggleCategory('integration')">
          <span class="chevron" id="chevron-integration">&#9654;</span>
          <span class="text-lg">&#128193; Integration Tests</span>
          <span class="ml-auto text-sm px-2 py-1 rounded bg-green-500/20 text-green-400">${integrationTests} tests</span>
        </div>
        <div class="collapse-content ml-4" id="content-integration">
          ${Object.entries(tree.integration).map(([suite, data]) => `
          <div class="test-suite my-2" data-suite="${suite.toLowerCase()}">
            <div class="suite-header flex items-center gap-2 p-2 rounded-lg" onclick="toggleSuite('integration-${suite.replace(/\s+/g, '-')}')">
              <span class="chevron" id="chevron-integration-${suite.replace(/\s+/g, '-')}">&#9654;</span>
              <span>${data.failed === 0 ? '&#9989;' : '&#10060;'}</span>
              <span>${suite}</span>
              <span class="ml-auto text-xs px-2 py-0.5 rounded ${data.failed === 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${data.passed}/${data.tests.length}</span>
            </div>
            <div class="collapse-content ml-6" id="content-integration-${suite.replace(/\s+/g, '-')}">
              ${data.tests.map(t => `
              <div class="test-item p-2 rounded flex items-center gap-2 my-1 cursor-pointer" data-status="${t.status}" data-name="${t.name.toLowerCase()}" onclick='showTestDetails(${JSON.stringify(t).replace(/'/g, "&apos;")})'>
                <span class="${t.status === 'passed' ? 'text-green-500' : 'text-red-500'}">${t.status === 'passed' ? '&#10003;' : '&#10007;'}</span>
                <span class="flex-1">${t.name}</span>
                <span class="text-xs" style="color: var(--text-secondary)">${t.duration}ms</span>
              </div>
              `).join('')}
            </div>
          </div>
          `).join('')}
        </div>
      </div>

      <!-- E2E Tests -->
      <div class="test-category mb-4" data-category="e2e">
        <div class="suite-header flex items-center gap-2 p-3 rounded-lg" onclick="toggleCategory('e2e')">
          <span class="chevron" id="chevron-e2e">&#9654;</span>
          <span class="text-lg">&#128193; E2E Tests</span>
          <span class="ml-auto text-sm px-2 py-1 rounded bg-purple-500/20 text-purple-400">${e2eTests} tests</span>
        </div>
        <div class="collapse-content ml-4" id="content-e2e">
          ${Object.entries(tree.e2e).length === 0 ? '<div class="p-4 text-center" style="color: var(--text-secondary)">No E2E tests run (requires browser)</div>' : 
          Object.entries(tree.e2e).map(([suite, data]) => `
          <div class="test-suite my-2" data-suite="${suite.toLowerCase()}">
            <div class="suite-header flex items-center gap-2 p-2 rounded-lg" onclick="toggleSuite('e2e-${suite.replace(/\s+/g, '-')}')">
              <span class="chevron" id="chevron-e2e-${suite.replace(/\s+/g, '-')}">&#9654;</span>
              <span>${data.failed === 0 ? '&#9989;' : '&#10060;'}</span>
              <span>${suite}</span>
              <span class="ml-auto text-xs px-2 py-0.5 rounded ${data.failed === 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${data.passed}/${data.tests.length}</span>
            </div>
            <div class="collapse-content ml-6" id="content-e2e-${suite.replace(/\s+/g, '-')}">
              ${data.tests.map(t => `
              <div class="test-item p-2 rounded flex items-center gap-2 my-1 cursor-pointer" data-status="${t.status}" data-name="${t.name.toLowerCase()}" onclick='showTestDetails(${JSON.stringify(t).replace(/'/g, "&apos;")})'>
                <span class="${t.status === 'passed' ? 'text-green-500' : 'text-red-500'}">${t.status === 'passed' ? '&#10003;' : '&#10007;'}</span>
                <span class="flex-1">${t.name}</span>
                <span class="text-xs" style="color: var(--text-secondary)">${t.duration}ms</span>
              </div>
              `).join('')}
            </div>
          </div>
          `).join('')}
        </div>
      </div>
    </div>
    
    <!-- Coverage Section -->
    ${coverage && coverage.total ? `
    <div class="card rounded-xl p-6 mt-6">
      <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
        <span>&#128202;</span> Code Coverage
      </h2>
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div class="text-center">
          <div class="text-3xl font-bold text-blue-500">${coverage.total.lines?.pct?.toFixed(1) || 0}%</div>
          <div class="text-sm" style="color: var(--text-secondary)">Lines</div>
          <div class="text-xs" style="color: var(--text-secondary)">${coverage.total.lines?.covered || 0}/${coverage.total.lines?.total || 0}</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-green-500">${coverage.total.statements?.pct?.toFixed(1) || 0}%</div>
          <div class="text-sm" style="color: var(--text-secondary)">Statements</div>
          <div class="text-xs" style="color: var(--text-secondary)">${coverage.total.statements?.covered || 0}/${coverage.total.statements?.total || 0}</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-purple-500">${coverage.total.functions?.pct?.toFixed(1) || 0}%</div>
          <div class="text-sm" style="color: var(--text-secondary)">Functions</div>
          <div class="text-xs" style="color: var(--text-secondary)">${coverage.total.functions?.covered || 0}/${coverage.total.functions?.total || 0}</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-orange-500">${coverage.total.branches?.pct?.toFixed(1) || 0}%</div>
          <div class="text-sm" style="color: var(--text-secondary)">Branches</div>
          <div class="text-xs" style="color: var(--text-secondary)">${coverage.total.branches?.covered || 0}/${coverage.total.branches?.total || 0}</div>
        </div>
      </div>
      <div class="text-center">
        <a href="../coverage/index.html" target="_blank" class="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">View Detailed Coverage Report</a>
      </div>
    </div>
    ` : `
    <div class="card rounded-xl p-6 mt-6">
      <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
        <span>&#128202;</span> Code Coverage
      </h2>
      <div class="text-center py-4" style="color: var(--text-secondary)">
        No coverage data available. Run: <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">npm run test:coverage</code>
      </div>
    </div>
    `}

    <!-- Performance Section -->
    <div class="card rounded-xl p-6 mt-6">
      <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
        <span>&#9889;</span> Performance Metrics
      </h2>
      <div class="grid md:grid-cols-2 gap-6">
        <div>
          <h3 class="font-semibold mb-3">Slowest Tests</h3>
          <div id="slowestTests" class="space-y-2"></div>
        </div>
        <div>
          <h3 class="font-semibold mb-3">Duration by Suite</h3>
          <div class="h-48"><canvas id="durationChart"></canvas></div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="text-center py-8 mt-8" style="color: var(--text-secondary)">
      <p>Seafarer Performance Management System - Test Report</p>
      <p class="text-sm mt-1">Generated by Enhanced Test Reporter v2.0</p>
    </footer>
  </div>

  <script>
    const treeData = ${treeDataJson};
    const regressions = ${regressionsJson};
    const newTestsList = ${newTestsJson};

    // Dark mode toggle
    function toggleDarkMode() {
      document.body.classList.toggle('dark');
      document.body.classList.toggle('light');
      const icon = document.getElementById('theme-icon');
      icon.textContent = document.body.classList.contains('dark') ? '\\u2600\\uFE0F' : '\\uD83C\\uDF19';
      localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    }

    // Load saved theme
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.remove('light');
      document.body.classList.add('dark');
      document.getElementById('theme-icon').textContent = '\\u2600\\uFE0F';
    }

    // Toggle category
    function toggleCategory(category) {
      const content = document.getElementById('content-' + category);
      const chevron = document.getElementById('chevron-' + category);
      content.classList.toggle('open');
      chevron.classList.toggle('open');
    }

    // Toggle suite
    function toggleSuite(suiteId) {
      const content = document.getElementById('content-' + suiteId);
      const chevron = document.getElementById('chevron-' + suiteId);
      if (content) {
        content.classList.toggle('open');
        chevron.classList.toggle('open');
      }
    }

    // Expand/collapse all
    function expandAll() {
      document.querySelectorAll('.collapse-content').forEach(el => el.classList.add('open'));
      document.querySelectorAll('.chevron').forEach(el => el.classList.add('open'));
    }
    function collapseAll() {
      document.querySelectorAll('.collapse-content').forEach(el => el.classList.remove('open'));
      document.querySelectorAll('.chevron').forEach(el => el.classList.remove('open'));
    }

    // Filter tests
    function filterTests() {
      const search = document.getElementById('searchInput').value.toLowerCase();
      const status = document.getElementById('statusFilter').value;
      const category = document.getElementById('categoryFilter').value;

      document.querySelectorAll('.test-category').forEach(cat => {
        const catType = cat.dataset.category;
        if (category !== 'all' && catType !== category) {
          cat.style.display = 'none';
        } else {
          cat.style.display = 'block';
        }
      });

      document.querySelectorAll('.test-item').forEach(item => {
        const name = item.dataset.name;
        const itemStatus = item.dataset.status;
        const matchesSearch = !search || name.includes(search);
        const matchesStatus = status === 'all' || itemStatus === status;
        item.style.display = matchesSearch && matchesStatus ? 'flex' : 'none';
      });
    }

    // Show test details modal
    function showTestDetails(testInfo) {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
      
      const failureHtml = testInfo.failureMessages && testInfo.failureMessages.length > 0 
        ? '<div><label class="font-semibold block mb-1 text-red-500">Error Details:</label><pre class="text-xs bg-red-50 dark:bg-red-900/20 p-4 rounded overflow-auto max-h-64 border border-red-200 dark:border-red-800">' + testInfo.failureMessages.join('\\n\\n') + '</pre></div>' 
        : '';
      
      modal.innerHTML = 
        '<div class="card rounded-xl p-6 max-w-3xl max-h-[90vh] overflow-auto" onclick="event.stopPropagation()">' +
          '<div class="flex items-center justify-between mb-4">' +
            '<h3 class="text-xl font-bold">Test Details</h3>' +
            '<button onclick="this.closest(\\'.fixed\\').remove()" class="px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">X</button>' +
          '</div>' +
          '<div class="space-y-4">' +
            '<div><label class="font-semibold block mb-1">Test Name:</label><p class="text-sm" style="color: var(--text-secondary)">' + testInfo.name + '</p></div>' +
            '<div><label class="font-semibold block mb-1">Full Name:</label><p class="text-sm" style="color: var(--text-secondary)">' + (testInfo.fullName || testInfo.name) + '</p></div>' +
            '<div class="grid grid-cols-2 gap-4">' +
              '<div><label class="font-semibold block mb-1">Status:</label><span class="inline-block px-3 py-1 rounded text-sm ' + (testInfo.status === 'passed' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500') + '">' + testInfo.status.toUpperCase() + '</span></div>' +
              '<div><label class="font-semibold block mb-1">Duration:</label><p class="text-sm font-mono" style="color: var(--text-secondary)">' + testInfo.duration + 'ms</p></div>' +
            '</div>' +
            failureHtml +
            '<div class="flex gap-2 pt-4 border-t" style="border-color: var(--border-color)">' +
              '<button onclick="navigator.clipboard.writeText(\\'' + (testInfo.fullName || testInfo.name).replace(/'/g, "\\\\'") + '\\'); alert(\\'Copied!\\');" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Copy Test Name</button>' +
              '<button onclick="this.closest(\\'.fixed\\').remove()" class="px-4 py-2 card rounded hover:opacity-80">Close</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      
      document.body.appendChild(modal);
    }

    // Export report with multiple options
    function exportReport() {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
      
      modal.innerHTML = 
        '<div class="card rounded-xl p-6 max-w-md" onclick="event.stopPropagation()">' +
          '<h3 class="text-xl font-bold mb-4">Export Report</h3>' +
          '<div class="space-y-2">' +
            '<button onclick="window.print(); this.closest(\\'.fixed\\').remove();" class="w-full px-4 py-3 text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"><span>&#128424;</span> <span>Print Report</span></button>' +
            '<button onclick="copyReportLink(); this.closest(\\'.fixed\\').remove();" class="w-full px-4 py-3 text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"><span>&#128279;</span> <span>Copy Report Link</span></button>' +
            '<button onclick="downloadHTML(); this.closest(\\'.fixed\\').remove();" class="w-full px-4 py-3 text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"><span>&#128190;</span> <span>Download HTML</span></button>' +
            '<button onclick="downloadJSON(); this.closest(\\'.fixed\\').remove();" class="w-full px-4 py-3 text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"><span>&#128196;</span> <span>Download JSON</span></button>' +
            '<button onclick="copyResults(); this.closest(\\'.fixed\\').remove();" class="w-full px-4 py-3 text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"><span>&#128203;</span> <span>Copy Summary</span></button>' +
          '</div>' +
          '<button onclick="this.closest(\\'.fixed\\').remove()" class="w-full mt-4 px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>' +
        '</div>';
      
      document.body.appendChild(modal);
    }

    function copyReportLink() {
      navigator.clipboard.writeText(window.location.href).then(() => alert('Report link copied!'));
    }

    function downloadHTML() {
      const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'test-report-' + new Date().toISOString().split('T')[0] + '.html';
      a.click();
      URL.revokeObjectURL(url);
    }

    function downloadJSON() {
      const data = { totalTests: ${totalTests}, passed: ${passedTests}, failed: ${failedTests}, passRate: ${passRate}, regressions: regressions.length, treeData: treeData, timestamp: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'test-report-' + new Date().toISOString().split('T')[0] + '.json';
      a.click();
      URL.revokeObjectURL(url);
    }

    function copyResults() {
      const summary = 'Test Results Summary\\nTotal: ${totalTests}\\nPassed: ${passedTests}\\nFailed: ${failedTests}\\nPass Rate: ${passRate}%\\nRegressions: ' + regressions.length;
      navigator.clipboard.writeText(summary).then(() => alert('Summary copied!'));
    }

    // Initialize charts
    document.addEventListener('DOMContentLoaded', function() {
      // Results pie chart
      new Chart(document.getElementById('resultsChart'), {
        type: 'doughnut',
        data: {
          labels: ['Passed', 'Failed'],
          datasets: [{ data: [${passedTests}, ${failedTests}], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });

      // Categories bar chart
      new Chart(document.getElementById('categoriesChart'), {
        type: 'bar',
        data: {
          labels: ['Unit', 'Integration', 'E2E'],
          datasets: [{ data: [${unitTests}, ${integrationTests}, ${e2eTests}], backgroundColor: ['#3b82f6', '#22c55e', '#a855f7'], borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });

      // Duration chart
      const suites = [];
      const durations = [];
      Object.entries(treeData.unit).forEach(([name, data]) => { suites.push(name); durations.push(data.duration); });
      Object.entries(treeData.integration).forEach(([name, data]) => { suites.push(name); durations.push(data.duration); });
      Object.entries(treeData.e2e).forEach(([name, data]) => { suites.push('E2E: ' + name); durations.push(data.duration); });
      
      new Chart(document.getElementById('durationChart'), {
        type: 'bar',
        data: {
          labels: suites.slice(0, 8),
          datasets: [{ data: durations.slice(0, 8), backgroundColor: '#8b5cf6', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });

      // Slowest tests
      const allTests = [];
      Object.values(treeData).forEach(category => {
        Object.values(category).forEach(suite => {
          suite.tests.forEach(t => allTests.push(t));
        });
      });
      allTests.sort((a, b) => b.duration - a.duration);
      const slowestContainer = document.getElementById('slowestTests');
      allTests.slice(0, 5).forEach((t, i) => {
        slowestContainer.innerHTML += '<div class="flex items-center gap-2 p-2 rounded" style="background: var(--bg-tertiary)"><span class="text-xs px-2 py-0.5 rounded bg-purple-500/20">#' + (i+1) + '</span><span class="flex-1 truncate">' + t.name + '</span><span class="text-purple-400 font-mono">' + t.duration + 'ms</span></div>';
      });
    });
  </script>
</body>
</html>`;
}

function generateLogFile(summary) {
  const timestamp = getTimestamp();
  const logPath = path.join(LOGS_DIR, `test-run-${timestamp}.log`);
  
  let log = `Test Run Log - ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`;
  log += `SUMMARY\n${'-'.repeat(40)}\n`;
  log += `Total Tests: ${(summary.passing || 0) + (summary.failing || 0)}\n`;
  log += `Passing: ${summary.passing || 0}\nFailing: ${summary.failing || 0}\n`;
  log += `Regressions: ${summary.regressions || 0}\nNew Tests: ${summary.newTests || 0}\n\n`;
  
  fs.writeFileSync(logPath, log);
  
  const files = fs.readdirSync(LOGS_DIR).filter(f => f.startsWith('test-run-')).sort();
  while (files.length > 30) fs.unlinkSync(path.join(LOGS_DIR, files.shift()));
}

function printConsoleSummary(summary, hasRegressions) {
  console.log('\n' + '='.repeat(60));
  console.log('                    TEST RESULTS SUMMARY');
  console.log('='.repeat(60) + '\n');
  
  const total = (summary.passing || 0) + (summary.failing || 0);
  console.log(`  Total Tests: ${total}`);
  console.log(`  Passed:      ${summary.passing || 0}`);
  console.log(`  Failed:      ${summary.failing || 0}`);
  console.log('');
  
  if (summary.regressions > 0) {
    console.log(`  REGRESSIONS: ${summary.regressions} (BLOCKS DEPLOYMENT)`);
  }
  if (summary.newTests > 0) {
    console.log(`  New Tests:   ${summary.newTests}`);
  }
  
  console.log('\n' + '-'.repeat(60));
  if (hasRegressions) {
    console.log('  DEPLOYMENT STATUS: BLOCKED');
    console.log('  Fix regressions before deploying');
  } else {
    console.log('  DEPLOYMENT STATUS: ALLOWED');
    console.log('  No regressions - safe to deploy');
  }
  console.log('-'.repeat(60) + '\n');
}

function generateReports() {
  console.log('Generating test reports...\n');
  ensureDirectories();
  
  const { hasRegressions, summary, isFirstRun, regressions, newTests } = runDetection();
  
  if (!summary) {
    console.log('No test results to report.');
    return;
  }
  
  const testResults = parseTestResults();
  const baseline = loadBaseline();
  const previousRun = loadPreviousRun();
  
  // Generate enhanced HTML report
  const htmlContent = generateEnhancedHTML(testResults, { regressions, newTests }, baseline, previousRun);
  fs.writeFileSync(path.join(RESULTS_DIR, 'index.html'), htmlContent);
  
  saveToHistory();
  generateLogFile(summary);
  printConsoleSummary(summary, hasRegressions);
  
  if (isFirstRun) {
    console.log('Note: First test run. Baseline created for future comparisons.\n');
  }
  
  // Check for Playwright results
  const playwrightPath = path.join(RESULTS_DIR, 'playwright-results.json');
  const hasPlaywright = fs.existsSync(playwrightPath);
  
  console.log('Reports Generated:');
  console.log('  - test-results/index.html (Unified Report)');
  console.log('  - test-results/results.json (Vitest)');
  console.log('  - test-results/junit.xml');
  if (hasPlaywright) {
    console.log('  - test-results/playwright-results.json (E2E)');
    console.log('  - test-results/playwright-report/ (Detailed E2E)');
  }
  if (fs.existsSync(path.join(RESULTS_DIR, 'REGRESSIONS.md'))) console.log('  - test-results/REGRESSIONS.md');
  if (fs.existsSync(path.join(RESULTS_DIR, 'NEW-FEATURES.md'))) console.log('  - test-results/NEW-FEATURES.md');
  console.log('');
  
  process.exit(hasRegressions ? 1 : 0);
}

module.exports = { generateReports };

if (require.main === module) {
  generateReports();
}
