# Changelog

All notable changes to the Claude Configuration Installer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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