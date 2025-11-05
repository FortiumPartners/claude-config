# @ai-mesh-command
# Command: playwright-test
# Version: 1.0.0
# Category: testing
# Source: fortium
# Maintainer: Fortium Software Configuration Team
# Last Updated: 2025-10-13

---
name: playwright-test
description: Automated E2E testing and error resolution using Playwright MCP integration
version: 1.0.0
category: testing
---

## Mission

Automated application testing and error resolution using Playwright MCP server
integration. Generates test specs, executes tests, captures failures, and provides
debugging context for quick resolution.



## Workflow

### Phase 1: Test Planning

1. **User Flow Identification**: Identify critical user flows to test
2. **Test Spec Generation**: Generate Playwright test specifications

### Phase 2: Test Execution

1. **Test Run**: Execute Playwright tests with trace capture
   - **Delegates to**: playwright-tester
   - **Context**: Test specifications and target application URL
2. **Result Analysis**: Analyze test results and capture failures

### Phase 3: Error Resolution

1. **Failure Diagnosis**: Analyze failure screenshots and traces
2. **Fix Implementation**: Implement fixes for identified issues


## Expected Input

**Format**: Application URL or Test Configuration

**Required Sections**:
- **Application URL** (Required) - URL of application to test
- **User Flows** (Optional) - Specific flows to test


## Expected Output

**Format**: Test Results and Traces

**Structure**:
- **Test Report**: Pass/fail status for all tests
- **Traces**: Playwright traces for failed tests
- **Screenshots**: Failure screenshots for debugging
