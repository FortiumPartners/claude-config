# CLAUDE.md - Fortium AI-Augmented Development Configuration

**Mission**: Implement Leo's AI-Augmented Development Process to achieve 30% productivity increase through Claude Code + SuperClaude + Sub-Agent Mesh integration.

**Role Context**: You are implementing Leo's complete AI-augmented development process with Claude Code as the core runtime, SuperClaude for structured commands, and a comprehensive sub-agent mesh for specialized tasks.

## Leo's AI-Augmented Development Process

This repository implements Leo's complete development process architecture:

**Core Runtime**: Claude Code + SuperClaude + Sub-Agent Mesh driven by Meta-Agent
**Tools**: Exposed via MCP (Model Context Protocol) servers
**Planning**: AgentOS standards (PRD/TRD/DoD/quality gates)  
**Ticketing**: Vendor-neutral MCP integration (Linear, Jira, etc.)

**Current Status**: Full process implementation with comprehensive sub-agent mesh, MCP server integration, and AgentOS standards.

## Repository Architecture

```
claude-config/
├── agents/                    # Sub-agent mesh (Leo's Process)
│   ├── meta-agent.md         # Chief orchestrator and agent spawner
│   ├── tech-lead-orchestrator.md # Product → technical planning
│   ├── frontend-developer.md     # Framework-agnostic UI development
│   ├── backend-developer.md      # Clean architecture server-side
│   ├── code-reviewer.md          # Security/quality DoD enforcement
│   ├── test-runner.md            # Unit/integration test execution
│   ├── playwright-tester.md      # E2E testing with Playwright MCP
│   ├── documentation-specialist.md # PRD/TRD/API documentation
│   ├── git-workflow.md           # Safe git operations
│   └── README.md                 # Agent index and usage patterns
├── commands/                  # SuperClaude command implementations
│   ├── fold-prompt.md        # Project analysis workflow
│   └── playwright-test.md    # E2E testing automation
├── docs/                      # AgentOS standards and specifications
│   └── agentos/              # Leo's structured standards
│       ├── PRD.md           # Product Requirements template
│       ├── TRD.md           # Technical Requirements template
│       ├── DefinitionOfDone.md # Complete DoD checklist
│       └── AcceptanceCriteria.md # AC guidelines and examples
├── mcp/                      # MCP server setup and configuration
│   └── setup-mcp-servers.md # Context7, Playwright, Linear setup
├── scripts/                  # Deployment and automation scripts
│   └── seed_sub_agents.sh   # Complete sub-agent mesh deployment
├── hooks/                    # Development lifecycle automation
├── CLAUDE.md                # This configuration file
└── README.md                # Public documentation and quick start
```

## Leo's Command & Delegation System

### Core Commands (SuperClaude Integration)

#### `/plan` - Planning & Requirements
**Flow**: meta-agent → tech-lead-orchestrator + context-fetcher  
**Output**: TRD with acceptance criteria and task breakdown
**Integration**: AgentOS standards (PRD/TRD), Context7 vendor docs

#### `/build` - Implementation Loop  
**Flow**: Implement code; auto-invoke test-runner on changes
**Output**: Working code with passing unit/integration tests
**Strategy**: Incremental development with continuous testing

#### `/test e2e` - End-to-End Testing
**Flow**: playwright-tester (using Playwright MCP)  
**Output**: E2E test coverage with traces, screenshots, artifacts
**Validation**: User journey coverage and regression protection

#### `/review` - Quality Gate
**Flow**: code-reviewer (DoD/security/performance checklists)
**Output**: Security findings, performance analysis, actionable patches
**Requirement**: Must pass before PR approval

#### `/document` - Documentation & Communication
**Flow**: documentation-specialist → update ticket via MCP
**Output**: CHANGELOG, migration notes, updated AgentOS standards

### Agent Mesh Architecture

#### Core Orchestration Layer
- **meta-agent**: Chief orchestrator; spawns and improves specialists
- **general-purpose**: Handles ambiguous scope; routes to specialists  
- **context-fetcher**: Pulls authoritative references (AgentOS, Context7)

