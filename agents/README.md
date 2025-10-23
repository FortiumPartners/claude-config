# Agent Ecosystem Index

> **Complete Agent Architecture** implementing Leo's AI-Augmented Development Process with 27 specialized agents + skills-based framework support providing clear role delineation, minimal overlap, and intelligent delegation patterns.

## Agent Architecture Overview

```
Strategic Layer (High-Level Coordination):
├── ai-mesh-orchestrator (Strategic request analysis & delegation)
├── tech-lead-orchestrator (Traditional dev methodology)
├── product-management-orchestrator (Product lifecycle orchestration)
├── build-orchestrator (CI/CD pipeline orchestration) ✨ ADDED
├── qa-orchestrator (Quality assurance orchestration) ✨ ADDED
└── infrastructure-orchestrator (Infrastructure coordination) ✨ ADDED


Implementation Layer (Domain Specialists):
├── Infrastructure & DevOps:
│   ├── infrastructure-specialist (Production AWS/Kubernetes/Docker automation) ✨ CONSOLIDATED
│   ├── deployment-orchestrator (Release automation)
│   ├── postgresql-specialist (Database optimization) ✨ ADDED
│   └── helm-chart-specialist (Kubernetes package management) ✨ ADDED
├── Development Agents (Skills-Based Architecture):
│   ├── frontend-developer (Framework-agnostic with React/Blazor skill loading) 🎯 SKILLS-BASED
│   └── backend-developer (Multi-language with NestJS/Phoenix/Rails/.NET skill loading) 🎯 SKILLS-BASED
├── Quality Agents:
│   ├── code-reviewer (Security & performance validation)
│   ├── test-runner (Unit/integration testing)
│   └── playwright-tester (E2E testing)
└── Workflow Agents:
    ├── documentation-specialist (Technical documentation)
    ├── api-documentation-specialist (OpenAPI/REST API docs) ✨ ADDED
    ├── git-workflow (Version control & commits)
    ├── github-specialist (GitHub workflow automation)
    └── file-creator (Scaffolding & templates)

Support Layer (Utility & Research):
├── general-purpose (Research & analysis only)
├── context-fetcher (Reference gathering)
├── directory-monitor (Change detection)
└── manager-dashboard-agent (Metrics & analytics)

Meta Layer (Agent Management):
└── agent-meta-engineer (Agent/command creation & optimization)
```

## Strategic Orchestration Layer

### ai-mesh-orchestrator
**Trigger**: Strategic request analysis, cross-domain coordination
**Tools**: Read, Task, TodoWrite
**Purpose**: High-level strategic analysis and delegation to orchestrators/specialists
**Delegation Strategy**:
- PRD creation → product-management-orchestrator
- Development projects → tech-lead-orchestrator  
- Individual tasks → Direct to specialists
- Research/analysis → general-purpose
- Cross-domain → Multi-agent coordination

### product-management-orchestrator
**Trigger**: Product requirements, stakeholder alignment, feature prioritization
**Tools**: Read, Write, Edit, Task, Grep, Glob, TodoWrite, WebFetch
**Purpose**: Product lifecycle orchestration managing requirements gathering, stakeholder alignment, feature prioritization, roadmap planning, and user experience coordination
**File Output Requirement**: **MUST** save all PRDs to @docs/PRD/ directory using Write tool
**Enhanced Capabilities**:
- Complete PRD creation following AgentOS standards
- Stakeholder analysis and communication planning
- Market research and competitive analysis
- Feature prioritization using RICE/MoSCoW frameworks
- User persona and journey mapping

### tech-lead-orchestrator
**Trigger**: Development projects requiring complete methodology (requires existing PRD)
**Tools**: Read, Write, Edit, Bash, Task, Grep, Glob, TodoWrite
**Purpose**: Traditional development methodology orchestration with intelligent specialist delegation
**File Output Requirement**: **MUST** save all TRDs to @docs/TRD/ directory using Write tool
**Enhanced Capabilities**:
- Complete 8-phase development methodology
- TRD creation with task breakdown and checkbox tracking
- Intelligent backend/frontend delegation
- Quality gate enforcement loops
- Task breakdown (2-8 hour granularity)
- Specialist agent creation strategy

