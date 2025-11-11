# /release - Automated Release Workflow Orchestration

**Version**: 1.0.0
**Category**: Deployment
**Agent**: release-agent

## Overview

Automated release workflow orchestration with quality gates, smoke test integration, and deployment coordination. Supports standard releases, hotfix deployments, and automated rollback with comprehensive smoke test coverage at every checkpoint.

## Quick Start

```bash
# Standard release with full quality gates
/release --version 2.1.0

# Hotfix release (fast-track, canary deployment)
/release --version 2.1.1 --type hotfix

# Manual rollback to previous version
/release --version 2.1.0 --rollback

# Draft release for review
/release --version 2.1.0 --draft
```

## Release Workflow

### Standard Release (33 minutes)

```
1. Initialization (2min)
   └─ Version validation → Branch creation → Changelog generation

2. Quality Gates (23min)
   ├─ Security scan (3min)
   ├─ DoD validation (2min)
   ├─ Unit tests (5min, ≥80% coverage)
   ├─ Integration tests (5min, ≥70% coverage)
   ├─ Pre-release smoke tests (3min, 5 categories)
   └─ E2E tests (5min, critical journeys)

3. Staging Deployment (5min)
   ├─ Deploy to staging (2min)
   └─ Post-staging smoke tests (3min)

4. Production Deployment (5min)
   ├─ Canary deployment (5% → 25% → 100%)
   │  └─ Smoke tests at each stage
   └─ Post-production smoke tests (3min)

5. Completion (3min)
   ├─ Create PR and GitHub release
   ├─ Generate release report
   ├─ Update tickets (Linear/Jira)
   └─ Send metrics to dashboard
```

### Hotfix Release (20 minutes)

```
1. Initialization (2min)
   └─ Version validation → Hotfix branch creation → Changelog

2. Fast-Track Quality Gates (10min)
   ├─ Security scan (3min)
   ├─ Unit tests affected modules (3min)
   ├─ Pre-release smoke tests (2min, critical paths only)
   └─ E2E critical journeys (2min)

3. Production Canary Deployment (10min)
   ├─ Deploy to 5% → smoke tests (1min)
   ├─ Deploy to 25% → smoke tests (1min)
   ├─ Deploy to 100% → smoke tests (3min)
   └─ Monitor health (5min)

4. Completion (3min)
   ├─ Create hotfix PR
   ├─ Automated backport to develop
   └─ Schedule post-deployment review
```

### Rollback Workflow (10 minutes)

```
1. Trigger Detection
   ├─ Smoke test failure detected
   ├─ Error rate >5% for 2 minutes
   ├─ Health check failure (3 consecutive)
   └─ Manual rollback request

2. Traffic Reversion (2min)
   └─ Route all traffic to previous version

3. Post-Rollback Smoke Tests (3min)
   └─ Verify error rate normalized

4. Health Validation (5min)
   └─ Monitor error rate <1%

5. Finalization
   ├─ Create git revert
   ├─ Update tickets with rollback reason
   └─ Alert on-call engineer
```

## Command Arguments

### Required Arguments

#### `--version X.Y.Z`
Semantic version for the release (e.g., 2.1.0)

**Validation**:
- Must match semantic versioning format (X.Y.Z)
- No conflicts with existing tags/branches
- Version must be higher than current release

**Examples**:
```bash
/release --version 2.1.0
/release --version 3.0.0
/release --version 2.1.1
```

### Optional Arguments

#### `--type [standard|hotfix|rollback]`
Release type determines the workflow variant

**Options**:
- `standard` (default): Full quality gates + staging + production
- `hotfix`: Fast-track gates + direct to production with canary
- `rollback`: Revert to previous version with verification

**Examples**:
```bash
/release --version 2.1.0 --type standard
/release --version 2.1.1 --type hotfix
/release --version 2.1.0 --type rollback
```

#### `--from [branch]`
Base branch for release (overrides default)

**Defaults**:
- `standard`: main
- `hotfix`: production
- `rollback`: production

**Examples**:
```bash
/release --version 2.1.0 --from develop
/release --version 2.1.1 --type hotfix --from main
```

#### `--to [branch]`
Target branch for release (overrides default)

**Defaults**:
- `standard`: release/vX.Y.Z
- `hotfix`: hotfix/vX.Y.Z
- `rollback`: rollback/vX.Y.Z

**Examples**:
```bash
/release --version 2.1.0 --to release/v2.1.0
/release --version 2.1.1 --type hotfix --to hotfix/critical-fix
```

#### `--base [branch]`
Alias for `--from` (base branch)

**Example**:
```bash
/release --version 2.1.0 --base main
```