#### Development Specialists  
- **tech-lead-orchestrator**: Product → technical planning with risk assessment
- **frontend-developer**: Framework-agnostic UI with accessibility (WCAG 2.1 AA)
- **backend-developer**: Server-side with clean architecture boundaries
- **code-reviewer**: Security/quality DoD enforcement before PR
- **test-runner**: Unit/integration execution with intelligent failure triage
- **playwright-tester**: E2E testing with Playwright MCP integration

#### Framework Specialists (Expandable)
- **react-component-architect**: React components with modern hooks patterns
- **rails-backend-expert**: Rails MVC with background jobs and configuration

#### Utility & Management
- **documentation-specialist**: PRD/TRD/API docs with examples and diagrams
- **git-workflow**: Safe git operations with conventional commits
- **file-creator**: Template-based file generation with project conventions
- **directory-monitor**: Automated change detection and workflow triggering

## MCP Server Integration

### Required MCP Servers (Leo's Process)

#### Context7 - Versioned Documentation  
**Purpose**: Inject version-specific docs and examples directly into prompts
**Reduces**: API/versioning errors through authoritative vendor documentation
**Setup**: `claude mcp add context7 --scope user -- npx -y @upstash/context7-mcp@latest`

#### Playwright MCP - Browser Automation & E2E Testing
**Purpose**: Browser automation and E2E testing as callable tools from agents  
**Capabilities**: Cross-browser testing, visual regression, performance metrics
**Setup**: `claude mcp add playwright --scope user -- npx -y @playwright/mcp@latest`

#### Linear/Jira - Vendor-Neutral Ticketing
**Purpose**: Connect preferred tracker through MCP servers
**Integration**: Status updates, requirement linking, artifact attachment
**Setup**: Various based on vendor (Linear, Atlassian, etc.)

### MCP Integration Patterns
- **Context7**: Auto-invoked by context-fetcher for vendor documentation
- **Playwright**: Used by playwright-tester for E2E test execution
- **Ticketing**: Updated throughout workflow for status and artifact tracking

## Standard Development Workflow (Leo's Process)

### From Ticket to Merge - Complete Flow

#### Step 1: Planning & Scope (`/plan`)
```
Input: Ticket ID + constraints + goal + context
Flow: meta-agent → tech-lead-orchestrator + context-fetcher  
Output: Clear TRD with acceptance criteria and task breakdown
```

#### Step 2: Create/Update Ticket  
```
Flow: Update ticket via Ticketing MCP with TRD, criteria, and links
Validation: Status, assignee, labels, concrete testable ACs
```

#### Step 3: Implementation (`/build`)
```
Flow: git-workflow → implement incrementally → test-runner after each step
Strategy: Part A (API/schema) → Part B (service) → Part C (UI)
Output: Unit and integration tests passing, idiomatic code
```

#### Step 4: E2E Testing (`/test e2e`) 
```
Flow: playwright-tester generates/updates specs, runs with traces
Validation: Covers acceptance criteria, stable selectors, auth helpers
Output: Green E2E suite with artifacts for debugging
```

#### Step 5: Quality Gate (`/review`)
```
Flow: code-reviewer enforces DoD (security, performance, maintainability)  
Requirements: All high-severity findings addressed, tests still green
Output: Security validated, performance checked, patches applied
```

#### Step 6: Documentation & PR (`/document`)
```
Flow: git-workflow creates PR + documentation-specialist updates docs
Output: CHANGELOG, migration notes, clear PR with TRD summary
```

#### Step 7: Merge & Close
```
Flow: Ticketing MCP updates status, work-completion-summary for stakeholders
Result: Ticket closed, PR merged, documentation updated, tests green on CI
```

### Quality Gates (Definition of Done)
An item is **Done** only when ALL are true:
- [ ] **Scope**: TRD updated; acceptance criteria satisfied (unit/integration/E2E)
- [ ] **Code**: Reviewed by code-reviewer; no high-severity findings remain  
- [ ] **Security**: Inputs validated; secrets/config safe; authZ/authN rules enforced
- [ ] **Performance**: Meets perf budget or accepted trade-off documented
- [ ] **Docs**: PR body clear; CHANGELOG/migration notes updated; runbooks adjusted
- [ ] **Ticket**: Status updated via MCP; links to PR, TRD, artifacts included

## AgentOS Standards Integration

### Structured Standards (docs/agentos/)

