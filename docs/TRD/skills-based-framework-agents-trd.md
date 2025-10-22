# Technical Requirements Document: Skills-Based Framework Architecture

## Document Metadata

- **Project**: Skills-Based Framework Architecture
- **TRD Version**: 1.0.0
- **Created**: 2025-10-21
- **Status**: Draft - Ready for Review
- **Related PRD**: [docs/PRD/skills-based-framework-agents.md](../PRD/skills-based-framework-agents.md) (v1.1.0)
- **Author**: Tech Lead Orchestrator
- **Target Release**: v3.1.0 (6-week timeline)
- **Estimated Total Effort**: 240 hours (6 weeks @ 40 hours/week)

## Executive Summary

### Project Overview

Transform the claude-config agent ecosystem from 6 framework-specialist agents (42KB total) to a skills-based architecture where 2 generic agents (backend-developer, frontend-developer) dynamically load modular framework skills on-demand. This change reduces agent definition bloat by 63% while improving maintainability and enabling rapid framework updates.

### Technical Scope

**Core Components**:
1. **Framework Detection System**: Automated framework identification from project files
2. **6 Framework Skills**: NestJS, Phoenix, Rails, .NET, React, Blazor with Progressive Disclosure pattern
3. **Skill Loading Mechanism**: Lazy loading with session-lifetime caching and security validation
4. **Agent Enhancements**: Modify backend-developer and frontend-developer for skill integration
5. **Migration Infrastructure**: Hard cutover with comprehensive testing and rollback capability

**Technology Stack**:
- **Skill Loading**: Node.js with file system operations
- **Framework Detection**: JavaScript with pattern matching (JSON, YAML, XML parsing)
- **Versioning**: Semantic versioning with compatibility range validation
- **Security**: File size limits (SKILL.md: 100KB, REFERENCE.md: 1MB) + content sanitization
- **Caching**: In-memory Map-based cache with session lifetime

### Timeline & Phases

| Phase | Duration | Deliverables | Status |
|-------|----------|--------------|--------|
| **Phase 1**: Proof of Concept | 2 weeks | framework-detector + 2 skills (NestJS, React) | 🟢 Ready to Start |
| **Phase 2**: Core Migration | 3 weeks | 4 additional skills (Phoenix, Rails, .NET, Blazor) | 🟡 Blocked by Phase 1 |
| **Phase 3**: Documentation | 1 week | Migration guide + deprecation notices | 🟡 Blocked by Phase 2 |
| **Phase 4**: Monitoring | Ongoing | Feedback collection + iteration | 🟡 Blocked by Phase 3 |

### Success Criteria

- **Framework Detection**: ≥95% accuracy across 50+ test projects
- **Skill Loading Performance**: <100ms for SKILL.md, <500ms for REFERENCE.md
- **Code Generation**: ≥95% success rate (passes linting without errors)
- **User Satisfaction**: ≥90% approval after 1-month usage
- **Maintenance Improvement**: Framework updates <30 minutes (baseline: 3 hours)

---

## System Context & Constraints

### Technical Environment

**Current Architecture**:
```
claude-config/
├── agents/yaml/                 # 35 total agents (6 framework-specialists to be deprecated)
│   ├── backend-developer.yaml   (7KB)
│   ├── frontend-developer.yaml  (10KB)
│   ├── nestjs-backend-expert.yaml        (17KB) ← TO DEPRECATE
│   ├── elixir-phoenix-expert.yaml        (16KB) ← TO DEPRECATE
│   ├── rails-backend-expert.yaml         (3KB)  ← TO DEPRECATE
│   ├── dotnet-backend-expert.yaml        (1.4KB) ← TO DEPRECATE
│   ├── react-component-architect.yaml    (3.2KB) ← TO DEPRECATE
│   └── dotnet-blazor-expert.yaml         (1.6KB) ← TO DEPRECATE
├── skills/                      # Test framework skills (existing pattern)
│   ├── jest-test/
│   ├── pytest-test/
│   └── test-detector/
└── commands/yaml/               # Command implementations
```

**Target Architecture**:
```
claude-config/
├── agents/yaml/                 # 29 agents (6 fewer)
│   ├── backend-developer.yaml   (12KB with skill loading logic)
│   └── frontend-developer.yaml  (15KB with skill loading logic)
├── skills/                      # Framework skills (NEW)
│   ├── framework-detector/
│   ├── nestjs-framework/
│   ├── phoenix-framework/
│   ├── rails-framework/
│   ├── dotnet-framework/
│   ├── react-framework/
│   └── blazor-framework/
```

### Dependencies

**External Dependencies**:
- **Node.js**: v18+ (for skill loading scripts)
- **YAML Parsing**: js-yaml library for frontmatter extraction
- **File System**: fs/promises for async skill loading
- **Pattern Matching**: Glob patterns for framework detection

**Internal Dependencies**:
- **Agent Schema**: schemas/agent-schema.json for agent YAML validation
- **Existing Skills**: skills/test-detector/ as pattern reference
- **AI Mesh Orchestrator**: agents/ai-mesh-orchestrator.yaml for delegation logic
- **Installation System**: src/installer/ for skill deployment

### Constraints & Limitations

**Technical Constraints**:
1. **Context Window Limits**: 200K token limit requires Progressive Disclosure (SKILL.md first, REFERENCE.md on-demand)
2. **File Size Limits**: SKILL.md ≤100KB, REFERENCE.md ≤1MB (security + performance)
3. **Framework Detection**: No code execution during detection (file reading only)
4. **Backward Compatibility**: Framework-specialist agents must remain functional during migration

**Business Constraints**:
1. **Timeline**: 6-week migration window (cannot exceed)
2. **Zero Disruption**: Existing workflows must continue working during transition
3. **Testing Coverage**: ≥80% code coverage required before cutover
4. **Rollback Capability**: Must support rollback within 24 hours if failure rate >10%

---

## Architecture Overview

### System Components

#### 1. Framework Detection System

**Component**: `skills/framework-detector/`

**Responsibilities**:
- Scan project files for framework signatures (package.json, Gemfile, *.csproj, mix.exs)
- Generate confidence scores for detected frameworks (0.0-1.0)
- Return primary framework + confidence + alternate frameworks
- Support manual framework override via flags

**Interfaces**:
```typescript
interface FrameworkDetectionResult {
  primary: string | null;          // "nestjs" | "phoenix" | "rails" | "dotnet" | "react" | "blazor" | null
  confidence: number;              // 0.0 - 1.0
  alternates: FrameworkMatch[];    // Other detected frameworks
  detectionMethod: string;         // "package.json" | "gemfile" | "csproj" | "mix.exs" | "manual"
  projectRoot: string;             // Absolute path to detected project root
}

interface FrameworkMatch {
  framework: string;
  confidence: number;
  evidence: string[];              // Files/patterns that triggered detection
}
```

**Detection Patterns**:
```json
{
  "nestjs": {
    "files": ["package.json"],
    "patterns": {
      "dependencies": ["@nestjs/core", "@nestjs/common"],
      "devDependencies": ["@nestjs/cli", "@nestjs/testing"]
    },
    "confidence_boost": 0.3
  },
  "phoenix": {
    "files": ["mix.exs"],
    "patterns": {
      "deps": ["phoenix", "phoenix_html", "phoenix_live_view"]
    },
    "confidence_boost": 0.4
  },
  "rails": {
    "files": ["Gemfile", "config/application.rb"],
    "patterns": {
      "gems": ["rails"],
      "config": ["Rails.application"]
    },
    "confidence_boost": 0.4
  },
  "dotnet": {
    "files": ["*.csproj"],
    "patterns": {
      "PackageReference": ["Microsoft.AspNetCore.App", "Microsoft.EntityFrameworkCore"]
    },
    "confidence_boost": 0.3
  },
  "react": {
    "files": ["package.json"],
    "patterns": {
      "dependencies": ["react", "react-dom"]
    },
    "confidence_boost": 0.3
  },
  "blazor": {
    "files": ["*.csproj"],
    "patterns": {
      "PackageReference": ["Microsoft.AspNetCore.Components.WebAssembly", "Microsoft.AspNetCore.Components.Server"]
    },
    "confidence_boost": 0.4
  }
}
```

#### 2. Framework Skill Structure

**Component**: `skills/{framework-name}/`

