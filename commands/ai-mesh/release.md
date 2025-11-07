# /release - CI/CD-Aware NPM Release Workflow

**Version**: 2.0.0
**Category**: Deployment
**Agent**: release-agent
**Last Updated**: 2025-11-07

## Overview

The `/release` command orchestrates NPM package releases as a **Release Readiness Gate** that prepares releases for CI/CD automation. Unlike traditional deployment commands that manually push to production, this workflow:

- **Validates release readiness** through comprehensive pre-CI quality gates
- **Creates release PRs** that automatically trigger GitHub Actions workflows
- **Monitors CI/CD pipelines** in real-time (npm-release.yml, ci-cd.yml, test.yml)
- **Verifies NPM package availability** after automated publish on PR merge
- **Generates release artifacts** including reports, audit logs, and metrics

**Key Philosophy**: This command does NOT manually deploy or publish packages. It prepares releases for automation, with GitHub Actions handling all deployment steps after PR merge approval.

**Total Time**: ~30 minutes (8min local work + 20min CI/CD monitoring + 5min post-merge validation)

---

## Quick Start

### Standard Release
```bash
/release --version 2.1.0
```

Executes complete release workflow:
1. Creates release branch with changelog and version bump
2. Runs comprehensive pre-CI validation (security, DoD, dependencies)
3. Creates PR that triggers GitHub Actions workflows
4. Monitors CI/CD execution in real-time
5. After manual PR merge, verifies NPM package publish

### Hotfix Release
```bash
/release --version 2.1.1 --type hotfix
```

Expedited workflow for critical fixes:
- Streamlined pre-CI validation (3min vs 5min)
- Expedited review process
- Automated backport to develop branch

### Custom Base Branch
```bash
/release --version 2.1.0 --from develop --to release/v2.1.0
```

---

## Release Workflow

### Phase 1: Release Initialization (2 minutes)

**Purpose**: Prepare release branch with version updates and changelog

#### Step 1: Version Validation (30 seconds)
- Parse `--version` argument and validate semantic versioning format (X.Y.Z)
- Utilize `semantic-version-validator` skill for format checking
- Check for version conflicts (existing tags or branches)
- **Blocks on**: Invalid format, existing version conflict

#### Step 2: Release Type Validation (10 seconds)
- Parse `--type` argument (standard or hotfix)
- Determine base branch:
  - **standard**: `main`
  - **hotfix**: `production`
- Determine target branch:
  - **standard**: `release/vX.Y.Z`
  - **hotfix**: `hotfix/vX.Y.Z`
- Validate custom branch arguments if provided

#### Step 3: Release Branch Creation (30 seconds)
- **Delegates to**: `git-workflow` agent
- Create release branch from base branch
- Push to remote repository
- Verify successful branch creation
- **Blocks on**: Branch creation failure, push failure

#### Step 4: Changelog Generation (1 minute)
- **Skill**: `changelog-generator`
- Parse commits since last release tag
- Categorize changes:
  - **Breaking Changes**: Major version updates
  - **New Features**: Minor version updates
  - **Enhancements**: Improvements to existing features
  - **Bug Fixes**: Patch version updates
- Generate markdown-formatted CHANGELOG.md
- Commit changelog to release branch

#### Step 5: Version Bump in package.json (30 seconds)
- **Delegates to**: `git-workflow` agent
- Update `version` field in package.json
- Commit with conventional format: `chore(release): bump version to X.Y.Z`
- Push to remote
- **Blocks on**: package.json not found, commit failure

**Phase Output**: Release branch created with updated version and changelog

---

### Phase 2: Local Quality Gates (Pre-CI Validation) (5 minutes)

**Purpose**: Fast local validation to catch issues before triggering expensive CI/CD pipelines

#### Step 1: Quick Security Pre-Scan (2 minutes, timeout: 5 minutes)
- **Delegates to**: `code-reviewer` agent
- Execute fast security scan focusing on OWASP Top 10 vulnerabilities
- Check for critical and high-severity issues only (deep scan deferred to CI/CD)
- **Blocks on**: Critical or high-severity security findings

