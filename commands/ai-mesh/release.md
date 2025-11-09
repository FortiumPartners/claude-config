# /release - Generic CI/CD-Agnostic Release Workflow

**Version**: 3.0.0
**Category**: Deployment
**Agent**: release-agent
**Last Updated**: 2025-11-07

## Overview

The `/release` command orchestrates a **generic, CI/CD-agnostic release readiness workflow** that works with any Git-integrated CI/CD system. Unlike traditional deployment commands that manually deploy or publish, this workflow:

- **Validates release readiness** through comprehensive pre-CI quality gates (tests, docs, version consistency)
- **Creates release PRs** that automatically trigger CI/CD workflows via Git integration
- **Optionally monitors CI/CD pipelines** in real-time via Git provider APIs (if available)
- **Verifies release completion** after PR merge (optional, registry-specific)
- **Generates release artifacts** including reports, audit logs, and metrics

**Key Philosophy**: This command is a **Release Readiness Gate** that prepares releases for CI/CD automation. It does NOT manually deploy, publish, or handle platform-specific operations. All deployment automation is delegated to your CI/CD system after PR merge approval.

**Universal Compatibility**:
- **CI/CD Systems**: GitHub Actions, GitLab CI, Jenkins, CircleCI, Travis CI, Azure Pipelines, Bitbucket Pipelines, and more
- **Project Types**: NPM packages, Docker images, Maven artifacts, Python packages (PyPI), Ruby gems, Go modules, Rust crates, C# NuGet packages, PHP Composer packages, Elixir Hex packages
- **Git Providers**: GitHub, GitLab, Bitbucket, Azure DevOps, and any Git-based platform

**Total Time**: ~15 minutes local work + CI/CD execution (async, automatic)

---

## Quick Start

### Standard Release (Any Project Type)

```bash
/release --version 2.1.0
```

**Works with any project type**:
- **NPM**: Updates `package.json`, publishes to npmjs.com
- **Docker**: Updates version tags, pushes to Docker Hub/registry
- **Maven**: Updates `pom.xml`, deploys to Maven Central/Nexus
- **Python**: Updates `pyproject.toml`, publishes to PyPI
- **Ruby**: Updates `.gemspec`, pushes gem to RubyGems.org
- **Go**: Creates Git tags, triggers Go module registry
- **Rust**: Updates `Cargo.toml`, publishes to crates.io
- **C#**: Updates `.csproj`, pushes NuGet package
- **PHP**: Updates `composer.json`, publishes to Packagist
- **Elixir**: Updates `mix.exs`, publishes to Hex.pm

**Executes workflow**:
1. Creates release branch with changelog and version bump
2. Runs comprehensive pre-CI validation (tests, docs, security)
3. Creates PR that triggers CI/CD workflows automatically
4. Optionally monitors CI/CD execution in real-time
5. After manual PR merge, optionally verifies artifact publication

### Hotfix Release (Fast-Track)

```bash
/release --version 2.1.1 --type hotfix
```

**Expedited workflow for critical fixes**:
- Streamlined pre-CI validation (5min vs 10min)
- Expedited review process with fast-track labels
- Automated backport to develop branch
- Total time: ~7 minutes local work + CI/CD (async)

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
  - **standard**: `main` or `master`
  - **hotfix**: `main`/`master` or `production` (project-specific)
- Determine target branch:
  - **standard**: `release/vX.Y.Z`
  - **hotfix**: `hotfix/vX.Y.Z`

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

#### Step 5: Version File Updates (30 seconds)
- **Delegates to**: `git-workflow` agent
- Update project-specific version files:
  - **NPM**: `package.json` (`version` field)
  - **Maven**: `pom.xml` (`<version>` tag)
  - **Python**: `pyproject.toml` (`version` field)
  - **Ruby**: `.gemspec` (`version` field)
  - **Go**: `go.mod` (Git tags only)
  - **Rust**: `Cargo.toml` (`version` field)
  - **C#**: `.csproj` (`<Version>` tag)
  - **PHP**: `composer.json` (`version` field)
  - **Elixir**: `mix.exs` (`@version` attribute)
- Commit with conventional format: `chore(release): bump version to X.Y.Z`
- Push to remote
- **Blocks on**: Version file not found, commit failure

**Phase Output**: Release branch created with updated version and changelog

---

### Phase 2: Local Quality Gates (Pre-CI Validation) (10 minutes)

**Purpose**: Fast local validation to catch issues before triggering expensive CI/CD pipelines

#### Step 1: Test Validation (5 minutes, timeout: 10 minutes)
- **Delegates to**: `test-runner` agent
- Run unit tests (target ≥80% coverage)
- Run integration tests (target ≥70% coverage)
- **Blocks on**: Test failures

