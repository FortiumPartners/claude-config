#!/bin/bash

# Test script to validate the renaming of orcastrator.md to ai-mesh-orchestrator.md
# Created: 2025-09-01

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
echo "File Rename Validation Test"
echo "================================"

# Test 1: Check that old file no longer exists
if [ ! -f "$BASE_DIR/.claude/agents/orcastrator.md" ]; then
    log_test "Old file removal" "PASS" "orcastrator.md successfully removed"
else
    log_test "Old file removal" "FAIL" "orcastrator.md still exists"
fi

# Test 2: Check that new file exists
if [ -f "$BASE_DIR/.claude/agents/ai-mesh-orchestrator.md" ]; then
    log_test "New file creation" "PASS" "ai-mesh-orchestrator.md exists"
else
    log_test "New file creation" "FAIL" "ai-mesh-orchestrator.md not found"
fi

# Test 3: Check file content integrity
if [ -f "$BASE_DIR/.claude/agents/ai-mesh-orchestrator.md" ]; then
    if grep -q "name: ai-mesh-orchestrator" "$BASE_DIR/.claude/agents/ai-mesh-orchestrator.md"; then
        log_test "File content integrity" "PASS" "YAML frontmatter updated correctly"
    else
        log_test "File content integrity" "FAIL" "YAML frontmatter incorrect"
    fi
else
    log_test "File content integrity" "FAIL" "Cannot test - new file does not exist"
fi

# Test 4: Check references in CLAUDE.md are updated
old_refs=$(grep -E "orcastrator|orchastration" "$BASE_DIR/CLAUDE.md" 2>/dev/null | wc -l)
new_refs=$(grep -c "ai-mesh-orchestrator" "$BASE_DIR/CLAUDE.md" 2>/dev/null || echo "0")

if [ "$old_refs" -eq 0 ] && [ "$new_refs" -gt 0 ]; then
    log_test "CLAUDE.md references" "PASS" "References updated ($new_refs new references)"
else
    log_test "CLAUDE.md references" "FAIL" "Old refs: $old_refs, New refs: $new_refs"
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