#### Step 2: Definition of Done Validation (2 minutes, timeout: 5 minutes)
- **Delegates to**: `code-reviewer` agent
- Validate all 8 DoD categories:
  1. **Scope**: TRD updated, acceptance criteria met
  2. **Code Quality**: Style guides followed, no code smells
  3. **Testing**: Unit ≥80%, integration ≥70%, E2E coverage
  4. **Security**: Inputs validated, secrets safe, authZ/authN enforced
  5. **Performance**: Meets performance budget
  6. **Documentation**: PR clear, CHANGELOG updated, runbooks adjusted
  7. **Deployment**: CI/CD ready, rollback plan documented
  8. **Process**: Tickets updated, stakeholders notified
- Focus on critical categories for fast validation
- **Blocks on**: Any category failure

#### Step 3: Version Consistency Check (10 seconds)
- Read package.json `version` field
- Compare with `--version` argument
- **Blocks on**: Version mismatch

#### Step 4: CHANGELOG.md Verification (10 seconds)
- Check CHANGELOG.md file exists
- Verify recent updates detected (git diff)
- **Blocks on**: CHANGELOG.md not updated

#### Step 5: Uncommitted Changes Detection (10 seconds)
- Run `git status` to check working tree
- Detect uncommitted or unstaged changes
- **Blocks on**: Working tree not clean

#### Step 6: Dependencies Audit (30 seconds)
- Run `npm audit --audit-level=high`
- Check for high-severity vulnerabilities in dependencies
- **Blocks on**: High-severity vulnerability findings

**Phase Output**: Pre-CI validation report with all checks passed

---

### Phase 3: PR Creation & CI/CD Trigger (1 minute)

**Purpose**: Create pull request that automatically triggers GitHub Actions workflows

#### Step 1: Create Release Pull Request (1 minute)
- **Delegates to**: `github-specialist` agent
- Create PR from release branch to main
- **PR Body Includes**:
  - Release summary from generated changelog
  - Pre-CI validation results (all checks passed)
  - CI/CD workflow expectations (npm-release.yml, ci-cd.yml, test.yml)
  - Links to release artifacts
- **PR Metadata**:
  - Labels: `release`, version type (`major`/`minor`/`patch`), `npm-package`
  - Reviewers: tech-lead, product-manager
- **Auto-triggers GitHub Actions**:
  - npm-release.yml (NPM Release Pipeline)
  - ci-cd.yml (CI/CD Pipeline)
  - test.yml (Test Suite)

**Phase Output**:
- PR URL
- PR number
- Reviewer assignments confirmed
- CI/CD workflows triggered automatically

---

### Phase 4: CI/CD Monitoring (20 minutes)

**Purpose**: Real-time monitoring of GitHub Actions workflows with progress reporting

#### Step 1: Monitor npm-release.yml Workflow (18 minutes, timeout: 30 minutes)
- **Poll Interval**: 30 seconds
- **Actions Tracked**:
  - Cross-platform tests (Ubuntu, Windows, macOS)
  - Node version compatibility tests (18.x, 20.x)
  - Security audit execution
  - Package build validation
  - Installation tests
- **Real-time Progress**: Report workflow status, test results, failures
- **Blocks on**: Workflow failure

**Workflow Deliverables**:
- Cross-platform test results (all platforms)
- Security audit report
- Package tarball (built but not published yet)
- Installation validation results

#### Step 2: Monitor ci-cd.yml Workflow (7 minutes, timeout: 15 minutes)
- **Poll Interval**: 30 seconds
- **Actions Tracked**:
  - Agent configuration validation
  - Command configuration validation
  - Hook syntax validation
  - Security scanning (Trivy)
  - Installation tests
- **Real-time Progress**: Report validation results, security findings
- **Blocks on**: Workflow failure

**Workflow Deliverables**:
- Configuration validation results
- Security scan results (Trivy)
- Installation test results

#### Step 3: Monitor test.yml Workflow (7 minutes, timeout: 15 minutes)
- **Poll Interval**: 30 seconds
- **Actions Tracked**:
  - Unit tests execution (target: ≥80% coverage)
  - Integration tests execution (target: ≥70% coverage)
  - CLI tests execution
  - API tests execution
- **Real-time Progress**: Report test results, coverage metrics, failures
- **Blocks on**: Workflow failure

**Workflow Deliverables**:
- Unit test results with coverage
- Integration test results with coverage
- CLI test results
- API test results

#### Step 4: Validate All Workflows Passed (1 minute)
- Check all three workflows completed successfully
- **Blocks on**: Any workflow failure
- Extract error context from failed workflows
- Link to failed workflow runs for debugging

