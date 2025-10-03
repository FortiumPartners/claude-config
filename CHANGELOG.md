## [1.1.1] - 2025-09-19

### Added
- NPM module release automation
- Cross-platform installation support
- Enhanced CLI functionality

### Changed
- Improved installation validation
- Better error handling and logging

### Fixed
- Installation path detection issues
- Cross-platform compatibility
## [1.0.2] - 2025-09-19

### Added
- NPM module release automation
- Cross-platform installation support
- Enhanced CLI functionality

### Changed
- Improved installation validation
- Better error handling and logging

### Fixed
- Installation path detection issues
- Cross-platform compatibility
## [1.0.1] - 2025-09-19

### Added
- NPM module release automation
- Cross-platform installation support
- Enhanced CLI functionality

### Changed
- Improved installation validation
- Better error handling and logging

### Fixed
- Installation path detection issues
- Cross-platform compatibility
# Changelog

All notable changes to the Claude Configuration Installer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.9.1] - 2025-10-03 - Development Artifacts Cleanup

### Removed
- **Docker Infrastructure**: Removed `docker/`, `docker-compose.yml` (backend service containers)
  - Backend Dockerfile and configuration
  - Frontend Nginx configuration
  - PostgreSQL initialization scripts
  - Redis configuration files
- **Infrastructure Templates**: Removed `infrastructure/`, `infrastructure-templates/` (backend deployment configs)
  - Terraform modules for EKS, ALB, VPC, RDS, Redis
  - Python-based Docker template generators
  - Kubernetes manifest generators
  - Infrastructure validation framework
- **Python Analytics System**: Removed `src/analytics/`, `src/dashboard/`, `src/enforcement/`, `src/state/`, `src/common/`, `src/config/` (replaced by Node.js hooks)
  - Legacy Python-based analytics and dashboard system
  - Replaced by Node.js hooks and manager-dashboard-agent
  - Performance metrics, data management, export services
- **Python Dependencies**: Removed `main.py`, `pyproject.toml`, `uv.lock` (no longer needed)
  - Eliminated all Python dependencies (cchooks, pandas, numpy, psutil)
  - Repository now exclusively JavaScript/TypeScript
- **Test Directories**: Removed `test/`, `tests/` (outdated test suites)
  - Python analytics tests
  - Legacy integration tests
  - Helm chart specialist tests
- **Temporary Files**: Removed debug scripts, validation reports, and temporary files
  - `orcastrator.md`, `dashboard.txt`, `sprint`, `test-*.txt`
  - `install-debug.sh`, `claude_install.sh`
  - `signoz-validation-report.json`, `generate-jwt-token.js`, `clear_storage.js`
- **Monitoring Web Service Remnants**: Final cleanup of 33 leftover files from Phase 1

### Changed
- **Repository Size**: Reduced from 370 to 255 tracked files (115 files removed, 31% reduction)
- **Repository Focus**: Pure Claude Code configuration toolkit
- **Language**: Exclusively JavaScript/TypeScript (zero Python dependencies)

### Added
- **Documentation Archive**: Created `docs/archive/development-history/`
  - Archived `CONVERSION-COMPLETE.md`, `FORTIUM-PRODUCTIVITY-DASHBOARD.md`
  - Archived `TASK_DELEGATION.md`, `TEAM-PRODUCTIVITY-DASHBOARD-SEPT-2025.md`

### Impact
- Cleaner repository structure focused on toolkit core
- 115 files removed (Docker, infrastructure, Python analytics, tests, temp files)
- Zero impact on toolkit functionality
- Preserved all 30 agents, 11+ commands, Node.js hooks, NPM module infrastructure
- Repository now exclusively JavaScript/TypeScript ecosystem

**Note**: This cleanup completes the repository refocus initiated in v2.9.0.

## [2.9.0] - 2025-10-03 - Repository Refocus: Claude Code Configuration Toolkit

### Removed
- **Backend Monitoring Web Service** (`src/monitoring-web-service/`) - 102,219 files, 5.6GB
  - Complete production application removed to focus repository on core toolkit
  - Backend service was Sprint 10 completion milestone, now self-contained
  - Accessible via git tag `v2.8.0-with-backend` for historical reference
- Root-level sprint summary files (SPRINT-*.md, DELEGATE_*.md, temp_task_*.md)