#### Step 2: Documentation Validation (2 minutes)
- Verify CHANGELOG.md updated
- Verify README.md current
- Verify API docs up-to-date (if applicable)
- **Blocks on**: Documentation not current

#### Step 3: Version Consistency Check (1 minute)
- Read all version files (project-specific)
- Compare with release version argument
- **Blocks on**: Version mismatch

#### Step 4: Code Quality Validation (2 minutes)
- **Delegates to**: `code-reviewer` agent
- Run linting checks (ESLint, Pylint, RuboCop, etc.)
- Execute security pre-scan (critical checks only)
- **Blocks on**: Critical issues

#### Step 5: Working Tree Validation (10 seconds)
- Run `git status`
- Check for uncommitted changes
- **Blocks on**: Working tree not clean (except version bump/changelog)

**Phase Output**: Pre-CI validation report with all checks passed

---

### Phase 3: PR Creation & CI/CD Trigger (1 minute)

**Purpose**: Create pull request that automatically triggers CI/CD workflows

#### Step 1: Create Release Pull Request (1 minute)
- **Delegates to**: `github-specialist` agent
- Create PR with comprehensive release information:
  - Release summary from generated changelog
  - Validation results from pre-CI checks
  - CI/CD expectations (generic, system-agnostic)
  - Links to release artifacts
- Add labels (release, version type)
- Assign reviewers (tech-lead, product-manager)
- **Auto-triggers CI/CD workflows** via Git integration (push events, PR events)

**Phase Output**:
- PR URL
- PR number
- Assigned reviewers confirmation
- CI/CD workflows triggered automatically

---

### Phase 4: CI/CD Monitoring (Optional, 15-30 minutes)

**Purpose**: Track CI/CD pipeline execution in real-time (if Git provider APIs available)

#### Step 1: Detect Git Provider and APIs (10 seconds)
- Identify Git provider (GitHub, GitLab, Bitbucket, etc.)
- Check for available status APIs
- Skip monitoring if APIs not available

#### Step 2: Monitor CI/CD Pipelines (Varies, timeout: 60 minutes)
- Poll CI/CD status via Git provider API (if available)
- Poll interval: 30 seconds
- Track test results, build status, deployment status
- Report progress in real-time
- Link to pipeline UI for detailed status
- **Fallback**: Check Git provider UI for pipeline status if monitoring unavailable

#### Step 3: Validate Pipeline Completion (1 minute)
- Ensure all CI/CD checks succeeded
- Report any failures with links to failed pipeline runs
- Extract error context from failed pipelines

**Phase Output**: Complete CI/CD execution report (if monitored) or instructions for manual checking

---

### Phase 5: Release Artifacts (2 minutes)

**Purpose**: Generate release documentation and tracking artifacts

#### Step 1: Generate Release Report (1 minute)
- **Skill**: `release-report-generator`
- Compile release summary:
  - Pre-CI validation results
  - CI/CD execution results (if monitored)
  - Timing metrics (local work + CI/CD execution)
  - Links to PR, CI/CD pipelines, artifacts

#### Step 2: Append Audit Log (30 seconds)
- **Skill**: `audit-log-generator`
- Record release event in audit log:
  - Validation tracking
  - CI/CD execution tracking (if monitored)
  - PR creation
  - Release artifacts links

#### Step 3: Update Tickets (30 seconds)
- Update Linear/Jira ticket status to `ready_for_merge`
- Attach release report
- Link to PR and CI/CD pipelines (if monitored)
- Add validation results

#### Step 4: Send Release Metrics (30 seconds)
- **Delegates to**: `manager-dashboard-agent`
- Report metrics:
  - Release cycle time
  - Validation execution status
  - CI/CD monitoring results (if applicable)
  - Timing metrics

**Phase Output**: Complete release documentation and audit trail

---

### Phase 6: Post-Merge Validation (Optional, Registry-Specific)

**Trigger**: Manual after PR approval and merge to main/master
**Purpose**: Confirm artifact published to registry (only if project has registry publishing)

#### Step 1: Detect Registry Publishing (10 seconds)
- Identify registry type (npm, docker, maven, pypi, none)
- Skip post-merge validation if no registry publishing

#### Step 2: Monitor Publishing Workflow (5-10 minutes, timeout: 15 minutes)
- Wait for publishing workflow to trigger (push to main/master)
- Monitor workflow execution via CI/CD API (if available)
- Track publishing operation
- Report progress in real-time
- **Fallback**: Check Git provider UI if monitoring unavailable

