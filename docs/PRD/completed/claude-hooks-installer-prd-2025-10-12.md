# Product Requirements Document (PRD)
# Automated Claude Hooks Installation System

> **Project**: Claude Config Hooks Automated Installation Script  
> **Version**: 1.0  
> **Date**: 2025-01-05  
> **Status**: Draft  
> **Priority**: High

## Executive Summary

Create an automated installation script (`install-metrics-hooks.sh`) that properly installs the Node.js metrics hooks into Claude's configuration by modifying the Claude `settings.json` file and setting up the complete hooks ecosystem with proper registration and configuration.

### Value Proposition

- **Seamless Installation**: One-command installation of productivity metrics hooks
- **Configuration Automation**: Automatic Claude settings.json modification for proper hook integration
- **System Integration**: Complete setup of hooks, configuration, and directory structure
- **User Experience**: Simplified deployment without manual configuration steps

## User Analysis

### Primary Users

**Software Developer** (25-45 years old)
- **Role:** Senior/Lead Developer implementing productivity tracking
- **Context:** Wants to enable productivity metrics with minimal setup effort
- **Current Pain:** Manual Claude configuration is complex and error-prone
- **Goal:** One-command installation with immediate productivity tracking

**Engineering Manager** (35-55 years old)
- **Role:** Engineering Manager deploying team productivity tools
- **Context:** Needs to roll out metrics tracking across development team
- **Current Pain:** Complex installation process prevents team adoption
- **Goal:** Automated deployment with consistent configuration across team

**DevOps Engineer** (30-50 years old)
- **Role:** Platform Engineer managing development tools
- **Context:** Responsible for tool deployment and configuration management
- **Current Pain:** Manual hook installation doesn't scale to multiple developers
- **Goal:** Scriptable installation for automated provisioning

### User Journey

**Current State (Problem)**:
```
User wants productivity metrics
    ↓
Manual file copying to ~/.claude/hooks/
    ↓
Manual settings.json editing
    ↓
Manual configuration of hook registry
    ↓
Error-prone process, inconsistent results
```

**Future State (Solution)**:
```
User runs installation script
    ↓
./hooks/install-metrics-hooks.sh
    ↓
Automatic Claude configuration
    ↓
Complete productivity tracking system ready
```

## Goals & Non-Goals

### Goals

**Primary Objectives:**
1. **Automated Installation**: Single script installs complete hooks system
2. **Settings.json Integration**: Properly modify Claude settings.json for hook registration
3. **Directory Management**: Create and populate ~/.claude/hooks/ structure
4. **Configuration Setup**: Install Node.js hooks with proper config.json and registry.json
5. **Migration Support**: Handle existing Python hooks and migrate to Node.js version

**Secondary Objectives:**
1. **Error Handling**: Robust error handling with clear user feedback
2. **Backup Creation**: Backup existing Claude configuration before modification
3. **Validation Testing**: Verify installation success with hooks testing
4. **Documentation**: Clear installation instructions and troubleshooting

### Non-Goals

**Explicitly Out of Scope:**
- Developing new hooks functionality (hooks already implemented)
- Modifying Claude Code core functionality
- Changing metrics data formats or analytics algorithms
- Creating web-based installation interface
- Supporting Windows platform (macOS/Linux only per TRD)

## Technical Requirements

### Functional Requirements

#### FR-1: Installation Script Creation
**Requirement**: Create `hooks/install-metrics-hooks.sh` script for automated installation

**Script Functionality**:
```bash
#!/bin/bash
# install-metrics-hooks.sh - Automated Claude hooks installation

# 1. Environment validation (Node.js, Claude Code)
# 2. Backup existing Claude configuration
# 3. Install Node.js hooks to ~/.claude/hooks/metrics/
# 4. Update Claude settings.json with hooks configuration
# 5. Create hook registry and configuration files
# 6. Test hooks installation and functionality
# 7. Display success confirmation and usage instructions
```

#### FR-2: Claude Settings.json Modification
**Requirement**: Properly modify `~/.claude/settings.json` to register hooks

**Current Settings Structure**:
```json
{
  "model": "opusplan"
}
```

**Target Settings Structure**:
```json
{
  "model": "opusplan",
  "hooks": {
    "enabled": true,
    "directories": [
      "~/.claude/hooks"
    ],
    "config_file": "~/.claude/hooks/metrics/config.json",
    "registry_file": "~/.claude/hooks/metrics/registry.json"
  }
}
```

