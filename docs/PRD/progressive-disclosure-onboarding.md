# PRD: Progressive Disclosure Onboarding System

**Product Name**: AI Mesh Tiered Installation & On-Demand Expansion
**Version**: 1.0
**Date**: October 31, 2025
**Status**: Approved for Development
**Priority**: P0 (Immediate Win)
**Owner**: AI Mesh Product Team

---

## Executive Summary

The Progressive Disclosure Onboarding System transforms AI Mesh installation from an overwhelming all-at-once experience into a graduated, usage-based expansion model. Instead of installing all 26 agents and 130+ documentation files immediately, users choose from tiered profiles and expand capabilities on-demand as their needs grow.

**Problem**: Current installation dumps everything at once (26 agents, 8 skills, 130+ docs, 85MB, 120s setup time), overwhelming new users and creating high abandonment rates during onboarding.

**Solution**: Three installation profiles (starter, standard, complete) with automatic framework detection and just-in-time skill loading, reducing initial setup by 85% while maintaining full feature access for power users.

**Impact**: 85% faster first-time setup (45s vs 120s), dramatic reduction in beginner overwhelm, progressive feature discovery, maintained power user capabilities.

---

## Goals & Non-Goals

### Goals

1. **Reduce Setup Friction**: Achieve 85% faster first-time setup (45s vs 120s)
2. **Eliminate Overwhelm**: Start users with 8 essential agents instead of 26
3. **Enable Discovery**: Progressive revelation of advanced features as users grow
4. **Just-In-Time Loading**: Auto-detect frameworks and prompt for relevant skills
5. **Maintain Power**: Full capabilities available on-demand for experts

### Non-Goals

1. **Remove Features**: Not reducing overall functionality, only installation timing
2. **Forced Minimalism**: Power users can still install complete setup
3. **Network Dependency**: On-demand installation works offline (pre-downloaded)
4. **Breaking Changes**: Must support existing full installations seamlessly

---

## User Personas & Use Cases

### Primary Personas

#### 1. Emma - First-Time User (50% of new installs)
- **Background**: Trying AI Mesh for first time, evaluating tools, time-sensitive
- **Pain Points**:
  - Overwhelmed by long installation time
  - Confused by 26 agents she doesn't understand yet
  - Needs quick evaluation to prove value
- **Needs**:
  - Fast installation (<1 minute)
  - Simple getting-started experience
  - Clear path to expand as needed

#### 2. David - Pragmatic Developer (30% of new installs)
- **Background**: Moderately experienced, wants common tools quickly
- **Pain Points**:
  - Doesn't need all 26 agents immediately
  - Wants core + popular frameworks (React, K8s, etc.)
  - Balancing speed with completeness
- **Needs**:
  - Middle-ground installation option
  - Common frameworks included
  - Easy expansion for edge cases

#### 3. Lisa - Power User (15% of new installs)
- **Background**: Expert developer, wants everything, productivity-focused
- **Pain Points**:
  - Willing to wait for full install
  - Needs all agents and skills available
  - Doesn't want to install piecemeal
- **Needs**:
  - Complete installation option
  - All features immediately
  - No surprises or missing tools

#### 4. Marcus - Team Lead (5% of new installs)
- **Background**: Managing team adoption, standardizing tools
- **Pain Points**:
  - Team has varied skill levels
  - Needs consistent onboarding
  - Wants controlled feature rollout
- **Needs**:
  - Scriptable installation profiles
  - Team-wide configuration options
  - Ability to pre-configure skill sets

### Key Use Cases

#### Use Case 1: First-Time Quick Start (Emma)
**Actor**: Emma (First-Time User)
**Trigger**: Running `npx @fortium/ai-mesh install` for first time
**Flow**:
1. Emma sees installation profile selection prompt
2. Chooses "Starter" (8 core agents, 15MB, 45s)
3. Installation completes rapidly
4. Emma successfully creates first PRD with `/create-prd`
5. System detects she's using React project later
6. Prompts: "Detected React project. Install React skills? (5MB, <30s) [Y/n]"
7. Emma confirms, React skills load in 25s
8. Emma can now use frontend-developer with React expertise