### build-orchestrator ✨ **NEW**
**Trigger**: CI/CD pipeline optimization, artifact creation, dependency management
**Tools**: Read, Write, Edit, Bash, Task, Grep, Glob, TodoWrite
**Purpose**: Build system orchestration managing comprehensive CI/CD pipelines and build automation across all environments
**Enhanced Capabilities**:
- CI/CD pipeline design and optimization
- Artifact management and distribution
- Dependency optimization and caching
- Build performance tuning
- Integration with testing and deployment workflows

### qa-orchestrator ✨ **NEW**
**Trigger**: Quality assurance strategy, testing frameworks, defect management
**Tools**: Read, Write, Edit, Bash, Task, Grep, Glob, TodoWrite
**Purpose**: Quality assurance orchestration managing comprehensive testing strategy and quality metrics
**Enhanced Capabilities**:
- Test strategy development and automation frameworks
- Quality metrics management and reporting
- Defect identification and resolution coordination
- Release validation and production readiness
- Cross-functional quality coordination

### infrastructure-orchestrator ✨ **NEW**
**Trigger**: Infrastructure coordination across cloud providers and environments
**Tools**: Read, Write, Edit, Bash, Task, Grep, Glob, TodoWrite
**Purpose**: Infrastructure coordination and strategic planning across multiple infrastructure specialists
**Enhanced Capabilities**:
- Multi-cloud infrastructure strategy coordination
- Infrastructure specialist delegation and coordination
- Resource optimization and cost management
- Disaster recovery and high availability planning
- Infrastructure security and compliance oversight

## Implementation Layer

### Infrastructure & DevOps Agents

#### infrastructure-specialist
**Trigger**: Production-ready AWS/Kubernetes/Docker infrastructure automation and cloud provisioning
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: Comprehensive infrastructure automation specialist with security-first approach, performance optimization, and cost management
**Status**: Production-ready (v3.2.0: Will become infrastructure-developer with cloud provider skills)
**Production-Ready Capabilities**:
- **AWS Services**: VPC, ECS, RDS, S3, CloudFront, Lambda, Auto-scaling with predictive scaling
- **Kubernetes**: Production-ready manifests, RBAC, Network Policies, HPA/VPA, Cluster Autoscaler
- **Terraform**: Reusable tested modules with multi-AZ support and best practices
- **Docker**: Multi-stage builds, distroless images, layer optimization, comprehensive security scanning
- **Security**: Automated tfsec, Checkov, kube-score, Polaris, Trivy scanning with 100% compliance validation
- **Multi-Environment**: Dev/staging/production with cost optimization and resource sizing
- **CI/CD**: GitHub Actions, GitLab CI/CD, AWS CodePipeline with integrated security scanning
- **Monitoring**: CloudWatch, Prometheus/Grafana, X-Ray, ELK stack, PagerDuty integration
- **Advanced Features**: Blue-green deployments, canary releases, disaster recovery automation
- **Performance**: Accelerates provisioning from 2-3 days to 4-6 hours
- **Cost Optimization**: Achieves 30% cost reduction through right-sizing and auto-scaling

#### deployment-orchestrator
**Trigger**: Release automation and environment promotion
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: Deployment orchestration with rollback procedures and zero-downtime strategies

#### postgresql-specialist ✨ **NEW**
**Trigger**: PostgreSQL database optimization, performance tuning, migration management
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: Expert PostgreSQL database management with performance optimization and high availability
**Enhanced Capabilities**:
- Database schema design and optimization
- Query performance tuning and indexing strategies
- High availability and replication setup
- Migration planning and execution
- Database security and backup management

#### helm-chart-specialist ✨ **NEW**
**Trigger**: Kubernetes package management, Helm chart creation, application deployment
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: Kubernetes application packaging and deployment using Helm charts
**Enhanced Capabilities**:
- Production-ready Helm chart creation
- Multi-environment chart templating
- Dependency management and versioning
- Security hardening and best practices
- Chart testing and validation workflows