**Directory Layout**:
```
skills/{framework-name}/
├── SKILL.md                     # Quick reference (≤2KB target, 100KB hard limit)
├── REFERENCE.md                 # Comprehensive guide (≤20KB target, 1MB hard limit)
├── templates/                   # Code generation templates
│   ├── {pattern}.template.{ext}
│   └── ...
└── examples/                    # Anti-patterns + best practices
    ├── {concept}.md
    └── ...
```

**SKILL.md Frontmatter Schema**:
```yaml
---
name: String                     # Human-readable framework name
version: String                  # Semantic version (1.0.0)
framework_versions:              # Supported framework versions
  min: String                    # Minimum version (10.0.0)
  max: String                    # Maximum version (11.x)
  recommended: String            # Recommended version (11.4.0)
compatible_agents:               # Agent version requirements
  backend-developer: String      # Version range (>=3.0.0)
  frontend-developer: String     # Version range (>=3.0.0)
description: String              # One-line framework description
frameworks: [String]             # Framework identifiers (["nestjs"])
languages: [String]              # Primary languages (["typescript", "javascript"])
updated: String                  # Last update date (ISO 8601) [OPTIONAL]
maintainer: String               # Primary maintainer [OPTIONAL]
breaking_changes: [String]       # Breaking changes from previous version [OPTIONAL]
migration_notes: String          # Upgrade guidance [OPTIONAL]
---
```

**Content Structure** (SKILL.md):
```markdown
# {Framework Name} Framework Skill

## Quick Reference

**When to Use**: {Detection triggers}
**Language**: {Primary language}
**Version Support**: {Supported versions}

## Core Patterns

### Architecture
- {Key architectural pattern 1}
- {Key architectural pattern 2}

### Common Operations
- {Operation 1 with code snippet}
- {Operation 2 with code snippet}

## Code Generation Templates

Available templates:
- `templates/{template-name}.template.{ext}` - {Description}

## See Also
- [REFERENCE.md](REFERENCE.md) - Comprehensive framework guide
- [examples/](examples/) - Anti-patterns and best practices
```

#### 3. Skill Loading Mechanism

**Component**: Agent skill loading logic (embedded in backend-developer, frontend-developer)

**Implementation**:
```javascript
// Embedded in agent YAML as behavior guidance
class SkillLoader {
  constructor() {
    this.cache = new Map(); // skillPath → { content, loadedAt }
  }

  async detectFramework(projectRoot) {
    // 1. Execute framework-detector skill
    const result = await executeSkill('framework-detector/detect-framework.js', { projectRoot });

    // 2. Validate confidence threshold
    if (result.confidence < 0.8) {
      // Prompt user for manual framework selection
      return await promptUserForFramework(result.alternates);
    }

    return result.primary;
  }

  async loadSkill(framework, detailLevel = 'quick') {
    // 1. Construct skill path
    const skillPath = `skills/${framework}-framework/SKILL.md`;
    const referencePath = `skills/${framework}-framework/REFERENCE.md`;

    // 2. Check cache first
    if (this.cache.has(skillPath)) {
      return this.cache.get(skillPath).content;
    }

    // 3. Validate file exists and size
    try {
      const stats = await fs.stat(skillPath);
      if (stats.size > 100 * 1024) { // 100KB limit
        throw new Error(`Skill file exceeds size limit: ${stats.size} bytes`);
      }

      // 4. Load and sanitize content
      let content = await fs.readFile(skillPath, 'utf-8');
      content = this.sanitizeContent(content);

      // 5. Parse frontmatter and validate version compatibility
      const { frontmatter, body } = this.parseFrontmatter(content);
      await this.validateCompatibility(frontmatter);

      // 6. Cache for session
      this.cache.set(skillPath, { content: body, loadedAt: Date.now() });

      // 7. Load REFERENCE.md if detail level requires it
      if (detailLevel === 'comprehensive') {
        await this.loadSkill(framework, 'reference');
      }

      return body;
    } catch (error) {
      // 8. Error handling with user prompt
      return await this.handleSkillLoadError(framework, error);
    }
  }

  sanitizeContent(content) {
    // Remove HTML/script tags
    content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    content = content.replace(/<[^>]+>/g, '');
    return content;
  }

  async validateCompatibility(frontmatter) {
    const agentVersion = this.getAgentVersion(); // backend-developer version
    const requiredVersion = frontmatter.compatible_agents[this.agentName];

    if (!this.satisfiesVersionRange(agentVersion, requiredVersion)) {
      throw new Error(`Skill requires ${this.agentName} ${requiredVersion}, but current version is ${agentVersion}`);
    }
  }

  async handleSkillLoadError(framework, error) {
    // Prompt user with options
    const userChoice = await prompt(`
      Failed to load skill '${framework}-framework': ${error.message}

      Options:
      1. Continue with generic patterns (reduced framework specificity)
      2. Abort task and resolve skill issue
      3. Manually specify alternative skill/framework

      Select option [1-3]:
    `);

    switch (userChoice) {
      case '1': return null; // Continue without skill
      case '2': throw new Error('Task aborted by user due to skill load failure');
      case '3': return await this.promptForAlternativeSkill();
    }
  }
}
```

#### 4. Agent Modifications

**Modified Agents**:
- **backend-developer.yaml**: Add framework detection + skill loading logic
- **frontend-developer.yaml**: Add framework detection + skill loading logic

**New Agent Sections**:
```yaml
expertise:
  - name: Framework Skill Integration
    description: |
      Dynamically load framework-specific skills based on project detection.
      Leverage progressive disclosure (SKILL.md → REFERENCE.md) for efficient context usage.

    workflow: |
      1. Detect framework using framework-detector skill
      2. Load {framework}-framework/SKILL.md for quick reference
      3. If complex patterns needed, load {framework}-framework/REFERENCE.md
      4. Use templates from {framework}-framework/templates/ for code generation
      5. Apply framework-specific best practices from skill content

    error_handling: |
      - If skill not found: Prompt user with options (continue generic, abort, manual selection)
      - If version incompatible: Warn user and offer to continue or abort
      - If detection confidence <0.8: Prompt user for manual framework selection
      - Log all skill loading errors for debugging

  - name: Supported Framework Skills
    description: |
      Framework skills available for dynamic loading:
      - nestjs-framework: Node.js/TypeScript with NestJS (DI, decorators, modules)
      - phoenix-framework: Elixir/Phoenix (contexts, LiveView, PubSub)
      - rails-framework: Ruby on Rails (MVC, ActiveRecord, Sidekiq)
      - dotnet-framework: .NET/ASP.NET Core (controllers, EF Core, DI)
      - react-framework: React with hooks, context, composition patterns
      - blazor-framework: Blazor Server/WASM with component lifecycle
```

### Data Flow & Integration Points

**Workflow Sequence**:
```mermaid
sequenceDiagram
    participant User
    participant AIMeshOrch as ai-mesh-orchestrator
    participant BackendDev as backend-developer
    participant FrameworkDetect as framework-detector
    participant NestJSSkill as nestjs-framework
    participant FileSystem as File System

    User->>AIMeshOrch: /implement-trd (task: "Create user API")
    AIMeshOrch->>BackendDev: Delegate backend task
    BackendDev->>FrameworkDetect: Detect framework (projectRoot)
    FrameworkDetect->>FileSystem: Read package.json
    FileSystem-->>FrameworkDetect: {"dependencies": {"@nestjs/core": "^10.0.0"}}
    FrameworkDetect-->>BackendDev: {primary: "nestjs", confidence: 0.95}

    BackendDev->>NestJSSkill: Load SKILL.md
    NestJSSkill->>FileSystem: Read skills/nestjs-framework/SKILL.md
    FileSystem-->>NestJSSkill: Skill content (2KB)
    NestJSSkill-->>BackendDev: Quick reference loaded

    BackendDev->>NestJSSkill: Load templates/controller.template.ts
    NestJSSkill->>FileSystem: Read template file
    FileSystem-->>NestJSSkill: Template content
    NestJSSkill-->>BackendDev: Template ready

    BackendDev->>BackendDev: Generate code using template + skill patterns
    BackendDev-->>User: Generated idiomatic NestJS code
```

**Integration Points**:

1. **ai-mesh-orchestrator ↔ Generic Agents**:
   - Delegation: Task routing to backend-developer or frontend-developer
   - Context: Project root path passed for framework detection
   - Fallback: If skill loading fails, fallback to generic patterns