#### `--target [branch]`
Alias for `--to` (target branch)

**Example**:
```bash
/release --version 2.1.0 --target release/v2.1.0
```

#### `--rollback`
Trigger manual rollback (equivalent to `--type rollback`)

**Example**:
```bash
/release --version 2.1.0 --rollback
```

#### `--draft`
Create GitHub release as draft for review before publishing

**Example**:
```bash
/release --version 2.1.0 --draft
```

## Smoke Test Integration

The release workflow executes smoke tests at **5 critical checkpoints**:

### 1. Pre-Release Smoke Tests (3min)
**Executed**: After quality gates, before staging deployment
**Purpose**: Validate release readiness
**Categories**: All 5 (API, database, external services, auth, critical paths)

### 2. Post-Staging Smoke Tests (3min)
**Executed**: After staging deployment
**Purpose**: Verify staging deployment success
**Categories**: All 5 with staging-specific configuration

### 3. Canary Smoke Tests (1min each)
**Executed**: At 5%, 25%, and 100% traffic stages
**Purpose**: Progressive rollout verification
**Categories**: All 5 with production configuration

### 4. Post-Production Smoke Tests (3min)
**Executed**: After 100% production deployment
**Purpose**: Final production verification
**Categories**: All 5 with extended monitoring

### 5. Post-Rollback Smoke Tests (3min)
**Executed**: After traffic reversion during rollback
**Purpose**: Verify rollback success
**Categories**: All 5 to confirm system stability

## Quality Gates

### Security Scan (3min, code-reviewer)
- OWASP Top 10 vulnerability scanning
- **Pass Criteria**: Zero critical/high severity issues
- **Failure Action**: Block release, provide fix suggestions

### DoD Validation (2min, code-reviewer)
- Validate all 8 DoD categories
- **Pass Criteria**: All categories pass
- **Failure Action**: Block release, provide remediation steps

### Unit Tests (5min, test-runner)
- Execute unit test suite with coverage
- **Pass Criteria**: ≥80% coverage, 0 failures
- **Failure Action**: Block release, provide intelligent triage

### Integration Tests (5min, test-runner)
- Execute integration test suite with coverage
- **Pass Criteria**: ≥70% coverage, 0 failures
- **Failure Action**: Block release, provide intelligent triage

### Smoke Tests (3min, smoke-test-runner skill)
- Execute 5-category smoke test suite
- **Pass Criteria**: All categories pass
- **Failure Action**: Block release or trigger rollback (if production)

### E2E Tests (5min, playwright-tester)
- Execute critical user journey tests
- **Pass Criteria**: All journeys pass
- **Failure Action**: Block release, provide trace artifacts

## Deployment Strategies

### Blue-Green Deployment (Staging)
- Deploy new version alongside old version
- Switch traffic after smoke tests pass
- Keep old version for instant rollback

### Canary Deployment (Production)
- Progressive rollout: 5% → 25% → 100%
- Smoke tests at each stage
- Automatic rollback on failure

### Rollback Strategy
- Instant traffic reversion (<2min)
- Smoke test verification (3min)
- Health monitoring (5min)

## Rollback Triggers

### Automatic Rollback
- **Production smoke test failure**: Any category fails
- **Error rate spike**: >5% for 2 minutes
- **Health check failure**: 3 consecutive failures

### Manual Rollback
```bash
/release --version 2.1.0 --rollback
```

**Use cases**:
- Critical production issue detected
- Customer-impacting bug discovered
- Performance degradation observed

## Usage Examples

### Example 1: Standard Release
```bash
/release --version 2.1.0
```

**Workflow**:
1. Creates release/v2.1.0 branch from main
2. Executes all quality gates (23min)
3. Deploys to staging with smoke tests (5min)
4. Deploys to production with canary + smoke tests (5min)
5. Creates PR and GitHub release (3min)

**Total Time**: 33 minutes

### Example 2: Hotfix Release
```bash
/release --version 2.1.1 --type hotfix
```

**Workflow**:
1. Creates hotfix/v2.1.1 branch from production
2. Executes fast-track quality gates (10min)
3. Deploys to production with canary + smoke tests (10min)
4. Creates hotfix PR and backports to develop (3min)

**Total Time**: 20 minutes

### Example 3: Custom Branch Release
```bash
/release --version 2.1.0 --from develop --to release/v2.1.0
```

**Workflow**:
1. Creates release/v2.1.0 branch from develop (custom base)
2. Executes standard workflow
3. Merges to main via PR

### Example 4: Draft Release
```bash
/release --version 2.1.0 --draft
```

**Workflow**:
1. Executes full standard release workflow
2. Creates GitHub release as **draft**
3. Allows manual review before publishing