**Phase Output**: Complete CI/CD execution report with all workflows passed

---

### Phase 5: Release Artifacts (2 minutes)

**Purpose**: Generate release documentation and tracking artifacts

#### Step 1: Generate Release Report (1 minute)
- **Skill**: `release-report-generator`
- Compile comprehensive release summary:
  - Pre-CI validation results (6 checks passed)
  - CI/CD execution results (3 workflows, all passed)
  - Timing metrics (local work + CI/CD execution)
  - Links to PR, workflow runs, artifacts
- Save to `docs/releases/vX.Y.Z-report.md`

#### Step 2: Append Audit Log (30 seconds)
- **Skill**: `audit-log-generator`
- Record release event in audit log:
  - Pre-CI validation tracking
  - CI/CD execution tracking
  - PR creation and workflow triggers
  - Release artifacts links
- Append to `docs/audit/release-audit.log`

#### Step 3: Update Tickets (30 seconds)
- Update Linear/Jira ticket status to `ready-for-merge`
- Attach release report
- Link to PR and CI/CD workflow runs
- Add pre-CI validation summary

#### Step 4: Send Release Metrics (30 seconds)
- **Delegates to**: `manager-dashboard-agent`
- Report metrics:
  - Release cycle time (initialization to CI/CD complete)
  - CI/CD execution status (all workflows passed)
  - Pre-CI validation metrics (6/6 checks passed)
  - Workflow timing metrics (npm-release: 18min, ci-cd: 7min, test: 7min)

**Phase Output**: Complete release documentation and audit trail

---

### Phase 6: Post-Merge Validation (5 minutes)

**Trigger**: Manual after PR approval and merge to main
**Purpose**: Verify NPM package publish and availability

#### Step 1: Monitor NPM Publish Workflow (5 minutes, timeout: 10 minutes)
- **Poll Interval**: 30 seconds
- Wait for NPM Release Pipeline to trigger (push to main)
- **Actions Tracked**:
  - Version change detection in package.json
  - NPM publish operation
  - GitHub release creation
- **Real-time Progress**: Report publish status, errors
- **Blocks on**: Workflow failure, publish failure

#### Step 2: Verify NPM Package Availability (2 minutes, timeout: 5 minutes)
- Wait 60 seconds for NPM propagation
- Check package availability: `npm view @fortium/ai-mesh@X.Y.Z`
- Verify version matches release version
- **Blocks on**: Package not available, version mismatch

#### Step 3: Execute Final Smoke Tests (2 minutes, timeout: 5 minutes)
- Test NPX installation: `npx @fortium/ai-mesh@X.Y.Z --version`
- Test CLI help: `npx @fortium/ai-mesh@X.Y.Z --help`
- Test validation: `npx @fortium/ai-mesh@X.Y.Z validate`
- **Blocks on**: Any smoke test failure

#### Step 4: Verify GitHub Release Created (1 minute)
- Check GitHub release via API: `gh release view vX.Y.Z`
- Extract release URL
- Report completion with URLs:
  - NPM package URL: `https://www.npmjs.com/package/@fortium/ai-mesh/v/X.Y.Z`
  - GitHub release URL: `https://github.com/FortiumPartners/claude-config/releases/tag/vX.Y.Z`

#### Step 5: Update Tickets (Release Complete) (30 seconds)
- Update ticket status to `released`
- Add NPM package URL
- Add GitHub release URL
- Add release completion timestamp

**Phase Output**: Release completion confirmation with NPM and GitHub URLs

---

## Arguments

### Required Arguments

#### `--version`
- **Type**: string
- **Format**: `X.Y.Z` (semantic versioning)
- **Description**: Semantic version for the release
- **Validation**:
  - Matches semantic versioning format (major.minor.patch)
  - No conflicts with existing tags or branches
- **Example**: `--version 2.1.0`

### Optional Arguments

#### `--type`
- **Type**: enum
- **Values**: `standard`, `hotfix`
- **Default**: `standard`
- **Description**: Release type determines workflow optimizations
  - **standard**: Full validation, normal review process
  - **hotfix**: Streamlined validation, expedited review
- **Example**: `--type hotfix`

#### `--from`
- **Type**: string
- **Description**: Base branch for release (overrides default)
- **Default**:
  - `main` (for standard releases)
  - `production` (for hotfix releases)