#### Step 3: Verify Registry Availability (1-3 minutes, timeout: 5 minutes)
- Wait for registry propagation (varies by registry)
- Check artifact availability:
  - **NPM**: `npm view package@X.Y.Z`
  - **Docker**: `docker pull image:X.Y.Z`
  - **Maven**: `mvn dependency:get -Dartifact=group:artifact:X.Y.Z`
  - **PyPI**: `pip show package==X.Y.Z`
  - **RubyGems**: `gem list --remote --exact package --version X.Y.Z`
  - **Go**: `go list -m package@vX.Y.Z`
  - **Rust**: `cargo search package --limit 1`
  - **NuGet**: `nuget list package -Version X.Y.Z`
  - **Packagist**: `composer show package X.Y.Z`
  - **Hex**: `mix hex.info package X.Y.Z`
- Verify version matches release version
- Report availability with registry URL
- **Fallback**: Manual verification if registry API unavailable

#### Step 4: Update Tickets (Release Complete) (30 seconds)
- Update ticket status to `released`
- Add registry URL (if applicable)
- Add release completion timestamp

**Phase Output**: Release completion confirmation with registry URL (if applicable)

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
  - **hotfix**: Streamlined validation (5min vs 10min), expedited review
- **Example**: `--type hotfix`

#### `--dry-run`
- **Type**: boolean
- **Description**: Simulate release workflow without mutations (future enhancement)
- **Status**: Not yet implemented
- **Example**: `--dry-run`

---

## Examples

### Example 1: NPM Package Release

```bash
/release --version 2.1.0
```

**What Happens**:
1. Creates `release/v2.1.0` branch from `main`
2. Generates CHANGELOG.md from commits since last release
3. Updates `package.json` version to `2.1.0`
4. Runs comprehensive pre-CI validation (tests, docs, security)
5. Creates PR that triggers CI/CD workflows (GitHub Actions, GitLab CI, etc.)
6. Optionally monitors workflows in real-time
7. After manual PR merge, verifies NPM package published
8. Confirms package availability: `npm view @your-org/package@2.1.0`

**Total Time**: ~15 minutes local work + CI/CD execution (async)

### Example 2: Docker Image Release

```bash
/release --version 2.1.0
```

**What Happens**:
1. Creates `release/v2.1.0` branch from `main`
2. Generates CHANGELOG.md
3. Updates Dockerfile version label or version file
4. Runs pre-CI validation (build tests, security scan)
5. Creates PR that triggers CI/CD workflows
6. CI/CD builds Docker image and pushes to registry
7. After merge, verifies image availability: `docker pull your-org/image:2.1.0`

**Total Time**: ~15 minutes local work + CI/CD execution (async)

### Example 3: Maven/Java Library Release

```bash
/release --version 2.1.0
```

**What Happens**:
1. Creates `release/v2.1.0` branch from `main`
2. Generates CHANGELOG.md
3. Updates `pom.xml` version to `2.1.0`
4. Runs pre-CI validation (unit tests, integration tests)
5. Creates PR that triggers CI/CD workflows (Jenkins, GitLab CI, etc.)
6. CI/CD builds JAR and deploys to Maven Central/Nexus
7. After merge, verifies artifact availability: `mvn dependency:get`

**Total Time**: ~15 minutes local work + CI/CD execution (async)

### Example 4: Python Package Release (PyPI)

```bash
/release --version 2.1.0
```

**What Happens**:
1. Creates `release/v2.1.0` branch from `main`
2. Generates CHANGELOG.md
3. Updates `pyproject.toml` version to `2.1.0`
4. Runs pre-CI validation (pytest, coverage)
5. Creates PR that triggers CI/CD workflows
6. CI/CD builds wheel and publishes to PyPI
7. After merge, verifies package availability: `pip show package==2.1.0`

**Total Time**: ~15 minutes local work + CI/CD execution (async)

### Example 5: Hotfix Release (Fast-Track)

```bash
/release --version 2.1.1 --type hotfix
```

**What Happens**:
1. Creates `hotfix/v2.1.1` branch from `main`
2. Generates CHANGELOG.md (bug fixes only)
3. Updates version files
4. Runs streamlined pre-CI validation (5min vs 10min)
5. Creates PR with expedited review labels
6. CI/CD workflows execute (faster with parallel execution)
7. After merge, verifies artifact published
8. **Automated backport** to `develop` branch

**Total Time**: ~7 minutes local work + CI/CD execution (async)

### Example 6: Dry Run Simulation (Future)

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

### Trigger Mechanism

**How it works**:
- PR creation automatically triggers CI/CD workflows via Git provider integration
- Git push events and PR events activate CI/CD pipelines
- No manual intervention required for CI/CD triggering
- Fully automated, works with any Git-integrated CI/CD system