**Success Criteria**: Emma productive within 5 minutes, low frustration

#### Use Case 2: Balanced Installation (David)
**Actor**: David (Pragmatic Developer)
**Trigger**: Wants common tools but not everything
**Flow**:
1. David runs installation, sees 3 profile options
2. Chooses "Standard" (16 agents + React/NestJS/K8s/Fly.io skills, 45MB, 90s)
3. Installation completes with most common tools
4. David works for 2 weeks with standard setup
5. Encounters Terraform project for first time
6. System prompts: "Detected Terraform files. Install Terraform skills? [Y/n]"
7. David confirms, Terraform skills load on-demand
8. David continues work without disruption

**Success Criteria**: David has what he needs 90% of the time, easy expansion

#### Use Case 3: Power User Full Install (Lisa)
**Actor**: Lisa (Power User)
**Trigger**: Wants all features immediately
**Flow**:
1. Lisa runs installation, sees 3 profiles
2. Chooses "Complete" (all 26 agents + all 8 skills, 85MB, 120s)
3. Installation completes with everything
4. Lisa has full capabilities immediately
5. No prompts for skill installation (already has all)
6. Lisa works efficiently with no interruptions

**Success Criteria**: Lisa gets complete system, no compromise

#### Use Case 4: Team Standardization (Marcus)
**Actor**: Marcus (Team Lead)
**Trigger**: Rolling out AI Mesh to 15-person team
**Flow**:
1. Marcus tests installation profiles
2. Decides on Standard for team consistency
3. Creates install script: `npx @fortium/ai-mesh install --profile=standard --non-interactive`
4. Distributes to team with documentation
5. Team members get consistent setup
6. Marcus later adds Vue skills team-wide: `npx @fortium/ai-mesh skill install vue --team-config`
7. Team stays synchronized

**Success Criteria**: Consistent team setup, manageable expansion

---

## Functional Requirements

### FR-1: Installation Profile Selection
**Priority**: P0
**Description**: Present users with 3 installation profiles during setup

**Acceptance Criteria**:
- Display profile options at installation start
- Show clear comparison: agents, size, time, recommended use
- Support CLI flags: `--profile=starter|standard|complete`
- Default to "standard" if user skips selection
- Allow profile upgrade later without reinstallation

### FR-2: Starter Profile
**Priority**: P0
**Description**: Minimal installation for quick evaluation

**Specification**:
```yaml
Profile: Starter
Agents: 8 core agents
  - ai-mesh-orchestrator
  - general-purpose
  - code-reviewer
  - git-workflow
  - test-runner
  - documentation-specialist
  - frontend-developer (basic, no framework skills)
  - backend-developer (basic, no framework skills)
Skills: 0 (loaded on-demand)
Size: 15MB
Setup Time: 45 seconds
Use Case: First-time users, quick evaluation, learning
```

**Acceptance Criteria**:
- Installation completes in ≤45 seconds
- Package size ≤15MB
- All 8 core agents functional
- Frontend/backend agents work without framework-specific features
- On-demand loading prompts functional

### FR-3: Standard Profile
**Priority**: P0
**Description**: Balanced installation for most users

**Specification**:
```yaml
Profile: Standard
Agents: 16 agents (core 8 + common specialists)
  Core 8: (same as Starter)
  Additional 8:
    - infrastructure-developer
    - playwright-tester
    - nestjs-backend-expert (or framework specialist)
    - react-component-architect (or framework specialist)
    - deployment-orchestrator
    - tech-lead-orchestrator
    - product-management-orchestrator
    - file-creator
Skills: 3-4 most common
  - React (16% frontend market)
  - NestJS (popular backend)
  - Kubernetes (35% IaC)
  - Fly.io (growing platform)
Size: 45MB
Setup Time: 90 seconds
Use Case: Regular developers, common frameworks, production use
```

**Acceptance Criteria**:
- Installation completes in ≤90 seconds
- Package size ≤45MB
- 16 agents + 4 skills functional
- Covers 80% of common use cases
- Easy expansion to complete when needed