- **Example**: `--from develop`

#### `--to`
- **Type**: string
- **Description**: Target branch for release (overrides default)
- **Default**:
  - `release/vX.Y.Z` (for standard releases)
  - `hotfix/vX.Y.Z` (for hotfix releases)
- **Example**: `--to release/v2.1.0`

#### `--base`
- **Type**: string
- **Description**: Alias for `--from` (base branch)
- **Example**: `--base main`

#### `--target`
- **Type**: string
- **Description**: Alias for `--to` (target branch)
- **Example**: `--target release/v2.1.0`

#### `--dry-run`
- **Type**: boolean
- **Description**: Simulate release workflow without mutations (future enhancement)
- **Status**: Not yet implemented
- **Example**: `--dry-run`

---

## Examples

### Example 1: Standard NPM Package Release

```bash
/release --version 2.1.0
```

**What Happens**:
1. Creates `release/v2.1.0` branch from `main`
2. Generates CHANGELOG.md from commits since last release
3. Updates package.json version to `2.1.0`
4. Runs comprehensive pre-CI validation (6 checks, 5 minutes)
5. Creates PR that triggers 3 GitHub Actions workflows
6. Monitors workflows in real-time (~20 minutes)
7. Generates release artifacts (report, audit log, metrics)
8. After manual PR merge, verifies NPM package publish
9. Runs smoke tests and confirms GitHub release

**Total Time**: ~35 minutes (8min local + 20min CI/CD + 5min post-merge + 2min artifacts)

### Example 2: Hotfix Release

```bash
/release --version 2.1.1 --type hotfix
```

**What Happens**:
1. Creates `hotfix/v2.1.1` branch from `production`
2. Generates CHANGELOG.md (bug fixes only)
3. Updates package.json version to `2.1.1`
4. Runs streamlined pre-CI validation (3 minutes instead of 5)
5. Creates PR with expedited review labels
6. Monitors workflows (~15 minutes with parallel execution)
7. Generates release artifacts
8. After merge, verifies NPM publish and runs smoke tests
9. **Automated backport** to `develop` branch

**Total Time**: ~26 minutes (expedited workflow)

### Example 3: Release from Custom Base Branch

```bash
/release --version 2.1.0 --from develop --to release/v2.1.0
```

**What Happens**:
1. Creates `release/v2.1.0` branch from `develop` (custom base)
2. Standard workflow proceeds as normal
3. Useful for release train workflows or feature branch releases

### Example 4: Dry Run Simulation (Future)

```bash
/release --version 2.1.0 --dry-run
```

**What Would Happen** (when implemented):
1. Simulates entire workflow without mutations
2. Reports what actions would be taken
3. Validates version, checks branches exist
4. Does NOT create branches, PRs, or trigger CI/CD
5. Useful for testing release process changes

---

## CI/CD Integration

### GitHub Actions Workflows

#### 1. npm-release.yml (NPM Release Pipeline)
- **Trigger**: PR creation to `main` branch
- **Execution Time**: ~18 minutes
- **Platforms**: Ubuntu, Windows, macOS
- **Node Versions**: 18.x, 20.x
- **Deliverables**:
  - Cross-platform test results (6 combinations)
  - Security audit report (npm audit)
  - Package tarball (built but not published)
  - Installation validation results

**Quality Gates**:
- All tests pass on all platforms
- All Node versions pass compatibility tests
- Security audit shows no high-severity vulnerabilities
- Package builds successfully

#### 2. ci-cd.yml (CI/CD Pipeline)
- **Trigger**: PR creation to `main` branch
- **Execution Time**: ~7 minutes
- **Deliverables**:
  - Agent configuration validation results
  - Command configuration validation results
  - Hook syntax validation results
  - Security scan results (Trivy)
  - Installation test results

**Quality Gates**:
- All YAML configurations valid
- All hooks pass syntax validation
- Trivy security scan passes (no critical vulnerabilities)
- Installation succeeds on test environment

#### 3. test.yml (Test Suite)
- **Trigger**: PR creation to `main` branch
- **Execution Time**: ~7 minutes
- **Deliverables**:
  - Unit test results with coverage (target: ≥80%)
  - Integration test results with coverage (target: ≥70%)
  - CLI test results
  - API test results

**Quality Gates**:
- Unit test coverage ≥80%
- Integration test coverage ≥70%
- All CLI tests pass
- All API tests pass