#### PRD.md - Product Requirements Document Template
- Summary, Goals/Non-goals, Users/Personas  
- Acceptance Criteria with functional, performance, security, accessibility requirements
- Constraints/Risks with technical and business considerations
- References to Context7/vendor documentation

#### TRD.md - Technical Requirements Document Template  
- System Context & Constraints, Architecture Overview
- Interfaces & Data Contracts (API specs, external integrations)
- Non-functional Requirements (performance, security, reliability)
- Test Strategy (unit ≥80%, integration ≥70%, E2E coverage)
- Deployment & Migration Notes with rollback procedures

#### DefinitionOfDone.md - Comprehensive Quality Gates
- 8-category checklist: Scope, Code Quality, Testing, Security, Performance, Documentation, Deployment, Process
- Each category has specific, measurable criteria  
- Enforced by code-reviewer agent before PR approval

#### AcceptanceCriteria.md - AC Guidelines and Examples
- Given-When-Then format specifications
- Covers functional, performance, security, accessibility requirements
- Includes validation checklist for completeness

### Agent Configuration Standards (Leo's Process)
```yaml
---
name: agent-name
description: Clear mission statement and boundaries
tools: ["minimal", "required", "tool", "set"]
---

## Mission
Specific expertise and responsibility area

## Behavior  
Key behaviors, handoff protocols, success criteria
```

## Development Workflow

### Git Operations
- **Primary Branch**: `main` (protected, requires PR review)
- **Feature Branches**: `feature/command-name` or `feature/agent-name`
- **Commit Convention**: Conventional commits with productivity impact metrics
- **Review Process**: Peer review required for all configuration changes

### Quality Gates
1. **Configuration Validation**: Syntax and structure verification
2. **Performance Testing**: Command execution time and resource usage
3. **Integration Testing**: Compatibility with Claude Code versions
4. **Documentation Review**: Clarity and completeness assessment
5. **User Acceptance**: Customer validation for productivity improvements

### Testing Strategy
- **Unit Testing**: Individual command and agent validation
- **Integration Testing**: Cross-component workflow verification
- **Performance Testing**: Execution speed and resource optimization
- **User Testing**: Real-world scenario validation with customers

## Quick Start & Deployment

### Bootstrap from Scratch (Leo's Process)
**Prerequisites**: macOS/Linux, Node 18+, Git, Docker, Claude Code installed

#### 1. MCP Server Setup
```bash
# Install required MCP servers
claude mcp add context7 --scope user -- npx -y @upstash/context7-mcp@latest
claude mcp add playwright --scope user -- npx -y @playwright/mcp@latest  
claude mcp add linear --scope user -- npx -y mcp-remote https://mcp.linear.app/sse

# Verify installation
claude mcp list
```

#### 2. Deploy Sub-Agent Mesh (Interactive Installation)
```bash
# Clone and navigate to repo
git clone https://github.com/FortiumPartners/claude-config.git && cd claude-config

# Run interactive installer with user choice
./install.sh

# Choose installation scope:
# Option 1: Global (~/claude/) - Available across all projects
# Option 2: Local (.claude/) - Project-specific configuration

# Installer automatically:
# - Creates backup of existing configuration
# - Installs 17+ specialized agents
# - Installs SuperClaude commands  
# - Validates installation completeness
```

#### 3. Validate Setup
```bash
# Installation is automatically validated during install.sh
# Manual verification (adjust path based on installation choice):

# Global installation check:
ls ~/.claude/agents/ ~/.claude/commands/

# Local installation check:  
ls .claude/agents/ .claude/commands/

# In Claude Code, verify agents and MCP servers
/agents  # Should show full agent mesh
# Test MCP integration
"Use Playwright MCP to open example.com and assert title contains 'Example'"
```

### Usage Patterns

#### Feature Development Flow
```
1. /plan [ticket-link + constraints + goal]
2. Create/update ticket via MCP with TRD  
3. /build [incremental implementation with test-runner]
4. /test e2e [playwright coverage with traces]
5. /review [DoD enforcement with code-reviewer]
6. /document [PR creation + CHANGELOG updates]
7. Merge & ticket closure via MCP
```

#### Quick Command Reference
- **Planning**: `/plan` → TRD + task breakdown
- **Implementation**: `/build` → code + tests  
- **E2E Testing**: `/test e2e` → Playwright coverage
- **Quality Gate**: `/review` → DoD enforcement
- **Documentation**: `/document` → CHANGELOG + PR