### FR-4: Complete Profile
**Priority**: P0
**Description**: Full installation for power users

**Specification**:
```yaml
Profile: Complete
Agents: 26 (all agents)
  - All agents from Starter + Standard
  - Plus: All specialized agents (Phoenix, Rails, Blazor, etc.)
Skills: 8 (all available skills)
  - React, Blazor, NestJS, Phoenix, Rails, .NET
  - Helm, Kubernetes, Fly.io
Size: 85MB
Setup Time: 120 seconds
Use Case: Power users, complete feature set, no on-demand loading
```

**Acceptance Criteria**:
- Installation completes in ≤120 seconds (same as current)
- Package size ≤85MB (same as current)
- All 26 agents + 8 skills functional
- No on-demand prompts (has everything)
- Identical to current full installation experience

### FR-5: Automatic Framework Detection
**Priority**: P0
**Description**: Detect project frameworks during usage and prompt for skills

**Acceptance Criteria**:
- Scan project directory when agent invoked
- Detect frameworks: React, Vue, Django, Rails, NestJS, etc.
- Check if relevant skills already installed
- Prompt user if skills needed but not installed
- Cache detection results (avoid repeated scans)

**Detection Triggers**:
```yaml
When to Detect:
  - Agent invocation (e.g., /implement-trd, frontend-developer usage)
  - Command execution requiring framework knowledge
  - Explicit check: /check-skills

What to Detect:
  - Frontend: React, Vue, Angular, Svelte (package.json)
  - Backend: Django, Rails, NestJS, Phoenix (project files)
  - IaC: Terraform, Helm, K8s, Fly.io (config files)

Detection Method:
  - Reuse existing tooling-detector (95%+ accuracy)
  - Check package.json, requirements.txt, Gemfile, etc.
  - Scan for specific config files (fly.toml, Chart.yaml, etc.)
```

### FR-6: Just-In-Time Skill Loading
**Priority**: P0
**Description**: Prompt users to install skills when detected

**Acceptance Criteria**:
- Show clear, actionable prompt when framework detected
- Display: skill name, size, estimated install time
- Provide [Y/n] choice with default=Yes
- Install skill immediately on confirmation
- Continue workflow seamlessly after installation
- Support `--yes` flag to auto-accept all prompts

**Prompt Format**:
```
🔍 Detected React project

Install React development skills?
  • Composition API, Hooks, Component patterns
  • Size: 5MB | Time: <30s

Install React skills now? [Y/n]: _
```

**Acceptance Criteria**:
- Prompt appears immediately after detection
- Clear information about what's being installed
- Non-blocking (user can decline)
- Installs in <30 seconds
- No errors if user declines

### FR-7: Profile Upgrade Path
**Priority**: P1
**Description**: Allow users to upgrade profiles without reinstallation

**Acceptance Criteria**:
- Command: `npx @fortium/ai-mesh upgrade --to=standard|complete`
- Shows what will be added (agents, skills, size, time)
- Preserves existing configuration and data
- Atomic upgrade (fails safely if interrupted)
- Rollback capability if upgrade fails

### FR-8: Skill Management Commands
**Priority**: P1
**Description**: Manual skill installation and management

**Acceptance Criteria**:
- Install: `npx @fortium/ai-mesh skill install <skill-name>`
- List: `npx @fortium/ai-mesh skill list [--installed]`
- Remove: `npx @fortium/ai-mesh skill remove <skill-name>`
- Update: `npx @fortium/ai-mesh skill update <skill-name>`
- Info: `npx @fortium/ai-mesh skill info <skill-name>`

### FR-9: Non-Interactive Mode
**Priority**: P1
**Description**: Support scripted installations without prompts

**Acceptance Criteria**:
- Flag: `--non-interactive` or `--yes` or `-y`
- Auto-selects default options (standard profile)
- Auto-confirms all skill installation prompts
- Suitable for CI/CD, team rollouts, automation
- Returns non-zero exit code on errors

