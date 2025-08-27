# Git-Workflow Agent Tests

> Test scenarios for enhanced git-workflow agent with conventional commits and git-town integration

## Test Scenario 1: Conventional Commit Validation

**Test Case**: Validate conventional commit format enforcement  
**Input**: Various commit message formats  
**Expected Validation**: 
- ✓ "feat(auth): add user authentication"
- ✓ "fix(api): resolve timeout in user endpoint"  
- ✓ "docs: update installation instructions"
- ❌ "Fixed some bugs" (non-conventional format)
- ❌ "WIP: working on feature" (temporary message)

## Test Scenario 2: Intelligent Commit Message Generation

**Test Case**: Generate appropriate commit messages based on file changes

### Subtest 2a: Documentation Changes
**Staged Files**: README.md, docs/installation.md  
**Expected Message**: "docs: update installation and README documentation"  
**Validation**: Correct type detection and scope suggestion

### Subtest 2b: New Feature Implementation
**Staged Files**: src/auth/login.js, src/auth/register.js, tests/auth.test.js  
**Expected Message**: "feat(auth): add user login and registration functionality"  
**Validation**: Feature detection, appropriate scope, includes testing

### Subtest 2c: Bug Fix
**Staged Files**: src/api/users.js (timeout fix)  
**Expected Message**: "fix(api): resolve timeout issues in user data fetch"  
**Validation**: Bug fix detection, specific scope, clear description

### Subtest 2d: Dependency Update
**Staged Files**: package.json, package-lock.json  
**Expected Message**: "build: update dependencies and lock file"  
**Validation**: Build type detection for dependency changes

## Test Scenario 3: Git-Town Integration

**Test Case**: Validate git-town command integration

### Subtest 3a: Feature Branch Creation
**Command**: Create new feature branch  
**Expected Git-Town Usage**: `git town hack feat/AUTH-123-oauth-integration`  
**Validation**: Proper branch naming convention, git-town command usage

### Subtest 3b: Branch Synchronization
**Command**: Sync with main branch  
**Expected Git-Town Usage**: `git town sync`  
**Validation**: Up-to-date branch state, conflict handling

### Subtest 3c: Pull Request Creation
**Command**: Create PR for completed feature  
**Expected Git-Town Usage**: `git town propose`  
**Validation**: PR creation with proper title and description

## Test Scenario 4: Branch Naming Validation

**Test Case**: Enforce branch naming conventions

**Valid Names**:
- ✓ feat/AUTH-456-oauth-integration
- ✓ fix/BUG-789-api-timeout-handling  
- ✓ docs/DOCS-123-update-readme
- ✓ refactor/TECH-456-extract-utils

**Invalid Names**:
- ❌ my-feature-branch (no type prefix)
- ❌ feat/very-long-branch-name-that-exceeds-the-sixty-character-limit-for-branch-names (too long)
- ❌ feat/special@characters (invalid characters)

## Test Scenario 5: Breaking Changes Detection

**Test Case**: Identify and format breaking changes properly

**Scenario**: API endpoint removal  
**Staged Files**: api/v1/users.js (removed deprecated endpoint)  
**Expected Message**:
```
feat(api)!: remove deprecated user search endpoint

BREAKING CHANGE: The legacy /api/users/search endpoint has been removed.
Use /api/users/advanced-search instead.
```
**Validation**: Breaking change marker (!), proper footer format

## Test Scenario 6: Safety Protocol Validation

**Test Case**: Pre-commit safety checks

### Subtest 6a: Repository State Validation
**Scenario**: Attempt commit with unstaged changes  
**Expected Behavior**: Warning about unstaged changes, offer to stage or stash  
**Validation**: Safe repository state maintained

### Subtest 6b: Merge Conflict Detection
**Scenario**: Attempt commit during merge conflict  
**Expected Behavior**: Detect conflicts, provide resolution guidance  
**Validation**: Prevent corrupted commits

### Subtest 6c: Branch State Validation
**Scenario**: Attempt push on outdated branch  
**Expected Behavior**: Suggest `git town sync` before push  
**Validation**: Maintain synchronization with remote

## Test Scenario 7: Semantic Versioning Integration

**Test Case**: Version bump recommendations based on commit history

### Subtest 7a: Feature Addition
**Commit History**: feat(auth), feat(api), docs: update  
**Expected Version Bump**: MINOR (new features added)  
**Validation**: Correct semver interpretation

