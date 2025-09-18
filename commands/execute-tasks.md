---
name: execute-tasks
description: Task execution workflow with intelligent agent delegation and coordination
usage: /execute-tasks [task specification or reference]
agent: ai-mesh-orchestrator
allowed-tools: Read, Edit, Bash, MCP
---

# Task Execution Workflow

## Mission

Route task execution requests to the ai-mesh-orchestrator agent for intelligent agent delegation, workflow coordination, and seamless handoffs between specialized agents. This command manages the complete execution phase of development work.

## What This Command Does

- **Intelligent Agent Delegation**: Routes tasks to most appropriate specialized agents
- **Workflow Coordination**: Manages multi-agent workflows and dependencies
- **Quality Gate Enforcement**: Ensures quality standards at every transition point
- **Progress Tracking**: Monitors task completion and identifies bottlenecks
- **Handoff Management**: Coordinates smooth transitions between agent specializations
- **Performance Optimization**: Optimizes agent mesh efficiency and resource utilization

## Usage Patterns

### Task Specification Execution

```
/execute-tasks "Implement user authentication with OAuth2"
```

### Spec-Based Execution

```
/execute-tasks @.agent-os/specs/2025-01-15-user-auth-#123/tasks.md
```

### Multi-Phase Project Execution

```
/execute-tasks "Phase 1: API implementation, Phase 2: Frontend integration, Phase 3: Testing"
```

### Bug Fix Execution

```
/execute-tasks "Fix login redirect bug in production"
```

## Agent Delegation Logic

### Development Tasks

- **Frontend Work**: → frontend-developer, react-component-architect
- **Backend Work**: → backend-developer, rails-backend-expert
- **Full-Stack Features**: → Coordinate frontend + backend agents
- **Database Changes**: → backend-developer + schema specialists

### Quality & Testing

- **Code Review**: → code-reviewer (after all implementations)
- **Unit Testing**: → test-runner
- **E2E Testing**: → playwright-tester
- **Performance Testing**: → specialized testing agents

### Workflow Management

- **Git Operations**: → git-workflow
- **File Operations**: → file-creator, directory-monitor
- **Documentation**: → documentation-specialist
- **Context Research**: → context-fetcher

## Coordination Patterns

### Sequential Workflows

1. **Planning Phase**: Receive TRD from tech-lead-orchestrator
2. **Implementation Phase**: Delegate to appropriate development agents
3. **Testing Phase**: Route to testing specialists
4. **Quality Gate**: Enforce code review and validation
5. **Documentation Phase**: Update docs and complete workflow

### Parallel Workflows

- **Frontend + Backend**: Coordinate simultaneous development
- **Multiple Features**: Manage independent feature development
- **Testing Streams**: Parallel unit and integration testing

### Quality Gates

- **Pre-Implementation**: Validate requirements and dependencies
- **Mid-Implementation**: Progress validation and blocker resolution
- **Pre-Review**: Ensure completeness before code review
- **Pre-Merge**: Final validation and approval workflow

## Handoff Protocols

### From tech-lead-orchestrator

- Receives complete TRD with technical specifications
- Gets recommended agent assignments and implementation phases
- Inherits success criteria and validation requirements

### To Development Specialists

- Provides clear task specifications and context
- Defines success criteria and completion requirements
- Establishes dependencies and handoff points

### To Quality Gates

- Ensures all implementations complete before review
- Provides comprehensive context for validation
- Coordinates approval workflow and merge process

## Integration Points

- **AgentOS Standards**: Follows TRD specifications and quality gates
- **MCP Integration**: Utilizes Context7, Playwright, Linear for enhanced capabilities
- **Git Workflow**: Integrates with version control and PR management
- **Quality Framework**: Enforces Definition of Done at all checkpoints

## Best Practices

- Provide clear task specifications and context
- Reference existing TRDs and technical specifications
- Include dependencies and prerequisite information
- Specify quality requirements and validation criteria
- Set realistic timelines and resource constraints

---

_This command implements intelligent task execution and agent coordination following Leo's AI-Augmented Development Process for optimal development workflow management._