### FR-10: Offline Installation Support
**Priority**: P2
**Description**: Support installations without network access

**Acceptance Criteria**:
- Package all profiles in initial download
- Skill installation works offline (from cached bundle)
- No network requests required for standard workflows
- Optional: separate offline installation bundle

---

## Non-Functional Requirements

### NFR-1: Performance
- Starter installation: ≤45 seconds (target: 40s)
- Standard installation: ≤90 seconds (target: 80s)
- Complete installation: ≤120 seconds (current baseline)
- Skill installation: ≤30 seconds per skill
- Framework detection: ≤500ms

### NFR-2: Reliability
- Installation success rate: >99%
- Atomic operations (no partial installs)
- Safe interruption handling (resume or rollback)
- No data loss on upgrade/downgrade
- Comprehensive error messages

### NFR-3: Usability
- Clear profile descriptions with use case guidance
- Visual progress indicators for installations
- Non-intrusive skill prompts (dismissible)
- Help text and examples for all commands
- Consistent with existing AI Mesh CLI patterns

### NFR-4: Compatibility
- Works with existing full installations (no breaking changes)
- Backward compatible with previous versions
- Upgrade path from any previous version
- Works on macOS, Linux, Windows (consistent with current)

### NFR-5: Storage Efficiency
- Shared dependencies (no duplication across profiles)
- Incremental storage (skills add incrementally, not duplicate base)
- Cleanup of unused files after profile changes
- Disk space warnings before large installations

---

## Acceptance Criteria

### Installation Profile Acceptance Criteria

**AC-1: Profile Selection**
- GIVEN a user runs `npx @fortium/ai-mesh install`
- WHEN installation starts
- THEN user must see 3 profile options with clear descriptions
- AND default selection is "Standard" if user skips

**AC-2: Starter Profile Speed**
- GIVEN a user selects "Starter" profile
- WHEN installation completes
- THEN installation time must be ≤45 seconds
- AND package size must be ≤15MB
- AND 8 core agents must be functional

**AC-3: Standard Profile Balance**
- GIVEN a user selects "Standard" profile
- WHEN installation completes
- THEN installation time must be ≤90 seconds
- AND package size must be ≤45MB
- AND 16 agents + 4 skills must be functional

**AC-4: Complete Profile Equivalence**
- GIVEN a user selects "Complete" profile
- WHEN installation completes
- THEN experience must be identical to current full installation
- AND all 26 agents + 8 skills must be functional

### Framework Detection Acceptance Criteria

**AC-5: Automatic Detection**
- GIVEN a project with package.json containing "react"
- WHEN frontend-developer agent is invoked
- THEN system must detect React framework
- AND prompt user to install React skills if not present

**AC-6: Detection Accuracy**
- GIVEN 100 diverse projects (React, Vue, Django, Rails, etc.)
- WHEN detection runs on each project
- THEN accuracy must be >95% (consistent with existing tooling-detector)
- AND zero false positives (no incorrect framework detection)

**AC-7: Detection Performance**
- GIVEN a typical project directory
- WHEN framework detection runs
- THEN detection must complete in <500ms
- AND not block other operations

### Just-In-Time Loading Acceptance Criteria

**AC-8: Skill Prompt**
- GIVEN React detected but React skills not installed
- WHEN prompt is shown
- THEN must display: skill name, size, time estimate, [Y/n] choice
- AND prompt must be dismissible (user can decline)

**AC-9: Skill Installation Speed**
- GIVEN user confirms skill installation
- WHEN installation starts
- THEN installation must complete in <30 seconds
- AND workflow must continue seamlessly

**AC-10: Non-Intrusive Prompts**
- GIVEN multiple frameworks detected in one session
- WHEN prompts appear
- THEN max 1 prompt per agent invocation
- AND prompts can be suppressed with flag

### Profile Upgrade Acceptance Criteria

**AC-11: Upgrade Without Reinstall**
- GIVEN user has Starter profile installed
- WHEN user runs `npx @fortium/ai-mesh upgrade --to=complete`
- THEN system must upgrade to Complete profile
- AND preserve existing configuration and data
- AND complete in ≤60 seconds (only adding new components)