**Compatible CI/CD Systems**:
- GitHub Actions
- GitLab CI
- Jenkins
- CircleCI
- Travis CI
- Azure Pipelines
- Bitbucket Pipelines
- TeamCity
- Bamboo
- And any other Git-integrated CI/CD system

### Monitoring (Optional)

**Availability**: Depends on Git provider API availability
- **GitHub**: GitHub Actions API (full support)
- **GitLab**: GitLab CI API (full support)
- **Bitbucket**: Bitbucket Pipelines API (full support)
- **Jenkins**: Jenkins API (requires configuration)
- **CircleCI**: CircleCI API (full support)
- **Others**: May require custom integration or manual checking

**Fallback**: If monitoring APIs not available, users check CI/CD status in Git provider UI

### Post-Merge Automation

**Trigger**: Merge to main/master automatically triggers deployment workflows
**Deliverables** (delegated to CI/CD):
- Build artifacts (JARs, wheels, binaries, etc.)
- Registry publishing:
  - NPM packages (npm publish)
  - Docker images (docker push)
  - Maven artifacts (mvn deploy)
  - Python packages (twine upload)
  - Ruby gems (gem push)
  - Go modules (Git tags)
  - Rust crates (cargo publish)
  - NuGet packages (nuget push)
  - Composer packages (packagist)
  - Hex packages (mix hex.publish)
- Deployment to environments (staging, production)
- Smoke tests in deployed environments
- Traffic management (canary, blue-green, rolling)

**Philosophy**: All deployment automation is CI/CD responsibility, not command/agent responsibility

---

## Success Criteria

A release is considered **successful** when ALL of the following are true:

### Pre-CI Validation
- All pre-CI validation checks pass (tests, docs, version consistency, code quality)
- Working tree clean (no uncommitted changes except version bump/changelog)

### PR Creation & CI/CD
- Release PR created with comprehensive information
- CI/CD workflows triggered automatically via Git integration
- Reviewers assigned

### Release Artifacts
- Release report generated and saved
- Audit log entry appended
- Tickets updated with release information
- Metrics sent to manager dashboard

### PR Approval & Merge (Manual)
- PR approved and merged (requires human oversight)

### Optional Validations (If Applicable)
- CI/CD pipelines pass (monitored or checked manually)
- Artifact published and available in registry (if project has registry publishing)

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
- Test failures: Fix failing tests, re-run validation
- Documentation missing: Update CHANGELOG, README, API docs
- Version mismatch: Update version files manually
- Code quality issues: Fix linting errors, security findings
- Uncommitted changes: Commit or stash changes

### CI/CD Workflow Failures

**When**: Any CI/CD workflow fails (if monitored or checked manually)
**Recovery**:
1. Review workflow run logs in Git provider UI
2. Fix issues in release branch
3. Push fixes to release branch
4. CI/CD workflows re-run automatically on push
5. Continue monitoring (or check manually)

**Common Issues**:
- Test failures: Fix failing tests, push updates
- Build failures: Fix build scripts, update dependencies
- Security scan failures: Address vulnerabilities
- Configuration errors: Fix CI/CD configuration files

### Registry Publishing Failures

**When**: Registry publishing fails after PR merge (if applicable)
**Recovery**:
1. Review publishing workflow logs
2. Check registry status (npmjs.com, Docker Hub, Maven Central, etc.)
3. Verify authentication tokens/credentials are valid
4. Re-trigger workflow manually if needed

**Common Issues**:
- Authentication expired: Update registry credentials/tokens
- Version already published: Increment version and re-release
- Network errors: Re-trigger workflow
- Registry-specific issues: Check registry documentation

---

## Timing Budget

### Standard Release

| Phase | Target Time | Timeout |
|-------|------------|---------|
| Release Initialization | 2 minutes | 5 minutes |
| Pre-CI Validation | 10 minutes | 20 minutes |
| PR Creation | 1 minute | 2 minutes |
| CI/CD Monitoring (Optional) | Varies (15-30 minutes typical) | 60 minutes |
| Release Artifacts | 2 minutes | 5 minutes |
| **Total (Local Work)** | **15 minutes** | - |
| Post-Merge Validation (Optional) | Varies (5-10 minutes typical) | 15 minutes |

### Hotfix Release

| Phase | Target Time | Timeout |
|-------|------------|---------|
| Release Initialization | 2 minutes | 5 minutes |
| Pre-CI Validation (Streamlined) | 5 minutes | 10 minutes |
| PR Creation | 1 minute | 2 minutes |
| CI/CD Monitoring (Optional) | Varies | 60 minutes |
| Release Artifacts | 1 minute | 3 minutes |
| **Total (Local Work)** | **7 minutes** | - |
| Post-Merge Validation (Optional) | Varies | 10 minutes |