#### FR-3: Hooks Directory Structure Setup
**Requirement**: Create complete directory structure with proper files

**Target Directory Structure**:
```
~/.claude/hooks/
├── metrics/
│   ├── analytics-engine.js       # Core analytics engine (Node.js)
│   ├── session-start.js          # Session initialization hook
│   ├── session-end.js            # Session finalization hook  
│   ├── tool-metrics.js           # Tool usage tracking hook
│   ├── config.json               # Hook configuration
│   ├── registry.json             # Hook registry
│   ├── package.json              # Node.js dependencies
│   └── README.md                 # Hook documentation
└── install-metrics-hooks.sh      # This installation script
```

#### FR-4: Node.js Dependencies Installation
**Requirement**: Install required npm packages for Node.js hooks

**Dependencies to Install**:
```json
{
  "dependencies": {
    "date-fns": "^2.30.0",
    "fs-extra": "^11.2.0", 
    "simple-statistics": "^7.8.3"
  }
}
```

#### FR-5: Configuration File Generation
**Requirement**: Generate proper config.json and registry.json for Node.js hooks

**Config.json Content** (updated for Node.js and .ai-mesh):
```json
{
  "hook_config": {
    "enabled": true,
    "version": "2.0.0",
    "description": "Node.js Productivity Metrics Collection Hooks",
    "hooks": {
      "session_start": {
        "enabled": true,
        "script": "session-start.js",
        "trigger": "SessionStart",
        "timeout_ms": 5000,
        "async": true
      },
      "session_end": {
        "enabled": true,
        "script": "session-end.js",
        "trigger": "SessionEnd", 
        "timeout_ms": 10000,
        "async": false
      },
      "tool_metrics": {
        "enabled": true,
        "script": "tool-metrics.js",
        "trigger": "PostToolUse",
        "timeout_ms": 2000,
        "async": true
      }
    },
    "storage": {
      "metrics_directory": "~/.ai-mesh/metrics",
      "compression_enabled": true,
      "backup_enabled": true
    }
  }
}
```

#### FR-6: Migration and Backup Support
**Requirement**: Handle existing Python hooks and create backups

**Migration Strategy**:
1. **Detection**: Check for existing Python hooks in ~/.claude/hooks/metrics/
2. **Backup**: Create timestamped backup of existing configuration
3. **Migration**: Offer to migrate existing metrics data to .ai-mesh structure
4. **Cleanup**: Optionally remove Python files after successful Node.js installation

### Non-Functional Requirements

#### NFR-1: Reliability
- **Installation Success Rate**: >95% successful installations on supported systems
- **Data Safety**: 100% backup creation before any configuration changes
- **Rollback Capability**: Ability to restore previous configuration if installation fails
- **Error Recovery**: Graceful handling of installation failures with clear error messages

#### NFR-2: Performance
- **Installation Time**: Complete installation within 60 seconds
- **System Impact**: No performance impact on Claude Code operation
- **Resource Usage**: Minimal disk space usage (<50MB including dependencies)
- **Hook Performance**: Maintain existing performance requirements (≤50ms execution)

#### NFR-3: Usability  
- **Single Command**: One-line installation command
- **Clear Feedback**: Progress indicators and status messages during installation
- **Error Messages**: Actionable error messages with resolution steps
- **Documentation**: Built-in help and usage instructions

#### NFR-4: Compatibility
- **Platform Support**: macOS and Linux (Darwin, Ubuntu, CentOS)
- **Node.js Versions**: Support Node.js 18+ versions
- **Claude Code Versions**: Compatible with current Claude Code installations
- **Shell Compatibility**: Work with bash, zsh, and other POSIX shells

## Acceptance Criteria

### AC-1: Automated Installation Process
**Scenario**: Run installation script from hooks directory
- **Given**: User is in the hooks/ directory with Node.js 18+ installed
- **When**: User executes `./install-metrics-hooks.sh`
- **Then**: Script completes successfully with all hooks installed
- **And**: Claude settings.json is properly modified to register hooks
- **And**: All Node.js dependencies are installed