### Subtest 7b: Bug Fixes Only
**Commit History**: fix(api), fix(ui), docs: clarify  
**Expected Version Bump**: PATCH (only fixes and docs)  
**Validation**: Conservative version increment

### Subtest 7c: Breaking Changes
**Commit History**: feat(api)!, refactor(auth)!  
**Expected Version Bump**: MAJOR (breaking changes present)  
**Validation**: Breaking change detection and major bump

## Test Scenario 8: Rollback Mechanism Testing

**Test Case**: Safe rollback procedures

### Subtest 8a: Undo Last Commit (Keep Changes)
**Command**: Rollback last commit but keep changes  
**Expected**: `git reset --soft HEAD~1`  
**Validation**: Changes remain staged, history cleaned

### Subtest 8b: Emergency Rollback
**Command**: Complete undo of last commit  
**Expected**: Confirmation prompt + `git reset --hard HEAD~1`  
**Validation**: Data loss warning, confirmation required

### Subtest 8c: Merge Abort
**Command**: Cancel ongoing merge  
**Expected**: `git merge --abort`  
**Validation**: Clean repository state restored

## Test Scenario 9: Quality Gate Integration

**Test Case**: Integration with code-reviewer agent

**Scenario**: Commit with security-sensitive changes  
**Expected Workflow**:
1. git-workflow analyzes changes
2. Detects security implications (auth, crypto, permissions)
3. Coordinates with code-reviewer for pre-commit validation
4. Only proceeds after security approval

**Validation**: Proper agent coordination, security gate enforcement

## Test Scenario 10: Scope Detection Accuracy

**Test Case**: Intelligent scope suggestion based on file paths

### Test Cases:
- `auth/`, `authentication/`, `login/` → scope: auth
- `api/`, `controllers/`, `routes/` → scope: api  
- `frontend/`, `ui/`, `components/` → scope: ui
- `database/`, `migrations/`, `models/` → scope: db
- `config/`, `settings/`, `.env` → scope: config

**Validation**: Accurate scope detection improves commit message quality

## Performance Tests

### Response Time Validation
- **Commit Message Generation**: <2 seconds for typical changesets
- **Format Validation**: <500ms for message checking
- **Git-Town Integration**: <5 seconds for branch operations
- **Safety Checks**: <3 seconds for repository validation

### Success Metrics Validation

#### Commit Quality (Target: 100% conventional format)
- Track commit message format compliance over 100 commits
- Validate scope accuracy and description clarity
- Measure breaking change detection accuracy

#### Message Clarity (Target: 90% meaningful descriptions)
- Assess generated message quality through review feedback
- Track reduction in "fix typo" or "update stuff" type messages
- Measure improvement in commit message informativeness

#### Git-Town Integration (Target: Seamless workflow)
- Validate all git-town commands work as expected
- Measure adoption rate of git-town workflows
- Track reduction in manual git command usage

#### Safety Record (Target: Zero data loss)
- Track rollback success rate
- Validate pre-commit safety check effectiveness  
- Monitor incident rate for git-related data loss

## Manual Testing Checklist

- [ ] Conventional commit format validation works correctly
- [ ] Intelligent commit message generation provides good suggestions
- [ ] Git-town integration commands work as expected
- [ ] Branch naming conventions are enforced
- [ ] Breaking changes are detected and formatted properly
- [ ] Safety protocols prevent data loss
- [ ] Semantic versioning logic works correctly
- [ ] Rollback mechanisms function safely
- [ ] Quality gate integration with code-reviewer works
- [ ] Scope detection accuracy meets expectations
- [ ] Performance meets target metrics
- [ ] Agent coordination works seamlessly

## Automated Test Implementation

### Unit Tests for Core Functions
```bash
# Test commit message validation
test_conventional_commit_validation()
test_commit_message_generation()
test_scope_detection_logic()
test_breaking_change_detection()

# Test git-town integration
test_branch_creation_with_git_town()
test_sync_operation()  
test_pr_creation_workflow()

# Test safety mechanisms
test_pre_commit_validation()
test_rollback_procedures()
test_conflict_detection()
```

### Integration Tests
```bash  
# Test full workflow scenarios
test_feature_development_workflow()
test_bug_fix_workflow()
test_documentation_update_workflow()
test_breaking_change_workflow()

# Test agent coordination
test_code_reviewer_integration()
test_meta_agent_delegation()
test_quality_gate_enforcement()
```