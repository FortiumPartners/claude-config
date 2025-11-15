# Release Agent Handoff Contracts

**Version**: 1.0.0
**Last Updated**: 2025-11-05
**Status**: Draft

## Overview

This document defines the input/output contracts between the `release-agent` and the 6 specialized agents it coordinates during the release workflow. Each contract specifies the context passed, expected deliverables, quality gates, timing constraints, and error handling protocols.

## Agent Ecosystem

```
release-agent (Orchestrator)
├── git-workflow (Branch & Tag Management)
├── github-specialist (PR & Release Management)
├── code-reviewer (Security & Quality)
├── test-runner (Unit & Integration Tests)
├── playwright-tester (E2E Tests)
└── deployment-orchestrator (Deployment & Rollback)
```

## 1. git-workflow Handoff Contract

### Purpose
Manage git operations for release branch creation, tag creation, and rollback reverts.

### Input Contract

#### Context from release-agent
```yaml
operation: "create-branch" | "create-tag" | "create-revert"
releaseVersion: "X.Y.Z"  # Semantic version
baseBranch: "main" | "develop" | "production"
targetBranch: "release/vX.Y.Z" | "hotfix/vX.Y.Z"
commitMessage: "Conventional commit format message"
```

#### Example Invocation
```javascript
// Task tool invocation from release-agent
{
  "subagent_type": "git-workflow",
  "description": "Create release branch",
  "prompt": `Create release branch for version 2.1.0:
    - Base branch: main
    - Target branch: release/v2.1.0
    - Commit message: "chore(release): Prepare v2.1.0 release"

    Verify branch created successfully and push to remote.`
}
```

### Output Contract

#### Deliverables
```yaml
branchCreated: boolean
branchName: "release/vX.Y.Z"
commitSha: "abc123..."
remotePushed: boolean
tagCreated: boolean  # If create-tag operation
tagName: "vX.Y.Z"    # If create-tag operation
```

#### Success Response
```json
{
  "status": "success",
  "operation": "create-branch",
  "branchName": "release/v2.1.0",
  "commitSha": "abc123def456",
  "remotePushed": true,
  "message": "Release branch created successfully"
}
```

#### Error Response
```json
{
  "status": "error",
  "operation": "create-branch",
  "errorType": "branch-exists",
  "message": "Branch release/v2.1.0 already exists",
  "suggestion": "Delete existing branch or increment version"
}
```

### Quality Gates
- ✅ Branch created from correct base branch
- ✅ Commit follows conventional commit format
- ✅ Branch pushed to remote successfully
- ✅ Tag follows semantic versioning (vX.Y.Z format)
- ✅ No uncommitted changes before branch creation

### Timing Constraints
- **Branch creation**: ≤30 seconds
- **Tag creation**: ≤15 seconds
- **Revert creation**: ≤45 seconds
- **Timeout**: 2 minutes (all operations)

### Error Handling
- **Branch exists**: Suggest incrementing version or deleting branch
- **Uncommitted changes**: Stash or commit changes before proceeding
- **Push failure**: Retry with exponential backoff (max 3 attempts)
- **Tag conflict**: Suggest force-delete tag or use different version

---

## 2. github-specialist Handoff Contract

### Purpose
Manage GitHub pull request creation, release notes publishing, and GitHub release creation.

### Input Contract

#### Context from release-agent
```yaml
operation: "create-pr" | "create-release"
releaseVersion: "X.Y.Z"
sourceBranch: "release/vX.Y.Z"
targetBranch: "main"
changelog: "Markdown formatted changelog"
releaseNotes: "Markdown formatted release notes"
isDraft: boolean
```

#### Example Invocation
```javascript
// Task tool invocation from release-agent
{
  "subagent_type": "github-specialist",
  "description": "Create release PR",
  "prompt": `Create pull request for v2.1.0 release:
    - Source: release/v2.1.0
    - Target: main
    - Title: "Release v2.1.0 - Feature Name"
    - Include changelog in PR body
    - Add labels: release, v2.1.0
    - Request reviews from tech-lead

    Return PR URL and number.`
}
```

### Output Contract

