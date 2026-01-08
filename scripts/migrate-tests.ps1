# Test Migration Script for Windows PowerShell
# Helps identify tests that need migration to real code patterns

Write-Host "========================================"
Write-Host "Test Migration Analysis Tool"
Write-Host "========================================"
Write-Host ""

# Change to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptPath "..")

Write-Host "Working directory: $(Get-Location)"
Write-Host ""

# =============================================
# 1. Check for Mock Patterns in Integration Tests
# =============================================
Write-Host "1. Checking for mock patterns in integration tests..." -ForegroundColor Yellow
Write-Host ""

$mockPatterns = @("mock", "Mock", "jest.fn", "vi.fn", "spyOn", "stub", "fake")
$mockMatches = @()

foreach ($pattern in $mockPatterns) {
    $matches = Select-String -Path "tests/integration/**/*.test.ts" -Pattern $pattern -ErrorAction SilentlyContinue
    if ($matches) {
        $mockMatches += $matches
    }
}

if ($mockMatches.Count -gt 0) {
    Write-Host "Found $($mockMatches.Count) mock patterns that need migration:" -ForegroundColor Red
    $mockMatches | ForEach-Object { Write-Host $_.Line }
    Write-Host ""
    Write-Host "Action: Replace mocks with real fetch() calls" -ForegroundColor Red
} else {
    Write-Host "No mock patterns found - integration tests are clean!" -ForegroundColor Green
}
Write-Host ""

# =============================================
# 2. Verify Real API Calls
# =============================================
Write-Host "2. Verifying real API calls in integration tests..." -ForegroundColor Yellow
Write-Host ""

$testFiles = Get-ChildItem -Path "tests/integration/api" -Filter "*.test.ts" -ErrorAction SilentlyContinue

foreach ($file in $testFiles) {
    $content = Get-Content $file.FullName -Raw
    $fetchCount = ([regex]::Matches($content, "fetch\(")).Count
    $apiBaseCount = ([regex]::Matches($content, "API_BASE")).Count
    
    if ($fetchCount -gt 0 -and $apiBaseCount -gt 0) {
        Write-Host "[OK] $($file.Name): $fetchCount fetch() calls, $apiBaseCount API_BASE references" -ForegroundColor Green
    } else {
        Write-Host "[NEEDS MIGRATION] $($file.Name): Only $fetchCount fetch() calls" -ForegroundColor Red
    }
}
Write-Host ""

# =============================================
# 3. Check Unit Tests Use Real Schemas
# =============================================
Write-Host "3. Checking unit tests use real schemas..." -ForegroundColor Yellow
Write-Host ""

$schemaImports = Select-String -Path "tests/unit/**/*.test.ts" -Pattern "from.*schema" -ErrorAction SilentlyContinue
$schemaCount = if ($schemaImports) { $schemaImports.Count } else { 0 }

Write-Host "Schema imports found: $schemaCount"

if ($schemaCount -lt 10) {
    Write-Host "Warning: Low schema imports. Check if unit tests use real Zod schemas." -ForegroundColor Yellow
} else {
    Write-Host "Good schema coverage in unit tests." -ForegroundColor Green
}
Write-Host ""

# =============================================
# 4. Check for Hardcoded Test Data
# =============================================
Write-Host "4. Checking for hardcoded mock data patterns..." -ForegroundColor Yellow
Write-Host ""

$hardcodedPatterns = @("mockResponse", "mockData", "fakeData")
$hardcodedMatches = @()

foreach ($pattern in $hardcodedPatterns) {
    $matches = Select-String -Path "tests/integration/**/*.test.ts" -Pattern $pattern -ErrorAction SilentlyContinue
    if ($matches) {
        $hardcodedMatches += $matches
    }
}

if ($hardcodedMatches.Count -gt 0) {
    Write-Host "Found $($hardcodedMatches.Count) potential hardcoded data patterns:" -ForegroundColor Yellow
    $hardcodedMatches | Select-Object -First 10 | ForEach-Object { Write-Host $_.Line }
    Write-Host ""
    Write-Host "(Showing first 10 matches)"
} else {
    Write-Host "No hardcoded mock data patterns found." -ForegroundColor Green
}
Write-Host ""

# =============================================
# 5. E2E Test Health Check
# =============================================
Write-Host "5. Checking E2E test patterns..." -ForegroundColor Yellow
Write-Host ""

$e2eFiles = Get-ChildItem -Path "tests/e2e" -Filter "*.spec.ts" -ErrorAction SilentlyContinue
$e2eCount = if ($e2eFiles) { $e2eFiles.Count } else { 0 }
Write-Host "E2E test files: $e2eCount"

$testIdUsage = Select-String -Path "tests/e2e/**/*.spec.ts" -Pattern "getByTestId" -ErrorAction SilentlyContinue
$testIdCount = if ($testIdUsage) { $testIdUsage.Count } else { 0 }
Write-Host "data-testid usage: $testIdCount"

$defensivePatterns = Select-String -Path "tests/e2e/**/*.spec.ts" -Pattern "\.count\(\)" -ErrorAction SilentlyContinue
$defensiveCount = if ($defensivePatterns) { $defensivePatterns.Count } else { 0 }
Write-Host "Defensive patterns (count()): $defensiveCount"

if ($defensiveCount -gt 5) {
    Write-Host "Good defensive testing patterns in E2E tests." -ForegroundColor Green
} else {
    Write-Host "Consider adding more defensive patterns (check element.count() before click)." -ForegroundColor Yellow
}
Write-Host ""

# =============================================
# Summary
# =============================================
Write-Host "========================================"
Write-Host "Migration Summary"
Write-Host "========================================"
Write-Host ""

$unitTests = Select-String -Path "tests/unit/**/*.test.ts" -Pattern "it\(" -ErrorAction SilentlyContinue
$unitCount = if ($unitTests) { $unitTests.Count } else { 0 }

$integrationTests = Select-String -Path "tests/integration/**/*.test.ts" -Pattern "it\(" -ErrorAction SilentlyContinue
$integrationCount = if ($integrationTests) { $integrationTests.Count } else { 0 }

$e2eTests = Select-String -Path "tests/e2e/**/*.spec.ts" -Pattern "test\(" -ErrorAction SilentlyContinue
$e2eTestCount = if ($e2eTests) { $e2eTests.Count } else { 0 }

Write-Host "Test Counts:"
Write-Host "  Unit tests:        $unitCount"
Write-Host "  Integration tests: $integrationCount"
Write-Host "  E2E tests:         $e2eTestCount"
Write-Host "  -----------------------"
Write-Host "  Total:             $($unitCount + $integrationCount + $e2eTestCount)"
Write-Host ""

if ($mockMatches.Count -eq 0) {
    Write-Host "Status: All tests appear to follow real code patterns!" -ForegroundColor Green
} else {
    Write-Host "Status: $($mockMatches.Count) items need migration from mocks to real code." -ForegroundColor Red
}
Write-Host ""

Write-Host "Run 'npm run test' to verify all tests pass."
Write-Host ""