### Post-Merge Automation

#### Auto NPM Publish (npm-release.yml)
- **Trigger**: Push to `main` with version change in package.json
- **Execution Time**: ~5 minutes
- **Deliverables**:
  - NPM package published to registry (@fortium/ai-mesh)
  - GitHub release created (with changelog)
  - Post-release validation results

**Quality Gates**:
- Version change detected correctly
- NPM publish succeeds
- GitHub release created successfully
- Package available on NPM registry

---

## Success Criteria

A release is considered **successful** when ALL of the following are true:

### Pre-CI Validation ✓
- [ ] Security pre-scan passes (zero critical/high severity issues)
- [ ] All 8 DoD categories pass
- [ ] package.json version matches `--version` argument
- [ ] CHANGELOG.md updated with recent commits
- [ ] Working tree clean (no uncommitted changes)
- [ ] npm audit shows no high-severity vulnerabilities

### PR Creation & CI/CD ✓
- [ ] Release PR created successfully
- [ ] PR includes comprehensive release information
- [ ] Reviewers assigned (tech-lead, product-manager)
- [ ] All three GitHub Actions workflows triggered automatically

### CI/CD Execution ✓
- [ ] npm-release.yml passes (cross-platform tests, security audit, package build)
- [ ] ci-cd.yml passes (configuration validation, security scanning)
- [ ] test.yml passes (unit ≥80%, integration ≥70%, CLI/API tests)

### Release Artifacts ✓
- [ ] Release report generated and saved
- [ ] Audit log entry appended
- [ ] Tickets updated with `ready-for-merge` status
- [ ] Metrics sent to manager dashboard

### Post-Merge Validation ✓
- [ ] PR manually approved and merged to main
- [ ] NPM publish workflow succeeds
- [ ] NPM package available on registry (@fortium/ai-mesh@X.Y.Z)
- [ ] All smoke tests pass (npx installation, --version, --help, validate)
- [ ] GitHub release created (vX.Y.Z)
- [ ] Tickets updated with `released` status

---

## Failure Criteria & Recovery

### Pre-CI Validation Failures

**When**: Any pre-CI validation check fails
**Recovery**:
1. Review failure details in command output
2. Fix issues in working tree
3. Re-run `/release` command
4. Delete failed release branch if needed: `git branch -D release/vX.Y.Z`

**Common Issues**:
- Security findings: Fix vulnerabilities, update dependencies
- DoD failures: Complete missing documentation, tests, or requirements
- Version mismatch: Update package.json version manually
- CHANGELOG not updated: Manually update or re-run changelog-generator
- Uncommitted changes: Commit or stash changes
- Dependencies audit: Update vulnerable dependencies

### CI/CD Workflow Failures

**When**: Any GitHub Actions workflow fails
**Recovery**:
1. Review workflow run logs on GitHub
2. Fix issues in release branch
3. Push fixes to release branch
4. CI/CD workflows re-run automatically on push
5. Continue monitoring with `/release` command

**Common Issues**:
- Test failures: Fix failing tests, push updates
- Security scan failures: Fix Trivy findings, update dependencies
- Configuration errors: Fix YAML syntax, validate schemas
- Build failures: Fix build scripts, update dependencies

### NPM Publish Failures

**When**: NPM publish workflow fails after PR merge
**Recovery**:
1. Review npm-release.yml workflow logs
2. Check NPM registry status (npmjs.com)
3. Verify NPM_TOKEN secret is valid
4. Re-trigger workflow manually if needed: `gh workflow run npm-release.yml`

**Common Issues**:
- NPM token expired: Update NPM_TOKEN secret in GitHub
- Version already published: Increment version and re-release
- Network errors: Re-trigger workflow
- Package name conflicts: Verify package scope and name

### Smoke Test Failures

**When**: NPM package available but smoke tests fail
**Recovery**:
1. Manually test package: `npx @fortium/ai-mesh@X.Y.Z --version`
2. Review installation logs
3. If package is broken, publish hotfix immediately
4. Optionally deprecate broken version: `npm deprecate @fortium/ai-mesh@X.Y.Z "Broken release, use X.Y.Z+1"`

---

## Timing Budget

### Standard Release (30 minutes local + 20 minutes CI/CD)