#### Deliverables
```yaml
prCreated: boolean
prNumber: number
prUrl: "https://github.com/org/repo/pull/123"
releaseCreated: boolean  # If create-release operation
releaseUrl: "https://github.com/org/repo/releases/tag/vX.Y.Z"
```

#### Success Response
```json
{
  "status": "success",
  "operation": "create-pr",
  "prNumber": 123,
  "prUrl": "https://github.com/org/repo/pull/123",
  "reviewers": ["tech-lead", "senior-engineer"],
  "labels": ["release", "v2.1.0"],
  "message": "Pull request created successfully"
}
```

#### Error Response
```json
{
  "status": "error",
  "operation": "create-pr",
  "errorType": "pr-exists",
  "message": "Pull request already exists for release/v2.1.0",
  "existingPr": "https://github.com/org/repo/pull/120",
  "suggestion": "Update existing PR or close it first"
}
```

### Quality Gates
- ✅ PR created with descriptive title and body
- ✅ Changelog included in PR description
- ✅ Reviewers assigned (tech-lead minimum)
- ✅ Labels applied (release, version)
- ✅ CI/CD checks triggered
- ✅ Release notes follow standard format

### Timing Constraints
- **PR creation**: ≤45 seconds
- **Release creation**: ≤60 seconds
- **Timeout**: 3 minutes (all operations)

### Error Handling
- **PR exists**: Return existing PR URL, suggest update or close
- **API rate limit**: Wait and retry with exponential backoff
- **Authentication failure**: Suggest re-authentication with gh CLI
- **Invalid changelog**: Validate markdown format before PR creation

---

## 3. code-reviewer Handoff Contract

### Purpose
Execute security scan and Definition of Done (DoD) validation before release.

### Input Contract

#### Context from release-agent
```yaml
operation: "security-scan" | "dod-validation" | "full-review"
targetBranch: "release/vX.Y.Z"
baselineCommit: "abc123..."  # For diff-based scanning
scanDepth: "critical-only" | "standard" | "comprehensive"
failOnHigh: boolean  # Fail on high-severity issues
```

#### Example Invocation
```javascript
// Task tool invocation from release-agent
{
  "subagent_type": "code-reviewer",
  "description": "Security scan and DoD validation",
  "prompt": `Execute comprehensive security scan and DoD validation for release/v2.1.0:
    - Scan for OWASP Top 10 vulnerabilities
    - Validate all 8 DoD categories
    - Check test coverage (unit ≥80%, integration ≥70%)
    - Fail on any high-severity security issues

    Target completion: 5 minutes (3min security + 2min DoD)

    Return scan results, DoD checklist status, and any blocking issues.`
}
```

### Output Contract

#### Deliverables
```yaml
securityScanComplete: boolean
securityIssues:
  - severity: "critical" | "high" | "medium" | "low"
    category: "SQL Injection" | "XSS" | "CSRF" | etc.
    location: "file:line"
    description: "Issue description"
    fix: "Suggested fix with code patch"
dodValidationComplete: boolean
dodChecklist:
  scope: boolean
  codeQuality: boolean
  testing: boolean
  security: boolean
  performance: boolean
  documentation: boolean
  deployment: boolean
  process: boolean
testCoverage:
  unit: number  # Percentage
  integration: number  # Percentage
  criticalPath: number  # Percentage
```

#### Success Response
```json
{
  "status": "success",
  "operation": "full-review",
  "securityScan": {
    "criticalIssues": 0,
    "highIssues": 0,
    "mediumIssues": 2,
    "lowIssues": 5
  },
  "dodValidation": {
    "allCategoriesPass": true,
    "scope": true,
    "codeQuality": true,
    "testing": true,
    "security": true,
    "performance": true,
    "documentation": true,
    "deployment": true,
    "process": true
  },
  "testCoverage": {
    "unit": 85.3,
    "integration": 74.2,
    "criticalPath": 100.0
  },
  "executionTime": "4.8 minutes",
  "message": "Security scan and DoD validation passed"
}
```