2. **Generic Agents ↔ framework-detector**:
   - Input: Project root path
   - Output: Framework detection result with confidence
   - Error Handling: Confidence <0.8 triggers user prompt

3. **Generic Agents ↔ Framework Skills**:
   - Progressive Loading: SKILL.md first, REFERENCE.md on-demand
   - Caching: Session-lifetime cache for performance
   - Validation: Version compatibility check before loading

4. **Framework Skills ↔ File System**:
   - Read Operations: Load SKILL.md, REFERENCE.md, templates
   - Security: File size validation + content sanitization
   - Error Handling: Graceful failure with user notification

---

## Master Task List

**Project Status**: 🟡 In Progress (Sprint 1) | **Total Tasks**: 58 | **Completed**: 15 | **Remaining**: 43

### Task Summary by Category

- [x] **Foundation Tasks**: 8 tasks (8 completed) ✅
- [x] **Framework Detection Tasks**: 7 tasks (7 completed) ✅
- [ ] **NestJS Skill Tasks**: 8 tasks (0 completed)
- [ ] **React Skill Tasks**: 7 tasks (0 completed)
- [ ] **Core Framework Skills Tasks**: 16 tasks (0 completed)
- [ ] **Agent Integration Tasks**: 4 tasks (0 completed)
- [ ] **Testing & Validation Tasks**: 6 tasks (0 completed)
- [ ] **Documentation & Migration Tasks**: 2 tasks (0 completed)

---

## All Tasks (Detailed)

### Foundation Tasks (8 tasks)

- [x] **TRD-001**: Create skills/ directory structure with subdirectories (2h) - Priority: High - Depends: None
- [x] **TRD-002**: Define skill frontmatter YAML schema in schemas/skill-schema.json (4h) - Priority: High - Depends: None
- [x] **TRD-003**: Implement SkillLoader class with session cache (6h) - Priority: High - Depends: TRD-002
- [x] **TRD-004**: Implement skill content sanitization (HTML/script removal) (4h) - Priority: High - Depends: TRD-003
- [x] **TRD-005**: Implement file size validation (100KB SKILL.md, 1MB REFERENCE.md limits) (3h) - Priority: High - Depends: TRD-003
- [x] **TRD-006**: Implement version compatibility validation logic (5h) - Priority: High - Depends: TRD-002
- [x] **TRD-007**: Create skill loading error handler with user prompt options (4h) - Priority: Medium - Depends: TRD-003
- [x] **TRD-008**: Write unit tests for SkillLoader class (80% coverage) (6h) - Priority: High - Depends: TRD-003, TRD-004, TRD-005

### Framework Detection Tasks (7 tasks)

- [x] **TRD-009**: Create skills/framework-detector/ directory structure (1h) - Priority: High - Depends: TRD-001
- [x] **TRD-010**: Create framework-patterns.json with detection rules for all 6 frameworks (8h) - Priority: High - Depends: TRD-009
- [x] **TRD-011**: Implement detect-framework.js with multi-signal detection (8h) - Priority: High - Depends: TRD-010
- [x] **TRD-012**: Implement confidence scoring algorithm (boost factors + normalization) (5h) - Priority: High - Depends: TRD-011
- [x] **TRD-013**: Create framework-detector/SKILL.md with usage documentation (3h) - Priority: Medium - Depends: TRD-011
- [x] **TRD-014**: Implement manual framework override flag support (3h) - Priority: Medium - Depends: TRD-011
- [x] **TRD-015**: Write framework detection tests for 20 sample projects (8h) - Priority: High - Depends: TRD-011

### NestJS Skill Tasks (8 tasks)

- [ ] **TRD-016**: Create skills/nestjs-framework/ directory with structure (1h) - Priority: High - Depends: TRD-001
- [ ] **TRD-017**: Extract core patterns from nestjs-backend-expert.yaml (17KB agent) (6h) - Priority: High - Depends: TRD-016
- [ ] **TRD-018**: Write nestjs-framework/SKILL.md (≤2KB) with quick reference (8h) - Priority: High - Depends: TRD-017
- [ ] **TRD-019**: Write nestjs-framework/REFERENCE.md (≤20KB) with comprehensive guide (12h) - Priority: High - Depends: TRD-017
- [ ] **TRD-020**: Create code generation templates (module, controller, service, repository, dto) (8h) - Priority: High - Depends: TRD-017
- [ ] **TRD-021**: Write examples/ (dependency-injection, error-handling, testing) (6h) - Priority: Medium - Depends: TRD-017
- [ ] **TRD-022**: Validate skill content against nestjs-backend-expert.yaml (feature parity) (4h) - Priority: High - Depends: TRD-018, TRD-019, TRD-020
- [ ] **TRD-023**: Test code generation templates (linting + framework validation) (4h) - Priority: High - Depends: TRD-020

### React Skill Tasks (7 tasks)

- [ ] **TRD-024**: Create skills/react-framework/ directory with structure (1h) - Priority: High - Depends: TRD-001
- [ ] **TRD-025**: Extract core patterns from react-component-architect.yaml (3.2KB agent) (4h) - Priority: High - Depends: TRD-024
- [ ] **TRD-026**: Write react-framework/SKILL.md (≤2KB) with quick reference (6h) - Priority: High - Depends: TRD-025
- [ ] **TRD-027**: Write react-framework/REFERENCE.md (≤20KB) with comprehensive guide (10h) - Priority: High - Depends: TRD-025
- [ ] **TRD-028**: Create code generation templates (component, hook, context, test) (6h) - Priority: High - Depends: TRD-025
- [ ] **TRD-029**: Write examples/ (hooks, state-management, composition) (4h) - Priority: Medium - Depends: TRD-025
- [ ] **TRD-030**: Validate skill content against react-component-architect.yaml (feature parity) (3h) - Priority: High - Depends: TRD-026, TRD-027, TRD-028

### Core Framework Skills Tasks (16 tasks)

#### Phoenix Framework (4 tasks)

- [ ] **TRD-031**: Create skills/phoenix-framework/ directory with structure (1h) - Priority: High - Depends: TRD-001
- [ ] **TRD-032**: Extract patterns from elixir-phoenix-expert.yaml (16KB) and write SKILL.md + REFERENCE.md (14h) - Priority: High - Depends: TRD-031
- [ ] **TRD-033**: Create code generation templates (context, controller, liveview, schema) (8h) - Priority: High - Depends: TRD-032
- [ ] **TRD-034**: Write examples/ and validate feature parity (6h) - Priority: High - Depends: TRD-032, TRD-033

#### Rails Framework (4 tasks)

- [ ] **TRD-035**: Create skills/rails-framework/ directory with structure (1h) - Priority: High - Depends: TRD-001
- [ ] **TRD-036**: Extract patterns from rails-backend-expert.yaml (3KB) and write SKILL.md + REFERENCE.md (10h) - Priority: High - Depends: TRD-035
- [ ] **TRD-037**: Create code generation templates (controller, model, service, job) (6h) - Priority: High - Depends: TRD-036
- [ ] **TRD-038**: Write examples/ and validate feature parity (4h) - Priority: High - Depends: TRD-036, TRD-037

#### .NET Framework (4 tasks)

- [ ] **TRD-039**: Create skills/dotnet-framework/ directory with structure (1h) - Priority: High - Depends: TRD-001
- [ ] **TRD-040**: Extract patterns from dotnet-backend-expert.yaml (1.4KB) and write SKILL.md + REFERENCE.md (10h) - Priority: High - Depends: TRD-039
- [ ] **TRD-041**: Create code generation templates (controller, service, repository, dto) (6h) - Priority: High - Depends: TRD-040
- [ ] **TRD-042**: Write examples/ and validate feature parity (4h) - Priority: High - Depends: TRD-040, TRD-041

#### Blazor Framework (4 tasks)

- [ ] **TRD-043**: Create skills/blazor-framework/ directory with structure (1h) - Priority: High - Depends: TRD-001
- [ ] **TRD-044**: Extract patterns from dotnet-blazor-expert.yaml (1.6KB) and write SKILL.md + REFERENCE.md (10h) - Priority: High - Depends: TRD-043
- [ ] **TRD-045**: Create code generation templates (component, service, model) (6h) - Priority: High - Depends: TRD-044
- [ ] **TRD-046**: Write examples/ and validate feature parity (4h) - Priority: High - Depends: TRD-044, TRD-045

