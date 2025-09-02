#!/bin/bash

# Test Command Routing Logic and Performance
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
COMMANDS_DIR="$BASE_DIR/commands"

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

echo "==============================="
echo "Command Routing Validation Test"
echo "==============================="

# Test 1: All commands have YAML frontmatter
missing_yaml=0
for file in "$COMMANDS_DIR"/*.md; do
    if ! grep -q "^---" "$file"; then
        missing_yaml=$((missing_yaml + 1))
    fi
done

if [ "$missing_yaml" -eq 0 ]; then
    log_test "All commands have YAML frontmatter" "PASS" "All $(ls -1 "$COMMANDS_DIR"/*.md | wc -l) commands have frontmatter"
else
    log_test "All commands have YAML frontmatter" "FAIL" "$missing_yaml commands missing YAML frontmatter"
fi

# Test 2: All commands have agent routing
missing_agent=0
for file in "$COMMANDS_DIR"/*.md; do
    if ! grep -q "^agent:" "$file"; then
        missing_agent=$((missing_agent + 1))
        echo "  Missing agent routing: $(basename "$file")"
    fi
done

if [ "$missing_agent" -eq 0 ]; then
    log_test "All commands have agent routing" "PASS" "All commands specify target agent"
else
    log_test "All commands have agent routing" "FAIL" "$missing_agent commands missing agent routing"
fi

# Test 3: Agent routing performance (file parsing speed)
echo
echo "Testing routing performance..."

# Measure parsing time for all commands
start_time=$(date +%s%N)
agent_count=0

for file in "$COMMANDS_DIR"/*.md; do
    agent=$(grep "^agent:" "$file" | cut -d':' -f2 | tr -d ' ')
    if [ -n "$agent" ]; then
        agent_count=$((agent_count + 1))
    fi
done

end_time=$(date +%s%N)
duration_ns=$((end_time - start_time))
duration_ms=$((duration_ns / 1000000))

if [ "$duration_ms" -lt 100 ]; then
    log_test "Routing performance meets <100ms benchmark" "PASS" "Parsed $agent_count commands in ${duration_ms}ms"
else
    log_test "Routing performance meets <100ms benchmark" "FAIL" "Parsed $agent_count commands in ${duration_ms}ms (exceeds 100ms limit)"
fi

# Test 4: Valid agent references
echo
echo "Validating agent references..."

valid_agents=(
    "tech-lead-orchestrator"
    "ai-mesh-orchestrator" 
    "general-purpose"
    "manager-dashboard-agent"
    "playwright-tester"
    "frontend-developer"
    "backend-developer"
    "code-reviewer"
    "test-runner"
    "git-workflow"
    "documentation-specialist"
    "react-component-architect"
    "rails-backend-expert"
    "context-fetcher"
    "file-creator"
    "directory-monitor"
)

invalid_agents=0
for file in "$COMMANDS_DIR"/*.md; do
    agent=$(grep "^agent:" "$file" | cut -d':' -f2 | tr -d ' ')
    if [ -n "$agent" ]; then
        is_valid=false
        for valid_agent in "${valid_agents[@]}"; do
            if [ "$agent" = "$valid_agent" ]; then
                is_valid=true
                break
            fi
        done
        
        if [ "$is_valid" = false ]; then
            echo "  Invalid agent reference: $agent in $(basename "$file")"
            invalid_agents=$((invalid_agents + 1))
        fi
    fi
done

if [ "$invalid_agents" -eq 0 ]; then
    log_test "All agent references are valid" "PASS" "All commands reference existing agents"
else
    log_test "All agent references are valid" "FAIL" "$invalid_agents commands reference invalid agents"
fi

# Test 5: Role separation compliance
echo
echo "Testing role separation compliance..."

# Check that product planning commands route to tech-lead-orchestrator
product_commands_correct=0
total_product_commands=0

for cmd in "plan-product" "analyze-product"; do
    file="$COMMANDS_DIR/${cmd}.md"
    if [ -f "$file" ]; then
        total_product_commands=$((total_product_commands + 1))
        agent=$(grep "^agent:" "$file" | cut -d':' -f2 | tr -d ' ')
        if [ "$agent" = "tech-lead-orchestrator" ]; then
            product_commands_correct=$((product_commands_correct + 1))
        else
            echo "  Incorrect routing: $cmd routes to $agent, should route to tech-lead-orchestrator"
        fi
    fi
done

# Check that execution commands route to ai-mesh-orchestrator
execution_commands_correct=0
total_execution_commands=0

for cmd in "execute-tasks"; do
    file="$COMMANDS_DIR/${cmd}.md"
    if [ -f "$file" ]; then
        total_execution_commands=$((total_execution_commands + 1))
        agent=$(grep "^agent:" "$file" | cut -d':' -f2 | tr -d ' ')
        if [ "$agent" = "ai-mesh-orchestrator" ]; then
            execution_commands_correct=$((execution_commands_correct + 1))
        else
            echo "  Incorrect routing: $cmd routes to $agent, should route to ai-mesh-orchestrator"
        fi
    fi
done

if [ "$product_commands_correct" -eq "$total_product_commands" ] && [ "$execution_commands_correct" -eq "$total_execution_commands" ]; then
    log_test "Role separation compliance" "PASS" "Product and execution commands route correctly"
else
    log_test "Role separation compliance" "FAIL" "Some commands have incorrect role-based routing"
fi

echo
echo "Summary: $TESTS_PASSED/$TESTS_RUN tests passed"

if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED${NC}"
    echo "Command routing is properly configured with performance under 100ms"
    exit 0
else
    echo -e "${RED}❌ $TESTS_FAILED TEST(S) FAILED${NC}"
    exit 1
fi