#### Error Response
```json
{
  "status": "error",
  "operation": "full-review",
  "blockers": [
    {
      "category": "security",
      "severity": "high",
      "issue": "SQL Injection vulnerability in user-service.js:45",
      "description": "Direct string interpolation in SQL query",
      "fix": "Use parameterized queries: db.query('SELECT * FROM users WHERE id = ?', [userId])"
    },
    {
      "category": "testing",
      "severity": "high",
      "issue": "Unit test coverage below threshold",
      "description": "Current: 75.2%, Target: 80%",
      "fix": "Add tests for uncovered modules: auth-service.js (45%), payment-service.js (62%)"
    }
  ],
  "executionTime": "3.2 minutes",
  "message": "Security scan failed: 1 high-severity issue, DoD validation failed: test coverage below threshold"
}
```

### Quality Gates
- ✅ No critical or high-severity security issues
- ✅ All 8 DoD categories pass
- ✅ Unit test coverage ≥80%
- ✅ Integration test coverage ≥70%
- ✅ Critical path coverage = 100%
- ✅ No code quality violations (complexity, length, DRY)

### Timing Constraints
- **Security scan**: ≤3 minutes
- **DoD validation**: ≤2 minutes
- **Combined**: ≤5 minutes
- **Timeout**: 10 minutes

### Error Handling
- **High-severity issues**: Block release, provide fix suggestions with code patches
- **Coverage below threshold**: Identify specific modules, suggest tests to add
- **DoD category failure**: Provide specific failures and remediation steps
- **Timeout**: Return partial results, flag timeout for manual review

---

## 4. test-runner Handoff Contract

### Purpose
Execute unit and integration tests, analyze failures, report coverage.

### Input Contract

#### Context from release-agent
```yaml
operation: "unit-tests" | "integration-tests" | "both"
targetBranch: "release/vX.Y.Z"
testFramework: "jest" | "vitest" | "pytest" | "rspec" | "exunit"
coverageThreshold:
  unit: 80  # Percentage
  integration: 70  # Percentage
failFast: boolean  # Exit on first failure
parallelism: number  # Worker count
```

#### Example Invocation
```javascript
// Task tool invocation from release-agent
{
  "subagent_type": "test-runner",
  "description": "Execute unit and integration tests",
  "prompt": `Execute comprehensive test suite for release/v2.1.0:
    - Run unit tests (target: ≥80% coverage, ≤5min)
    - Run integration tests (target: ≥70% coverage, ≤5min)
    - Use parallel execution (4 workers)
    - Fail on coverage below threshold
    - Provide intelligent failure triage for any failures

    Return test results, coverage metrics, and failure analysis.`
}
```

### Output Contract

#### Deliverables
```yaml
unitTestsComplete: boolean
unitTestResults:
  totalTests: number
  passed: number
  failed: number
  skipped: number
  executionTime: "Xm Ys"
  coverage: number  # Percentage
integrationTestsComplete: boolean
integrationTestResults:
  totalTests: number
  passed: number
  failed: number
  skipped: number
  executionTime: "Xm Ys"
  coverage: number  # Percentage
failures:
  - testName: "Test description"
    category: "Implementation Bug" | "Test Bug" | "Environment Issue" | "Flaky Test"
    file: "path/to/file.test.js:line"
    expected: "Expected behavior"
    actual: "Actual behavior"
    fix: "Suggested fix"
```

#### Success Response
```json
{
  "status": "success",
  "operation": "both",
  "unitTests": {
    "totalTests": 450,
    "passed": 448,
    "failed": 0,
    "skipped": 2,
    "executionTime": "4m 32s",
    "coverage": 85.3
  },
  "integrationTests": {
    "totalTests": 120,
    "passed": 120,
    "failed": 0,
    "skipped": 0,
    "executionTime": "4m 18s",
    "coverage": 74.2
  },
  "totalExecutionTime": "8m 50s",
  "coverageThresholdsMet": true,
  "message": "All tests passed, coverage targets achieved"
}
```

