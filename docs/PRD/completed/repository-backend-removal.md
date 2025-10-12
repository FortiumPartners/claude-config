# Product Requirements Document: Repository Backend Service Removal

## Summary

The claude-config repository currently contains a completed monitoring web service backend application in `src/monitoring-web-service/`. This backend was developed as a demonstration project and successfully completed through Sprint 10. To refocus the repository on its core mission as a **Claude Code Configuration Toolkit**, we will remove all backend service code while preserving the essential components: commands, agents, hooks, installation system, and documentation.

**Problem**: The presence of the backend service creates confusion about the repository's purpose, increases maintenance burden, and obscures the core Claude Code configuration toolkit that delivers 35-40% productivity improvements.

**Solution**: Clean removal of backend service code with comprehensive archival strategy, maintaining zero impact on core functionality.

## Goals / Non-goals

### Goals

1. **Repository Focus**: Establish claude-config as exclusively a Claude Code configuration toolkit
2. **Size Reduction**: Reduce repository size by ~60% through backend removal
3. **User Clarity**: Improve onboarding experience by removing unrelated backend code
4. **Maintainability**: Reduce maintenance burden and eliminate backend-specific support requests
5. **Preservation**: Maintain 100% functionality of core features (29 agents, 11+ commands, hooks, installer)
6. **Documentation**: Update all documentation to reflect toolkit-only focus

### Non-goals