**AC-12: Rollback Safety**
- GIVEN upgrade is interrupted (Ctrl+C, crash, etc.)
- WHEN user restarts AI Mesh
- THEN system must be in consistent state (original or upgraded)
- AND no data loss or corruption

### Non-Interactive Mode Acceptance Criteria

**AC-13: Scripted Installation**
- GIVEN user runs `npx @fortium/ai-mesh install --profile=standard --non-interactive`
- WHEN installation proceeds
- THEN no prompts must appear
- AND standard profile must be installed with defaults

**AC-14: CI/CD Compatibility**
- GIVEN installation in CI/CD pipeline
- WHEN using --non-interactive flag
- THEN installation must complete without human input
- AND exit with appropriate code (0=success, non-zero=error)

---

## Technical Considerations

### Architecture

```yaml
Components:
  1. Profile Manager:
     - Profile definitions (starter, standard, complete)
     - Package manifests for each profile
     - Installation orchestration
     - Upgrade/downgrade logic

  2. Skill Loader:
     - Framework detection (integrate with tooling-detector)
     - Skill catalog and metadata
     - Just-in-time installation logic
     - Prompt UI and user interaction

  3. Installation Engine:
     - File copying and unpacking
     - Dependency resolution
     - Progress tracking
     - Error handling and rollback

  4. Storage Manager:
     - Profile state tracking
     - Installed agents/skills registry
     - Configuration persistence
     - Cleanup and optimization

Technology Stack:
  - Language: Node.js (consistent with existing)
  - CLI Framework: Commander.js (existing)
  - Progress UI: ora, chalk for terminal output
  - Storage: JSON files in ~/.ai-mesh/
  - Detection: Reuse tooling-detector
```

### Profile Package Structure

```
@fortium/ai-mesh/
├── profiles/
│   ├── starter/
│   │   ├── agents/ (8 core agents)
│   │   ├── commands/ (essential commands)
│   │   └── manifest.json
│   ├── standard/
│   │   ├── agents/ (16 agents)
│   │   ├── skills/ (4 common skills)
│   │   ├── commands/
│   │   └── manifest.json
│   └── complete/
│       ├── agents/ (26 agents)
│       ├── skills/ (8 skills)
│       ├── commands/
│       └── manifest.json
├── skills-catalog/
│   ├── react/
│   ├── vue/
│   ├── django/
│   ├── terraform/
│   └── (all skills available)
└── src/
    ├── installer/
    ├── skill-loader/
    └── profile-manager/
```

### Manifests Format

```json
{
  "profile": "standard",
  "version": "3.5.0",
  "size_mb": 45,
  "install_time_seconds": 90,
  "agents": [
    "ai-mesh-orchestrator",
    "general-purpose",
    ...
  ],
  "skills": [
    "react-framework",
    "nestjs-framework",
    "kubernetes",
    "flyio"
  ],
  "commands": [
    "create-prd",
    "create-trd",
    "implement-trd",
    ...
  ]
}
```

### Integration Points

1. **Existing Installer**:
   - Extend current `install.sh` or `npx @fortium/ai-mesh install`
   - Add profile selection logic
   - Maintain backward compatibility

2. **Tooling Detector**:
   - Reuse `skills/tooling-detector/detect-tooling.js`
   - Call during agent invocations
   - Cache results for session

3. **Agent System**:
   - Agents check for required skills before execution
   - Trigger skill loading prompts when needed
   - Graceful degradation if skills declined

4. **Skill System**:
   - Skills register with framework detection patterns
   - Skills define installation metadata (size, time, etc.)
   - Skills load dynamically without restart

### Dependencies

- **Required**: Node.js 18+, npm 8+
- **Optional**: None (fully self-contained)
- **External**: None (all bundled in package)

### Constraints

1. **Technical**:
   - Installation must work offline (no network dependencies)
   - Atomic operations (no partial states)
   - Fast detection (<500ms)
   - Minimal storage overhead

