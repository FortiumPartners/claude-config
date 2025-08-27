# Sub-Agents Index

> These are **enhanced** prompts based on Leo's AI-Augmented Development Process. These agents work together as a mesh orchestrated by the Meta-Agent to deliver comprehensive AI-driven development workflows.

## Core Orchestration Agents

### meta-agent
**Trigger**: Complex coordination, agent conflicts, multi-agent tasks
**Tools**: Read, Edit, Bash
**Purpose**: Chief orchestrator with intelligent delegation, conflict resolution, and workload balancing
**Enhanced Capabilities**: 
- Agent capability matrix with specialization priority
- Conflict resolution framework (4 strategies)
- Multi-agent coordination protocols
- Quality enforcement and boundary validation

### general-purpose
**Trigger**: When scope is ambiguous or multi-domain research needed
**Tools**: Read, Edit  
**Purpose**: Handles complex research and routes to specialists

### context-fetcher  
**Trigger**: Auto-included in planning/spec/documentation commands
**Tools**: Read
**Purpose**: Pulls authoritative references (AgentOS docs, Context7 vendor docs)

## Core Development Agents

### tech-lead-orchestrator
**Trigger**: `/plan` commands, product-to-technical translation
**Tools**: Read, Edit
**Purpose**: Translates product requirements into technical plans

### frontend-developer
**Trigger**: UI/UX implementation across any framework
**Tools**: Read, Edit, Bash
**Purpose**: Framework-agnostic frontend with accessibility focus

### backend-developer  
**Trigger**: Server-side logic implementation
**Tools**: Read, Edit, Bash
**Purpose**: Clean architecture backend development

### code-reviewer
**Trigger**: Required before opening any PR
**Tools**: Read, Grep, Bash
**Purpose**: Security and quality-focused code review

### test-runner
**Trigger**: After code changes, test failures
**Tools**: Read, Edit, Bash  
**Purpose**: Run tests, triage failures, propose fixes

### playwright-tester
**Trigger**: `/test e2e` and regression tasks
**Tools**: Playwright, Read, Edit, Bash
**Purpose**: E2E testing with trace capture and visual regression

## Framework Specialists

### react-component-architect
**Trigger**: React component development
**Tools**: Read, Edit
**Purpose**: React components with hooks and state management

### rails-backend-expert
**Trigger**: Rails backend development
**Tools**: Read, Edit, Bash
**Purpose**: Rails controllers, services, jobs, configuration

## Utility Agents

### documentation-specialist
**Trigger**: Documentation creation and maintenance
**Tools**: Read, Edit
**Purpose**: PRD/TRD summaries, API docs, runbooks, guides

### git-workflow
**Trigger**: All git operations, commit creation, PR preparation, version management
**Tools**: Read, Edit, Bash
**Purpose**: Enhanced git commit specialist with conventional commits, semantic versioning, and git-town integration
**Enhanced Capabilities**: 
- Conventional commit format enforcement and validation
- Intelligent commit message generation based on change analysis
- Git-town integration for advanced branch management
- Semantic versioning integration and release tagging
- Pre-commit safety protocols and rollback mechanisms

### file-creator
**Trigger**: File/directory creation with templates
**Tools**: Read, Edit
**Purpose**: Scaffold files using project conventions

### directory-monitor
**Trigger**: Directory change detection for automation
**Tools**: Read, Bash
**Purpose**: Monitor directories and trigger automated workflows

## Usage Patterns

### Enhanced Command Delegation
- `/plan` → meta-agent → tech-lead-orchestrator + context-fetcher  
- `/build` → meta-agent analyzes complexity → delegate to appropriate developer agent(s)
- `/test e2e` → meta-agent → playwright-tester (with coordination if needed)
- `/review` → meta-agent → code-reviewer (required quality gate)
- `/document` → meta-agent → documentation-specialist + supporting agents

### Multi-Agent Coordination Patterns
- **Simple Tasks**: Direct delegation to single specialized agent
- **Complex Features**: Primary agent + supporting agents with defined handoffs
- **Quality Gates**: Sequential validation through test-runner → code-reviewer → git-workflow
- **Conflict Resolution**: Meta-agent arbitration using 4 resolution strategies

### Tool Permissions Philosophy
Keep tools minimal per agent. Expand only when a task requires it. Prefer Read/Edit, add Bash only when necessary. MCP tools (e.g., Playwright) should be added explicitly.

### Agent Improvement Process
- Propose improvements via meta-agent
- Update policies after each incident/lesson  
- Keep this index aligned with repository versions
- Replace with robust versions from source repository when available

## Quality Gates
All agents enforce:
- Minimal tool permissions by default
- Explicit handoff/return-value contracts  
- Testable outcomes with evidence
- Integration with AgentOS standards (PRD/TRD/DoD)

## Next Steps
1. Test agent mesh with a simple feature implementation
2. Refine agent prompts based on initial usage
3. Add framework-specific specialists as needed
4. Integrate with MCP servers and AgentOS standards