### Example 5: Manual Rollback
```bash
/release --version 2.1.0 --rollback
```

**Workflow**:
1. Reverts traffic to previous version (<2min)
2. Executes post-rollback smoke tests (3min)
3. Monitors health for 5 minutes
4. Creates git revert and updates tickets

**Total Time**: 10 minutes

## Release Artifacts

### Pull Request
- **URL**: https://github.com/org/repo/pull/123
- **Contents**: Changelog, test results, deployment summary
- **Reviewers**: Tech lead, senior engineers
- **Labels**: release, vX.Y.Z

### GitHub Release
- **URL**: https://github.com/org/repo/releases/tag/vX.Y.Z
- **Contents**: Release notes, changelog, artifacts
- **Status**: Published or draft (if --draft flag)

### Release Report
- **Location**: docs/releases/release-vX.Y.Z-report.md
- **Contents**:
  - Test execution history (security, DoD, unit, integration, smoke, E2E)
  - Deployment timeline (staging, production, canary progression)
  - Smoke test results at each checkpoint
  - Quality gate metrics

### Audit Log
- **Location**: logs/release-audit.log
- **Contents**:
  - Release initiation (timestamp, user, version)
  - Quality gate results (pass/fail, duration)
  - Deployment events (staging, production, rollback)
  - Smoke test results at each checkpoint
  - Approval history (if applicable)

## Timing Budget

| Phase | Standard | Hotfix | Rollback |
|-------|----------|--------|----------|
| Initialization | 2min | 2min | 1min |
| Quality Gates | 23min | 10min | - |
| Staging | 5min | - | - |
| Production | 5min | 10min | - |
| Rollback | - | - | 10min |
| Completion | 3min | 3min | 2min |
| **Total** | **33min** | **20min** | **10min** |

## Success Criteria

✅ All quality gates pass
✅ Staging deployment successful with smoke tests passing
✅ Production deployment successful with canary progression
✅ Post-production smoke tests passing
✅ Error rate <1% for 5 minutes post-deployment
✅ Release artifacts created (PR, GitHub release, report, audit log)
✅ Tickets updated with release information

## Failure Criteria

❌ Any quality gate fails
❌ Staging deployment or smoke tests fail
❌ Production smoke test failure
❌ Error rate >5% for 2 minutes
❌ Health check failure (3 consecutive)
❌ Rollback triggered

## Agent Delegation

The release-agent coordinates with 6 specialized agents:

1. **git-workflow**: Branch/tag creation, git revert
2. **github-specialist**: PR creation, GitHub release
3. **code-reviewer**: Security scan, DoD validation
4. **test-runner**: Unit and integration tests
5. **playwright-tester**: E2E tests
6. **deployment-orchestrator**: Deployment, rollback

## Skills Integration

The release-agent uses 5 specialized skills:

1. **smoke-test-runner**: Orchestrates 5-category smoke test suite
2. **changelog-generator**: Generates changelog from git history
3. **release-report-generator**: Creates comprehensive release report
4. **audit-log-generator**: Appends audit log entries
5. **semantic-version-validator**: Validates semantic versioning

## Troubleshooting

### Quality Gate Failures

**Symptom**: Security scan fails with high-severity issues
**Action**: Review security report, apply suggested fixes, re-run `/release`

**Symptom**: Unit test coverage below 80%
**Action**: Add tests for uncovered modules, re-run `/release`

### Deployment Failures

**Symptom**: Staging smoke tests fail
**Action**: Review smoke test logs, fix issues, re-deploy to staging manually, then continue release

**Symptom**: Production canary fails at 25%
**Action**: Automatic rollback triggered, review canary smoke test logs, fix issues, create new hotfix

### Rollback Issues

**Symptom**: Post-rollback smoke tests fail
**Action**: Critical escalation, manual intervention required, review smoke test logs

**Symptom**: Health checks still failing after rollback
**Action**: Emergency page on-call + tech lead, war room initiated

## Related Commands

- `/create-trd` - Create Technical Requirements Document
- `/implement-trd` - Implement TRD with task tracking
- `/fold-prompt` - Project optimization
- `/dashboard` - View release metrics

## References

- **Agent Definition**: agents/yaml/release-agent.yaml
- **Handoff Contracts**: docs/architecture/release-agent-handoffs.md
- **State Machine**: docs/architecture/release-workflow-state-machine.md
- **Smoke Test Framework**: docs/architecture/smoke-test-framework.md
- **TRD**: docs/TRD/release-command-system-trd.md

---

**Version**: 1.0.0
**Last Updated**: 2025-11-05
**Maintainer**: Fortium Software Configuration Team