### AC-2: Settings.json Integration
**Scenario**: Claude settings are properly configured for hooks
- **Given**: Installation script has completed successfully
- **When**: Claude settings.json is examined
- **Then**: Hook configuration section is present and valid
- **And**: Hook directories and config files are properly referenced
- **And**: Existing settings (like model) are preserved

### AC-3: Hooks Registration and Configuration
**Scenario**: Hooks are properly registered and configured
- **Given**: Installation has completed successfully
- **When**: Hook registry and configuration files are examined
- **Then**: All three hooks (session-start, session-end, tool-metrics) are registered
- **And**: Configuration points to Node.js scripts (not Python)
- **And**: Storage configuration uses .ai-mesh/metrics directory

### AC-4: Migration from Python Hooks
**Scenario**: Existing Python installation is migrated to Node.js
- **Given**: User has existing Python hooks installed
- **When**: Installation script is executed
- **Then**: Python hooks are backed up with timestamp
- **And**: Node.js hooks are installed successfully
- **And**: Existing metrics data is preserved and migrated to .ai-mesh structure
- **And**: User is notified of migration completion

### AC-5: Installation Validation
**Scenario**: Installation success is validated through testing
- **Given**: Installation script has completed
- **When**: Built-in validation tests are executed
- **Then**: All hooks execute successfully without errors
- **And**: Hooks create appropriate files in .ai-mesh/metrics directory
- **And**: Performance requirements are validated (execution <50ms)

### AC-6: Error Handling and Recovery
**Scenario**: Installation error is handled gracefully
- **Given**: Installation encounters an error (disk full, permission denied)
- **When**: Error is detected by installation script
- **Then**: Installation is rolled back to previous state
- **And**: Clear error message is displayed with resolution steps
- **And**: User's original Claude configuration is restored

## Implementation Planning

### Phase 1: Script Framework Development (Week 1)
**Duration**: 2-3 days  
**Team**: Backend Developer + File Creator

**Tasks**:
- Create basic installation script structure with error handling
- Implement environment validation (Node.js, Claude Code detection)
- Create backup and rollback mechanisms
- Implement progress indicators and user feedback

**Deliverables**:
- Basic install-metrics-hooks.sh script framework
- Environment validation functions
- Backup and rollback functionality
- User feedback and progress reporting

### Phase 2: Claude Integration (Week 1) 
**Duration**: 3-4 days
**Team**: Backend Developer + Code Reviewer

**Tasks**:
- Implement settings.json modification with JSON parsing
- Create hooks directory structure and file installation
- Implement Node.js dependency installation (npm install)
- Create hook configuration and registry file generation

**Deliverables**:
- Settings.json modification functionality
- Complete hooks directory setup
- Node.js dependency installation
- Configuration file generation

### Phase 3: Migration and Validation (Week 2)
**Duration**: 3-4 days
**Team**: Backend Developer + Test Runner

**Tasks**:
- Implement Python to Node.js migration functionality
- Create installation validation and testing framework
- Implement comprehensive error handling and recovery
- Create usage documentation and help system

**Deliverables**:
- Python hooks migration functionality
- Installation validation and testing
- Comprehensive error handling
- Complete documentation and help

### Phase 4: Testing and Polish (Week 2)
**Duration**: 2-3 days
**Team**: Test Runner + Code Reviewer

**Tasks**:
- End-to-end installation testing on multiple platforms
- Performance and reliability testing
- User experience testing and feedback incorporation
- Final documentation review and completion

**Deliverables**:
- Complete testing validation
- Performance and reliability confirmation
- Polished user experience
- Final documentation and usage guides

## Risk Assessment

### Technical Risks

#### High Risk: Settings.json Corruption
**Impact**: Claude Code configuration becomes unusable  
**Probability**: Medium  
**Mitigation**: 
- Mandatory backup before any settings.json modification
- JSON validation before writing changes
- Atomic file operations with rollback capability
- Extensive testing with various settings.json formats

#### Medium Risk: Permission Issues
**Impact**: Installation fails due to file system permissions  
**Probability**: Medium  
**Mitigation**:
- Clear permission requirements in documentation
- Graceful handling of permission errors with guidance
- Alternative installation paths for restricted environments
- User guidance for permission resolution

#### Medium Risk: Node.js Dependency Conflicts
**Impact**: npm install fails or conflicts with existing packages  
**Probability**: Low  
**Mitigation**:
- Use isolated package.json in hooks directory
- Pin specific dependency versions for stability
- Clear error messages for dependency resolution
- Alternative installation methods for offline environments