| Phase | Target Time | Timeout |
|-------|------------|---------|
| Release Initialization | 2 minutes | 5 minutes |
| Pre-CI Validation | 5 minutes | 10 minutes |
| PR Creation | 1 minute | 2 minutes |
| CI/CD Monitoring | 20 minutes (parallel workflows) | 30 minutes |
| Release Artifacts | 2 minutes | 5 minutes |
| **Total (Local Work)** | **30 minutes** | - |
| Post-Merge Validation | 5 minutes | 10 minutes |
| **Grand Total** | **35 minutes** | - |

### Hotfix Release (26 minutes total)

| Phase | Target Time | Timeout |
|-------|------------|---------|
| Release Initialization | 2 minutes | 5 minutes |
| Pre-CI Validation (Streamlined) | 3 minutes | 7 minutes |
| PR Creation | 1 minute | 2 minutes |
| CI/CD Monitoring (Expedited) | 15 minutes (parallel workflows) | 25 minutes |
| Release Artifacts | 2 minutes | 5 minutes |
| **Total (Local Work)** | **23 minutes** | - |
| Post-Merge Validation | 3 minutes | 7 minutes |
| **Grand Total** | **26 minutes** | - |

---

## Notes & Best Practices

### CI/CD Philosophy
This release command is a **Release Readiness Gate** that prepares releases for CI/CD automation. It does NOT manually deploy or publish packages. GitHub Actions handles all deployment automation after PR merge.

**Key Principle**: Human oversight through manual PR review and merge, automated execution for all build/test/publish steps.

### Manual PR Merge Requirement
After all CI/CD workflows pass, the PR must be **manually reviewed and merged** by a human. This ensures:
- Technical review of changes
- Product/business approval
- Security sign-off
- Release timing control

The merge to `main` automatically triggers NPM publish workflow (no manual intervention needed).

### NPM Package Scope
This command is designed for **NPM package releases** (@fortium/ai-mesh), not traditional service deployments. Concepts that do NOT apply:
- Staging/production environments (NPM only has one registry)
- Canary deployments (users install specific versions)
- Traffic splitting (no runtime traffic to split)
- Blue/green deployments (no running services)

### Rollback Strategy
NPM packages cannot be "rolled back" in the traditional sense. Once published, a version is permanent. Recovery strategies:
1. **Publish hotfix**: Increment patch version and publish fixed release
2. **Deprecate version**: `npm deprecate @fortium/ai-mesh@X.Y.Z "Message"`
3. **Communicate to users**: Update documentation, send notifications

**Prevention is key**: Comprehensive pre-CI validation and CI/CD testing minimize bad releases.

### Hotfix Workflow Differences
Hotfix releases use the same CI/CD workflows but with optimizations:
- **Streamlined pre-CI**: 3min vs 5min (security pre-scan only, skip some DoD checks)
- **Expedited review**: Auto-assign tech-lead for fast approval
- **Automated backport**: Merge to `develop` branch automatically post-release
- **Faster CI/CD**: Parallel workflows with reduced timeouts

**When to use hotfix**:
- Critical production bugs
- Security vulnerabilities
- Data loss/corruption issues
- Major functionality broken

### Monitoring Best Practices
- Use GitHub workflow UI for detailed logs
- Set up GitHub notifications for workflow failures
- Monitor NPM package downloads post-release
- Track user-reported issues after release

### Security Considerations
- All secrets stored in GitHub Secrets (NPM_TOKEN)
- Security scanning at multiple stages (pre-CI, CI/CD)
- Dependency audit before every release
- Trivy container scanning for infrastructure
- No credentials in code or logs

---

## Related Commands

- `/create-trd` - Generate Technical Requirements Document for release planning
- `/implement-trd` - Implement TRD tasks before release
- `/dashboard` - View release metrics and team productivity
- `/hotfix` - Execute hotfix workflow (alias for `/release --type hotfix`)

---

## Additional Resources

- [Semantic Versioning 2.0.0](https://semver.org/) - Version numbering guidelines
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message format
- [NPM Publishing Guide](https://docs.npmjs.com/cli/v8/commands/npm-publish) - NPM package publishing
- [GitHub Actions](https://docs.github.com/en/actions) - CI/CD workflow documentation
- [AgentOS Release Standards](../../docs/agentos/RELEASE.md) - Internal release guidelines

---

_Generated from release.yaml v2.0.0 - CI/CD-Aware NPM Release Workflow_