---

## Quality Gates

### Pre-CI Validation

- **Test Validation**: All tests pass (unit ≥80%, integration ≥70% coverage)
- **Documentation Validation**: CHANGELOG.md, README.md, API docs updated
- **Version Consistency**: All version files match release version
- **Code Quality**: Linting passes, security pre-scan clean
- **Working Tree Clean**: No uncommitted changes (except version bump/changelog)

### CI/CD Workflows (Project-Specific)

- **Automated Testing**: All tests pass (triggered by CI/CD)
- **Security Scanning**: No critical vulnerabilities (triggered by CI/CD)
- **Build Validation**: Build succeeds (triggered by CI/CD)
- **Deployment (Optional)**: Deploy succeeds (triggered by CI/CD, if applicable)

**Note**: Varies by CI/CD system and project type

### Post-Merge Validation (Optional, Registry-Specific)

- **Publishing Workflow**: Artifact published successfully (registry-specific)
- **Registry Availability**: Artifact available in registry (registry-specific)

---

## Notes & Best Practices

### CI/CD Philosophy

This release command is a **Release Readiness Gate** that prepares releases for CI/CD automation. It does NOT manually deploy or publish - CI/CD systems handle all deployment automation after PR merge. Works with any Git-integrated CI/CD system.

**Key Principle**: Human oversight through manual PR review and merge, automated execution for all build/test/publish steps.

### Manual PR Merge Requirement

After CI/CD workflows pass, the PR must be **manually reviewed and merged** by a human. This ensures:
- Technical review of changes
- Product/business approval
- Security sign-off
- Release timing control

The merge to main/master automatically triggers CI/CD deployment workflows.

### Platform and Project Agnostic

This command works with:
- **Any project type**: NPM, Docker, Maven, Python, Ruby, Go, Rust, C#, PHP, Elixir, etc.
- **Any CI/CD system**: GitHub Actions, GitLab CI, Jenkins, CircleCI, Travis CI, Azure Pipelines, Bitbucket Pipelines, etc.
- **Any Git provider**: GitHub, GitLab, Bitbucket, Azure DevOps, etc.

All platform-specific and project-specific operations are delegated to CI/CD.

### Optional Monitoring

CI/CD monitoring is optional and depends on Git provider API availability. If monitoring is not available, users can check CI/CD status in their Git provider UI. The release workflow continues regardless of monitoring availability.

### Registry-Specific Validation

Post-merge validation is optional and registry-specific. It only applies to projects that publish to registries (NPM, Docker Hub, Maven Central, PyPI, etc.). Projects without registry publishing can skip this phase entirely.

### Rollback Strategy

Rollback strategies vary by project type:
- **NPM/PyPI/RubyGems**: Cannot unpublish, publish hotfix or deprecate version
- **Docker/Container**: Retag or remove image, update deployment manifests
- **Maven**: Cannot delete from Central, publish hotfix
- **Services**: Blue-green deployment, canary rollback, traffic shifting

**Prevention is key**: Comprehensive pre-CI validation and CI/CD testing minimize bad releases.

### Hotfix Workflow Differences

Hotfix releases use the same CI/CD workflows but with optimizations:
- **Streamlined pre-CI**: 5min vs 10min (critical checks only)
- **Expedited review**: Auto-assign tech-lead for fast approval
- **Automated backport**: Merge to `develop` branch automatically post-release
- **Faster CI/CD**: Parallel workflows with reduced timeouts

**When to use hotfix**:
- Critical production bugs
- Security vulnerabilities
- Data loss/corruption issues
- Major functionality broken

### Security Considerations

- All secrets stored in Git provider secrets (NPM_TOKEN, DOCKER_PASSWORD, etc.)
- Security scanning at multiple stages (pre-CI, CI/CD)
- No credentials in code or logs
- Registry-specific authentication via CI/CD environment variables

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
- [GitHub Actions](https://docs.github.com/en/actions) - GitHub CI/CD documentation
- [GitLab CI](https://docs.gitlab.com/ee/ci/) - GitLab CI/CD documentation
- [Jenkins](https://www.jenkins.io/doc/) - Jenkins documentation
- [CircleCI](https://circleci.com/docs/) - CircleCI documentation
- [AgentOS Release Standards](../../docs/agentos/RELEASE.md) - Internal release guidelines (if applicable)

---

_Generated from release.yaml v3.0.0 - Generic CI/CD-Agnostic Release Workflow_