## Productivity Metrics

### Key Performance Indicators
- **Development Speed**: 30% reduction in routine task completion time
- **Error Reduction**: 50% decrease in configuration-related issues
- **Automation Coverage**: 80% of repetitive tasks automated
- **User Satisfaction**: 90% positive feedback on workflow improvements

### Measurement Framework
- **Baseline Metrics**: Pre-implementation performance measurements
- **Continuous Monitoring**: Real-time productivity tracking
- **Regular Reviews**: Monthly assessment of improvement trends
- **Customer Feedback**: Quarterly satisfaction and impact surveys

## Integration Ecosystem

### Claude Code Integration
- **Command Discovery**: Automatic detection of available commands
- **Context Awareness**: Intelligent command suggestion based on project state
- **Performance Optimization**: Resource usage monitoring and optimization
- **Error Handling**: Graceful failure recovery and user guidance

### External Tool Integration
- **Version Control**: Git hooks and workflow automation
- **CI/CD Pipelines**: Deployment and testing integration
- **Monitoring Tools**: Performance and health check integration
- **Communication**: Slack, Teams, and email notification workflows

## Troubleshooting & Best Practices

### Common Issues
- **MCP Auth Issues**: Follow vendor OAuth flows; re-add servers if tokens expire
- **Commands Not Visible**: Restart Claude Code; verify MCP servers listed; check SuperClaude config
- **Agent Permission Errors**: Keep tool permissions minimal; grant Bash/MCP tools only when needed
- **Process Improvement**: Use meta-agent to refactor prompts when patterns emerge

### Agent Orchestration Best Practices  
- **Minimal Tools**: Start with Read/Edit; add Bash/MCP tools only when required
- **Clear Boundaries**: Each agent has explicit mission and handoff contracts
- **Continuous Improvement**: Evolve agent prompts based on usage patterns
- **Quality Gates**: Enforce DoD through code-reviewer before any PR merge

## Implementation Status

### ✅ Completed Components
- **MCP Server Integration**: Context7, Playwright, Linear setup documentation
- **Sub-Agent Mesh**: Complete 13-agent mesh with orchestration patterns
- **AgentOS Standards**: PRD/TRD/DoD/AC templates and guidelines  
- **Deployment Scripts**: Automated seed script for full process deployment
- **Command Integration**: /plan, /build, /test e2e, /review, /document workflows

### 🎯 Success Metrics (Leo's Process)
- **30% Productivity Increase**: Through AI-augmented development workflows
- **Quality Improvement**: DoD enforcement and comprehensive testing coverage
- **Process Standardization**: AgentOS structure with repeatable outcomes
- **Integration Efficiency**: Vendor-neutral MCP server ecosystem

## Agent OS Documentation

### Product Context
- **Mission & Vision:** @.agent-os/product/mission.md
- **Technical Architecture:** @.agent-os/product/tech-stack.md
- **Development Roadmap:** @.agent-os/product/roadmap.md
- **Decision History:** @.agent-os/product/decisions.md

### Development Standards
- **Code Style:** @~/.agent-os/standards/code-style.md
- **Best Practices:** @~/.agent-os/standards/best-practices.md

### Project Management
- **Active Specs:** @.agent-os/specs/
- **Spec Planning:** Use `@~/.agent-os/instructions/create-spec.md`
- **Tasks Execution:** Use `@~/.agent-os/instructions/execute-tasks.md`

## Workflow Instructions

When asked to work on this codebase:

1. **First**, check @.agent-os/product/roadmap.md for current priorities
2. **Then**, follow the appropriate instruction file:
   - For new features: @.agent-os/instructions/create-spec.md
   - For tasks execution: @.agent-os/instructions/execute-tasks.md
3. **Always**, adhere to the standards in the files listed above

## Important Notes

- Product-specific files in `.agent-os/product/` override any global standards
- User's specific instructions override (or amend) instructions found in `.agent-os/specs/...`
- Always adhere to established patterns, code style, and best practices documented above.

---

*Implementation of Leo's AI-Augmented Development Process*  
*Version: 3.0 - Full Process Implementation*  
*Maintainer: Fortium Software Configuration Team*