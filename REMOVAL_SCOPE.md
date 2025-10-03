# Backend Service Removal Scope

## Baseline Metrics (Pre-Removal)

**Date**: 2025-10-02  
**Git Commit**: `2976bc1`  
**Git Branch**: main

### Repository Metrics

- **Total Tracked Files**: 827 files
- **Repository Size**: 10GB
- **Backend Service Size**: 5.6GB
- **Backend Service Files**: 102,219 files
- **Expected Size After Removal**: ~4.4GB (56% reduction)
- **Expected File Count After Removal**: ~725 files (12% reduction in tracked files)

## Files to Remove

### 1. Backend Service Directory
- **Path**: `src/monitoring-web-service/`
- **Size**: 5.6GB
- **Files**: 102,219 files
- **Status**: Complete production application (Sprint 10)

### 2. Root-Level Sprint Summaries
- `SPRINT-*.md` files
- `DELEGATE_*.md` files
- `temp_task_*.md` files

### 3. Backend-Related Documentation (To Archive)

**PRDs to Archive**:
- `docs/PRD/seq-integration-prd.md`
- `docs/PRD/real-time-activity-feed-enhancement.md`
- `docs/PRD/dashboard-real-data-integration.md`

**TRDs to Archive**:
- `docs/TRD/external-metrics-service-trd.md`
- `docs/TRD/seq-integration-trd.md`

**Archive Location**: `docs/archive/backend-service/`

## Components to Preserve

### Core Toolkit
- `agents/` - 29 specialized agents
- `commands/` - 11+ slash commands
- `hooks/` - Development lifecycle automation
- `src/cli/` - NPM installer CLI
- `src/installer/` - Core installation logic
- `src/monitoring/` - File monitoring service
- `src/api/` - Programmatic API
- `src/utils/` - Shared utilities

### Documentation
- `docs/agentos/` - AgentOS standards
- `docs/PRD/` - Core PRDs (non-backend)
- `docs/TRD/` - Core TRDs (non-backend)
- `CLAUDE.md` - Main configuration (to be updated)
- `README.md` - Public documentation (to be updated)

### Configuration
- `package.json` - NPM module configuration
- `install.sh` - Legacy bash installer
- All other configuration files

## Rationale

The backend monitoring web service was completed in Sprint 10 and represents a self-contained application that:

1. **Purpose-built for a specific use case**: Real-time developer productivity metrics
2. **Adds complexity to toolkit repository**: 102K+ files, 5.6GB
3. **Not core to Claude Code configuration**: Toolkit focus is agents, commands, hooks
4. **Production-ready**: Can be deployed independently
5. **Accessible via git**: Preserved in history via tag `v2.8.0-with-backend`

## Preservation Strategy

- **Git Tag**: `v2.8.0-with-backend` - Snapshot before removal
- **Git Branch**: `backup/pre-backend-removal` - Full backup
- **Archive**: Backend PRDs/TRDs moved to `docs/archive/backend-service/`
- **Git History**: Fully preserved (no filter-branch, no force push)

## Impact Assessment

**Zero Impact on Core Functionality**:
- All 29 agents preserved
- All 11+ commands preserved
- All hooks preserved (local storage mode)
- NPM installer preserved
- Bash installer preserved

**Benefits**:
- 56% smaller repository
- Clearer repository purpose (toolkit-only)
- Faster clone/installation
- Reduced maintenance burden

**User Migration**: None required (zero breaking changes)

---

_Created during Task 1.1: Preparation & Backup_