### Agent Integration Tasks (4 tasks)

- [ ] **TRD-047**: Modify backend-developer.yaml to add framework skill integration expertise (6h) - Priority: High - Depends: TRD-003, TRD-011
- [ ] **TRD-048**: Modify frontend-developer.yaml to add framework skill integration expertise (6h) - Priority: High - Depends: TRD-003, TRD-011
- [ ] **TRD-049**: Update ai-mesh-orchestrator.yaml delegation logic for skill-aware agents (4h) - Priority: Medium - Depends: TRD-047, TRD-048
- [ ] **TRD-050**: Test agent delegation with skill loading (backend + frontend workflows) (6h) - Priority: High - Depends: TRD-047, TRD-048

### Testing & Validation Tasks (6 tasks)

- [ ] **TRD-051**: Create integration test suite (framework detection → skill loading → code generation) (8h) - Priority: High - Depends: TRD-015, TRD-023, TRD-030
- [ ] **TRD-052**: Validate all 6 framework skills achieve ≥95% feature parity with deprecated agents (8h) - Priority: High - Depends: TRD-022, TRD-030, TRD-034, TRD-038, TRD-042, TRD-046
- [ ] **TRD-053**: Performance testing (skill loading <100ms, framework detection <500ms) (4h) - Priority: High - Depends: TRD-003, TRD-011
- [ ] **TRD-054**: Security testing (file size limits, content sanitization validation) (4h) - Priority: High - Depends: TRD-004, TRD-005
- [ ] **TRD-055**: User acceptance testing with 3-5 real-world projects (12h) - Priority: High - Depends: TRD-051
- [ ] **TRD-056**: A/B testing (skills-based vs framework-specialist agents on identical tasks) (8h) - Priority: Medium - Depends: TRD-055

### Documentation & Migration Tasks (2 tasks)

- [ ] **TRD-057**: Create migration guide (framework-specialist agents → skills-based approach) (6h) - Priority: Medium - Depends: TRD-052
- [ ] **TRD-058**: Update agents/README.md and deprecate framework-specialist agents metadata (4h) - Priority: Medium - Depends: TRD-057

---

## Sprint Planning

### Sprint 1: Foundation & Framework Detection (Week 1)

**Duration**: 5 days | **Total Estimate**: 68 hours | **Tasks**: TRD-001 to TRD-015

#### Primary Tasks

- [x] **TRD-001**: Create skills/ directory structure (2h)
- [x] **TRD-002**: Define skill frontmatter YAML schema (4h)
- [x] **TRD-003**: Implement SkillLoader class (6h)
- [x] **TRD-004**: Implement content sanitization (4h)
- [x] **TRD-005**: Implement file size validation (3h)
- [x] **TRD-006**: Implement version compatibility validation (5h)
- [x] **TRD-009**: Create framework-detector directory (1h)
- [x] **TRD-010**: Create framework-patterns.json (8h)
- [x] **TRD-011**: Implement detect-framework.js (8h)
- [x] **TRD-012**: Implement confidence scoring (5h)

#### Secondary Tasks

- [x] **TRD-007**: Create skill loading error handler (4h) - Can start after TRD-003
- [x] **TRD-008**: Write SkillLoader unit tests (6h) - Can start after TRD-003, TRD-004, TRD-005
- [x] **TRD-013**: Create framework-detector SKILL.md (3h) - Can start after TRD-011
- [x] **TRD-014**: Implement manual framework override (3h) - Can start after TRD-011
- [x] **TRD-015**: Write framework detection tests (8h) - Can start after TRD-011

#### Sprint Goals

- [x] Skill loading infrastructure complete (TRD-001 to TRD-008) ✅
- [x] Framework detection functional with ≥80% accuracy (TRD-009 to TRD-012) ✅
- [x] Unit tests passing with ≥80% coverage (TRD-008) ✅

#### Definition of Done

- [x] All primary tasks (TRD-001 to TRD-012) completed ✅
- [x] SkillLoader can load/cache/validate skills from file system ✅
- [x] Framework detector identifies 4+ frameworks with confidence scores ✅
- [x] Unit tests pass with ≥80% coverage ✅
- [ ] Code review completed (security focus on file operations)

---

### Sprint 2: Proof of Concept Skills (Week 2)

**Duration**: 5 days | **Total Estimate**: 66 hours | **Tasks**: TRD-016 to TRD-030

#### Primary Tasks

- [ ] **TRD-016**: Create nestjs-framework directory (1h)
- [ ] **TRD-017**: Extract patterns from nestjs-backend-expert (6h)
- [ ] **TRD-018**: Write nestjs-framework/SKILL.md (8h)
- [ ] **TRD-019**: Write nestjs-framework/REFERENCE.md (12h)
- [ ] **TRD-020**: Create NestJS templates (8h)
- [ ] **TRD-024**: Create react-framework directory (1h)
- [ ] **TRD-025**: Extract patterns from react-component-architect (4h)
- [ ] **TRD-026**: Write react-framework/SKILL.md (6h)
- [ ] **TRD-027**: Write react-framework/REFERENCE.md (10h)
- [ ] **TRD-028**: Create React templates (6h)

#### Secondary Tasks

- [ ] **TRD-021**: Write NestJS examples/ (6h) - Can start after TRD-017
- [ ] **TRD-022**: Validate NestJS feature parity (4h) - Can start after TRD-018, TRD-019, TRD-020
- [ ] **TRD-023**: Test NestJS templates (4h) - Can start after TRD-020
- [ ] **TRD-029**: Write React examples/ (4h) - Can start after TRD-025
- [ ] **TRD-030**: Validate React feature parity (3h) - Can start after TRD-026, TRD-027, TRD-028

#### Sprint Goals

- [ ] NestJS skill complete with feature parity (TRD-016 to TRD-023)
- [ ] React skill complete with feature parity (TRD-024 to TRD-030)
- [ ] Proof of concept validated (2 complex skills working)

#### Definition of Done

- [ ] All primary tasks (TRD-016 to TRD-028) completed
- [ ] NestJS skill achieves ≥95% feature parity with nestjs-backend-expert.yaml
- [ ] React skill achieves ≥95% feature parity with react-component-architect.yaml
- [ ] Code generation templates pass linting
- [ ] Skill content validated by framework experts
- [ ] SKILL.md files ≤2KB, REFERENCE.md files ≤20KB

---

### Sprint 3: Core Framework Skills - Part 1 (Week 3)

**Duration**: 5 days | **Total Estimate**: 56 hours | **Tasks**: TRD-031 to TRD-042

#### Primary Tasks (Phoenix + Rails)

- [ ] **TRD-031**: Create phoenix-framework directory (1h)
- [ ] **TRD-032**: Extract patterns and write Phoenix SKILL.md + REFERENCE.md (14h)
- [ ] **TRD-033**: Create Phoenix templates (8h)
- [ ] **TRD-035**: Create rails-framework directory (1h)
- [ ] **TRD-036**: Extract patterns and write Rails SKILL.md + REFERENCE.md (10h)
- [ ] **TRD-037**: Create Rails templates (6h)

#### Primary Tasks (.NET)

- [ ] **TRD-039**: Create dotnet-framework directory (1h)
- [ ] **TRD-040**: Extract patterns and write .NET SKILL.md + REFERENCE.md (10h)
- [ ] **TRD-041**: Create .NET templates (6h)

#### Secondary Tasks

- [ ] **TRD-034**: Write Phoenix examples/ and validate (6h) - Can start after TRD-032, TRD-033
- [ ] **TRD-038**: Write Rails examples/ and validate (4h) - Can start after TRD-036, TRD-037
- [ ] **TRD-042**: Write .NET examples/ and validate (4h) - Can start after TRD-040, TRD-041

#### Sprint Goals

- [ ] Phoenix framework skill complete (TRD-031 to TRD-034)
- [ ] Rails framework skill complete (TRD-035 to TRD-038)
- [ ] .NET framework skill complete (TRD-039 to TRD-042)

#### Definition of Done

- [ ] All primary tasks (TRD-031 to TRD-041) completed
- [ ] All 3 skills achieve ≥95% feature parity with deprecated agents
- [ ] Code generation templates tested and validated
- [ ] Content review by framework experts completed

---

### Sprint 4: Core Framework Skills - Part 2 & Agent Integration (Week 4)

**Duration**: 5 days | **Total Estimate**: 38 hours | **Tasks**: TRD-043 to TRD-050

