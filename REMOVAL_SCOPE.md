# Repository Backend Service Removal - Scope Documentation

**Created**: 2025-10-03  
**Target Release**: v2.9.0  
**Pre-Removal Snapshot**: v2.8.0-with-backend (git tag)  
**Backup Branch**: backup/pre-backend-removal

---

## Current Repository State (Pre-Removal)

**Baseline Metrics**:
- **Current Commit**: 096f36c ("chore: prepare for backend removal - create backup and document scope")
- **Total Tracked Files**: 324 files
- **Backend Service Size**: 5.5GB (src/monitoring-web-service/)
- **Git Tag Created**: v2.8.0-with-backend
- **Backup Branch**: backup/pre-backend-removal (synced with remote)

**Repository Structure**:
```
claude-config/
├── src/
│   ├── monitoring-web-service/    # 5.5GB - TO BE REMOVED
│   ├── cli/                         # PRESERVE
│   ├── installer/                   # PRESERVE
│   ├── monitoring/                  # PRESERVE
│   ├── api/                         # PRESERVE
│   └── utils/                       # PRESERVE
├── agents/                          # PRESERVE (29 agents)
├── commands/                        # PRESERVE (11+ commands)
├── hooks/                           # PRESERVE
├── docs/                            # PRESERVE (with archival)
└── [other toolkit files]            # PRESERVE
```

---

## Files to Remove

### 1. Backend Service Directory (Complete Removal)

**Directory**: `src/monitoring-web-service/`
**Size**: 5.5GB
**Contents**: Complete Express/Node.js backend service with:
- Frontend (React/TypeScript SPA)
- Backend API (Express/Prisma/PostgreSQL)
- E2E tests (Playwright)
- Infrastructure (Terraform, Kubernetes, Docker)
- Observability (SigNoz, OpenTelemetry)
- Documentation and summaries

**Removal Command**: `git rm -r src/monitoring-web-service`

### 2. Root-Level Backend Summary Files

**Files** (already removed in current git status):
- DELEGATE_SEQ_SPRINT1_BACKEND.md
- SPRINT-1-IMPLEMENTATION-SUMMARY.md
- temp_task_2_1_request.md (if exists)

**Status**: Already staged for deletion

### 3. Backend PRDs (Move to Archive)

**Files to Archive**:
- docs/PRD/dashboard-real-data-integration.md → docs/archive/backend-service/PRD/
- docs/PRD/real-time-activity-feed-enhancement.md → docs/archive/backend-service/PRD/
- docs/PRD/real-time-activity-widget-enhancement.md → docs/archive/backend-service/PRD/
- docs/PRD/seq-integration-prd.md → docs/archive/backend-service/PRD/
- docs/PRD/seq-to-opentelemetry-signoz-migration.md → docs/archive/backend-service/PRD/

**Status**: Already moved in current git status

### 4. Backend TRDs (Move to Archive)

**Files to Archive**:
- docs/TRD/external-metrics-service-trd.md → docs/archive/backend-service/TRD/
- docs/TRD/seq-integration-trd.md → docs/archive/backend-service/TRD/
- docs/TRD/seq-to-opentelemetry-signoz-migration-trd.md → docs/archive/backend-service/TRD/
- docs/TRD/seq-to-otel-migration/task-1.2-otel-sdk-research.md → docs/archive/backend-service/TRD/seq-to-otel-migration/

**Status**: Already moved in current git status

---

## Files to Preserve

### Core Toolkit Components

**NPM Package Infrastructure**:
- src/cli/ - CLI interface and commands
- src/installer/ - Core installation logic
- src/monitoring/ - File monitoring service
- src/api/ - Programmatic API
- src/utils/ - Shared utilities
- bin/claude-installer - NPM executable
- package.json - NPM module configuration

**Agent Mesh** (29 specialized agents):
- agents/ - All agent definition files
- MESH_AGENTS.md - Agent ecosystem documentation

**Slash Commands** (11+ commands):
- commands/ - All command implementation files
- Includes: /create-trd, /implement-trd, /fold-prompt, /dashboard, etc.

**Development Hooks**:
- hooks/ - All Node.js development lifecycle hooks
- Hook performance: 87-99% faster than requirements