#### Error Response
```json
{
  "status": "error",
  "operation": "both",
  "unitTests": {
    "totalTests": 450,
    "passed": 445,
    "failed": 3,
    "skipped": 2,
    "executionTime": "3m 12s",
    "coverage": 78.5
  },
  "failures": [
    {
      "testName": "UserService.create should reject duplicate email",
      "category": "Implementation Bug",
      "file": "src/services/user-service.test.js:45",
      "expected": "Should throw 'Email already exists' error",
      "actual": "No error thrown, duplicate user created",
      "fix": "Add unique constraint check before user creation in user-service.js:78"
    }
  ],
  "coverageBelowThreshold": {
    "unit": "78.5% (target: 80%)",
    "modules": [
      "auth-service.js: 45%",
      "payment-service.js: 62%"
    ]
  },
  "message": "3 test failures, unit coverage below threshold (78.5% < 80%)"
}
```

### Quality Gates
- ✅ All tests passing (0 failures)
- ✅ Unit test coverage ≥80%
- ✅ Integration test coverage ≥70%
- ✅ No flaky tests (>5% failure rate)
- ✅ Execution time within SLA (unit ≤5min, integration ≤5min)

### Timing Constraints
- **Unit tests**: ≤5 minutes (target: 3min, P95: 5min)
- **Integration tests**: ≤5 minutes (target: 3min, P95: 5min)
- **Combined**: ≤10 minutes
- **Timeout**: 15 minutes

### Error Handling
- **Test failures**: Provide intelligent triage with category, fix suggestions
- **Coverage below threshold**: Identify specific modules, suggest tests
- **Timeout**: Return partial results, identify slow tests
- **Flaky tests**: Identify and recommend stability fixes

---

## 5. playwright-tester Handoff Contract

### Purpose
Execute E2E tests for critical user journeys, capture trace artifacts.

### Input Contract

#### Context from release-agent
```yaml
operation: "e2e-tests"
targetEnvironment: "staging" | "production"
journeys:
  - "authentication-flow"
  - "checkout-flow"
  - "search-flow"
browsers:
  - "chromium"
  - "firefox"
  - "webkit"
captureTraces: boolean
captureScreenshots: boolean
```

#### Example Invocation
```javascript
// Task tool invocation from release-agent
{
  "subagent_type": "playwright-tester",
  "description": "Execute E2E tests",
  "prompt": `Execute E2E tests for critical user journeys in staging environment:
    - Authentication flow (login, logout, password reset)
    - Checkout flow (add to cart, payment, order confirmation)
    - Search flow (search, filters, results)
    - Browsers: Chromium, Firefox
    - Capture traces and screenshots on failure

    Target completion: 5 minutes

    Return test results and trace artifact paths.`
}
```

### Output Contract

#### Deliverables
```yaml
e2eTestsComplete: boolean
testResults:
  totalJourneys: number
  passed: number
  failed: number
  executionTime: "Xm Ys"
journeyResults:
  - journeyName: "authentication-flow"
    status: "passed" | "failed"
    browser: "chromium"
    executionTime: "Xs"
    traceFile: "path/to/trace.zip"
    screenshotFile: "path/to/screenshot.png"  # If failure
```

#### Success Response
```json
{
  "status": "success",
  "operation": "e2e-tests",
  "testResults": {
    "totalJourneys": 3,
    "passed": 3,
    "failed": 0,
    "executionTime": "4m 45s"
  },
  "journeyResults": [
    {
      "journeyName": "authentication-flow",
      "status": "passed",
      "browser": "chromium",
      "executionTime": "45s",
      "traceFile": "test-results/auth-flow-chromium-trace.zip"
    },
    {
      "journeyName": "checkout-flow",
      "status": "passed",
      "browser": "chromium",
      "executionTime": "2m 10s",
      "traceFile": "test-results/checkout-flow-chromium-trace.zip"
    },
    {
      "journeyName": "search-flow",
      "status": "passed",
      "browser": "firefox",
      "executionTime": "1m 50s",
      "traceFile": "test-results/search-flow-firefox-trace.zip"
    }
  ],
  "message": "All E2E tests passed, trace artifacts captured"
}
```