#### Primary Tasks (Blazor)

- [ ] **TRD-043**: Create blazor-framework directory (1h)
- [ ] **TRD-044**: Extract patterns and write Blazor SKILL.md + REFERENCE.md (10h)
- [ ] **TRD-045**: Create Blazor templates (6h)

#### Primary Tasks (Agent Integration)

- [ ] **TRD-047**: Modify backend-developer.yaml with skill integration (6h)
- [ ] **TRD-048**: Modify frontend-developer.yaml with skill integration (6h)
- [ ] **TRD-050**: Test agent delegation with skill loading (6h)

#### Secondary Tasks

- [ ] **TRD-046**: Write Blazor examples/ and validate (4h) - Can start after TRD-044, TRD-045
- [ ] **TRD-049**: Update ai-mesh-orchestrator delegation logic (4h) - Can start after TRD-047, TRD-048

#### Sprint Goals

- [ ] Blazor framework skill complete (TRD-043 to TRD-046)
- [ ] Generic agents enhanced with skill loading (TRD-047, TRD-048)
- [ ] End-to-end agent delegation working (TRD-050)

#### Definition of Done

- [ ] All primary tasks (TRD-043, TRD-044, TRD-045, TRD-047, TRD-048, TRD-050) completed
- [ ] Blazor skill achieves ≥95% feature parity with dotnet-blazor-expert.yaml
- [ ] backend-developer can detect framework and load appropriate skills
- [ ] frontend-developer can detect framework and load appropriate skills
- [ ] Integration tests pass for agent → detection → skill loading workflow

---

### Sprint 5: Testing & Validation (Week 5)

**Duration**: 5 days | **Total Estimate**: 44 hours | **Tasks**: TRD-051 to TRD-056

#### Primary Tasks

- [ ] **TRD-051**: Create integration test suite (8h)
- [ ] **TRD-052**: Validate all 6 framework skills feature parity (8h)
- [ ] **TRD-053**: Performance testing (4h)
- [ ] **TRD-054**: Security testing (4h)
- [ ] **TRD-055**: User acceptance testing with real projects (12h)

#### Secondary Tasks

- [ ] **TRD-056**: A/B testing (skills vs framework-specialist agents) (8h) - Can start after TRD-055

#### Sprint Goals

- [ ] Comprehensive test suite complete (TRD-051)
- [ ] All quality gates passed (TRD-052 to TRD-054)
- [ ] User acceptance validated (TRD-055)
- [ ] Performance targets met (skill loading <100ms, detection <500ms)

#### Definition of Done

- [ ] All primary tasks (TRD-051 to TRD-055) completed
- [ ] Integration tests achieve ≥80% code coverage
- [ ] All 6 framework skills validated at ≥95% feature parity
- [ ] Performance benchmarks met (skill loading <100ms, framework detection <500ms)
- [ ] Security validation passed (file size limits + sanitization working)
- [ ] User acceptance testing shows ≥90% satisfaction
- [ ] A/B testing shows ≤10% task completion time increase

---

### Sprint 6: Documentation & Migration Preparation (Week 6)

**Duration**: 5 days | **Total Estimate**: 10 hours | **Tasks**: TRD-057 to TRD-058

#### Primary Tasks

- [ ] **TRD-057**: Create migration guide (6h)
- [ ] **TRD-058**: Update agents/README.md and deprecate agents (4h)

#### Sprint Goals

- [ ] Migration documentation complete (TRD-057)
- [ ] Deprecation notices applied to framework-specialist agents (TRD-058)
- [ ] Ready for v3.1.0 release with hard cutover

#### Definition of Done

- [ ] All tasks (TRD-057 to TRD-058) completed
- [ ] Migration guide includes before/after examples and rollback procedure
- [ ] agents/README.md updated with skills-based approach documentation
- [ ] Framework-specialist agents marked deprecated with migration links
- [ ] Release notes prepared for v3.1.0
- [ ] Rollback procedure documented and tested

---

## Interfaces & Data Contracts

### Framework Detection API

**Input**:
```typescript
interface FrameworkDetectionInput {
  projectRoot: string;                // Absolute path to project root
  manualOverride?: string;            // Optional manual framework specification
  confidenceThreshold?: number;       // Default: 0.8
}
```

**Output**:
```typescript
interface FrameworkDetectionResult {
  primary: string | null;             // Main framework detected
  confidence: number;                 // 0.0 - 1.0
  alternates: FrameworkMatch[];       // Alternative frameworks
  detectionMethod: string;            // Detection method used
  projectRoot: string;                // Validated project root path
  error?: string;                     // Error message if failed
}

interface FrameworkMatch {
  framework: string;                  // Framework name
  confidence: number;                 // Confidence score
  evidence: string[];                 // Detection evidence
}
```

### Skill Loading API

**Input**:
```typescript
interface SkillLoadRequest {
  framework: string;                  // Framework name (nestjs, react, etc.)
  detailLevel: 'quick' | 'comprehensive'; // Loading mode
  agentName: string;                  // Requesting agent name
  agentVersion: string;               // Requesting agent version
}
```

**Output**:
```typescript
interface SkillLoadResult {
  content: string;                    // Markdown content
  frontmatter: SkillMetadata;         // Parsed metadata
  loadedAt: number;                   // Unix timestamp
  cached: boolean;                    // Whether loaded from cache
  error?: string;                     // Error message if failed
}

interface SkillMetadata {
  name: string;
  version: string;
  framework_versions: {
    min: string;
    max: string;
    recommended: string;
  };
  compatible_agents: Record<string, string>;
  description: string;
  frameworks: string[];
  languages: string[];
  updated?: string;
  maintainer?: string;
  breaking_changes?: string[];
  migration_notes?: string;
}
```

### Agent Communication Protocol

**Skill Loading Request** (from agent to SkillLoader):
```yaml
action: load_skill
parameters:
  framework: nestjs
  detail_level: quick
  agent_name: backend-developer
  agent_version: 3.0.0
```

**Skill Loading Response** (from SkillLoader to agent):
```yaml
status: success | error
content: |
  [SKILL.md markdown content]
metadata:
  version: 1.0.0
  compatible: true
cached: false
load_time_ms: 42
```

**Error Response** (skill load failure):
```yaml
status: error
error_code: SKILL_NOT_FOUND | SIZE_LIMIT_EXCEEDED | VERSION_INCOMPATIBLE | SANITIZATION_FAILED
error_message: "Detailed error description"
options:
  - continue_generic
  - abort_task
  - manual_selection
```

---

## Non-Functional Requirements

### Performance Requirements

| Metric | Target | Measurement Method | Acceptance Criteria |
|--------|--------|-------------------|---------------------|
| **Skill Loading Time (SKILL.md)** | <100ms | Instrumentation in SkillLoader | 95th percentile ≤150ms |
| **Skill Loading Time (REFERENCE.md)** | <500ms | Instrumentation in SkillLoader | 95th percentile ≤750ms |
| **Framework Detection Time** | <500ms | detect-framework.js execution | 95th percentile ≤750ms |
| **Memory Footprint (Cached Skills)** | ≤5MB per agent session | Node.js heap usage tracking | Maximum 3 skills cached simultaneously |
| **Context Window Usage** | SKILL.md ≤2KB, REFERENCE.md ≤20KB | File size measurement | 100% compliance on all skills |

### Scalability Requirements

- **Concurrent Agents**: Support 10+ agent sessions with independent skill caches
- **Framework Support**: Architecture supports adding new frameworks without agent modifications
- **Skill Updates**: Framework skills can be updated independently without agent redeployment
- **Template Expansion**: Support 10+ code generation templates per framework skill

### Reliability Requirements

| Requirement | Target | Measurement | Mitigation |
|-------------|--------|-------------|------------|
| **Framework Detection Accuracy** | ≥95% | Test suite across 50+ projects | Manual override capability |
| **Skill Loading Success Rate** | ≥99% | Error rate monitoring | Graceful failure with user prompt |
| **Code Generation Success** | ≥95% | Linting pass rate | Template validation before deployment |
| **Version Compatibility** | 100% validation | Automated compatibility checks | Hard failure on incompatibility |

### Security Requirements

#### Input Validation

