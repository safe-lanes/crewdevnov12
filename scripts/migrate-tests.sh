#!/bin/bash

# Test Migration Script for Unix/Linux/macOS
# Helps identify tests that need migration to real code patterns

set -e

echo "========================================"
echo "Test Migration Analysis Tool"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to project root
cd "$(dirname "$0")/.."

echo "Working directory: $(pwd)"
echo ""

# =============================================
# 1. Check for Mock Patterns in Integration Tests
# =============================================
echo -e "${YELLOW}1. Checking for mock patterns in integration tests...${NC}"
echo ""

MOCK_PATTERNS="mock|Mock|jest\.fn|vi\.fn|spyOn|stub|fake"
MOCK_COUNT=$(grep -rE "$MOCK_PATTERNS" tests/integration/ 2>/dev/null | wc -l | tr -d ' ')

if [ "$MOCK_COUNT" -gt 0 ]; then
    echo -e "${RED}Found $MOCK_COUNT mock patterns that need migration:${NC}"
    grep -rE "$MOCK_PATTERNS" tests/integration/ 2>/dev/null || true
    echo ""
    echo -e "${RED}Action: Replace mocks with real fetch() calls${NC}"
else
    echo -e "${GREEN}No mock patterns found - integration tests are clean!${NC}"
fi
echo ""

# =============================================
# 2. Verify Real API Calls
# =============================================
echo -e "${YELLOW}2. Verifying real API calls in integration tests...${NC}"
echo ""

for file in tests/integration/api/*.test.ts; do
    if [ -f "$file" ]; then
        FETCH_COUNT=$(grep -c "fetch(" "$file" 2>/dev/null || echo "0")
        API_BASE_COUNT=$(grep -c "API_BASE" "$file" 2>/dev/null || echo "0")
        
        if [ "$FETCH_COUNT" -gt 0 ] && [ "$API_BASE_COUNT" -gt 0 ]; then
            echo -e "${GREEN}[OK]${NC} $(basename $file): $FETCH_COUNT fetch() calls, $API_BASE_COUNT API_BASE references"
        else
            echo -e "${RED}[NEEDS MIGRATION]${NC} $(basename $file): Only $FETCH_COUNT fetch() calls"
        fi
    fi
done
echo ""

# =============================================
# 3. Check Unit Tests Use Real Schemas
# =============================================
echo -e "${YELLOW}3. Checking unit tests use real schemas...${NC}"
echo ""

SCHEMA_IMPORTS=$(grep -r "from.*schema" tests/unit/ 2>/dev/null | wc -l | tr -d ' ')
echo "Schema imports found: $SCHEMA_IMPORTS"

if [ "$SCHEMA_IMPORTS" -lt 10 ]; then
    echo -e "${YELLOW}Warning: Low schema imports. Check if unit tests use real Zod schemas.${NC}"
else
    echo -e "${GREEN}Good schema coverage in unit tests.${NC}"
fi
echo ""

# =============================================
# 4. Check for Hardcoded Test Data
# =============================================
echo -e "${YELLOW}4. Checking for hardcoded mock data patterns...${NC}"
echo ""

HARDCODED_PATTERNS="mockResponse|mockData|fakeData|testData.*="
HARDCODED_COUNT=$(grep -rE "$HARDCODED_PATTERNS" tests/integration/ 2>/dev/null | wc -l | tr -d ' ')

if [ "$HARDCODED_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Found $HARDCODED_COUNT potential hardcoded data patterns:${NC}"
    grep -rE "$HARDCODED_PATTERNS" tests/integration/ 2>/dev/null | head -10 || true
    echo ""
    echo "(Showing first 10 matches)"
else
    echo -e "${GREEN}No hardcoded mock data patterns found.${NC}"
fi
echo ""

# =============================================
# 5. E2E Test Health Check
# =============================================
echo -e "${YELLOW}5. Checking E2E test patterns...${NC}"
echo ""

E2E_COUNT=$(find tests/e2e -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')
echo "E2E test files: $E2E_COUNT"

TESTID_USAGE=$(grep -r "getByTestId" tests/e2e/ 2>/dev/null | wc -l | tr -d ' ')
echo "data-testid usage: $TESTID_USAGE"

DEFENSIVE_PATTERNS=$(grep -r "\.count()" tests/e2e/ 2>/dev/null | wc -l | tr -d ' ')
echo "Defensive patterns (count()): $DEFENSIVE_PATTERNS"

if [ "$DEFENSIVE_PATTERNS" -gt 5 ]; then
    echo -e "${GREEN}Good defensive testing patterns in E2E tests.${NC}"
else
    echo -e "${YELLOW}Consider adding more defensive patterns (check element.count() before click).${NC}"
fi
echo ""

# =============================================
# Summary
# =============================================
echo "========================================"
echo "Migration Summary"
echo "========================================"
echo ""

UNIT_COUNT=$(grep -r "it(" tests/unit/ 2>/dev/null | wc -l | tr -d ' ')
INTEGRATION_COUNT=$(grep -r "it(" tests/integration/ 2>/dev/null | wc -l | tr -d ' ')
E2E_TEST_COUNT=$(grep -r "test(" tests/e2e/ 2>/dev/null | wc -l | tr -d ' ')

echo "Test Counts:"
echo "  Unit tests:        $UNIT_COUNT"
echo "  Integration tests: $INTEGRATION_COUNT"
echo "  E2E tests:         $E2E_TEST_COUNT"
echo "  -----------------------"
echo "  Total:             $((UNIT_COUNT + INTEGRATION_COUNT + E2E_TEST_COUNT))"
echo ""

if [ "$MOCK_COUNT" -eq 0 ]; then
    echo -e "${GREEN}Status: All tests appear to follow real code patterns!${NC}"
else
    echo -e "${RED}Status: $MOCK_COUNT items need migration from mocks to real code.${NC}"
fi
echo ""

echo "Run 'npm run test' to verify all tests pass."
echo ""