#### Error Response
```json
{
  "status": "error",
  "operation": "e2e-tests",
  "testResults": {
    "totalJourneys": 3,
    "passed": 2,
    "failed": 1,
    "executionTime": "3m 30s"
  },
  "journeyResults": [
    {
      "journeyName": "checkout-flow",
      "status": "failed",
      "browser": "chromium",
      "executionTime": "1m 15s",
      "error": "Payment gateway timeout after 30s",
      "failedStep": "Complete payment",
      "traceFile": "test-results/checkout-flow-chromium-trace.zip",
      "screenshotFile": "test-results/checkout-flow-chromium-failure.png",
      "suggestion": "Check payment gateway connectivity, review trace for network errors"
    }
  ],
  "message": "1 E2E test failed: checkout-flow (payment gateway timeout)"
}
```

### Quality Gates
- ✅ All critical user journeys pass
- ✅ Tests complete within 5 minutes
- ✅ Trace artifacts captured for all journeys
- ✅ Screenshots captured for all failures
- ✅ No browser-specific failures

### Timing Constraints
- **E2E tests**: ≤5 minutes (all journeys)
- **Per journey**: ≤2 minutes
- **Timeout**: 10 minutes

### Error Handling
- **Journey failure**: Capture trace and screenshot, provide debugging context
- **Timeout**: Return partial results, identify slow journeys
- **Browser crash**: Retry with different browser, report crash details
- **Flaky test**: Re-run 3x, flag if inconsistent results

---

## 6. deployment-orchestrator Handoff Contract

### Purpose
Execute deployment to staging/production, manage traffic routing, execute rollback.

### Input Contract

#### Context from release-agent
```yaml
operation: "deploy-staging" | "deploy-production" | "rollback"
releaseVersion: "X.Y.Z"
environment: "staging" | "production"
deploymentStrategy: "blue-green" | "canary" | "rolling"
canaryTrafficPercentage: 5 | 25 | 100  # If canary deployment
healthCheckEndpoint: "/health"
smokeTestCallback: "smoke-test-runner"  # Skill to invoke post-deployment
```

#### Example Invocation
```javascript
// Task tool invocation from release-agent
{
  "subagent_type": "deployment-orchestrator",
  "description": "Deploy to production with canary strategy",
  "prompt": `Deploy v2.1.0 to production using canary strategy:
    - Initial canary: 5% traffic
    - After smoke tests pass: 25% traffic
    - After smoke tests pass: 100% traffic
    - Health check endpoint: /api/health
    - Rollback on smoke test failure or health check failure

    Deployment steps:
    1. Deploy to canary infrastructure
    2. Route 5% traffic to canary
    3. Execute smoke tests (smoke-test-runner skill)
    4. If pass: increase to 25%, repeat smoke tests
    5. If pass: increase to 100%, execute final smoke tests
    6. Monitor health checks for 5 minutes

    Return deployment status, traffic routing, and health check results.`
}
```

### Output Contract

#### Deliverables
```yaml
deploymentComplete: boolean
environment: "staging" | "production"
deploymentStrategy: "blue-green" | "canary" | "rolling"
currentTrafficPercentage: number
healthChecksPassing: boolean
smokeTestsPassing: boolean
deploymentDuration: "Xm Ys"
rollbackTriggered: boolean  # If rollback operation
```

#### Success Response
```json
{
  "status": "success",
  "operation": "deploy-production",
  "deploymentStrategy": "canary",
  "canaryProgression": [
    {
      "percentage": 5,
      "duration": "2m 30s",
      "smokeTests": "passed",
      "healthChecks": "passing"
    },
    {
      "percentage": 25,
      "duration": "2m 45s",
      "smokeTests": "passed",
      "healthChecks": "passing"
    },
    {
      "percentage": 100,
      "duration": "3m 10s",
      "smokeTests": "passed",
      "healthChecks": "passing"
    }
  ],
  "deploymentComplete": true,
  "currentTrafficPercentage": 100,
  "totalDuration": "8m 25s",
  "message": "Production deployment successful with canary strategy"
}
```