**Documentation**:
- docs/agentos/ - AgentOS standards (PRD, TRD, DoD templates)
- docs/PRD/ - Core PRDs (non-backend)
- docs/TRD/ - Core TRDs (non-backend)
- docs/archive/ - NEW - Backend documentation archive
- CLAUDE.md - Main configuration (UPDATE)
- README.md - Public documentation (UPDATE)

**Configuration Files**:
- .envrc, .gitignore, .editorconfig, etc.
- install.sh - Legacy bash installer
- scripts/ - Installation and utility scripts

---

## Archive Strategy

**Archive Directory Structure**:
```
docs/archive/backend-service/
├── README.md                        # NEW - Archival explanation
├── PRD/                             # Backend PRDs (moved)
│   ├── dashboard-real-data-integration.md
│   ├── real-time-activity-feed-enhancement.md
│   ├── real-time-activity-widget-enhancement.md
│   ├── seq-integration-prd.md
│   └── seq-to-opentelemetry-signoz-migration.md
└── TRD/                             # Backend TRDs (moved)
    ├── external-metrics-service-trd.md
    ├── seq-integration-trd.md
    ├── seq-to-opentelemetry-signoz-migration-trd.md
    └── seq-to-otel-migration/
        └── task-1.2-otel-sdk-research.md
```

**Archive README.md** (to be created):
- Explains why backend was removed
- Links to v2.8.0-with-backend git tag for full backend code
- Documents completion status (Sprint 10, production-ready)
- Provides context for future reference

---

## Expected Impact

### Repository Size Reduction

**Before**: ~324 tracked files, 5.5GB+ backend service
**After (Estimated)**: ~200 tracked files, ~200MB total size
**Reduction**: ~60% size reduction, ~38% file count reduction

### Functional Impact

**Zero Functional Regression**:
- All 29 agents preserved and functional
- All 11+ slash commands operational
- Hooks continue working (local storage + optional backend)
- NPM installer unchanged
- Bash installer unchanged
- Zero impact on core toolkit functionality

### Documentation Updates Required

**Files to Update**:
1. CLAUDE.md - Remove backend achievements, update repository structure
2. README.md - Remove backend examples, focus on toolkit
3. docs/archive/backend-service/README.md - Create archival documentation
4. CHANGELOG.md - Document removal in v2.9.0 release notes
5. Migration guide - Create user-facing documentation

---

## Rollback Plan

### Recovery Points

1. **Git Tag**: v2.8.0-with-backend
   - Full repository state before any removal
   - Can checkout for inspection or restoration

2. **Backup Branch**: backup/pre-backend-removal
   - Separate branch preserving pre-removal state
   - Synced with remote for safety

3. **Git History**: Complete commit history preserved
   - No force push or history rewrite
   - Standard `git rm` operations only
   - Can revert individual commits if needed

### Rollback Commands

```bash
# Option 1: Inspect pre-removal state
git checkout v2.8.0-with-backend

# Option 2: Restore from backup branch
git checkout backup/pre-backend-removal
git checkout -b main-restored

# Option 3: Revert specific commits
git revert <commit-hash>  # Selective rollback
```

---

## Validation Checklist

### Pre-Removal

- [x] Git tag v2.8.0-with-backend created and pushed
- [x] Backup branch backup/pre-backend-removal created and synced
- [x] Baseline metrics documented
- [ ] CHANGELOG.md updated with removal plan
- [ ] Archive directory structure created
- [ ] Archive README.md created

### Post-Removal

- [ ] src/monitoring-web-service/ completely removed
- [ ] Root-level backend files removed
- [ ] Backend PRDs/TRDs archived
- [ ] CLAUDE.md updated
- [ ] README.md updated
- [ ] Migration guide created
- [ ] All installers tested
- [ ] All commands tested
- [ ] Hooks tested
- [ ] Repository size validated

### Release

- [ ] CHANGELOG.md finalized
- [ ] Git tag v2.9.0 created
- [ ] GitHub release published
- [ ] NPM package version updated (if applicable)
- [ ] User notification via GitHub Discussions

---

## Success Criteria

**Quantitative**:
- Repository size reduced by ≥50%
- File count reduced by ≥30%
- Installation time improved by ≥25%
- Zero test failures

**Qualitative**:
- Documentation clearly explains toolkit-only focus
- Users understand rationale and impact
- Zero breaking changes to core functionality
- Positive user feedback on repository clarity

---

_This document will be updated as the removal progresses._
_Reference: docs/TRD/repository-backend-removal-trd.md_