- **File Paths**: Validate all skill file paths are within skills/ directory (prevent directory traversal)
- **File Sizes**: Enforce hard limits (SKILL.md: 100KB, REFERENCE.md: 1MB, templates: 50KB each)
- **YAML Frontmatter**: Schema validation against skill-schema.json before processing
- **User Input**: Framework names validated against whitelist (no arbitrary code execution)

#### Content Sanitization

```javascript
// Sanitization Rules
const sanitizationRules = {
  removeScriptTags: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  removeHtmlTags: /<[^>]+>/g,
  escapeSpecialChars: /[<>&'"]/g,
  removeBase64: /data:image\/[^;]+;base64,[^\s]+/gi
};

// Sanitization Workflow
1. Read file content
2. Apply removeScriptTags (prevents XSS)
3. Apply removeHtmlTags (prevents HTML injection)
4. Validate YAML frontmatter against schema
5. Log sanitization actions for audit
6. Return sanitized content
```

#### Audit Logging

```yaml
audit_events:
  - skill_load_attempt:
      fields: [timestamp, agent_name, framework, file_path, success, error]
  - sanitization_applied:
      fields: [timestamp, file_path, rules_applied, content_removed]
  - version_validation_failed:
      fields: [timestamp, skill_version, agent_version, compatibility_check]
  - file_size_exceeded:
      fields: [timestamp, file_path, size_bytes, limit_bytes]
```

### Maintainability Requirements

- **Code Documentation**: All SkillLoader methods documented with JSDoc
- **Error Messages**: Clear, actionable error messages with resolution steps
- **Logging**: Structured logging (JSON) with severity levels (debug, info, warn, error)
- **Versioning**: Semantic versioning for all skills with CHANGELOG.md per skill
- **Testing**: ≥80% code coverage with unit + integration tests

### Usability Requirements

- **Error Recovery**: User prompted with clear options on skill load failure
- **Documentation**: README.md in each skill directory with usage examples
- **Progressive Disclosure**: Quick start with SKILL.md; deep dive with REFERENCE.md
- **Template Discovery**: Templates listed in SKILL.md with descriptions
- **Framework Detection**: Confidence scores displayed; manual override if <0.8

---

## Test Strategy

### Test Levels

#### 1. Unit Tests (Target: ≥80% coverage)

**SkillLoader Class**:
- [ ] Test cache hit/miss scenarios
- [ ] Test file size validation (within limit, exceeds limit)
- [ ] Test content sanitization (script tags, HTML removal)
- [ ] Test version compatibility validation (compatible, incompatible)
- [ ] Test error handling (file not found, permission denied)

**Framework Detector**:
- [ ] Test confidence scoring algorithm
- [ ] Test multi-signal detection (package.json + Gemfile)
- [ ] Test edge cases (empty project, monorepo, multi-framework)

#### 2. Integration Tests (Target: 50 test cases)

**End-to-End Workflows**:
```
Test Case: backend-developer generates NestJS controller
1. ai-mesh-orchestrator delegates task to backend-developer
2. backend-developer invokes framework-detector
3. framework-detector returns {primary: "nestjs", confidence: 0.95}
4. backend-developer loads nestjs-framework/SKILL.md
5. backend-developer loads nestjs-framework/templates/controller.template.ts
6. backend-developer generates code using template
7. Generated code passes ESLint validation
8. Assert: Code contains NestJS-specific decorators (@Controller, @Get, @Injectable)
```

**Test Projects**:
- 10 NestJS projects (various versions, configurations)
- 8 Phoenix projects (contexts, LiveView, umbrella apps)
- 6 Rails projects (API-only, full-stack, engines)
- 6 .NET projects (Web API, MVC, Minimal API)
- 10 React projects (CRA, Vite, Next.js)
- 10 Blazor projects (Server, WebAssembly, Hybrid)

#### 3. Performance Tests

**Benchmarks**:
- [ ] Skill loading time: SKILL.md <100ms (measure 100 loads)
- [ ] Framework detection: <500ms (measure across 50 projects)
- [ ] Memory usage: ≤5MB cached skills per session
- [ ] Concurrent agents: 10 agents simultaneously loading skills

**Load Testing**:
```javascript
// Concurrent skill loading test
const agents = Array.from({length: 10}, (_, i) => new SkillLoader(`agent-${i}`));
const results = await Promise.all(
  agents.map(agent => agent.loadSkill('nestjs', 'quick'))
);

// Assert: All loads complete within 500ms
// Assert: Memory usage ≤50MB total (5MB per agent)
```

#### 4. Security Tests

**Input Validation**:
- [ ] Test directory traversal attempts (../../../etc/passwd)
- [ ] Test oversized files (110KB SKILL.md, 2MB REFERENCE.md)
- [ ] Test malformed YAML frontmatter (invalid schema)
- [ ] Test malicious content (script tags, HTML injection)

**Content Sanitization**:
```javascript
// Malicious skill content test
const maliciousContent = `
---
name: Malicious Skill
version: 1.0.0
---
<script>alert('XSS')</script>
[Link](javascript:alert('XSS'))
`;

const sanitized = skillLoader.sanitizeContent(maliciousContent);
// Assert: No script tags in sanitized content
// Assert: No javascript: protocols in links
```

#### 5. User Acceptance Tests (UAT)

**Real-World Projects**:
- [ ] Fortium Partners internal project (NestJS + React)
- [ ] Client project (Phoenix + LiveView)
- [ ] Open-source project (Rails API)
- [ ] .NET microservices project
- [ ] Blazor dashboard application

**Success Criteria**:
- Code generation produces idiomatic framework code
- Developer satisfaction ≥90% (post-task survey)
- Task completion time within 10% of baseline (framework-specialist agents)
- Zero critical bugs or workflow blockers

---

## Deployment & Migration

### Deployment Architecture

**Pre-Deployment Checklist**:
- [ ] All 58 tasks completed and validated
- [ ] Test coverage ≥80% with all tests passing
- [ ] Performance benchmarks met (skill loading <100ms, detection <500ms)
- [ ] Security validation passed (sanitization, file size limits working)
- [ ] User acceptance testing completed with ≥90% satisfaction
- [ ] Migration guide and rollback procedure documented

**Deployment Steps**:

1. **Pre-Deployment Validation** (1 hour):
   ```bash
   # Run full test suite
   npm test -- --coverage
   # Verify coverage ≥80%

   # Run integration tests
   npm run test:integration
   # Verify all 50 test cases pass

   # Run performance benchmarks
   npm run test:perf
   # Verify skill loading <100ms, detection <500ms

   # Run security tests
   npm run test:security
   # Verify sanitization and file size validation working
   ```

2. **Backup Current State** (30 minutes):
   ```bash
   # Tag current release
   git tag v3.0.x-pre-skills-migration

   # Backup agent definitions
   cp -r agents/yaml/ backup/agents-v3.0.x/

   # Document rollback procedure
   echo "To rollback: git checkout v3.0.x-pre-skills-migration" > ROLLBACK.md
   ```

3. **Deploy Skills Infrastructure** (1 hour):
   ```bash
   # Copy skills/ directory to production
   cp -r skills/ ~/.claude/skills/

   # Deploy modified agents
   cp agents/yaml/backend-developer.yaml ~/.claude/agents/
   cp agents/yaml/frontend-developer.yaml ~/.claude/agents/
   cp agents/yaml/ai-mesh-orchestrator.yaml ~/.claude/agents/

   # Deploy skill loading scripts
   cp src/skill-loader.js ~/.claude/lib/

   # Verify file permissions
   chmod 644 ~/.claude/skills/**/*.md
   chmod 755 ~/.claude/lib/skill-loader.js
   ```

4. **Mark Deprecated Agents** (30 minutes):
   ```yaml
   # Add deprecation notice to framework-specialist agents
   ---
   name: nestjs-backend-expert
   deprecated: true
   deprecation_notice: |
     This agent is deprecated as of v3.1.0. Use backend-developer with nestjs-framework skill instead.
     Migration guide: docs/migration/skills-based-framework.md
   replacement: backend-developer
   replacement_skill: nestjs-framework
   ---
   ```

5. **Restart Claude Code** (5 minutes):
   ```bash
   # Restart Claude Code to load new configuration
   # Verify new agents and skills loaded:
   # - backend-developer shows skill integration expertise
   # - frontend-developer shows skill integration expertise
   # - skills/ directory accessible from agents
   ```

