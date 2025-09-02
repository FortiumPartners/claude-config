#!/bin/bash

# Test Role Separation: tech-lead-orchestrator vs ai-mesh-orchestrator
# Created: 2025-09-01

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Base directory
BASE_DIR="/Users/ldangelo/Development/fortium/claude-config"

# Function to log test results
log_test() {
    local test_name="$1"
    local result="$2"
    local message="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        [ -n "$message" ] && echo "  $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        [ -n "$message" ] && echo "  $message"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo "================================"
echo "Role Separation Validation Test"
echo "================================"

TECH_LEAD_CONFIG="$BASE_DIR/.claude/agents/tech-lead-orchestrator.md"
AI_MESH_CONFIG="$BASE_DIR/.claude/agents/ai-mesh-orchestrator.md"

# Test 1: Verify both files exist
if [ -f "$TECH_LEAD_CONFIG" ] && [ -f "$AI_MESH_CONFIG" ]; then
    log_test "Agent files exist" "PASS" "Both orchestrator files found"
else
    log_test "Agent files exist" "FAIL" "Missing orchestrator files"
    exit 1
fi

# Test 2: Tech-lead focuses on product planning
if grep -qi "product.*planning\|technical.*scope\|requirements.*analysis\|product.*requirements" "$TECH_LEAD_CONFIG"; then
    log_test "Tech-lead product focus" "PASS" "Tech-lead handles product planning"
else
    log_test "Tech-lead product focus" "FAIL" "Tech-lead should focus on product planning"
fi

# Test 3: AI-mesh focuses on agent coordination
if grep -qi "agent.*delegation\|agent.*coordination\|workflow.*orchestration" "$AI_MESH_CONFIG"; then
    log_test "AI-mesh coordination focus" "PASS" "AI-mesh handles agent coordination"
else
    log_test "AI-mesh coordination focus" "FAIL" "AI-mesh should focus on agent coordination"
fi

# Test 4: No role overlap - tech-lead avoids agent delegation (but can mention it doesn't do it)
if grep -q "I.*delegate.*agent\|My.*responsibility.*delegate\|DO.*agent.*delegation" "$TECH_LEAD_CONFIG"; then
    log_test "Tech-lead boundary respect" "FAIL" "Tech-lead should not claim agent delegation responsibilities"
else
    log_test "Tech-lead boundary respect" "PASS" "Tech-lead avoids agent delegation responsibilities"
fi

# Test 5: No role overlap - AI-mesh avoids product planning (but can reference other roles)
if grep -q "I.*handle.*product\|My.*responsibility.*product\|DO.*product.*planning" "$AI_MESH_CONFIG"; then
    log_test "AI-mesh boundary respect" "FAIL" "AI-mesh should not claim product planning responsibilities"
else
    log_test "AI-mesh boundary respect" "PASS" "AI-mesh avoids product planning responsibilities"
fi

# Test 6: Check for handoff protocols
if grep -qi "handoff\|coordinate.*with\|delegate.*to" "$TECH_LEAD_CONFIG" || grep -qi "handoff\|receive.*from\|accept.*from" "$AI_MESH_CONFIG"; then
    log_test "Handoff protocols" "PASS" "Handoff protocols defined"
else
    log_test "Handoff protocols" "FAIL" "Missing handoff protocols"
fi

echo
echo "Summary: $TESTS_PASSED/$TESTS_RUN tests passed"

if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}❌ $TESTS_FAILED TEST(S) FAILED${NC}"
    exit 1
fi