2. **Operational**:
   - 3-4 day development timeline
   - Must work with existing installations (upgrade path)
   - Comprehensive testing on all platforms
   - Clear migration documentation

3. **Business**:
   - P0 priority (critical for adoption)
   - Must achieve 85% setup time reduction
   - ROI target: 9/10

---

## Success Metrics

### Primary Metrics

**M-1: Setup Time Reduction**
- **Target**: 85% faster first-time setup
- **Measurement**: Time from `npx @fortium/ai-mesh install` to first agent usage
- **Baseline**: 120 seconds (current full install)
- **Target**: 45 seconds (starter), 90 seconds (standard)

**M-2: Adoption Rate Increase**
- **Target**: 50% increase in completed installations
- **Measurement**: % of users who complete setup vs abandon
- **Baseline**: ~60% completion rate (estimated)
- **Target**: 90% completion rate

**M-3: User Satisfaction**
- **Target**: >80% report improved onboarding experience
- **Measurement**: Post-install survey, GitHub issues, feedback
- **Baseline**: Current feedback mentions complexity/overwhelm
- **Target**: "Easy", "Fast", "Not overwhelming" feedback

### Secondary Metrics

**M-4: Profile Distribution**
- **Target**: Understand profile preferences
- **Measurement**: % choosing Starter/Standard/Complete
- **Expected**: 40% starter, 45% standard, 15% complete

**M-5: Skill Loading Frequency**
- **Target**: On-demand loading is utilized
- **Measurement**: Number of just-in-time skill installations per user
- **Expected**: 1-2 skills installed on-demand per user in first month

**M-6: Time-to-Productivity**
- **Target**: Users productive faster
- **Measurement**: Time from install to first successful task completion
- **Baseline**: ~15-20 minutes
- **Target**: <10 minutes

### Leading Indicators

- Installation completion rate (target: >90%)
- First-week agent usage diversity (measure of exploration)
- Skill installation acceptance rate (target: >70% accept prompts)
- Support ticket reduction for "too complex" or "how to start" issues

---

## Risks & Mitigation

### Risk 1: Profile Confusion
**Impact**: Medium | **Probability**: Medium
**Description**: Users may not understand which profile to choose
**Mitigation**:
- Clear descriptions with use case recommendations
- Default to "Standard" (best for most)
- Allow easy upgrade later
- Provide comparison table in documentation