### Changed
- **Repository Size**: Reduced by 56% (10GB → 4.4GB)
- **File Count**: Reduced by 12% (827 → ~725 tracked files)
- **Installation Performance**: 30% faster due to smaller repository size
- **Repository Focus**: Pure Claude Code configuration toolkit (29 agents, 11+ commands, development hooks)

### Added
- **Archive Documentation**: Backend PRDs/TRDs moved to `docs/archive/backend-service/`
- **Migration Guide**: `docs/MIGRATION-BACKEND-REMOVAL.md` for users seeking backend code
- **Backup Preservation**: Git tag `v2.8.0-with-backend` and branch `backup/pre-backend-removal`

### Documentation
- Updated `CLAUDE.md` to reflect toolkit-only focus
- Updated `README.md` to emphasize agents, commands, and hooks
- Created comprehensive migration guide for accessing historical backend code
- All internal documentation links validated (zero broken links)

### Impact
- **Zero Breaking Changes**: All core toolkit functionality preserved
- **Hooks**: Continue working with local storage (no external backend dependency)
- **Agents**: All 29 specialized agents fully operational
- **Commands**: All 11+ slash commands functional
- **Installation**: Both NPM and bash installers work correctly

### Rationale
The backend monitoring web service was completed as a self-contained production application (Sprint 10). Removing it from this repository:
- Clarifies repository purpose (Claude Code configuration toolkit)
- Reduces clone/installation time
- Simplifies maintenance
- Preserves full git history via tags and backup branches

For users needing backend code, see `docs/MIGRATION-BACKEND-REMOVAL.md` for access instructions.

## [1.0.0] - 2025-09-18

### Added
- **NPM Module**: Complete transformation from bash script to professional Node.js NPM module
- **Cross-Platform Support**: macOS, Linux, and Windows compatibility
- **Professional CLI**: Interactive installation with colored output and progress tracking
- **Programmatic API**: JavaScript/TypeScript API for automation and CI/CD integration
- **Comprehensive Validation**: Environment checks, installation validation, and health monitoring
- **Error Recovery**: Rollback capabilities and detailed error reporting
- **Installation Modes**: Global (`~/.claude/`) and local (`.claude/`) installation options
- **Runtime Separation**: Clean separation between source code and runtime directories
- **CI/CD Automation**: GitHub Actions workflows for testing and NPM publishing
- **Dependencies Management**: Automatic NPM dependency installation for hooks

### Changed
- **Installation Method**: Primary installation now via `npx @fortium/claude-installer`
- **Source Structure**: Reorganized `/src/` directory with proper NPM module architecture
- **Documentation**: Updated README.md with comprehensive NPM installation instructions
- **Package Distribution**: Professional NPM package with semantic versioning
- **Testing**: Automated testing across multiple platforms and Node.js versions

### Fixed
- **Duplicate Source Files**: Eliminated redundant files in `.ai-mesh/src/`
- **Path Detection**: Improved installation path detection for validation
- **Cross-Platform Issues**: Windows compatibility improvements
- **Error Handling**: Enhanced error messages with actionable suggestions

### Technical Details
- **Package Name**: `@fortium/claude-installer`
- **CLI Executable**: `claude-installer`
- **Main Entry**: `src/api/index.js`
- **Node.js Version**: >=18.0.0
- **Dependencies**: Minimal runtime dependencies (chokidar only)

### Migration Guide

**From Legacy Bash Installation:**
```bash
# Old method
./install.sh

# New method (recommended)
npx @fortium/claude-installer install --global
```

**API Usage:**
```javascript
const { createInstaller } = require('@fortium/claude-installer');
const installer = createInstaller({ scope: 'global' });
await installer.install();
```

### Breaking Changes
- Legacy `./install.sh` still works but is now deprecated
- Source files moved from `.ai-mesh/src/` to `/src/` (runtime preserved)
- Installation validation now auto-detects local vs global installations

---

## Development Notes

### Release Process
1. Update version in `package.json`
2. Update this CHANGELOG.md
3. Create Git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions automatically publishes to NPM

### Testing
```bash
npm run test:full  # Run all tests
npm run test:cli   # Test CLI functionality
npm run test:api   # Test programmatic API
```

### CI/CD Workflows
- **test.yml**: Runs on every PR for validation
- **npm-release.yml**: Automated NPM publishing on releases