### Business Risks

#### Low Risk: User Adoption Resistance
**Impact**: Users prefer manual installation over automated script  
**Probability**: Low  
**Mitigation**:
- Clear documentation of benefits and time savings
- Optional manual installation instructions as backup
- User feedback collection and script improvement
- Demonstration of installation simplicity

## Success Metrics

### Quantitative Metrics

**Installation Success Rate**: >95% of installations complete without manual intervention
**Installation Time**: Average installation time <45 seconds
**User Adoption**: >80% of users choose automated over manual installation
**Error Resolution**: <5% of installations require support intervention

### Qualitative Metrics

**User Satisfaction**: Positive feedback on installation simplicity and reliability
**Support Reduction**: Decreased support requests related to hooks installation
**Configuration Consistency**: Uniform hook configurations across installations
**Documentation Quality**: Clear, comprehensive installation documentation

## Implementation Details

### Script Structure

**Main Installation Flow**:
```bash
#!/bin/bash
# install-metrics-hooks.sh - Automated Claude Hooks Installation

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Configuration
CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
METRICS_DIR="$HOOKS_DIR/metrics"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
BACKUP_DIR="$CLAUDE_DIR/.backup-$(date +%Y%m%d_%H%M%S)"

main() {
    echo "🚀 Installing Claude Productivity Metrics Hooks..."
    
    # Phase 1: Environment validation
    validate_environment
    
    # Phase 2: Backup existing configuration
    create_backup
    
    # Phase 3: Install hooks and dependencies
    install_hooks_system
    
    # Phase 4: Configure Claude settings
    update_claude_settings
    
    # Phase 5: Validation and testing
    validate_installation
    
    echo "✅ Installation completed successfully!"
    show_usage_instructions
}

validate_environment() {
    # Check Node.js version
    # Check Claude Code installation
    # Check required permissions
    # Validate system compatibility
}

create_backup() {
    # Backup ~/.claude directory
    # Create restore script
    # Verify backup integrity
}

install_hooks_system() {
    # Create directory structure
    # Copy Node.js hook files
    # Install npm dependencies  
    # Generate configuration files
}

update_claude_settings() {
    # Parse existing settings.json
    # Add hooks configuration
    # Write updated settings atomically
    # Validate JSON structure
}

validate_installation() {
    # Test hook execution
    # Verify configuration files
    # Check directory structure
    # Validate performance requirements
}
```

### Settings.json Modification Strategy

**JSON Parsing and Modification**:
```bash
# Safe JSON modification using jq
update_settings_json() {
    local settings_file="$1"
    local temp_file="${settings_file}.tmp"
    
    # Create hooks configuration
    local hooks_config='{
        "enabled": true,
        "directories": ["~/.claude/hooks"],
        "config_file": "~/.claude/hooks/metrics/config.json",
        "registry_file": "~/.claude/hooks/metrics/registry.json"
    }'
    
    # Merge with existing settings
    jq --argjson hooks "$hooks_config" '. + {hooks: $hooks}' "$settings_file" > "$temp_file"
    
    # Atomic replacement
    mv "$temp_file" "$settings_file"
}
```

## Conclusion

The automated Claude hooks installation script provides a seamless, one-command solution for deploying productivity metrics tracking. This script eliminates the complexity of manual installation while ensuring proper Claude integration and configuration.

### Key Benefits
- **One-Command Installation**: Complete setup with single script execution
- **Configuration Automation**: Automatic Claude settings.json modification
- **Migration Support**: Seamless upgrade from Python to Node.js hooks
- **Error Recovery**: Robust backup and rollback capabilities

### Implementation Success Factors
1. **Comprehensive Testing**: Extensive validation across platforms and configurations
2. **Data Safety**: Mandatory backup and atomic operations
3. **User Experience**: Clear feedback and error messages
4. **Documentation**: Complete installation and troubleshooting guides

The implementation follows a four-phase approach focusing on reliability, usability, and comprehensive error handling to ensure successful deployment across diverse development environments.

---

**Document Control**  
- **Next Review Date**: Weekly during implementation  
- **Approval Required**: Tech Lead, Product Owner  
- **Implementation Start**: Upon PRD approval  
- **Related Documents**: Node.js Hooks Implementation, Metrics Directory Migration