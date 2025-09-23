# Agent Ecosystem Index

> **Enhanced Agent Architecture** implementing Leo's AI-Augmented Development Process with clear role delineation, minimal overlap, and intelligent delegation patterns.

## Agent Architecture Overview

```
Strategic Layer (High-Level Coordination):
├── ai-mesh-orchestrator (Strategic request analysis & delegation)
└── tech-lead-orchestrator (Traditional dev methodology)
Implementation Layer (Domain Specialists):
├── Infrastructure & DevOps:
│   ├── infrastructure-management-subagent (AWS/Kubernetes/Docker automation) ✨ NEW
│   └── deployment-orchestrator (Release automation)
├── Development Agents:
│   ├── frontend-developer (Framework-agnostic UI/UX)
│   ├── backend-developer (Multi-language server-side)
│   ├── react-component-architect (React-specific)
│   ├── rails-backend-expert (Rails-specific)
│   ├── nestjs-backend-expert (Node.js/NestJS-specific)
│   └── elixir-phoenix-expert (Elixir/Phoenix-specific)
├── Quality Agents:
│   ├── code-reviewer (Security & performance validation)
│   ├── test-runner (Unit/integration testing)
│   └── playwright-tester (E2E testing)
└── Workflow Agents:
    ├── documentation-specialist (PRD/TRD/API docs)
    ├── git-workflow (Version control & commits)
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

## Implementation Layer

### Infrastructure & DevOps Agents

#### infrastructure-management-subagent ✨ **NEW**
**Trigger**: AWS/Kubernetes/Docker infrastructure automation, security-first deployment
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: Expert-level infrastructure automation with comprehensive security and compliance
**Production-Ready Capabilities**:
- **AWS Services**: VPC, ECS, RDS, S3, CloudFront, Lambda, Auto-scaling with predictive scaling
- **Kubernetes**: Manifest generation, RBAC, Network Policies, HPA/VPA, Cluster Autoscaler
- **Docker**: Multi-stage builds, distroless images, security scanning, optimization
- **Security**: Automated tfsec, Checkov, kube-score, Trivy scanning with compliance validation
- **Multi-Environment**: Dev/staging/production with cost optimization and resource sizing
- **CI/CD**: GitHub Actions, GitLab CI/CD, AWS CodePipeline with security scanning
- **Monitoring**: CloudWatch, Prometheus/Grafana, X-Ray, ELK stack, PagerDuty integration
- **Advanced Features**: Blue-green deployments, canary releases, disaster recovery automation

#### deployment-orchestrator
**Trigger**: Release automation and environment promotion
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: Deployment orchestration with rollback procedures and zero-downtime strategies

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

#### react-component-architect
**Trigger**: Complex React component development and state management
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: React-specific component development with modern patterns

#### rails-backend-expert
**Trigger**: Ruby on Rails backend development
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: Rails MVC, ActiveRecord, background jobs, Rails-specific patterns

#### nestjs-backend-expert
**Trigger**: Node.js/NestJS backend development
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: NestJS framework development with TypeScript and enterprise patterns

#### elixir-phoenix-expert
**Trigger**: Elixir/Phoenix development
**Tools**: Read, Write, Edit, Bash, Grep, Glob
**Purpose**: Elixir and Phoenix LiveView development with OTP patterns

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
**Purpose**: API documentation, runbooks, user guides, technical summaries
**Note**: PRDs are created by product-management-orchestrator, TRDs by tech-lead-orchestrator

#### git-workflow
**Trigger**: Git operations, commit creation, PR preparation
**Tools**: Read, Write, Edit, Bash
**Purpose**: Enhanced git workflow specialist with conventional commits and best practices
**Enhanced Capabilities**:
- Conventional commit format enforcement
- Intelligent commit message generation
- Git-town integration for branch management
- Semantic versioning and release tagging

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
IF infrastructure automation OR AWS/Kubernetes/Docker → infrastructure-management-subagent
ELSE IF deployment/release automation → deployment-orchestrator
```

#### Backend Development
```
IF framework = Rails → rails-backend-expert
ELSE IF framework = NestJS/Node.js → nestjs-backend-expert  
ELSE IF framework = Elixir/Phoenix → elixir-phoenix-expert
ELSE → backend-developer (with clear delegation criteria)
```

#### Frontend Development  
```
IF framework = React AND complexity = high → react-component-architect
ELSE IF any framework AND (accessibility OR performance) → frontend-developer
ELSE → frontend-developer (framework-agnostic)
```

## Tool Permission Matrix

| Agent Category | Core Tools | Extended Tools | Rationale |
|---|---|---|---|
| **Strategic Orchestrators** | Read, Task, TodoWrite | - | Analysis and delegation only |
| **Development Agents** | Read, Write, Edit, Bash, Grep, Glob | - | Full development capabilities |  
| **Quality Agents** | Read, Bash, Grep, Glob | - | Analysis and validation |
| **Workflow Agents** | Read, Write, Edit, Bash | - | Process automation |
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
- **Tier 1**: Framework-specific experts (rails-backend-expert, react-component-architect)
- **Tier 2**: Domain generalists (backend-developer, frontend-developer)  
- **Tier 3**: Cross-domain coordinators (ai-mesh-orchestrator, tech-lead-orchestrator)

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
- **documentation-specialist**: Creates API docs, runbooks, user guides (NOT PRDs/TRDs)
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
1. **Validate Architecture**: Test complete development project flow
2. **Performance Baseline**: Establish success rate and efficiency metrics
3. **User Feedback**: Gather feedback on agent effectiveness and UX
4. **Iterative Improvement**: Refine agents based on real-world usage patterns
5. **Specialized Agent Creation**: Add framework specialists as patterns emerge