#### Error Response
```json
{
  "status": "error",
  "operation": "deploy-production",
  "deploymentStrategy": "canary",
  "failedAt": "25% canary",
  "canaryProgression": [
    {
      "percentage": 5,
      "duration": "2m 30s",
      "smokeTests": "passed",
      "healthChecks": "passing"
    },
    {
      "percentage": 25,
      "duration": "1m 45s",
      "smokeTests": "failed",
      "failedTests": ["external-services"],
      "healthChecks": "passing"
    }
  ],
  "rollbackTriggered": true,
  "rollbackDuration": "1m 50s",
  "currentTrafficPercentage": 0,
  "message": "Deployment failed at 25% canary: smoke tests failed (external-services), rollback completed"
}
```

### Quality Gates
- ✅ Deployment completes within SLA (staging: 5min, production: 10min)
- ✅ All health checks passing
- ✅ Smoke tests pass at each canary stage
- ✅ Zero downtime during deployment
- ✅ Rollback capability verified

### Timing Constraints
- **Staging deployment**: ≤5 minutes (2min deploy + 3min smoke tests)
- **Production deployment**: ≤10 minutes (canary progression + smoke tests)
- **Rollback**: ≤2 minutes (traffic reversion)
- **Timeout**: 15 minutes

### Error Handling
- **Deployment failure**: Automatically rollback, provide failure context
- **Smoke test failure**: Trigger rollback, return smoke test details
- **Health check failure**: Trigger rollback, provide health check logs
- **Traffic routing error**: Revert to previous state, escalate to on-call

---

## Handoff Workflow Sequence

### Standard Release Flow
```
1. release-agent → git-workflow: Create release branch
2. release-agent → code-reviewer: Security scan + DoD validation
3. release-agent → test-runner: Unit + Integration tests
4. release-agent → playwright-tester: E2E tests
5. release-agent → deployment-orchestrator: Deploy to staging
6. release-agent → deployment-orchestrator: Deploy to production
7. release-agent → github-specialist: Create PR + GitHub release
```

### Rollback Flow
```
1. deployment-orchestrator → release-agent: Smoke test failure detected
2. release-agent → deployment-orchestrator: Execute rollback
3. release-agent → git-workflow: Create git revert
4. release-agent → github-specialist: Update PR with rollback info
```

### Hotfix Flow
```
1. release-agent → git-workflow: Create hotfix branch
2. release-agent → code-reviewer: Fast-track security scan
3. release-agent → test-runner: Unit tests (affected modules only)
4. release-agent → deployment-orchestrator: Canary deployment
5. release-agent → github-specialist: Create hotfix PR
```

## Timing Budget Summary

| Agent | Operation | Target | P95 | Timeout |
|-------|-----------|--------|-----|---------|
| git-workflow | Branch creation | 30s | 45s | 2min |
| git-workflow | Tag creation | 15s | 30s | 2min |
| github-specialist | PR creation | 45s | 60s | 3min |
| github-specialist | Release creation | 60s | 90s | 3min |
| code-reviewer | Security scan | 3min | 4min | 10min |
| code-reviewer | DoD validation | 2min | 3min | 10min |
| test-runner | Unit tests | 3min | 5min | 15min |
| test-runner | Integration tests | 3min | 5min | 15min |
| playwright-tester | E2E tests | 5min | 7min | 10min |
| deployment-orchestrator | Staging deploy | 5min | 7min | 15min |
| deployment-orchestrator | Production deploy | 10min | 12min | 15min |
| deployment-orchestrator | Rollback | 2min | 3min | 5min |

**Total Release Workflow**: 33 minutes (quality gates: 23min, deployment: 10min)
**Total Hotfix Workflow**: 20 minutes (fast-track gates: 10min, canary deploy: 10min)

## Error Handling & Escalation

### Automatic Retry
- Network errors: Exponential backoff (3 attempts)
- API rate limits: Wait and retry
- Transient failures: Retry immediately (1 attempt)

### Automatic Rollback Triggers
- Production smoke test failure (any category)
- Error rate >5% for 2 minutes
- Health check failure for 3 consecutive checks
- Manual rollback request from on-call

### Escalation Triggers
- Rollback failure (critical)
- Security scan timeout (high)
- E2E test failure (medium)
- Coverage below threshold (medium)

---

**Document Version**: 1.0.0
**Last Review**: 2025-11-05
**Next Review**: 2025-12-05 (Monthly)