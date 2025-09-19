---
name: execute-tasks
description: Task execution workflow with intelligent agent delegation and coordination
usage: /execute-tasks [task specification or reference]
agent: ai-mesh-orchestrator
allowed-tools: Read, Edit, Bash, MCP
---

# Task Execution Workflow

## Mission

Route task execution requests to the ai-mesh-orchestrator agent for intelligent agent delegation, workflow coordination, and seamless handoffs between specialized agents. This command manages the complete execution phase of development work, including TRD task tracking, completion marking, and document lifecycle management.

## What This Command Does

- **Intelligent Agent Delegation**: Routes tasks to most appropriate specialized agents
- **Workflow Coordination**: Manages multi-agent workflows and dependencies
- **Quality Gate Enforcement**: Ensures quality standards at every transition point
- **Progress Tracking**: Monitors task completion and identifies bottlenecks
- **TRD Task Management**: Parses TRD files, marks tasks complete, updates progress statistics
- **Document Lifecycle**: Archives completed PRD/TRD documents to @docs/TRD/completed/ and @docs/PRD/completed/
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

### TRD Task Execution

```
/execute-tasks @docs/TRD/user-authentication-system-trd.md
```

### Task Completion Tracking

```
/execute-tasks --mark-complete TRD-001 TRD-003 TRD-007
```

### Progress Status Check

```
/execute-tasks --status @docs/TRD/user-authentication-system-trd.md
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

## TRD Task Management System

### Task Parsing and Identification

The execute-tasks command automatically parses TRD files to identify tasks with the format:

```markdown
- [ ] **TRD-XXX**: Task Description (Xh) - Priority: [High|Medium|Low] - Depends: [TRD-YYY, TRD-ZZZ]
```

### Task Completion Workflow

#### 1. Task Identification and Validation
- Parse TRD files to extract task IDs, descriptions, dependencies, and current status
- Validate task dependencies before allowing completion
- Check for prerequisite task completion

#### 2. Task Execution and Completion
- Delegate task implementation to appropriate specialized agents
- Mark tasks as completed when all acceptance criteria met
- Update checkbox status: `- [ ]` → `- [x]`
- Update task timestamps and completion metadata

#### 3. Progress Statistics Updates
- Calculate and update completion percentages
- Update task summary sections automatically
- Refresh project status indicators

#### 4. Dependency Management
- Track task dependencies and enable dependent tasks when prerequisites complete
- Validate dependency chains before task execution
- Prevent circular dependencies and orphaned tasks

### Document Lifecycle Management

#### Completion Detection
- Monitor TRD task completion percentage
- Trigger archival workflow when all tasks (100%) are completed
- Validate all quality gates before archival

#### Automatic Document Archival
When all TRD tasks are completed:

1. **Create Archive Directories** (if they don't exist):
   ```
   @docs/TRD/completed/
   @docs/PRD/completed/
   ```

2. **Move Completed Documents**:
   ```
   @docs/TRD/project-name-trd.md → @docs/TRD/completed/project-name-trd-YYYY-MM-DD.md
   @docs/PRD/project-name-prd.md → @docs/PRD/completed/project-name-prd-YYYY-MM-DD.md
   ```

3. **Update Cross-References**:
   - Update any remaining references to archived documents
   - Create completion summary with final metrics
   - Log archival action with timestamp and completion statistics

### Task Status Tracking Format

#### Updated Task Completion Status Section
```markdown
## Task Completion Status

**Last Updated**: [AUTO-GENERATED TIMESTAMP]
**Completion Rate**: X% (X of Y tasks completed)

### Recently Completed Tasks
- [x] **TRD-001**: Environment setup and development tools (4h) - Completed: 2025-09-19 14:23
- [x] **TRD-005**: Authentication system architecture (6h) - Completed: 2025-09-19 16:45

### In Progress Tasks
- [ ] **TRD-013**: User registration API endpoint (4h) - Started: 2025-09-19 17:00

### Next Priority Tasks
1. **TRD-014**: User login/logout API endpoints (4h) - Ready to start (depends: TRD-005 ✓)
2. **TRD-015**: JWT token management service (3h) - Blocked (depends: TRD-005 ✓, TRD-013 ⏳)
```

### Integration with Agent Mesh

#### Task Assignment Logic
- **TRD-001 to TRD-020**: Foundation tasks → infrastructure-management-subagent, backend-developer
- **TRD-021 to TRD-040**: Development tasks → frontend-developer, backend-developer, framework specialists
- **TRD-041 to TRD-060**: Testing tasks → test-runner, playwright-tester, qa-orchestrator
- **TRD-061+**: Documentation/deployment → documentation-specialist, deployment-orchestrator

#### Quality Gate Integration
- Code review required via code-reviewer before marking tasks complete
- Test validation via test-runner for all implementation tasks
- Security validation for authentication and data handling tasks
- Performance validation for optimization and infrastructure tasks

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

## Command Integration Points

### AgentOS Standards Integration
- **TRD Specifications**: Follows technical requirements document structure and task breakdown
- **Quality Gates**: Enforces Definition of Done at all checkpoints
- **Task Tracking**: Maintains comprehensive task lifecycle management
- **Documentation Standards**: Integrates with PRD/TRD document standards

### MCP Integration
- **Context7**: Utilizes for vendor documentation and API references during task execution
- **Playwright**: Integrates for E2E testing and browser automation tasks
- **Linear**: Updates ticket status and progress throughout task execution workflow

### Tool Integration
- **Git Workflow**: Coordinates version control operations during task implementation
- **Quality Framework**: Enforces DoD compliance before task completion
- **Agent Mesh**: Seamless handoffs between specialized agents based on task requirements

### File System Integration
- **Document Parsing**: Automatically reads and parses TRD files for task extraction
- **Progress Updates**: Real-time updates to TRD files with completion status
- **Archive Management**: Automated document lifecycle with completion-based archival

## Best Practices for Task Execution

### Task Specification Guidelines
- Provide clear task specifications with measurable acceptance criteria
- Reference existing TRDs and technical specifications for context
- Include dependencies and prerequisite information
- Specify quality requirements and validation criteria
- Set realistic timelines and resource constraints

### TRD Task Management Best Practices
- Use unique task IDs (TRD-XXX format) for all trackable tasks
- Include time estimates (2-8 hour granularity) for accurate planning
- Define clear dependencies to enable proper sequencing
- Assign appropriate priority levels (High/Medium/Low) for resource allocation
- Validate task completion against acceptance criteria before marking complete

### Quality Assurance Integration
- Ensure code review via code-reviewer before task completion
- Validate test coverage for all implementation tasks
- Perform security review for authentication and data handling
- Conduct performance validation for optimization tasks
- Document completion with timestamps and completion metadata

### Document Lifecycle Management
- Monitor TRD completion percentage continuously
- Trigger archival workflow only when 100% completion achieved
- Preserve document history with timestamped archive copies
- Update cross-references and maintain documentation integrity
- Generate completion summaries with final project metrics

---

_This command implements comprehensive task execution with TRD integration, automated completion tracking, and document lifecycle management following Leo's AI-Augmented Development Process for optimal development workflow management._