1. **Backend Migration**: We are NOT migrating the backend to another repository (it's complete/archived)
2. **Feature Parity**: We are NOT replacing backend functionality with alternatives
3. **Backward Compatibility**: We are NOT maintaining support for backend service references
4. **Hook Dependencies**: Hooks will remain independent (local storage, optional external backend)

## Users / Personas

### Primary Personas

#### 1. New Repository Visitors (Evaluators)
- **Need**: Quick understanding of what claude-config offers
- **Pain Point**: Currently confused by backend service presence
- **Benefit**: Immediate clarity that this is a Claude Code configuration toolkit
- **Success Metric**: 90% reduction in "what is this repo for?" questions

#### 2. Existing Users (Productivity Seekers)
- **Need**: Reliable access to agents, commands, and hooks
- **Pain Point**: Fear that cleanup might break their workflows
- **Benefit**: Zero disruption with clearer documentation
- **Success Metric**: 100% retention post-cleanup, no functionality loss

#### 3. Repository Maintainers (Fortium Team)
- **Need**: Reduced maintenance burden and clearer scope
- **Pain Point**: Backend code requires ongoing maintenance despite completion
- **Benefit**: 70% reduction in support burden, focused development
- **Success Metric**: Time saved on support and maintenance

#### 4. Contributors (Open Source Community)
- **Need**: Clear contribution guidelines and focused scope
- **Pain Point**: Unclear whether to contribute to backend vs toolkit
- **Benefit**: Clear contribution target (toolkit only)
- **Success Metric**: Increased contribution quality and relevance

#### 5. Enterprise Adopters (Organizations)
- **Need**: Production-ready toolkit without experimental features
- **Pain Point**: Concern about stability with backend service included
- **Benefit**: Professional toolkit without extraneous code
- **Success Metric**: Increased enterprise adoption confidence

#### 6. Documentation Readers (Learners)
- **Need**: Clear, focused learning materials
- **Pain Point**: Backend references in docs create confusion
- **Benefit**: Streamlined documentation focused on toolkit usage
- **Success Metric**: Reduced documentation navigation time

## Acceptance Criteria

### Functional Requirements

- [ ] **Complete Backend Removal**: Entire `src/monitoring-web-service/` directory removed
- [ ] **Core Components Preserved**: All agents, commands, hooks, installer files intact
- [ ] **Installation Works**: Both NPM installer and legacy bash installer function correctly
- [ ] **Commands Functional**: All 11+ slash commands execute successfully
- [ ] **Agents Operational**: All 29 specialized agents accessible and functional
- [ ] **Hooks Independent**: Development lifecycle hooks work standalone (local storage mode)
- [ ] **Documentation Updated**: CLAUDE.md and README.md reflect toolkit-only scope
- [ ] **Archive Created**: Backend PRDs/TRDs moved to `docs/archive/backend-service/`
- [ ] **Git History Clean**: All backend files removed from working tree (history preserved)

### Technical Requirements

- [ ] **Repository Size**: Reduced from ~500MB to ~200MB (60% reduction target)
- [ ] **Build Performance**: Installation time reduced by 30% (fewer files to process)
- [ ] **File Count**: Total file count reduced by 50%+ (backend has 200+ files)
- [ ] **No Broken Links**: Zero broken internal documentation references
- [ ] **Test Coverage**: Core functionality maintains >90% test coverage
- [ ] **Zero Regressions**: All existing integration tests pass

### Documentation Requirements

- [ ] **README.md Updated**: Remove all backend service references and examples
- [ ] **CLAUDE.md Updated**: Remove backend-related achievements and sprint summaries
- [ ] **Installation Guide**: Update to reflect toolkit-only installation
- [ ] **Migration Guide Created**: Document for users with backend references
- [ ] **Archive Index**: Create README in `docs/archive/backend-service/` explaining archival
- [ ] **Command Docs**: Update command examples to remove backend dependencies

### Quality Assurance Requirements

- [ ] **Pre-Removal Backup**: Complete git tag before removal (`v2.8.0-with-backend`)
- [ ] **Installation Testing**: Test both global and local installation post-removal
- [ ] **Command Testing**: Execute all 11+ commands in test environment
- [ ] **Hook Testing**: Verify hooks work in local-only mode
- [ ] **Documentation Review**: Full documentation review for accuracy

### Communication Requirements

- [ ] **Changelog Entry**: Document removal with rationale and migration path
- [ ] **Release Notes**: Clear communication about v2.9.0 changes
- [ ] **User Notification**: Inform existing users via GitHub release
- [ ] **FAQ Updated**: Add "Where did the backend go?" FAQ entry

## Constraints / Risks

### Technical Constraints

1. **Git History Preservation**: Must maintain full git history (no force push to main)
2. **Hook Independence**: Hooks must continue to work without external backend
3. **Installation Compatibility**: Must support both NPM and bash installation methods
4. **Cross-Platform**: Changes must work on macOS, Linux, and Windows

### Business Constraints

1. **Zero Downtime**: Existing users must experience no service interruption
2. **Timeline**: Complete removal within 1 sprint (1 week)
3. **Support Burden**: Must reduce, not increase, support requests
4. **User Trust**: Maintain user confidence in toolkit stability

### Risk Assessment

#### High Risk: User Confusion About Changes
- **Description**: Users may not understand why backend was removed
- **Impact**: Support burden, user dissatisfaction
- **Mitigation**: 
  - Clear release notes with rationale
  - Migration guide in documentation
  - FAQ entry explaining removal
  - Git tag preserving pre-removal state
- **Monitoring**: Track GitHub issues and support requests post-release

#### Medium Risk: Documentation Link Breakage
- **Description**: Internal links may break after file removal
- **Impact**: Poor user experience, documentation navigation issues
- **Mitigation**:
  - Automated link checker pre-release
  - Manual documentation review
  - Update all cross-references
- **Monitoring**: Regular link validation post-release

#### Medium Risk: Installation Regression
- **Description**: Installer may fail if backend files expected
- **Impact**: New users unable to install
- **Mitigation**:
  - Comprehensive pre-release testing
  - Test both global and local installation
  - Validate on all supported platforms
- **Monitoring**: Installation success rate tracking

#### Low Risk: Hook Performance Impact
- **Description**: Hooks may perform differently without backend
- **Impact**: Minimal (hooks already support local-only mode)
- **Mitigation**:
  - Hooks designed for independence
  - Local storage fallback active
  - Performance already validated
- **Monitoring**: Hook execution metrics

## Technical Architecture

### Removal Scope

**Files to Remove** (~200+ files):
```
src/monitoring-web-service/
├── frontend/              # React frontend
├── backend/               # NestJS backend
├── e2e/                   # E2E tests
├── prisma/                # Database schemas
├── scripts/               # Backend scripts
├── docs/                  # Backend-specific docs
└── *-SUMMARY.md          # Sprint completion summaries
```

**Root Files to Remove**:
```
SPRINT-*-*.md              # Sprint summaries in root
DELEGATE_*.md              # Backend delegation files
temp_task_*.md             # Temporary backend task files
```

**Files to Archive** (move to `docs/archive/backend-service/`):
```
docs/PRD/seq-integration-prd.md
docs/PRD/real-time-activity-feed-enhancement.md
docs/PRD/dashboard-real-data-integration.md
docs/TRD/external-metrics-service-trd.md
docs/TRD/seq-integration-trd.md
```

**Files to Preserve** (100%):
```
agents/                    # 29 specialized agents
commands/                  # 11+ slash commands
hooks/                     # Development lifecycle automation
src/cli/                   # NPM installer CLI
src/installer/             # Core installation logic
docs/agentos/             # AgentOS standards
docs/PRD/                 # Core PRDs (non-backend)
docs/TRD/                 # Core TRDs (non-backend)
CLAUDE.md                 # Main configuration
README.md                 # Public documentation
package.json              # NPM module config
install.sh                # Legacy installer
```

### Hook Independence Validation

**Current Architecture**:
- Hooks use local storage in `~/.ai-mesh/metrics/`
- Optional backend integration via `METRICS_API_URL` environment variable
- Graceful fallback if backend unavailable

**Post-Removal Behavior**:
- Hooks continue using local storage (no change)
- `METRICS_API_URL` becomes optional-only (not documented)
- All productivity metrics tracked locally
- No functional impact on hook performance

### Migration Strategy

**Phase 1: Preparation** (Day 1)
1. Create git tag: `v2.8.0-with-backend`
2. Backup current state to separate branch
3. Document all files to be removed
4. Update CHANGELOG.md with removal plan

**Phase 2: Removal** (Day 2-3)
1. Remove `src/monitoring-web-service/` directory
2. Remove root-level backend files (SPRINT-*, DELEGATE_*)
3. Move backend PRDs/TRDs to archive
4. Create archive README explaining preservation

**Phase 3: Documentation Update** (Day 4)
1. Update CLAUDE.md (remove backend achievements)
2. Update README.md (remove backend examples)
3. Create migration guide
4. Add FAQ entries
5. Update installation instructions

**Phase 4: Validation & Release** (Day 5)
1. Test NPM installer (global + local)
2. Test bash installer
3. Execute all 11+ commands
4. Verify hooks functionality
5. Run automated tests
6. Create GitHub release v2.9.0

## Success Metrics

### Quantitative Metrics

1. **Repository Size Reduction**: 
   - Target: 60% reduction (500MB → 200MB)
   - Measurement: Git repository size

2. **File Count Reduction**:
   - Target: 50%+ fewer files
   - Measurement: `git ls-files | wc -l`

3. **Installation Performance**:
   - Target: 30% faster installation
   - Measurement: Time to complete `npx @fortium/claude-installer install`

4. **User Clarity**:
   - Target: 90% reduction in "what is this repo?" questions
   - Measurement: GitHub issue tracker analysis

5. **Support Burden**:
   - Target: 70% reduction in backend-related support requests
   - Measurement: Support ticket categorization

6. **Zero Functional Regressions**:
   - Target: 100% of core tests passing
   - Measurement: Automated test suite results

### Qualitative Metrics

1. **User Satisfaction**:
   - Target: Positive feedback on repository focus
   - Measurement: GitHub release comments, user surveys

2. **Onboarding Experience**:
   - Target: Improved time-to-value for new users
   - Measurement: User feedback, documentation bounce rate

3. **Maintainer Efficiency**:
   - Target: Increased focus on core toolkit development
   - Measurement: Developer time allocation tracking

## Implementation Plan

### Timeline: 1 Sprint (5 Days)

**Day 1: Preparation & Planning**
- Create backup git tag
- Document removal scope
- Update project board

**Day 2-3: Execution**
- Remove backend files
- Archive PRDs/TRDs
- Update git repository

**Day 4: Documentation**
- Update CLAUDE.md and README.md
- Create migration guide
- Update installation docs

**Day 5: Validation & Release**
- Comprehensive testing
- GitHub release creation
- User communication

### Rollback Plan

If critical issues discovered:
1. Revert to git tag `v2.8.0-with-backend`
2. Restore from backup branch
3. Document issues and re-plan
4. Delay release until issues resolved

## References

### Internal Documentation
- CLAUDE.md - Current repository configuration
- README.md - Public documentation
- docs/agentos/PRD.md - PRD template
- SPRINT-10-COMPLETION-SUMMARY.md - Backend completion status

### Related Issues
- GitHub Issue #TBD - Repository Backend Removal Epic
- Release v2.9.0 - Toolkit Focus Release

### Technical Specifications
- NPM Package: @fortium/claude-installer
- Installation Methods: NPM-based + bash fallback
- Core Components: 29 agents, 11+ commands, development hooks

---

**PRD Version**: 1.0  
**Created**: 2025-10-02  
**Status**: Draft - Awaiting Approval  
**Owner**: Fortium Software Configuration Team  
**Reviewers**: Repository maintainers, existing users

---

_This PRD follows AgentOS standards for structured product planning and will be converted to a TRD for technical implementation._