6. **Post-Deployment Validation** (2 hours):
   ```bash
   # Test framework detection
   /implement-trd "Detect framework in sample projects"
   # Verify ≥95% accuracy

   # Test skill loading
   /implement-trd "Generate NestJS controller for User API"
   # Verify backend-developer loads nestjs-framework skill
   # Verify generated code is idiomatic

   # Test all 6 framework skills
   # NestJS, Phoenix, Rails, .NET, React, Blazor
   # Verify each generates valid code
   ```

### Migration Strategy

**Hard Cutover Approach**:

**Pre-Cutover (Week 6)**:
- All 6 framework skills created and validated
- Feature parity ≥95% with deprecated agents
- User acceptance testing completed
- Migration guide published

**Cutover Execution (v3.1.0 Release)**:
- Framework-specialist agents marked deprecated
- backend-developer and frontend-developer enhanced with skill loading
- Skills infrastructure deployed
- No dual system maintenance

**Post-Cutover Monitoring (48 hours intensive, 30 days ongoing)**:
- Framework detection accuracy tracked (target: ≥95%)
- Skill loading performance monitored (target: <100ms)
- Code generation success rate measured (target: ≥95%)
- User satisfaction surveyed (target: ≥90%)

**Rollback Criteria**:
| Metric | Threshold | Action |
|--------|-----------|--------|
| Framework Detection Accuracy | <90% | Rollback immediately |
| Code Generation Failures | >5% of tasks | Rollback within 24 hours |
| User Satisfaction | <80% after 1 week | Rollback within 48 hours |
| Critical Bugs | Workflow-blocking issues | Rollback immediately |
| Performance Degradation | Skill loading >500ms | Rollback within 24 hours |

**Rollback Procedure**:
```bash
# 1. Revert to previous git tag
git checkout v3.0.x-pre-skills-migration

# 2. Restore agent backups
cp -r backup/agents-v3.0.x/ agents/yaml/

# 3. Remove skills infrastructure
rm -rf ~/.claude/skills/
rm ~/.claude/lib/skill-loader.js

# 4. Redeploy original agents
cp agents/yaml/*.yaml ~/.claude/agents/

# 5. Restart Claude Code
# Verify framework-specialist agents operational

# 6. Notify users of rollback
# Estimated downtime: 30 minutes
```

### Monitoring & Alerting

**Key Metrics Dashboard**:
```yaml
metrics:
  framework_detection_accuracy:
    query: "SELECT COUNT(*) WHERE detection.confidence >= 0.95"
    alert_threshold: 0.90
    alert_action: notify_team

  skill_loading_performance:
    query: "SELECT PERCENTILE(load_time_ms, 95) FROM skill_loads"
    alert_threshold: 150  # 95th percentile > 150ms
    alert_action: performance_investigation

  code_generation_success:
    query: "SELECT COUNT(*) WHERE linting_passed = true"
    alert_threshold: 0.93  # <93% success
    alert_action: quality_review

  user_satisfaction:
    query: "SELECT AVG(satisfaction_score) FROM surveys"
    alert_threshold: 85  # <85% satisfaction
    alert_action: user_feedback_session
```

**Alert Channels**:
- **Critical**: Slack #ai-mesh-alerts + PagerDuty
- **Warning**: Slack #ai-mesh-monitoring
- **Info**: Grafana dashboard + weekly email digest

---

## Risk Assessment

### High-Priority Risks

#### Risk 1: Framework Detection Failures

**Description**: Framework detector may fail on monorepos, multi-framework projects, or projects with unconventional structure.

**Probability**: Medium (30%)

**Impact**: High - Incorrect skill loading leads to suboptimal code generation

**Mitigation**:
1. Implement confidence scoring with user prompt if <0.8
2. Support manual framework override flag (`--framework=nestjs`)
3. Multi-signal detection (package.json + config files + directory structure)
4. Iterative improvement based on failure logs

**Contingency**:
- Maintain fallback to generic patterns if detection fails
- Collect detection failures for pattern improvement
- Provide clear error messages with manual override instructions

#### Risk 2: Incomplete Framework Coverage

**Description**: Framework skills may not cover all patterns currently in framework-specialist agents.

**Probability**: Low (20%)

**Impact**: Medium - Developers need to reference old agents or write custom code

**Mitigation**:
1. Feature parity checklist (95% coverage requirement)
2. Side-by-side comparison during migration
3. User feedback collection in Phase 4
4. Iterative skill content expansion

**Contingency**:
- Keep deprecated agents accessible during transition
- Document known gaps in migration guide
- Prioritize gap-filling based on user feedback

### Medium-Priority Risks

#### Risk 3: Performance Degradation

**Description**: Skill loading overhead may increase task completion time.

**Probability**: Low (15%)

**Impact**: Medium - User dissatisfaction if tasks take >10% longer

**Mitigation**:
1. Session-lifetime caching for loaded skills
2. Progressive disclosure (load SKILL.md first, REFERENCE.md on-demand)
3. Performance benchmarking in Sprint 5
4. A/B testing to measure actual impact

**Contingency**:
- Optimize caching strategy if benchmarks fail
- Pre-load skills if loading time becomes blocker
- Consider skill content compression if size is issue

#### Risk 4: Security Vulnerabilities

**Description**: Malicious skill content or user input could compromise system.

**Probability**: Very Low (5%)

**Impact**: High - Code execution, data exfiltration, or system compromise

**Mitigation**:
1. File size limits (100KB, 1MB, 50KB per template)
2. Content sanitization (HTML/script tag removal)
3. YAML schema validation before processing
4. No code execution during skill loading (file reading only)
5. Security testing in Sprint 5

**Contingency**:
- Implement skill content signing if vulnerabilities found
- Add runtime sandboxing for skill loading
- Security audit by external team if critical issues emerge

### Low-Priority Risks

#### Risk 5: Agent Delegation Complexity

**Description**: Adding skill loading logic to agents might introduce bugs in delegation workflows.

**Probability**: Low (10%)

**Impact**: Medium - Agent failures or incorrect code generation

**Mitigation**:
1. Comprehensive integration tests (Sprint 5)
2. Gradual rollout with feature flags
3. Extensive logging for debugging
4. Rollback capability if critical bugs found

**Contingency**:
- Rollback to v3.0.x if bugs affect >10% of tasks
- Quick-fix releases for isolated issues
- Enhanced error handling in skill loading logic

---

## Success Metrics & KPIs

### Technical Metrics

| Metric | Baseline (Framework-Specialist Agents) | Target (Skills-Based) | Measurement Method |
|--------|----------------------------------------|----------------------|-------------------|
| **Agent Definition Size** | 59KB (42KB specialists + 17KB generic) | 22KB (17KB + 5KB skill loading) | Total size of agent YAML files |
| **Framework Update Time** | 3 hours (update 6 agents) | <30 minutes (update 1 skill) | Timed framework update tasks |
| **Framework Detection Accuracy** | N/A (manual selection) | ≥95% | Test suite across 50+ projects |
| **Skill Loading Time** | N/A | SKILL.md <100ms, REFERENCE.md <500ms | Instrumentation in SkillLoader |
| **Code Generation Success** | ~90% (historical) | ≥95% | Linting pass rate on generated code |
| **Context Window Usage** | 17KB (full NestJS agent) | 2KB (SKILL.md only) | Loaded content size per task |

### Developer Experience Metrics

| Metric | Target | Measurement Method | Frequency |
|--------|--------|-------------------|-----------|
| **User Satisfaction** | ≥90% | Post-task survey (5-point scale) | Weekly during Phase 4 |
| **Task Completion Time** | ≤10% increase | A/B testing (skills vs specialists) | Sprint 5 |
| **Error Rate** | <5% task failures | Error tracking in monitoring | Continuous |
| **Manual Intervention Rate** | <10% (framework override needed) | Detection confidence logs | Continuous |

### Maintainability Metrics

| Metric | Target | Measurement Method | Frequency |
|--------|--------|-------------------|-----------|
| **Framework Knowledge Duplication** | Zero | Grep for duplicate patterns | Monthly |
| **Skill Content Consistency** | 100% (all skills follow template) | Schema validation | Per skill creation |
| **Test Coverage** | ≥80% | Jest/pytest coverage reports | Per commit |
| **Documentation Completeness** | 100% (all skills have README) | Manual audit | Per sprint |

### Business Metrics

