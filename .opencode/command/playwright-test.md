COMMAND: /playwright-test
DESCRIPTION: Automated E2E testing and error resolution using Playwright MCP integration
VERSION: 1.0.0

PURPOSE:
Automated application testing and error resolution using Playwright MCP server
integration. Generates test specs, executes tests, captures failures, and provides
debugging context for quick resolution.

WORKFLOW:

Phase 1: Test Planning
  1. User Flow Identification: Identify critical user flows to test
  2. Test Spec Generation: Generate Playwright test specifications

Phase 2: Test Execution
  1. Test Run: Execute Playwright tests with trace capture
     Delegates to: playwright-tester
  2. Result Analysis: Analyze test results and capture failures

Phase 3: Error Resolution
  1. Failure Diagnosis: Analyze failure screenshots and traces
  2. Fix Implementation: Implement fixes for identified issues

EXPECTED INPUT:
Format: Application URL or Test Configuration
Required sections:
- Application URL [REQUIRED]
- User Flows [OPTIONAL]

EXPECTED OUTPUT:
Format: Test Results and Traces
Structure:
- Test Report: Pass/fail status for all tests
- Traces: Playwright traces for failed tests
- Screenshots: Failure screenshots for debugging