### Risk 2: Skill Prompt Fatigue
**Impact**: Medium | **Probability**: Low
**Description**: Too many prompts could annoy users
**Mitigation**:
- Limit to 1 prompt per agent invocation
- Remember user choices (don't re-prompt)
- Support --yes flag to auto-accept
- Make prompts dismissible

### Risk 3: Breaking Existing Installations
**Impact**: High | **Probability**: Low
**Description**: Changes could break current full installations
**Mitigation**:
- Complete profile = current installation (no changes)
- Thorough backward compatibility testing
- Upgrade path for existing users
- Rollback capability

### Risk 4: Detection Failures
**Impact**: Medium | **Probability**: Low
**Description**: Framework detection might fail or be slow
**Mitigation**:
- Reuse proven tooling-detector (95%+ accuracy)
- Manual skill installation always available
- Cache detection results
- Performance monitoring

---

## Implementation Plan

### Phase 1: Profile System (Days 1-2)
- Design profile manifests (starter, standard, complete)
- Implement profile selection UI
- Create installation orchestration logic
- Build progress tracking and reporting

**Deliverables**: Working profile selection, basic installation

### Phase 2: Skill Loading (Days 2-3)
- Integrate framework detection (tooling-detector)
- Implement just-in-time loading prompts
- Build skill installation logic
- Create skill management commands

**Deliverables**: On-demand skill loading functional

### Phase 3: Polish & Testing (Days 3-4)
- Non-interactive mode
- Profile upgrade commands
- Comprehensive testing (all platforms)
- Error handling and rollback
- Documentation and migration guides

**Deliverables**: Production-ready feature

### Phase 4: Launch & Monitor (Post-Development)
- Deploy to npm
- Monitor success metrics
- Gather user feedback
- Iterate on profile definitions
- Plan ML-based skill recommendations for v2

---

## Dependencies & Prerequisites

### Required Before Start
- ✅ Existing installer infrastructure (install.sh or npx)
- ✅ Tooling detector with 95%+ accuracy
- ✅ Skill system architecture (existing)
- ✅ Agent system supports dynamic loading

### Required During Development
- Profile manifest definitions
- Installation testing across platforms
- User feedback mechanisms
- Migration testing with existing installations

### Required for Launch
- Comprehensive test coverage (>80%)
- Migration guide for existing users
- Updated documentation with profile explanations
- Success metrics dashboard

---

## Open Questions

1. **Q**: Should we allow custom profiles (user-defined agent/skill sets)?
   **A**: Phase 2 feature, start with 3 predefined profiles

2. **Q**: How to handle team-wide profile standardization?
   **A**: Support team configuration files, profile enforcement via CI/CD

3. **Q**: Should skills be pre-downloaded or fetched on-demand?
   **A**: Pre-download all in package, install on-demand (offline-friendly)

4. **Q**: What if user's project uses uncommon framework not in our skills?
   **A**: Agent degrades gracefully, prompts for manual configuration, logs for future skill development

---

## Appendix

### A. Profile Comparison Table

| Feature | Starter | Standard | Complete |
|---------|---------|----------|----------|
| **Agents** | 8 core | 16 (core + common) | 26 (all) |
| **Skills** | 0 (on-demand) | 4 (popular) | 8 (all) |
| **Size** | 15MB | 45MB | 85MB |
| **Time** | 45s | 90s | 120s |
| **Use Case** | First-time, evaluation | Regular developers | Power users |
| **Coverage** | 60% use cases | 80% use cases | 100% use cases |

### B. Installation Flow Diagram

```
npx @fortium/ai-mesh install
        ↓
Select Profile:
  [1] Starter (8 agents, 15MB, 45s)
  [2] Standard (16 agents, 45MB, 90s) ← default
  [3] Complete (26 agents, 85MB, 120s)
        ↓
Download & Install Selected Profile
        ↓
Complete ✓
        ↓
[Usage]
        ↓
Framework Detected (e.g., React)
        ↓
Prompt: "Install React skills? [Y/n]"
        ↓
[Y] → Install skill (30s) → Continue
[n] → Continue with degraded features
```

### C. Sample Prompts

**Profile Selection**:
```
🚀 Welcome to AI Mesh Installation!

Choose your installation profile:

  [1] Starter (Recommended for first-time users)
      • 8 core agents
      • Skills load on-demand
      • 15MB | ~45 seconds
      • Perfect for: Evaluation, learning, quick start

  [2] Standard (Recommended for most users) ← DEFAULT
      • 16 agents + popular skills (React, K8s, NestJS, Fly.io)
      • 45MB | ~90 seconds
      • Perfect for: Regular development, production use

  [3] Complete (Power users)
      • All 26 agents + all 8 skills
      • 85MB | ~120 seconds
      • Perfect for: Expert users, complete feature set

Select profile [1-3] (default: 2): _
```

**Framework Detection**:
```
🔍 Detected React project in /Users/user/my-app

The frontend-developer agent works best with React skills installed.

Install React development skills now?
  • React Hooks, Context API, Component patterns
  • Performance optimization techniques
  • Testing with React Testing Library
  • Size: 5MB | Time: <30 seconds

Install React skills? [Y/n]: _
```

### D. Migration Guide (Existing Users)

For users with current full installation:

```bash
# Check current installation
npx @fortium/ai-mesh status

# Output: "Complete profile (all features installed)"

# No action needed - your installation is equivalent to "Complete" profile
# All features remain available
# Optional: Downgrade to save space (rare)
npx @fortium/ai-mesh downgrade --to=standard
```

---

**Document Version**: 1.0
**Last Updated**: October 31, 2025
**Next Review**: After Phase 3 (Day 3)
**Approval**: Pending Implementation