| Metric | Target | Measurement Method | Frequency |
|--------|--------|-------------------|-----------|
| **Agent Count Reduction** | 6 fewer (35 → 29) | Agent inventory | At v3.1.0 release |
| **Community Contributions** | ≥2 skills from community in 6 months | GitHub PR tracking | Monthly |
| **Framework Coverage** | 6 frameworks in v3.1.0, +2 per quarter | Skill directory count | Quarterly |
| **Maintenance Cost** | 50% reduction | Developer time tracking | Quarterly |

---

## Task Completion Status

**Progress Tracking**: This section will be updated as tasks are completed during implementation.

### Foundation & Framework Detection (Sprint 1)

- [ ] TRD-001 to TRD-015: 0/15 completed

### Proof of Concept Skills (Sprint 2)

- [ ] TRD-016 to TRD-030: 0/15 completed

### Core Framework Skills (Sprints 3-4)

- [ ] TRD-031 to TRD-046: 0/16 completed

### Agent Integration (Sprint 4)

- [ ] TRD-047 to TRD-050: 0/4 completed

### Testing & Validation (Sprint 5)

- [ ] TRD-051 to TRD-056: 0/6 completed

### Documentation & Migration (Sprint 6)

- [ ] TRD-057 to TRD-058: 0/2 completed

**Overall Progress**: 0/58 tasks completed (0%)

---

## Appendices

### A. Technology Stack Details

**Node.js Dependencies**:
```json
{
  "dependencies": {
    "js-yaml": "^4.1.0",           // YAML frontmatter parsing
    "glob": "^10.3.10",            // File pattern matching for framework detection
    "fs-extra": "^11.2.0"          // Enhanced file system operations
  },
  "devDependencies": {
    "jest": "^29.7.0",             // Unit testing
    "eslint": "^8.56.0",           // Code quality validation
    "@types/node": "^20.11.0"      // TypeScript definitions
  }
}
```

**File System Operations**:
- Async/await pattern for all file operations
- Error handling with try/catch blocks
- Path validation to prevent directory traversal
- File size checking before content loading

### B. Skill Content Standards

**SKILL.md Structure** (2KB max):
```markdown
---
[Frontmatter with version metadata]
---

# {Framework Name} Framework Skill

## Quick Reference
[When to use, language, version support]

## Core Patterns
### Architecture
[3-5 key architectural patterns]

### Common Operations
[5-10 most frequent operations with code snippets]

## Code Generation Templates
[List of available templates with descriptions]

## See Also
[Links to REFERENCE.md and examples/]
```

**REFERENCE.md Structure** (≤20KB):
```markdown
# {Framework Name} Comprehensive Reference

## Table of Contents
[9 standard sections]

## Architecture & Design Patterns
[Detailed architectural guidance]

## API Development
[Endpoint creation, middleware, validation]

## Data Layer & Persistence
[ORM/database patterns]

## Authentication & Authorization
[Auth implementation patterns]

## Testing Strategies
[Unit, integration, E2E testing]

## Performance Optimization
[Caching, query optimization, profiling]

## Security Best Practices
[Framework-specific vulnerabilities]

## Deployment & Configuration
[Production setup, environment management]

## Common Pitfalls & Solutions
[Anti-patterns and remediation]
```

### C. Framework Detection Patterns Reference

**NestJS Detection**:
```json
{
  "primary_signals": [
    {"file": "package.json", "field": "dependencies", "pattern": "@nestjs/core"},
    {"file": "nest-cli.json", "exists": true}
  ],
  "secondary_signals": [
    {"file": "src/main.ts", "content": "NestFactory.create"},
    {"directory": "src/", "pattern": "*.module.ts"}
  ],
  "confidence_calculation": "primary * 0.4 + secondary * 0.2"
}
```

**Phoenix Detection**:
```json
{
  "primary_signals": [
    {"file": "mix.exs", "field": "deps", "pattern": ":phoenix"},
    {"file": "config/config.exs", "content": "Phoenix.Endpoint"}
  ],
  "secondary_signals": [
    {"directory": "lib/*/", "pattern": "*_web/"},
    {"file": "assets/js/app.js", "exists": true}
  ],
  "confidence_calculation": "primary * 0.4 + secondary * 0.2"
}
```

### D. Version Compatibility Matrix

| Skill Version | NestJS Versions | Backend-Developer Versions | Breaking Changes |
|---------------|-----------------|---------------------------|------------------|
| 1.0.0 | 10.0.0 - 10.x | ≥3.0.0 | Initial release |
| 1.1.0 | 10.0.0 - 11.x | ≥3.0.0 | Added support for NestJS 11 |
| 2.0.0 | 11.0.0 - 11.x | ≥3.1.0 | Removed deprecated patterns |

**Compatibility Validation Logic**:
```javascript
function satisfiesVersionRange(currentVersion, requiredRange) {
  // Parse semver range (>=3.0.0, ^1.0.0, ~2.1.0, 1.x, *)
  if (requiredRange === '*') return true;

  if (requiredRange.startsWith('>=')) {
    return compareVersions(currentVersion, requiredRange.slice(2)) >= 0;
  }

  if (requiredRange.includes('x')) {
    return majorVersionMatches(currentVersion, requiredRange);
  }

  // Add support for ^, ~, and other semver operators
  return semver.satisfies(currentVersion, requiredRange);
}
```

### E. Rollback Checklist

**Pre-Rollback Validation**:
- [ ] Rollback criteria met (accuracy <90%, failures >5%, satisfaction <80%)
- [ ] Backup of current state created
- [ ] Rollback procedure reviewed and understood
- [ ] Team notified of rollback decision

**Rollback Steps** (30 minutes estimated):
1. [ ] Stop all agent activities
2. [ ] Revert git to v3.0.x-pre-skills-migration tag
3. [ ] Restore agent definitions from backup
4. [ ] Remove skills/ infrastructure
5. [ ] Restart Claude Code and verify framework-specialist agents operational
6. [ ] Run smoke tests on all 6 framework-specialist agents
7. [ ] Notify users of rollback completion
8. [ ] Document rollback reason and lessons learned

**Post-Rollback Actions**:
- [ ] Root cause analysis (why did skills-based approach fail?)
- [ ] Gather user feedback on what went wrong
- [ ] Create improvement plan for next attempt
- [ ] Update TRD with lessons learned
- [ ] Plan Phase 4.1 (iteration based on feedback)

---

## References

### Related Documents

- **PRD**: [docs/PRD/skills-based-framework-agents.md](../PRD/skills-based-framework-agents.md) - Product requirements and user journeys
- **Agent Ecosystem**: [agents/README.md](../../agents/README.md) - Current agent inventory and delegation patterns
- **AgentOS Standards**: [docs/agentos/](../../docs/agentos/) - PRD/TRD/DoD templates and guidelines
- **Test Skills Pattern**: [skills/jest-test/](../../skills/jest-test/), [skills/test-detector/](../../skills/test-detector/) - Existing skill implementation reference

### Framework Documentation

- **NestJS**: https://docs.nestjs.com/ - Official NestJS documentation
- **Phoenix**: https://hexdocs.pm/phoenix/ - Official Phoenix framework documentation
- **Rails**: https://guides.rubyonrails.org/ - Official Ruby on Rails guides
- **.NET**: https://learn.microsoft.com/en-us/aspnet/core/ - Official ASP.NET Core documentation
- **React**: https://react.dev/ - Official React documentation
- **Blazor**: https://learn.microsoft.com/en-us/aspnet/core/blazor/ - Official Blazor documentation

### Technical References

- **YAML Schema**: [schemas/agent-schema.json](../../schemas/agent-schema.json) - Agent definition validation
- **NPM Installation**: [package.json](../../package.json) - @fortium/ai-mesh module configuration
- **Progressive Disclosure Pattern**: Industry best practice for layered documentation (API reference + comprehensive guides)
- **Semantic Versioning**: https://semver.org/ - Version numbering specification

---

**Document Status**: ✅ Ready for `/implement-trd` Execution

**Approval Required**: Yes - User must approve before implementation begins per approval-first workflow

**Next Steps**:
1. Review this TRD for completeness and accuracy
2. Obtain explicit user approval to proceed
3. Execute `/implement-trd @docs/TRD/skills-based-framework-agents-trd.md`
4. Begin Sprint 1 implementation with TRD-001 to TRD-015

---

_Generated by Tech Lead Orchestrator following Phase 1-3 methodology_
_TRD Version: 1.0.0 | Created: 2025-10-21 | Target Release: v3.1.0_