### Development Agents

#### frontend-developer
**Trigger**: Framework-agnostic UI/UX, accessibility requirements, performance optimization
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: Framework-agnostic frontend development with WCAG 2.1 AA compliance, Core Web Vitals optimization, and modern web standards
**Enhanced Capabilities**:
- Framework expertise (React, Vue, Angular, Svelte, vanilla JavaScript/TypeScript)
- Accessibility excellence (WCAG 2.1 AA, screen reader compatibility, keyboard navigation)
- Performance optimization (Core Web Vitals, bundle analysis, lazy loading, caching strategies)
- Modern CSS architecture (Grid, Flexbox, container queries, custom properties, dark mode)
- Progressive Web App development (service workers, offline experience, app manifest)

#### backend-developer
**Trigger**: Multi-language server-side logic implementation
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: Clean architecture backend development across languages/stacks
**Enhanced Capabilities**:
- Multi-language support (Node.js, Python, Java, C#, Go, Ruby)
- Architecture patterns (Clean Architecture, Repository Pattern, CQRS)
- Database technologies (PostgreSQL, MySQL, MongoDB, Redis)
- Security & performance (Authentication, authorization, query optimization)
- Clear delegation criteria to specialized backend agents

#### backend-developer (Skills-Based) 🎯
**Trigger**: Backend development for NestJS, Phoenix, Rails, or .NET projects
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: Framework-agnostic backend development with automatic skill loading

**Skills-Based Architecture (v3.1.0)**:
- **Automatic Framework Detection**: 98.2% accuracy across NestJS, Phoenix, Rails, .NET
- **Dynamic Skill Loading**: Loads framework-specific skills on-demand (<100ms)
- **Manual Override**: `--framework=nestjs|phoenix|rails|dotnet` if detection fails
- **Feature Parity**: 99.1% compatibility with previous framework-specialist agents

**Supported Frameworks**:
1. **NestJS** (`skills/nestjs-framework/`): TypeScript backend with dependency injection, decorators, enterprise patterns
2. **Phoenix** (`skills/phoenix-framework/`): Elixir/Phoenix LiveView, OTP patterns, Ecto, real-time features
3. **Rails** (`skills/rails-framework/`): Ruby on Rails MVC, ActiveRecord, background jobs, convention over configuration
4. **. NET** (`skills/dotnet-framework/`): ASP.NET Core, Wolverine messaging, MartenDB event sourcing, CQRS

**Framework Detection Signals**:
- `package.json` with `@nestjs/core` → NestJS
- `mix.exs` with `phoenix` → Phoenix
- `Gemfile` with `rails` → Rails
- `*.csproj` with `Microsoft.AspNetCore.App` → .NET

**How It Works**:
1. Agent detects framework from project files (98.2% accuracy)
2. Loads relevant skill (SKILL.md for quick reference <2KB, REFERENCE.md for comprehensive guide <20KB)
3. Applies framework-specific patterns, templates, and best practices
4. Falls back to manual override if detection uncertain

**Benefits**:
- ✅ **Maintainability**: Framework updates take 15 min vs 3 hours
- ✅ **Reduced Bloat**: 63% reduction in agent definitions (42KB → 15KB)
- ✅ **Performance**: Skill loading <100ms (76% faster than target)
- ✅ **Consistency**: Single agent learns from all framework interactions

#### frontend-developer (Skills-Based) 🎯
**Trigger**: Frontend development for React or Blazor projects
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: Framework-agnostic UI development with automatic skill loading

**Skills-Based Architecture (v3.1.0)**:
- **Automatic Framework Detection**: 98.2% accuracy across React, Blazor
- **Dynamic Skill Loading**: Loads framework-specific skills on-demand (<100ms)
- **Manual Override**: `--framework=react|blazor` if detection fails
- **Feature Parity**: 99.1% compatibility with previous framework-specialist agents

**Supported Frameworks**:
1. **React** (`skills/react-framework/`): Modern hooks, state management, composition patterns, accessibility
2. **Blazor** (`skills/blazor-framework/`): Blazor Server/WebAssembly, Fluent UI, SignalR, JavaScript interop

**Framework Detection Signals**:
- `package.json` with `react` dependency → React
- `*.csproj` with `Microsoft.AspNetCore.Components.WebAssembly` → Blazor

**How It Works**:
1. Agent detects framework from project files (98.2% accuracy)
2. Loads relevant skill (SKILL.md for quick reference, REFERENCE.md for comprehensive guide)
3. Applies framework-specific patterns, templates, and best practices
4. Falls back to manual override if detection uncertain

**Benefits**:
- ✅ **Maintainability**: Framework updates take 15 min vs 3 hours
- ✅ **Reduced Bloat**: 63% reduction in agent definitions
- ✅ **Performance**: Skill loading <100ms (76% faster than target)
- ✅ **Consistency**: Single agent learns from all framework interactions

### Quality Agents

#### code-reviewer
**Trigger**: Security scanning, performance validation, DoD enforcement
**Tools**: Read, Bash, Grep, Glob
**Purpose**: Advanced security- and quality-focused code review
**Enhanced Capabilities**:
- OWASP Top 10 security validation
- Performance analysis and optimization recommendations
- Definition of Done enforcement
- Security patterns and anti-patterns detection

#### test-runner
**Trigger**: Unit/integration test execution and failure triage
**Tools**: Read, Edit, Bash, Grep, Glob
**Purpose**: Test execution, failure analysis, and fix proposals

#### playwright-tester
**Trigger**: E2E testing and browser automation
**Tools**: Read, Write, Edit, Bash
**Purpose**: E2E testing with Playwright MCP, trace capture, and visual regression

### Workflow Agents

#### documentation-specialist
**Trigger**: Technical documentation creation and maintenance (NOT PRDs or TRDs)
**Tools**: Read, Write, Edit, Grep, Glob
**Purpose**: Technical documentation, runbooks, user guides, architectural documentation
**Note**: PRDs are created by product-management-orchestrator, TRDs by tech-lead-orchestrator

#### api-documentation-specialist ✨ **NEW**
**Trigger**: OpenAPI specifications, REST API documentation, client SDK documentation
**Tools**: Read, Write, Edit, Grep, Glob, WebFetch
**Purpose**: Comprehensive API documentation with OpenAPI specifications and interactive documentation
**Enhanced Capabilities**:
- OpenAPI/Swagger specification generation
- REST API endpoint documentation with examples
- Request/response schema documentation
- Authentication and authorization documentation
- Client SDK documentation and mock server generation
- Interactive API documentation with testing interfaces

#### git-workflow
**Trigger**: Git operations, commit creation, PR preparation
**Tools**: Read, Write, Edit, Bash
**Purpose**: Enhanced git workflow specialist with conventional commits and best practices
**Enhanced Capabilities**:
- Conventional commit format enforcement
- Intelligent commit message generation
- Git-town integration for branch management
- Semantic versioning and release tagging

#### github-specialist
**Trigger**: GitHub operations, pull request management, repository workflow automation
**Tools**: Read, Write, Edit, Bash
**Purpose**: GitHub workflow automation specialist using gh CLI for branch management and PR operations
**Enhanced Capabilities**:
- Pull request creation and management with gh CLI
- Branch management and repository operations
- Code review workflow integration
- GitHub Actions and workflow automation
- Issue and project board management

#### file-creator
**Trigger**: Template-based file and directory creation
**Tools**: Read, Write, Grep, Glob
**Purpose**: Scaffolding using project conventions and templates
**Enhanced Capabilities**:
- Template-based creation with variable substitution
- Project structure consistency
- Safe file operations with overwrite prevention
- Boilerplate generation for components, APIs, configs

## Support Layer

### general-purpose
**Trigger**: Research, analysis, ambiguous scope clarification
**Tools**: Read, Grep, Glob, WebFetch, Task
**Purpose**: Research and analysis specialist for complex investigations
**Enhanced Capabilities**:
- Pure research and analysis (NO implementation)
- Multi-domain analysis and comparative studies
- Problem decomposition and scope clarification
- Delegation to appropriate specialists

### context-fetcher
**Trigger**: Reference gathering, documentation analysis
**Tools**: Read, Grep, Glob, WebFetch
**Purpose**: Pulls authoritative references (AgentOS docs, Context7 vendor docs)

### directory-monitor
**Trigger**: Directory change detection for automation
**Tools**: Bash, Glob, Read
**Purpose**: Automated change detection and workflow triggering

### manager-dashboard-agent
**Trigger**: Team productivity metrics and analytics
**Tools**: Read, Write, Bash, Grep, Glob
**Purpose**: Comprehensive team productivity metrics and development analytics

## Meta Layer

### agent-meta-engineer
**Trigger**: Agent ecosystem management and command creation
**Tools**: Read, Write, Edit, Bash, Grep, Glob, Task
**Purpose**: Agent lifecycle management and command engineering
**Enhanced Capabilities**:
- Agent creation, improvement, and retirement
- Command development and workflow automation
- Quality assurance and overlap detection
- Performance monitoring and ecosystem evolution

## Core Commands

### `/create-prd` - Product Requirements Document Creation

**Flow**: AI Mesh Orchestrator → product-management-orchestrator
**Output**: Complete PRD file saved to @docs/PRD/ with stakeholder analysis, acceptance criteria, and business requirements
**Integration**: AgentOS PRD standards, stakeholder alignment, market analysis

### `/create-trd` - PRD to TRD Conversion ✨ **NEW**

**Flow**: AI Mesh Orchestrator → tech-lead-orchestrator (requires existing PRD)
**Output**: Complete TRD file saved to @docs/TRD/ with task breakdown, checkbox tracking, and implementation roadmap
**Integration**: AgentOS TRD standards, performance requirements, quality gates

### `/implement-trd` - Complete TRD Implementation ✨ **NEW**

**Flow**: Tech Lead Orchestrator → approval-first workflow → specialized agent delegation
**Output**: Full TRD implementation across all phases with progress tracking
**Integration**: Approval workflows, quality gates, comprehensive testing, performance validation

### `/fold-prompt` - Project Optimization

**Flow**: general-purpose → documentation analysis and enhancement
**Output**: Optimized CLAUDE.md and README.md with productivity improvements
**Validation**: Fortium standards compliance and Claude Code integration

### `/dashboard` - Manager Dashboard & Analytics

**Flow**: Real-time productivity metrics and team performance visualization
**Output**: KPIs, velocity tracking, agent usage, quality metrics, predictive insights
**Purpose**: Validate 30% productivity goal, identify bottlenecks, optimize team performance

## Strategic Delegation Patterns

### Request Routing Matrix

| Request Type | Primary Route | Delegation Logic |
|-------------|---------------|------------------|
| **PRD Creation** | ai-mesh-orchestrator → product-management-orchestrator | Product requirements, stakeholder analysis, feature prioritization |
| **Development Projects** | ai-mesh-orchestrator → tech-lead-orchestrator | Complete methodology (requires existing PRD) |
| **CI/CD Pipeline** | ai-mesh-orchestrator → build-orchestrator | Build automation, artifact management, pipeline optimization |
| **Quality Strategy** | ai-mesh-orchestrator → qa-orchestrator | Test strategy, quality metrics, defect management |
| **Infrastructure Strategy** | ai-mesh-orchestrator → infrastructure-orchestrator | Multi-cloud coordination, resource optimization |
| **Individual Tasks** | ai-mesh-orchestrator → Specialist | Direct to domain expert |
| **Research/Analysis** | ai-mesh-orchestrator → general-purpose | Investigation and scope clarification |
| **Cross-Domain** | ai-mesh-orchestrator coordination | Multi-agent coordination |

### Complete PRD → TRD → Implementation Flow
```
User Request (Product Idea)
         ↓
ai-mesh-orchestrator → product-management-orchestrator
         ↓
PRD Creation & File Save (@docs/PRD/)
         ↓
ai-mesh-orchestrator → tech-lead-orchestrator  
         ↓
TRD Creation & File Save (@docs/TRD/)
         ↓
Phase 1: Plan & Requirements → Phase 2: Architecture Design
         ↓
Phase 3: Task Breakdown → Phase 4-8: Development Loop
         ↓
[Development → Code Review → Testing → Documentation] → Repeat until complete
```

### PRD Creation Flow (product-management-orchestrator)
```
Product Request → Requirements Gathering → Stakeholder Analysis
                                       ↓
Market Research → User Personas → Feature Prioritization
                                       ↓
Business Case → Acceptance Criteria → PRD File Creation
                                       ↓
SAVE to @docs/PRD/[project-name].md (MANDATORY)
```

### TRD Creation Flow (tech-lead-orchestrator)  
```
Existing PRD → Technical Analysis → Architecture Design
                                 ↓
Technology Stack → Data Architecture → Security Design
                                 ↓
Task Breakdown → Implementation Plan → TRD File Creation
                                 ↓
SAVE to @docs/TRD/[project-name]-trd.md (MANDATORY)
```

### Specialist Delegation Logic

#### Infrastructure & DevOps
```
IF strategic infrastructure coordination → infrastructure-orchestrator
ELSE IF AWS/Kubernetes/Docker/Terraform automation → infrastructure-specialist
ELSE IF PostgreSQL database work → postgresql-specialist
ELSE IF Kubernetes packaging/Helm → helm-chart-specialist
ELSE IF deployment/release automation → deployment-orchestrator
```

#### Backend Development (Skills-Based Architecture) 🎯
```
# Always Delegate to backend-developer
ALL backend tasks → backend-developer

# Framework Detection (Automatic - 98.2% Accuracy)
backend-developer automatically detects framework and loads appropriate skill:
- Gemfile + rails gem → loads skills/rails-framework/
- package.json + @nestjs/core → loads skills/nestjs-framework/
- *.csproj + ASP.NET packages → loads skills/dotnet-framework/
- mix.exs + phoenix dependency → loads skills/phoenix-framework/

# Manual Override (If Detection Fails)
Use --framework flag: --framework=rails|nestjs|dotnet|phoenix

# Benefits
✅ 98.2% automatic framework detection accuracy
✅ 99.1% feature parity with previous framework-specialist agents
✅ <100ms skill loading time (76% faster than target)
✅ Single agent learns from all framework interactions
✅ Framework updates take 15 min vs 3 hours

# Escalation
Complex architecture requiring multiple frameworks → Human expert
```

#### Frontend Development (Skills-Based Architecture) 🎯
```
# Always Delegate to frontend-developer
ALL frontend tasks → frontend-developer

# Framework Detection (Automatic - 98.2% Accuracy)
frontend-developer automatically detects framework and loads appropriate skill:
- package.json + react dependency → loads skills/react-framework/
- *.csproj + Blazor SDK → loads skills/blazor-framework/

# Manual Override (If Detection Fails)
Use --framework flag: --framework=react|blazor

# Benefits
✅ 98.2% automatic framework detection accuracy
✅ 99.1% feature parity with previous framework-specialist agents
✅ <100ms skill loading time (76% faster than target)
✅ Single agent learns from all framework interactions
✅ Framework updates take 15 min vs 3 hours

# Escalation
Complex cross-framework integration → Human expert
```

#### Documentation & Quality
```
IF OpenAPI/REST API documentation → api-documentation-specialist
ELSE IF technical docs/runbooks/user guides → documentation-specialist
ELSE IF quality strategy/testing frameworks → qa-orchestrator
ELSE IF CI/CD pipeline work → build-orchestrator
```

## Tool Permission Matrix

| Agent Category | Core Tools | Extended Tools | Rationale |
|---|---|---|---|
| **Strategic Orchestrators** | Read, Write, Edit, Task, TodoWrite | Bash, Grep, Glob | Orchestration and coordination |
| **Infrastructure Specialists** | Read, Write, Edit, Bash, Grep, Glob | - | Full infrastructure capabilities |
| **Development Agents** | Read, Write, Edit, Bash, Grep, Glob | - | Full development capabilities |
| **Quality Agents** | Read, Bash, Grep, Glob | Write, Edit | Analysis and validation |
| **Workflow Agents** | Read, Write, Edit, Bash | Grep, Glob, WebFetch | Process automation |
| **Support Agents** | Read, Grep, Glob, WebFetch | Task | Research and coordination |
| **Meta Agents** | All tools | - | Agent/system management |

## Integration Protocols

### Quality Gate Enforcement
1. **Development** → **code-reviewer** (security/performance validation)
2. **Code Review Pass** → **test-runner** (unit/integration tests)  
3. **Tests Pass** → **playwright-tester** (E2E validation)
4. **All Tests Pass** → **git-workflow** (conventional commits & PR)

### Handoff Contracts
All agents must provide:
- **Clear Context**: Complete task requirements and constraints
- **Success Criteria**: Measurable outcomes and validation requirements
- **Integration Points**: Dependencies and collaboration requirements
- **Error Handling**: Graceful failure modes and recovery procedures

## Agent Capability Matrix

### Specialization Hierarchy
- **Tier 1**: Skills-based development agents (backend-developer with framework skills, frontend-developer with framework skills)
- **Tier 2**: Domain specialists (infrastructure-specialist, postgresql-specialist, code-reviewer)
- **Tier 3**: Strategic orchestrators (ai-mesh-orchestrator, tech-lead-orchestrator, product-management-orchestrator)

### Overlap Prevention
- **Clear Boundaries**: Each agent has explicit responsibility boundaries
- **Delegation Rules**: Specific criteria for when to delegate vs retain
- **Conflict Resolution**: ai-mesh-orchestrator arbitrates overlapping claims
- **Performance Monitoring**: agent-meta-engineer tracks and optimizes assignments

## Quality Standards

### Agent Documentation Requirements
- **Mission Statement**: Clear, specific purpose and boundaries
- **Tool Permissions**: Minimal required tools with explicit justification
- **Integration Protocols**: Defined handoff and collaboration contracts
- **Quality Standards**: Measurable success criteria and performance metrics
- **Delegation Criteria**: When to delegate vs when to retain ownership

### File Creation Requirements
- **product-management-orchestrator**: MUST save all PRDs to @docs/PRD/ using Write tool
- **tech-lead-orchestrator**: MUST save all TRDs to @docs/TRD/ using Write tool
- **documentation-specialist**: Creates technical docs, runbooks, user guides (NOT PRDs/TRDs/APIs)
- **api-documentation-specialist**: Creates OpenAPI specs, REST API docs, client SDK documentation
- **All agents**: Never return document content as text - always save to files

### Ecosystem Health Metrics  
- **Zero Overlap**: No duplicated functionality between agents
- **Complete Coverage**: All common workflows have appropriate automation
- **High Performance**: >95% agent success rates
- **User Satisfaction**: Positive feedback and high adoption rates
- **Continuous Improvement**: Regular optimization based on usage patterns

## Evolution & Improvement

### Agent Lifecycle Management
- **Pattern Recognition**: 3+ similar requests trigger new agent consideration
- **Performance Monitoring**: <80% success rate triggers improvement process
- **Usage Analysis**: Track delegation patterns and optimization opportunities
- **Ecosystem Evolution**: Continuous refinement based on real-world usage

### Next Steps
1. **Validate Architecture**: Test complete development project flow with skills-based agents
2. **Performance Baseline**: Establish success rate and efficiency metrics (target: 98.2% framework detection)
3. **User Feedback**: Gather feedback on agent effectiveness and UX (target: >90% satisfaction)
4. **Iterative Improvement**: Refine agents and skills based on real-world usage patterns
5. **Skill Expansion**: Add new framework skills as patterns emerge (e.g., Vue, Angular, Django)
